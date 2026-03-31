-- ============================================================
-- NOIR — Database Schema v5.0 DELTA
-- Supabase (PostgreSQL) | Ožujak 2026.
-- ============================================================
-- CHANGELOG v4 → v5:
--
--   GRUPA A: Transakcijski sustav (orders/order_items/transactions)
--   GRUPA B: Package restrukturiranje (tier_id, entries, table_section)
--   GRUPA C: Bundle-package podrška (tier_id/package_id na junction)
--   GRUPA D: Svi dodatni popravci (11 problema)
--   GRUPA E: Ažurirani triggeri, viewovi, indeksi
--
-- PRINCIP:
--   orders        = "tko, kad, koliko" (checkout sesija)
--   order_items   = "što" (stavke u narudžbi)
--   transactions  = "novac" (charge, refund, void — čisto financijski)
--   packages      = "recept" (tier + extras koji organizator slaže)
--
-- OGRANIČENJE:
--   Jedna narudžba = jedna organizacija (jer gateway je po org-u).
--   Mix kupnja od 2 organizacije = 2 narudžbe.
--
-- NAPOMENA: Pre-launch MVP — nema produkcijskih podataka za migraciju.
-- ============================================================


-- ############################################################
-- GRUPA A: TRANSAKCIJSKI SUSTAV
-- ############################################################

-- ============================================================
-- A1. NOVI ENUM TIPOVI ZA ORDERS/TRANSACTIONS
-- ============================================================

CREATE TYPE order_status AS ENUM (
    'draft',                -- košarica / 48h table hold
    'pending_payment',      -- poslano na gateway
    'completed',            -- plaćanje uspješno
    'failed',               -- plaćanje neuspješno
    'expired',              -- checkout/hold istekao
    'partially_refunded',   -- barem jedna stavka refundirana
    'refunded',             -- sve refundirano
    'cancelled',            -- poništeno prije plaćanja
    'disputed'              -- gateway dispute
);

-- Tip stavke — proširiv s ALTER TYPE ADD VALUE
CREATE TYPE order_item_type AS ENUM (
    'ticket',               -- standalone karta
    'bundle',               -- multi-day paket
    'table_reservation'     -- standalone rezervacija stola
    -- Budući: 'merch', 'drink_package', 'parking', 'vip_upgrade'
);

CREATE TYPE order_item_status AS ENUM (
    'pending',              -- čeka plaćanje
    'active',               -- plaćeno
    'refunded',             -- povrat izvršen
    'cancelled',            -- otkazano
    'fulfilled'             -- iskorišteno (skenirano/preuzeto)
);

-- Tip financijske transakcije
CREATE TYPE transaction_type AS ENUM (
    'charge',               -- korisnik → organizacija
    'refund',               -- organizacija → korisnik
    'void',                 -- poništenje prije settlementa
    'dispute',              -- chargeback
    'dispute_reversal'      -- chargeback riješen za organizaciju
);

-- Čisti status za pojedinačni financijski pokret
CREATE TYPE transaction_status_v2 AS ENUM (
    'pending',
    'completed',
    'failed'
);


-- ============================================================
-- A2. ORDERS — Grupira jedan checkout / 48h table hold
-- ============================================================

CREATE TABLE orders (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    -- Tko kupuje (NOT NULL za stol hold; NULL moguć za ghost checkout)
    user_id             UUID REFERENCES auth.users(id),
    purchase_email      VARCHAR(255),

    -- Kome ide novac
    org_id              UUID NOT NULL REFERENCES organizations(id),

    -- Human-readable (NOIR-20260325-A7X2)
    order_number        VARCHAR(50) UNIQUE NOT NULL,

    -- Financije
    subtotal            DECIMAL(10,2) NOT NULL DEFAULT 0,
    platform_fee        DECIMAL(10,2) DEFAULT 0,
    total_amount        DECIMAL(10,2) NOT NULL DEFAULT 0,
    currency            VARCHAR(3) NOT NULL DEFAULT 'EUR'
                        REFERENCES supported_currencies(code),

    -- Gateway (gateway-agnostic)
    gateway_id          UUID REFERENCES payment_gateways(id),
    gateway_session_id  VARCHAR(255),

    -- Status
    status              order_status NOT NULL DEFAULT 'draft',

    -- Kontekst
    metadata            JSONB DEFAULT '{}',
    ip_address          INET,
    notes               TEXT,

    -- Timestamps
    completed_at        TIMESTAMPTZ,
    cancelled_at        TIMESTAMPTZ,
    expires_at          TIMESTAMPTZ,
    created_at          TIMESTAMPTZ DEFAULT NOW(),
    updated_at          TIMESTAMPTZ DEFAULT NOW()
);

-- Komentar: subtotal = SUM(order_items.subtotal)
-- total_amount = subtotal + platform_fee


-- ============================================================
-- A3. ORDER ITEMS — Što je kupljeno
-- ============================================================

