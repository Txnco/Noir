-- ============================================================
-- NOIR — Database Schema v5.0 DELTA
-- Transakcijski sustav — potpuni refaktor
-- Supabase (PostgreSQL) | Ožujak 2026.
-- ============================================================
--
-- CHANGELOG v4 → v5:
--   Uveden orders/order_items/transactions pattern
--   Zamjenjuje direktne ticket_id/bundle_id FK na transactions
--
-- PRINCIP:
--   orders        = "tko, kad, koliko, kako" (checkout sesija)
--   order_items   = "što" (stavke u narudžbi)
--   transactions  = "novac" (charge, refund, void — čisto financijski)
--
-- OGRANIČENJE:
--   Jedna narudžba = jedna organizacija.
--   Ako korisnik kupuje karte za evente različitih organizacija,
--   app layer MORA splitati u zasebne narudžbe (svaka org ima svoj gateway).
--
-- NAPOMENA ZA MIGRACIJU:
--   Ovo je pre-launch MVP — pretpostavljamo da nema produkcijskih podataka.
--   Migration SQL je uključen kao best practice za staging environment.
-- ============================================================


-- ============================================================
-- 1. NOVI ENUM TIPOVI
-- ============================================================

-- Status narudžbe (lifecycle jednog checkouta)
CREATE TYPE order_status AS ENUM (
    'draft',                -- košarica kreirana, stavke dodane
    'pending_payment',      -- poslano na gateway, čeka potvrdu
    'completed',            -- plaćanje uspješno, stavke aktivirane
    'failed',               -- plaćanje neuspješno
    'expired',              -- checkout session istekao
    'partially_refunded',   -- barem jedna stavka refundirana
    'refunded',             -- sve stavke refundirane
    'cancelled',            -- narudžba poništena prije plaćanja
    'disputed'              -- gateway dispute otvoren
);

-- Tip stavke u narudžbi — proširiv s ALTER TYPE ADD VALUE
-- Bez migracije, samo jedan DDL statement za novi proizvod
CREATE TYPE order_item_type AS ENUM (
    'ticket',               -- standalone karta
    'bundle',               -- multi-day paket
    'table_reservation'     -- standalone rezervacija stola
    -- Budući: 'merch', 'drink_package', 'parking', 'vip_upgrade'...
);

-- Status pojedinačne stavke
CREATE TYPE order_item_status AS ENUM (
    'pending',              -- čeka plaćanje
    'active',               -- plaćeno, aktivno
    'refunded',             -- povrat izvršen
    'cancelled',            -- otkazano (prije ili nakon plaćanja)
    'fulfilled'             -- iskorišteno (skenirano/preuzeto)
);

-- Tip financijske transakcije — strogo razlučuje smjer novca
CREATE TYPE transaction_type AS ENUM (
    'charge',               -- inicijalno terećenje (korisnik → organizacija)
    'refund',               -- povrat (organizacija → korisnik), parcijalni ili puni
    'void',                 -- poništenje prije settlmenta
    'dispute',              -- chargeback otvoren od strane korisnika
    'dispute_reversal'      -- chargeback riješen u korist organizacije
);

-- NAPOMENA: Stari transaction_status ENUM ostaje, ali s promijenjenim značenjem:
-- 'pending'   = čeka potvrdu od gatewaya
-- 'completed' = uspješno izvršeno
-- 'failed'    = neuspješno
-- Uklonjeni: 'refunded' (sada je zaseban redak s type='refund')
-- Uklonjeni: 'disputed' (sada je zaseban redak s type='dispute')

-- Zamjena starog ENUM-a (ako nije moguć ALTER, kreiramo novi)
-- Supabase dopušta ALTER TYPE ADD VALUE ali ne REMOVE VALUE,
-- pa ćemo stari koristiti samo za charge/refund retke
-- i dodati novi za čistiji model:

CREATE TYPE transaction_status_v2 AS ENUM (
    'pending',      -- čeka potvrdu
    'completed',    -- uspješno
    'failed'        -- neuspješno
);


-- ============================================================
-- 2. ORDERS — Grupira jedan checkout
-- ============================================================
-- Jedna narudžba = jedan PaymentIntent / jedna sesija
-- Jedna narudžba = JEDNA organizacija (gateway je po org-u)
-- Korisnik koji kupuje od 2 organizacije ima 2 narudžbe

