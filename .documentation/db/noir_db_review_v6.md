# NOIR — Database Architecture Review v6.0

> **Interni dokument tima** | Verzija 6.0 | Ožujak 2026.
> TVZ MC2 | Zagreb, Hrvatska
> Čisti start — konsolidacija svih odluka iz v2-v5 + nove arhitekturne promjene

---

## Sadržaj

1. Ključne arhitekturne promjene v5 → v6
2. Capability-based organizacije
3. Venue layout versioning
4. JSON schema za venue builder
5. RLS sigurnosni model
6. Pre-populacija occurrence item statusa
7. Section capacity enforcement
8. Seat lock poboljšanja
9. Self-hosted event flow
10. Door sale flow
11. Potpuni popis tablica (35 + 3 viewa)
12. Potpuni popis triggera i funkcija
13. Poznati edge caseovi — konsolidirani
14. App-level zadaci za FastAPI

---

## 1. Ključne arhitekturne promjene v5 → v6

| # | Promjena | Razlog |
|---|----------|--------|
| 1 | `org_type` ENUM → boolean capability flags | Skalabilnost — nove sposobnosti bez ALTER TYPE |
| 2 | `venue_layouts` tablica + verzioniranje | Zamrzavanje tlocrta po izvedbi |
| 3 | `venue_sections.venue_id` → `venue_sections.layout_id` | Sekcije pripadaju verziji layouta, ne venueu |
| 4 | `event_occurrences.venue_layout_id` | Occurrence veže se na konkretnu verziju tlocrta |
| 5 | `venue_visibility` ENUM (public/private/unlisted) | Kontrola vidljivosti prostora |
| 6 | `venue_rental_terms.is_publicly_visible` | Konfigurabilna vidljivost uvjeta najma |
| 7 | RLS politike na SVIM tablicama | Potpuna sigurnosna izolacija podataka |
| 8 | Viewovi s `security_invoker = true` | RLS se propagira kroz viewove |
| 9 | `transactions` (čisto ime, bez _v2 sufiksa) | Nema legacy tablice — čisti start |
| 10 | `gateway_type` + `door_sale` | Podrška za prodaju na licu mjesta |
| 11 | `populate_occurrence_items()` trigger | Auto pre-populacija seat mapa na on_sale |
| 12 | `enforce_section_capacity_limit()` | Kapacitetna zaštita na razini sekcije |
| 13 | `prevent_occurrence_venue_change()` | Potpuna blokada promjene venuea na occurrenceu |
| 14 | `extend_seat_locks_for_order()` | Lock traje koliko i order |
| 15 | Advisory lock u `lock_seat_for_checkout()` | Fix multi-lock race condition |
| 16 | Auto-compute layout/venue kapaciteta | Triggeri na venue_sections |
| 17 | `validate_tier_section_layout()` | Sekcija u tier_sections mora biti iz istog layouta |

---

## 2. Capability-based organizacije

### Stari model (v2-v5)
```sql
org_type ENUM ('organizer', 'venue_owner', 'both')
```

### Novi model (v6)
```sql
can_organize    BOOLEAN NOT NULL DEFAULT FALSE,
can_own_venues  BOOLEAN NOT NULL DEFAULT FALSE,
CONSTRAINT chk_org_has_capability CHECK (can_organize OR can_own_venues)
```

**Prednosti:**
- Nova sposobnost = nova boolean kolona, bez ALTER TYPE
- Nema kombinatoričke eksplozije (3 sposobnosti = 7 kombinacija s ENUM, 3 boolean kolone)
- Čistiji upiti: `WHERE can_organize = TRUE` umjesto `WHERE org_type IN ('organizer', 'both')`

### Member role permissions (app-level)
```python
# FastAPI config/permissions.py
ROLE_PERMISSIONS = {
    'owner': ['*'],
    'admin': ['manage_members', 'manage_finances', 'manage_events',
              'manage_venue', 'view_analytics', 'sell_at_door',
              'scan_ticket', 'redeem_drink'],
    'manager': ['manage_events', 'manage_venue', 'view_analytics',
                'sell_at_door', 'scan_ticket', 'redeem_drink'],
    'staff': ['sell_at_door', 'scan_ticket', 'redeem_drink',
              'manage_reservations'],
    'door_staff': ['scan_ticket', 'sell_at_door'],
    'bar_staff': ['redeem_drink', 'sell_at_door', 'scan_ticket'],
}
```