CREATE TABLE order_items (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    order_id        UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,

    -- Polimorfna referenca (tip + UUID)
    item_type       order_item_type NOT NULL,
    item_id         UUID NOT NULL,

    -- Denormalizirani opis (račun ostaje isti čak i kad se event preimenuje)
    description     VARCHAR(500),

    -- Cijena
    unit_price      DECIMAL(10,2) NOT NULL,
    quantity        INT NOT NULL DEFAULT 1,
    subtotal        DECIMAL(10,2) NOT NULL,
    currency        VARCHAR(3) NOT NULL DEFAULT 'EUR'
                    REFERENCES supported_currencies(code),

    -- Status stavke
    status          order_item_status NOT NULL DEFAULT 'pending',

    -- Refund tracking
    refunded_amount DECIMAL(10,2) DEFAULT 0,

    -- Kontekst
    metadata        JSONB DEFAULT '{}',

    created_at      TIMESTAMPTZ DEFAULT NOW(),
    updated_at      TIMESTAMPTZ DEFAULT NOW(),

    CONSTRAINT chk_oi_subtotal CHECK (subtotal = unit_price * quantity),
    CONSTRAINT chk_oi_refund_cap CHECK (refunded_amount <= subtotal),
    CONSTRAINT chk_oi_quantity_positive CHECK (quantity > 0)
);


-- ============================================================
-- A4. TRANSACTIONS V2 — Čisti financijski zapis
-- ============================================================

CREATE TABLE transactions_v2 (
    id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    order_id                UUID NOT NULL REFERENCES orders(id),

    -- Tip i lanac
    transaction_type        transaction_type NOT NULL,
    parent_transaction_id   UUID REFERENCES transactions_v2(id),

    -- Gateway
    gateway_id              UUID REFERENCES payment_gateways(id),
    gateway_payment_id      VARCHAR(255),

    -- Financije
    amount                  DECIMAL(10,2) NOT NULL,
    currency                VARCHAR(3) NOT NULL DEFAULT 'EUR'
                            REFERENCES supported_currencies(code),
    platform_fee            DECIMAL(10,2) DEFAULT 0,

    -- Status
    status                  transaction_status_v2 NOT NULL DEFAULT 'pending',

    -- Kontekst
    metadata                JSONB DEFAULT '{}',
    refunded_items          JSONB,
    -- Format: [{"order_item_id": "uuid", "amount": 15.00}, ...]

    created_at              TIMESTAMPTZ DEFAULT NOW(),
    updated_at              TIMESTAMPTZ DEFAULT NOW(),

    -- Charge/dispute: NEMA parent. Refund/void/reversal: MORA imati parent.
    CONSTRAINT chk_txn_parent_required CHECK (
        (transaction_type IN ('charge', 'dispute') AND parent_transaction_id IS NULL)
        OR
        (transaction_type IN ('refund', 'void', 'dispute_reversal') AND parent_transaction_id IS NOT NULL)
    ),
    CONSTRAINT chk_txn_amount_positive CHECK (amount > 0)
);


-- ============================================================
-- A5. ORDER HELPER FUNKCIJE I TRIGGERI
-- ============================================================

-- Generiranje order_number: NOIR-YYYYMMDD-XXXX
CREATE OR REPLACE FUNCTION generate_order_number()
RETURNS TRIGGER AS $$
DECLARE
    v_date_part TEXT;
    v_random_part TEXT;
    v_order_number TEXT;
    v_attempts INT := 0;
BEGIN
    IF NEW.order_number IS NOT NULL AND NEW.order_number != '' THEN
        RETURN NEW;
    END IF;

    v_date_part := TO_CHAR(NOW(), 'YYYYMMDD');
    LOOP
        v_random_part := UPPER(SUBSTRING(
            REPLACE(gen_random_uuid()::TEXT, '-', '') FROM 1 FOR 4
        ));
        v_order_number := 'NOIR-' || v_date_part || '-' || v_random_part;

        IF NOT EXISTS (SELECT 1 FROM orders WHERE order_number = v_order_number) THEN
            NEW.order_number := v_order_number;
            RETURN NEW;
        END IF;

        v_attempts := v_attempts + 1;
        IF v_attempts > 10 THEN
            -- Fallback: duži random segment
            NEW.order_number := 'NOIR-' || v_date_part || '-' ||
                UPPER(SUBSTRING(REPLACE(gen_random_uuid()::TEXT, '-', '') FROM 1 FOR 8));
            RETURN NEW;
        END IF;
    END LOOP;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_generate_order_number
    BEFORE INSERT ON orders
    FOR EACH ROW
    EXECUTE FUNCTION generate_order_number();


-- Validacija polimorfne reference na order_items
CREATE OR REPLACE FUNCTION validate_order_item_reference()
RETURNS TRIGGER AS $$
DECLARE
    v_exists BOOLEAN;
