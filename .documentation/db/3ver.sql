# NOIR — Database Schema v3.0

> **Interni dokument tima** | Verzija 3.0 | Ožujak 2026.
> Nadogradnja na v2.0 — uključuje sve popravke strukturalnih problema i nove feature zahtjeve.

---

## Changelog v2.0 → v3.0

| # | Promjena | Razlog | Izvor |
|---|----------|--------|-------|
| 1 | `bundle_type_occurrences` junction tablica umjesto UUID[] | Referencijalni integritet za bundle → occurrence vezu | Strukturalni problem |
| 2 | `tier_sections` junction tablica umjesto UUID[] | Referencijalni integritet za tier → section vezu | Strukturalni problem |
| 3 | `venue_availability_status` ENUM umjesto VARCHAR(20) | Type-safety, sprečava typo u statusima | Strukturalni problem |
| 4 | CHECK constraint na `transactions` (ticket_id OR bundle_id) | DB-level garancija da transakcija ima subjekt | Strukturalni problem |
| 5 | `FOR UPDATE` lock u Trigger 4 (reject_overlapping_tentative) | Fix race condition kod konkurentnih potvrda | Strukturalni problem |
| 6 | `profiles.claimed_at` + ghost account flow | Guest checkout → naknadno claimanje accounta | Odgovor #2 |
| 7 | Seat lock mehanizam (15 min timeout + cron) | Atomično zaključavanje sjedala pri odabiru | Odgovor #3 |
| 8 | `audit_log` tablica — sve CRUD operacije | Potpuni audit trail grupiran po organizaciji | Odgovor #4 |
| 9 | Capacity enforcement trigger + CHECK | DB hard limit: suma tier kapaciteta ≤ occurrence kapacitet ≤ venue kapacitet | Odgovor #5 |
| 10 | Bundle partial cancel trigger + `refunded_amount` | Proporcionalni refund kad se otkaže jedna izvedba u bundleu | Odgovor #1 |

---

## Ažurirane arhitekturne odluke (v3)

1. **`events` + `event_occurrences`** — event je "definicija", occurrence je "izvedba" (nepromijenjena)
2. **`bundle_types` + `ticket_bundles`** — multi-day paketi; veza bundle→occurrences sada preko junction tablice s FK zaštitom
3. **`venue_items`** — unificiran entitet za sjedala i stolove; koordinate u JSON fajlu (nepromijenjena)
4. **`organizations`** kao centralni entitet (nepromijenjena)
5. **`payment_orders`** kao nalog za plaćanje (nepromijenjena)
6. **`venue_availability`** — status je sada ENUM tip s exclusion constraintom; race condition riješen s row-level lockingom
7. **`table_reservations`** — odvojena od ticketa, podržava standalone/manual/ticket-linked (nepromijenjena)
8. **`sold_count` triggeri** — atomična sinkronizacija (nepromijenjena)
9. **Payment credentials** — nikad u bazi (nepromijenjena)
10. **[NOVO] Ghost accounts** — guest checkout kreira auth.users + profiles bez passworda; `claimed_at` prati je li account preuzet
11. **[NOVO] Seat locking** — 15 min atomični lock na `occurrence_item_status`; cron čisti expired lockove
12. **[NOVO] Audit log** — sve CRUD operacije na svim tablicama, grupirane po organizaciji
13. **[NOVO] Capacity enforcement** — dvostruka zaštita: DB trigger kao hard limit + app-level soft warning
14. **[NOVO] Bundle partial refund** — proporcionalni povrat pri otkazivanju pojedinačne izvedbe

---

## SQL Promjene

