-- ============================================================
-- NOIR — Database Schema v6.1 PATCH
-- Supabase (PostgreSQL) | Ožujak 2026.
-- ============================================================
-- Pokrenuti u Supabase SQL Editoru NAKON v6.0.
-- Svaki blok je označen s ID problema (P1, P2, ...) radi tracinga.
--
-- SADRŽAJ:
--   P1:  Cross-validacija occurrence venue_id ↔ venue_layout_id
--   P2:  Fix expire_pending_orders — scoped lock cleanup
--   P3:  Fix handle_occurrence_cancellation za free evente
--   P4:  Fix populate_occurrence_items — INSERT + UPDATE
--   P8:  total_capacity NOT NULL + positive check
--   P13: QR token — DB-level generiranje
--   P14: ticket_scans tablica + scan_ticket() funkcija
--   P15: Ticket ↔ Tier ↔ Section validacija (Opcija B)
--   P16: redeem_drink() s audit trailom
--   IDX: Nedostajući indeksi
--   RLS: Politike za nove tablice
-- ============================================================


-- ############################################################
-- P1: Cross-validacija venue_id ↔ venue_layout_id na occurrenceu
-- ############################################################
-- Problem: ništa ne sprečava da occurrence referencira layout
-- koji pripada drugom venueu. Posljedica: potpuno krivi tlocrt,
-- sekcije, sjedala i svi kaskadni triggeri rade s krivim podacima.

CREATE OR REPLACE FUNCTION validate_occurrence_layout_belongs_to_venue()
RETURNS TRIGGER
LANGUAGE plpgsql AS $$
DECLARE v_layout_venue UUID;
BEGIN
    SELECT venue_id INTO v_layout_venue
    FROM venue_layouts WHERE id = NEW.venue_layout_id;

    IF v_layout_venue IS DISTINCT FROM NEW.venue_id THEN
        RAISE EXCEPTION 'Layout (%) ne pripada venueu (%). Layout pripada venueu (%).',
            NEW.venue_layout_id, NEW.venue_id, v_layout_venue;
    END IF;
    RETURN NEW;
END;
$$;

CREATE TRIGGER trg_validate_occurrence_layout_venue
    BEFORE INSERT OR UPDATE OF venue_layout_id ON event_occurrences
    FOR EACH ROW EXECUTE FUNCTION validate_occurrence_layout_belongs_to_venue();


-- ############################################################
-- P2: Fix expire_pending_orders — scoped lock cleanup
-- ############################################################
-- Problem: stara verzija oslobađa SVE lockove korisnika na SVIM
-- izvedbama. Ako korisnik ima dva paralelna checkoutа, expiry
-- jednog oslobađa lockove drugog.

CREATE OR REPLACE FUNCTION expire_pending_orders()
RETURNS VOID
LANGUAGE plpgsql AS $$
DECLARE v_order RECORD;
BEGIN
    FOR v_order IN
        SELECT id FROM orders
        WHERE status IN ('draft', 'pending_payment')
          AND (
              (expires_at IS NOT NULL AND expires_at < NOW())
              OR
              (expires_at IS NULL AND created_at < NOW() - INTERVAL '30 minutes')
          )
        FOR UPDATE SKIP LOCKED
    LOOP
        -- 1. Expire order
        UPDATE orders SET status = 'expired' WHERE id = v_order.id;
        UPDATE order_items SET status = 'cancelled'
        WHERE order_id = v_order.id AND status = 'pending';

        -- 2. Expire tickete
        UPDATE tickets SET status = 'expired'
        WHERE id IN (
            SELECT item_id FROM order_items
            WHERE order_id = v_order.id AND item_type = 'ticket'
        ) AND status IN ('reserved', 'pending_payment');

        -- 3. Oslobodi seat statuse SAMO za tickete iz ovog ordera
        UPDATE occurrence_item_status
        SET    status = 'available', ticket_id = NULL,
               locked_by = NULL, reserved_until = NULL
        WHERE  ticket_id IN (
            SELECT item_id FROM order_items
            WHERE order_id = v_order.id AND item_type = 'ticket'
        ) AND status IN ('sold', 'reserved', 'locked');

        -- 4. Oslobodi lockove SAMO za occurrenceove iz ovog ordera
        --    (za slučaj kad lockovi postoje ali ticketi još nisu kreirani)
        UPDATE occurrence_item_status ois
        SET    status = 'available', locked_by = NULL,
               reserved_until = NULL
        WHERE  ois.locked_by = (SELECT user_id FROM orders WHERE id = v_order.id)
          AND  ois.status = 'locked'
          AND  ois.reserved_until IS NOT NULL
          AND  ois.occurrence_id IN (
              SELECT DISTINCT t.occurrence_id
              FROM   order_items oi
              JOIN   tickets t ON t.id = oi.item_id
              WHERE  oi.order_id = v_order.id AND oi.item_type = 'ticket'
          );

        -- 5. Expire bundleove
        UPDATE ticket_bundles SET status = 'cancelled'
        WHERE id IN (
            SELECT item_id FROM order_items
            WHERE order_id = v_order.id AND item_type = 'bundle'
        ) AND status = 'pending_payment';

        -- 6. Expire table_reservations
        UPDATE table_reservations
        SET    status = 'expired', cancelled_at = NOW()
        WHERE  id IN (
            SELECT item_id FROM order_items
            WHERE order_id = v_order.id AND item_type = 'table_reservation'
        ) AND status IN ('pending', 'confirmed');
    END LOOP;
