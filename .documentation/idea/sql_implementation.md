<img src="https://r2cdn.perplexity.ai/pplx-full-logo-primary-dark%402x.png" style="height:64px;margin-right:32px"/>

# 1. B) 1:N

2. Mi ne možemo sakupljati sve jer nemamo poslovni subjekt. Neka bude sve na razini vrste organizacije npr da  organizatori i vlasnici prostora mogu spadati u organizacijske grupe kako bi imali mogućnost više korisnika za tu organizaciju da spajamo organizacije organizatora i organizacije vlasnika umjesto samih računa ako entiteta.
Organizatori će plaćati naknadu prodaje vlasnicima prema nalogu iz sustava
3. Želimo imati koordinate za svaki venue u lokalnim datotekama a statuse tih sjedala/ulaznica da imamo u bazi vezano uz događaje bili oni numerirani ili nenumerirani.
Imat ćemo jedan folder unutar backenda u koji ćemo spremati prema organizaciji njihove venue.json koji će služiti za grafički prikaz i sjedala i objekata koji se nalaze na tlocrtu, ostatak selekcije i boje i statusi moraju biti handleani na backendu
Ako imaš još pitanja slobodno pitaj

Savršeno — imam sve potrebne informacije. Krećem s kompletnom shemom i workflow dokumentacijom.

## Arhitekturne odluke (ključne)

Prije SQL-a, 4 dizajn odluke koje su utjecale na cijelu shemu:

- **`events` + `event_occurrences`** — event je "definicija" (naziv, opis, organizacija), occurrence je "izvedba" (datum, prostor, kapacitet, cijene)
- **`venue_items`** — unificiran entitet za sjedala i stolove; koordinate žive u JSON fajlu, DB čuva samo logičku strukturu i statuse
- **`organizations`** kao centralni entitet umjesto korisnika — payment gatewayi, payment orderi i member roles vežu se na org, ne na usera
- **`payment_orders`** kao nalog za plaćanje (bez centralnog prikupljanja) — sustav generira nalog, organizator plaća vlasniku izravno, proof se uploadira

***

## SQL Shema