BEGIN
    CASE NEW.item_type
        WHEN 'ticket' THEN
            SELECT EXISTS(SELECT 1 FROM tickets WHERE id = NEW.item_id) INTO v_exists;
        WHEN 'bundle' THEN
            SELECT EXISTS(SELECT 1 FROM ticket_bundles WHERE id = NEW.item_id) INTO v_exists;
        WHEN 'table_reservation' THEN
            SELECT EXISTS(SELECT 1 FROM table_reservations WHERE id = NEW.item_id) INTO v_exists;
        ELSE
            v_exists := TRUE; -- Budući tipovi
    END CASE;

    IF NOT v_exists THEN
        RAISE EXCEPTION 'order_item: % s id=% ne postoji', NEW.item_type, NEW.item_id;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_validate_order_item_ref
    BEFORE INSERT OR UPDATE OF item_type, item_id ON order_items
    FOR EACH ROW
    EXECUTE FUNCTION validate_order_item_reference();


-- Auto-sync order totala kad se stavke mijenjaju
CREATE OR REPLACE FUNCTION sync_order_totals()
RETURNS TRIGGER AS $$
DECLARE
    v_order_id UUID;
    v_subtotal DECIMAL(10,2);
BEGIN
    v_order_id := COALESCE(NEW.order_id, OLD.order_id);

    SELECT COALESCE(SUM(subtotal), 0)
    INTO   v_subtotal
    FROM   order_items
    WHERE  order_id = v_order_id AND status != 'cancelled';

    UPDATE orders
    SET    subtotal = v_subtotal,
           total_amount = v_subtotal + COALESCE(platform_fee, 0),
           updated_at = NOW()
    WHERE  id = v_order_id;

    RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_sync_order_totals
    AFTER INSERT OR UPDATE OF subtotal, status OR DELETE ON order_items
    FOR EACH ROW
    EXECUTE FUNCTION sync_order_totals();


-- Auto-sync order statusa pri completed refundu
CREATE OR REPLACE FUNCTION sync_order_refund_status()
RETURNS TRIGGER AS $$
DECLARE
    v_total_charged   DECIMAL(10,2);
    v_total_refunded  DECIMAL(10,2);
BEGIN
    IF NEW.transaction_type != 'refund' OR NEW.status != 'completed' THEN
        RETURN NEW;
    END IF;

    SELECT COALESCE(SUM(amount), 0) INTO v_total_charged
    FROM   transactions_v2
    WHERE  order_id = NEW.order_id
           AND transaction_type = 'charge' AND status = 'completed';

    SELECT COALESCE(SUM(amount), 0) INTO v_total_refunded
    FROM   transactions_v2
    WHERE  order_id = NEW.order_id
           AND transaction_type = 'refund' AND status = 'completed';

    IF v_total_refunded >= v_total_charged THEN
        UPDATE orders SET status = 'refunded', updated_at = NOW()
        WHERE id = NEW.order_id AND status != 'refunded';
    ELSIF v_total_refunded > 0 THEN
        UPDATE orders SET status = 'partially_refunded', updated_at = NOW()
        WHERE id = NEW.order_id AND status NOT IN ('refunded', 'partially_refunded');
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_sync_order_refund_status
    AFTER INSERT OR UPDATE OF status ON transactions_v2
    FOR EACH ROW
    EXECUTE FUNCTION sync_order_refund_status();


-- Expire pending orders (30 min checkout / 48h table hold)
CREATE OR REPLACE FUNCTION expire_pending_orders()
RETURNS VOID AS $$
DECLARE
    v_order RECORD;
BEGIN
    FOR v_order IN
        SELECT id FROM orders
        WHERE  status IN ('draft', 'pending_payment')
               AND (
                   (expires_at IS NOT NULL AND expires_at < NOW())
                   OR
                   (expires_at IS NULL AND created_at < NOW() - INTERVAL '30 minutes')
               )
        FOR UPDATE SKIP LOCKED
    LOOP
        UPDATE orders SET status = 'expired', updated_at = NOW()
        WHERE id = v_order.id;

        UPDATE order_items SET status = 'cancelled', updated_at = NOW()
        WHERE order_id = v_order.id AND status = 'pending';

        -- Expire tickete
        UPDATE tickets SET status = 'expired', updated_at = NOW()
        WHERE id IN (
            SELECT item_id FROM order_items
            WHERE order_id = v_order.id AND item_type = 'ticket'
        ) AND status IN ('reserved', 'pending_payment');

        -- Expire bundleove
        UPDATE ticket_bundles SET status = 'cancelled', updated_at = NOW()
        WHERE id IN (
            SELECT item_id FROM order_items
            WHERE order_id = v_order.id AND item_type = 'bundle'
        ) AND status = 'pending_payment';

        -- Expire table_reservations
        UPDATE table_reservations
        SET    status = 'expired', cancelled_at = NOW(), updated_at = NOW()
        WHERE  id IN (
            SELECT item_id FROM order_items
            WHERE order_id = v_order.id AND item_type = 'table_reservation'
        ) AND status IN ('pending', 'confirmed');
    END LOOP;
END;
$$ LANGUAGE plpgsql;


-- ############################################################
-- GRUPA B: PACKAGE RESTRUKTURIRANJE
-- ############################################################