```sql
-- ============================================================
-- NOIR — Database Schema v3.0 DELTA
-- Supabase (PostgreSQL) | Ožujak 2026.
-- ============================================================
-- Ovaj fajl sadrži SAMO promjene relative na v2.0.
-- Za punu shemu: primijeniti v2.0 pa onda ovaj delta.
-- ============================================================


-- ============================================================
-- PROMJENA 1: Junction tablica za bundle_type → occurrences
-- ============================================================
-- BRIŠE: bundle_types.included_occurrence_ids UUID[]
-- DODAJE: bundle_type_occurrences junction tablica
--
-- Razlog: UUID[] nema referencijalni integritet. Ako se
-- occurrence obriše, array ostaje s mrtvim UUID-om.

ALTER TABLE bundle_types DROP COLUMN included_occurrence_ids;

CREATE TABLE bundle_type_occurrences (
    bundle_type_id  UUID NOT NULL REFERENCES bundle_types(id) ON DELETE CASCADE,
    occurrence_id   UUID NOT NULL REFERENCES event_occurrences(id) ON DELETE RESTRICT,
    sort_order      INT DEFAULT 0,
    PRIMARY KEY (bundle_type_id, occurrence_id)
);

-- RESTRICT na occurrence: ne možeš obrisati izvedbu dok je
-- referencirana u aktivnom bundle tipu. Prvo deaktiviraj bundle.

CREATE INDEX idx_bto_occurrence ON bundle_type_occurrences(occurrence_id);

-- Migracija podataka (za postojeće zapise):
-- INSERT INTO bundle_type_occurrences (bundle_type_id, occurrence_id, sort_order)
-- SELECT bt.id, unnest(bt.included_occurrence_ids), 
--        generate_series(0, array_length(bt.included_occurrence_ids, 1) - 1)
-- FROM bundle_types bt
-- WHERE bt.included_occurrence_ids IS NOT NULL;


-- ============================================================
-- PROMJENA 2: Junction tablica za tier → sections
-- ============================================================
-- BRIŠE: event_tiers.applicable_section_ids UUID[]
-- DODAJE: tier_sections junction tablica

ALTER TABLE event_tiers DROP COLUMN applicable_section_ids;

CREATE TABLE tier_sections (
    tier_id     UUID NOT NULL REFERENCES event_tiers(id) ON DELETE CASCADE,
    section_id  UUID NOT NULL REFERENCES venue_sections(id) ON DELETE RESTRICT,
    PRIMARY KEY (tier_id, section_id)
);

CREATE INDEX idx_tier_sections_section ON tier_sections(section_id);

-- Migracija:
-- INSERT INTO tier_sections (tier_id, section_id)
-- SELECT et.id, unnest(et.applicable_section_ids)
-- FROM event_tiers et
-- WHERE et.applicable_section_ids IS NOT NULL;


-- ============================================================
-- PROMJENA 3: ENUM za venue_availability status
-- ============================================================
-- BRIŠE: VARCHAR(20) status
-- DODAJE: venue_availability_status ENUM

CREATE TYPE venue_availability_status AS ENUM (
    'tentative',    -- upit poslan, čeka potvrdu (dopušta preklapanje)
    'blocked',      -- potvrđeno (zabranjuje preklapanje)
    'available',    -- eksplicitno označeno slobodnim
    'rejected'      -- automatski odbijeno jer je drugi upit potvrđen
);

-- Migracija: kreirati novu kolonu, kopirati, dropati staru
ALTER TABLE venue_availability ADD COLUMN status_new venue_availability_status;
UPDATE venue_availability SET status_new = status::venue_availability_status;
ALTER TABLE venue_availability DROP COLUMN status;
ALTER TABLE venue_availability RENAME COLUMN status_new TO status;
ALTER TABLE venue_availability ALTER COLUMN status SET NOT NULL;
ALTER TABLE venue_availability ALTER COLUMN status SET DEFAULT 'tentative';

-- Ponovo kreirati exclusion constraint s ENUM tipom
ALTER TABLE venue_availability DROP CONSTRAINT IF EXISTS excl_venue_no_overlap_blocked;
ALTER TABLE venue_availability
    ADD CONSTRAINT excl_venue_no_overlap_blocked
    EXCLUDE USING gist (
        venue_id WITH =,
        time_range WITH &&
    ) WHERE (status = 'blocked');

-- Ponovo kreirati indeks
DROP INDEX IF EXISTS idx_va_status;
CREATE INDEX idx_va_status ON venue_availability(status);


-- ============================================================
-- PROMJENA 4: CHECK constraint na transactions
-- ============================================================
-- Barem jedan od ticket_id ili bundle_id mora biti NOT NULL.

ALTER TABLE transactions
    ADD CONSTRAINT chk_transaction_has_subject
    CHECK (ticket_id IS NOT NULL OR bundle_id IS NOT NULL);


-- ============================================================
-- PROMJENA 5: Fix Trigger 4 — race condition
-- ============================================================
-- Problem: dva konkurentna "potvrdi upit" poziva mogu oba
-- proći jer trigger čita tentative bez lockanja redaka.
-- Rješenje: FOR UPDATE lock na preklapajuće retke.

CREATE OR REPLACE FUNCTION reject_overlapping_tentative()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.status = 'blocked' AND (OLD IS NULL OR OLD.status != 'blocked') THEN
        -- Zaključaj preklapajuće retke PRIJE updatea
        -- FOR UPDATE sprečava drugu transakciju da ih istovremeno čita
        PERFORM 1
        FROM   venue_availability
        WHERE  venue_id = NEW.venue_id
               AND id != NEW.id
               AND status = 'tentative'
               AND time_range && NEW.time_range
        FOR UPDATE;

        -- Označi preklapajuće tentative kao rejected
        UPDATE venue_availability
        SET    status = 'rejected'
        WHERE  venue_id = NEW.venue_id
               AND id != NEW.id
               AND status = 'tentative'
               AND time_range && NEW.time_range;

        -- Ažuriraj povezane inquiry statuse
        UPDATE venue_inquiries vi
        SET    status = 'rejected',
               updated_at = NOW()
        FROM   venue_availability va
        WHERE  va.inquiry_id = vi.id
               AND va.venue_id = NEW.venue_id
               AND va.id != NEW.id
               AND va.status = 'rejected'
               AND va.time_range && NEW.time_range
               AND vi.status NOT IN ('accepted', 'cancelled');
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger ostaje isti (AFTER UPDATE OF status ON venue_availability)


-- ============================================================
-- PROMJENA 6: Ghost accounts + claim flow
-- ============================================================
-- Guest checkout kreira "ghost" profil s emailom ali bez passworda.
-- Korisnik se može naknadno registrirati i preuzeti account.
-- claimed_at = NULL znači ghost, claimed_at = timestamp znači preuzet.

ALTER TABLE profiles ADD COLUMN claimed_at TIMESTAMPTZ;

-- Svi postojeći profili se smatraju claimed (retroaktivno)
UPDATE profiles SET claimed_at = created_at WHERE claimed_at IS NULL;

-- NAPOMENA: za nove ghost accounte, claimed_at ostaje NULL.
-- Kad korisnik napravi Google Sign-In ili password reset,
-- app sloj postavlja claimed_at = NOW().

-- Indeks za brzo filtriranje ghost accountova
CREATE INDEX idx_profiles_unclaimed
    ON profiles(id)
    WHERE claimed_at IS NULL;


-- ============================================================
-- PROMJENA 7: Seat lock mehanizam (15 min)
-- ============================================================
-- occurrence_item_status.reserved_until već postoji u v2.
-- Dodajemo: novi status 'locked' u ENUM + cron funkciju za čišćenje.

-- Dodaj 'locked' u item_availability ENUM
-- (PostgreSQL ne podržava ALTER TYPE ... ADD VALUE u transakciji,
--  ovo mora ići kao zasebna naredba)
ALTER TYPE item_availability ADD VALUE IF NOT EXISTS 'locked' AFTER 'reserved';

-- Funkcija: zaključaj sjedalo za checkout (15 min)
-- Poziva se iz backenda kad korisnik odabere sjedalo.
-- Vraća TRUE ako je zaključavanje uspjelo, FALSE ako je sjedalo zauzeto.
CREATE OR REPLACE FUNCTION lock_seat_for_checkout(
    p_occurrence_id UUID,
    p_item_id UUID,
    p_user_id UUID
) RETURNS BOOLEAN AS $$
DECLARE
    v_current_status item_availability;
    v_reserved_until TIMESTAMPTZ;
BEGIN
    -- Atomični lock na redak
    SELECT status, reserved_until
    INTO   v_current_status, v_reserved_until
    FROM   occurrence_item_status
    WHERE  occurrence_id = p_occurrence_id
           AND item_id = p_item_id
    FOR UPDATE;

    -- Ako redak ne postoji, kreiraj ga (first touch)
    IF NOT FOUND THEN
        INSERT INTO occurrence_item_status (
            occurrence_id, item_id, status, reserved_until, updated_at
        ) VALUES (
            p_occurrence_id, p_item_id, 'locked',
            NOW() + INTERVAL '15 minutes', NOW()
        );
        RETURN TRUE;
    END IF;

    -- Ako je locked ali expired, preuzmi
    IF v_current_status = 'locked' AND v_reserved_until < NOW() THEN
        UPDATE occurrence_item_status
        SET    status = 'locked',
               reserved_until = NOW() + INTERVAL '15 minutes',
               updated_at = NOW()
        WHERE  occurrence_id = p_occurrence_id
               AND item_id = p_item_id;
        RETURN TRUE;
    END IF;

    -- Ako je available, zaključaj
    IF v_current_status = 'available' THEN
        UPDATE occurrence_item_status
        SET    status = 'locked',
               reserved_until = NOW() + INTERVAL '15 minutes',
               updated_at = NOW()
        WHERE  occurrence_id = p_occurrence_id
               AND item_id = p_item_id;
        RETURN TRUE;
    END IF;

    -- Sve ostalo (sold, reserved, locked-i-nije-expired, blocked) = zauzeto
    RETURN FALSE;
END;
$$ LANGUAGE plpgsql;


-- Funkcija: čisti expired seat lockove
-- Poziva se pg_cron-om svakih 1 minutu.
CREATE OR REPLACE FUNCTION expire_seat_locks()
RETURNS INT AS $$
DECLARE
    v_count INT;
BEGIN
    UPDATE occurrence_item_status
    SET    status = 'available',
           reserved_until = NULL,
           ticket_id = NULL,
           updated_at = NOW()
    WHERE  status = 'locked'
           AND reserved_until IS NOT NULL
           AND reserved_until < NOW();

    GET DIAGNOSTICS v_count = ROW_COUNT;
    RETURN v_count;
END;
$$ LANGUAGE plpgsql;

-- pg_cron setup (run in Supabase SQL Editor):
-- SELECT cron.schedule(
--     'expire-seat-locks',
--     '* * * * *',           -- svaku minutu
--     'SELECT expire_seat_locks()'
-- );

-- Indeks za brzo čišćenje expired lockova
CREATE INDEX idx_item_status_locked_expires
    ON occurrence_item_status(reserved_until)
    WHERE status = 'locked' AND reserved_until IS NOT NULL;


-- ============================================================
-- PROMJENA 8: Audit log — sve CRUD operacije
-- ============================================================
-- Generički audit log koji pokriva sve tablice.
-- Grupiran po org_id za filtriranje po organizaciji.
-- Koristi JSONB za old/new values (fleksibilno, bez schema promjena).

CREATE TYPE audit_action AS ENUM ('INSERT', 'UPDATE', 'DELETE');

CREATE TABLE audit_log (
    id              BIGSERIAL PRIMARY KEY,
    -- Tko
    user_id         UUID REFERENCES auth.users(id),
    org_id          UUID REFERENCES organizations(id),
    -- Što
    entity_type     VARCHAR(100) NOT NULL,   -- ime tablice: 'tickets', 'events', ...
    entity_id       UUID,                    -- PK entiteta (NULL za DELETE ako ne znamo)
    action          audit_action NOT NULL,
    -- Detalji
    old_values      JSONB,                   -- NULL za INSERT
    new_values      JSONB,                   -- NULL za DELETE
    changed_fields  TEXT[],                  -- lista mijenjanih kolona (samo za UPDATE)
    -- Kontekst
    ip_address      INET,
    user_agent      TEXT,
    request_id      UUID,                    -- za korelaciju s API requestom
    metadata        JSONB,                   -- dodatni kontekst po potrebi
    -- Vrijeme
    created_at      TIMESTAMPTZ DEFAULT NOW()
);

-- Particioniranje po vremenu (opcionalno, za performance na velikom volumenu)
-- CREATE TABLE audit_log (...) PARTITION BY RANGE (created_at);

-- Indeksi za najčešće upite
CREATE INDEX idx_audit_org          ON audit_log(org_id, created_at DESC);
CREATE INDEX idx_audit_entity       ON audit_log(entity_type, entity_id);
CREATE INDEX idx_audit_user         ON audit_log(user_id, created_at DESC);
CREATE INDEX idx_audit_time         ON audit_log(created_at DESC);
CREATE INDEX idx_audit_action       ON audit_log(entity_type, action);

-- NAPOMENA O IMPLEMENTACIJI:
-- Audit log se puni na APPLICATION LEVEL-u (FastAPI middleware),
-- NE kroz PostgreSQL triggere na svim tablicama.
--
-- Razlozi:
-- 1. Trigger na svakoj tablici = ogroman performance overhead
-- 2. Trigger ne zna tko je user (nema HTTP context)
-- 3. Trigger ne zna org_id za sve tablice
-- 4. Application-level logging daje nam ip_address, user_agent, request_id
--
-- FastAPI implementacija:
-- - Middleware hvata svaki mutating request (POST/PUT/PATCH/DELETE)
-- - Service layer bilježi old_values PRIJE i new_values POSLIJE operacije
-- - Async insert u audit_log (ne blokira response)
--
-- Primjer (pseudo-kod):
-- async def update_ticket(ticket_id, data, current_user):
--     old = await db.get(ticket_id)
--     new = await db.update(ticket_id, data)
--     await audit.log(
--         user_id=current_user.id,
--         org_id=ticket.event.organizer_org_id,
--         entity_type='tickets',
--         entity_id=ticket_id,
--         action='UPDATE',
--         old_values=old,
--         new_values=new,
--         changed_fields=['status', 'scanned_at']
--     )


-- ============================================================
-- PROMJENA 9: Capacity enforcement (DB hard limit)
-- ============================================================
-- Dvostruka zaštita:
--   A) DB trigger: suma tier total_count ≤ occurrence total_capacity
--   B) DB trigger: occurrence total_capacity ≤ venue total_capacity
--   C) App level: soft warning kad organizator priđe 80% kapaciteta
--
-- Trigger A: sprečava kreiranje/update tiera koji bi prešao kapacitet

CREATE OR REPLACE FUNCTION enforce_tier_capacity_limit()
RETURNS TRIGGER AS $$
DECLARE
    v_occurrence_capacity INT;
    v_current_tier_sum INT;
BEGIN
    -- Dohvati kapacitet izvedbe
    SELECT total_capacity
    INTO   v_occurrence_capacity
    FROM   event_occurrences
    WHERE  id = NEW.occurrence_id;

    -- Ako occurrence nema definiran kapacitet, preskoči provjeru
    IF v_occurrence_capacity IS NULL THEN
        RETURN NEW;
    END IF;

    -- Izračunaj sumu svih tierova za tu izvedbu (uključujući ovaj novi/ažurirani)
    SELECT COALESCE(SUM(total_count), 0)
    INTO   v_current_tier_sum
    FROM   event_tiers
    WHERE  occurrence_id = NEW.occurrence_id
           AND id != NEW.id        -- isključi trenutni redak (za UPDATE)
           AND is_active = TRUE;

    -- Dodaj novi/ažurirani tier
    v_current_tier_sum := v_current_tier_sum + NEW.total_count;

    IF v_current_tier_sum > v_occurrence_capacity THEN
        RAISE EXCEPTION 'Ukupan broj ulaznica (%) prelazi kapacitet izvedbe (%). Smanjite broj ulaznica ili povećajte kapacitet.',
            v_current_tier_sum, v_occurrence_capacity;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_enforce_tier_capacity
    BEFORE INSERT OR UPDATE OF total_count, is_active ON event_tiers
    FOR EACH ROW
    EXECUTE FUNCTION enforce_tier_capacity_limit();


-- Trigger B: occurrence kapacitet ne smije preći venue kapacitet

CREATE OR REPLACE FUNCTION enforce_occurrence_venue_capacity()
RETURNS TRIGGER AS $$
DECLARE
    v_venue_capacity INT;
BEGIN
    -- Ako occurrence nema definiran kapacitet, preskoči
    IF NEW.total_capacity IS NULL THEN
        RETURN NEW;
    END IF;

    SELECT total_capacity
    INTO   v_venue_capacity
    FROM   venues
    WHERE  id = NEW.venue_id;

    -- Ako venue nema definiran kapacitet, preskoči
    IF v_venue_capacity IS NULL THEN
        RETURN NEW;
    END IF;

    IF NEW.total_capacity > v_venue_capacity THEN
        RAISE EXCEPTION 'Kapacitet izvedbe (%) prelazi kapacitet prostora (%). Kontaktirajte vlasnika prostora.',
            NEW.total_capacity, v_venue_capacity;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_enforce_occurrence_venue_capacity
    BEFORE INSERT OR UPDATE OF total_capacity ON event_occurrences
    FOR EACH ROW
    EXECUTE FUNCTION enforce_occurrence_venue_capacity();


-- ============================================================
-- PROMJENA 10: Bundle partial cancel (proporcionalni refund)
-- ============================================================
-- Kad se occurrence otkaže (status → 'cancelled'), trigger:
-- 1. Otkazuje sve tickete za tu izvedbu
-- 2. Za bundle tickete: računa proporcionalni refund
-- 3. Ažurira ticket_bundles.refunded_amount
-- 4. Kreira refund transakciju

-- Dodaj refunded_amount na ticket_bundles
ALTER TABLE ticket_bundles ADD COLUMN refunded_amount DECIMAL(10,2) DEFAULT 0;
ALTER TABLE ticket_bundles ADD COLUMN original_occurrence_count INT;

-- Dodaj 'partially_refunded' u bundle_status
ALTER TYPE bundle_status ADD VALUE IF NOT EXISTS 'partially_refunded' AFTER 'partially_used';

-- Trigger: kad se occurrence otkaže, handlaj bundle tickete
CREATE OR REPLACE FUNCTION handle_occurrence_cancellation()
RETURNS TRIGGER AS $$
DECLARE
    v_bundle RECORD;
    v_total_occurrences INT;
    v_refund_per_occurrence DECIMAL(10,2);
BEGIN
    -- Samo reagiraj na promjenu u 'cancelled'
    IF NEW.status != 'cancelled' OR OLD.status = 'cancelled' THEN
        RETURN NEW;
    END IF;

    -- 1. Otkaži sve aktivne tickete za ovu izvedbu
    UPDATE tickets
    SET    status = 'cancelled',
           cancelled_at = NOW(),
           updated_at = NOW()
    WHERE  occurrence_id = NEW.id
           AND status IN ('active', 'reserved', 'pending_payment');

    -- 2. Za svaki pogođeni bundle, izračunaj proporcionalni refund
    FOR v_bundle IN
        SELECT DISTINCT tb.id AS bundle_id,
               tb.total_price,
               tb.bundle_type_id,
               tb.refunded_amount AS current_refunded,
               tb.original_occurrence_count
        FROM   ticket_bundles tb
        JOIN   tickets t ON t.bundle_id = tb.id
        WHERE  t.occurrence_id = NEW.id
               AND tb.status IN ('active', 'partially_used', 'partially_refunded')
    LOOP
        -- Dohvati ukupan broj izvedbi u bundleu
        v_total_occurrences := v_bundle.original_occurrence_count;

        -- Fallback: prebroj iz junction tablice ako original_occurrence_count nije postavljen
        IF v_total_occurrences IS NULL OR v_total_occurrences = 0 THEN
            SELECT COUNT(*)
            INTO   v_total_occurrences
            FROM   bundle_type_occurrences
            WHERE  bundle_type_id = v_bundle.bundle_type_id;
        END IF;

        -- Sigurnosna provjera
        IF v_total_occurrences > 0 THEN
            v_refund_per_occurrence := v_bundle.total_price / v_total_occurrences;

            -- Ažuriraj bundle
            UPDATE ticket_bundles
            SET    refunded_amount = COALESCE(refunded_amount, 0) + v_refund_per_occurrence,
                   status = 'partially_refunded',
                   updated_at = NOW()
            WHERE  id = v_bundle.bundle_id;

            -- Kreiraj refund transakciju
            INSERT INTO transactions (
                bundle_id, amount, currency, status, metadata, created_at
            ) VALUES (
                v_bundle.bundle_id,
                v_refund_per_occurrence,
                'EUR',
                'refunded',
                jsonb_build_object(
                    'reason', 'occurrence_cancelled',
                    'cancelled_occurrence_id', NEW.id,
                    'calculation', jsonb_build_object(
                        'total_price', v_bundle.total_price,
                        'total_occurrences', v_total_occurrences,
                        'refund_per_occurrence', v_refund_per_occurrence
                    )
                ),
                NOW()
            );
        END IF;
    END LOOP;

    -- 3. Oslobodi sve stavke (sjedala, stolove) za ovu izvedbu
    UPDATE occurrence_item_status
    SET    status = 'unavailable',
           updated_at = NOW()
    WHERE  occurrence_id = NEW.id;

    -- 4. Otkaži sve rezervacije za ovu izvedbu
    UPDATE table_reservations
    SET    status = 'cancelled',
           cancelled_at = NOW(),
           updated_at = NOW()
    WHERE  occurrence_id = NEW.id
           AND status IN ('pending', 'confirmed');

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_handle_occurrence_cancellation
    AFTER UPDATE OF status ON event_occurrences
    FOR EACH ROW
    EXECUTE FUNCTION handle_occurrence_cancellation();
```