```sql
-- ============================================================
-- NOIR — Database Schema v1.0
-- Supabase (PostgreSQL) | Ožujak 2026.
-- ============================================================

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
    preferred_days  INT[]        DEFAULT '{}',   -- 0=Ned … 6=Sub
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
    bank_account_iban   VARCHAR(50),        -- za payment ordere
    bank_account_name   VARCHAR(255),
    address             TEXT,
    city                VARCHAR(100),
    country             VARCHAR(2)   DEFAULT 'HR',
    is_verified         BOOLEAN      DEFAULT FALSE,   -- admin verificira
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
-- 4. PAYMENT GATEWAYI (po organizaciji)
-- ============================================================

CREATE TYPE gateway_type AS ENUM (
    'stripe', 'paypal', 'monri', 'wspay', 'keks_pay', 'bank_transfer', 'cash'
);

CREATE TABLE payment_gateways (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id        UUID REFERENCES organizations(id) ON DELETE CASCADE,
    -- NULL = platforma default (admin konfigurira dostupne opcije)
    gateway_type  gateway_type NOT NULL,
    display_name  VARCHAR(100),
    is_active     BOOLEAN DEFAULT TRUE,
    is_default    BOOLEAN DEFAULT FALSE,
    credentials   JSONB,   -- kriptirano na app sloju (API ključevi)
    config        JSONB,   -- nesenzitivna konfiguracija (webhook URL-ovi)
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
    category    VARCHAR(50),    -- 'music', 'venue_type', 'event_type'
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
    amenities           JSONB,   -- {"parking": true, "coat_check": true, ...}
    layout_file_path    VARCHAR(500),  -- /venues/{org_id}/{venue_id}.json
    layout_version      INT DEFAULT 1, -- bumpa se kad se JSON mijenja
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
-- Vizualne koordinate žive u JSON fajlu.
-- DB čuva: logičku strukturu, identifikatore i statuse.

CREATE TYPE section_type AS ENUM (
    'standing', 'seated', 'table_area', 'vip_lounge', 'vip_table', 'stage', 'other'
);

CREATE TABLE venue_sections (
    id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    venue_id         UUID NOT NULL REFERENCES venues(id) ON DELETE CASCADE,
    name             VARCHAR(100) NOT NULL,   -- "Pod", "Balkon", "VIP"
    section_type     section_type NOT NULL,
    is_numbered      BOOLEAN NOT NULL DEFAULT FALSE,
    default_capacity INT NOT NULL,
    sort_order       INT DEFAULT 0,
    json_id          VARCHAR(100),   -- odgovara ID elementu u JSON fajlu
    description      TEXT,
    is_active        BOOLEAN DEFAULT TRUE
);

CREATE TYPE item_type AS ENUM ('seat', 'table');

CREATE TABLE venue_items (
    id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    section_id   UUID NOT NULL REFERENCES venue_sections(id) ON DELETE CASCADE,
    item_type    item_type NOT NULL,
    identifier   VARCHAR(50) NOT NULL,   -- "A-5", "T3", "VIP-1"
    row_label    VARCHAR(20),            -- za sjedala: "A", "B"
    seat_number  INT,                    -- za sjedala: 5
    capacity     INT NOT NULL DEFAULT 1, -- za stolove: broj mjesta
    json_id      VARCHAR(100),           -- odgovara ID elementu u JSON fajlu
    is_active    BOOLEAN DEFAULT TRUE,
    UNIQUE(section_id, identifier)
);

-- ============================================================
-- 8. VENUE UVJETI NAJMA (default ponuda vlasnika)
-- ============================================================

CREATE TYPE rental_pricing_model AS ENUM (
    'fixed', 'revenue_share', 'hybrid', 'free', 'negotiable'
);

CREATE TABLE venue_rental_terms (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    venue_id            UUID NOT NULL REFERENCES venues(id) ON DELETE CASCADE,
    name                VARCHAR(100),   -- "Vikend tarifa", "Radni dan"
    pricing_model       rental_pricing_model NOT NULL,
    fixed_amount        DECIMAL(10,2),
    fixed_currency      VARCHAR(3)  DEFAULT 'EUR',
    revenue_share_pct   DECIMAL(5,2),   -- 15.00 = 15%
    revenue_base        VARCHAR(50),    -- 'gross_ticket_sales' | 'net_after_fee'
    min_guarantee       DECIMAL(10,2),  -- hybrid: minimalni fiksni iznos
    applies_to_days     INT[],          -- [5,6] = Pet+Sub
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
    'draft',
    'sent',
    'under_review',
    'terms_proposed',
    'organizer_reviewing',
    'accepted',
    'rejected',
    'cancelled',
    'expired'
);

CREATE TABLE venue_inquiries (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    event_id            UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
    organizer_org_id    UUID NOT NULL REFERENCES organizations(id),
    venue_id            UUID NOT NULL REFERENCES venues(id),
    venue_owner_org_id  UUID NOT NULL REFERENCES organizations(id),
    message             TEXT,
    status              inquiry_status NOT NULL DEFAULT 'draft',
    expires_at          TIMESTAMPTZ,   -- vlasnik mora odgovoriti do tada
    created_by          UUID REFERENCES auth.users(id),
    created_at          TIMESTAMPTZ DEFAULT NOW(),
    updated_at          TIMESTAMPTZ DEFAULT NOW()
);

-- 1:N datumi unutar jednog upita
CREATE TABLE venue_inquiry_dates (
    id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    inquiry_id       UUID NOT NULL REFERENCES venue_inquiries(id) ON DELETE CASCADE,
    occurrence_date  DATE NOT NULL,
    start_time       TIME NOT NULL,
    end_time         TIME NOT NULL,
    notes            TEXT,
    is_available     BOOLEAN,   -- validira se pri insertu (conflict check)
    sort_order       INT DEFAULT 0
);

-- Odgovori vlasnika (kontra-prijedlozi, odbijanja, pitanja)
CREATE TYPE inquiry_response_type AS ENUM (
    'accepted', 'rejected', 'counter_proposal', 'info_request'
);

CREATE TABLE venue_inquiry_responses (
    id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    inquiry_id       UUID NOT NULL REFERENCES venue_inquiries(id) ON DELETE CASCADE,
    responder_user_id UUID REFERENCES auth.users(id),
    responder_org_id  UUID REFERENCES organizations(id),
    response_type    inquiry_response_type NOT NULL,
    message          TEXT,
    proposed_terms   JSONB,
    -- {pricing_model, fixed_amount, revenue_share_pct, min_guarantee, notes}
    created_at       TIMESTAMPTZ DEFAULT NOW()
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
    total_capacity          INT,        -- može overridati venue kapacitet
    sold_count              INT DEFAULT 0,    -- denormalizirano za performance
    notes                   TEXT,
    rental_terms_snapshot   JSONB,      -- snimka dogovorenih uvjeta najma
    created_at              TIMESTAMPTZ DEFAULT NOW(),
    updated_at              TIMESTAMPTZ DEFAULT NOW()
);

-- Dostupnost prostora (blokira se kad se occurrence potvrdi)
CREATE TABLE venue_availability (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    venue_id      UUID NOT NULL REFERENCES venues(id) ON DELETE CASCADE,
    date          DATE NOT NULL,
    start_time    TIME NOT NULL,
    end_time      TIME NOT NULL,
    status        VARCHAR(20) DEFAULT 'blocked',  -- blocked | available | tentative
    occurrence_id UUID REFERENCES event_occurrences(id),
    created_at    TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(venue_id, date, occurrence_id)
);

-- ============================================================
-- 12. TIEROVI & PAKETI PO IZVEDBI
-- ============================================================

CREATE TABLE event_tiers (
    id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    occurrence_id           UUID NOT NULL REFERENCES event_occurrences(id) ON DELETE CASCADE,
    name                    VARCHAR(100) NOT NULL,  -- "Early Bird", "Regular", "Free"
    description             TEXT,
    price                   DECIMAL(10,2) NOT NULL DEFAULT 0,
    currency                VARCHAR(3) DEFAULT 'EUR',
    total_count             INT NOT NULL,
    sold_count              INT DEFAULT 0,
    tier_order              INT NOT NULL DEFAULT 1,
    sale_start              TIMESTAMPTZ,
    sale_end                TIMESTAMPTZ,
    applicable_section_ids  UUID[],  -- NULL = vrijedi za sve sekcije
    is_active               BOOLEAN DEFAULT TRUE,
    created_at              TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE occurrence_packages (
    id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    occurrence_id    UUID NOT NULL REFERENCES event_occurrences(id) ON DELETE CASCADE,
    name             VARCHAR(100) NOT NULL,   -- "Basic", "Drink & Chill", "Squad Table"
    description      TEXT,
    price            DECIMAL(10,2) NOT NULL DEFAULT 0,
    currency         VARCHAR(3)  DEFAULT 'EUR',
    includes_entry   BOOLEAN DEFAULT TRUE,
    includes_drinks  INT DEFAULT 0,
    includes_table   BOOLEAN DEFAULT FALSE,
    items            JSONB,
    -- [{"type":"drink","qty":2},{"type":"merch","name":"Majica","size":"M"}]
    max_quantity     INT,
    sold_count       INT DEFAULT 0,
    is_active        BOOLEAN DEFAULT TRUE,
    created_at       TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- 13. ULAZNICE (tickets)
-- ============================================================

CREATE TYPE ticket_status AS ENUM (
    'reserved', 'pending_payment', 'active', 'scanned',
    'cancelled', 'refunded', 'expired'
);

CREATE TABLE tickets (
    id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    occurrence_id    UUID NOT NULL REFERENCES event_occurrences(id),
    user_id          UUID REFERENCES auth.users(id),    -- NULL = guest
    purchase_email   VARCHAR(255),                       -- za guest checkout
    tier_id          UUID NOT NULL REFERENCES event_tiers(id),
    package_id       UUID REFERENCES occurrence_packages(id),
    -- Dodjela mjesta (jedno od dvoje; oba NULL = opća stajaća mjesta)
    item_id          UUID REFERENCES venue_items(id),   -- numerirano sjedalo/stol
    section_id       UUID REFERENCES venue_sections(id),-- nenumirano (stajaće)
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

-- Status svakog numeriranog mjesta po izvedbi (za seat map prikaz)
CREATE TYPE item_availability AS ENUM (
    'available', 'reserved', 'sold', 'blocked', 'unavailable'
);

CREATE TABLE occurrence_item_status (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    occurrence_id   UUID NOT NULL REFERENCES event_occurrences(id) ON DELETE CASCADE,
    item_id         UUID NOT NULL REFERENCES venue_items(id) ON DELETE CASCADE,
    status          item_availability NOT NULL DEFAULT 'available',
    ticket_id       UUID REFERENCES tickets(id),
    reserved_until  TIMESTAMPTZ,   -- privremena rezervacija (košarica, npr. 10 min)
    updated_at      TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(occurrence_id, item_id)
);

-- ============================================================
-- 14. TRANSAKCIJE & PAYMENT ORDERI
-- ============================================================

CREATE TYPE transaction_status AS ENUM (
    'pending', 'completed', 'failed', 'refunded', 'disputed'
);

CREATE TABLE transactions (
    id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    ticket_id          UUID NOT NULL REFERENCES tickets(id),
    user_id            UUID REFERENCES auth.users(id),
    gateway_id         UUID REFERENCES payment_gateways(id),
    gateway_payment_id VARCHAR(255),   -- Stripe payment_intent_id itd.
    amount             DECIMAL(10,2) NOT NULL,
    currency           VARCHAR(3) DEFAULT 'EUR',
    platform_fee       DECIMAL(10,2),
    status             transaction_status NOT NULL DEFAULT 'pending',
    metadata           JSONB,
    created_at         TIMESTAMPTZ DEFAULT NOW(),
    updated_at         TIMESTAMPTZ DEFAULT NOW()
);

-- Nalog za plaćanje (organizator → vlasnik prostora)
CREATE TYPE payment_order_status AS ENUM (
    'draft', 'issued', 'paid', 'overdue', 'disputed', 'cancelled', 'waived'
);

CREATE TABLE payment_orders (
    id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    occurrence_id        UUID NOT NULL REFERENCES event_occurrences(id),
    from_org_id          UUID NOT NULL REFERENCES organizations(id),  -- organizator
    to_org_id            UUID NOT NULL REFERENCES organizations(id),  -- vlasnik prostora
    amount               DECIMAL(10,2) NOT NULL,
    currency             VARCHAR(3) DEFAULT 'EUR',
    calculation_details  JSONB,
    -- {model:"revenue_share", pct:15, gross_sales:2000, calculated:300}
    due_date             DATE,
    status               payment_order_status NOT NULL DEFAULT 'draft',
    payment_reference    VARCHAR(100),   -- za bankovni transfer
    proof_url            TEXT,           -- upload potvrde plaćanja
    notes                TEXT,
    issued_at            TIMESTAMPTZ,
    paid_at              TIMESTAMPTZ,
    issued_by            UUID REFERENCES auth.users(id),
    created_at           TIMESTAMPTZ DEFAULT NOW(),
    updated_at           TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- 15. INDEKSI
-- ============================================================

CREATE INDEX idx_events_org          ON events(organizer_org_id);
CREATE INDEX idx_events_status       ON events(status);
CREATE INDEX idx_occurrences_event   ON event_occurrences(event_id);
CREATE INDEX idx_occurrences_venue   ON event_occurrences(venue_id);
CREATE INDEX idx_occurrences_date    ON event_occurrences(occurrence_date);
CREATE INDEX idx_tickets_occurrence  ON tickets(occurrence_id);
CREATE INDEX idx_tickets_user        ON tickets(user_id);
CREATE INDEX idx_tickets_qr          ON tickets(qr_token);
CREATE INDEX idx_item_status_occ     ON occurrence_item_status(occurrence_id, item_id);
CREATE INDEX idx_org_members_user    ON organization_members(user_id);
CREATE INDEX idx_org_members_org     ON organization_members(org_id);
CREATE INDEX idx_venue_sections      ON venue_sections(venue_id);
CREATE INDEX idx_venue_items         ON venue_items(section_id);
CREATE INDEX idx_inquiries_event     ON venue_inquiries(event_id);
CREATE INDEX idx_inquiries_venue     ON venue_inquiries(venue_id);
CREATE INDEX idx_venue_availability  ON venue_availability(venue_id, date);
CREATE INDEX idx_tiers_occurrence    ON event_tiers(occurrence_id);
CREATE INDEX idx_packages_occurrence ON occurrence_packages(occurrence_id);
```