Permissions na app razini, ne u bazi. Razlog: mijenjaju se češće od schema. Nova rola ili nova dozvola ne zahtijeva DB migraciju.

---

## 3. Venue layout versioning

### Struktura
```
venues (prostor — ime, adresa, visibility)
  └── venue_layouts (verzija layouta — JSON path, kapacitet)
       └── venue_sections (sekcije unutar TE verzije)
            └── venue_items (stavke unutar TE sekcije)
```

### Flow kreiranja/editiranja layouta

**Scenarij A: Novi layout (nema occurrencea)**
1. Vlasnik otvori builder → nema layouta → prazan canvas
2. Drag & drop → klikne "Spremi"
3. Backend kreira `venue_layouts` (version=1, is_current=TRUE)
4. Parsira JSON → kreira `venue_sections` + `venue_items`
5. Sprema JSON na `/venues/{org_id}/{venue_id}/v1.json`
6. Trigger automatski računa `layout.total_capacity` i `venue.total_capacity`

**Scenarij B: Edit layouta, NEMA occurrencea na tom layoutu**
1. Vlasnik otvori builder → učita current layout
2. Napravi promjene → klikne "Spremi"
3. Backend provjeri: postoje li occurrences s ovim layout_id?
4. **NE** → update in-place: ažuriraj sekcije/itemse, prepiši JSON
5. Kapacitet se automatski rekalkulira

**Scenarij C: Edit layouta, POSTOJE occurrence na tom layoutu**
1. Vlasnik otvori builder → učita current layout
2. Napravi promjene → klikne "Spremi"
3. Backend provjeri: postoje li occurrences s ovim layout_id?
4. **DA** → kreiraj NOVU verziju:
   - Novi `venue_layouts` (version = old+1, is_current = TRUE)
   - KOPIRAJ sve sekcije i itemse (novi UUID-ovi)
   - Primijeni promjene na kopirane zapise
   - Spremi novi JSON na `v{N}.json`
   - Stari layout: `is_current = FALSE`
   - Trigger ažurira venue.total_capacity

**Partial unique index** osigurava samo jedan `is_current = TRUE` po venueu:
```sql
CREATE UNIQUE INDEX idx_one_current_layout_per_venue
    ON venue_layouts(venue_id) WHERE is_current = TRUE;
```

### Implikacije
- Stare izvedbe i dalje referenciraju stare venue_items (stari UUID-ovi) — potpuna izolacija
- `tier_sections` za staru izvedbu pokazuje na sekcije iz starog layouta — validacijski trigger to provjerava
- Brisanje layouta koji ima occurrences = RESTRICT (ne dozvoljava se)
- JSON fajlovi se nikad ne brišu — ostaju za historijski pregled

---

## 4. JSON schema za venue builder

### Verzija 2.0 (proširena za SVG builder)