-- ============================================================
-- B1. NOVE KOLONE NA occurrence_packages
-- ============================================================
-- Paket = Tier + Extras. Organizator slaže "recept":
--   VIP Paket: tier=VIP, entries=1, drinks=3, table_section=VIP Lounge
--   Party Paket: tier=Regular, entries=2, drinks=5, table_section=NULL
--   Drink paket za stol: tier=NULL, entries=0, drinks=bottle, table_section=VIP Lounge

-- Koji tier ulaznica se kreira za ovaj paket (NULL = paket bez ulaza)
ALTER TABLE occurrence_packages
    ADD COLUMN tier_id UUID REFERENCES event_tiers(id);

-- Koliko ulaznica dolazi s ovim paketom (0 = samo piće/extras)
ALTER TABLE occurrence_packages
    ADD COLUMN entries_included INT NOT NULL DEFAULT 1;

ALTER TABLE occurrence_packages
    ADD CONSTRAINT chk_pkg_entries_non_negative
    CHECK (entries_included >= 0);

-- Ako entries_included > 0, tier_id MORA biti postavljen
ALTER TABLE occurrence_packages
    ADD CONSTRAINT chk_pkg_tier_required_for_entries
    CHECK (entries_included = 0 OR tier_id IS NOT NULL);

-- Za koji dio prostora je ovaj paket vezan (NULL = nije table paket)
ALTER TABLE occurrence_packages
    ADD COLUMN table_section_id UUID REFERENCES venue_sections(id);

-- Zamjena starih boolean/int kolona:
-- includes_entry BOOLEAN → entries_included INT (već dodano)
-- includes_drinks INT → PREIMENOVANO u drinks_included
-- includes_table BOOLEAN → table_section_id IS NOT NULL

-- Migracija starih podataka (ako postoje):
/*
UPDATE occurrence_packages
SET    entries_included = CASE WHEN includes_entry THEN 1 ELSE 0 END;

-- includes_drinks ostaje jer se koristi isti INT tip, samo rename:
ALTER TABLE occurrence_packages RENAME COLUMN includes_drinks TO drinks_included;

-- includes_table i includes_entry se mogu dropati nakon migracije:
ALTER TABLE occurrence_packages DROP COLUMN includes_entry;
ALTER TABLE occurrence_packages DROP COLUMN includes_table;
*/

-- NAPOMENA: Za MVP, ostaviti stare kolone i dodati nove paralelno.
-- App koristi nove kolone, stare se ignoriraju.
-- Čišćenje starih kolona ide u v6 kad se potvrdi da sve radi.


-- ============================================================
-- B2. TRIGGER: Validacija package-tier occurrence konzistencije
-- ============================================================
-- tier_id na paketu MORA pripadati istom occurrence_id-u

CREATE OR REPLACE FUNCTION validate_package_tier_consistency()
RETURNS TRIGGER AS $$
DECLARE
    v_tier_occurrence_id UUID;
BEGIN
    IF NEW.tier_id IS NULL THEN
        RETURN NEW;
    END IF;

    SELECT occurrence_id INTO v_tier_occurrence_id
    FROM   event_tiers WHERE id = NEW.tier_id;

    IF v_tier_occurrence_id != NEW.occurrence_id THEN
        RAISE EXCEPTION 'Package tier (%) pripada drugoj izvedbi (%), a paket pripada izvedbi (%)',
            NEW.tier_id, v_tier_occurrence_id, NEW.occurrence_id;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_validate_package_tier
    BEFORE INSERT OR UPDATE OF tier_id ON occurrence_packages
    FOR EACH ROW
    EXECUTE FUNCTION validate_package_tier_consistency();


-- ============================================================
-- B3. TRIGGER: Validacija package table_section pripada venueu
-- ============================================================

CREATE OR REPLACE FUNCTION validate_package_section_venue()
RETURNS TRIGGER AS $$
DECLARE
    v_venue_id UUID;
    v_section_venue_id UUID;
BEGIN
    IF NEW.table_section_id IS NULL THEN
        RETURN NEW;
    END IF;

    -- Venue iz occurrence
    SELECT venue_id INTO v_venue_id
    FROM   event_occurrences WHERE id = NEW.occurrence_id;

    -- Venue iz sekcije
    SELECT venue_id INTO v_section_venue_id
    FROM   venue_sections WHERE id = NEW.table_section_id;

    IF v_venue_id != v_section_venue_id THEN
        RAISE EXCEPTION 'Package section (%) ne pripada venueu izvedbe (%)',
            NEW.table_section_id, v_venue_id;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_validate_package_section
    BEFORE INSERT OR UPDATE OF table_section_id ON occurrence_packages
    FOR EACH ROW
    EXECUTE FUNCTION validate_package_section_venue();


-- ############################################################
-- GRUPA C: BUNDLE-PACKAGE PODRŠKA
-- ############################################################

-- ============================================================
-- C1. NOVE KOLONE NA bundle_type_occurrences
-- ============================================================
-- Za svaku izvedbu u bundleu: koji tier i koji paket (opcijski)

ALTER TABLE bundle_type_occurrences
    ADD COLUMN tier_id UUID REFERENCES event_tiers(id);