END;
$$;


-- ############################################################
-- P3: Fix handle_occurrence_cancellation za free evente
-- ############################################################
-- Problem: za free event nema charge transakcije, pa INSERT refund
-- s parent_transaction_id = NULL krši chk_txn_parent_required.
-- Cancellation rollbacka i occurrence ostaje u limbu.

CREATE OR REPLACE FUNCTION handle_occurrence_cancellation()
RETURNS TRIGGER
LANGUAGE plpgsql AS $$
DECLARE
    v_bundle              RECORD;
    v_total_occurrences   INT;
    v_refund_per_occ      DECIMAL(10,2);
    v_active_occ_count    INT;
    v_used_ticket_count   INT;
    v_order_id            UUID;
    v_order_item_id       UUID;
    v_charge_txn_id       UUID;
    v_currency            VARCHAR(3);
BEGIN
    IF NEW.status != 'cancelled' OR OLD.status = 'cancelled' THEN
        RETURN NEW;
    END IF;

    -- Striktan redoslijed (sprečava cascading trigger probleme):

    -- 1. Unavailable sve stavke
    UPDATE occurrence_item_status SET status = 'unavailable'
    WHERE  occurrence_id = NEW.id;

    -- 2. Cancel sve rezervacije
    UPDATE table_reservations SET status = 'cancelled', cancelled_at = NOW()
    WHERE  occurrence_id = NEW.id AND status IN ('pending', 'confirmed');

    -- 3. Cancel sve tickete
    UPDATE tickets SET status = 'cancelled', cancelled_at = NOW()
    WHERE  occurrence_id = NEW.id
      AND  status IN ('active', 'reserved', 'pending_payment');

    -- 4. Bundle refund
    FOR v_bundle IN
        SELECT DISTINCT tb.id AS bundle_id, tb.total_price,
               tb.bundle_type_id, tb.user_id,
               tb.refunded_amount AS current_refunded,
               tb.original_occurrence_count
        FROM   ticket_bundles tb
        JOIN   tickets t ON t.bundle_id = tb.id
        WHERE  t.occurrence_id = NEW.id
          AND  tb.status IN ('active', 'partially_used', 'partially_refunded')
    LOOP
        v_total_occurrences := v_bundle.original_occurrence_count;
        IF v_total_occurrences IS NULL OR v_total_occurrences = 0 THEN
            SELECT COUNT(*) INTO v_total_occurrences
            FROM bundle_type_occurrences
            WHERE bundle_type_id = v_bundle.bundle_type_id;
        END IF;

        IF v_total_occurrences > 0 THEN
            v_refund_per_occ := LEAST(
                v_bundle.total_price / v_total_occurrences,
                v_bundle.total_price - COALESCE(v_bundle.current_refunded, 0)
            );

            UPDATE ticket_bundles
            SET    refunded_amount = COALESCE(refunded_amount, 0) + v_refund_per_occ,
                   status = 'partially_refunded'
            WHERE  id = v_bundle.bundle_id;

            -- Refund kroz orders model
            SELECT oi.order_id, oi.id, o.currency
            INTO   v_order_id, v_order_item_id, v_currency
            FROM   order_items oi
            JOIN   orders o ON o.id = oi.order_id
            WHERE  oi.item_type = 'bundle'
              AND  oi.item_id = v_bundle.bundle_id
            LIMIT 1;

            -- SAMO kreiraj transakciju ako postoji charge I refund > 0
            IF v_order_id IS NOT NULL AND v_refund_per_occ > 0 THEN
                SELECT id INTO v_charge_txn_id
                FROM   transactions
                WHERE  order_id = v_order_id
                  AND  transaction_type = 'charge'
                  AND  status = 'completed'
                ORDER BY created_at ASC LIMIT 1;

                -- Za free evente nema chargea — preskoči refund transakciju
                IF v_charge_txn_id IS NOT NULL THEN
                    INSERT INTO transactions (
                        order_id, transaction_type, parent_transaction_id,
                        amount, currency, status, metadata, refunded_items
                    ) VALUES (
                        v_order_id, 'refund', v_charge_txn_id,
                        v_refund_per_occ,
                        COALESCE(v_currency, 'EUR'),
                        'completed',
                        jsonb_build_object(
                            'reason', 'occurrence_cancelled',
                            'occurrence_id', NEW.id
                        ),
                        jsonb_build_array(jsonb_build_object(
                            'order_item_id', v_order_item_id,
                            'amount', v_refund_per_occ
                        ))
                    );
                END IF;

                UPDATE order_items
                SET    refunded_amount = COALESCE(refunded_amount, 0)
                                       + v_refund_per_occ,
                       status = CASE
                           WHEN COALESCE(refunded_amount, 0)
                                + v_refund_per_occ >= subtotal
                           THEN 'refunded'::order_item_status
                           ELSE status
                       END
                WHERE  id = v_order_item_id;
            END IF;

            -- Full refund detekcija
            SELECT COUNT(*) INTO v_active_occ_count
            FROM   bundle_type_occurrences bto
            JOIN   event_occurrences eo ON eo.id = bto.occurrence_id
            WHERE  bto.bundle_type_id = v_bundle.bundle_type_id
              AND  eo.status NOT IN ('cancelled', 'completed');

            IF v_active_occ_count = 0 THEN
                SELECT COUNT(*) INTO v_used_ticket_count
                FROM   tickets
                WHERE  bundle_id = v_bundle.bundle_id
                  AND  status = 'scanned';

                IF v_used_ticket_count = 0 THEN
                    UPDATE ticket_bundles
                    SET    status = 'refunded',
                           refunded_amount = total_price
                    WHERE  id = v_bundle.bundle_id;
                END IF;
            END IF;
        END IF;
    END LOOP;

    RETURN NEW;