CREATE TABLE orders (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    -- Tko kupuje
    user_id             UUID REFERENCES auth.users(id),
    purchase_email      VARCHAR(255),
    -- Za ghost account: user_id može biti NULL dok se ne stvori account

    -- Kome ide novac (organizacija koja posjeduje event)
    org_id              UUID NOT NULL REFERENCES organizations(id),

    -- Human-readable identifikator za support (NOIR-20260325-A7X2)
    order_number        VARCHAR(50) UNIQUE NOT NULL,

    -- Financijski podaci
    subtotal            DECIMAL(10,2) NOT NULL DEFAULT 0,
    platform_fee        DECIMAL(10,2) DEFAULT 0,
    total_amount        DECIMAL(10,2) NOT NULL DEFAULT 0,
    currency            VARCHAR(3) NOT NULL DEFAULT 'EUR'
                        REFERENCES supported_currencies(code),

    -- Gateway info (gateway-agnostic: Stripe, Monri, WSPay, bank...)
    gateway_id          UUID REFERENCES payment_gateways(id),
    gateway_session_id  VARCHAR(255),
    -- Stripe: checkout_session_id / Monri: order_number / WSPay: ShoppingCartID

    -- Status
    status              order_status NOT NULL DEFAULT 'draft',

    -- Kontekstni podaci
    metadata            JSONB DEFAULT '{}',
    -- Primjeri: {"ip": "1.2.3.4", "user_agent": "...", "promo_code": "NOIR20"}

    ip_address          INET,
    notes               TEXT,

    -- Timestamps
    completed_at        TIMESTAMPTZ,
    cancelled_at        TIMESTAMPTZ,
    expires_at          TIMESTAMPTZ,
    -- Checkout session expiry (npr. 30 min od kreiranja)
    created_at          TIMESTAMPTZ DEFAULT NOW(),
    updated_at          TIMESTAMPTZ DEFAULT NOW()
);

-- Komentari:
-- subtotal = suma svih order_items.subtotal
-- platform_fee = NOIR provizija (može biti 0 za MVP)
-- total_amount = subtotal + platform_fee (ovo gateway naplaćuje)


-- ============================================================
-- 3. ORDER ITEMS — Što je kupljeno
-- ============================================================
-- Svaka stavka referencira konkretan entitet putem
-- item_type + item_id (polimorfna referenca).
--
-- NE koristimo FK na item_id jer pokazuje na različite tablice
-- ovisno o item_type. Integritet se čuva app-level validacijom
-- + DB triggerom koji provjerava postojanje.
--
-- Ovo je JEDINO mjesto koje zna "što" je kupljeno.
-- orders i transactions NE znaju za karte/bundleove/stolove.

CREATE TABLE order_items (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    order_id        UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,

    -- Polimorfna referenca — tip + UUID
    item_type       order_item_type NOT NULL,
    item_id         UUID NOT NULL,
    -- item_type='ticket'            → item_id je tickets.id
    -- item_type='bundle'            → item_id je ticket_bundles.id
    -- item_type='table_reservation' → item_id je table_reservations.id

    -- Opis (denormalizirano za history/prikaz)
    description     VARCHAR(500),
    -- Npr: "Early Bird — Petak 28.03. — Boogaloo"
    -- Denormalizirano jer se event/tier naziv može promijeniti,
    -- ali račun ostaje isti.

    -- Cijena
    unit_price      DECIMAL(10,2) NOT NULL,
    quantity        INT NOT NULL DEFAULT 1,
    subtotal        DECIMAL(10,2) NOT NULL,
    currency        VARCHAR(3) NOT NULL DEFAULT 'EUR'
                    REFERENCES supported_currencies(code),

    -- Status stavke (nezavisan od order statusa)
    status          order_item_status NOT NULL DEFAULT 'pending',

    -- Za refund tracking po stavci
    refunded_amount DECIMAL(10,2) DEFAULT 0,

    -- Kontekst
    metadata        JSONB DEFAULT '{}',
    -- Primjeri: {"tier_name": "VIP", "occurrence_date": "2026-03-28", "section": "A"}

    created_at      TIMESTAMPTZ DEFAULT NOW(),
    updated_at      TIMESTAMPTZ DEFAULT NOW(),

    -- Subtotal mora biti konzistentan
    CONSTRAINT chk_oi_subtotal CHECK (subtotal = unit_price * quantity),
    -- Refund ne smije premašiti subtotal
    CONSTRAINT chk_oi_refund_cap CHECK (refunded_amount <= subtotal),
    -- Količina pozitivna
    CONSTRAINT chk_oi_quantity_positive CHECK (quantity > 0)
);