-- Opcijski paket za ovu izvedbu u bundleu
ALTER TABLE bundle_type_occurrences
    ADD COLUMN package_id UUID REFERENCES occurrence_packages(id);

-- tier_id JE obavezan za bundle (svaka izvedba ima ulaznicu)
-- ALI: dodajemo NOT NULL naknadno nakon migracije starih podataka
-- Za nove zapise, app MORA slati tier_id

-- Trigger: tier mora pripadati toj izvedbi
CREATE OR REPLACE FUNCTION validate_bto_tier_occurrence()
RETURNS TRIGGER AS $$
DECLARE
    v_tier_occ UUID;
    v_pkg_occ UUID;
BEGIN
    -- Provjeri tier
    IF NEW.tier_id IS NOT NULL THEN
        SELECT occurrence_id INTO v_tier_occ
        FROM event_tiers WHERE id = NEW.tier_id;

        IF v_tier_occ != NEW.occurrence_id THEN
            RAISE EXCEPTION 'Bundle tier (%) ne pripada izvedbi (%)',
                NEW.tier_id, NEW.occurrence_id;
        END IF;
    END IF;

    -- Provjeri package
    IF NEW.package_id IS NOT NULL THEN
        SELECT occurrence_id INTO v_pkg_occ
        FROM occurrence_packages WHERE id = NEW.package_id;

        IF v_pkg_occ != NEW.occurrence_id THEN
            RAISE EXCEPTION 'Bundle package (%) ne pripada izvedbi (%)',
                NEW.package_id, NEW.occurrence_id;
        END IF;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_validate_bto_references
    BEFORE INSERT OR UPDATE OF tier_id, package_id ON bundle_type_occurrences
    FOR EACH ROW
    EXECUTE FUNCTION validate_bto_tier_occurrence();


-- ############################################################
-- GRUPA D: DODATNI POPRAVCI (11 PROBLEMA)
-- ############################################################

-- ============================================================
-- D1. occurrence sold_count CHECK constraint
-- ============================================================

ALTER TABLE event_occurrences
    ADD CONSTRAINT chk_occurrence_not_oversold
    CHECK (total_capacity IS NULL OR sold_count <= total_capacity);

ALTER TABLE event_occurrences
    ADD CONSTRAINT chk_occurrence_sold_non_negative
    CHECK (sold_count >= 0);


-- ============================================================
-- D2. Generički updated_at auto-trigger
-- ============================================================

CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Primijeni na SVE tablice s updated_at
DO $$
DECLARE
    t TEXT;
    tables TEXT[] := ARRAY[
        'profiles', 'user_preferences', 'organizations',
        'payment_gateways', 'venues', 'events',
        'venue_inquiries', 'event_occurrences',
        'event_tiers', 'occurrence_packages',
        'ticket_bundles', 'tickets',
        'occurrence_item_status', 'table_reservations',
        'payment_orders',
        -- Nove tablice iz v5:
        'orders', 'order_items', 'transactions_v2',
        -- Tablice koje dobivaju updated_at u D5/D6:
        'venue_rental_terms', 'tags', 'bundle_types'
    ];
BEGIN
    FOREACH t IN ARRAY tables LOOP
        EXECUTE format(
            'CREATE TRIGGER trg_set_updated_at
                BEFORE UPDATE ON %I
                FOR EACH ROW
                EXECUTE FUNCTION set_updated_at()',
            t
        );
    END LOOP;
END;
$$;


-- ============================================================
-- D3. payment_gateways — samo jedan default po organizaciji
-- ============================================================

CREATE UNIQUE INDEX idx_one_default_gateway_per_org
    ON payment_gateways(org_id)
    WHERE is_default = TRUE AND is_active = TRUE;


-- ============================================================
-- D4. remaining_drinks CHECK + atomična funkcija
-- ============================================================

ALTER TABLE tickets
    ADD CONSTRAINT chk_drinks_non_negative
    CHECK (remaining_drinks >= 0);

CREATE OR REPLACE FUNCTION redeem_drink(p_ticket_id UUID)
RETURNS JSONB AS $$
DECLARE
    v_remaining INT;
BEGIN
    UPDATE tickets
    SET    remaining_drinks = remaining_drinks - 1
    WHERE  id = p_ticket_id
           AND remaining_drinks > 0
           AND status = 'scanned'
    RETURNING remaining_drinks INTO v_remaining;

    IF NOT FOUND THEN
        RETURN jsonb_build_object(
            'success', FALSE,
            'reason', 'no_drinks_remaining_or_invalid_ticket'
        );
    END IF;

    RETURN jsonb_build_object('success', TRUE, 'remaining', v_remaining);
END;
$$ LANGUAGE plpgsql;


-- ============================================================
-- D5. Nedostajuće kolone: updated_at na tablicama bez nje
-- ============================================================

ALTER TABLE venue_rental_terms
    ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

ALTER TABLE tags
    ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW(),
    ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

ALTER TABLE bundle_types
    ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

ALTER TABLE organization_members
    ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();


