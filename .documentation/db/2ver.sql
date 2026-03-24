# NOIR — Database Schema v2.0

> **Interni dokument tima** | Verzija 2.0 | Ožujak 2026.
> Nadogradnja na v1.0 — uključuje sve arhitekturne odluke iz code review sesije.

---

## Changelog v1.0 → v2.0

| # | Promjena | Razlog |
|---|----------|--------|
| 1 | Dodana `bundle_types` + `ticket_bundles` tablica | Multi-day paketi s vlastitim pricingom |
| 2 | Dodan PostgreSQL trigger za `sold_count` sinkronizaciju | Atomična konzistencija, eliminacija race conditions |
| 3 | `venue_availability` koristi `tstzrange` + exclusion constraint **samo za confirmed** | Dopušta više nepotvrđenih upita za isti termin |
| 4 | `payment_gateways` — uklonjen `credentials`, ostaje `config` JSONB | API ključevi idu u env varijable |
| 5 | Dodana `table_reservations` tablica s 3 source tipa | Pokriva standalone, manual i ticket-linked rezervacije |
| 6 | Dodan `CHECK` constraint na `event_tiers` za oversell zaštitu | Baza odbija prodaju preko limita |
| 7 | Dodana `reservation_expiry` logika (48h za standalone) | Automatsko oslobađanje stolova |
| 8 | Dodan trigger za automatski cancel reservacije pri ticket cancellationu | Konzistencija ticket↔reservation lifecycle |
| 9 | Dodan trigger za auto-reject preklapajućih tentative slotova | Kad se jedan upit potvrdi, ostali se automatski odbijaju |
| 10 | Dodana `swap_table_reservation()` funkcija | Atomični swap stola u jednoj transakciji |

---

## Arhitekturne odluke (ažurirane)

1. **`events` + `event_occurrences`** — event je "definicija", occurrence je "izvedba" (datum, prostor, kapacitet, cijene)
2. **`bundle_types` + `ticket_bundles`** — multi-day paketi definirani na event razini, s vlastitim pricingom neovisnim o sumi pojedinačnih karata
3. **`venue_items`** — unificiran entitet za sjedala i stolove; koordinate u JSON fajlu, DB čuva logičku strukturu i statuse
4. **`organizations`** kao centralni entitet — payment gatewayi, payment orderi i member roles vežu se na org, ne na usera
5. **`payment_orders`** kao nalog za plaćanje — sustav generira nalog, organizator plaća vlasniku izravno
6. **`venue_availability`** — exclusion constraint sprečava preklapanje SAMO za confirmed bookinge; tentative/pending mogu koegzistirati
7. **`table_reservations`** — odvojena tablica od ticketa, podržava standalone, manual i ticket-linked rezervacije
8. **`sold_count` triggeri** — PostgreSQL funkcija atomično ažurira tier, package i occurrence countere pri svakoj promjeni ticket statusa
9. **Payment credentials** — NIKAD u bazi; samo `config` (webhook URL-ovi, valuta, display settings) u JSONB polju; API ključevi u `.env`

---

## SQL Shema