-- ============================================================
-- 4. TRANSACTIONS (REFAKTORIRANO) — Čisti financijski zapis
-- ============================================================
-- STARA tablica: transactions s ticket_id/bundle_id FK
-- NOVA tablica: transactions_v2 bez ikakve veze na produkt
--
-- Svaka transakcija je JEDAN financijski pokret:
-- charge, refund, void, dispute, dispute_reversal.
-- Refund ima parent_transaction_id → originalni charge.
--
-- Gateway-agnostic: gateway_payment_id je generičan string.

CREATE TABLE transactions_v2 (
    id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    -- Veza na narudžbu (SVAKA transakcija pripada narudžbi)
    order_id                UUID NOT NULL REFERENCES orders(id),

    -- Tip transakcije
    transaction_type        transaction_type NOT NULL,

    -- Refund chain: refund referencira originalni charge
    parent_transaction_id   UUID REFERENCES transactions_v2(id),
    -- NULL za charge/dispute. NOT NULL za refund/void/dispute_reversal.

    -- Gateway info
    gateway_id              UUID REFERENCES payment_gateways(id),
    gateway_payment_id      VARCHAR(255),
    -- Stripe: pi_xxx za charge, re_xxx za refund
    -- Monri: transaction_id
    -- Bank transfer: referenca uplate
    -- Cash: NULL

    -- Financijski podaci
    amount                  DECIMAL(10,2) NOT NULL,
    currency                VARCHAR(3) NOT NULL DEFAULT 'EUR'
                            REFERENCES supported_currencies(code),
    platform_fee            DECIMAL(10,2) DEFAULT 0,
    -- Za charge: koliko uzima NOIR
    -- Za refund: koliko se vraća od fee-a

    -- Status ovog konkretnog pokušaja
    status                  transaction_status_v2 NOT NULL DEFAULT 'pending',

    -- Kontekst
    metadata                JSONB DEFAULT '{}',
    -- Za refund: {"reason": "occurrence_cancelled", "cancelled_occurrence_id": "..."}
    -- Za charge: {"stripe_payment_method": "pm_xxx"}
    -- Za dispute: {"dispute_id": "dp_xxx", "reason": "fraudulent"}

    -- Za refund: koje order_items su pogođene
    -- (opcijalno, za parcijalne refundove)
    refunded_items          JSONB,
    -- Format: [{"order_item_id": "uuid", "amount": 15.00}, ...]

    -- Timestamps
    created_at              TIMESTAMPTZ DEFAULT NOW(),
    updated_at              TIMESTAMPTZ DEFAULT NOW(),

    -- Constraint: refund/void/dispute_reversal MORAJU imati parent
    CONSTRAINT chk_txn_parent_required CHECK (
        (transaction_type IN ('charge', 'dispute') AND parent_transaction_id IS NULL)
        OR
        (transaction_type IN ('refund', 'void', 'dispute_reversal') AND parent_transaction_id IS NOT NULL)
    ),
    -- Amount uvijek pozitivan (smjer se čita iz transaction_type)
    CONSTRAINT chk_txn_amount_positive CHECK (amount > 0)
);


-- ============================================================
-- 5. HELPER: Generiranje order_number
-- ============================================================
-- Format: NOIR-YYYYMMDD-XXXX (4 random alfanumerička znaka)
-- Collision rate: 36^4 = 1.6M kombinacija po danu — dovoljno za MVP

CREATE OR REPLACE FUNCTION generate_order_number()
RETURNS TRIGGER AS $$
DECLARE
    v_date_part TEXT;
    v_random_part TEXT;
    v_order_number TEXT;
    v_attempts INT := 0;
BEGIN
    v_date_part := TO_CHAR(NOW(), 'YYYYMMDD');

    LOOP
        v_random_part := UPPER(SUBSTRING(
            REPLACE(gen_random_uuid()::TEXT, '-', '')
            FROM 1 FOR 4
        ));
        v_order_number := 'NOIR-' || v_date_part || '-' || v_random_part;

        -- Provjeri jedinstvenost
        IF NOT EXISTS (SELECT 1 FROM orders WHERE order_number = v_order_number) THEN
            NEW.order_number := v_order_number;
            RETURN NEW;
        END IF;

        v_attempts := v_attempts + 1;
        IF v_attempts > 10 THEN
            -- Fallback: duži random
            v_random_part := UPPER(SUBSTRING(
                REPLACE(gen_random_uuid()::TEXT, '-', '')
                FROM 1 FOR 8
            ));
            NEW.order_number := 'NOIR-' || v_date_part || '-' || v_random_part;
            RETURN NEW;
        END IF;
    END LOOP;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_generate_order_number
    BEFORE INSERT ON orders
    FOR EACH ROW
    WHEN (NEW.order_number IS NULL OR NEW.order_number = '')
    EXECUTE FUNCTION generate_order_number();