END;
$$;


-- ############################################################
-- P4: Fix populate_occurrence_items — INSERT + UPDATE
-- ############################################################
-- Problem: trigger se pali samo na UPDATE, ne na INSERT.
-- Ako netko insertira occurrence direktno sa status='on_sale',
-- sjedala se ne populiraju.

DROP TRIGGER IF EXISTS trg_populate_occurrence_items ON event_occurrences;

CREATE OR REPLACE FUNCTION populate_occurrence_items()
RETURNS TRIGGER
LANGUAGE plpgsql AS $$
BEGIN
    -- OLD je NULL za INSERT, eksplicitni guard
    IF NEW.status = 'on_sale' AND (OLD IS NULL OR OLD.status != 'on_sale') THEN
        INSERT INTO occurrence_item_status (occurrence_id, item_id, status)
        SELECT NEW.id, vi.id, 'available'
        FROM   venue_items vi
        JOIN   venue_sections vs ON vs.id = vi.section_id
        JOIN   tier_sections ts ON ts.section_id = vs.id
        JOIN   event_tiers et ON et.id = ts.tier_id
        WHERE  et.occurrence_id = NEW.id
          AND  et.is_active = TRUE
          AND  vi.is_active = TRUE
          AND  vs.is_numbered = TRUE
        ON CONFLICT (occurrence_id, item_id) DO NOTHING;
    END IF;
    RETURN NEW;