-- ============================================================
-- D6. Bundle double-counting — POTVRĐENO: NE PROBLEM
-- ============================================================
-- Tier sold_count = mjera kapaciteta (koliko mjesta je zauzeto)
-- Package/Bundle sold_count = mjera prodaje (koliko proizvoda prodano)
-- Isti ticket broji se na tieru (kapacitet) I na bundleu (prodaja).
-- Ovo je NAMJERNO i ISPRAVNO.
-- Organizator mora planirati tier kapacitet uzimajući u obzir bundle prodaju.
-- Dokumentirano kao POTVRĐENA ODLUKA, ne problem.


-- ============================================================
-- D7. venue_inquiry_dates.end_time NOT NULL inconsistency
-- ============================================================
-- Dokumentirano. Occurrence end_time ostaje NULL-able jer:
-- 1) build_occurrence_tstzrange() već ima fallback (+6h)
-- 2) Postoje open-end eventi (afterparty bez definiranog kraja)
-- Ovo NIJE bug, to je feature. Ne mijenjamo.


-- ############################################################
-- GRUPA E: AŽURIRANI TRIGGERI, VIEWOVI, INDEKSI
-- ############################################################

-- ============================================================
-- E1. AŽURIRAN T7: handle_occurrence_cancellation — refund kroz orders
-- ============================================================
-- Zamjenjuje stari INSERT INTO transactions s novim modelom.
-- Ostatak logike (cancel tickets, unavailable items, cancel reservations) nepromijenjen.

CREATE OR REPLACE FUNCTION handle_occurrence_cancellation()
RETURNS TRIGGER AS $$
DECLARE
    v_bundle          RECORD;
    v_total_occurrences INT;
    v_refund_per_occurrence DECIMAL(10,2);
    v_active_occurrence_count INT;
    v_used_ticket_count INT;
    v_order_id        UUID;
    v_order_item_id   UUID;
    v_charge_txn_id   UUID;
    v_currency        VARCHAR(3);
BEGIN
    IF NEW.status != 'cancelled' OR OLD.status = 'cancelled' THEN
        RETURN NEW;
    END IF;

    -- v4 fix: redoslijed operacija
    -- 1. Unavailable sve stavke
    UPDATE occurrence_item_status
    SET    status = 'unavailable'
    WHERE  occurrence_id = NEW.id;

    -- 2. Cancel sve rezervacije
    UPDATE table_reservations
    SET    status = 'cancelled', cancelled_at = NOW()
    WHERE  occurrence_id = NEW.id
           AND status IN ('pending', 'confirmed');

    -- 3. Cancel sve tickete
    UPDATE tickets
    SET    status = 'cancelled', cancelled_at = NOW()
    WHERE  occurrence_id = NEW.id
           AND status IN ('active', 'reserved', 'pending_payment');

    -- 4. Bundle refund logika
    FOR v_bundle IN
        SELECT DISTINCT tb.id AS bundle_id,
               tb.total_price,
               tb.bundle_type_id,
               tb.user_id,
               tb.refunded_amount AS current_refunded,
               tb.original_occurrence_count
        FROM   ticket_bundles tb
        JOIN   tickets t ON t.bundle_id = tb.id
        WHERE  t.occurrence_id = NEW.id
               AND tb.status IN ('active', 'partially_used', 'partially_refunded')
    LOOP
        v_total_occurrences := v_bundle.original_occurrence_count;

        IF v_total_occurrences IS NULL OR v_total_occurrences = 0 THEN
            SELECT COUNT(*) INTO v_total_occurrences
            FROM   bundle_type_occurrences
            WHERE  bundle_type_id = v_bundle.bundle_type_id;
        END IF;

        IF v_total_occurrences > 0 THEN
            v_refund_per_occurrence := LEAST(
                v_bundle.total_price / v_total_occurrences,
                v_bundle.total_price - COALESCE(v_bundle.current_refunded, 0)
            );

            -- Ažuriraj bundle
            UPDATE ticket_bundles
            SET    refunded_amount = COALESCE(refunded_amount, 0) + v_refund_per_occurrence,
                   status = 'partially_refunded'
            WHERE  id = v_bundle.bundle_id;

            -- Pronađi order za ovaj bundle
            SELECT oi.order_id, oi.id, o.currency
            INTO   v_order_id, v_order_item_id, v_currency
            FROM   order_items oi
            JOIN   orders o ON o.id = oi.order_id
            WHERE  oi.item_type = 'bundle' AND oi.item_id = v_bundle.bundle_id
            LIMIT 1;

            IF v_order_id IS NOT NULL THEN
                -- Pronađi originalni charge
                SELECT id INTO v_charge_txn_id
                FROM   transactions_v2
                WHERE  order_id = v_order_id
                       AND transaction_type = 'charge' AND status = 'completed'
                ORDER BY created_at ASC LIMIT 1;

                -- Kreiraj refund transakciju
                INSERT INTO transactions_v2 (
                    order_id, transaction_type, parent_transaction_id,
                    amount, currency, status, metadata, refunded_items
                ) VALUES (
                    v_order_id, 'refund', v_charge_txn_id,
                    v_refund_per_occurrence,
                    COALESCE(v_currency, 'EUR'),
                    'completed',
                    jsonb_build_object(
                        'reason', 'occurrence_cancelled',
                        'cancelled_occurrence_id', NEW.id,
                        'trigger', 'handle_occurrence_cancellation',
                        'calculation', jsonb_build_object(
                            'total_price', v_bundle.total_price,
                            'total_occurrences', v_total_occurrences,
                            'refund_per_occurrence', v_refund_per_occurrence
                        )
                    ),
                    jsonb_build_array(jsonb_build_object(
                        'order_item_id', v_order_item_id,
                        'amount', v_refund_per_occurrence
                    ))
                );

                -- Ažuriraj order_item refund
                UPDATE order_items
                SET    refunded_amount = COALESCE(refunded_amount, 0) + v_refund_per_occurrence,
                       status = CASE
                           WHEN COALESCE(refunded_amount, 0) + v_refund_per_occurrence >= subtotal
                           THEN 'refunded'::order_item_status
                           ELSE status
                       END
                WHERE  id = v_order_item_id;
            END IF;

            -- v4: Full refund detekcija
            SELECT COUNT(*) INTO v_active_occurrence_count
            FROM   bundle_type_occurrences bto
            JOIN   event_occurrences eo ON eo.id = bto.occurrence_id
            WHERE  bto.bundle_type_id = v_bundle.bundle_type_id
                   AND eo.status NOT IN ('cancelled', 'completed');

            IF v_active_occurrence_count = 0 THEN
                SELECT COUNT(*) INTO v_used_ticket_count
                FROM tickets WHERE bundle_id = v_bundle.bundle_id AND status = 'scanned';

                IF v_used_ticket_count = 0 THEN
                    UPDATE ticket_bundles
                    SET    status = 'refunded', refunded_amount = total_price
                    WHERE  id = v_bundle.bundle_id;
                END IF;
            END IF;
        END IF;
    END LOOP;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger ostaje isti:
-- AFTER UPDATE OF status ON event_occurrences


-- ============================================================
-- E2. VIEWOVI (ažurirani za novi model)
-- ============================================================

-- user_tickets_view — s order_number
CREATE OR REPLACE VIEW user_tickets_view AS
SELECT
    t.id                AS ticket_id,
    t.status            AS ticket_status,
    t.qr_token,
    t.purchased_at,
    t.scanned_at,
    t.remaining_drinks,
    t.created_at,
    t.user_id,

    e.name              AS event_name,
    e.cover_image_url,

    eo.occurrence_date,
    eo.start_time,
    eo.end_time,
    v.name              AS venue_name,
    v.city              AS venue_city,

    et.name             AS tier_name,
    et.price            AS tier_price,
    et.currency,

    tb.id               AS bundle_id,
    bt.name             AS bundle_name,
    tb.status           AS bundle_status,
    tb.total_price      AS bundle_price,

    op.name             AS package_name,
    op.price            AS package_price,

    vi.identifier       AS item_identifier,
    vs.name             AS section_name,

    o.order_number,
    o.id                AS order_id,

    CASE
        WHEN t.bundle_id IS NOT NULL THEN 'bundle'
        WHEN t.package_id IS NOT NULL THEN 'package'
        ELSE 'standalone'
    END AS purchase_type

FROM   tickets t
JOIN   event_occurrences eo ON eo.id = t.occurrence_id
JOIN   events e ON e.id = eo.event_id
JOIN   venues v ON v.id = eo.venue_id
JOIN   event_tiers et ON et.id = t.tier_id
LEFT JOIN ticket_bundles tb ON tb.id = t.bundle_id
LEFT JOIN bundle_types bt ON bt.id = tb.bundle_type_id
LEFT JOIN occurrence_packages op ON op.id = t.package_id
LEFT JOIN venue_items vi ON vi.id = t.item_id
LEFT JOIN venue_sections vs ON vs.id = t.section_id
LEFT JOIN order_items oi ON oi.item_id = t.id AND oi.item_type = 'ticket'
LEFT JOIN orders o ON o.id = oi.order_id;


-- user_transactions_view — order-centric
CREATE OR REPLACE VIEW user_transactions_view AS
SELECT
    txn.id              AS transaction_id,
    txn.transaction_type,
    txn.amount,
    txn.currency,
    txn.status          AS transaction_status,
    txn.created_at      AS transaction_date,
    txn.gateway_payment_id,
    txn.parent_transaction_id,
    txn.metadata        AS transaction_metadata,

    o.id                AS order_id,
    o.order_number,
    o.user_id,
    o.org_id,
    o.total_amount      AS order_total,
    o.status            AS order_status,
    o.completed_at,

    pg.gateway_type,
    pg.display_name     AS gateway_name,

    org.name            AS organization_name,

    (SELECT jsonb_agg(jsonb_build_object(
        'item_type', oi.item_type,
        'description', oi.description,
        'quantity', oi.quantity,
        'subtotal', oi.subtotal,
        'status', oi.status,
        'refunded_amount', oi.refunded_amount
    )) FROM order_items oi WHERE oi.order_id = o.id) AS items