-- Komentar: App može sam postaviti order_number ako želi custom format.
-- Trigger se pali samo ako je NULL ili prazan.


-- ============================================================
-- 6. HELPER: Validacija order_item reference
-- ============================================================
-- Provjerava da item_id zaista postoji u odgovarajućoj tablici.
-- Ovo kompenzira nedostatak polimorfnog FK-a.

CREATE OR REPLACE FUNCTION validate_order_item_reference()
RETURNS TRIGGER AS $$
DECLARE
    v_exists BOOLEAN;
BEGIN
    CASE NEW.item_type
        WHEN 'ticket' THEN
            SELECT EXISTS(SELECT 1 FROM tickets WHERE id = NEW.item_id)
            INTO v_exists;
        WHEN 'bundle' THEN
            SELECT EXISTS(SELECT 1 FROM ticket_bundles WHERE id = NEW.item_id)
            INTO v_exists;
        WHEN 'table_reservation' THEN
            SELECT EXISTS(SELECT 1 FROM table_reservations WHERE id = NEW.item_id)
            INTO v_exists;
        ELSE
            -- Za buduće tipove koji još nemaju tablicu
            v_exists := TRUE;
    END CASE;

    IF NOT v_exists THEN
        RAISE EXCEPTION 'order_item referenca neispravna: % s id=% ne postoji',
            NEW.item_type, NEW.item_id;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_validate_order_item_ref
    BEFORE INSERT OR UPDATE OF item_type, item_id ON order_items
    FOR EACH ROW
    EXECUTE FUNCTION validate_order_item_reference();


-- ============================================================
-- 7. HELPER: Automatski sync order totala
-- ============================================================
-- Kad se doda/mijena/briše order_item, rekalkuliraj subtotal i total na orderu.

CREATE OR REPLACE FUNCTION sync_order_totals()
RETURNS TRIGGER AS $$
DECLARE
    v_order_id UUID;
    v_subtotal DECIMAL(10,2);
BEGIN
    -- Odredi order_id (INSERT/UPDATE koriste NEW, DELETE koristi OLD)
    IF TG_OP = 'DELETE' THEN
        v_order_id := OLD.order_id;
    ELSE
        v_order_id := NEW.order_id;
    END IF;

    -- Izračunaj subtotal
    SELECT COALESCE(SUM(subtotal), 0)
    INTO   v_subtotal
    FROM   order_items
    WHERE  order_id = v_order_id
           AND status != 'cancelled';

    -- Ažuriraj order
    UPDATE orders
    SET    subtotal = v_subtotal,
           total_amount = v_subtotal + COALESCE(platform_fee, 0),
           updated_at = NOW()
    WHERE  id = v_order_id;

    IF TG_OP = 'DELETE' THEN
        RETURN OLD;
    ELSE
        RETURN NEW;
    END IF;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_sync_order_totals
    AFTER INSERT OR UPDATE OF subtotal, status OR DELETE ON order_items
    FOR EACH ROW
    EXECUTE FUNCTION sync_order_totals();


-- ============================================================
-- 8. HELPER: Automatski sync order statusa pri refundu
-- ============================================================
-- Kad se kreira refund transakcija, provjeri treba li order
-- prijeći u 'partially_refunded' ili 'refunded'.

CREATE OR REPLACE FUNCTION sync_order_refund_status()
RETURNS TRIGGER AS $$
DECLARE
    v_total_charged   DECIMAL(10,2);
    v_total_refunded  DECIMAL(10,2);