---

## Ažurirani potpuni popis tablica (v3)

Za referencu — sve tablice u sustavu nakon v3 promjena:

| # | Tablica | Status | Napomena |
|---|---------|--------|----------|
| 1 | `user_platform_roles` | Nepromijenjena | |
| 2 | `profiles` | **CHANGED** | +`claimed_at` za ghost account flow |
| 3 | `user_preferences` | Nepromijenjena | |
| 4 | `organizations` | Nepromijenjena | |
| 5 | `organization_members` | Nepromijenjena | |
| 6 | `payment_gateways` | Nepromijenjena | |
| 7 | `tags` | Nepromijenjena | |
| 8 | `venues` | Nepromijenjena | |
| 9 | `venue_tags` | Nepromijenjena | |
| 10 | `venue_sections` | Nepromijenjena | |
| 11 | `venue_items` | Nepromijenjena | |
| 12 | `venue_rental_terms` | Nepromijenjena | |
| 13 | `events` | Nepromijenjena | |
| 14 | `event_tags` | Nepromijenjena | |
| 15 | `venue_inquiries` | Nepromijenjena | |
| 16 | `venue_inquiry_dates` | Nepromijenjena | |
| 17 | `venue_inquiry_responses` | Nepromijenjena | |
| 18 | `event_occurrences` | Nepromijenjena | +novi trigger za capacity + cancellation |
| 19 | `venue_availability` | **CHANGED** | status: VARCHAR→ENUM |
| 20 | `event_tiers` | **CHANGED** | -`applicable_section_ids`; +novi trigger za capacity |
| 21 | `tier_sections` | **NEW** | Junction: tier → section |
| 22 | `occurrence_packages` | Nepromijenjena | |
| 23 | `bundle_types` | **CHANGED** | -`included_occurrence_ids` |
| 24 | `bundle_type_occurrences` | **NEW** | Junction: bundle_type → occurrence |
| 25 | `ticket_bundles` | **CHANGED** | +`refunded_amount`, +`original_occurrence_count` |
| 26 | `tickets` | Nepromijenjena | |
| 27 | `occurrence_item_status` | **CHANGED** | +`locked` status, +seat lock indeks |
| 28 | `table_reservations` | Nepromijenjena | |
| 29 | `transactions` | **CHANGED** | +CHECK constraint |
| 30 | `payment_orders` | Nepromijenjena | |
| 31 | `audit_log` | **NEW** | Sve CRUD operacije |