FROM   transactions_v2 txn
JOIN   orders o ON o.id = txn.order_id
LEFT JOIN payment_gateways pg ON pg.id = txn.gateway_id
LEFT JOIN organizations org ON org.id = o.org_id;


-- org_revenue_view — analitika za organizatora
CREATE OR REPLACE VIEW org_revenue_view AS
SELECT
    o.org_id,
    o.id                AS order_id,
    o.order_number,
    o.user_id           AS customer_id,
    o.total_amount,
    o.currency,
    o.status            AS order_status,
    o.completed_at,

    (SELECT COALESCE(SUM(amount), 0) FROM transactions_v2
     WHERE order_id = o.id AND transaction_type = 'charge' AND status = 'completed'
    ) AS total_charged,

    (SELECT COALESCE(SUM(amount), 0) FROM transactions_v2
     WHERE order_id = o.id AND transaction_type = 'refund' AND status = 'completed'
    ) AS total_refunded,

    (SELECT COUNT(*) FROM order_items WHERE order_id = o.id) AS item_count,

    pg.gateway_type,
    pg.display_name     AS gateway_name

FROM   orders o
LEFT JOIN payment_gateways pg ON pg.id = o.gateway_id;


-- ============================================================
-- E3. INDEKSI
-- ============================================================

-- Orders
CREATE INDEX idx_orders_user            ON orders(user_id);
CREATE INDEX idx_orders_org             ON orders(org_id);
CREATE INDEX idx_orders_status          ON orders(status);
CREATE INDEX idx_orders_created         ON orders(created_at DESC);
CREATE INDEX idx_orders_gateway_session ON orders(gateway_session_id)
    WHERE gateway_session_id IS NOT NULL;
CREATE INDEX idx_orders_pending_expiry  ON orders(expires_at)
    WHERE status IN ('draft', 'pending_payment');

-- Order items
CREATE INDEX idx_oi_order              ON order_items(order_id);
CREATE INDEX idx_oi_item               ON order_items(item_type, item_id);

-- Transactions v2
CREATE INDEX idx_txn2_order            ON transactions_v2(order_id);
CREATE INDEX idx_txn2_parent           ON transactions_v2(parent_transaction_id)
    WHERE parent_transaction_id IS NOT NULL;
CREATE INDEX idx_txn2_gateway          ON transactions_v2(gateway_payment_id)
    WHERE gateway_payment_id IS NOT NULL;
CREATE INDEX idx_txn2_type_status      ON transactions_v2(transaction_type, status);

-- Package novi indeksi
CREATE INDEX idx_pkg_tier              ON occurrence_packages(tier_id)
    WHERE tier_id IS NOT NULL;
CREATE INDEX idx_pkg_section           ON occurrence_packages(table_section_id)
    WHERE table_section_id IS NOT NULL;

-- Bundle occurrences novi indeksi
CREATE INDEX idx_bto_tier              ON bundle_type_occurrences(tier_id)
    WHERE tier_id IS NOT NULL;
CREATE INDEX idx_bto_package           ON bundle_type_occurrences(package_id)
    WHERE package_id IS NOT NULL;


-- ============================================================
-- E4. RLS POLICIES
-- ============================================================

ALTER TABLE orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE order_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE transactions_v2 ENABLE ROW LEVEL SECURITY;

-- Korisnik vidi vlastite narudžbe
CREATE POLICY orders_user_select ON orders
    FOR SELECT USING (auth.uid() = user_id);

-- Org member vidi narudžbe organizacije
CREATE POLICY orders_org_select ON orders
    FOR SELECT USING (
        org_id IN (
            SELECT om.org_id FROM organization_members om
            WHERE om.user_id = auth.uid()
        )
    );

CREATE POLICY oi_user_select ON order_items
    FOR SELECT USING (
        order_id IN (SELECT id FROM orders WHERE user_id = auth.uid())
    );

CREATE POLICY txn2_user_select ON transactions_v2
    FOR SELECT USING (
        order_id IN (SELECT id FROM orders WHERE user_id = auth.uid())
    );


-- ============================================================
-- E5. pg_cron RASPORED (ažuriran)
-- ============================================================

/*
-- Expire pending orders (checkout timeout + table hold) — svake 2 min
SELECT cron.schedule(
    'expire-pending-orders',
    '*/2 * * * *',
    'SELECT expire_pending_orders()'
);

-- Ostali cronovi nepromijenjeni:
-- expire-standalone-reservations: */5 * * * *
-- expire-seat-locks: * * * * *
*/


-- ============================================================
-- E6. STARA TABLICA — rename nakon verifikacije
-- ============================================================

/*
-- POKRENUTI TEK NAKON ŠTO SE POTVRDI DA NOVI MODEL RADI:
ALTER TABLE transactions RENAME TO transactions_legacy;
ALTER TABLE transactions_v2 RENAME TO transactions;
-- Ažurirati sve referencijalne constrainte i indekse
*/