BEGIN
    -- Samo reagiraj na completed refund transakcije
    IF NEW.transaction_type != 'refund' OR NEW.status != 'completed' THEN
        RETURN NEW;
    END IF;

    -- Ukupno naplaćeno za ovaj order
    SELECT COALESCE(SUM(amount), 0)
    INTO   v_total_charged
    FROM   transactions_v2
    WHERE  order_id = NEW.order_id
           AND transaction_type = 'charge'
           AND status = 'completed';

    -- Ukupno refundirano za ovaj order
    SELECT COALESCE(SUM(amount), 0)
    INTO   v_total_refunded
    FROM   transactions_v2
    WHERE  order_id = NEW.order_id
           AND transaction_type = 'refund'
           AND status = 'completed';

    -- Ažuriraj order status
    IF v_total_refunded >= v_total_charged THEN
        UPDATE orders
        SET    status = 'refunded', updated_at = NOW()
        WHERE  id = NEW.order_id AND status != 'refunded';
    ELSIF v_total_refunded > 0 THEN
        UPDATE orders
        SET    status = 'partially_refunded', updated_at = NOW()
        WHERE  id = NEW.order_id AND status NOT IN ('refunded', 'partially_refunded');
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_sync_order_refund_status
    AFTER INSERT OR UPDATE OF status ON transactions_v2
    FOR EACH ROW
    EXECUTE FUNCTION sync_order_refund_status();


-- ============================================================
-- 9. AŽURIRANJE TRIGGER T7: handle_occurrence_cancellation
-- ============================================================
-- Stari trigger INSERTa u transactions s bundle_id.
-- Novi trigger mora:
--   1) Pronaći order_item za pogođeni bundle
--   2) Pronaći originalni charge za taj order
--   3) Kreirati refund transakciju vezanu na order
--   4) Ažurirati order_item.refunded_amount
--
-- NAPOMENA: Ova zamjena se primjenjuje SAMO na dio triggera
-- koji kreira refund transakciju. Ostatak logike (cancel tickets,
-- unavailable items, cancel reservations) ostaje nepromijenjen.
--
-- Ovdje je SAMO fragment koji zamjenjuje stari INSERT INTO transactions:

-- Stari kod (ZAMIJENITI):
--   INSERT INTO transactions (bundle_id, amount, currency, status, metadata)
--   VALUES (v_bundle.bundle_id, v_refund_per_occurrence, 'EUR', 'refunded', ...);
--
-- Novi kod:

/*
    -- Pronađi order za ovaj bundle
    SELECT oi.order_id, oi.id AS order_item_id, o.currency
    INTO   v_order_id, v_order_item_id, v_currency
    FROM   order_items oi
    JOIN   orders o ON o.id = oi.order_id
    WHERE  oi.item_type = 'bundle'
           AND oi.item_id = v_bundle.bundle_id
    LIMIT 1;

    -- Pronađi originalni charge
    SELECT id INTO v_charge_txn_id
    FROM   transactions_v2
    WHERE  order_id = v_order_id
           AND transaction_type = 'charge'
           AND status = 'completed'
    ORDER BY created_at ASC
    LIMIT 1;

    -- Kreiraj refund transakciju
    INSERT INTO transactions_v2 (
        order_id, transaction_type, parent_transaction_id,
        amount, currency, status, metadata, refunded_items
    ) VALUES (
        v_order_id,
        'refund',
        v_charge_txn_id,
        v_refund_per_occurrence,
        v_currency,
        'completed',    -- automatski refund, odmah completed
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
        jsonb_build_array(
            jsonb_build_object(
                'order_item_id', v_order_item_id,
                'amount', v_refund_per_occurrence
            )
        )
    );

    -- Ažuriraj order_item refunded_amount
    UPDATE order_items
    SET    refunded_amount = COALESCE(refunded_amount, 0) + v_refund_per_occurrence,
           status = CASE
               WHEN COALESCE(refunded_amount, 0) + v_refund_per_occurrence >= subtotal
               THEN 'refunded'::order_item_status
               ELSE status
           END,
           updated_at = NOW()
    WHERE  id = v_order_item_id;
*/

-- NAPOMENA: Gornji kod je fragment za ugradnju u postojeći trigger.
-- Puna zamjena handle_occurrence_cancellation() funkcije zahtijeva
-- pažljivo testiranje s postojećim trigger chainom (T3, T5-T7).


-- ============================================================
-- 10. CHECKOUT EXPIRED ORDERS — Cron funkcija
-- ============================================================
-- Čisti draft/pending_payment narudžbe starije od 30 min.
-- Oslobađa seat lockove i poništava ticket rezervacije.

CREATE OR REPLACE FUNCTION expire_pending_orders()
RETURNS VOID AS $$
DECLARE
    v_order RECORD;