---

## Potpuni popis triggera i funkcija (v3)

| # | Trigger/Funkcija | Tablica | Opis | Status |
|---|------------------|---------|------|--------|
| T1 | `trg_ticket_sold_counts` | tickets | sold_count sync (tier, package, occurrence) | Nepromijenjen |
| T2 | `trg_bundle_sold_counts` | ticket_bundles | bundle_type sold_count sync | Nepromijenjen |
| T3 | `trg_cancel_reservation_on_ticket_cancel` | tickets | Auto-cancel reservation na ticket cancel | Nepromijenjen |
| T4 | `trg_reject_overlapping_on_confirm` | venue_availability | Auto-reject tentative na confirm | **CHANGED** — FOR UPDATE lock |
| T5 | `trg_enforce_tier_capacity` | event_tiers | Hard limit: suma tierova ≤ occurrence kapacitet | **NEW** |
| T6 | `trg_enforce_occurrence_venue_capacity` | event_occurrences | Hard limit: occurrence ≤ venue kapacitet | **NEW** |
| T7 | `trg_handle_occurrence_cancellation` | event_occurrences | Bundle partial refund + ticket cancel | **NEW** |
| F1 | `swap_table_reservation()` | — | Atomični swap stola | Nepromijenjena |
| F2 | `expire_standalone_reservations()` | — | 48h expiry za standalone rezervacije | Nepromijenjena |
| F3 | `lock_seat_for_checkout()` | — | 15 min seat lock | **NEW** |
| F4 | `expire_seat_locks()` | — | Cron: čisti expired lockove | **NEW** |