***

## Implementation Workflow

### Faze i ovisnosti

```
MILESTONE 1 — Temelj (Tjedan 1-2)
├── DB migracije (cijeli SQL gore)
├── Supabase RLS policies po tablicama
├── Seed: tagovi, admin user, platform default gateway
└── OUTPUT: funkcionalna baza, lokalni Supabase instance

MILESTONE 2 — Auth + Organizacije (Tjedan 2-3)
├── FastAPI: auth middleware (JWT decode iz Supabase)
├── RBAC helper: get_user_role(user_id, org_id) → org_member_role | platform_role
├── Endpointi: /auth/*, /organizations/*, /organization-members/*
├── Admin panel: organizations list, user-platform-roles CRUD
└── OUTPUT: prijava radi, RBAC middleware spreman za sve ostalo

MILESTONE 3 — Venues + JSON loader (Tjedan 3-4)
├── FastAPI: /venues/* CRUD (venue_owner role)
├── Venue Builder API: POST sekcije, POST stavke (venue_items)
├── JSON file service: sprema/čita /venues/{org_id}/{venue_id}.json
├── Conflict checker: je li datum slobodan (venue_availability query)
└── OUTPUT: venue owner može kreirati prostor s tlocrtom

MILESTONE 4 — Events + Inquiry flow (Tjedan 4-6)
├── FastAPI: /events/* CRUD (draft stage)
├── FastAPI: /venues/{id}/inquiries — pošalji upit s datumima
│   ├── Validacija: jesu li svi datumi slobodni
│   └── Automatski postavi expires_at (+5 dana)
├── FastAPI: /inquiries/{id}/respond — vlasnik odgovara
├── FastAPI: /inquiries/{id}/accept — organizator prihvaća uvjete
│   ├── Kreira event_occurrences za svaki datum iz inquiry_dates
│   ├── Blokira venue_availability
│   └── Kreira rental_terms_snapshot na occurrence
└── OUTPUT: cijeli B2B flow radi end-to-end

MILESTONE 5 — Ticketing (Tjedan 6-8)
├── FastAPI: /occurrences/{id}/tiers CRUD
├── FastAPI: /occurrences/{id}/packages CRUD
├── FastAPI: /occurrences/{id}/seat-map — vraća item statuse
├── FastAPI: POST /tickets/purchase
│   ├── Za numerirana mjesta: provjeri + rezerviraj occurrence_item_status
│   ├── Za stajaća: provjeri kapacitet sekcije
│   ├── Generiraj qr_token (UUID + HMAC potpis)
│   └── Kreira Transaction (pending)
├── Stripe webhook → transaction completed → ticket active
└── OUTPUT: kupnja ulaznica radi

MILESTONE 6 — QR + Payment Orders (Tjedan 8-9)
├── FastAPI: GET /tickets/{id}/qr — QR endpoint (door_staff/bar_staff)
├── FastAPI: POST /tickets/{id}/scan — idempotent scan
├── FastAPI: POST /tickets/{id}/redeem-drink — smanji remaining_drinks
├── FastAPI: POST /payment-orders — admin/auto generira nalog nakon eventa
└── OUTPUT: QR sustav radi on-site, payment orderi se generiraju

MILESTONE 7 — Analytics + Polish (Tjedan 10-12)
├── FastAPI: /analytics/event/{id} — KPIs (tickets, revenue, peak entry)
├── FastAPI: /analytics/venue/{id} — top organizatori, popunjenost
├── FastAPI: /analytics/export/{id} — CSV endpoint
└── OUTPUT: dashboardi puniju se realnim podacima
```


***

## JSON fajl struktura (venue builder)

Da bude jasno što ide u JSON, a što u bazu:

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

**Pravilo:** `json_id` u JSON fajlu = `json_id` u `venue_sections` ili `venue_items` tablici. Backend spaja statuse iz DB-a s koordinatama iz JSON fajla pri svakom pozivu seat-map endpointa.

***

## Branching strategija

```
main          ← samo stabilan, deployabilan kod
develop       ← aktivna integracija
feature/*     ← svaki feature zasebna grana (feature/auth, feature/venues itd.)
fix/*         ← bugfixevi
```

**PR pravilo:** svaki merge u `develop` mora imati barem jednu API test rouutovu koja prolazi. Merge u `main` samo na kraju milestonea.