END;
$$;

CREATE TRIGGER trg_populate_occurrence_items
    AFTER INSERT OR UPDATE OF status ON event_occurrences
    FOR EACH ROW EXECUTE FUNCTION populate_occurrence_items();


-- ############################################################
-- P8: total_capacity NOT NULL + positive check
-- ############################################################
-- Organizator UVIJEK postavlja kapacitet. NULL bi preskočio
-- T5 tier capacity check (guard: IF NULL THEN RETURN NEW).

ALTER TABLE event_occurrences
    ALTER COLUMN total_capacity SET NOT NULL;

ALTER TABLE event_occurrences
    ADD CONSTRAINT chk_occurrence_capacity_positive
    CHECK (total_capacity > 0);


-- ############################################################
-- P13: QR token — DB-level generiranje
-- ############################################################
-- Kriptografski siguran 64-char hex token.
-- 32 bajta entropije = 256 bita — nemoguće brute-forceati.

ALTER TABLE tickets
    ALTER COLUMN qr_token SET DEFAULT encode(gen_random_bytes(32), 'hex');

ALTER TABLE ticket_bundles
    ALTER COLUMN qr_token SET DEFAULT encode(gen_random_bytes(32), 'hex');

-- Komentar: app može overridati s vlastitim tokenom, ali default je siguran.


-- ############################################################
-- P14: ticket_scans tablica + scan_ticket() funkcija
-- ############################################################
-- Audit trail za svaki scan pokušaj (uspješan ili ne).
-- Double-scan zaštita: samo 'active' → 'scanned' je dozvoljen.

-- Enum za scan rezultat
CREATE TYPE scan_result AS ENUM (
    'success',             -- prvi uspješan scan
    'already_scanned',     -- ticket je već skeniran
    'invalid_status',      -- ticket nije aktivan (cancelled, expired, itd.)
    'wrong_occurrence',    -- ticket ne pripada ovoj izvedbi
    'not_found'            -- ticket ne postoji
);