```json
{
  "venue_id": "uuid-venue",
  "layout_id": "uuid-layout",
  "schema_version": 2,
  "canvas": {
    "width": 1200,
    "height": 800,
    "background_color": "#0a0a1a"
  },
  "viewport": {
    "min_zoom": 0.5,
    "max_zoom": 3.0,
    "default_zoom": 1.0
  },
  "sections": [
    {
      "json_id": "section-floor",
      "db_id": "uuid-venue-section",
      "label": "Pod",
      "section_type": "standing",
      "fill_color": "#1a1a2e",
      "border_color": "#16213e",
      "opacity": 0.3,
      "shape": "polygon",
      "points": [[100,100],[900,100],[900,600],[100,600]],
      "z_index": 0,
      "capacity": 200,
      "is_numbered": false
    },
    {
      "json_id": "section-vip",
      "db_id": "uuid-venue-section",
      "label": "VIP Lounge",
      "section_type": "vip_lounge",
      "fill_color": "#2d1b4e",
      "border_color": "#6c3483",
      "opacity": 0.4,
      "shape": "rect",
      "x": 100,
      "y": 620,
      "width": 400,
      "height": 160,
      "z_index": 0,
      "capacity": 30,
      "is_numbered": true
    }
  ],
  "items": [
    {
      "json_id": "seat-a-1",
      "db_id": "uuid-venue-item",
      "section_json_id": "section-floor",
      "item_type": "seat",
      "shape_preset": "circle",
      "x": 150,
      "y": 150,
      "radius": 12,
      "rotation": 0,
      "label": "A-1",
      "label_position": "below",
      "z_index": 10,
      "capacity": 1
    },
    {
      "json_id": "table-vip-1",
      "db_id": "uuid-venue-item",
      "section_json_id": "section-vip",
      "item_type": "table",
      "shape_preset": "round_table_6",
      "x": 200,
      "y": 700,
      "radius": 40,
      "rotation": 0,
      "label": "VIP-1",
      "label_position": "center",
      "z_index": 10,
      "capacity": 6,
      "chair_positions": [
        {"angle": 0, "offset": 55},
        {"angle": 60, "offset": 55},
        {"angle": 120, "offset": 55},
        {"angle": 180, "offset": 55},
        {"angle": 240, "offset": 55},
        {"angle": 300, "offset": 55}
      ]
    },
    {
      "json_id": "table-rect-1",
      "db_id": "uuid-venue-item",
      "section_json_id": "section-floor",
      "item_type": "table",
      "shape_preset": "rectangular_table",
      "x": 600,
      "y": 300,
      "width": 120,
      "height": 60,
      "rotation": 30,
      "label": "T1",
      "label_position": "center",
      "z_index": 10,
      "capacity": 8,
      "chair_positions": [
        {"side": "top", "count": 3},
        {"side": "bottom", "count": 3},
        {"side": "left", "count": 1},
        {"side": "right", "count": 1}
      ]
    }
  ],
  "static_objects": [
    {
      "json_id": "stage-main",
      "label": "Bina",
      "shape": "rect",
      "x": 0,
      "y": 0,
      "width": 1200,
      "height": 80,
      "fill_color": "#333333",
      "border_color": "#555555",
      "z_index": 5
    },
    {
      "json_id": "bar-main",
      "label": "Bar",
      "shape": "rect",
      "x": 950,
      "y": 100,
      "width": 40,
      "height": 500,
      "fill_color": "#2d2d2d",
      "border_color": "#444444",
      "z_index": 5
    },
    {
      "json_id": "entrance-main",
      "label": "Ulaz",
      "shape": "line",
      "x1": 500,
      "y1": 800,
      "x2": 700,
      "y2": 800,
      "stroke_color": "#00ff00",
      "stroke_width": 4,
      "z_index": 15
    }
  ],
  "shape_presets": {
    "circle": {
      "svg_type": "circle",
      "description": "Pojedinačno sjedalo"
    },
    "round_table_4": {
      "svg_type": "circle",
      "has_chairs": true,
      "default_capacity": 4,
      "default_radius": 30,
      "chair_offset": 45,
      "description": "Okrugli stol za 4"
    },
    "round_table_6": {
      "svg_type": "circle",
      "has_chairs": true,
      "default_capacity": 6,
      "default_radius": 40,
      "chair_offset": 55,
      "description": "Okrugli stol za 6"
    },
    "round_table_8": {
      "svg_type": "circle",
      "has_chairs": true,
      "default_capacity": 8,
      "default_radius": 50,
      "chair_offset": 65,
      "description": "Okrugli stol za 8"
    },
    "rectangular_table": {
      "svg_type": "rect",
      "has_chairs": true,
      "default_width": 120,
      "default_height": 60,
      "description": "Pravokutni stol"
    },
    "booth_l_shape": {
      "svg_type": "path",
      "has_chairs": false,
      "description": "L-shaped booth (sofa)"
    },
    "bar_stool": {
      "svg_type": "circle",
      "default_radius": 8,
      "description": "Bar stolica"
    },
    "sofa": {
      "svg_type": "rect",
      "corner_radius": 10,
      "default_width": 100,
      "default_height": 40,
      "description": "Sofa / klupa"
    },
    "high_table": {
      "svg_type": "circle",
      "has_chairs": false,
      "default_radius": 25,
      "description": "Visoki stol (standing)"
    }
  }
}
```

### JSON ↔ DB sinkronizacija

**JSON je source of truth za builder sesiju.** Kad vlasnik klikne "Spremi":

1. Frontend šalje finalni JSON
2. Backend parsira JSON
3. Za svaku sekciju u `sections[]`:
   - Ako `db_id` postoji i layout se updatea in-place → UPDATE venue_sections
   - Ako nova verzija → INSERT venue_sections s novim UUID-om
