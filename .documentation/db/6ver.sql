-- ============================================================
-- NOIR — Database Schema v6.0 (Clean Start)
-- Supabase (PostgreSQL) | Ožujak 2026.
-- ============================================================
-- Kompletna schema — nema legacy tablica ni _v2 sufiksa.
-- Sva dosadašnja arhitekturna znanja konsolidirana.
--
-- PRINCIP: Ovo je JEDINI SQL fajl. Pokreni u Supabase SQL Editoru.
-- ============================================================


-- ############################################################
-- 1. EXTENSIONS
-- ############################################################

CREATE EXTENSION IF NOT EXISTS btree_gist;
CREATE EXTENSION IF NOT EXISTS pgcrypto;


-- ############################################################
-- 2. ENUM TIPOVI
-- ############################################################

-- Auth / Platform
CREATE TYPE platform_role AS ENUM ('super_admin', 'support', 'finance_admin');

-- Organizacije
CREATE TYPE org_member_role AS ENUM (
    'owner', 'admin', 'manager', 'staff', 'door_staff', 'bar_staff'
);

-- Payment
CREATE TYPE gateway_type AS ENUM (
    'stripe', 'paypal', 'monri', 'wspay', 'keks_pay',
    'bank_transfer', 'cash', 'door_sale'
);

-- Venue
CREATE TYPE venue_type AS ENUM (
    'club', 'bar', 'concert_hall', 'outdoor', 'sports_arena',
    'theater', 'restaurant', 'rooftop', 'other'
);
CREATE TYPE venue_visibility AS ENUM ('public', 'private', 'unlisted');
CREATE TYPE section_type AS ENUM (
    'standing', 'seated', 'table_area', 'vip_lounge',
    'vip_table', 'stage', 'other'
);
CREATE TYPE item_type AS ENUM ('seat', 'table');
CREATE TYPE rental_pricing_model AS ENUM (
    'fixed', 'revenue_share', 'hybrid', 'free', 'negotiable'
);

-- Events
CREATE TYPE event_status AS ENUM (
    'draft', 'pending_venue', 'venue_confirmed',
    'published', 'cancelled', 'completed'
);
CREATE TYPE occurrence_status AS ENUM (
    'scheduled', 'on_sale', 'sold_out', 'cancelled', 'completed'
);

-- Inquiries
CREATE TYPE inquiry_status AS ENUM (
    'draft', 'sent', 'under_review', 'terms_proposed',
    'organizer_reviewing', 'accepted', 'rejected',
    'cancelled', 'expired'
);
CREATE TYPE inquiry_response_type AS ENUM (
    'accepted', 'rejected', 'counter_proposal', 'info_request'
);

-- Venue Availability
CREATE TYPE venue_availability_status AS ENUM (
    'tentative', 'blocked', 'available', 'rejected'
);

-- Items / Seats
CREATE TYPE item_availability AS ENUM (
    'available', 'locked', 'reserved', 'sold',
    'blocked', 'unavailable'
);

-- Tickets / Bundles
CREATE TYPE ticket_status AS ENUM (
    'reserved', 'pending_payment', 'active', 'scanned',
    'cancelled', 'refunded', 'expired'
);
CREATE TYPE bundle_status AS ENUM (
    'pending_payment', 'active', 'partially_used',
    'partially_refunded', 'fully_used', 'cancelled', 'refunded'
);

-- Reservations
CREATE TYPE reservation_status AS ENUM (
    'pending', 'confirmed', 'cancelled', 'no_show',
    'completed', 'expired'
);
CREATE TYPE reservation_source AS ENUM (
    'ticket_purchase', 'manual_booking', 'standalone'
);

-- Orders / Transactions
CREATE TYPE order_status AS ENUM (
    'draft', 'pending_payment', 'completed', 'failed',
    'expired', 'partially_refunded', 'refunded',
    'cancelled', 'disputed'
);
CREATE TYPE order_item_type AS ENUM (
    'ticket', 'bundle', 'table_reservation'
);
CREATE TYPE order_item_status AS ENUM (
    'pending', 'active', 'refunded', 'cancelled', 'fulfilled'
);
CREATE TYPE transaction_type AS ENUM (
    'charge', 'refund', 'void', 'dispute', 'dispute_reversal'
);
CREATE TYPE transaction_status AS ENUM (
    'pending', 'completed', 'failed'
);

-- Payment Orders
CREATE TYPE payment_order_status AS ENUM (
    'draft', 'issued', 'paid', 'overdue',
    'disputed', 'cancelled', 'waived'
);

-- Audit
CREATE TYPE audit_action AS ENUM ('INSERT', 'UPDATE', 'DELETE');


-- ############################################################
-- 3. REFERENTNA TABLICA: VALUTE
-- ############################################################

CREATE TABLE supported_currencies (
    code      VARCHAR(3) PRIMARY KEY,  -- ISO 4217
    name      VARCHAR(100) NOT NULL,
    symbol    VARCHAR(10) NOT NULL,
    is_active BOOLEAN DEFAULT TRUE
);

INSERT INTO supported_currencies (code, name, symbol) VALUES
    ('EUR', 'Euro', '€'),
    ('USD', 'US Dollar', '$'),
    ('GBP', 'British Pound', '£'),
    ('HRK', 'Hrvatska kuna (legacy)', 'kn'),
    ('RSD', 'Srpski dinar', 'din.'),
    ('BAM', 'Konvertibilna marka', 'KM');


-- ############################################################
-- 4. AUTH & PROFILI
-- ############################################################