BEGIN
    FOR v_order IN
        SELECT id
        FROM   orders
        WHERE  status IN ('draft', 'pending_payment')
               AND (
                   (expires_at IS NOT NULL AND expires_at < NOW())
                   OR
                   (expires_at IS NULL AND created_at < NOW() - INTERVAL '30 minutes')
               )
        FOR UPDATE SKIP LOCKED
    LOOP
        -- Označi narudžbu kao expired
        UPDATE orders
        SET    status = 'expired', updated_at = NOW()
        WHERE  id = v_order.id;

        -- Označi sve stavke kao cancelled
        UPDATE order_items
        SET    status = 'cancelled', updated_at = NOW()
        WHERE  order_id = v_order.id AND status = 'pending';

        -- Otkaži tickete vezane na ovu narudžbu
        UPDATE tickets
        SET    status = 'expired', updated_at = NOW()
        WHERE  id IN (
            SELECT item_id FROM order_items
            WHERE  order_id = v_order.id AND item_type = 'ticket'
        )
        AND status IN ('reserved', 'pending_payment');

        -- Otkaži bundleove
        UPDATE ticket_bundles
        SET    status = 'cancelled', updated_at = NOW()
        WHERE  id IN (
            SELECT item_id FROM order_items
            WHERE  order_id = v_order.id AND item_type = 'bundle'
        )
        AND status = 'pending_payment';
    END LOOP;
END;
$$ LANGUAGE plpgsql;

-- pg_cron: svake 2 minute
-- SELECT cron.schedule('expire-pending-orders', '*/2 * * * *', 'SELECT expire_pending_orders()');


-- ============================================================
-- 11. AŽURIRANI VIEWOVI
-- ============================================================

-- ---- user_transactions_view (v5) ----
-- Sada pokazuje order-centric prikaz umjesto ticket/bundle-centric
CREATE OR REPLACE VIEW user_transactions_view AS
SELECT
    t.id              AS transaction_id,
    t.transaction_type,
    t.amount,
    t.currency,
    t.status          AS transaction_status,
    t.created_at      AS transaction_date,
    t.gateway_payment_id,
    t.parent_transaction_id,
    t.metadata        AS transaction_metadata,

    -- Order info
    o.id              AS order_id,
    o.order_number,
    o.user_id,
    o.org_id,
    o.total_amount    AS order_total,
    o.status          AS order_status,
    o.completed_at    AS order_completed_at,

    -- Gateway info
    pg.gateway_type,
    pg.display_name   AS gateway_name,

    -- Organizacija
    org.name          AS organization_name,

    -- Stavke (agregirane kao JSONB array)
    (
        SELECT jsonb_agg(jsonb_build_object(
            'item_type', oi.item_type,
            'description', oi.description,
            'quantity', oi.quantity,
            'subtotal', oi.subtotal,
            'status', oi.status,
            'refunded_amount', oi.refunded_amount
        ))
        FROM order_items oi
        WHERE oi.order_id = o.id
    ) AS items

FROM   transactions_v2 t
JOIN   orders o ON o.id = t.order_id
LEFT JOIN payment_gateways pg ON pg.id = t.gateway_id
LEFT JOIN organizations org ON org.id = o.org_id;

-- Komentar: Frontend filtrira po user_id iz orders tablice.
-- WHERE o.user_id = :current_user_id


-- ---- user_tickets_view (v5) — ažuriran s order referencom ----
-- Dodaje order_number za lakše praćenje kupnje
CREATE OR REPLACE VIEW user_tickets_view AS
SELECT
    t.id                AS ticket_id,
    t.status            AS ticket_status,
    t.qr_token,
    t.purchased_at,
    t.scanned_at,
    t.created_at,

    -- Event info
    e.name              AS event_name,
    e.cover_image_url,

    -- Occurrence info
    eo.occurrence_date,
    eo.start_time,
    eo.end_time,
    v.name              AS venue_name,
    v.city              AS venue_city,

    -- Tier info
    et.name             AS tier_name,
    et.price            AS tier_price,
    et.currency,

    -- Bundle info (NULL za standalone karte)
    tb.id               AS bundle_id,
    bt.name             AS bundle_name,
    tb.status           AS bundle_status,
    tb.total_price      AS bundle_price,

    -- Sjedalo/stol info (NULL za standing)
    vi.identifier       AS item_identifier,
    vs.name             AS section_name,

    -- Order info (NOVO u v5)
    o.order_number,
    o.id                AS order_id,

    -- Tip kupnje
    CASE
        WHEN t.bundle_id IS NOT NULL THEN 'bundle'
        WHEN t.package_id IS NOT NULL THEN 'package'
        ELSE 'standalone'
    END AS purchase_type,

    t.user_id