4. Za svaki item u `items[]`: ista logika
5. Backend sprema JSON na Supabase Storage
6. Backend validira konzistenciju: svaki aktivan venue_item u bazi ima json_id u JSONu i obrnuto

### Logika lockanja po item tipu

| Item tip | Lock mehanizam | Korisnička interakcija |
|----------|---------------|----------------------|
| seat | `lock_seat_for_checkout()` → 1 OIS red | Klik na sjedalo = odabir mjesta |
| table | `lock_seat_for_checkout()` → 1 OIS red | Klik na stol = odabir stola za grupu |

Oba tipa koriste istu lock funkciju. Razlika je samo u prezentaciji:
- Sjedalo: "Odabrali ste mjesto A-5"
- Stol: "Odabrali ste stol VIP-1 (6 mjesta)" — `capacity` iz venue_items

---

## 5. RLS sigurnosni model

### Strategija
Primarni pristup je kroz FastAPI backend, ali RLS je obavezan kao defense-in-depth (real-time subscriptions, direktni Supabase klijent).

### Matrica pristupa

| Tablica | Korisnik (kupac) | Org member | Venue owner | Platform admin |
|---------|-----------------|------------|-------------|----------------|
| profiles | Svoj (R/W), tuđi (R) | Isto | Isto | Sve |
| organizations | Read (aktivne) | Write (owner/admin) | Write (owner/admin) | Sve |
| venues | Public/unlisted (R) | Svoje org (R/W) | Svoje org (R/W) | Sve |
| events | Published (R) | Svoje org (R/W) | - | Sve |
| tickets | Svoje (R) | Org eventi (R) | - | Sve |
| orders | Svoje (R) | Org orderi (R) | - | Sve |
| transactions | Kroz order | Kroz order | - | Sve |
| payment_orders | - | from_org (R/W) | to_org (R) | Sve |
| audit_log | - | Org (owner/admin) | Org (owner/admin) | Sve |
| venue_rental_terms | Publicly visible (R) | - | Svoje venue (R/W) | Sve |
| venue_inquiries | - | Org (organizer side) | Org (venue side) | Sve |
| occurrence_item_status | Read all (seat map) | R/W za org event | - | Sve |

### Platform admin bypass
Super admin koristi service_role key koji zaobilazi RLS. U Supabase, service_role key NE podliježe RLS politikama.

---

## 6. Pre-populacija occurrence item statusa

### Trigger: populate_occurrence_items()

Pali se kad occurrence prelazi u `on_sale`. Bulk INSERT za sve venue_items u numbered sekcijama koje su povezane s aktivnim tierovima za tu izvedbu.

```
occurrence (scheduled) → organizator konfigurira tierove, sekcije →
occurrence (on_sale) → TRIGGER → bulk INSERT occurrence_item_status
```

**Samo numbered sekcije** — standing sekcije nemaju individualne venue_items. Njihov kapacitet se prati isključivo kroz `event_tiers.sold_count`.

**ON CONFLICT DO NOTHING** — ako je neki item već lockiran (npr. testiranje prije publishanja), ne prebrišemo ga.

---

## 7. Section capacity enforcement

### Problem
Dva tiera mapirana na istu standing sekciju mogu ukupno premašiti fizički kapacitet sekcije. Tier-level trigger gleda samo occurrence kapacitet, ne sekcijski.

### Rješenje
Trigger `enforce_section_capacity_limit()` se pali na:
- `event_tiers` INSERT/UPDATE OF total_count, is_active
- `tier_sections` INSERT

Za svaku sekciju povezanu s tierom, sumira total_count svih tierova na toj sekciji i uspoređuje s `venue_sections.default_capacity`.

---

## 8. Seat lock poboljšanja (v6)

### Advisory lock za multi-lock race condition
```sql
PERFORM pg_advisory_xact_lock(hashtext(p_occurrence_id::TEXT || p_user_id::TEXT));
```
Serializira sve lock zahtjeve istog korisnika za istu izvedbu. Sprečava scenarij gdje dva paralelna zahtjeva oba prođu count provjeru.

### Lock produženje za order
Kad se kreira order, seat lockovi se produžuju:
```
lock_seat (15 min) → kreira order → extend_seat_locks_for_order(order.expires_at) → lock traje 30 min
```