CREATE TABLE user_platform_roles (
    user_id     UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    role        platform_role NOT NULL,
    granted_by  UUID REFERENCES auth.users(id),
    granted_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE profiles (
    id             UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    full_name      VARCHAR(255),
    avatar_url     TEXT,
    date_of_birth  DATE,
    phone          VARCHAR(50),
    city           VARCHAR(100),
    claimed_at     TIMESTAMPTZ,  -- NULL = ghost account
    created_at     TIMESTAMPTZ DEFAULT NOW(),
    updated_at     TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE user_preferences (
    user_id         UUID PRIMARY KEY REFERENCES profiles(id) ON DELETE CASCADE,
    interest_tags   TEXT[]       DEFAULT '{}',
    preferred_days  INT[]        DEFAULT '{}',  -- 0=Ned ... 6=Sub
    price_cap       DECIMAL(8,2),
    updated_at      TIMESTAMPTZ  DEFAULT NOW()
);


-- ############################################################
-- 5. ORGANIZACIJE & ČLANOVI
-- ############################################################

CREATE TABLE organizations (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name                VARCHAR(255) NOT NULL,
    slug                VARCHAR(100) UNIQUE NOT NULL,

    -- Capability flags (zamjenjuju org_type ENUM)
    can_organize        BOOLEAN NOT NULL DEFAULT FALSE,
    can_own_venues      BOOLEAN NOT NULL DEFAULT FALSE,

    -- Valuta
    default_currency    VARCHAR(3) NOT NULL DEFAULT 'EUR'
                        REFERENCES supported_currencies(code),

    -- Profil
    logo_url            TEXT,
    description         TEXT,
    contact_email       VARCHAR(255),
    contact_phone       VARCHAR(50),
    website             VARCHAR(255),

    -- Financije
    tax_id              VARCHAR(100),
    bank_account_iban   VARCHAR(50),
    bank_account_name   VARCHAR(255),

    -- Lokacija
    address             TEXT,
    city                VARCHAR(100),
    country             VARCHAR(2) DEFAULT 'HR',

    -- Status
    is_verified         BOOLEAN DEFAULT FALSE,
    is_active           BOOLEAN DEFAULT TRUE,

    -- Timestamps
    created_at          TIMESTAMPTZ DEFAULT NOW(),
    updated_at          TIMESTAMPTZ DEFAULT NOW(),

    -- Mora imati barem jednu sposobnost
    CONSTRAINT chk_org_has_capability
        CHECK (can_organize OR can_own_venues)
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
    updated_at   TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(org_id, user_id)
);


-- ############################################################
-- 6. PAYMENT GATEWAYI
-- ############################################################
-- API ključevi ISKLJUČIVO u .env varijablama.
-- Baza čuva samo nesenzitivnu konfiguraciju.

CREATE TABLE payment_gateways (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id        UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    gateway_type  gateway_type NOT NULL,
    display_name  VARCHAR(100),
    is_active     BOOLEAN DEFAULT TRUE,
    is_default    BOOLEAN DEFAULT FALSE,
    config        JSONB NOT NULL DEFAULT '{}',
    created_by    UUID REFERENCES auth.users(id),
    created_at    TIMESTAMPTZ DEFAULT NOW(),
    updated_at    TIMESTAMPTZ DEFAULT NOW()
);

-- Samo jedan default gateway po organizaciji
CREATE UNIQUE INDEX idx_one_default_gateway_per_org
    ON payment_gateways(org_id)
    WHERE is_default = TRUE AND is_active = TRUE;


-- ############################################################
-- 7. TAGOVI
-- ############################################################

CREATE TABLE tags (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name        VARCHAR(100) UNIQUE NOT NULL,
    slug        VARCHAR(100) UNIQUE NOT NULL,
    category    VARCHAR(50),
    is_active   BOOLEAN DEFAULT TRUE,
    created_at  TIMESTAMPTZ DEFAULT NOW(),
    updated_at  TIMESTAMPTZ DEFAULT NOW()
);


-- ############################################################
-- 8. VENUES — PROSTORI
-- ############################################################

CREATE TABLE venues (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id              UUID NOT NULL REFERENCES organizations(id) ON DELETE RESTRICT,
    name                VARCHAR(255) NOT NULL,
    slug                VARCHAR(100) UNIQUE NOT NULL,
    venue_type          venue_type NOT NULL,
    visibility          venue_visibility NOT NULL DEFAULT 'public',
    description         TEXT,
    address             TEXT NOT NULL,
    city                VARCHAR(100) NOT NULL,
    country             VARCHAR(2) DEFAULT 'HR',
    lat                 DECIMAL(10,8),
    lng                 DECIMAL(11,8),
    timezone            VARCHAR(50) NOT NULL DEFAULT 'Europe/Zagreb',

    -- Automatski računat iz current layout sekcija
    total_capacity      INT,

    photos              TEXT[] DEFAULT '{}',
    amenities           JSONB,
    is_active           BOOLEAN DEFAULT TRUE,
    created_at          TIMESTAMPTZ DEFAULT NOW(),
    updated_at          TIMESTAMPTZ DEFAULT NOW(),

    -- IANA timezone validacija
    CONSTRAINT chk_valid_timezone
        CHECK (NOW() AT TIME ZONE timezone IS NOT NULL)
);

CREATE TABLE venue_tags (
    venue_id  UUID REFERENCES venues(id) ON DELETE CASCADE,
    tag_id    UUID REFERENCES tags(id)   ON DELETE CASCADE,
    PRIMARY KEY (venue_id, tag_id)
);


-- ############################################################
-- 9. VENUE LAYOUTS — VERZIONIRANJE TLOCRTA
-- ############################################################
-- Svaka verzija layouta ima vlastiti set sekcija i itemova.
-- Occurrence se veže na layout verziju — zamrzava tlocrt.
-- Samo jedan layout smije biti is_current=TRUE po venueu.

CREATE TABLE venue_layouts (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    venue_id        UUID NOT NULL REFERENCES venues(id) ON DELETE CASCADE,
    version         INT NOT NULL,
    file_path       VARCHAR(500) NOT NULL,
    total_capacity  INT,        -- SUM(sekcija) za ovu verziju
    is_current      BOOLEAN NOT NULL DEFAULT TRUE,
    published_at    TIMESTAMPTZ,
    created_by      UUID REFERENCES auth.users(id),
    created_at      TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(venue_id, version)
);

-- Samo jedan current layout po venueu
CREATE UNIQUE INDEX idx_one_current_layout_per_venue
    ON venue_layouts(venue_id)
    WHERE is_current = TRUE;


-- ############################################################
-- 10. VENUE SEKCIJE & STAVKE (logički sloj tlocrta)
-- ############################################################
-- Sekcije i stavke pripadaju LAYOUTU, ne venueu direktno.
-- Vizualne koordinate žive u JSON fajlu na disku.

CREATE TABLE venue_sections (
    id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    layout_id        UUID NOT NULL REFERENCES venue_layouts(id) ON DELETE CASCADE,
    name             VARCHAR(100) NOT NULL,
    section_type     section_type NOT NULL,
    is_numbered      BOOLEAN NOT NULL DEFAULT FALSE,
    default_capacity INT NOT NULL,
    sort_order       INT DEFAULT 0,
    json_id          VARCHAR(100),
    description      TEXT,
    is_active        BOOLEAN DEFAULT TRUE
);

CREATE TABLE venue_items (
    id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    section_id   UUID NOT NULL REFERENCES venue_sections(id) ON DELETE CASCADE,
    item_type    item_type NOT NULL,
    identifier   VARCHAR(50) NOT NULL,    -- "A-5", "T3", "VIP-1"
    row_label    VARCHAR(20),             -- za sjedala: "A", "B"
    seat_number  INT,                     -- za sjedala: 5
    capacity     INT NOT NULL DEFAULT 1,  -- za stolove: broj mjesta
    json_id      VARCHAR(100),
    is_active    BOOLEAN DEFAULT TRUE,
    UNIQUE(section_id, identifier)
);


-- ############################################################
-- 11. VENUE UVJETI NAJMA
-- ############################################################

CREATE TABLE venue_rental_terms (
    id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    venue_id              UUID NOT NULL REFERENCES venues(id) ON DELETE CASCADE,
    name                  VARCHAR(100),
    pricing_model         rental_pricing_model NOT NULL,
    fixed_amount          DECIMAL(10,2),
    fixed_currency        VARCHAR(3) DEFAULT 'EUR'
                          REFERENCES supported_currencies(code),
    revenue_share_pct     DECIMAL(5,2),
    revenue_base          VARCHAR(50),
    min_guarantee         DECIMAL(10,2),
    applies_to_days       INT[],
    notes                 TEXT,
    is_default            BOOLEAN DEFAULT FALSE,
    is_publicly_visible   BOOLEAN DEFAULT FALSE,  -- organizatori vide prije upita
    is_active             BOOLEAN DEFAULT TRUE,
    created_at            TIMESTAMPTZ DEFAULT NOW(),
    updated_at            TIMESTAMPTZ DEFAULT NOW()
);


-- ############################################################
-- 12. EVENTI
-- ############################################################

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


-- ############################################################
-- 13. VENUE UPITI (inquiry flow)
-- ############################################################

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


-- ############################################################
-- 14. EVENT OCCURRENCES
-- ############################################################

CREATE TABLE event_occurrences (
    id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    event_id                UUID NOT NULL REFERENCES events(id) ON DELETE RESTRICT,
    venue_id                UUID NOT NULL REFERENCES venues(id),
    venue_layout_id         UUID NOT NULL REFERENCES venue_layouts(id),
    inquiry_id              UUID REFERENCES venue_inquiries(id),

    -- Vrijeme
    occurrence_date         DATE NOT NULL,
    doors_time              TIME,
    start_time              TIME NOT NULL,
    end_time                TIME,

    -- Status
    status                  occurrence_status NOT NULL DEFAULT 'scheduled',

    -- Kapacitet
    total_capacity          INT,
    sold_count              INT DEFAULT 0,

    -- Konfiguracija
    max_seats_per_checkout  INT DEFAULT 10,

    -- Metadata
    notes                   TEXT,
    rental_terms_snapshot   JSONB,

    -- Timestamps
    created_at              TIMESTAMPTZ DEFAULT NOW(),
    updated_at              TIMESTAMPTZ DEFAULT NOW(),

    CONSTRAINT chk_occurrence_not_oversold
        CHECK (total_capacity IS NULL OR sold_count <= total_capacity),
    CONSTRAINT chk_occurrence_sold_non_negative
        CHECK (sold_count >= 0),
    CONSTRAINT chk_max_seats_positive
        CHECK (max_seats_per_checkout IS NULL OR max_seats_per_checkout > 0)
);


-- ############################################################
-- 15. VENUE AVAILABILITY
-- ############################################################

CREATE TABLE venue_availability (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    venue_id      UUID NOT NULL REFERENCES venues(id) ON DELETE CASCADE,
    date          DATE NOT NULL,
    time_range    TSTZRANGE NOT NULL,
    status        venue_availability_status NOT NULL DEFAULT 'tentative',
    occurrence_id UUID REFERENCES event_occurrences(id),
    inquiry_id    UUID REFERENCES venue_inquiries(id),
    created_at    TIMESTAMPTZ DEFAULT NOW()
);

-- Exclusion SAMO za blocked — tentative mogu koegzistirati
ALTER TABLE venue_availability
    ADD CONSTRAINT excl_venue_no_overlap_blocked
    EXCLUDE USING gist (
        venue_id WITH =,
        time_range WITH &&
    ) WHERE (status = 'blocked');


-- ############################################################
-- 16. EVENT TIERS & TIER ↔ SECTION JUNCTION
-- ############################################################

CREATE TABLE event_tiers (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    occurrence_id   UUID NOT NULL REFERENCES event_occurrences(id) ON DELETE CASCADE,
    name            VARCHAR(100) NOT NULL,
    description     TEXT,
    price           DECIMAL(10,2) NOT NULL DEFAULT 0,
    currency        VARCHAR(3) DEFAULT 'EUR'
                    REFERENCES supported_currencies(code),
    total_count     INT NOT NULL,
    sold_count      INT DEFAULT 0,
    tier_order      INT NOT NULL DEFAULT 1,
    sale_start      TIMESTAMPTZ,
    sale_end        TIMESTAMPTZ,
    is_active       BOOLEAN DEFAULT TRUE,
    created_at      TIMESTAMPTZ DEFAULT NOW(),
    updated_at      TIMESTAMPTZ DEFAULT NOW(),

    CONSTRAINT chk_tier_not_oversold CHECK (sold_count <= total_count),
    CONSTRAINT chk_sold_count_non_negative CHECK (sold_count >= 0)
);

CREATE TABLE tier_sections (
    tier_id     UUID NOT NULL REFERENCES event_tiers(id) ON DELETE CASCADE,
    section_id  UUID NOT NULL REFERENCES venue_sections(id) ON DELETE RESTRICT,
    PRIMARY KEY (tier_id, section_id)
);


-- ############################################################
-- 17. OCCURRENCE PACKAGES
-- ############################################################

CREATE TABLE occurrence_packages (
    id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    occurrence_id     UUID NOT NULL REFERENCES event_occurrences(id) ON DELETE CASCADE,
    name              VARCHAR(100) NOT NULL,
    description       TEXT,
    price             DECIMAL(10,2) NOT NULL DEFAULT 0,
    currency          VARCHAR(3) DEFAULT 'EUR'
                      REFERENCES supported_currencies(code),

    -- Package = Tier + Extras
    tier_id           UUID REFERENCES event_tiers(id),
    entries_included  INT NOT NULL DEFAULT 1,
    drinks_included   INT DEFAULT 0,
    table_section_id  UUID REFERENCES venue_sections(id),
    items             JSONB,

    max_quantity      INT,
    sold_count        INT DEFAULT 0,
    is_active         BOOLEAN DEFAULT TRUE,
    created_at        TIMESTAMPTZ DEFAULT NOW(),
    updated_at        TIMESTAMPTZ DEFAULT NOW(),

    CONSTRAINT chk_package_not_oversold
        CHECK (max_quantity IS NULL OR sold_count <= max_quantity),
    CONSTRAINT chk_pkg_sold_non_negative CHECK (sold_count >= 0),
    CONSTRAINT chk_pkg_entries_non_negative CHECK (entries_included >= 0),
    CONSTRAINT chk_pkg_tier_required_for_entries
        CHECK (entries_included = 0 OR tier_id IS NOT NULL)
);


-- ############################################################
-- 18. BUNDLE TYPES & BUNDLE ↔ OCCURRENCE JUNCTION
-- ############################################################

CREATE TABLE bundle_types (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    event_id        UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
    name            VARCHAR(100) NOT NULL,
    description     TEXT,
    price           DECIMAL(10,2) NOT NULL,
    currency        VARCHAR(3) DEFAULT 'EUR'
                    REFERENCES supported_currencies(code),
    total_count     INT NOT NULL,
    sold_count      INT DEFAULT 0,
    items           JSONB,
    sale_start      TIMESTAMPTZ,
    sale_end        TIMESTAMPTZ,
    is_active       BOOLEAN DEFAULT TRUE,
    created_at      TIMESTAMPTZ DEFAULT NOW(),
    updated_at      TIMESTAMPTZ DEFAULT NOW(),

    CONSTRAINT chk_bundle_not_oversold CHECK (sold_count <= total_count),
    CONSTRAINT chk_bundle_sold_non_negative CHECK (sold_count >= 0)
);

CREATE TABLE bundle_type_occurrences (
    bundle_type_id  UUID NOT NULL REFERENCES bundle_types(id) ON DELETE CASCADE,
    occurrence_id   UUID NOT NULL REFERENCES event_occurrences(id) ON DELETE RESTRICT,
    tier_id         UUID REFERENCES event_tiers(id),
    package_id      UUID REFERENCES occurrence_packages(id),
    sort_order      INT DEFAULT 0,
    PRIMARY KEY (bundle_type_id, occurrence_id)
);


-- ############################################################
-- 19. TICKET BUNDLES & TICKETS
-- ############################################################

CREATE TABLE ticket_bundles (
    id                       UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    bundle_type_id           UUID NOT NULL REFERENCES bundle_types(id),
    event_id                 UUID NOT NULL REFERENCES events(id),
    user_id                  UUID REFERENCES auth.users(id),
    purchase_email           VARCHAR(255),
    total_price              DECIMAL(10,2) NOT NULL,
    currency                 VARCHAR(3) DEFAULT 'EUR'
                             REFERENCES supported_currencies(code),
    status                   bundle_status NOT NULL DEFAULT 'pending_payment',
    refunded_amount          DECIMAL(10,2) DEFAULT 0,
    original_occurrence_count INT,
    qr_token                 VARCHAR(255) UNIQUE,
    purchased_at             TIMESTAMPTZ,
    created_at               TIMESTAMPTZ DEFAULT NOW(),
    updated_at               TIMESTAMPTZ DEFAULT NOW(),

    CONSTRAINT chk_refund_not_exceeds_price
        CHECK (refunded_amount <= total_price)
);

CREATE TABLE tickets (
    id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    occurrence_id    UUID NOT NULL REFERENCES event_occurrences(id),
    user_id          UUID REFERENCES auth.users(id),
    purchase_email   VARCHAR(255),
    tier_id          UUID NOT NULL REFERENCES event_tiers(id),
    package_id       UUID REFERENCES occurrence_packages(id),
    bundle_id        UUID REFERENCES ticket_bundles(id),
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
    updated_at       TIMESTAMPTZ DEFAULT NOW(),

    CONSTRAINT chk_drinks_non_negative CHECK (remaining_drinks >= 0)
);


-- ############################################################
-- 20. OCCURRENCE ITEM STATUS (seat/table map po izvedbi)
-- ############################################################

CREATE TABLE occurrence_item_status (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    occurrence_id   UUID NOT NULL REFERENCES event_occurrences(id) ON DELETE CASCADE,
    item_id         UUID NOT NULL REFERENCES venue_items(id) ON DELETE CASCADE,
    status          item_availability NOT NULL DEFAULT 'available',
    ticket_id       UUID REFERENCES tickets(id),
    locked_by       UUID REFERENCES auth.users(id),
    reserved_until  TIMESTAMPTZ,
    updated_at      TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(occurrence_id, item_id)
);


-- ############################################################
-- 21. TABLE RESERVATIONS
-- ############################################################

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
    reserved_at     TIMESTAMPTZ DEFAULT NOW(),
    confirmed_at    TIMESTAMPTZ,
    cancelled_at    TIMESTAMPTZ,
    cancelled_by    UUID REFERENCES auth.users(id),
    created_at      TIMESTAMPTZ DEFAULT NOW(),
    updated_at      TIMESTAMPTZ DEFAULT NOW(),

    CONSTRAINT chk_reservation_source_consistency CHECK (
        (source = 'ticket_purchase' AND ticket_id IS NOT NULL)
        OR (source = 'manual_booking' AND ticket_id IS NULL)
        OR (source = 'standalone' AND ticket_id IS NULL AND bundle_id IS NULL)
    )
);

-- Samo jedna aktivna rezervacija po stolu po izvedbi
CREATE UNIQUE INDEX idx_one_active_reservation_per_item
    ON table_reservations(occurrence_id, item_id)
    WHERE status IN ('pending', 'confirmed');


-- ############################################################
-- 22. ORDERS
-- ############################################################

CREATE TABLE orders (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id             UUID REFERENCES auth.users(id),
    purchase_email      VARCHAR(255),
    org_id              UUID NOT NULL REFERENCES organizations(id),
    order_number        VARCHAR(50) UNIQUE NOT NULL,
    subtotal            DECIMAL(10,2) NOT NULL DEFAULT 0,
    platform_fee        DECIMAL(10,2) DEFAULT 0,
    total_amount        DECIMAL(10,2) NOT NULL DEFAULT 0,
    currency            VARCHAR(3) NOT NULL DEFAULT 'EUR'
                        REFERENCES supported_currencies(code),
    gateway_id          UUID REFERENCES payment_gateways(id),
    gateway_session_id  VARCHAR(255),
    status              order_status NOT NULL DEFAULT 'draft',
    metadata            JSONB DEFAULT '{}',
    ip_address          INET,
    notes               TEXT,
    completed_at        TIMESTAMPTZ,
    cancelled_at        TIMESTAMPTZ,
    expires_at          TIMESTAMPTZ,
    created_at          TIMESTAMPTZ DEFAULT NOW(),
    updated_at          TIMESTAMPTZ DEFAULT NOW()
);


-- ############################################################
-- 23. ORDER ITEMS
-- ############################################################

CREATE TABLE order_items (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    order_id        UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
    item_type       order_item_type NOT NULL,
    item_id         UUID NOT NULL,       -- polimorfna referenca
    description     VARCHAR(500),
    unit_price      DECIMAL(10,2) NOT NULL,
    quantity        INT NOT NULL DEFAULT 1,
    subtotal        DECIMAL(10,2) NOT NULL,
    currency        VARCHAR(3) NOT NULL DEFAULT 'EUR'
                    REFERENCES supported_currencies(code),
    status          order_item_status NOT NULL DEFAULT 'pending',
    refunded_amount DECIMAL(10,2) DEFAULT 0,
    metadata        JSONB DEFAULT '{}',
    created_at      TIMESTAMPTZ DEFAULT NOW(),
    updated_at      TIMESTAMPTZ DEFAULT NOW(),

    CONSTRAINT chk_oi_subtotal CHECK (subtotal = unit_price * quantity),
    CONSTRAINT chk_oi_refund_cap CHECK (refunded_amount <= subtotal),
    CONSTRAINT chk_oi_quantity_positive CHECK (quantity > 0)
);


-- ############################################################
-- 24. TRANSACTIONS (financijski pokreti)
-- ############################################################

CREATE TABLE transactions (
    id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    order_id                UUID NOT NULL REFERENCES orders(id),
    transaction_type        transaction_type NOT NULL,
    parent_transaction_id   UUID REFERENCES transactions(id),
    gateway_id              UUID REFERENCES payment_gateways(id),
    gateway_payment_id      VARCHAR(255),
    amount                  DECIMAL(10,2) NOT NULL,
    currency                VARCHAR(3) NOT NULL DEFAULT 'EUR'
                            REFERENCES supported_currencies(code),
    platform_fee            DECIMAL(10,2) DEFAULT 0,
    status                  transaction_status NOT NULL DEFAULT 'pending',
    metadata                JSONB DEFAULT '{}',
    refunded_items          JSONB,
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


-- ############################################################
-- 25. PAYMENT ORDERS (organizator → vlasnik prostora)
-- ############################################################

CREATE TABLE payment_orders (
    id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    occurrence_id        UUID NOT NULL REFERENCES event_occurrences(id),
    from_org_id          UUID NOT NULL REFERENCES organizations(id),
    to_org_id            UUID NOT NULL REFERENCES organizations(id),
    amount               DECIMAL(10,2) NOT NULL,
    currency             VARCHAR(3) DEFAULT 'EUR'
                         REFERENCES supported_currencies(code),
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


-- ############################################################
-- 26. AUDIT LOG
-- ############################################################

CREATE TABLE audit_log (
    id              BIGSERIAL PRIMARY KEY,
    user_id         UUID REFERENCES auth.users(id),
    org_id          UUID REFERENCES organizations(id),
    entity_type     VARCHAR(100) NOT NULL,
    entity_id       UUID,
    action          audit_action NOT NULL,
    old_values      JSONB,
    new_values      JSONB,
    changed_fields  TEXT[],
    ip_address      INET,
    user_agent      TEXT,
    request_id      UUID,
    metadata        JSONB,
    created_at      TIMESTAMPTZ DEFAULT NOW()
);


-- ############################################################
-- 27. GENERIČKE UTILITY FUNKCIJE
-- ############################################################

-- Auto updated_at
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Primijeni na sve tablice s updated_at
DO $$
DECLARE
    t TEXT;
    tables TEXT[] := ARRAY[
        'profiles', 'user_preferences', 'organizations',
        'organization_members', 'payment_gateways', 'tags',
        'venues', 'venue_rental_terms', 'events',
        'venue_inquiries', 'event_occurrences',
        'event_tiers', 'occurrence_packages', 'bundle_types',
        'ticket_bundles', 'tickets', 'occurrence_item_status',
        'table_reservations', 'orders', 'order_items',
        'transactions', 'payment_orders'
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


-- ############################################################
-- 28. TIMEZONE FUNKCIJE
-- ############################################################

-- Kanonska konverzija DATE+TIME → TSTZRANGE
-- STABLE jer ovisi o IANA timezone podacima
CREATE OR REPLACE FUNCTION build_occurrence_tstzrange(
    p_date       DATE,
    p_start_time TIME,
    p_end_time   TIME,
    p_timezone   VARCHAR(50)
) RETURNS TSTZRANGE
LANGUAGE plpgsql STABLE AS $$
DECLARE
    v_start TIMESTAMPTZ;
    v_end   TIMESTAMPTZ;
BEGIN
    v_start := (p_date + p_start_time) AT TIME ZONE p_timezone;

    IF p_end_time IS NULL THEN
        -- Fallback: start + 6 sati
        v_end := v_start + INTERVAL '6 hours';
    ELSIF p_end_time <= p_start_time THEN
        -- Midnight crossover: end je sljedeći dan
        v_end := ((p_date + INTERVAL '1 day') + p_end_time) AT TIME ZONE p_timezone;
    ELSE
        v_end := (p_date + p_end_time) AT TIME ZONE p_timezone;
    END IF;

    IF v_end <= v_start THEN
        RAISE EXCEPTION 'Izračunati kraj (%) je prije ili jednak početku (%)', v_end, v_start;
    END IF;

    RETURN tstzrange(v_start, v_end, '[)');
END;
$$;

-- Provjera dostupnosti datuma za inquiry
CREATE OR REPLACE FUNCTION check_venue_date_available(
    p_venue_id   UUID,
    p_date       DATE,
    p_start_time TIME,
    p_end_time   TIME
) RETURNS BOOLEAN
LANGUAGE plpgsql STABLE AS $$
DECLARE
    v_timezone VARCHAR(50);
    v_range    TSTZRANGE;
BEGIN
    SELECT timezone INTO v_timezone FROM venues WHERE id = p_venue_id;
    v_range := build_occurrence_tstzrange(p_date, p_start_time, p_end_time, v_timezone);

    RETURN NOT EXISTS (
        SELECT 1 FROM venue_availability
        WHERE venue_id = p_venue_id
          AND status = 'blocked'
          AND time_range && v_range
    );
END;
$$;


-- ############################################################
-- 29. SEAT LOCK FUNKCIJE
-- ############################################################

-- Lock sjedala za checkout (15 min, s advisory lock za race condition)
CREATE OR REPLACE FUNCTION lock_seat_for_checkout(
    p_occurrence_id UUID,
    p_item_id       UUID,
    p_user_id       UUID,
    p_max_locks     INT DEFAULT 10
) RETURNS JSONB
LANGUAGE plpgsql AS $$
DECLARE
    v_current_status    item_availability;
    v_reserved_until    TIMESTAMPTZ;
    v_locked_by         UUID;
    v_current_lock_count INT;
BEGIN
    -- Advisory lock serializira sve lock zahtjeve istog korisnika za istu izvedbu
    PERFORM pg_advisory_xact_lock(
        hashtext(p_occurrence_id::TEXT || p_user_id::TEXT)
    );

    -- Atomični lock na redak
    SELECT status, reserved_until, locked_by
    INTO   v_current_status, v_reserved_until, v_locked_by
    FROM   occurrence_item_status
    WHERE  occurrence_id = p_occurrence_id AND item_id = p_item_id
    FOR UPDATE;

    -- First touch: kreiraj redak
    IF NOT FOUND THEN
        -- Provjeri max locks
        IF p_max_locks > 0 THEN
            SELECT COUNT(*) INTO v_current_lock_count
            FROM occurrence_item_status
            WHERE occurrence_id = p_occurrence_id
              AND locked_by = p_user_id AND status = 'locked'
              AND reserved_until > NOW();

            IF v_current_lock_count >= p_max_locks THEN
                RETURN jsonb_build_object(
                    'success', FALSE,
                    'reason', 'max_locks_reached',
                    'current_locks', v_current_lock_count,
                    'max_locks', p_max_locks
                );
            END IF;
        END IF;

        INSERT INTO occurrence_item_status (
            occurrence_id, item_id, status, locked_by,
            reserved_until, updated_at
        ) VALUES (
            p_occurrence_id, p_item_id, 'locked', p_user_id,
            NOW() + INTERVAL '15 minutes', NOW()
        );
        RETURN jsonb_build_object('success', TRUE, 'expires_at', NOW() + INTERVAL '15 minutes');
    END IF;

    -- Isti korisnik refresha lock
    IF v_locked_by = p_user_id AND v_current_status = 'locked' THEN
        UPDATE occurrence_item_status
        SET    reserved_until = NOW() + INTERVAL '15 minutes', updated_at = NOW()
        WHERE  occurrence_id = p_occurrence_id AND item_id = p_item_id;
        RETURN jsonb_build_object('success', TRUE, 'expires_at', NOW() + INTERVAL '15 minutes');
    END IF;

    -- Locked ali expired → preuzmi
    IF v_current_status = 'locked' AND v_reserved_until < NOW() THEN
        IF p_max_locks > 0 THEN
            SELECT COUNT(*) INTO v_current_lock_count
            FROM occurrence_item_status
            WHERE occurrence_id = p_occurrence_id
              AND locked_by = p_user_id AND status = 'locked'
              AND reserved_until > NOW() AND item_id != p_item_id;
            IF v_current_lock_count >= p_max_locks THEN
                RETURN jsonb_build_object('success', FALSE, 'reason', 'max_locks_reached');
            END IF;
        END IF;

        UPDATE occurrence_item_status
        SET    status = 'locked', locked_by = p_user_id,
               reserved_until = NOW() + INTERVAL '15 minutes', updated_at = NOW()
        WHERE  occurrence_id = p_occurrence_id AND item_id = p_item_id;
        RETURN jsonb_build_object('success', TRUE, 'expires_at', NOW() + INTERVAL '15 minutes');
    END IF;

    -- Available → zaključaj
    IF v_current_status = 'available' THEN
        IF p_max_locks > 0 THEN
            SELECT COUNT(*) INTO v_current_lock_count
            FROM occurrence_item_status
            WHERE occurrence_id = p_occurrence_id
              AND locked_by = p_user_id AND status = 'locked'
              AND reserved_until > NOW() AND item_id != p_item_id;
            IF v_current_lock_count >= p_max_locks THEN
                RETURN jsonb_build_object('success', FALSE, 'reason', 'max_locks_reached');
            END IF;
        END IF;

        UPDATE occurrence_item_status
        SET    status = 'locked', locked_by = p_user_id,
               reserved_until = NOW() + INTERVAL '15 minutes', updated_at = NOW()
        WHERE  occurrence_id = p_occurrence_id AND item_id = p_item_id;
        RETURN jsonb_build_object('success', TRUE, 'expires_at', NOW() + INTERVAL '15 minutes');
    END IF;

    -- Zauzeto
    RETURN jsonb_build_object(
        'success', FALSE,
        'reason', 'seat_unavailable',
        'current_status', v_current_status::TEXT
    );
END;
$$;

-- Oslobodi SVE lockove korisnika za izvedbu
CREATE OR REPLACE FUNCTION release_user_seat_locks(
    p_occurrence_id UUID,
    p_user_id UUID
) RETURNS INT
LANGUAGE plpgsql AS $$
DECLARE v_count INT;
BEGIN
    UPDATE occurrence_item_status
    SET    status = 'available', locked_by = NULL,
           reserved_until = NULL, updated_at = NOW()
    WHERE  occurrence_id = p_occurrence_id
      AND  locked_by = p_user_id AND status = 'locked';
    GET DIAGNOSTICS v_count = ROW_COUNT;
    RETURN v_count;
END;
$$;

-- Oslobodi JEDNO sjedalo
CREATE OR REPLACE FUNCTION release_single_seat_lock(
    p_occurrence_id UUID,
    p_item_id UUID,
    p_user_id UUID
) RETURNS BOOLEAN
LANGUAGE plpgsql AS $$
BEGIN
    UPDATE occurrence_item_status
    SET    status = 'available', locked_by = NULL,
           reserved_until = NULL, updated_at = NOW()
    WHERE  occurrence_id = p_occurrence_id
      AND  item_id = p_item_id
      AND  locked_by = p_user_id AND status = 'locked';
    RETURN FOUND;
END;
$$;

-- Expire seat lockova (cron svaku minutu)
CREATE OR REPLACE FUNCTION expire_seat_locks()
RETURNS INT
LANGUAGE plpgsql AS $$
DECLARE v_count INT;
BEGIN
    UPDATE occurrence_item_status
    SET    status = 'available', locked_by = NULL,
           reserved_until = NULL, ticket_id = NULL, updated_at = NOW()
    WHERE  status = 'locked'
      AND  reserved_until IS NOT NULL
      AND  reserved_until < NOW();
    GET DIAGNOSTICS v_count = ROW_COUNT;
    RETURN v_count;
END;
$$;

-- Produlji seat lockove kad se kreira order
CREATE OR REPLACE FUNCTION extend_seat_locks_for_order(
    p_occurrence_id UUID,
    p_user_id UUID,
    p_new_expiry TIMESTAMPTZ
) RETURNS INT
LANGUAGE plpgsql AS $$
DECLARE v_count INT;
BEGIN
    UPDATE occurrence_item_status
    SET    reserved_until = p_new_expiry, updated_at = NOW()
    WHERE  occurrence_id = p_occurrence_id
      AND  locked_by = p_user_id AND status = 'locked';
    GET DIAGNOSTICS v_count = ROW_COUNT;
    RETURN v_count;
END;
$$;


-- ############################################################
-- 30. RESERVATION FUNKCIJE
-- ############################################################

-- Atomični table swap
CREATE OR REPLACE FUNCTION swap_table_reservation(
    p_reservation_id UUID,
    p_new_item_id UUID,
    p_user_id UUID
) RETURNS UUID
LANGUAGE plpgsql AS $$
DECLARE
    v_old_rec table_reservations%ROWTYPE;
    v_new_reservation_id UUID;
BEGIN
    SELECT * INTO v_old_rec
    FROM table_reservations
    WHERE id = p_reservation_id AND status IN ('pending', 'confirmed')
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Rezervacija nije pronađena ili nije aktivna';
    END IF;

    IF EXISTS (
        SELECT 1 FROM table_reservations
        WHERE occurrence_id = v_old_rec.occurrence_id
          AND item_id = p_new_item_id
          AND status IN ('pending', 'confirmed')
    ) THEN
        RAISE EXCEPTION 'Odredišni stol nije dostupan';
    END IF;

    UPDATE table_reservations
    SET    status = 'cancelled', cancelled_at = NOW(),
           cancelled_by = p_user_id, updated_at = NOW()
    WHERE  id = p_reservation_id;

    UPDATE occurrence_item_status
    SET    status = 'available', ticket_id = NULL, updated_at = NOW()
    WHERE  occurrence_id = v_old_rec.occurrence_id AND item_id = v_old_rec.item_id;

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

    INSERT INTO occurrence_item_status (occurrence_id, item_id, status, ticket_id)
    VALUES (v_old_rec.occurrence_id, p_new_item_id, 'reserved', v_old_rec.ticket_id)
    ON CONFLICT (occurrence_id, item_id)
    DO UPDATE SET status = 'reserved', ticket_id = v_old_rec.ticket_id, updated_at = NOW();

    RETURN v_new_reservation_id;
END;
$$;

-- Expire standalone rezervacija (48h) — cron svakih 5 min
CREATE OR REPLACE FUNCTION expire_standalone_reservations()
RETURNS INT
LANGUAGE plpgsql AS $$
DECLARE v_count INT;
BEGIN
    WITH expired AS (
        UPDATE table_reservations
        SET    status = 'expired', updated_at = NOW()
        WHERE  source = 'standalone' AND status = 'pending'
          AND  expires_at IS NOT NULL AND expires_at < NOW()
        RETURNING occurrence_id, item_id
    )
    UPDATE occurrence_item_status ois
    SET    status = 'available', ticket_id = NULL,
           reserved_until = NULL, updated_at = NOW()
    FROM   expired e
    WHERE  ois.occurrence_id = e.occurrence_id AND ois.item_id = e.item_id;
    GET DIAGNOSTICS v_count = ROW_COUNT;
    RETURN v_count;
END;
$$;

-- Redeem drink (atomična)
CREATE OR REPLACE FUNCTION redeem_drink(p_ticket_id UUID)
RETURNS JSONB
LANGUAGE plpgsql AS $$
DECLARE v_remaining INT;
BEGIN
    UPDATE tickets
    SET    remaining_drinks = remaining_drinks - 1
    WHERE  id = p_ticket_id AND remaining_drinks > 0 AND status = 'scanned'
    RETURNING remaining_drinks INTO v_remaining;

    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', FALSE, 'reason', 'no_drinks_or_invalid_ticket');
    END IF;
    RETURN jsonb_build_object('success', TRUE, 'remaining', v_remaining);
END;
$$;


-- ############################################################
-- 31. GHOST ACCOUNT FUNKCIJA
-- ############################################################

CREATE OR REPLACE FUNCTION resolve_or_create_profile(
    p_email VARCHAR(255),
    p_full_name VARCHAR(255) DEFAULT NULL
) RETURNS UUID
LANGUAGE plpgsql AS $$
DECLARE
    v_user_id UUID;
BEGIN
    -- Provjeri postoji li auth.users s tim emailom
    SELECT id INTO v_user_id FROM auth.users WHERE email = p_email LIMIT 1;

    IF v_user_id IS NOT NULL THEN
        -- UPSERT profil
        INSERT INTO profiles (id, full_name, created_at, updated_at)
        VALUES (v_user_id, COALESCE(p_full_name, ''), NOW(), NOW())
        ON CONFLICT (id) DO UPDATE
            SET full_name = COALESCE(NULLIF(p_full_name, ''), profiles.full_name),
                updated_at = NOW();
        RETURN v_user_id;
    END IF;

    -- Nema usera — vrati NULL kao signal app layeru da kreira kroz Admin API
    RETURN NULL;
END;
$$;


-- ############################################################
-- 32. ORDER FUNKCIJE
-- ############################################################

-- Generiranje order_number: NOIR-YYYYMMDD-XXXX
CREATE OR REPLACE FUNCTION generate_order_number()
RETURNS TRIGGER
LANGUAGE plpgsql AS $$
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
            NEW.order_number := 'NOIR-' || v_date_part || '-' ||
                UPPER(SUBSTRING(REPLACE(gen_random_uuid()::TEXT, '-', '') FROM 1 FOR 8));
            RETURN NEW;
        END IF;
    END LOOP;
END;
$$;

CREATE TRIGGER trg_generate_order_number
    BEFORE INSERT ON orders
    FOR EACH ROW EXECUTE FUNCTION generate_order_number();

-- Validacija polimorfne reference
CREATE OR REPLACE FUNCTION validate_order_item_reference()
RETURNS TRIGGER
LANGUAGE plpgsql AS $$
DECLARE v_exists BOOLEAN;
BEGIN
    CASE NEW.item_type
        WHEN 'ticket' THEN
            SELECT EXISTS(SELECT 1 FROM tickets WHERE id = NEW.item_id) INTO v_exists;
        WHEN 'bundle' THEN
            SELECT EXISTS(SELECT 1 FROM ticket_bundles WHERE id = NEW.item_id) INTO v_exists;
        WHEN 'table_reservation' THEN
            SELECT EXISTS(SELECT 1 FROM table_reservations WHERE id = NEW.item_id) INTO v_exists;
        ELSE
            v_exists := TRUE;
    END CASE;

    IF NOT v_exists THEN
        RAISE EXCEPTION 'order_item: % s id=% ne postoji', NEW.item_type, NEW.item_id;
    END IF;
    RETURN NEW;
END;
$$;

CREATE TRIGGER trg_validate_order_item_ref
    BEFORE INSERT OR UPDATE OF item_type, item_id ON order_items
    FOR EACH ROW EXECUTE FUNCTION validate_order_item_reference();

-- Auto-sync order totala
CREATE OR REPLACE FUNCTION sync_order_totals()
RETURNS TRIGGER
LANGUAGE plpgsql AS $$
DECLARE
    v_order_id UUID;
    v_subtotal DECIMAL(10,2);
BEGIN
    v_order_id := COALESCE(NEW.order_id, OLD.order_id);

    SELECT COALESCE(SUM(subtotal), 0) INTO v_subtotal
    FROM   order_items
    WHERE  order_id = v_order_id AND status != 'cancelled';

    UPDATE orders
    SET    subtotal = v_subtotal,
           total_amount = v_subtotal + COALESCE(platform_fee, 0)
    WHERE  id = v_order_id;

    RETURN COALESCE(NEW, OLD);
END;
$$;

CREATE TRIGGER trg_sync_order_totals
    AFTER INSERT OR UPDATE OF subtotal, status OR DELETE ON order_items
    FOR EACH ROW EXECUTE FUNCTION sync_order_totals();

-- Auto-sync order refund statusa
CREATE OR REPLACE FUNCTION sync_order_refund_status()
RETURNS TRIGGER
LANGUAGE plpgsql AS $$
DECLARE
    v_total_charged  DECIMAL(10,2);
    v_total_refunded DECIMAL(10,2);
BEGIN
    IF NEW.transaction_type != 'refund' OR NEW.status != 'completed' THEN
        RETURN NEW;
    END IF;

    SELECT COALESCE(SUM(amount), 0) INTO v_total_charged
    FROM   transactions
    WHERE  order_id = NEW.order_id AND transaction_type = 'charge' AND status = 'completed';

    SELECT COALESCE(SUM(amount), 0) INTO v_total_refunded
    FROM   transactions
    WHERE  order_id = NEW.order_id AND transaction_type = 'refund' AND status = 'completed';

    IF v_total_refunded >= v_total_charged THEN
        UPDATE orders SET status = 'refunded' WHERE id = NEW.order_id AND status != 'refunded';
    ELSIF v_total_refunded > 0 THEN
        UPDATE orders SET status = 'partially_refunded'
        WHERE id = NEW.order_id AND status NOT IN ('refunded', 'partially_refunded');
    END IF;

    RETURN NEW;
END;
$$;

CREATE TRIGGER trg_sync_order_refund_status
    AFTER INSERT OR UPDATE OF status ON transactions
    FOR EACH ROW EXECUTE FUNCTION sync_order_refund_status();

-- Expire pending ordera (checkout 30 min / table hold 48h)
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
        UPDATE orders SET status = 'expired' WHERE id = v_order.id;
        UPDATE order_items SET status = 'cancelled' WHERE order_id = v_order.id AND status = 'pending';

        -- Expire tickete i oslobodi seat lockove
        UPDATE tickets SET status = 'expired'
        WHERE id IN (
            SELECT item_id FROM order_items WHERE order_id = v_order.id AND item_type = 'ticket'
        ) AND status IN ('reserved', 'pending_payment');

        -- Oslobodi occurrence_item_status za te tickete
        UPDATE occurrence_item_status
        SET    status = 'available', ticket_id = NULL, locked_by = NULL,
               reserved_until = NULL
        WHERE  ticket_id IN (
            SELECT item_id FROM order_items WHERE order_id = v_order.id AND item_type = 'ticket'
        ) AND status IN ('sold', 'reserved', 'locked');

        -- Oslobodi lockove po user_id za ordre bez ticketa (seat lock faza)
        UPDATE occurrence_item_status
        SET    status = 'available', locked_by = NULL, reserved_until = NULL
        WHERE  locked_by = (SELECT user_id FROM orders WHERE id = v_order.id)
          AND  status = 'locked'
          AND  reserved_until IS NOT NULL;

        -- Expire bundleove
        UPDATE ticket_bundles SET status = 'cancelled'
        WHERE id IN (
            SELECT item_id FROM order_items WHERE order_id = v_order.id AND item_type = 'bundle'
        ) AND status = 'pending_payment';

        -- Expire table_reservations
        UPDATE table_reservations
        SET    status = 'expired', cancelled_at = NOW()
        WHERE  id IN (
            SELECT item_id FROM order_items WHERE order_id = v_order.id AND item_type = 'table_reservation'
        ) AND status IN ('pending', 'confirmed');
    END LOOP;
END;
$$;


-- ############################################################
-- 33. TRIGGERI — SOLD COUNT
-- ############################################################

-- T1: Ticket sold_count sync (tier, package, occurrence)
CREATE OR REPLACE FUNCTION update_sold_counts()
RETURNS TRIGGER
LANGUAGE plpgsql AS $$
BEGIN
    IF NEW.status = 'active' AND (OLD IS NULL OR OLD.status != 'active') THEN
        UPDATE event_tiers SET sold_count = sold_count + 1 WHERE id = NEW.tier_id;
        IF NEW.package_id IS NOT NULL THEN
            UPDATE occurrence_packages SET sold_count = sold_count + 1 WHERE id = NEW.package_id;
        END IF;
        UPDATE event_occurrences SET sold_count = sold_count + 1 WHERE id = NEW.occurrence_id;
    END IF;

    IF NEW.status IN ('cancelled', 'refunded') AND OLD IS NOT NULL AND OLD.status = 'active' THEN
        UPDATE event_tiers SET sold_count = GREATEST(sold_count - 1, 0) WHERE id = NEW.tier_id;
        IF NEW.package_id IS NOT NULL THEN
            UPDATE occurrence_packages SET sold_count = GREATEST(sold_count - 1, 0) WHERE id = NEW.package_id;
        END IF;
        UPDATE event_occurrences SET sold_count = GREATEST(sold_count - 1, 0) WHERE id = NEW.occurrence_id;
    END IF;

    RETURN NEW;
END;
$$;

CREATE TRIGGER trg_ticket_sold_counts
    AFTER INSERT OR UPDATE OF status ON tickets
    FOR EACH ROW EXECUTE FUNCTION update_sold_counts();

-- T2: Bundle sold_count sync
CREATE OR REPLACE FUNCTION update_bundle_type_sold_count()
RETURNS TRIGGER
LANGUAGE plpgsql AS $$
BEGIN
    IF NEW.status = 'active' AND (OLD IS NULL OR OLD.status != 'active') THEN
        UPDATE bundle_types SET sold_count = sold_count + 1 WHERE id = NEW.bundle_type_id;
    END IF;
    IF NEW.status IN ('cancelled', 'refunded') AND OLD IS NOT NULL AND OLD.status = 'active' THEN
        UPDATE bundle_types SET sold_count = GREATEST(sold_count - 1, 0) WHERE id = NEW.bundle_type_id;
    END IF;
    RETURN NEW;
END;
$$;

CREATE TRIGGER trg_bundle_sold_counts
    AFTER INSERT OR UPDATE OF status ON ticket_bundles
    FOR EACH ROW EXECUTE FUNCTION update_bundle_type_sold_count();


-- ############################################################
-- 34. TRIGGERI — RESERVATIONS & AVAILABILITY
-- ############################################################

-- T3: Auto-cancel reservation kad se ticket otkaže
CREATE OR REPLACE FUNCTION auto_cancel_reservation_on_ticket()
RETURNS TRIGGER
LANGUAGE plpgsql AS $$
BEGIN
    IF NEW.status IN ('cancelled', 'refunded') AND OLD.status = 'active' THEN
        UPDATE table_reservations
        SET    status = 'cancelled', cancelled_at = NOW()
        WHERE  ticket_id = NEW.id AND status IN ('pending', 'confirmed');

        UPDATE occurrence_item_status
        SET    status = 'available', ticket_id = NULL
        WHERE  ticket_id = NEW.id;
    END IF;
    RETURN NEW;
END;
$$;

CREATE TRIGGER trg_cancel_reservation_on_ticket_cancel
    AFTER UPDATE OF status ON tickets
    FOR EACH ROW EXECUTE FUNCTION auto_cancel_reservation_on_ticket();

-- T4: Auto-reject overlapping tentative (s FOR UPDATE)
CREATE OR REPLACE FUNCTION reject_overlapping_tentative()
RETURNS TRIGGER
LANGUAGE plpgsql AS $$
BEGIN
    IF NEW.status = 'blocked' AND (OLD IS NULL OR OLD.status != 'blocked') THEN
        PERFORM 1 FROM venue_availability
        WHERE venue_id = NEW.venue_id AND id != NEW.id
          AND status = 'tentative' AND time_range && NEW.time_range
        FOR UPDATE;

        UPDATE venue_availability SET status = 'rejected'
        WHERE venue_id = NEW.venue_id AND id != NEW.id
          AND status = 'tentative' AND time_range && NEW.time_range;

        UPDATE venue_inquiries vi SET status = 'rejected', updated_at = NOW()
        FROM   venue_availability va
        WHERE  va.inquiry_id = vi.id AND va.venue_id = NEW.venue_id
          AND  va.id != NEW.id AND va.status = 'rejected'
          AND  va.time_range && NEW.time_range
          AND  vi.status NOT IN ('accepted', 'cancelled');
    END IF;
    RETURN NEW;
END;
$$;

CREATE TRIGGER trg_reject_overlapping_on_confirm
    AFTER UPDATE OF status ON venue_availability
    FOR EACH ROW EXECUTE FUNCTION reject_overlapping_tentative();

-- T13: Sync time_range na venue_availability iz occurrence podataka
CREATE OR REPLACE FUNCTION sync_va_time_range()
RETURNS TRIGGER
LANGUAGE plpgsql AS $$
DECLARE
    v_date      DATE;
    v_start     TIME;
    v_end       TIME;
    v_timezone  VARCHAR(50);
BEGIN
    IF NEW.occurrence_id IS NULL THEN
        RETURN NEW;
    END IF;

    SELECT eo.occurrence_date, eo.start_time, eo.end_time, v.timezone
    INTO   v_date, v_start, v_end, v_timezone
    FROM   event_occurrences eo
    JOIN   venues v ON v.id = eo.venue_id
    WHERE  eo.id = NEW.occurrence_id;

    IF v_date IS NOT NULL AND v_start IS NOT NULL THEN
        NEW.time_range := build_occurrence_tstzrange(v_date, v_start, v_end, v_timezone);
        NEW.date := v_date;
    END IF;

    RETURN NEW;
END;
$$;

CREATE TRIGGER trg_sync_va_time_range
    BEFORE INSERT OR UPDATE OF occurrence_id ON venue_availability
    FOR EACH ROW EXECUTE FUNCTION sync_va_time_range();


-- ############################################################
-- 35. TRIGGERI — CAPACITY ENFORCEMENT
-- ############################################################

-- T5: Suma tierova ≤ occurrence kapacitet (deaktiviran tier ne zauzima)
CREATE OR REPLACE FUNCTION enforce_tier_capacity_limit()
RETURNS TRIGGER
LANGUAGE plpgsql AS $$
DECLARE
    v_occurrence_capacity INT;
    v_current_tier_sum INT;
BEGIN
    SELECT total_capacity INTO v_occurrence_capacity
    FROM   event_occurrences WHERE id = NEW.occurrence_id;

    IF v_occurrence_capacity IS NULL THEN RETURN NEW; END IF;

    SELECT COALESCE(SUM(total_count), 0) INTO v_current_tier_sum
    FROM   event_tiers
    WHERE  occurrence_id = NEW.occurrence_id AND id != NEW.id AND is_active = TRUE;

    IF NEW.is_active = TRUE THEN
        v_current_tier_sum := v_current_tier_sum + NEW.total_count;
    END IF;

    IF v_current_tier_sum > v_occurrence_capacity THEN
        RAISE EXCEPTION 'Ukupan broj ulaznica (%) prelazi kapacitet izvedbe (%).',
            v_current_tier_sum, v_occurrence_capacity;
    END IF;
    RETURN NEW;
END;
$$;

CREATE TRIGGER trg_enforce_tier_capacity
    BEFORE INSERT OR UPDATE OF total_count, is_active ON event_tiers
    FOR EACH ROW EXECUTE FUNCTION enforce_tier_capacity_limit();

-- T6: Occurrence kapacitet ≤ venue layout kapacitet
CREATE OR REPLACE FUNCTION enforce_occurrence_layout_capacity()
RETURNS TRIGGER
LANGUAGE plpgsql AS $$
DECLARE v_layout_capacity INT;
BEGIN
    IF NEW.total_capacity IS NULL THEN RETURN NEW; END IF;

    SELECT total_capacity INTO v_layout_capacity
    FROM   venue_layouts WHERE id = NEW.venue_layout_id;

    IF v_layout_capacity IS NULL THEN RETURN NEW; END IF;

    IF NEW.total_capacity > v_layout_capacity THEN
        RAISE EXCEPTION 'Kapacitet izvedbe (%) prelazi kapacitet layouta prostora (%).',
            NEW.total_capacity, v_layout_capacity;
    END IF;
    RETURN NEW;
END;
$$;

CREATE TRIGGER trg_enforce_occurrence_layout_capacity
    BEFORE INSERT OR UPDATE OF total_capacity ON event_occurrences
    FOR EACH ROW EXECUTE FUNCTION enforce_occurrence_layout_capacity();

-- T_NEW: Enforce sekcijski kapacitet (suma tierova po sekciji ≤ sekcija capacity)
CREATE OR REPLACE FUNCTION enforce_section_capacity_limit()
RETURNS TRIGGER
LANGUAGE plpgsql AS $$
DECLARE
    v_section RECORD;
    v_section_tier_sum INT;
    v_tier_occurrence_id UUID;
BEGIN
    -- Dobavi occurrence_id za ovaj tier
    IF TG_TABLE_NAME = 'tier_sections' THEN
        SELECT occurrence_id INTO v_tier_occurrence_id
        FROM event_tiers WHERE id = NEW.tier_id;
    ELSE
        v_tier_occurrence_id := NEW.occurrence_id;
    END IF;

    -- Za svaku sekciju povezanu s ovim tierom
    FOR v_section IN
        SELECT vs.id, vs.default_capacity, vs.name
        FROM tier_sections ts
        JOIN venue_sections vs ON vs.id = ts.section_id
        WHERE ts.tier_id = CASE
            WHEN TG_TABLE_NAME = 'tier_sections' THEN NEW.tier_id
            ELSE NEW.id
        END
    LOOP
        SELECT COALESCE(SUM(et.total_count), 0) INTO v_section_tier_sum
        FROM   event_tiers et
        JOIN   tier_sections ts ON ts.tier_id = et.id
        WHERE  ts.section_id = v_section.id
          AND  et.occurrence_id = v_tier_occurrence_id
          AND  et.is_active = TRUE;

        IF v_section_tier_sum > v_section.default_capacity THEN
            RAISE EXCEPTION 'Kapacitet tierova (%) za sekciju "%" prelazi kapacitet sekcije (%).',
                v_section_tier_sum, v_section.name, v_section.default_capacity;
        END IF;
    END LOOP;

    RETURN NEW;
END;
$$;

-- Pali se i na tier promjene i na tier_sections INSERT
CREATE TRIGGER trg_enforce_section_capacity_on_tier
    AFTER INSERT OR UPDATE OF total_count, is_active ON event_tiers
    FOR EACH ROW EXECUTE FUNCTION enforce_section_capacity_limit();

CREATE TRIGGER trg_enforce_section_capacity_on_junction
    AFTER INSERT ON tier_sections
    FOR EACH ROW EXECUTE FUNCTION enforce_section_capacity_limit();


-- ############################################################
-- 36. TRIGGERI — OCCURRENCE IMMUTABILITY & PRE-POPULATION
-- ############################################################

-- Blokada promjene venuea/layouta na occurrenceu
CREATE OR REPLACE FUNCTION prevent_occurrence_venue_change()
RETURNS TRIGGER
LANGUAGE plpgsql AS $$
BEGIN
    IF OLD.venue_id IS DISTINCT FROM NEW.venue_id
       OR OLD.venue_layout_id IS DISTINCT FROM NEW.venue_layout_id THEN
        RAISE EXCEPTION 'Promjena prostora ili layouta za postojeću izvedbu nije dozvoljena. Kreirajte novu izvedbu.';
    END IF;
    RETURN NEW;
END;
$$;

CREATE TRIGGER trg_prevent_occurrence_venue_change
    BEFORE UPDATE OF venue_id, venue_layout_id ON event_occurrences
    FOR EACH ROW EXECUTE FUNCTION prevent_occurrence_venue_change();

-- Pre-populacija occurrence_item_status kad occurrence ide na on_sale
CREATE OR REPLACE FUNCTION populate_occurrence_items()
RETURNS TRIGGER
LANGUAGE plpgsql AS $$
BEGIN
    IF NEW.status = 'on_sale' AND OLD.status != 'on_sale' THEN
        INSERT INTO occurrence_item_status (occurrence_id, item_id, status)
        SELECT NEW.id, vi.id, 'available'
        FROM   venue_items vi
        JOIN   venue_sections vs ON vs.id = vi.section_id
        JOIN   tier_sections ts ON ts.section_id = vs.id
        JOIN   event_tiers et ON et.id = ts.tier_id
        WHERE  et.occurrence_id = NEW.id
          AND  et.is_active = TRUE
          AND  vi.is_active = TRUE
          AND  vs.is_numbered = TRUE  -- samo numbered sekcije imaju individualne stavke
        ON CONFLICT (occurrence_id, item_id) DO NOTHING;
    END IF;
    RETURN NEW;
END;
$$;

CREATE TRIGGER trg_populate_occurrence_items
    AFTER UPDATE OF status ON event_occurrences
    FOR EACH ROW EXECUTE FUNCTION populate_occurrence_items();


-- ############################################################
-- 37. TRIGGERI — SALE WINDOW & CURRENCY ENFORCEMENT
-- ############################################################

-- T9: Sale window enforcement na ticket INSERT
CREATE OR REPLACE FUNCTION enforce_tier_sale_window()
RETURNS TRIGGER
LANGUAGE plpgsql AS $$
DECLARE
    v_tier event_tiers%ROWTYPE;
BEGIN
    SELECT * INTO v_tier FROM event_tiers WHERE id = NEW.tier_id;

    IF NOT v_tier.is_active THEN
        RAISE EXCEPTION 'Tier "%" nije aktivan', v_tier.name;
    END IF;
    IF v_tier.sale_start IS NOT NULL AND NOW() < v_tier.sale_start THEN
        RAISE EXCEPTION 'Prodaja za tier "%" još nije počela', v_tier.name;
    END IF;
    IF v_tier.sale_end IS NOT NULL AND NOW() > v_tier.sale_end THEN
        RAISE EXCEPTION 'Prodaja za tier "%" je završila', v_tier.name;
    END IF;
    RETURN NEW;
END;
$$;

CREATE TRIGGER trg_enforce_tier_sale_window
    BEFORE INSERT ON tickets
    FOR EACH ROW EXECUTE FUNCTION enforce_tier_sale_window();

-- T10-T12: Currency consistency (tier/package/bundle = org currency)
CREATE OR REPLACE FUNCTION enforce_currency_consistency()
RETURNS TRIGGER
LANGUAGE plpgsql AS $$
DECLARE v_org_currency VARCHAR(3);
BEGIN
    SELECT o.default_currency INTO v_org_currency
    FROM   organizations o
    JOIN   events e ON e.organizer_org_id = o.id
    JOIN   event_occurrences eo ON eo.event_id = e.id
    WHERE  eo.id = NEW.occurrence_id;

    IF NEW.currency != v_org_currency THEN
        RAISE EXCEPTION 'Valuta (%) ne odgovara valuti organizacije (%)', NEW.currency, v_org_currency;
    END IF;
    RETURN NEW;
END;
$$;

CREATE TRIGGER trg_enforce_tier_currency
    BEFORE INSERT OR UPDATE OF currency ON event_tiers
    FOR EACH ROW EXECUTE FUNCTION enforce_currency_consistency();

CREATE TRIGGER trg_enforce_package_currency
    BEFORE INSERT OR UPDATE OF currency ON occurrence_packages
    FOR EACH ROW EXECUTE FUNCTION enforce_currency_consistency();

CREATE OR REPLACE FUNCTION enforce_bundle_currency_consistency()
RETURNS TRIGGER
LANGUAGE plpgsql AS $$
DECLARE v_org_currency VARCHAR(3);
BEGIN
    SELECT o.default_currency INTO v_org_currency
    FROM   organizations o
    JOIN   events e ON e.organizer_org_id = o.id
    WHERE  e.id = NEW.event_id;

    IF NEW.currency != v_org_currency THEN
        RAISE EXCEPTION 'Bundle valuta (%) ne odgovara organizaciji (%)', NEW.currency, v_org_currency;
    END IF;
    RETURN NEW;
END;
$$;

CREATE TRIGGER trg_enforce_bundle_currency
    BEFORE INSERT OR UPDATE OF currency ON bundle_types
    FOR EACH ROW EXECUTE FUNCTION enforce_bundle_currency_consistency();


-- ############################################################
-- 38. TRIGGERI — OCCURRENCE CANCELLATION (kaskadni)
-- ############################################################

CREATE OR REPLACE FUNCTION handle_occurrence_cancellation()
RETURNS TRIGGER
LANGUAGE plpgsql AS $$
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

    -- Striktan redoslijed (sprečava cascading trigger probleme):

    -- 1. Unavailable sve stavke
    UPDATE occurrence_item_status SET status = 'unavailable'
    WHERE  occurrence_id = NEW.id;

    -- 2. Cancel sve rezervacije
    UPDATE table_reservations SET status = 'cancelled', cancelled_at = NOW()
    WHERE  occurrence_id = NEW.id AND status IN ('pending', 'confirmed');

    -- 3. Cancel sve tickete
    UPDATE tickets SET status = 'cancelled', cancelled_at = NOW()
    WHERE  occurrence_id = NEW.id AND status IN ('active', 'reserved', 'pending_payment');

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
            FROM bundle_type_occurrences WHERE bundle_type_id = v_bundle.bundle_type_id;
        END IF;

        IF v_total_occurrences > 0 THEN
            v_refund_per_occurrence := LEAST(
                v_bundle.total_price / v_total_occurrences,
                v_bundle.total_price - COALESCE(v_bundle.current_refunded, 0)
            );

            UPDATE ticket_bundles
            SET    refunded_amount = COALESCE(refunded_amount, 0) + v_refund_per_occurrence,
                   status = 'partially_refunded'
            WHERE  id = v_bundle.bundle_id;

            -- Refund kroz orders model
            SELECT oi.order_id, oi.id, o.currency
            INTO   v_order_id, v_order_item_id, v_currency
            FROM   order_items oi JOIN orders o ON o.id = oi.order_id
            WHERE  oi.item_type = 'bundle' AND oi.item_id = v_bundle.bundle_id
            LIMIT 1;

            IF v_order_id IS NOT NULL THEN
                SELECT id INTO v_charge_txn_id FROM transactions
                WHERE order_id = v_order_id AND transaction_type = 'charge' AND status = 'completed'
                ORDER BY created_at ASC LIMIT 1;

                INSERT INTO transactions (
                    order_id, transaction_type, parent_transaction_id,
                    amount, currency, status, metadata, refunded_items
                ) VALUES (
                    v_order_id, 'refund', v_charge_txn_id,
                    v_refund_per_occurrence, COALESCE(v_currency, 'EUR'), 'completed',
                    jsonb_build_object('reason', 'occurrence_cancelled', 'occurrence_id', NEW.id),
                    jsonb_build_array(jsonb_build_object('order_item_id', v_order_item_id, 'amount', v_refund_per_occurrence))
                );

                UPDATE order_items
                SET    refunded_amount = COALESCE(refunded_amount, 0) + v_refund_per_occurrence,
                       status = CASE
                           WHEN COALESCE(refunded_amount, 0) + v_refund_per_occurrence >= subtotal
                           THEN 'refunded'::order_item_status ELSE status END
                WHERE  id = v_order_item_id;
            END IF;

            -- Full refund detekcija
            SELECT COUNT(*) INTO v_active_occurrence_count
            FROM   bundle_type_occurrences bto
            JOIN   event_occurrences eo ON eo.id = bto.occurrence_id
            WHERE  bto.bundle_type_id = v_bundle.bundle_type_id
              AND  eo.status NOT IN ('cancelled', 'completed');

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
$$;

CREATE TRIGGER trg_handle_occurrence_cancellation
    AFTER UPDATE OF status ON event_occurrences
    FOR EACH ROW EXECUTE FUNCTION handle_occurrence_cancellation();


-- ############################################################
-- 39. TRIGGERI — PAYMENT ORDER AUTO-GENERATE
-- ############################################################

CREATE OR REPLACE FUNCTION auto_generate_payment_order()
RETURNS TRIGGER
LANGUAGE plpgsql AS $$
DECLARE
    v_event        RECORD;
    v_venue        RECORD;
    v_terms        JSONB;
    v_amount       DECIMAL(10,2) := 0;
    v_ticket_revenue DECIMAL(10,2);
BEGIN
    IF NEW.status != 'completed' OR OLD.status = 'completed' THEN RETURN NEW; END IF;
    IF NEW.rental_terms_snapshot IS NULL THEN RETURN NEW; END IF;

    SELECT e.*, o.id AS org_id INTO v_event
    FROM events e JOIN organizations o ON o.id = e.organizer_org_id
    WHERE e.id = NEW.event_id;

    SELECT * INTO v_venue FROM venues WHERE id = NEW.venue_id;

    -- Self-hosted: preskoči
    IF v_event.org_id = v_venue.org_id THEN RETURN NEW; END IF;

    v_terms := NEW.rental_terms_snapshot;

    -- Free: preskoči
    IF v_terms->>'pricing_model' = 'free' THEN RETURN NEW; END IF;

    -- Izračun po modelu
    IF v_terms->>'pricing_model' = 'fixed' THEN
        v_amount := (v_terms->>'fixed_amount')::DECIMAL;
    ELSIF v_terms->>'pricing_model' IN ('revenue_share', 'hybrid') THEN
        SELECT COALESCE(SUM(et.price * et.sold_count), 0) INTO v_ticket_revenue
        FROM event_tiers et WHERE et.occurrence_id = NEW.id AND et.is_active = TRUE;

        IF v_terms->>'pricing_model' = 'revenue_share' THEN
            v_amount := v_ticket_revenue * (v_terms->>'revenue_share_pct')::DECIMAL / 100;
            IF (v_terms->>'min_guarantee') IS NOT NULL THEN
                v_amount := GREATEST(v_amount, (v_terms->>'min_guarantee')::DECIMAL);
            END IF;
        ELSE -- hybrid
            v_amount := COALESCE((v_terms->>'fixed_amount')::DECIMAL, 0)
                      + v_ticket_revenue * (v_terms->>'revenue_share_pct')::DECIMAL / 100;
        END IF;
    ELSIF v_terms->>'pricing_model' = 'negotiable' THEN
        v_amount := 0;
    END IF;

    INSERT INTO payment_orders (
        occurrence_id, from_org_id, to_org_id, amount, currency,
        calculation_details, due_date, status
    ) VALUES (
        NEW.id, v_event.org_id, v_venue.org_id, v_amount,
        COALESCE(v_terms->>'fixed_currency', 'EUR'),
        jsonb_build_object('model', v_terms->>'pricing_model', 'ticket_revenue', v_ticket_revenue, 'terms', v_terms),
        NEW.occurrence_date + INTERVAL '14 days', 'draft'
    );

    RETURN NEW;
END;
$$;

CREATE TRIGGER trg_auto_generate_payment_order
    AFTER UPDATE OF status ON event_occurrences
    FOR EACH ROW EXECUTE FUNCTION auto_generate_payment_order();


-- ############################################################
-- 40. TRIGGERI — VENUE LAYOUT KAPACITET
-- ############################################################

-- Auto-compute layout capacity iz sekcija
CREATE OR REPLACE FUNCTION compute_layout_capacity()
RETURNS TRIGGER
LANGUAGE plpgsql AS $$
DECLARE v_layout_id UUID; v_total INT;
BEGIN
    v_layout_id := COALESCE(NEW.layout_id, OLD.layout_id);

    SELECT COALESCE(SUM(default_capacity), 0) INTO v_total
    FROM   venue_sections WHERE layout_id = v_layout_id AND is_active = TRUE;

    UPDATE venue_layouts SET total_capacity = v_total WHERE id = v_layout_id;

    -- Ažuriraj venues.total_capacity za current layout
    UPDATE venues v SET total_capacity = vl.total_capacity
    FROM   venue_layouts vl
    WHERE  vl.id = v_layout_id AND vl.venue_id = v.id AND vl.is_current = TRUE;

    RETURN COALESCE(NEW, OLD);
END;
$$;

CREATE TRIGGER trg_compute_layout_capacity
    AFTER INSERT OR UPDATE OF default_capacity, is_active OR DELETE ON venue_sections
    FOR EACH ROW EXECUTE FUNCTION compute_layout_capacity();

-- Kad se layout prebaci na is_current, ažuriraj venue.total_capacity
CREATE OR REPLACE FUNCTION sync_venue_capacity_on_layout_change()
RETURNS TRIGGER
LANGUAGE plpgsql AS $$
BEGIN
    IF NEW.is_current = TRUE AND (OLD IS NULL OR OLD.is_current = FALSE) THEN
        -- Makni stari current
        UPDATE venue_layouts SET is_current = FALSE
        WHERE  venue_id = NEW.venue_id AND id != NEW.id AND is_current = TRUE;

        -- Sync venue capacity
        UPDATE venues SET total_capacity = NEW.total_capacity WHERE id = NEW.venue_id;
    END IF;
    RETURN NEW;
END;
$$;

CREATE TRIGGER trg_sync_venue_capacity_on_layout_change
    AFTER INSERT OR UPDATE OF is_current ON venue_layouts
    FOR EACH ROW EXECUTE FUNCTION sync_venue_capacity_on_layout_change();


-- ############################################################
-- 41. TRIGGERI — VALIDACIJSKI
-- ############################################################

-- Package tier mora pripadati istoj izvedbi
CREATE OR REPLACE FUNCTION validate_package_tier_consistency()
RETURNS TRIGGER
LANGUAGE plpgsql AS $$
DECLARE v_tier_occ UUID;
BEGIN
    IF NEW.tier_id IS NULL THEN RETURN NEW; END IF;
    SELECT occurrence_id INTO v_tier_occ FROM event_tiers WHERE id = NEW.tier_id;
    IF v_tier_occ != NEW.occurrence_id THEN
        RAISE EXCEPTION 'Package tier pripada drugoj izvedbi';
    END IF;
    RETURN NEW;
END;
$$;

CREATE TRIGGER trg_validate_package_tier
    BEFORE INSERT OR UPDATE OF tier_id ON occurrence_packages
    FOR EACH ROW EXECUTE FUNCTION validate_package_tier_consistency();

-- Package section mora pripadati istom venueu
CREATE OR REPLACE FUNCTION validate_package_section_venue()
RETURNS TRIGGER
LANGUAGE plpgsql AS $$
DECLARE v_occ_layout UUID; v_section_layout UUID;
BEGIN
    IF NEW.table_section_id IS NULL THEN RETURN NEW; END IF;
    SELECT venue_layout_id INTO v_occ_layout FROM event_occurrences WHERE id = NEW.occurrence_id;
    SELECT layout_id INTO v_section_layout FROM venue_sections WHERE id = NEW.table_section_id;
    IF v_occ_layout != v_section_layout THEN
        RAISE EXCEPTION 'Package sekcija ne pripada layoutu izvedbe';
    END IF;
    RETURN NEW;
END;
$$;

CREATE TRIGGER trg_validate_package_section
    BEFORE INSERT OR UPDATE OF table_section_id ON occurrence_packages
    FOR EACH ROW EXECUTE FUNCTION validate_package_section_venue();

-- BTO tier/package validacija
CREATE OR REPLACE FUNCTION validate_bto_tier_occurrence()
RETURNS TRIGGER
LANGUAGE plpgsql AS $$
DECLARE v_tier_occ UUID; v_pkg_occ UUID;
BEGIN
    IF NEW.tier_id IS NOT NULL THEN
        SELECT occurrence_id INTO v_tier_occ FROM event_tiers WHERE id = NEW.tier_id;
        IF v_tier_occ != NEW.occurrence_id THEN
            RAISE EXCEPTION 'Bundle tier ne pripada izvedbi';
        END IF;
    END IF;
    IF NEW.package_id IS NOT NULL THEN
        SELECT occurrence_id INTO v_pkg_occ FROM occurrence_packages WHERE id = NEW.package_id;
        IF v_pkg_occ != NEW.occurrence_id THEN
            RAISE EXCEPTION 'Bundle package ne pripada izvedbi';
        END IF;
    END IF;
    RETURN NEW;
END;
$$;

CREATE TRIGGER trg_validate_bto_references
    BEFORE INSERT OR UPDATE OF tier_id, package_id ON bundle_type_occurrences
    FOR EACH ROW EXECUTE FUNCTION validate_bto_tier_occurrence();

-- Tier_sections: sekcija mora pripadati istom layoutu kao occurrence
CREATE OR REPLACE FUNCTION validate_tier_section_layout()
RETURNS TRIGGER
LANGUAGE plpgsql AS $$
DECLARE v_occ_layout UUID; v_section_layout UUID;
BEGIN
    SELECT eo.venue_layout_id INTO v_occ_layout
    FROM   event_tiers et JOIN event_occurrences eo ON eo.id = et.occurrence_id
    WHERE  et.id = NEW.tier_id;

    SELECT layout_id INTO v_section_layout FROM venue_sections WHERE id = NEW.section_id;

    IF v_occ_layout != v_section_layout THEN
        RAISE EXCEPTION 'Sekcija ne pripada layoutu koji koristi ova izvedba';
    END IF;
    RETURN NEW;
END;
$$;

CREATE TRIGGER trg_validate_tier_section_layout
    BEFORE INSERT ON tier_sections
    FOR EACH ROW EXECUTE FUNCTION validate_tier_section_layout();


-- ############################################################
-- 42. INDEKSI
-- ############################################################

-- Profiles
CREATE INDEX idx_profiles_unclaimed ON profiles(id) WHERE claimed_at IS NULL;

-- Organizations
CREATE INDEX idx_org_members_user ON organization_members(user_id);
CREATE INDEX idx_org_members_org  ON organization_members(org_id);
CREATE INDEX idx_org_members_active ON organization_members(user_id, is_active) WHERE is_active = TRUE;

-- Venues
CREATE INDEX idx_venues_org       ON venues(org_id);
CREATE INDEX idx_venues_visibility ON venues(visibility) WHERE is_active = TRUE;
CREATE INDEX idx_venue_sections_layout ON venue_sections(layout_id);
CREATE INDEX idx_venue_items_section ON venue_items(section_id);
CREATE INDEX idx_venue_layouts_venue ON venue_layouts(venue_id);

-- Events
CREATE INDEX idx_events_org    ON events(organizer_org_id);
CREATE INDEX idx_events_status ON events(status);
CREATE INDEX idx_events_org_status ON events(organizer_org_id, status);

-- Occurrences
CREATE INDEX idx_occurrences_event  ON event_occurrences(event_id);
CREATE INDEX idx_occurrences_venue  ON event_occurrences(venue_id);
CREATE INDEX idx_occurrences_date   ON event_occurrences(occurrence_date);
CREATE INDEX idx_occurrences_layout ON event_occurrences(venue_layout_id);

-- Inquiries
CREATE INDEX idx_inquiries_event ON venue_inquiries(event_id);
CREATE INDEX idx_inquiries_venue ON venue_inquiries(venue_id);
CREATE INDEX idx_inquiries_org   ON venue_inquiries(organizer_org_id);
CREATE INDEX idx_inquiries_venue_owner ON venue_inquiries(venue_owner_org_id);

-- Availability
CREATE INDEX idx_va_venue_date ON venue_availability(venue_id, date);
CREATE INDEX idx_va_status     ON venue_availability(status);

-- Tiers & Packages
CREATE INDEX idx_tiers_occurrence     ON event_tiers(occurrence_id);
CREATE INDEX idx_tier_sections_section ON tier_sections(section_id);
CREATE INDEX idx_packages_occurrence  ON occurrence_packages(occurrence_id);
CREATE INDEX idx_pkg_tier ON occurrence_packages(tier_id) WHERE tier_id IS NOT NULL;
CREATE INDEX idx_pkg_section ON occurrence_packages(table_section_id) WHERE table_section_id IS NOT NULL;

-- Bundles
CREATE INDEX idx_bundle_types_event ON bundle_types(event_id);
CREATE INDEX idx_bto_occurrence     ON bundle_type_occurrences(occurrence_id);
CREATE INDEX idx_bto_tier ON bundle_type_occurrences(tier_id) WHERE tier_id IS NOT NULL;
CREATE INDEX idx_bto_package ON bundle_type_occurrences(package_id) WHERE package_id IS NOT NULL;
CREATE INDEX idx_bundles_event ON ticket_bundles(event_id);
CREATE INDEX idx_bundles_user  ON ticket_bundles(user_id);
CREATE INDEX idx_bundles_status ON ticket_bundles(status);

-- Tickets
CREATE INDEX idx_tickets_occurrence ON tickets(occurrence_id);
CREATE INDEX idx_tickets_user       ON tickets(user_id);
CREATE INDEX idx_tickets_qr         ON tickets(qr_token);
CREATE INDEX idx_tickets_bundle     ON tickets(bundle_id);
CREATE INDEX idx_tickets_status     ON tickets(status);
CREATE INDEX idx_tickets_tier       ON tickets(tier_id);
CREATE INDEX idx_tickets_occ_status ON tickets(occurrence_id, status);
CREATE INDEX idx_tickets_user_purchased ON tickets(user_id, purchased_at DESC)
    WHERE status NOT IN ('cancelled', 'expired');

-- Item statuses
CREATE INDEX idx_item_status_occ ON occurrence_item_status(occurrence_id, item_id);
CREATE INDEX idx_item_status_locked_expires ON occurrence_item_status(reserved_until)
    WHERE status = 'locked' AND reserved_until IS NOT NULL;
CREATE INDEX idx_item_status_locked_by ON occurrence_item_status(locked_by)
    WHERE locked_by IS NOT NULL;

-- Reservations
CREATE INDEX idx_reservations_occurrence ON table_reservations(occurrence_id);
CREATE INDEX idx_reservations_item       ON table_reservations(item_id);
CREATE INDEX idx_reservations_user       ON table_reservations(user_id);
CREATE INDEX idx_reservations_status     ON table_reservations(status);
CREATE INDEX idx_reservations_expires    ON table_reservations(expires_at)
    WHERE source = 'standalone' AND status = 'pending';

-- Orders
CREATE INDEX idx_orders_user    ON orders(user_id);
CREATE INDEX idx_orders_org     ON orders(org_id);
CREATE INDEX idx_orders_status  ON orders(status);
CREATE INDEX idx_orders_created ON orders(created_at DESC);
CREATE INDEX idx_orders_gateway_session ON orders(gateway_session_id)
    WHERE gateway_session_id IS NOT NULL;
CREATE INDEX idx_orders_pending_expiry ON orders(expires_at)
    WHERE status IN ('draft', 'pending_payment');

-- Order items
CREATE INDEX idx_oi_order ON order_items(order_id);
CREATE INDEX idx_oi_item  ON order_items(item_type, item_id);

-- Transactions
CREATE INDEX idx_txn_order   ON transactions(order_id);
CREATE INDEX idx_txn_parent  ON transactions(parent_transaction_id) WHERE parent_transaction_id IS NOT NULL;
CREATE INDEX idx_txn_gateway ON transactions(gateway_payment_id) WHERE gateway_payment_id IS NOT NULL;
CREATE INDEX idx_txn_type_status ON transactions(transaction_type, status);

-- Payment orders
CREATE INDEX idx_po_from_org    ON payment_orders(from_org_id);
CREATE INDEX idx_po_to_org      ON payment_orders(to_org_id);
CREATE INDEX idx_po_occurrence  ON payment_orders(occurrence_id);

-- Audit log
CREATE INDEX idx_audit_org    ON audit_log(org_id, created_at DESC);
CREATE INDEX idx_audit_entity ON audit_log(entity_type, entity_id);
CREATE INDEX idx_audit_user   ON audit_log(user_id, created_at DESC);
CREATE INDEX idx_audit_time   ON audit_log(created_at DESC);


-- ############################################################
-- 43. RLS POLICIES
-- ############################################################

-- Helper: je li korisnik član organizacije
-- (koristi se u policy definicijama)

-- ---- PROFILES ----
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY profiles_own ON profiles FOR ALL USING (auth.uid() = id);
CREATE POLICY profiles_public_read ON profiles FOR SELECT USING (TRUE);
-- Svatko može vidjeti profile (za prikaz imena), ali editirati samo svoj

-- ---- USER PREFERENCES ----
ALTER TABLE user_preferences ENABLE ROW LEVEL SECURITY;
CREATE POLICY prefs_own ON user_preferences FOR ALL USING (auth.uid() = user_id);

-- ---- ORGANIZATIONS ----
ALTER TABLE organizations ENABLE ROW LEVEL SECURITY;
CREATE POLICY orgs_public_read ON organizations FOR SELECT USING (is_active = TRUE);
CREATE POLICY orgs_member_write ON organizations FOR UPDATE USING (
    id IN (SELECT org_id FROM organization_members WHERE user_id = auth.uid() AND role IN ('owner', 'admin') AND is_active = TRUE)
);

-- ---- ORGANIZATION MEMBERS ----
ALTER TABLE organization_members ENABLE ROW LEVEL SECURITY;
CREATE POLICY om_member_read ON organization_members FOR SELECT USING (
    org_id IN (SELECT org_id FROM organization_members WHERE user_id = auth.uid() AND is_active = TRUE)
);
CREATE POLICY om_admin_write ON organization_members FOR ALL USING (
    org_id IN (SELECT org_id FROM organization_members WHERE user_id = auth.uid() AND role IN ('owner', 'admin') AND is_active = TRUE)
);

-- ---- VENUES ----
ALTER TABLE venues ENABLE ROW LEVEL SECURITY;
CREATE POLICY venues_public_read ON venues FOR SELECT USING (
    visibility = 'public' AND is_active = TRUE
);
CREATE POLICY venues_unlisted_read ON venues FOR SELECT USING (
    visibility = 'unlisted' AND is_active = TRUE
);
CREATE POLICY venues_owner_all ON venues FOR ALL USING (
    org_id IN (SELECT org_id FROM organization_members WHERE user_id = auth.uid() AND is_active = TRUE)
);
-- Organizator vidi venue ako ima aktivni inquiry
CREATE POLICY venues_inquiry_read ON venues FOR SELECT USING (
    id IN (SELECT venue_id FROM venue_inquiries WHERE organizer_org_id IN (
        SELECT org_id FROM organization_members WHERE user_id = auth.uid() AND is_active = TRUE
    ))
);

-- ---- VENUE LAYOUTS ----
ALTER TABLE venue_layouts ENABLE ROW LEVEL SECURITY;
CREATE POLICY layouts_owner ON venue_layouts FOR ALL USING (
    venue_id IN (SELECT id FROM venues WHERE org_id IN (
        SELECT org_id FROM organization_members WHERE user_id = auth.uid() AND is_active = TRUE
    ))
);
CREATE POLICY layouts_public_read ON venue_layouts FOR SELECT USING (
    venue_id IN (SELECT id FROM venues WHERE visibility IN ('public', 'unlisted') AND is_active = TRUE)
);

-- ---- VENUE SECTIONS & ITEMS ----
ALTER TABLE venue_sections ENABLE ROW LEVEL SECURITY;
CREATE POLICY sections_layout_access ON venue_sections FOR SELECT USING (
    layout_id IN (SELECT id FROM venue_layouts)  -- RLS na venue_layouts filtrira
);
CREATE POLICY sections_owner_write ON venue_sections FOR ALL USING (
    layout_id IN (SELECT vl.id FROM venue_layouts vl JOIN venues v ON v.id = vl.venue_id
        WHERE v.org_id IN (SELECT org_id FROM organization_members WHERE user_id = auth.uid() AND is_active = TRUE))
);

ALTER TABLE venue_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY items_section_access ON venue_items FOR SELECT USING (
    section_id IN (SELECT id FROM venue_sections)
);
CREATE POLICY items_owner_write ON venue_items FOR ALL USING (
    section_id IN (SELECT vs.id FROM venue_sections vs JOIN venue_layouts vl ON vl.id = vs.layout_id
        JOIN venues v ON v.id = vl.venue_id
        WHERE v.org_id IN (SELECT org_id FROM organization_members WHERE user_id = auth.uid() AND is_active = TRUE))
);

-- ---- VENUE RENTAL TERMS ----
ALTER TABLE venue_rental_terms ENABLE ROW LEVEL SECURITY;
CREATE POLICY vrt_owner ON venue_rental_terms FOR ALL USING (
    venue_id IN (SELECT id FROM venues WHERE org_id IN (
        SELECT org_id FROM organization_members WHERE user_id = auth.uid() AND is_active = TRUE
    ))
);
CREATE POLICY vrt_public_visible ON venue_rental_terms FOR SELECT USING (
    is_publicly_visible = TRUE AND is_active = TRUE
);

-- ---- EVENTS ----
ALTER TABLE events ENABLE ROW LEVEL SECURITY;
CREATE POLICY events_published_read ON events FOR SELECT USING (status = 'published');
CREATE POLICY events_org_all ON events FOR ALL USING (
    organizer_org_id IN (SELECT org_id FROM organization_members WHERE user_id = auth.uid() AND is_active = TRUE)
);

-- ---- EVENT OCCURRENCES ----
ALTER TABLE event_occurrences ENABLE ROW LEVEL SECURITY;
CREATE POLICY occ_published_read ON event_occurrences FOR SELECT USING (
    event_id IN (SELECT id FROM events WHERE status = 'published')
);
CREATE POLICY occ_org_all ON event_occurrences FOR ALL USING (
    event_id IN (SELECT id FROM events WHERE organizer_org_id IN (
        SELECT org_id FROM organization_members WHERE user_id = auth.uid() AND is_active = TRUE
    ))
);

-- ---- EVENT TIERS ----
ALTER TABLE event_tiers ENABLE ROW LEVEL SECURITY;
CREATE POLICY tiers_published_read ON event_tiers FOR SELECT USING (
    occurrence_id IN (SELECT id FROM event_occurrences WHERE event_id IN (
        SELECT id FROM events WHERE status = 'published'
    ))
);
CREATE POLICY tiers_org_all ON event_tiers FOR ALL USING (
    occurrence_id IN (SELECT eo.id FROM event_occurrences eo JOIN events e ON e.id = eo.event_id
        WHERE e.organizer_org_id IN (SELECT org_id FROM organization_members WHERE user_id = auth.uid() AND is_active = TRUE))
);

-- ---- TICKETS ----
ALTER TABLE tickets ENABLE ROW LEVEL SECURITY;
CREATE POLICY tickets_own ON tickets FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY tickets_org_read ON tickets FOR SELECT USING (
    occurrence_id IN (SELECT eo.id FROM event_occurrences eo JOIN events e ON e.id = eo.event_id
        WHERE e.organizer_org_id IN (SELECT org_id FROM organization_members WHERE user_id = auth.uid() AND is_active = TRUE))
);

-- ---- TICKET BUNDLES ----
ALTER TABLE ticket_bundles ENABLE ROW LEVEL SECURITY;
CREATE POLICY bundles_own ON ticket_bundles FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY bundles_org_read ON ticket_bundles FOR SELECT USING (
    event_id IN (SELECT id FROM events WHERE organizer_org_id IN (
        SELECT org_id FROM organization_members WHERE user_id = auth.uid() AND is_active = TRUE
    ))
);

-- ---- ORDERS ----
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;
CREATE POLICY orders_own ON orders FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY orders_org ON orders FOR SELECT USING (
    org_id IN (SELECT org_id FROM organization_members WHERE user_id = auth.uid() AND is_active = TRUE)
);

-- ---- ORDER ITEMS ----
ALTER TABLE order_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY oi_through_order ON order_items FOR SELECT USING (
    order_id IN (SELECT id FROM orders)  -- RLS na orders filtrira
);

-- ---- TRANSACTIONS ----
ALTER TABLE transactions ENABLE ROW LEVEL SECURITY;
CREATE POLICY txn_through_order ON transactions FOR SELECT USING (
    order_id IN (SELECT id FROM orders)
);

-- ---- TABLE RESERVATIONS ----
ALTER TABLE table_reservations ENABLE ROW LEVEL SECURITY;
CREATE POLICY reserv_own ON table_reservations FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY reserv_org ON table_reservations FOR SELECT USING (
    occurrence_id IN (SELECT eo.id FROM event_occurrences eo JOIN events e ON e.id = eo.event_id
        WHERE e.organizer_org_id IN (SELECT org_id FROM organization_members WHERE user_id = auth.uid() AND is_active = TRUE))
);

-- ---- OCCURRENCE ITEM STATUS ----
ALTER TABLE occurrence_item_status ENABLE ROW LEVEL SECURITY;
-- Svi vide status (available/sold/locked) za seat map
CREATE POLICY ois_public_read ON occurrence_item_status FOR SELECT USING (TRUE);
CREATE POLICY ois_org_write ON occurrence_item_status FOR ALL USING (
    occurrence_id IN (SELECT eo.id FROM event_occurrences eo JOIN events e ON e.id = eo.event_id
        WHERE e.organizer_org_id IN (SELECT org_id FROM organization_members WHERE user_id = auth.uid() AND is_active = TRUE))
);

-- ---- PAYMENT ORDERS ----
ALTER TABLE payment_orders ENABLE ROW LEVEL SECURITY;
CREATE POLICY po_from_org ON payment_orders FOR ALL USING (
    from_org_id IN (SELECT org_id FROM organization_members WHERE user_id = auth.uid() AND is_active = TRUE)
);
CREATE POLICY po_to_org ON payment_orders FOR SELECT USING (
    to_org_id IN (SELECT org_id FROM organization_members WHERE user_id = auth.uid() AND is_active = TRUE)
);

-- ---- VENUE INQUIRIES ----
ALTER TABLE venue_inquiries ENABLE ROW LEVEL SECURITY;
CREATE POLICY inq_organizer ON venue_inquiries FOR ALL USING (
    organizer_org_id IN (SELECT org_id FROM organization_members WHERE user_id = auth.uid() AND is_active = TRUE)
);
CREATE POLICY inq_venue_owner ON venue_inquiries FOR ALL USING (
    venue_owner_org_id IN (SELECT org_id FROM organization_members WHERE user_id = auth.uid() AND is_active = TRUE)
);

ALTER TABLE venue_inquiry_dates ENABLE ROW LEVEL SECURITY;
CREATE POLICY vid_through_inquiry ON venue_inquiry_dates FOR SELECT USING (
    inquiry_id IN (SELECT id FROM venue_inquiries)
);

ALTER TABLE venue_inquiry_responses ENABLE ROW LEVEL SECURITY;
CREATE POLICY vir_through_inquiry ON venue_inquiry_responses FOR SELECT USING (
    inquiry_id IN (SELECT id FROM venue_inquiries)
);

-- ---- AUDIT LOG ----
ALTER TABLE audit_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY audit_org_read ON audit_log FOR SELECT USING (
    org_id IN (SELECT org_id FROM organization_members WHERE user_id = auth.uid()
        AND role IN ('owner', 'admin') AND is_active = TRUE)
);

-- ---- TAGS (javni, read-only za sve) ----
ALTER TABLE tags ENABLE ROW LEVEL SECURITY;
CREATE POLICY tags_public ON tags FOR SELECT USING (TRUE);

-- ---- SUPPORTED CURRENCIES (javni) ----
ALTER TABLE supported_currencies ENABLE ROW LEVEL SECURITY;
CREATE POLICY currencies_public ON supported_currencies FOR SELECT USING (TRUE);

-- ---- REMAINING JUNCTIONS (read through parent RLS) ----
ALTER TABLE event_tags ENABLE ROW LEVEL SECURITY;
CREATE POLICY et_public ON event_tags FOR SELECT USING (TRUE);

ALTER TABLE venue_tags ENABLE ROW LEVEL SECURITY;
CREATE POLICY vt_public ON venue_tags FOR SELECT USING (TRUE);

ALTER TABLE tier_sections ENABLE ROW LEVEL SECURITY;
CREATE POLICY ts_public ON tier_sections FOR SELECT USING (TRUE);

ALTER TABLE bundle_types ENABLE ROW LEVEL SECURITY;
CREATE POLICY bt_published_read ON bundle_types FOR SELECT USING (
    event_id IN (SELECT id FROM events WHERE status = 'published')
);
CREATE POLICY bt_org_all ON bundle_types FOR ALL USING (
    event_id IN (SELECT id FROM events WHERE organizer_org_id IN (
        SELECT org_id FROM organization_members WHERE user_id = auth.uid() AND is_active = TRUE
    ))
);

ALTER TABLE bundle_type_occurrences ENABLE ROW LEVEL SECURITY;
CREATE POLICY bto_public ON bundle_type_occurrences FOR SELECT USING (TRUE);

ALTER TABLE occurrence_packages ENABLE ROW LEVEL SECURITY;
CREATE POLICY op_published ON occurrence_packages FOR SELECT USING (
    occurrence_id IN (SELECT id FROM event_occurrences WHERE event_id IN (
        SELECT id FROM events WHERE status = 'published'
    ))
);
CREATE POLICY op_org_all ON occurrence_packages FOR ALL USING (
    occurrence_id IN (SELECT eo.id FROM event_occurrences eo JOIN events e ON e.id = eo.event_id
        WHERE e.organizer_org_id IN (SELECT org_id FROM organization_members WHERE user_id = auth.uid() AND is_active = TRUE))
);

ALTER TABLE venue_availability ENABLE ROW LEVEL SECURITY;
CREATE POLICY va_owner ON venue_availability FOR ALL USING (
    venue_id IN (SELECT id FROM venues WHERE org_id IN (
        SELECT org_id FROM organization_members WHERE user_id = auth.uid() AND is_active = TRUE
    ))
);
CREATE POLICY va_inquiry_read ON venue_availability FOR SELECT USING (
    inquiry_id IN (SELECT id FROM venue_inquiries)
);


-- ############################################################
-- 44. VIEWOVI (SECURITY INVOKER)
-- ############################################################

CREATE OR REPLACE VIEW user_tickets_view
WITH (security_invoker = true)
AS
SELECT
    t.id AS ticket_id, t.status AS ticket_status, t.qr_token,
    t.purchased_at, t.scanned_at, t.remaining_drinks,
    t.created_at, t.user_id,
    e.name AS event_name, e.cover_image_url,
    eo.occurrence_date, eo.start_time, eo.end_time,
    v.name AS venue_name, v.city AS venue_city,
    et.name AS tier_name, et.price AS tier_price, et.currency,
    tb.id AS bundle_id, bt.name AS bundle_name,
    tb.status AS bundle_status, tb.total_price AS bundle_price,
    op.name AS package_name, op.price AS package_price,
    vi.identifier AS item_identifier, vs.name AS section_name,
    o.order_number, o.id AS order_id,
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


CREATE OR REPLACE VIEW user_transactions_view
WITH (security_invoker = true)
AS
SELECT
    txn.id AS transaction_id, txn.transaction_type,
    txn.amount, txn.currency, txn.status AS transaction_status,
    txn.created_at AS transaction_date, txn.gateway_payment_id,
    txn.parent_transaction_id, txn.metadata AS transaction_metadata,
    o.id AS order_id, o.order_number, o.user_id, o.org_id,
    o.total_amount AS order_total, o.status AS order_status, o.completed_at,
    pg.gateway_type, pg.display_name AS gateway_name,
    org.name AS organization_name,
    (SELECT jsonb_agg(jsonb_build_object(
        'item_type', oi.item_type, 'description', oi.description,
        'quantity', oi.quantity, 'subtotal', oi.subtotal,
        'status', oi.status, 'refunded_amount', oi.refunded_amount
    )) FROM order_items oi WHERE oi.order_id = o.id) AS items
FROM   transactions txn
JOIN   orders o ON o.id = txn.order_id
LEFT JOIN payment_gateways pg ON pg.id = txn.gateway_id
LEFT JOIN organizations org ON org.id = o.org_id;


CREATE OR REPLACE VIEW org_revenue_view
WITH (security_invoker = true)
AS
SELECT
    o.org_id, o.id AS order_id, o.order_number,
    o.user_id AS customer_id, o.total_amount, o.currency,
    o.status AS order_status, o.completed_at,
    (SELECT COALESCE(SUM(amount), 0) FROM transactions
     WHERE order_id = o.id AND transaction_type = 'charge' AND status = 'completed'
    ) AS total_charged,
    (SELECT COALESCE(SUM(amount), 0) FROM transactions
     WHERE order_id = o.id AND transaction_type = 'refund' AND status = 'completed'
    ) AS total_refunded,
    (SELECT COUNT(*) FROM order_items WHERE order_id = o.id) AS item_count,
    pg.gateway_type, pg.display_name AS gateway_name
FROM   orders o
LEFT JOIN payment_gateways pg ON pg.id = o.gateway_id;


-- ############################################################
-- 45. pg_cron RASPORED
-- ############################################################

/*
-- Pokreni u Supabase SQL Editoru zasebno:

SELECT cron.schedule('expire-standalone-reservations', '*/5 * * * *', 'SELECT expire_standalone_reservations()');
SELECT cron.schedule('expire-seat-locks', '* * * * *', 'SELECT expire_seat_locks()');
SELECT cron.schedule('expire-pending-orders', '*/2 * * * *', 'SELECT expire_pending_orders()');
*/


-- ============================================================
-- KRAJ SCHEMA v6.0
-- ============================================================
-- Ukupno:
--   35 tablica + 3 viewa
--   25+ triggera
--   22+ funkcija
--   70+ indeksa
--   40+ RLS politika
-- ============================================================