CREATE TABLE ticket_scans (
    id              BIGSERIAL PRIMARY KEY,
    ticket_id       UUID REFERENCES tickets(id),
    occurrence_id   UUID NOT NULL REFERENCES event_occurrences(id),
    scanned_by      UUID NOT NULL REFERENCES auth.users(id),
    qr_token        VARCHAR(255) NOT NULL,   -- što je skenirano (za audit)
    result          scan_result NOT NULL,
    ticket_status   ticket_status,            -- status ticketa u trenutku scana
    metadata        JSONB DEFAULT '{}',       -- device info, lokacija, itd.
    created_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_ticket_scans_ticket ON ticket_scans(ticket_id);
CREATE INDEX idx_ticket_scans_occurrence ON ticket_scans(occurrence_id);
CREATE INDEX idx_ticket_scans_time ON ticket_scans(created_at DESC);
CREATE INDEX idx_ticket_scans_scanned_by ON ticket_scans(scanned_by);

-- Funkcija za skeniranje ticketa
CREATE OR REPLACE FUNCTION scan_ticket(
    p_qr_token      VARCHAR(255),
    p_occurrence_id  UUID,
    p_scanned_by     UUID,
    p_metadata       JSONB DEFAULT '{}'
) RETURNS JSONB
LANGUAGE plpgsql AS $$
DECLARE
    v_ticket         tickets%ROWTYPE;
    v_result         scan_result;
    v_scan_id        BIGINT;
BEGIN
    -- 1. Pronađi ticket po QR tokenu
    SELECT * INTO v_ticket
    FROM   tickets
    WHERE  qr_token = p_qr_token
    FOR UPDATE;

    -- Ticket ne postoji
    IF NOT FOUND THEN
        INSERT INTO ticket_scans (
            ticket_id, occurrence_id, scanned_by,
            qr_token, result, metadata
        ) VALUES (
            NULL, p_occurrence_id, p_scanned_by,
            p_qr_token, 'not_found', p_metadata
        ) RETURNING id INTO v_scan_id;

        RETURN jsonb_build_object(
            'success', FALSE,
            'result', 'not_found',
            'scan_id', v_scan_id,
            'message', 'Ticket s ovim QR kodom ne postoji'
        );
    END IF;

    -- 2. Provjeri pripada li ticket ovoj izvedbi
    IF v_ticket.occurrence_id != p_occurrence_id THEN
        INSERT INTO ticket_scans (
            ticket_id, occurrence_id, scanned_by,
            qr_token, result, ticket_status, metadata
        ) VALUES (
            v_ticket.id, p_occurrence_id, p_scanned_by,
            p_qr_token, 'wrong_occurrence', v_ticket.status, p_metadata
        ) RETURNING id INTO v_scan_id;

        RETURN jsonb_build_object(
            'success', FALSE,
            'result', 'wrong_occurrence',
            'scan_id', v_scan_id,
            'message', 'Ticket ne pripada ovoj izvedbi',
            'ticket_occurrence_id', v_ticket.occurrence_id
        );
    END IF;

    -- 3. Već skeniran
    IF v_ticket.status = 'scanned' THEN
        INSERT INTO ticket_scans (
            ticket_id, occurrence_id, scanned_by,
            qr_token, result, ticket_status, metadata
        ) VALUES (
            v_ticket.id, p_occurrence_id, p_scanned_by,
            p_qr_token, 'already_scanned', v_ticket.status, p_metadata
        ) RETURNING id INTO v_scan_id;

        RETURN jsonb_build_object(
            'success', FALSE,
            'result', 'already_scanned',
            'scan_id', v_scan_id,
            'message', 'Ticket je već skeniran',
            'scanned_at', v_ticket.scanned_at,
            'scanned_by', v_ticket.scanned_by
        );
    END IF;

    -- 4. Status nije aktivan
    IF v_ticket.status != 'active' THEN
        INSERT INTO ticket_scans (
            ticket_id, occurrence_id, scanned_by,
            qr_token, result, ticket_status, metadata
        ) VALUES (
            v_ticket.id, p_occurrence_id, p_scanned_by,
            p_qr_token, 'invalid_status', v_ticket.status, p_metadata
        ) RETURNING id INTO v_scan_id;

        RETURN jsonb_build_object(
            'success', FALSE,
            'result', 'invalid_status',
            'scan_id', v_scan_id,
            'message', format('Ticket ima status: %s', v_ticket.status),
            'current_status', v_ticket.status::TEXT
        );
    END IF;

    -- 5. Uspješan scan!
    UPDATE tickets
    SET    status = 'scanned',
           scanned_at = NOW(),
           scanned_by = p_scanned_by
    WHERE  id = v_ticket.id;

    INSERT INTO ticket_scans (
        ticket_id, occurrence_id, scanned_by,
        qr_token, result, ticket_status, metadata
    ) VALUES (
        v_ticket.id, p_occurrence_id, p_scanned_by,
        p_qr_token, 'success', 'active', p_metadata
    ) RETURNING id INTO v_scan_id;

    RETURN jsonb_build_object(
        'success', TRUE,
        'result', 'success',
        'scan_id', v_scan_id,
        'ticket_id', v_ticket.id,
        'tier_name', (SELECT name FROM event_tiers WHERE id = v_ticket.tier_id),
        'remaining_drinks', v_ticket.remaining_drinks,
        'guest_name', (SELECT full_name FROM profiles WHERE id = v_ticket.user_id),
        'item_identifier', (SELECT identifier FROM venue_items WHERE id = v_ticket.item_id),
        'section_name', (SELECT vs.name FROM venue_sections vs WHERE vs.id = v_ticket.section_id)
    );
END;
$$;


-- ############################################################
-- P15: Ticket ↔ Tier ↔ Section validacija
-- ############################################################
-- Opcija B: tier je pricing razred, korisnik bira sjedalo neovisno.
-- Ali sjedalo MORA pripadati sekciji koju tier pokriva.
-- Bez ovog triggera: Early Bird ticket za VIP sjedalo (krivi pricing).

CREATE OR REPLACE FUNCTION validate_ticket_item_tier_section()
RETURNS TRIGGER
LANGUAGE plpgsql AS $$
DECLARE
    v_item_section_id UUID;
    v_section_in_tier BOOLEAN;
BEGIN
    -- Samo za tickete s item_id (numbered sjedala)
    IF NEW.item_id IS NULL THEN
        RETURN NEW;
    END IF;

    -- Dohvati sekciju sjedala
    SELECT section_id INTO v_item_section_id
    FROM   venue_items WHERE id = NEW.item_id;

    IF v_item_section_id IS NULL THEN
        RAISE EXCEPTION 'Stavka (%) ne postoji u venue_items', NEW.item_id;
    END IF;

    -- Provjeri je li sekcija sjedala u tier_sections za ovaj tier
    SELECT EXISTS(
        SELECT 1 FROM tier_sections
        WHERE  tier_id = NEW.tier_id
          AND  section_id = v_item_section_id
    ) INTO v_section_in_tier;

    IF NOT v_section_in_tier THEN
        RAISE EXCEPTION 'Sjedalo (%) pripada sekciji koja nije pokrivena tierom (%). Tier pokriva sekcije: %',
            NEW.item_id,
            NEW.tier_id,
            (SELECT string_agg(vs.name, ', ')
             FROM tier_sections ts
             JOIN venue_sections vs ON vs.id = ts.section_id
             WHERE ts.tier_id = NEW.tier_id);
    END IF;

    -- Auto-postavi section_id na ticketu iz venue_items
    IF NEW.section_id IS NULL THEN
        NEW.section_id := v_item_section_id;
    END IF;

    RETURN NEW;
END;
$$;

CREATE TRIGGER trg_validate_ticket_item_tier_section
    BEFORE INSERT OR UPDATE OF item_id, tier_id ON tickets
    FOR EACH ROW EXECUTE FUNCTION validate_ticket_item_tier_section();


-- ############################################################
-- P16: redeem_drink() s audit trailom
-- ############################################################
-- Stara verzija nema trag tko je iskoristio piće.
-- Nova verzija logira staff ID, vrijeme i preostalo.

-- Enum za drink redemption
CREATE TYPE drink_result AS ENUM (
    'success', 'no_drinks_left', 'invalid_ticket'
);

CREATE TABLE drink_redemptions (
    id             BIGSERIAL PRIMARY KEY,
    ticket_id      UUID NOT NULL REFERENCES tickets(id),
    redeemed_by    UUID NOT NULL REFERENCES auth.users(id),
    result         drink_result NOT NULL,
    drinks_before  INT,
    drinks_after   INT,
    metadata       JSONB DEFAULT '{}',
    created_at     TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_drink_redemptions_ticket ON drink_redemptions(ticket_id);
CREATE INDEX idx_drink_redemptions_by ON drink_redemptions(redeemed_by);
CREATE INDEX idx_drink_redemptions_time ON drink_redemptions(created_at DESC);

-- Zamijeni staru funkciju
CREATE OR REPLACE FUNCTION redeem_drink(
    p_ticket_id   UUID,
    p_redeemed_by UUID,
    p_metadata    JSONB DEFAULT '{}'
)
RETURNS JSONB
LANGUAGE plpgsql AS $$
DECLARE
    v_remaining_before INT;
    v_remaining_after  INT;
    v_ticket_status    ticket_status;
    v_result           drink_result;
BEGIN
    -- Lock ticket redak
    SELECT remaining_drinks, status
    INTO   v_remaining_before, v_ticket_status
    FROM   tickets
    WHERE  id = p_ticket_id
    FOR UPDATE;

    -- Ticket ne postoji ili status nije skeniran
    IF NOT FOUND OR v_ticket_status != 'scanned' THEN
        INSERT INTO drink_redemptions (
            ticket_id, redeemed_by, result,
            drinks_before, drinks_after, metadata
        ) VALUES (
            p_ticket_id, p_redeemed_by, 'invalid_ticket',
            v_remaining_before, v_remaining_before, p_metadata
        );

        RETURN jsonb_build_object(
            'success', FALSE,
            'reason', 'invalid_ticket',
            'ticket_status', v_ticket_status::TEXT
        );
    END IF;

    -- Nema više pića
    IF v_remaining_before <= 0 THEN
        INSERT INTO drink_redemptions (
            ticket_id, redeemed_by, result,
            drinks_before, drinks_after, metadata
        ) VALUES (
            p_ticket_id, p_redeemed_by, 'no_drinks_left',
            0, 0, p_metadata
        );

        RETURN jsonb_build_object(
            'success', FALSE,
            'reason', 'no_drinks_left',
            'remaining', 0
        );
    END IF;

    -- Uspješan redeem
    UPDATE tickets
    SET    remaining_drinks = remaining_drinks - 1
    WHERE  id = p_ticket_id
    RETURNING remaining_drinks INTO v_remaining_after;

    INSERT INTO drink_redemptions (
        ticket_id, redeemed_by, result,
        drinks_before, drinks_after, metadata
    ) VALUES (
        p_ticket_id, p_redeemed_by, 'success',
        v_remaining_before, v_remaining_after, p_metadata
    );

    RETURN jsonb_build_object(
        'success', TRUE,
        'remaining', v_remaining_after,
        'redeemed', v_remaining_before - v_remaining_after
    );
END;
$$;


-- ############################################################
-- IDX: Nedostajući indeksi
-- ############################################################

-- Tickets: item_id za seat lookup
CREATE INDEX IF NOT EXISTS idx_tickets_item
    ON tickets(item_id) WHERE item_id IS NOT NULL;

-- OIS: composite za seat map renderiranje
CREATE INDEX IF NOT EXISTS idx_ois_occurrence_status
    ON occurrence_item_status(occurrence_id, status);


-- ############################################################
-- RLS: Politike za nove tablice
-- ############################################################

-- ---- TICKET SCANS ----
ALTER TABLE ticket_scans ENABLE ROW LEVEL SECURITY;

-- Org member vidi scanove za svoje evente
CREATE POLICY ts_org_read ON ticket_scans FOR SELECT USING (
    occurrence_id IN (
        SELECT eo.id FROM event_occurrences eo
        JOIN events e ON e.id = eo.event_id
        WHERE e.organizer_org_id IN (
            SELECT org_id FROM organization_members
            WHERE user_id = auth.uid() AND is_active = TRUE
        )
    )
);

-- INSERT samo za org membere (staff skenira)
CREATE POLICY ts_org_insert ON ticket_scans FOR INSERT WITH CHECK (
    occurrence_id IN (
        SELECT eo.id FROM event_occurrences eo
        JOIN events e ON e.id = eo.event_id
        WHERE e.organizer_org_id IN (
            SELECT org_id FROM organization_members
            WHERE user_id = auth.uid() AND is_active = TRUE
        )
    )
);

-- ---- DRINK REDEMPTIONS ----
ALTER TABLE drink_redemptions ENABLE ROW LEVEL SECURITY;

-- Org member vidi redemptione za svoje evente
CREATE POLICY dr_org_read ON drink_redemptions FOR SELECT USING (
    ticket_id IN (
        SELECT t.id FROM tickets t
        JOIN event_occurrences eo ON eo.id = t.occurrence_id
        JOIN events e ON e.id = eo.event_id
        WHERE e.organizer_org_id IN (
            SELECT org_id FROM organization_members
            WHERE user_id = auth.uid() AND is_active = TRUE
        )
    )
);

-- Korisnik vidi svoje drink redemptione
CREATE POLICY dr_own_read ON drink_redemptions FOR SELECT USING (
    ticket_id IN (
        SELECT id FROM tickets WHERE user_id = auth.uid()
    )
);


-- ############################################################
-- UPDATED_AT trigger za nove tablice
-- ############################################################
-- ticket_scans i drink_redemptions nemaju updated_at
-- (append-only audit tablice), pa ne trebaju trigger.


-- ============================================================
-- KRAJ v6.1 PATCH
-- ============================================================
-- Nove tablice: ticket_scans, drink_redemptions
-- Novi triggeri: P1, P4 (fix), P15
-- Popravljene funkcije: P2, P3, P16
-- Novi enum tipovi: scan_result, drink_result
-- Nove RLS politike: 4
-- Novi indeksi: 2
-- Alter constraints: P8 (NOT NULL + CHECK)
-- QR token default: P13
-- ============================================================