FROM   tickets t
JOIN   event_occurrences eo ON eo.id = t.occurrence_id
JOIN   events e ON e.id = eo.event_id
JOIN   venues v ON v.id = eo.venue_id
JOIN   event_tiers et ON et.id = t.tier_id
LEFT JOIN ticket_bundles tb ON tb.id = t.bundle_id
LEFT JOIN bundle_types bt ON bt.id = tb.bundle_type_id
LEFT JOIN venue_items vi ON vi.id = t.item_id
LEFT JOIN venue_sections vs ON vs.id = t.section_id
LEFT JOIN order_items oi ON oi.item_id = t.id AND oi.item_type = 'ticket'
LEFT JOIN orders o ON o.id = oi.order_id;


-- ============================================================
-- 12. ORGANIZACIJSKI VIEW — analitika prihoda
-- ============================================================
-- "Sve transakcije moje organizacije" — JEDAN join umjesto 5

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

    -- Agregacija transakcija
    (SELECT COALESCE(SUM(amount), 0)
     FROM transactions_v2
     WHERE order_id = o.id AND transaction_type = 'charge' AND status = 'completed'
    ) AS total_charged,

    (SELECT COALESCE(SUM(amount), 0)
     FROM transactions_v2
     WHERE order_id = o.id AND transaction_type = 'refund' AND status = 'completed'
    ) AS total_refunded,

    -- Broj stavki
    (SELECT COUNT(*) FROM order_items WHERE order_id = o.id) AS item_count,

    -- Gateway
    pg.gateway_type,
    pg.display_name     AS gateway_name

FROM   orders o
LEFT JOIN payment_gateways pg ON pg.id = o.gateway_id;

-- Komentar: Organizator filtrira: WHERE org_id = :my_org_id
-- Dashboard query: SELECT SUM(total_charged - total_refunded) AS net_revenue ...


-- ============================================================
-- 13. INDEKSI
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
CREATE INDEX idx_oi_status             ON order_items(status);

-- Transactions v2
CREATE INDEX idx_txn2_order            ON transactions_v2(order_id);
CREATE INDEX idx_txn2_parent           ON transactions_v2(parent_transaction_id)
    WHERE parent_transaction_id IS NOT NULL;
CREATE INDEX idx_txn2_gateway          ON transactions_v2(gateway_payment_id)
    WHERE gateway_payment_id IS NOT NULL;
CREATE INDEX idx_txn2_type_status      ON transactions_v2(transaction_type, status);
CREATE INDEX idx_txn2_created          ON transactions_v2(created_at DESC);


-- ============================================================
-- 14. RLS POLICIES (Supabase Row Level Security)
-- ============================================================
-- Osnovne RLS politike za orders/order_items/transactions_v2

ALTER TABLE orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE order_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE transactions_v2 ENABLE ROW LEVEL SECURITY;

-- Korisnik vidi vlastite narudžbe
CREATE POLICY orders_user_select ON orders
    FOR SELECT USING (auth.uid() = user_id);

-- Org member vidi narudžbe svoje organizacije
CREATE POLICY orders_org_select ON orders
    FOR SELECT USING (
        org_id IN (
            SELECT om.org_id FROM organization_members om
            WHERE om.user_id = auth.uid()
        )
    );

-- Order items prate parent order
CREATE POLICY oi_user_select ON order_items
    FOR SELECT USING (
        order_id IN (SELECT id FROM orders WHERE user_id = auth.uid())
    );

-- Transactions prate parent order
CREATE POLICY txn2_user_select ON transactions_v2
    FOR SELECT USING (
        order_id IN (SELECT id FROM orders WHERE user_id = auth.uid())
    );

-- NAPOMENA: INSERT/UPDATE/DELETE politike idu kroz service_role
-- (FastAPI backend), ne kroz anon/authenticated.


-- ============================================================
-- 15. MIGRACIJA STARIH PODATAKA (opcionalno)
-- ============================================================
-- Ako postoje podaci u staroj transactions tablici,
-- ovaj script ih migrira u novi model.
-- POKRENUTI SAMO JEDNOM, u maintenance windowu.