### expire_pending_orders popravak
Kad order expire, oslobađa i seat lockove (ne samo tickete/reservations).

---

## 9. Self-hosted event flow

Kad organizacija s `can_organize = TRUE` i `can_own_venues = TRUE` kreira event u vlastitom prostoru:

```
1. Kreiraj event (draft)
2. API detektira: events.organizer_org_id == venues.org_id → preskoči inquiry
3. Direktno kreiraj occurrence s venue_layout_id = current layout
4. Direktno kreiraj venue_availability(status='blocked')
5. rental_terms_snapshot = NULL (vlastiti prostor, nema najma)
6. Payment order trigger: from_org == to_org → preskoči
```

Nema inquiry, nema čekanja na odobrenje.

---

## 10. Door sale flow

```
1. Staff otvori "Door Sale" screen (permission: sell_at_door)
2. Unese email kupca
3. resolve_or_create_profile(email) → ghost account ili postojeći
4. Odabere tier + broj karata
5. Backend kreira:
   - order (status='completed', gateway_type='door_sale')
   - tickets (status='active')
   - charge transakcija (status='completed')
6. Email s QR kodom → kupac
```

Nema async webhook čekanja. Sve se odmah aktivira.

---

## 11. Potpuni popis tablica (35 + 3 viewa)

| # | Tablica | Opis | Status v6 |
|---|---------|------|-----------|
| 1 | supported_currencies | ISO 4217 valute | Neprom. |
| 2 | user_platform_roles | Platform admin | Neprom. |
| 3 | profiles | Korisnički profili | Neprom. |
| 4 | user_preferences | Interesi, preferred days | Neprom. |
| 5 | organizations | **CHANGED: capability flags** |
| 6 | organization_members | Članovi s rolama | Neprom. |
| 7 | payment_gateways | +door_sale gateway | **CHANGED** |
| 8 | tags | Tagovi | Neprom. |
| 9 | venues | **CHANGED: +visibility, -layout_file_path** |
| 10 | venue_tags | Junction | Neprom. |
| 11 | **venue_layouts** | **NOVO: verzije tlocrta** |
| 12 | venue_sections | **CHANGED: layout_id umjesto venue_id** |
| 13 | venue_items | Sjedala/stolovi | Neprom. |
| 14 | venue_rental_terms | **+is_publicly_visible** |
| 15 | events | Definicija događaja | Neprom. |
| 16 | event_tags | Junction | Neprom. |
| 17 | venue_inquiries | Upiti | Neprom. |
| 18 | venue_inquiry_dates | Datumi upita | Neprom. |
| 19 | venue_inquiry_responses | Odgovori | Neprom. |
| 20 | event_occurrences | **+venue_layout_id** |
| 21 | venue_availability | Zauzetost | Neprom. |
| 22 | event_tiers | Cjenovni razredi | Neprom. |
| 23 | tier_sections | Junction | Neprom. |
| 24 | occurrence_packages | Paketi (tier+extras) | Neprom. |
| 25 | bundle_types | Multi-day paketi | Neprom. |
| 26 | bundle_type_occurrences | Junction (+tier+pkg) | Neprom. |
| 27 | ticket_bundles | Kupljeni bundleovi | Neprom. |
| 28 | tickets | Ulaznice | Neprom. |
| 29 | occurrence_item_status | Seat/table status | Neprom. |
| 30 | table_reservations | Rezervacije stolova | Neprom. |
| 31 | orders | Checkout sesije | Neprom. |
| 32 | order_items | Stavke narudžbi | Neprom. |
| 33 | transactions | **Čisto ime (ne _v2)** |
| 34 | payment_orders | Nalozi za plaćanje | Neprom. |
| 35 | audit_log | CRUD operacije | Neprom. |

**Viewovi (SECURITY INVOKER):**
- user_tickets_view
- user_transactions_view
- org_revenue_view

---

## 12. Potpuni popis triggera i funkcija

### Triggeri (25+)