```sql
-- ============================================================
-- NOIR — Database Schema v2.0
-- Supabase (PostgreSQL) | Ožujak 2026.
-- ============================================================
-- CHANGELOG od v1.0:
--   [NEW]     = nova tablica/objekt
--   [CHANGED] = modificirana tablica
-- ============================================================

-- Potrebne ekstenzije
CREATE EXTENSION IF NOT EXISTS btree_gist;
CREATE EXTENSION IF NOT EXISTS pgcrypto;


-- ============================================================
-- 1. PLATFORM ROLES (Admin sloj)
-- ============================================================

CREATE TYPE platform_role AS ENUM ('super_admin', 'support', 'finance_admin');

CREATE TABLE user_platform_roles (
    user_id     UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    role        platform_role NOT NULL,
    granted_by  UUID REFERENCES auth.users(id),
    granted_at  TIMESTAMPTZ DEFAULT NOW()
);


-- ============================================================
-- 2. PROFILI & KORISNIČKE PREFERENCIJE
-- ============================================================

CREATE TABLE profiles (
    id             UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    full_name      VARCHAR(255),
    avatar_url     TEXT,
    date_of_birth  DATE,
    phone          VARCHAR(50),
    city           VARCHAR(100),
    created_at     TIMESTAMPTZ DEFAULT NOW(),
    updated_at     TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE user_preferences (
    user_id         UUID PRIMARY KEY REFERENCES profiles(id) ON DELETE CASCADE,
    interest_tags   TEXT[]       DEFAULT '{}',
    preferred_days  INT[]        DEFAULT '{}',   -- 0=Ned ... 6=Sub
    price_cap       DECIMAL(8,2),
    updated_at      TIMESTAMPTZ  DEFAULT NOW()
);


-- ============================================================
-- 3. ORGANIZACIJE & ČLANOVI
-- ============================================================

CREATE TYPE org_type AS ENUM ('organizer', 'venue_owner', 'both');

CREATE TABLE organizations (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name                VARCHAR(255) NOT NULL,
    slug                VARCHAR(100) UNIQUE NOT NULL,
    org_type            org_type    NOT NULL,
    logo_url            TEXT,
    description         TEXT,
    contact_email       VARCHAR(255),
    contact_phone       VARCHAR(50),
    website             VARCHAR(255),
    tax_id              VARCHAR(100),
    bank_account_iban   VARCHAR(50),
    bank_account_name   VARCHAR(255),
    address             TEXT,
    city                VARCHAR(100),
    country             VARCHAR(2)   DEFAULT 'HR',
    is_verified         BOOLEAN      DEFAULT FALSE,
    is_active           BOOLEAN      DEFAULT TRUE,
    created_at          TIMESTAMPTZ  DEFAULT NOW(),
    updated_at          TIMESTAMPTZ  DEFAULT NOW()
);

CREATE TYPE org_member_role AS ENUM (
    'owner', 'admin', 'manager', 'staff', 'door_staff', 'bar_staff'
);

CREATE TABLE organization_members (
    id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id       UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    user_id      UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    role         org_member_role NOT NULL DEFAULT 'staff',
    invited_by   UUID REFERENCES auth.users(id),
    invited_at   TIMESTAMPTZ DEFAULT NOW(),
    joined_at    TIMESTAMPTZ,
    is_active    BOOLEAN DEFAULT TRUE,
    UNIQUE(org_id, user_id)
);


-- ============================================================
-- 4. PAYMENT GATEWAYI (po organizaciji) [CHANGED]
-- ============================================================
-- v2: Uklonjeno 'credentials' polje.
-- API ključevi ISKLJUČIVO u .env varijablama:
--   STRIPE_SECRET_KEY_ORG_{org_id}=sk_live_...
--   MONRI_KEY_ORG_{org_id}=...
-- U bazi ostaje samo nesenzitivna konfiguracija.

CREATE TYPE gateway_type AS ENUM (
    'stripe', 'paypal', 'monri', 'wspay', 'keks_pay', 'bank_transfer', 'cash'
);

CREATE TABLE payment_gateways (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id        UUID REFERENCES organizations(id) ON DELETE CASCADE,
    gateway_type  gateway_type NOT NULL,
    display_name  VARCHAR(100),
    is_active     BOOLEAN DEFAULT TRUE,
    is_default    BOOLEAN DEFAULT FALSE,
    config        JSONB NOT NULL DEFAULT '{}',
    -- Primjeri config po tipu:
    -- stripe:        {"webhook_url":"...","currency":"EUR","statement_descriptor":"NOIR"}
    -- bank_transfer: {"bank_name":"PBZ","iban_display":"HR12...***89","reference_prefix":"NOIR-"}
    -- monri:         {"webhook_url":"...","currency":"EUR","merchant_name":"Noir"}
    created_by    UUID REFERENCES auth.users(id),
    created_at    TIMESTAMPTZ DEFAULT NOW(),
    updated_at    TIMESTAMPTZ DEFAULT NOW()
);


-- ============================================================
-- 5. TAGOVI
-- ============================================================

CREATE TABLE tags (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name        VARCHAR(100) UNIQUE NOT NULL,
    slug        VARCHAR(100) UNIQUE NOT NULL,
    category    VARCHAR(50),
    is_active   BOOLEAN DEFAULT TRUE
);


-- ============================================================
-- 6. VENUES (prostori)
-- ============================================================

CREATE TYPE venue_type AS ENUM (
    'club', 'bar', 'concert_hall', 'outdoor', 'sports_arena',
    'theater', 'restaurant', 'rooftop', 'other'
);

CREATE TABLE venues (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id              UUID NOT NULL REFERENCES organizations(id) ON DELETE RESTRICT,
    name                VARCHAR(255) NOT NULL,
    slug                VARCHAR(100) UNIQUE NOT NULL,
    venue_type          venue_type NOT NULL,
    description         TEXT,
    address             TEXT NOT NULL,
    city                VARCHAR(100) NOT NULL,
    country             VARCHAR(2)  DEFAULT 'HR',
    lat                 DECIMAL(10,8),
    lng                 DECIMAL(11,8),
    total_capacity      INT,
    photos              TEXT[]  DEFAULT '{}',
    amenities           JSONB,
    layout_file_path    VARCHAR(500),
    layout_version      INT DEFAULT 1,
    is_active           BOOLEAN DEFAULT TRUE,
    created_at          TIMESTAMPTZ DEFAULT NOW(),
    updated_at          TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE venue_tags (
    venue_id  UUID REFERENCES venues(id) ON DELETE CASCADE,
    tag_id    UUID REFERENCES tags(id)   ON DELETE CASCADE,
    PRIMARY KEY (venue_id, tag_id)
);


-- ============================================================
-- 7. VENUE SEKCIJE & STAVKE (tlocrt — logički sloj)
-- ============================================================

CREATE TYPE section_type AS ENUM (
    'standing', 'seated', 'table_area', 'vip_lounge', 'vip_table', 'stage', 'other'
);

CREATE TABLE venue_sections (
    id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    venue_id         UUID NOT NULL REFERENCES venues(id) ON DELETE CASCADE,
    name             VARCHAR(100) NOT NULL,
    section_type     section_type NOT NULL,
    is_numbered      BOOLEAN NOT NULL DEFAULT FALSE,
    default_capacity INT NOT NULL,
    sort_order       INT DEFAULT 0,
    json_id          VARCHAR(100),
    description      TEXT,
    is_active        BOOLEAN DEFAULT TRUE
);

CREATE TYPE item_type AS ENUM ('seat', 'table');

CREATE TABLE venue_items (
    id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    section_id   UUID NOT NULL REFERENCES venue_sections(id) ON DELETE CASCADE,
    item_type    item_type NOT NULL,
    identifier   VARCHAR(50) NOT NULL,
    row_label    VARCHAR(20),
    seat_number  INT,
    capacity     INT NOT NULL DEFAULT 1,
    json_id      VARCHAR(100),
    is_active    BOOLEAN DEFAULT TRUE,
    UNIQUE(section_id, identifier)
);


-- ============================================================
-- 8. VENUE UVJETI NAJMA
-- ============================================================

CREATE TYPE rental_pricing_model AS ENUM (
    'fixed', 'revenue_share', 'hybrid', 'free', 'negotiable'
);

CREATE TABLE venue_rental_terms (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    venue_id            UUID NOT NULL REFERENCES venues(id) ON DELETE CASCADE,
    name                VARCHAR(100),
    pricing_model       rental_pricing_model NOT NULL,
    fixed_amount        DECIMAL(10,2),
    fixed_currency      VARCHAR(3)  DEFAULT 'EUR',
    revenue_share_pct   DECIMAL(5,2),
    revenue_base        VARCHAR(50),
    min_guarantee       DECIMAL(10,2),
    applies_to_days     INT[],
    notes               TEXT,
    is_default          BOOLEAN DEFAULT FALSE,
    is_active           BOOLEAN DEFAULT TRUE,
    created_at          TIMESTAMPTZ DEFAULT NOW()
);


-- ============================================================
-- 9. EVENTI (definicija)
-- ============================================================

CREATE TYPE event_status AS ENUM (
    'draft', 'pending_venue', 'venue_confirmed', 'published', 'cancelled', 'completed'
);

CREATE TABLE events (
    id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organizer_org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE RESTRICT,
    name             VARCHAR(255) NOT NULL,
    slug             VARCHAR(255) UNIQUE NOT NULL,
    description      TEXT,
    cover_image_url  TEXT,
    min_age          INT DEFAULT 0,
    is_free          BOOLEAN DEFAULT FALSE,
    status           event_status NOT NULL DEFAULT 'draft',
    created_by       UUID REFERENCES auth.users(id),
    created_at       TIMESTAMPTZ DEFAULT NOW(),
    updated_at       TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE event_tags (
    event_id  UUID REFERENCES events(id) ON DELETE CASCADE,
    tag_id    UUID REFERENCES tags(id)   ON DELETE CASCADE,
    PRIMARY KEY (event_id, tag_id)
);


-- ============================================================
-- 10. VENUE UPITI (inquiry flow)
-- ============================================================

CREATE TYPE inquiry_status AS ENUM (
    'draft', 'sent', 'under_review', 'terms_proposed',
    'organizer_reviewing', 'accepted', 'rejected', 'cancelled', 'expired'
);

CREATE TABLE venue_inquiries (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    event_id            UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
    organizer_org_id    UUID NOT NULL REFERENCES organizations(id),
    venue_id            UUID NOT NULL REFERENCES venues(id),
    venue_owner_org_id  UUID NOT NULL REFERENCES organizations(id),
    message             TEXT,
    status              inquiry_status NOT NULL DEFAULT 'draft',
    expires_at          TIMESTAMPTZ,
    created_by          UUID REFERENCES auth.users(id),
    created_at          TIMESTAMPTZ DEFAULT NOW(),
    updated_at          TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE venue_inquiry_dates (
    id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    inquiry_id       UUID NOT NULL REFERENCES venue_inquiries(id) ON DELETE CASCADE,
    occurrence_date  DATE NOT NULL,
    start_time       TIME NOT NULL,
    end_time         TIME NOT NULL,
    notes            TEXT,
    is_available     BOOLEAN,
    sort_order       INT DEFAULT 0
);

CREATE TYPE inquiry_response_type AS ENUM (
    'accepted', 'rejected', 'counter_proposal', 'info_request'
);

CREATE TABLE venue_inquiry_responses (
    id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    inquiry_id        UUID NOT NULL REFERENCES venue_inquiries(id) ON DELETE CASCADE,
    responder_user_id UUID REFERENCES auth.users(id),
    responder_org_id  UUID REFERENCES organizations(id),
    response_type     inquiry_response_type NOT NULL,
    message           TEXT,
    proposed_terms    JSONB,
    created_at        TIMESTAMPTZ DEFAULT NOW()
);


-- ============================================================
-- 11. EVENT OCCURRENCES (izvedbe)
-- ============================================================

CREATE TYPE occurrence_status AS ENUM (
    'scheduled', 'on_sale', 'sold_out', 'cancelled', 'completed'
);

CREATE TABLE event_occurrences (
    id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    event_id                UUID NOT NULL REFERENCES events(id) ON DELETE RESTRICT,
    venue_id                UUID NOT NULL REFERENCES venues(id),
    inquiry_id              UUID REFERENCES venue_inquiries(id),
    occurrence_date         DATE NOT NULL,
    doors_time              TIME,
    start_time              TIME NOT NULL,
    end_time                TIME,
    status                  occurrence_status NOT NULL DEFAULT 'scheduled',
    total_capacity          INT,
    sold_count              INT DEFAULT 0,
    notes                   TEXT,
    rental_terms_snapshot   JSONB,
    created_at              TIMESTAMPTZ DEFAULT NOW(),
    updated_at              TIMESTAMPTZ DEFAULT NOW()
);


-- ============================================================
-- 12. VENUE AVAILABILITY [CHANGED]
-- ============================================================
-- v2: Koristi tstzrange + exclusion constraint.
-- KLJUČNO: Exclusion se primjenjuje SAMO na confirmed ('blocked') bookinge.
-- Nepotvrđeni upiti ('tentative') mogu koegzistirati za isti termin.
-- Kad se jedan upit prihvati (status -> 'blocked'), trigger
-- automatski rejecta sve preklapajuće tentative zapise.

CREATE TABLE venue_availability (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    venue_id      UUID NOT NULL REFERENCES venues(id) ON DELETE CASCADE,
    date          DATE NOT NULL,
    time_range    TSTZRANGE NOT NULL,
    status        VARCHAR(20) NOT NULL DEFAULT 'tentative',
    -- 'tentative' = upit poslan, čeka potvrdu (DOPUŠTA preklapanje)
    -- 'blocked'   = potvrđeno (ZABRANJUJE preklapanje)
    -- 'available' = eksplicitno označeno slobodnim
    -- 'rejected'  = automatski odbijeno jer je drugi upit potvrđen
    occurrence_id UUID REFERENCES event_occurrences(id),
    inquiry_id    UUID REFERENCES venue_inquiries(id),
    created_at    TIMESTAMPTZ DEFAULT NOW()
);

-- Exclusion constraint SAMO za blocked (confirmed) slotove.
-- Tentative slotovi mogu se preklapati koliko god treba.
ALTER TABLE venue_availability
    ADD CONSTRAINT excl_venue_no_overlap_blocked
    EXCLUDE USING gist (
        venue_id WITH =,
        time_range WITH &&
    ) WHERE (status = 'blocked');


-- ============================================================
-- 13. TIEROVI & PAKETI PO IZVEDBI [CHANGED]
-- ============================================================
-- v2: Dodan CHECK constraint za oversell zaštitu.
-- Frontend čita: ako sold_count >= total_count -> prikazuje "Sold Out".
-- Kad se netko refunda, sold_count se smanji i tier je opet kupljiv.

CREATE TABLE event_tiers (
    id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    occurrence_id           UUID NOT NULL REFERENCES event_occurrences(id) ON DELETE CASCADE,
    name                    VARCHAR(100) NOT NULL,
    description             TEXT,
    price                   DECIMAL(10,2) NOT NULL DEFAULT 0,
    currency                VARCHAR(3) DEFAULT 'EUR',
    total_count             INT NOT NULL,
    sold_count              INT DEFAULT 0,
    tier_order              INT NOT NULL DEFAULT 1,
    sale_start              TIMESTAMPTZ,
    sale_end                TIMESTAMPTZ,
    applicable_section_ids  UUID[],
    is_active               BOOLEAN DEFAULT TRUE,
    created_at              TIMESTAMPTZ DEFAULT NOW(),

    CONSTRAINT chk_tier_not_oversold CHECK (sold_count <= total_count),
    CONSTRAINT chk_sold_count_non_negative CHECK (sold_count >= 0)
);

CREATE TABLE occurrence_packages (
    id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    occurrence_id    UUID NOT NULL REFERENCES event_occurrences(id) ON DELETE CASCADE,
    name             VARCHAR(100) NOT NULL,
    description      TEXT,
    price            DECIMAL(10,2) NOT NULL DEFAULT 0,
    currency         VARCHAR(3)  DEFAULT 'EUR',
    includes_entry   BOOLEAN DEFAULT TRUE,
    includes_drinks  INT DEFAULT 0,
    includes_table   BOOLEAN DEFAULT FALSE,
    items            JSONB,
    max_quantity     INT,
    sold_count       INT DEFAULT 0,
    is_active        BOOLEAN DEFAULT TRUE,
    created_at       TIMESTAMPTZ DEFAULT NOW(),

    CONSTRAINT chk_package_not_oversold CHECK (
        max_quantity IS NULL OR sold_count <= max_quantity
    ),
    CONSTRAINT chk_pkg_sold_non_negative CHECK (sold_count >= 0)
);


-- ============================================================
-- 14. BUNDLE TYPES & TICKET BUNDLES [NEW]
-- ============================================================
-- Organizator definira bundle tipove na razini EVENTA.
-- Bundle ima VLASTITI pricing (nije suma pojedinačnih karata).
-- Kupnja bundlea kreira 1 ticket_bundle + N ticketa (jedan po occurrence).

CREATE TABLE bundle_types (
    id                       UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    event_id                 UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
    name                     VARCHAR(100) NOT NULL,
    description              TEXT,
    price                    DECIMAL(10,2) NOT NULL,
    currency                 VARCHAR(3) DEFAULT 'EUR',
    total_count              INT NOT NULL,
    sold_count               INT DEFAULT 0,
    included_occurrence_ids  UUID[] NOT NULL,
    -- npr: ['occ-uuid-petak', 'occ-uuid-subota', 'occ-uuid-nedjelja']
    includes_drinks          INT DEFAULT 0,       -- po izvedbi
    includes_table           BOOLEAN DEFAULT FALSE,
    items                    JSONB,
    sale_start               TIMESTAMPTZ,
    sale_end                 TIMESTAMPTZ,
    is_active                BOOLEAN DEFAULT TRUE,
    created_at               TIMESTAMPTZ DEFAULT NOW(),

    CONSTRAINT chk_bundle_not_oversold CHECK (sold_count <= total_count),
    CONSTRAINT chk_bundle_sold_non_negative CHECK (sold_count >= 0)
);

CREATE TYPE bundle_status AS ENUM (
    'pending_payment', 'active', 'partially_used',
    'fully_used', 'cancelled', 'refunded'
);

CREATE TABLE ticket_bundles (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    bundle_type_id  UUID NOT NULL REFERENCES bundle_types(id),
    event_id        UUID NOT NULL REFERENCES events(id),
    user_id         UUID REFERENCES auth.users(id),
    purchase_email  VARCHAR(255),
    total_price     DECIMAL(10,2) NOT NULL,
    currency        VARCHAR(3) DEFAULT 'EUR',
    status          bundle_status NOT NULL DEFAULT 'pending_payment',
    qr_token        VARCHAR(255) UNIQUE,
    purchased_at    TIMESTAMPTZ,
    created_at      TIMESTAMPTZ DEFAULT NOW(),
    updated_at      TIMESTAMPTZ DEFAULT NOW()
);


-- ============================================================
-- 15. ULAZNICE (tickets) [CHANGED]
-- ============================================================
-- v2: Dodan bundle_id za multi-day pakete.

CREATE TYPE ticket_status AS ENUM (
    'reserved', 'pending_payment', 'active', 'scanned',
    'cancelled', 'refunded', 'expired'
);

CREATE TABLE tickets (
    id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    occurrence_id    UUID NOT NULL REFERENCES event_occurrences(id),
    user_id          UUID REFERENCES auth.users(id),
    purchase_email   VARCHAR(255),
    tier_id          UUID NOT NULL REFERENCES event_tiers(id),
    package_id       UUID REFERENCES occurrence_packages(id),
    bundle_id        UUID REFERENCES ticket_bundles(id),   -- [NEW] NULL za standalone
    item_id          UUID REFERENCES venue_items(id),
    section_id       UUID REFERENCES venue_sections(id),
    qr_token         VARCHAR(255) UNIQUE NOT NULL,
    qr_refreshed_at  TIMESTAMPTZ DEFAULT NOW(),
    status           ticket_status NOT NULL DEFAULT 'pending_payment',
    remaining_drinks INT DEFAULT 0,
    scanned_at       TIMESTAMPTZ,
    scanned_by       UUID REFERENCES auth.users(id),
    cancelled_at     TIMESTAMPTZ,
    purchased_at     TIMESTAMPTZ,
    created_at       TIMESTAMPTZ DEFAULT NOW(),
    updated_at       TIMESTAMPTZ DEFAULT NOW()
);

CREATE TYPE item_availability AS ENUM (
    'available', 'reserved', 'sold', 'blocked', 'unavailable'
);

CREATE TABLE occurrence_item_status (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    occurrence_id   UUID NOT NULL REFERENCES event_occurrences(id) ON DELETE CASCADE,
    item_id         UUID NOT NULL REFERENCES venue_items(id) ON DELETE CASCADE,
    status          item_availability NOT NULL DEFAULT 'available',
    ticket_id       UUID REFERENCES tickets(id),
    reserved_until  TIMESTAMPTZ,
    updated_at      TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(occurrence_id, item_id)
);


-- ============================================================
-- 16. TABLE RESERVATIONS [NEW]
-- ============================================================
-- Odvojena tablica od ticketa. Tri source tipa:
--   ticket_purchase  -> automatski uz paket koji uključuje stol
--   manual_booking   -> vlasnik ručno blokira (VIP bez ticketa)
--   standalone       -> korisnik rezervira stol bez karte
--
-- 48h expiry: standalone rezervacije za evente s ulaznicama
-- istječu ako korisnik ne kupi kartu unutar 48h.

CREATE TYPE reservation_status AS ENUM (
    'pending', 'confirmed', 'cancelled', 'no_show', 'completed', 'expired'
);

CREATE TYPE reservation_source AS ENUM (
    'ticket_purchase', 'manual_booking', 'standalone'
);

CREATE TABLE table_reservations (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    occurrence_id   UUID NOT NULL REFERENCES event_occurrences(id),
    item_id         UUID NOT NULL REFERENCES venue_items(id),
    user_id         UUID REFERENCES auth.users(id),
    ticket_id       UUID REFERENCES tickets(id),
    bundle_id       UUID REFERENCES ticket_bundles(id),
    source          reservation_source NOT NULL,
    guest_name      VARCHAR(255),
    guest_count     INT DEFAULT 1,
    notes           TEXT,
    status          reservation_status NOT NULL DEFAULT 'pending',
    expires_at      TIMESTAMPTZ,
    -- Lifecycle timestamps
    reserved_at     TIMESTAMPTZ DEFAULT NOW(),
    confirmed_at    TIMESTAMPTZ,
    cancelled_at    TIMESTAMPTZ,
    cancelled_by    UUID REFERENCES auth.users(id),
    created_at      TIMESTAMPTZ DEFAULT NOW(),
    updated_at      TIMESTAMPTZ DEFAULT NOW()
);

-- Samo JEDNA aktivna rezervacija po stolu po izvedbi
CREATE UNIQUE INDEX idx_one_active_reservation_per_item
    ON table_reservations(occurrence_id, item_id)
    WHERE status IN ('pending', 'confirmed');


-- ============================================================
-- 17. TRANSAKCIJE & PAYMENT ORDERI
-- ============================================================

CREATE TYPE transaction_status AS ENUM (
    'pending', 'completed', 'failed', 'refunded', 'disputed'
);

CREATE TABLE transactions (
    id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    ticket_id          UUID REFERENCES tickets(id),
    bundle_id          UUID REFERENCES ticket_bundles(id),
    -- Jedno od dvoje mora biti NOT NULL (app-level validacija)
    user_id            UUID REFERENCES auth.users(id),
    gateway_id         UUID REFERENCES payment_gateways(id),
    gateway_payment_id VARCHAR(255),
    amount             DECIMAL(10,2) NOT NULL,
    currency           VARCHAR(3) DEFAULT 'EUR',
    platform_fee       DECIMAL(10,2),
    status             transaction_status NOT NULL DEFAULT 'pending',
    metadata           JSONB,
    created_at         TIMESTAMPTZ DEFAULT NOW(),
    updated_at         TIMESTAMPTZ DEFAULT NOW()
);

CREATE TYPE payment_order_status AS ENUM (
    'draft', 'issued', 'paid', 'overdue', 'disputed', 'cancelled', 'waived'
);

CREATE TABLE payment_orders (
    id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    occurrence_id        UUID NOT NULL REFERENCES event_occurrences(id),
    from_org_id          UUID NOT NULL REFERENCES organizations(id),
    to_org_id            UUID NOT NULL REFERENCES organizations(id),
    amount               DECIMAL(10,2) NOT NULL,
    currency             VARCHAR(3) DEFAULT 'EUR',
    calculation_details  JSONB,
    due_date             DATE,
    status               payment_order_status NOT NULL DEFAULT 'draft',
    payment_reference    VARCHAR(100),
    proof_url            TEXT,
    notes                TEXT,
    issued_at            TIMESTAMPTZ,
    paid_at              TIMESTAMPTZ,
    issued_by            UUID REFERENCES auth.users(id),
    created_at           TIMESTAMPTZ DEFAULT NOW(),
    updated_at           TIMESTAMPTZ DEFAULT NOW()
);


-- ============================================================
-- 18. TRIGGERI [NEW]
-- ============================================================

-- ---------------------------------------------------------
-- TRIGGER 1: sold_count sinkronizacija (tickets)
-- ---------------------------------------------------------
-- Atomično ažurira tier, package i occurrence sold_count
-- pri svakoj promjeni ticket statusa.

CREATE OR REPLACE FUNCTION update_sold_counts()
RETURNS TRIGGER AS $$
BEGIN
    -- Aktivacija: ticket postaje 'active'
    IF NEW.status = 'active' AND (OLD IS NULL OR OLD.status != 'active') THEN
        UPDATE event_tiers
        SET    sold_count = sold_count + 1
        WHERE  id = NEW.tier_id;

        IF NEW.package_id IS NOT NULL THEN
            UPDATE occurrence_packages
            SET    sold_count = sold_count + 1
            WHERE  id = NEW.package_id;
        END IF;

        UPDATE event_occurrences
        SET    sold_count = sold_count + 1
        WHERE  id = NEW.occurrence_id;
    END IF;

    -- Deaktivacija: ticket se otkazuje ili refundira
    IF NEW.status IN ('cancelled', 'refunded')
       AND OLD IS NOT NULL
       AND OLD.status = 'active' THEN
        UPDATE event_tiers
        SET    sold_count = GREATEST(sold_count - 1, 0)
        WHERE  id = NEW.tier_id;

        IF NEW.package_id IS NOT NULL THEN
            UPDATE occurrence_packages
            SET    sold_count = GREATEST(sold_count - 1, 0)
            WHERE  id = NEW.package_id;
        END IF;

        UPDATE event_occurrences
        SET    sold_count = GREATEST(sold_count - 1, 0)
        WHERE  id = NEW.occurrence_id;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_ticket_sold_counts
    AFTER INSERT OR UPDATE OF status ON tickets
    FOR EACH ROW
    EXECUTE FUNCTION update_sold_counts();


-- ---------------------------------------------------------
-- TRIGGER 2: bundle_type sold_count sinkronizacija
-- ---------------------------------------------------------

CREATE OR REPLACE FUNCTION update_bundle_type_sold_count()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.status = 'active' AND (OLD IS NULL OR OLD.status != 'active') THEN
        UPDATE bundle_types
        SET    sold_count = sold_count + 1
        WHERE  id = NEW.bundle_type_id;
    END IF;

    IF NEW.status IN ('cancelled', 'refunded')
       AND OLD IS NOT NULL
       AND OLD.status = 'active' THEN
        UPDATE bundle_types
        SET    sold_count = GREATEST(sold_count - 1, 0)
        WHERE  id = NEW.bundle_type_id;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_bundle_sold_counts
    AFTER INSERT OR UPDATE OF status ON ticket_bundles
    FOR EACH ROW
    EXECUTE FUNCTION update_bundle_type_sold_count();


-- ---------------------------------------------------------
-- TRIGGER 3: Auto-cancel reservation kad se ticket otkaže
-- ---------------------------------------------------------

CREATE OR REPLACE FUNCTION auto_cancel_reservation_on_ticket()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.status IN ('cancelled', 'refunded')
       AND OLD.status = 'active' THEN
        UPDATE table_reservations
        SET    status = 'cancelled',
               cancelled_at = NOW(),
               updated_at = NOW()
        WHERE  ticket_id = NEW.id
               AND status IN ('pending', 'confirmed');

        -- Oslobodi stol u occurrence_item_status
        UPDATE occurrence_item_status
        SET    status = 'available',
               ticket_id = NULL,
               updated_at = NOW()
        WHERE  ticket_id = NEW.id;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_cancel_reservation_on_ticket_cancel
    AFTER UPDATE OF status ON tickets
    FOR EACH ROW
    EXECUTE FUNCTION auto_cancel_reservation_on_ticket();


-- ---------------------------------------------------------
-- TRIGGER 4: Auto-reject overlapping tentative on confirm
-- ---------------------------------------------------------
-- Kad se venue_availability status promijeni u 'blocked',
-- svi preklapajući tentative slotovi postaju 'rejected'.
-- Povezani inquiries također dobivaju status 'rejected'.

CREATE OR REPLACE FUNCTION reject_overlapping_tentative()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.status = 'blocked' AND (OLD IS NULL OR OLD.status != 'blocked') THEN
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

CREATE TRIGGER trg_reject_overlapping_on_confirm
    AFTER UPDATE OF status ON venue_availability
    FOR EACH ROW
    EXECUTE FUNCTION reject_overlapping_tentative();


-- ============================================================
-- 19. FUNKCIJE [NEW]
-- ============================================================

-- ---------------------------------------------------------
-- FUNCTION: Atomični table swap
-- ---------------------------------------------------------
-- Mijenja stol za postojeću rezervaciju u jednoj transakciji.

CREATE OR REPLACE FUNCTION swap_table_reservation(
    p_reservation_id UUID,
    p_new_item_id UUID,
    p_user_id UUID
) RETURNS UUID AS $$
DECLARE
    v_old_rec table_reservations%ROWTYPE;
    v_new_reservation_id UUID;
BEGIN
    -- Zaključaj postojeću rezervaciju
    SELECT * INTO v_old_rec
    FROM table_reservations
    WHERE id = p_reservation_id
          AND status IN ('pending', 'confirmed')
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Reservation not found or not active';
    END IF;

    -- Provjeri je li novi stol slobodan
    IF EXISTS (
        SELECT 1 FROM table_reservations
        WHERE occurrence_id = v_old_rec.occurrence_id
              AND item_id = p_new_item_id
              AND status IN ('pending', 'confirmed')
    ) THEN
        RAISE EXCEPTION 'Target table is not available';
    END IF;

    -- Cancel staru rezervaciju
    UPDATE table_reservations
    SET    status = 'cancelled',
           cancelled_at = NOW(),
           cancelled_by = p_user_id,
           updated_at = NOW()
    WHERE  id = p_reservation_id;

    -- Oslobodi stari stol
    UPDATE occurrence_item_status
    SET    status = 'available',
           ticket_id = NULL,
           updated_at = NOW()
    WHERE  occurrence_id = v_old_rec.occurrence_id
           AND item_id = v_old_rec.item_id;

    -- Kreiraj novu rezervaciju
    INSERT INTO table_reservations (
        occurrence_id, item_id, user_id, ticket_id, bundle_id,
        source, guest_name, guest_count, notes, status,
        expires_at, confirmed_at
    ) VALUES (
        v_old_rec.occurrence_id, p_new_item_id, v_old_rec.user_id,
        v_old_rec.ticket_id, v_old_rec.bundle_id,
        v_old_rec.source, v_old_rec.guest_name, v_old_rec.guest_count,
        v_old_rec.notes, v_old_rec.status,
        v_old_rec.expires_at, v_old_rec.confirmed_at
    ) RETURNING id INTO v_new_reservation_id;

    -- Blokiraj novi stol
    INSERT INTO occurrence_item_status (occurrence_id, item_id, status, ticket_id)
    VALUES (v_old_rec.occurrence_id, p_new_item_id, 'reserved', v_old_rec.ticket_id)
    ON CONFLICT (occurrence_id, item_id)
    DO UPDATE SET status = 'reserved',
                  ticket_id = v_old_rec.ticket_id,
                  updated_at = NOW();

    RETURN v_new_reservation_id;
END;
$$ LANGUAGE plpgsql;


-- ---------------------------------------------------------
-- FUNCTION: Expire standalone reservations (48h)
-- ---------------------------------------------------------
-- Poziva se periodično (pg_cron svakih 5 min).

CREATE OR REPLACE FUNCTION expire_standalone_reservations()
RETURNS INT AS $$
DECLARE
    v_expired_count INT;
BEGIN
    WITH expired AS (
        UPDATE table_reservations
        SET    status = 'expired',
               updated_at = NOW()
        WHERE  source = 'standalone'
               AND status = 'pending'
               AND expires_at IS NOT NULL
               AND expires_at < NOW()
        RETURNING occurrence_id, item_id
    )
    UPDATE occurrence_item_status ois
    SET    status = 'available',
           ticket_id = NULL,
           reserved_until = NULL,
           updated_at = NOW()
    FROM   expired e
    WHERE  ois.occurrence_id = e.occurrence_id
           AND ois.item_id = e.item_id;

    GET DIAGNOSTICS v_expired_count = ROW_COUNT;
    RETURN v_expired_count;
END;
$$ LANGUAGE plpgsql;

-- Setup pg_cron (run in Supabase SQL Editor):
-- SELECT cron.schedule(
--     'expire-standalone-reservations',
--     '*/5 * * * *',
--     'SELECT expire_standalone_reservations()'
-- );


-- ============================================================
-- 20. INDEKSI
-- ============================================================

-- Events
CREATE INDEX idx_events_org              ON events(organizer_org_id);
CREATE INDEX idx_events_status           ON events(status);

-- Occurrences
CREATE INDEX idx_occurrences_event       ON event_occurrences(event_id);
CREATE INDEX idx_occurrences_venue       ON event_occurrences(venue_id);
CREATE INDEX idx_occurrences_date        ON event_occurrences(occurrence_date);

-- Tickets
CREATE INDEX idx_tickets_occurrence      ON tickets(occurrence_id);
CREATE INDEX idx_tickets_user            ON tickets(user_id);
CREATE INDEX idx_tickets_qr              ON tickets(qr_token);
CREATE INDEX idx_tickets_bundle          ON tickets(bundle_id);
CREATE INDEX idx_tickets_status          ON tickets(status);

-- Bundles [NEW]
CREATE INDEX idx_bundle_types_event      ON bundle_types(event_id);
CREATE INDEX idx_bundles_event           ON ticket_bundles(event_id);
CREATE INDEX idx_bundles_user            ON ticket_bundles(user_id);
CREATE INDEX idx_bundles_status          ON ticket_bundles(status);

-- Item statuses
CREATE INDEX idx_item_status_occ         ON occurrence_item_status(occurrence_id, item_id);

-- Organizations
CREATE INDEX idx_org_members_user        ON organization_members(user_id);
CREATE INDEX idx_org_members_org         ON organization_members(org_id);

-- Venues
CREATE INDEX idx_venue_sections          ON venue_sections(venue_id);
CREATE INDEX idx_venue_items             ON venue_items(section_id);

-- Inquiries
CREATE INDEX idx_inquiries_event         ON venue_inquiries(event_id);
CREATE INDEX idx_inquiries_venue         ON venue_inquiries(venue_id);

-- Availability
CREATE INDEX idx_venue_availability      ON venue_availability(venue_id, date);
CREATE INDEX idx_va_status               ON venue_availability(status);

-- Tiers & Packages
CREATE INDEX idx_tiers_occurrence        ON event_tiers(occurrence_id);
CREATE INDEX idx_packages_occurrence     ON occurrence_packages(occurrence_id);

-- Reservations [NEW]
CREATE INDEX idx_reservations_occurrence ON table_reservations(occurrence_id);
CREATE INDEX idx_reservations_item       ON table_reservations(item_id);
CREATE INDEX idx_reservations_user       ON table_reservations(user_id);
CREATE INDEX idx_reservations_status     ON table_reservations(status);
CREATE INDEX idx_reservations_expires    ON table_reservations(expires_at)
    WHERE source = 'standalone' AND status = 'pending';

-- Transactions
CREATE INDEX idx_transactions_ticket     ON transactions(ticket_id);
CREATE INDEX idx_transactions_bundle     ON transactions(bundle_id);
```