/*
-- Korak 1: Za svaku staru transakciju, kreiraj order + order_item + transactions_v2

INSERT INTO orders (user_id, org_id, order_number, subtotal, total_amount, currency,
                    gateway_id, status, completed_at, created_at, updated_at)
SELECT DISTINCT ON (t.id)
    t.user_id,
    e.organizer_org_id,
    'MIGR-' || SUBSTRING(t.id::TEXT, 1, 8),
    t.amount,
    t.amount,
    t.currency,
    t.gateway_id,
    CASE t.status
        WHEN 'completed' THEN 'completed'::order_status
        WHEN 'pending' THEN 'pending_payment'::order_status
        WHEN 'failed' THEN 'failed'::order_status
        WHEN 'refunded' THEN 'refunded'::order_status
        ELSE 'completed'::order_status
    END,
    CASE WHEN t.status = 'completed' THEN t.created_at END,
    t.created_at,
    t.updated_at
FROM   transactions t
LEFT JOIN tickets tk ON tk.id = t.ticket_id
LEFT JOIN ticket_bundles tb ON tb.id = t.bundle_id
LEFT JOIN event_occurrences eo ON eo.id = COALESCE(tk.occurrence_id,
    (SELECT bto.occurrence_id FROM bundle_type_occurrences bto
     WHERE bto.bundle_type_id = tb.bundle_type_id LIMIT 1))
LEFT JOIN events e ON e.id = eo.event_id;

-- Korak 2: Kreiraj order_items za svaki migrirani order
-- (detalji ovise o konkretnim podacima)

-- Korak 3: Kreiraj transactions_v2 za svaki migrirani order
-- (detalji ovise o konkretnim podacima)

-- Korak 4: Rename stare tablice
-- ALTER TABLE transactions RENAME TO transactions_legacy;
-- ALTER TABLE transactions_v2 RENAME TO transactions;
*/


-- ============================================================
-- 16. ČIŠĆENJE — dropanje stare tablice (NAKON migracije)
-- ============================================================
-- PAŽNJA: Ne izvršavati dok migracija nije potvrđena!
-- Redoslijed je bitan jer postoje FK reference.

/*
-- Ukloni CHECK constraint koji referencira stare kolone
ALTER TABLE transactions DROP CONSTRAINT IF EXISTS chk_transaction_has_subject;

-- Ako se želi potpuno ukloniti stara tablica:
ALTER TABLE transactions RENAME TO transactions_legacy;
ALTER TABLE transactions_v2 RENAME TO transactions;

-- Ažuriraj sve indekse i constrainte da koriste novo ime
*/


-- ============================================================
-- 17. pg_cron RASPORED (ažuriran)
-- ============================================================

/*
-- Expire pending orders (30 min) — svake 2 minute
SELECT cron.schedule(
    'expire-pending-orders',
    '*/2 * * * *',  -- svake 2 min
    'SELECT expire_pending_orders()'
);

-- Expire standalone rezervacija (48h) — svaki 5 min (nepromijenjen)
SELECT cron.schedule(
    'expire-standalone-reservations',
    '*/5 * * * *',
    'SELECT expire_standalone_reservations()'
);

-- Expire seat lockova (15 min) — svaku minutu (nepromijenjen)
SELECT cron.schedule(
    'expire-seat-locks',
    '* * * * *',
    'SELECT expire_seat_locks()'
);
*/


-- ============================================================
-- 18. SAŽETAK PROMJENA v4 → v5
-- ============================================================
/*
| #  | Promjena                              | Tip              |
|----|---------------------------------------|------------------|
| 1  | orders tablica                        | Nova tablica     |
| 2  | order_items tablica                   | Nova tablica     |
| 3  | transactions_v2 tablica               | Nova tablica     |
| 4  | order_status ENUM                     | Novi tip         |
| 5  | order_item_type ENUM                  | Novi tip         |
| 6  | order_item_status ENUM                | Novi tip         |
| 7  | transaction_type ENUM                 | Novi tip         |
| 8  | transaction_status_v2 ENUM            | Novi tip         |
| 9  | generate_order_number()               | Nova funkcija    |
| 10 | validate_order_item_reference()       | Nova funkcija    |
| 11 | sync_order_totals()                   | Nova funkcija    |
| 12 | sync_order_refund_status()            | Nova funkcija    |
| 13 | expire_pending_orders()               | Nova funkcija    |
| 14 | user_transactions_view                | Ažuriran view    |
| 15 | user_tickets_view                     | Ažuriran view    |
| 16 | org_revenue_view                      | Novi view        |
| 17 | 11 novih indeksa                      | Performance      |
| 18 | RLS politike za 3 tablice             | Security         |
| 19 | T7 fragment za refund transakciju     | Mod. triggera    |
| 20 | Cron: expire_pending_orders           | Novi cron job    |
*/