| # | Trigger | Tablica | Opis |
|---|---------|---------|------|
| T1 | trg_ticket_sold_counts | tickets | Sold count sync |
| T2 | trg_bundle_sold_counts | ticket_bundles | Bundle sold count |
| T3 | trg_cancel_reservation_on_ticket_cancel | tickets | Auto-cancel reservation |
| T4 | trg_reject_overlapping_on_confirm | venue_availability | Reject tentative (FOR UPDATE) |
| T5 | trg_enforce_tier_capacity | event_tiers | Tier sum ≤ occurrence capacity |
| T6 | trg_enforce_occurrence_layout_capacity | event_occurrences | Occurrence ≤ layout capacity |
| T7 | trg_handle_occurrence_cancellation | event_occurrences | Kaskadni cancel + refund |
| T8 | trg_auto_generate_payment_order | event_occurrences | Draft PO na completion |
| T9 | trg_enforce_tier_sale_window | tickets | Sale window check |
| T10 | trg_enforce_tier_currency | event_tiers | Org currency match |
| T11 | trg_enforce_package_currency | occurrence_packages | Org currency match |
| T12 | trg_enforce_bundle_currency | bundle_types | Org currency match |
| T13 | trg_sync_va_time_range | venue_availability | Auto-build tstzrange |
| T14 | trg_generate_order_number | orders | NOIR-YYYYMMDD-XXXX |
| T15 | trg_validate_order_item_ref | order_items | Polimorfna validacija |
| T16 | trg_sync_order_totals | order_items | Auto-rekalkulacija |
| T17 | trg_sync_order_refund_status | transactions | Auto refund status |
| T18 | trg_set_updated_at | 22 tablica | Generički updated_at |
| T19 | trg_validate_package_tier | occurrence_packages | Tier-occurrence match |
| T20 | trg_validate_package_section | occurrence_packages | Section-layout match |
| T21 | trg_validate_bto_references | bundle_type_occurrences | BTO tier/pkg match |
| T22 | trg_prevent_occurrence_venue_change | event_occurrences | **NOVO: immutable venue** |
| T23 | trg_enforce_section_capacity_on_tier | event_tiers | **NOVO: sekcijski limit** |
| T24 | trg_enforce_section_capacity_on_junction | tier_sections | **NOVO: sekcijski limit** |
| T25 | trg_populate_occurrence_items | event_occurrences | **NOVO: pre-populacija** |
| T26 | trg_compute_layout_capacity | venue_sections | **NOVO: auto capacity** |
| T27 | trg_sync_venue_capacity_on_layout_change | venue_layouts | **NOVO: venue capacity** |
| T28 | trg_validate_tier_section_layout | tier_sections | **NOVO: layout match** |

### Funkcije (22+)

| # | Funkcija | Opis |
|---|----------|------|
| F1 | swap_table_reservation() | Atomični swap stola |
| F2 | expire_standalone_reservations() | 48h expiry (cron 5 min) |
| F3 | lock_seat_for_checkout() | 15 min lock + advisory lock |
| F4 | expire_seat_locks() | Cron čišćenje (1 min) |
| F5 | release_user_seat_locks() | Oslobodi SVE korisnikove lockove |
| F6 | release_single_seat_lock() | Oslobodi JEDNO sjedalo |
| F7 | build_occurrence_tstzrange() | DATE+TIME→TSTZRANGE (STABLE) |
| F8 | check_venue_date_available() | Inquiry conflict check |
| F9 | resolve_or_create_profile() | Ghost account resolution |
| F10 | auto_generate_payment_order() | PO po pricing modelu |
| F11 | enforce_currency_consistency() | Tier/package currency |
| F12 | enforce_bundle_currency_consistency() | Bundle currency |
| F13 | generate_order_number() | NOIR-YYYYMMDD-XXXX |
| F14 | validate_order_item_reference() | Polimorfna FK validacija |
| F15 | sync_order_totals() | Auto-rekalkulacija |
| F16 | sync_order_refund_status() | Auto refund status |
| F17 | expire_pending_orders() | Checkout/hold expiry |
| F18 | redeem_drink() | Atomični dekrement |
| F19 | set_updated_at() | Generički trigger |
| F20 | extend_seat_locks_for_order() | **NOVO: lock produženje** |
| F21 | populate_occurrence_items() | **NOVO: pre-populacija** |
| F22 | enforce_section_capacity_limit() | **NOVO: sekcijski limit** |
| F23 | compute_layout_capacity() | **NOVO: auto capacity** |

---

## 13. Poznati edge caseovi — konsolidirani (v2-v6)