---

## pg_cron raspored (v3)

```sql
-- Expire standalone rezervacija (48h) — svaki 5 min
SELECT cron.schedule(
    'expire-standalone-reservations',
    '*/5 * * * *',
    'SELECT expire_standalone_reservations()'
);

-- Expire seat lockova (15 min) — svaku minutu
SELECT cron.schedule(
    'expire-seat-locks',
    '* * * * *',
    'SELECT expire_seat_locks()'
);
```

---

## App-level zadaci (ne pokriveno SQL-om)

Ove stvari moraju biti implementirane u FastAPI, a ne u bazi:

### 1. Audit log middleware
```
FastAPI middleware → hvata POST/PUT/PATCH/DELETE
→ bilježi old_values + new_values
→ async INSERT u audit_log
→ uključuje: user_id, org_id, ip_address, user_agent, request_id
```

### 2. Capacity soft warning
```
Endpoint: POST /occurrences/{id}/tiers
→ Provjeri sumu tier kapaciteta vs occurrence kapacitet
→ Ako je > 80%: vrati warning u responseu (ali dozvoli)
→ Ako bi prešao 100%: DB trigger blokira INSERT (hard limit)
```

### 3. Ghost account claim flow
```
Guest checkout:
1. Kreiraj auth.users s emailom (bez passworda)
2. Kreiraj profiles (claimed_at = NULL)
3. Kreiraj ticket + pošalji email s QR kodom

Claim:
1. Korisnik klikne "Registriraj se" ili "Google Sign-In"
2. Ako email postoji u auth.users → poveži account
3. Postavi claimed_at = NOW()
4. Sve karte automatski dostupne u walletu
```