---

## Ažurirani Implementation Workflow

```
MILESTONE 1 — Temelj (Tjedan 1-2)
├── DB migracije (cijeli SQL v2)
├── Extensions: btree_gist, pgcrypto
├── Supabase RLS policies po tablicama
├── Seed: tagovi, admin user, platform default gateway
├── pg_cron setup: expire_standalone_reservations() svakih 5 min
└── OUTPUT: funkcionalna baza s triggerima i constraint zaštitom

MILESTONE 2 — Auth + Organizacije (Tjedan 2-3)
├── FastAPI: auth middleware (JWT decode iz Supabase)
├── RBAC helper: get_user_role(user_id, org_id)
├── Endpointi: /auth/*, /organizations/*, /organization-members/*
├── Admin panel: organizations list, user-platform-roles CRUD
└── OUTPUT: prijava radi, RBAC middleware spreman

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
│   ├── TRIGGER automatski rejecta preklapajuće tentative
│   └── Kreira rental_terms_snapshot na occurrence
└── OUTPUT: cijeli B2B flow radi end-to-end

MILESTONE 5 — Ticketing + Bundles (Tjedan 6-8)
├── FastAPI: /occurrences/{id}/tiers CRUD
├── FastAPI: /occurrences/{id}/packages CRUD
├── FastAPI: /events/{id}/bundle-types CRUD                    [NEW]
├── FastAPI: /occurrences/{id}/seat-map — vraća item statuse
├── FastAPI: POST /tickets/purchase
│   ├── Za numerirana mjesta: provjeri + rezerviraj occurrence_item_status
│   ├── Za stajaća: provjeri kapacitet sekcije
│   ├── Generiraj qr_token (UUID + HMAC potpis)
│   ├── TRIGGER automatski ažurira sold_count
│   └── CHECK constraint sprečava oversell
├── FastAPI: POST /bundles/purchase                            [NEW]
│   ├── Kreira ticket_bundle + N ticketa (jedan po occurrence)
│   ├── TRIGGER ažurira bundle_type sold_count
│   └── Stripe checkout session za bundle price
├── Stripe webhook → transaction completed → ticket/bundle active
└── OUTPUT: kupnja ulaznica i bundleova radi

MILESTONE 6 — QR + Reservations + Payment Orders (Tjedan 8-9)
├── FastAPI: GET /tickets/{id}/qr
├── FastAPI: POST /tickets/{id}/scan — idempotent scan
├── FastAPI: POST /tickets/{id}/redeem-drink
├── FastAPI: POST /reservations                                [NEW]
│   ├── standalone: postavlja expires_at = NOW() + 48h
│   ├── ticket_purchase: automatski uz paket
│   └── manual_booking: door_staff/owner kreira
├── FastAPI: POST /reservations/{id}/swap                      [NEW]
│   └── Poziva swap_table_reservation() DB funkciju
├── Cron: expire_standalone_reservations() svakih 5 min        [NEW]
├── FastAPI: POST /payment-orders
└── OUTPUT: QR + reservacije + payment orderi rade

MILESTONE 7 — Analytics + Polish (Tjedan 10-12)
├── FastAPI: /analytics/event/{id} — KPIs
├── FastAPI: /analytics/venue/{id} — top organizatori
├── FastAPI: /analytics/export/{id} — CSV
├── Bundle analytics: revenue po bundle tipu                   [NEW]
└── OUTPUT: dashboardi s realnim podacima
```