| Edge case | Odluka | Referenca |
|-----------|--------|-----------|
| Multi-lock race condition | Advisory lock + count NAKON FOR UPDATE | v4 §1, v6 fix |
| Bundle full refund | Trigger: 0 aktivnih + 0 skeniranih = refunded | v4 §2 |
| Bundle partially used + all cancelled | 0 aktivnih + >0 skeniranih = partially_refunded | v4 §2 |
| Cascading trigger chain | Redoslijed: unavailable→reservations→tickets→refund | v4 §8.1 |
| Tier deaktivacija i kapacitet | is_active=FALSE ne zauzima kapacitet | v4 §8.2 |
| DST spring forward | AT TIME ZONE mapira na 03:30. App warning. | v4 §4 |
| DST fall back | AT TIME ZONE uzima prvi. Backlog: UTC unos. | v4 §4 |
| Midnight crossover | build_occurrence_tstzrange() +1 dan na end | v4 §4 |
| NULL end_time | Fallback: start + 6 sati | v4 §4 |
| Payment order za free/negotiable | free=preskoči, negotiable=draft s 0 | v4 §3 |
| Payment order za vlastiti prostor | from_org==to_org = preskoči | v4 §3 |
| Ghost account duplicate email | Isti auth.users zapis | v4 §6 |
| Admin/comp karte i sale window | sale_start=NULL = uvijek otvoren | v4 §5 |
| Refund zaokruživanje | CHECK + LEAST() u triggeru | v4 §2 |
| Mix checkout od 2 organizacije | 2 zasebna ordera | v5 §2.3 |
| Stol hold istekao ali korisnik plaća | Expired order → error | v5 §5.2 |
| Tier double-count iz paketa | NAMJERNO — kapacitet vs. prodaja | v5 §7.1 |
| Ghost checkout za stol | Zabranjeno (app-level) | v5 §10.3 |
| Bundle sa stolom bez registracije | Zabranjeno (app-level) | v6 P16 |
| Promjena venuea na occurrenceu | Potpuna blokada (DB trigger) | v6 P15 |
| Seat lock timeout prije plaćanja | Lock se produžuje na order.expires_at | v6 P13 |
| Layout edit s aktivnim izvedbama | Nova verzija, stari ostaje | v6 §3 |
| Layout edit bez aktivnih izvedbi | In-place update dozvoljen | v6 P21 |
| Standing sekcija oversell | Section capacity trigger | v6 §7 |
| Venue capacity vs layout capacity | Auto-compute iz sekcija | v6 P18 |
| Door sale bez async webhoka | Instant completed + active | v6 §10 |

---

## 14. App-level zadaci za FastAPI

### Checkout endpointi
```
POST   /checkout/create          → draft order + items
POST   /checkout/pay             → gateway session → pending_payment
POST   /checkout/webhook         → charge → aktivacija
POST   /checkout/cancel          → oslobodi resurse

POST   /tables/{id}/reserve      → 48h hold + draft order
POST   /reservations/{id}/pay    → dodaj pakete → plaćanje

POST   /door-sale                → instant checkout za staff

POST   /refunds/create           → admin refund
GET    /orders                   → korisnikove narudžbe
GET    /orders/{id}              → detalj + items + transactions
```

### Venue builder endpointi
```
GET    /venues/{id}/layout           → current layout JSON
POST   /venues/{id}/layout/save      → spremi (in-place ili nova verzija)
GET    /venues/{id}/layouts           → lista svih verzija
GET    /venues/{id}/layouts/{ver}     → konkretna verzija
```

### Self-hosted event shortcut
```
POST   /events/{id}/occurrences
  → Ako events.organizer_org_id == venues.org_id:
    - Preskoči inquiry
    - Direktno kreiraj occurrence + blocked availability
  → Inače: zahtijeva inquiry_id
```

### Audit log middleware
```python
# FastAPI middleware → POST/PUT/PATCH/DELETE
# → bilježi old/new values
# → async INSERT u audit_log
# → uključuje: user_id, org_id, ip, user_agent, request_id
```

### Permission check middleware
```python
# FastAPI dependency
async def require_permission(permission: str, org_id: UUID):
    member = await get_org_member(current_user.id, org_id)
    if not has_permission(member.role, permission):
        raise HTTPException(403, "Nedovoljna prava")
```

---

*Ovaj dokument je generiran iz review sesija v2→v6. Ažurirati pri svakom značajnijem review ciklusu.*