### 4. Seat selection API flow
```
1. Korisnik odabere sjedalo → POST /seats/lock
   → Poziva lock_seat_for_checkout() DB funkciju
   → Vraća TRUE (success) ili FALSE (zauzeto) + poruka

2. Korisnik ide na checkout → 15 min timer na frontendu
   → Ako ne dovrši: cron čisti lock, sjedalo se oslobađa

3. Korisnik plati → ticket se kreira
   → occurrence_item_status.status → 'sold'
   → reserved_until → NULL (permanentno)

4. Ako je sjedalo zauzeto pri odabiru:
   → Frontend: "Netko je bio brži! Odaberite drugo sjedalo."
   → Vrati korisnika na seat selection korak
```

---

## Ažurirani Implementation Workflow (v3)

```
MILESTONE 1 — Temelj (Tjedan 1-2)
├── DB migracije (v2 SQL + v3 delta)
├── Extensions: btree_gist, pgcrypto
├── Supabase RLS policies po tablicama
├── Seed: tagovi, admin user, platform default gateway
├── pg_cron: expire_standalone_reservations() svakih 5 min     [v2]
├── pg_cron: expire_seat_locks() svaku minutu                  [NEW v3]
├── Kreirati audit_log tablicu i indekse                       [NEW v3]
└── OUTPUT: funkcionalna baza s triggerima, constraintima i capacity zaštitom

MILESTONE 2 — Auth + Organizacije + Ghost Accounts (Tjedan 2-3)
├── FastAPI: auth middleware (JWT decode iz Supabase)
├── RBAC helper: get_user_role(user_id, org_id)
├── Ghost account flow: guest checkout kreira profil           [NEW v3]
├── Claim flow: Google Sign-In / password reset povezuje       [NEW v3]
├── Audit log middleware (async insert)                        [NEW v3]
├── Endpointi: /auth/*, /organizations/*, /organization-members/*
├── Admin panel: organizations list, user-platform-roles CRUD
└── OUTPUT: prijava radi, RBAC spreman, ghost accounts rade

MILESTONE 3 — Venues + JSON loader (Tjedan 3-4)
├── FastAPI: /venues/* CRUD (venue_owner role)
├── Venue Builder API: POST sekcije, POST stavke (venue_items)
├── JSON file service: sprema/čita /venues/{org_id}/{venue_id}.json
├── Conflict checker: venue_availability tstzrange provjera
└── OUTPUT: venue owner može kreirati prostor s tlocrtom

MILESTONE 4 — Events + Inquiry flow (Tjedan 4-6)
├── FastAPI: /events/* CRUD (draft stage)
├── FastAPI: /venues/{id}/inquiries — pošalji upit s datumima
│   ├── Kreira tentative venue_availability zapise
│   └── Automatski postavi expires_at (+5 dana)
├── FastAPI: /inquiries/{id}/respond — vlasnik odgovara
├── FastAPI: /inquiries/{id}/accept — organizator prihvaća uvjete
│   ├── Kreira event_occurrences za svaki datum
│   ├── Mijenja venue_availability status u 'blocked'
│   ├── TRIGGER automatski rejecta preklapajuće tentative (s FOR UPDATE) [CHANGED v3]
│   └── Kreira rental_terms_snapshot na occurrence
└── OUTPUT: cijeli B2B flow radi end-to-end

MILESTONE 5 — Ticketing + Bundles + Seat Locking (Tjedan 6-8)
├── FastAPI: /occurrences/{id}/tiers CRUD
│   └── Capacity soft warning na 80% + DB hard limit              [NEW v3]
├── FastAPI: /occurrences/{id}/packages CRUD
├── FastAPI: /events/{id}/bundle-types CRUD
│   └── Koristi bundle_type_occurrences junction tablicu           [CHANGED v3]
│   └── Koristi tier_sections junction tablicu                     [CHANGED v3]
├── FastAPI: /occurrences/{id}/seat-map — vraća item statuse
├── FastAPI: POST /seats/lock                                      [NEW v3]
│   └── Poziva lock_seat_for_checkout() — 15 min lock
├── FastAPI: POST /tickets/purchase
│   ├── Za numerirana mjesta: provjeri lock → kreiraj ticket
│   ├── Za stajaća: provjeri kapacitet sekcije
│   ├── Generiraj qr_token (UUID + HMAC potpis)
│   ├── TRIGGER automatski ažurira sold_count
│   └── CHECK constraint sprečava oversell
├── FastAPI: POST /bundles/purchase
│   ├── Kreira ticket_bundle + N ticketa (jedan po occurrence)
│   ├── Sprema original_occurrence_count                           [NEW v3]
│   ├── TRIGGER ažurira bundle_type sold_count
│   └── Stripe checkout session za bundle price
├── Stripe webhook → transaction completed → ticket/bundle active
└── OUTPUT: kupnja ulaznica i bundleova radi sa seat lockingom

MILESTONE 6 — QR + Reservations + Payment Orders (Tjedan 8-9)
├── FastAPI: GET /tickets/{id}/qr
├── FastAPI: POST /tickets/{id}/scan — idempotent scan
├── FastAPI: POST /tickets/{id}/redeem-drink
├── FastAPI: POST /reservations
│   ├── standalone: expires_at = NOW() + 48h
│   ├── ticket_purchase: automatski uz paket
│   └── manual_booking: door_staff/owner kreira
├── FastAPI: POST /reservations/{id}/swap
│   └── Poziva swap_table_reservation() DB funkciju
├── Cron: expire_standalone_reservations() svakih 5 min
├── Cron: expire_seat_locks() svaku minutu                        [NEW v3]
├── FastAPI: POST /payment-orders
├── Occurrence cancellation handling:                              [NEW v3]
│   ├── TRIGGER auto-cancel tickete
│   ├── TRIGGER proporcionalni bundle refund
│   └── TRIGGER oslobodi sjedala i rezervacije
└── OUTPUT: QR + reservacije + payment orderi + cancellation flow rade

MILESTONE 7 — Analytics + Polish (Tjedan 10-12)
├── FastAPI: /analytics/event/{id} — KPIs
├── FastAPI: /analytics/venue/{id} — top organizatori
├── FastAPI: /analytics/export/{id} — CSV
├── Bundle analytics: revenue po bundle tipu
├── Audit log viewer u admin panelu                               [NEW v3]
│   └── Filtriranje po org_id, entity_type, action, vremenu
└── OUTPUT: dashboardi s realnim podacima + audit trail
```

---

## JSON fajl struktura (venue builder) — nepromijenjena

(Identična v2 — pogledaj `2ver.sql` za detalje)

---

## Branching strategija — nepromijenjena

```
main          ← samo stabilan, deployabilan kod
develop       ← aktivna integracija
feature/*     ← svaki feature zasebna grana
fix/*         ← bugfixevi
```

**PR pravilo:** svaki merge u `develop` mora imati barem jednu API test routu koja prolazi. Merge u `main` samo na kraju milestonea.