---

## JSON fajl struktura (venue builder) — nepromijenjena

```json
{
  "venue_id": "uuid-ovdje",
  "version": 1,
  "canvas": { "width": 1200, "height": 800 },
  "elements": [
    {
      "json_id": "section-floor",
      "type": "section",
      "label": "Pod",
      "shape": "polygon",
      "points": [[100,100],[900,100],[900,600],[100,600]]
    },
    {
      "json_id": "seat-a-1",
      "type": "seat",
      "x": 150, "y": 150,
      "radius": 12,
      "label": "A-1"
    },
    {
      "json_id": "table-t1",
      "type": "table",
      "x": 400, "y": 300,
      "width": 80, "height": 60,
      "label": "T1",
      "shape": "rect"
    },
    {
      "json_id": "stage-main",
      "type": "static_object",
      "label": "Bina",
      "x": 0, "y": 0,
      "width": 1200, "height": 80
    }
  ]
}
```

**Pravilo:** `json_id` u JSON fajlu = `json_id` u `venue_sections` ili `venue_items` tablici.

---

## Branching strategija — nepromijenjena

```
main          ← samo stabilan, deployabilan kod
develop       ← aktivna integracija
feature/*     ← svaki feature zasebna grana
fix/*         ← bugfixevi
```

**PR pravilo:** svaki merge u `develop` mora imati barem jednu API test routu koja prolazi. Merge u `main` samo na kraju milestonea.