# NOIR — MVP Implementation Plan & Database Capabilities

> **Verzija:** 1.0 | **Datum:** Ožujak 2026.
> **Izvor istine:** `6ver.sql` + `6ver_patch1.sql` (37 tablica + 3 viewa, 30+ triggera, 25+ funkcija, 70+ indeksa, 60+ RLS politika)
> **Stack:** Supabase (PostgreSQL) · FastAPI · Flutter · Next.js · Stripe/CorvusPay · Door Sale

---

## Sadržaj

1. [Pregled baze — što je izgrađeno](#1-pregled-baze)
2. [Korisničke uloge i pristup](#2-korisničke-uloge-i-pristup)
3. [Flow 1: Registracija i onboarding](#3-flow-1-registracija-i-onboarding)
4. [Flow 2: Otkrivanje evenata (Swipe Discovery)](#4-flow-2-otkrivanje-evenata)
5. [Flow 3: Kupovina ulaznica](#5-flow-3-kupovina-ulaznica)
6. [Flow 4: Rezervacija stolova](#6-flow-4-rezervacija-stolova)
7. [Flow 5: Paketi izlaska (Occurrence Packages)](#7-flow-5-paketi-izlaska)
8. [Flow 6: Multi-day bundleovi](#8-flow-6-multi-day-bundleovi)
9. [Flow 7: Organizacijski onboarding i upravljanje](#9-flow-7-organizacijski-onboarding)
10. [Flow 8: Venue Builder i upravljanje prostorom](#10-flow-8-venue-builder)
11. [Flow 9: Kreiranje eventa i inquiry flow](#11-flow-9-kreiranje-eventa)
12. [Flow 10: Checkout i plaćanje](#12-flow-10-checkout-i-plaćanje)
13. [Flow 11: Door Sale (prodaja na vratima)](#13-flow-11-door-sale)
14. [Flow 12: Dan eventa — scan, piće, ulaz](#14-flow-12-dan-eventa)
15. [Flow 13: Post-event — analitika i obračun](#15-flow-13-post-event)
16. [Flow 14: Refund i otkazivanje](#16-flow-14-refund-i-otkazivanje)
17. [Sigurnosni model (RLS + RBAC)](#17-sigurnosni-model)
18. [API Endpoint Plan](#18-api-endpoint-plan)
19. [Frontend Screen Map](#19-frontend-screen-map)
20. [MVP Prioritizacija](#20-mvp-prioritizacija)
21. [Skalabilnost i post-MVP smjernice](#21-skalabilnost)
22. [Seed Data strategija](#22-seed-data)
23. [Tehničke mehanike baze — deep dive](#23-tehničke-mehanike)

---

## 1. Pregled baze — što je izgrađeno {#1-pregled-baze}

### 1.1 Brojke

| Metrika | Vrijednost |
|---------|-----------|
| Tablica | 37 (35 core + ticket_scans + drink_redemptions) |
| Viewa | 3 (security_invoker) |
| Triggeri | 30+ |
| Funkcije | 25+ |
| Indeksi | 70+ (uklj. partial, composite, GiST) |
| RLS politike | 60+ |
| ENUM tipovi | 25 |
| CHECK constrainti | 20+ |
| Cron jobovi | 3 (expire locks, orders, reservations) |

### 1.2 Domenski model — entiteti i veze

```
                    ┌──────────────────┐
                    │   auth.users     │
                    └────────┬─────────┘
                             │
              ┌──────────────┼──────────────┐
              ▼              ▼              ▼
        ┌──────────┐  ┌──────────┐  ┌─────────────────┐
        │ profiles │  │ user_    │  │ user_platform_   │
        │          │  │ prefs    │  │ roles            │
        └──────────┘  └──────────┘  └─────────────────┘

        ┌──────────────────────────────────────────┐
        │              organizations               │
        │  can_organize · can_own_venues           │
        └──────────┬───────────────────────────────┘
                   │
      ┌────────────┼────────────┬─────────────────┐
      ▼            ▼            ▼                 ▼
  ┌────────┐ ┌──────────┐ ┌──────────┐    ┌───────────┐
  │members │ │ payment  │ │  venues  │    │  events   │
  │(roles) │ │ gateways │ │          │    │           │
  └────────┘ └──────────┘ └────┬─────┘    └─────┬─────┘
                               │                │
                          ┌────┴────┐     ┌─────┴──────┐
                          │ layouts │     │ inquiries  │
                          │(version)│     │ (flow)     │
                          └────┬────┘     └────────────┘
                               │
                    ┌──────────┼──────────┐
                    ▼          ▼          ▼
              ┌──────────┐ ┌───────┐ ┌────────┐
              │ sections │ │ items │ │ rental │
              │          │ │(seat/ │ │ terms  │
              │          │ │table) │ │        │
              └──────────┘ └───────┘ └────────┘

                    ┌─────────────────────┐
                    │  event_occurrences  │
                    │  (izvedba eventa)   │
                    └─────────┬───────────┘
                              │
           ┌──────────┬───────┼───────┬──────────┐
           ▼          ▼       ▼       ▼          ▼
      ┌────────┐ ┌────────┐ ┌─────┐ ┌────────┐ ┌────────┐
      │ tiers  │ │packages│ │avail│ │ OIS    │ │bundles │
      │(pricing│ │(tier+  │ │     │ │(seat   │ │(multi- │
      │ razred)│ │extras) │ │     │ │ map)   │ │day)    │
      └────┬───┘ └────────┘ └─────┘ └────────┘ └────────┘
           │
           ▼
      ┌──────────┐    ┌──────────────────┐
      │ tickets  │───▶│ table_reserv.    │
      └────┬─────┘    └──────────────────┘
           │
      ┌────┴─────┐
      ▼          ▼
  ┌────────┐ ┌──────────┐
  │ orders │ │ ticket   │
  │        │ │ scans    │
  └────┬───┘ └──────────┘
       │
  ┌────┴──────────┐
  ▼               ▼
┌────────────┐ ┌──────────────┐
│order_items │ │transactions  │
│(polimorfna)│ │(charge/refund│
│            │ │ /void/dispute│
└────────────┘ └──────────────┘
```

### 1.3 Ključne arhitekturne značajke

**Ono što baza VEĆ osigurava na DB razini (nije potrebno u app kodu):**

- Kapacitet nikad ne može biti premašen (trostruka zaštita: occurrence ≤ layout, tierovi ≤ occurrence, tierovi po sekciji ≤ sekcija)
- Sjedala se ne mogu dvostruko prodati (advisory lock + FOR UPDATE + status tracking)
- Venue se ne može zamijeniti na postojećoj izvedbi (immutability trigger)
- Layout verzioniranje se automatski rekalkulira (kapacitet propagira gore)
- Order totali su uvijek konzistentni (auto-sync trigger)
- Refund status se automatski ažurira (trigger na transactions)
- Valute su uvijek konzistentne s organizacijom (currency enforcement triggeri)
- Sale window se enforca na INSERT ticketa (DB-level check)
- Overlapping venue bookings su nemoguće za confirmed statuse (GiST exclusion)
- QR tokeni su kriptografski sigurni (256-bit, DB-level default)
- Scan pokušaji se bilježe (audit trail u ticket_scans)
- Drink redeem je atomičan s audit logom (drink_redemptions)

**Ono što je na app razini (FastAPI):**

- Permission checking (RBAC po roli)
- Audit log pisanje (middleware)
- Ghost account kreiranje (Supabase Admin API)
- Payment gateway integracija (webhook handling)
- Email slanje (QR kod, potvrde)
- File upload (layout JSON na Supabase Storage)
- Bundle sa stolom zahtijeva registraciju
- Ghost checkout za stol je zabranjen

---

## 2. Korisničke uloge i pristup {#2-korisničke-uloge-i-pristup}

### 2.1 Tri korisničke razine

| Razina | Tko | Kako pristupa | Baza |
|--------|-----|---------------|------|
| **Korisnik** | Kupac ulaznica | Mobile app + web | `profiles`, `user_preferences` |
| **Org Member** | Organizator ili venue owner | Web dashboard + mobile | `organization_members` (role) |
| **Platform Admin** | Noir tim | Supabase dashboard | `user_platform_roles` |

### 2.2 Organizacijske role i permisije

Organizacija može imati **can_organize** (kreira evente) i/ili **can_own_venues** (posjeduje prostore). Barem jedna sposobnost mora biti TRUE (CHECK constraint).

Svaki član organizacije ima rolu s app-level permisijama:

| Rola | Permisije |
|------|-----------|
| **owner** | SVE — potpuna kontrola |
| **admin** | Upravljanje članovima, financijama, eventima, venueima, analitika, door sale, scan, drinks |
| **manager** | Upravljanje eventima i venueima, analitika, operativne funkcije |
| **staff** | Door sale, scan, drinks, upravljanje rezervacijama |
| **door_staff** | Scan ticketa, door sale |
| **bar_staff** | Redeem drinks, door sale, scan |

### 2.3 Ghost accounts

Baza podržava **guest checkout** — korisnik koji nikad nije kreirao račun može kupiti ulaznicu samo s emailom. Sustav:

1. `resolve_or_create_profile(email)` → traži postojeći `auth.users` zapis
2. Ako postoji → UPSERT profil, vrati user_id
3. Ako ne postoji → vrati NULL → FastAPI kreira ghost account preko Supabase Admin API
4. Ghost account ima `profiles.claimed_at = NULL`
5. Kad se korisnik registrira s istim emailom → `claimed_at = NOW()`, sve karte ostaju

**Ograničenja ghost accounta (app-level):**
- NE može rezervirati stol standalone (48h hold)
- NE može kupiti bundle sa stolom
- MOŽE kupiti standardnu ulaznicu i paket bez stola

---

## 3. Flow 1: Registracija i onboarding {#3-flow-1-registracija-i-onboarding}

### 3.1 Korisnički onboarding (Mobile + Web)

```
┌─────────────────────────────────────────┐
│          REGISTRACIJA/LOGIN             │
│                                         │
│  ┌─────────────┐  ┌──────────────────┐ │
│  │ Google      │  │ Email + Password │ │
│  │ Sign-In     │  │                  │ │
│  └──────┬──────┘  └────────┬─────────┘ │
│         └──────────┬───────┘           │
│                    ▼                    │
│         ┌──────────────────┐           │
│         │ Kratki upitnik   │           │
│         │                  │           │
│         │ • Puno ime       │           │
│         │ • Grad           │           │
│         │ • Datum rođenja  │           │
│         │ • Interesi (tags)│           │
│         │ • Preferred dani │           │
│         │ • Price cap      │           │
│         └────────┬─────────┘           │
│                  ▼                      │
│         ┌──────────────────┐           │
│         │ FEED / DISCOVER  │           │
│         └──────────────────┘           │
└─────────────────────────────────────────┘
```

**DB tablice uključene:**
- `auth.users` — Supabase auth (Google OAuth + email)
- `profiles` — full_name, avatar_url, date_of_birth, phone, city
- `user_preferences` — interest_tags (TEXT[]), preferred_days (INT[]), price_cap (DECIMAL)

**API endpointi:**
```
POST /auth/register          → Supabase Auth
POST /auth/login             → Supabase Auth
POST /auth/google            → Supabase OAuth
PUT  /profiles/me            → Update profil
PUT  /preferences/me         → Update preferences
```

**Frontend (Mobile):** 3-4 screen onboarding wizard s progress barom. Svaki screen = jedan blok podataka. Preskoči = default.

**Frontend (Web):** Isti flow, ali u modal/stepper komponenti.

### 3.2 Organizacijski onboarding (Zaseban link)

```
┌──────────────────────────────────────────────┐
│     ORGANIZACIJSKI ONBOARDING               │
│     (npr. noir.app/organizations/register)   │
│                                              │
│  1. Login/Register (isti auth)               │
│                                              │
│  2. Odabir sposobnosti:                      │
│     ┌──────────────────────────────────────┐ │
│     │  ┌──────────┐    ┌──────────────┐   │ │
│     │  │ 🎵       │    │ 🏢            │   │ │
│     │  │ ORGANIZER│    │ VENUE OWNER  │   │ │
│     │  │          │    │              │   │ │
│     │  │ Kreiraj  │    │ Ponudi       │   │ │
│     │  │ evente   │    │ prostor      │   │ │
│     │  │ prodaj   │    │ primaj       │   │ │
│     │  │ ulaznice │    │ bookinge     │   │ │
│     │  └──────────┘    └──────────────┘   │ │
│     │       ☑               ☑              │ │
│     │    (može oboje)                      │ │
│     └──────────────────────────────────────┘ │
│                                              │
│  3. Osnovni podaci organizacije:             │
│     • Naziv, slug                            │
│     • Logo, opis                             │
│     • Kontakt email, telefon, web            │
│     • Adresa, grad, zemlja                   │
│     • OIB/Tax ID, IBAN                       │
│     • Default valuta                         │
│                                              │
│  4. Verifikacija:                            │
│     • is_verified = FALSE (čeka odobrenje)   │
│     • Noir tim ručno verificira              │
│                                              │
│  5. → Dashboard (ograničen dok !verified)    │
└──────────────────────────────────────────────┘
```

**DB operacije:**
1. Kreiranje `organizations` zapisa (can_organize, can_own_venues, is_verified=FALSE)
2. Kreiranje `organization_members` zapisa (role='owner', is_active=TRUE)
3. Korisnik postaje owner organizacije

**Post-onboarding (unutar dashboarda, ne onboarding):**
- Postavljanje payment gatewaya
- Kreiranje prvog venuea (ako venue owner)
- Kreiranje prvog eventa (ako organizer)

---

## 4. Flow 2: Otkrivanje evenata (Swipe Discovery) {#4-flow-2-otkrivanje-evenata}

### 4.1 Tinder-style feed

Korisnik otkriva evente swipe mehanikom. Svaki event je kartica s cover slikom, imenom, datumom, lokacijom, cijenom i tagovima.

```
┌─────────────────────────────────────┐
│         EVENT DISCOVERY             │
│                                     │
│  ┌─────────────────────────────────┐│
│  │  📸 Cover Image               ││
│  │                                ││
│  │  🔥 TECHNO NIGHT              ││
│  │  📍 Club Venue, Zagreb         ││
│  │  📅 Petak, 28.03.             ││
│  │  💰 od 15€                    ││
│  │  🏷️ #techno #clubbing         ││
│  │                                ││
│  │     ← SWIPE →                 ││
│  └─────────────────────────────────┘│
│                                     │
│  [🔍 Filtri]  [📍 Blizu mene]     │
│  [🗓️ Ovaj vikend]  [🎵 Po žanru] │
└─────────────────────────────────────┘
```

### 4.2 Logika filtriranja i personalizacije

**Query baze:**
```sql
SELECT e.*, eo.occurrence_date, eo.start_time,
       v.name AS venue_name, v.city, v.lat, v.lng,
       MIN(et.price) AS min_price
FROM   events e
JOIN   event_occurrences eo ON eo.event_id = e.id
JOIN   venues v ON v.id = eo.venue_id
JOIN   event_tiers et ON et.occurrence_id = eo.id AND et.is_active = TRUE
WHERE  e.status = 'published'
  AND  eo.status IN ('on_sale', 'scheduled')
  AND  eo.occurrence_date >= CURRENT_DATE
GROUP BY e.id, eo.id, v.id
ORDER BY /* personalizacijski algoritam */
```

**Personalizacija (na temelju `user_preferences`):**

| Preferencija | DB kolona | Primjena |
|-------------|-----------|----------|
| Interesi/žanrovi | `interest_tags` TEXT[] | Match s `event_tags` → `tags.slug` |
| Preferirani dani | `preferred_days` INT[] | Match s `EXTRACT(DOW FROM occurrence_date)` |
| Max cijena | `price_cap` DECIMAL | Filter: `MIN(tier.price) <= price_cap` |
| Lokacija | Geolocation (runtime) | Sortiranje po udaljenosti od `venues.lat/lng` |

**Algoritam sortiranja (app-level):**
```
score = (tag_match_score * 0.4)          -- koliko tagova matcha
      + (day_preference_score * 0.2)     -- je li preferirani dan
      + (distance_score * 0.2)           -- blizina
      + (popularity_score * 0.1)         -- sold_count / total_capacity
      + (recency_score * 0.1)            -- noviji eventi gore
```

**Swipe akcije:**
- **Swipe desno / tap** → Otvori event detail
- **Swipe lijevo** → Sljedeći event
- **Swipe gore** → Spremi (bookmark — post-MVP, nema DB tablice za sad)

### 4.3 Event detail screen

Klik na karticu otvara puni detalj:

```
┌─────────────────────────────────────┐
│  📸 Cover Image (full width)       │
│                                     │
│  TECHNO NIGHT                       │
│  🏢 Organizator: Noir Events       │
│  📍 Club Venue, Zagreb              │
│  📅 Pet 28.03. | 🕐 23:00 - 05:00 │
│  🚪 Doors: 22:30                   │
│  🔞 18+                            │
│                                     │
│  ── Opis ──                         │
│  Najveći techno event u Zagrebu...  │
│                                     │
│  ── Ulaznice ──                     │
│  Early Bird    15€  [🔥 još 23]    │
│  Regular       25€  [dostupno]     │
│  VIP           50€  [dostupno]     │
│                                     │
│  ── Paketi ──                       │
│  VIP Table (6) 300€ [2x Absolut    │
│                       + 6 karata   │
│                       + VIP stol]  │
│                                     │
│  ── Multi-day Bundle ──            │
│  Weekend Pass   60€  [Pet+Sub]     │
│                                     │
│  ── Tlocrt ──                       │
│  [Interaktivna mapa → odabir       │
│   sjedala/stola]                    │
│                                     │
│  [🎫 KUPI ULAZNICU]                │
│  [🪑 REZERVIRAJ STOL]              │
└─────────────────────────────────────┘
```

**DB upiti za detail:**
- `events` + `event_tags` + `tags` → osnovni podaci
- `event_occurrences` WHERE event_id → sve izvedbe
- `event_tiers` WHERE occurrence_id → cijene i dostupnost
- `occurrence_packages` WHERE occurrence_id → paketi
- `bundle_types` WHERE event_id → multi-day bundleovi
- `venues` + `venue_layouts` + `venue_sections` → info o prostoru
- `occurrence_item_status` WHERE occurrence_id → seat map (za numbered sekcije)

---

## 5. Flow 3: Kupovina ulaznica {#5-flow-3-kupovina-ulaznica}

### 5.1 Nenumerirane ulaznice (standing sekcije)

Najjednostavniji flow — korisnik bira tier i količinu.

```
1. Korisnik klikne "Kupi ulaznicu"
2. Odabere tier (Early Bird / Regular / VIP)
3. Odabere količinu (1-10, max iz max_seats_per_checkout)
4. → Provjera:
   - Tier aktivan? (is_active = TRUE)
   - Sale window otvoren? (sale_start ≤ NOW ≤ sale_end)
   - Ima kapaciteta? (sold_count + qty ≤ total_count)
5. → Pitanje: "Ima slobodnih stolova — želiš li rezervirati?"
   - DA → Flow 4 (Rezervacija stolova)
   - NE → Nastavi na checkout
6. Kreiraj draft order → Checkout flow (Flow 10)
```

**DB mehanike:**
- Tier capacity: CHECK constraint `sold_count <= total_count`
- Sale window: Trigger `trg_enforce_tier_sale_window` blokira INSERT izvan windowsa
- Sold count: Trigger `trg_ticket_sold_counts` atomično inkrementira kad ticket postane 'active'
- Section capacity: Trigger `enforce_section_capacity_limit()` osigurava da suma tierova ne premašuje sekciju

### 5.2 Numerirane ulaznice (seated sekcije)

Korisnik bira konkretno sjedalo na interaktivnoj mapi.

```
1. Korisnik klikne "Kupi ulaznicu" za seated tier
2. Otvara se interaktivna seat mapa (iz venue layout JSON-a)
3. Prikazani statusi sjedala (iz occurrence_item_status):
   - 🟢 available → može odabrati
   - 🔴 sold → zauzeto
   - 🟡 locked → netko drugi bira (15 min)
   - ⬛ blocked/unavailable → ne prikazuje se

4. Korisnik klikne na sjedalo → lock_seat_for_checkout():
   - Advisory lock serializira zahtjeve
   - Atomični status update: available → locked
   - Lockiran 15 min za ovog korisnika
   - Max lockova: max_seats_per_checkout (default 10)

5. Korisnik može odabrati više sjedala (do max_seats_per_checkout)

6. → Checkout (Flow 10):
   - Kreiraj order → extend_seat_locks_for_order(order.expires_at)
   - Lock se produžuje na 30 min (checkout timeout)

7. Ako korisnik odustane:
   - release_user_seat_locks() oslobađa sve
   - Ili: expire_seat_locks() cron (svaku minutu) čisti expired

8. Ako korisnik ne plati u roku:
   - expire_pending_orders() oslobađa lockove + tickets + reservation
```

**DB mehanike detaljno:**

| Korak | Funkcija/Trigger | Što radi |
|-------|------------------|----------|
| Lock sjedala | `lock_seat_for_checkout()` | Advisory lock → FOR UPDATE → status='locked', locked_by=user, reserved_until=NOW+15min |
| Max lock provjera | Ista funkcija | COUNT WHERE locked_by=user AND status='locked' AND reserved_until>NOW ≥ max_locks → reject |
| Refresh locka | Ista funkcija | Isti user + isti item → refresh reserved_until |
| Expired lock preuzimanje | Ista funkcija | status='locked' AND reserved_until<NOW → preuzmi |
| Order kreiran | `extend_seat_locks_for_order()` | reserved_until = order.expires_at |
| Odustajanje | `release_user_seat_locks()` / `release_single_seat_lock()` | Reset na available |
| Timeout | `expire_seat_locks()` (cron 1min) | Čisti sve expired lockove |
| Order timeout | `expire_pending_orders()` (cron 2min) | Expire order + tickets + lockovi + reservacije |

### 5.3 Validacija ticket ↔ tier ↔ section (Patch P15)

Kad korisnik kupi numbered seat, trigger `validate_ticket_item_tier_section()` osigurava:
- Sjedalo (item_id) pripada sekciji koja je pokrivena odabranim tierom (kroz tier_sections)
- Sprečava: kupovina Early Bird ticketa za VIP sjedalo (krivi pricing)
- Auto-popunjava `tickets.section_id` iz `venue_items.section_id`

---

## 6. Flow 4: Rezervacija stolova {#6-flow-4-rezervacija-stolova}

### 6.1 Tri načina rezervacije

Baza podržava tri izvora (`reservation_source` ENUM):

| Izvor | Opis | Timeout | Zahtijeva registraciju |
|-------|------|---------|----------------------|
| `ticket_purchase` | Stol kupljen uz ulaznicu/paket | Vezan uz order timeout | Da |
| `manual_booking` | Staff ručno dodijeli stol | Nema timeout | Ne |
| `standalone` | Korisnik samo rezervira stol bez ulaznice | **48h** | **Da** (app-level) |

### 6.2 Standalone rezervacija (48h hold)

```
1. Korisnik klikne "Rezerviraj stol"
2. Otvara se seat mapa (samo stolovi)
3. Korisnik odabere stol → lock_seat_for_checkout()
4. Kreiraj table_reservation:
   - source = 'standalone'
   - status = 'pending'
   - expires_at = NOW + 48h
5. Kreiraj draft order sa order_item_type = 'table_reservation'
6. Order expires_at = NOW + 48h

7. Korisnik ima 48h za:
   a) Platiti i kupiti ulaznice → rezervacija confirmed
   b) Dodati paket (tier + extras) → checkout
   c) Ništa → expire_standalone_reservations() (cron 5min)

8. Ako istekne:
   - table_reservation.status → 'expired'
   - occurrence_item_status → 'available'
   - order → 'expired'
```

**CHECK constraint na table_reservations:**
```sql
(source = 'ticket_purchase' AND ticket_id IS NOT NULL)
OR (source = 'manual_booking' AND ticket_id IS NULL)
OR (source = 'standalone' AND ticket_id IS NULL AND bundle_id IS NULL)
```

**Unique index:** Samo jedna aktivna (pending/confirmed) rezervacija po stolu po izvedbi:
```sql
CREATE UNIQUE INDEX idx_one_active_reservation_per_item
    ON table_reservations(occurrence_id, item_id)
    WHERE status IN ('pending', 'confirmed');
```

### 6.3 Swap stola

Organizator može atomično zamijeniti stol za postojeću rezervaciju:
```
swap_table_reservation(reservation_id, new_item_id, user_id)
→ Cancel staru rezervaciju
→ Oslobodi stari item
→ Kreiraj novu rezervaciju na novom stolu
→ Zauzmi novi item
→ SVE u jednoj transakciji
```

---

## 7. Flow 5: Paketi izlaska (Occurrence Packages) {#7-flow-5-paketi-izlaska}

### 7.1 Što je paket

Paket (`occurrence_packages`) kombinira tier ulaznice s dodacima. Definira se PO IZVEDBI (ne po eventu).

**Struktura paketa:**

| Polje | Opis | Primjer |
|-------|------|---------|
| `tier_id` | Koji tier ulaznica | VIP tier |
| `entries_included` | Koliko ulaznica dolazi s paketom | 6 (za stol od 6) |
| `drinks_included` | Koliko pića po ulaznici | 2 |
| `table_section_id` | Iz koje sekcije se dodjeljuje stol | VIP Lounge |
| `items` JSONB | Ostali artikli | `{"merch": "2x majica", "bottle": "1x Absolut 0.7l"}` |
| `price` | Cijena paketa | 300€ |

**Constraint:** Ako `entries_included > 0`, `tier_id` MORA biti postavljen.

### 7.2 Primjeri paketa

**Paket "VIP Table for 6":**
```json
{
  "name": "VIP Table for 6",
  "tier_id": "<vip_tier_uuid>",
  "entries_included": 6,
  "drinks_included": 2,
  "table_section_id": "<vip_lounge_section_uuid>",
  "items": {
    "bottles": ["1x Absolut 0.7l", "1x Grey Goose 0.7l"],
    "merch": ["6x Noir wristband"]
  },
  "price": 300.00
}
```

**Paket "Drink & Dance":**
```json
{
  "name": "Drink & Dance",
  "tier_id": "<regular_tier_uuid>",
  "entries_included": 1,
  "drinks_included": 3,
  "table_section_id": null,
  "items": null,
  "price": 35.00
}
```

### 7.3 Checkout flow za paket

```
1. Korisnik odabere paket
2. Ako paket ima table_section_id:
   a) Prikaži dostupne stolove iz te sekcije
   b) Korisnik odabere stol → lock
   c) Kreiraj table_reservation (source='ticket_purchase')
3. Kreiraj N ticketa (entries_included × tier_id):
   - Svaki ticket dobiva remaining_drinks = drinks_included
   - Ako numbered → sjedalo se lockira
4. Kreiraj order:
   - order_item (type='ticket') za svaki ticket
   - order_item (type='table_reservation') ako ima stol
5. Checkout → plaćanje (Flow 10)
```

**Validacijski triggeri:**
- `trg_validate_package_tier` — tier mora pripadati istoj izvedbi
- `trg_validate_package_section` — sekcija mora biti iz istog layouta

---

## 8. Flow 6: Multi-day bundleovi {#8-flow-6-multi-day-bundleovi}

### 8.1 Što je bundle

Bundle (`bundle_types`) je paket koji pokriva VIŠE izvedbi istog eventa. Definira se na EVENT razini (ne occurrence).

**Primjer:** "Weekend Pass" za festival koji traje Petak + Subota + Nedjelja.

### 8.2 Struktura

```
bundle_types (event-level definicija)
  ├── price: 120€
  ├── total_count: 200
  └── bundle_type_occurrences (junction → za svaku izvedbu):
        ├── occurrence_1 (Petak) + tier_id + package_id (opcionalno)
        ├── occurrence_2 (Subota) + tier_id + package_id (opcionalno)
        └── occurrence_3 (Nedjelja) + tier_id + package_id (opcionalno)
```

Svaka veza bundle→occurrence može imati **svoj tier** i **svoj package** — fleksibilnost da npr. Petak bude Regular, a Subota VIP.

### 8.3 Checkout flow za bundle

```
1. Korisnik odabere bundle (npr. Weekend Pass)
2. Za svaku occurrence u bundleu:
   a) Dohvati tier_id iz bundle_type_occurrences
   b) Ako tier je numbered → odabir sjedala za svaku izvedbu
   c) Ako package_id postoji → primijeni package logiku (stol, piće)
3. Kreiraj ticket_bundle:
   - total_price, original_occurrence_count
4. Kreiraj ticket za svaku occurrence:
   - bundle_id = ticket_bundle.id
   - tier_id iz BTO
5. Order:
   - order_item (type='bundle') za bundle
   - order_item (type='ticket') za svaki ticket (OPCIONALNO - ovisi o implementaciji)
6. Checkout → plaćanje
```

### 8.4 Bundle refund mehanike

Baza automatski upravlja refundom kroz trigger `handle_occurrence_cancellation()`:

| Scenarij | Akcija | Rezultat |
|----------|--------|---------|
| 1 od 3 izvedbi cancelled | Proporcionalni refund (total_price / 3) | `status = 'partially_refunded'` |
| Sve izvedbe cancelled, nijedan ticket skeniran | Full refund (refunded_amount = total_price) | `status = 'refunded'` |
| Sve cancelled, ali neki skenirani | Proporcionalni refund za neskenirane | `status = 'partially_refunded'` |
| Zaokruživanje | `LEAST(refund, total - already_refunded)` sprečava over-refund | CHECK constraint |

---

## 9. Flow 7: Organizacijski onboarding i upravljanje {#9-flow-7-organizacijski-onboarding}

### 9.1 Dashboard — Organizator

```
┌─────────────────────────────────────────────┐
│  NOIR DASHBOARD — Organizator               │
│                                              │
│  Sidebar:                                    │
│  ├── 📊 Pregled (analitika)                  │
│  ├── 🎪 Eventi                               │
│  │   ├── Svi eventi                          │
│  │   ├── Kreiraj novi                        │
│  │   └── Draft / Pending / Active            │
│  ├── 🏢 Prostori (ako can_own_venues)        │
│  │   ├── Moji prostori                       │
│  │   ├── Venue Builder                       │
│  │   └── Uvjeti najma                        │
│  ├── 📩 Upiti (inquiry flow)                 │
│  │   ├── Poslani upiti (organizator)         │
│  │   └── Primljeni upiti (venue owner)       │
│  ├── 🎫 Prodaja                              │
│  │   ├── Door Sale                           │
│  │   └── Narudžbe                            │
│  ├── 💰 Financije                            │
│  │   ├── Transakcije                         │
│  │   ├── Payment Orders                      │
│  │   └── Payment Gateways                    │
│  ├── 👥 Tim                                  │
│  │   ├── Članovi                             │
│  │   └── Pozivnice                           │
│  ├── 📋 Audit Log                            │
│  └── ⚙️ Postavke                             │
│      ├── Profil organizacije                 │
│      └── Verifikacija                        │
└──────────────────────────────────────────────┘
```

### 9.2 Payment Gateway konfiguracija

```
POST /organizations/{org_id}/gateways
{
  "gateway_type": "stripe",      // ili "corvuspay", "monri", "door_sale"
  "display_name": "Stripe Payments",
  "is_default": true,
  "config": {
    // NE-SENZITIVNA konfiguracija
    "store_id": "...",
    "currency": "EUR"
  }
}
```

**Baza čuva:**
- `gateway_type` ENUM — tip providera
- `config` JSONB — nesenzitivna konfiguracija (store ID, webhook URL, itd.)
- `is_default` — samo jedan default po organizaciji (partial unique index)
- `is_active` — soft delete

**API ključevi:** ISKLJUČIVO u `.env` varijablama na serveru. Nikad u bazi.

**Konfigurabilni gatewayevi (za CorvusPay i buduće):**
Gateway ENUM se lako širi — `ALTER TYPE gateway_type ADD VALUE 'corvuspay'`. Config JSONB je fleksibilan za bilo koji provider.

### 9.3 Upravljanje članovima

```
POST   /organizations/{org_id}/members/invite  → pozovi novog člana
PUT    /organizations/{org_id}/members/{id}     → promijeni rolu
DELETE /organizations/{org_id}/members/{id}     → deaktiviraj (soft)
```

RLS osigurava da samo owner/admin mogu upravljati članovima.

---

## 10. Flow 8: Venue Builder i upravljanje prostorom {#10-flow-8-venue-builder}

### 10.1 Builder Flow

```
┌──────────────────────────────────────────────────────┐
│  VENUE BUILDER (interaktivni tlocrt)                │
│                                                      │
│  ┌────────────────────────────────────────┐          │
│  │  Canvas (drag & drop)                 │          │
│  │                                        │          │
│  │  [BINA]                                │          │
│  │                                        │          │
│  │   ○ ○ ○ ○ ○    🪑🪑🪑🪑🪑            │          │
│  │   ○ ○ ○ ○ ○    🪑🪑🪑🪑🪑   [BAR]    │          │
│  │   ○ ○ ○ ○ ○    🪑🪑🪑🪑🪑            │          │
│  │                                        │          │
│  │   ◉T1  ◉T2  ◉T3                       │          │
│  │   (VIP stolovi)                        │          │
│  │                                        │          │
│  │  [ULAZ]                                │          │
│  └────────────────────────────────────────┘          │
│                                                      │
│  Toolbar:                                            │
│  [+ Sekcija] [+ Stol] [+ Sjedalo] [+ Statično]     │
│                                                      │
│  Properties panel:                                   │
│  - Tip sekcije (standing/seated/table_area/vip...)  │
│  - Kapacitet                                         │
│  - Numbered (da/ne)                                  │
│  - Oblik stola (round_4/6/8, rectangular, booth...) │
│                                                      │
│  [💾 SPREMI]                                         │
└──────────────────────────────────────────────────────┘
```

### 10.2 Save flow (backend)

```
Frontend klikne "Spremi" → šalje JSON (schema v2.0)

Backend:
1. Parsira JSON
2. Provjeri: postoje li occurrences na CURRENT layoutu?

   → NE (ili prvi layout):
     - UPDATE venue_sections + venue_items in-place
     - Prepiši JSON na Storage
     - Trigger rekalkulira kapacitet

   → DA:
     - Kreiraj novi venue_layouts (version = old + 1, is_current = TRUE)
     - KOPIRAJ sve sekcije i itemse (novi UUID-ovi!)
     - Primijeni promjene na kopije
     - Spremi novi JSON na v{N}.json
     - Stari layout: is_current = FALSE
     - Trigger: venue.total_capacity = novi layout capacity
```

### 10.3 JSON ↔ DB sinkronizacija

JSON je **source of truth za builder sesiju**. Baza čuva logičku strukturu. Vizualne koordinate su SAMO u JSON-u.

| Podatak | Gdje živi |
|---------|-----------|
| Pozicija (x, y) | JSON |
| Rotacija | JSON |
| Boja, oblik | JSON |
| Kapacitet | **Oboje** (JSON za display, DB za logiku) |
| Section type | **Oboje** |
| Item type (seat/table) | **Oboje** |
| Identifier (A-5, T1) | **Oboje** |
| is_numbered | **Oboje** |
| Static objects (bina, bar) | **Samo JSON** (nema DB zapis) |
| chair_positions | JSON |

**Storage path:** `/venues/{org_id}/{venue_id}/v{N}.json`

### 10.4 Venue visibility

Tri opcije (`venue_visibility` ENUM):
- **public** — svi vide u pretrazi
- **private** — samo članovi organizacije
- **unlisted** — dostupan preko direktnog linka (ne pojavljuje se u pretrazi)

### 10.5 Rental Terms

Vlasnik definira uvjete najma za prostor:

```
POST /venues/{venue_id}/rental-terms
{
  "name": "Vikend tarifa",
  "pricing_model": "hybrid",       // fixed / revenue_share / hybrid / free / negotiable
  "fixed_amount": 500.00,
  "fixed_currency": "EUR",
  "revenue_share_pct": 10.0,
  "min_guarantee": 800.00,
  "applies_to_days": [5, 6],       // Petak, Subota
  "is_publicly_visible": true,     // organizatori vide prije slanja upita
  "is_default": true
}
```

---

## 11. Flow 9: Kreiranje eventa i inquiry flow {#11-flow-9-kreiranje-eventa}

### 11.1 Dva puta do izvedbe

```
                    ┌──────────────────┐
                    │  KREIRAJ EVENT   │
                    │  (draft)         │
                    └────────┬─────────┘
                             │
              ┌──────────────┴──────────────┐
              │                             │
     Organizator ima                 Organizator NEMA
     vlastiti prostor                vlastiti prostor
     (org_id = venue.org_id)        (trebaju tuđi prostor)
              │                             │
              ▼                             ▼
     ┌────────────────┐           ┌──────────────────┐
     │ SELF-HOSTED    │           │ INQUIRY FLOW     │
     │ Preskoči       │           │ Pošalji upit     │
     │ inquiry flow   │           │ vlasn. prostora  │
     └────────┬───────┘           └────────┬─────────┘
              │                             │
              ▼                             ▼
     Direktno kreiraj              Čekaj odgovor
     occurrence +                  (accept/reject/
     blocked availability          counter-proposal)
              │                             │
              │                    ┌────────┴─────────┐
              │                    │                   │
              │              ACCEPTED              REJECTED
              │                    │                   │
              │                    ▼                   ▼
              │           Kreiraj occurrence        Traži
              │           + blocked avail.          drugi
              │           + rental_terms_snapshot   prostor
              │                    │
              └────────────────────┘
                             │
                             ▼
                    ┌──────────────────┐
                    │ KONFIGURACIJA    │
                    │ • Tierovi        │
                    │ • Packages       │
                    │ • Bundles        │
                    │ • Sale windows   │
                    └────────┬─────────┘
                             │
                             ▼
                    ┌──────────────────┐
                    │ PUBLISH          │
                    │ event status →   │
                    │ 'published'      │
                    │ occurrence →     │
                    │ 'on_sale'        │
                    │ → trigger        │
                    │   populira seats │
                    └──────────────────┘
```

### 11.2 Inquiry flow — detalji

```
1. Organizator pregledava venue (public/unlisted)
2. Vidi rental_terms (ako is_publicly_visible = TRUE)
3. Šalje inquiry:
   POST /venues/{venue_id}/inquiries
   {
     "event_id": "...",
     "message": "Želimo zakupiti prostor za...",
     "dates": [
       {"occurrence_date": "2026-04-15", "start_time": "22:00", "end_time": "05:00"},
       {"occurrence_date": "2026-04-16", "start_time": "22:00", "end_time": "04:00"}
     ]
   }

4. Backend:
   - Kreiraj venue_inquiry (status='sent')
   - Kreiraj venue_inquiry_dates za svaki datum
   - Za svaki datum: check_venue_date_available() → info flag
   - Kreiraj venue_availability (status='tentative') za svaki datum
   - Inquiry status → 'sent'

5. Vlasnik vidi inquiry u dashboardu:
   - Datumi s availability info
   - Poruka organizatora
   - Može odgovoriti:
     a) ACCEPT → venue_availability → 'blocked'
        → Trigger: auto-reject svi overlapping tentative
        → Inquiry → 'accepted'
     b) REJECT → venue_availability → 'rejected'
        → Inquiry → 'rejected'
     c) COUNTER PROPOSAL → nova terms, promjena datuma
        → Inquiry → 'terms_proposed'
     d) INFO REQUEST → pitanje nazad
        → Inquiry → 'under_review'

6. Organizator vidi odgovor:
   - Ako accepted → može kreirati occurrence za taj datum/prostor
   - Ako counter → pregovori dalje (organizer_reviewing)
   - Ako rejected → traži drugi prostor

7. Occurrence kreiranje (nakon accept):
   - venue_layout_id = current layout prostora
   - rental_terms_snapshot = JSONB kopija dogovorenih uvjeta
   - venue_availability.occurrence_id = nova occurrence
```

**Inquiry statusi (lifecycle):**
```
draft → sent → under_review → terms_proposed → organizer_reviewing → accepted
                                                                    → rejected
                                                                    → cancelled
                                                                    → expired
```

### 11.3 Event konfiguracija

Nakon što je occurrence kreirana, organizator konfigurira prodaju:

**Tierovi (cjenovni razredi):**
```
POST /occurrences/{occ_id}/tiers
{
  "name": "Early Bird",
  "price": 15.00,
  "total_count": 100,
  "tier_order": 1,
  "sale_start": "2026-03-15T00:00:00Z",
  "sale_end": "2026-03-25T00:00:00Z"
}
```

**Tier ↔ Section mapiranje:**
```
POST /tiers/{tier_id}/sections
{
  "section_id": "<section_uuid>"
}
```
→ Trigger `validate_tier_section_layout` osigurava da je sekcija iz istog layouta kao occurrence.

**Packages:**
```
POST /occurrences/{occ_id}/packages
{
  "name": "VIP Table for 6",
  "price": 300.00,
  "tier_id": "<vip_tier_uuid>",
  "entries_included": 6,
  "drinks_included": 2,
  "table_section_id": "<vip_section_uuid>",
  "items": {"bottles": [...], "merch": [...]}
}
```

**Bundles (event-level):**
```
POST /events/{event_id}/bundles
{
  "name": "Weekend Pass",
  "price": 120.00,
  "total_count": 200,
  "occurrences": [
    {"occurrence_id": "...", "tier_id": "...", "package_id": null},
    {"occurrence_id": "...", "tier_id": "...", "package_id": null}
  ]
}
```

---

## 12. Flow 10: Checkout i plaćanje {#12-flow-10-checkout-i-plaćanje}

### 12.1 Checkout sesija

**Pravilo:** Jedan order = jedna organizacija. Ako korisnik kupuje od dvije organizacije → dva ordera, dva checkoutа.

```
┌──────────────────────────────────────────────────────┐
│  CHECKOUT                                            │
│                                                      │
│  ┌────────────────────────────────────────┐          │
│  │  Narudžba:                            │          │
│  │  2x Regular Ticket    25€ × 2 = 50€  │          │
│  │  1x VIP Table (6)     300€            │          │
│  │                                        │          │
│  │  Subtotal:            350€            │          │
│  │  Platform fee:          5€            │          │
│  │  ─────────────────────────            │          │
│  │  UKUPNO:              355€            │          │
│  └────────────────────────────────────────┘          │
│                                                      │
│  Order: NOIR-20260328-A7F2                          │
│  Valuta: EUR                                         │
│  Ističe za: 29:45                                    │
│                                                      │
│  [Email za potvrdu: _________ ]                     │
│  (za ghost checkout)                                 │
│                                                      │
│  [💳 PLATI — Stripe]                                │
│  [💳 PLATI — CorvusPay]                             │
│  (prikazani gatewayevi organizacije)                │
└──────────────────────────────────────────────────────┘
```

### 12.2 Checkout flow — backend

```
FAZA 1: DRAFT ORDER
  POST /checkout/create
  {
    "org_id": "...",
    "items": [
      {"type": "ticket", "tier_id": "...", "quantity": 2, "item_ids": [null, null]},
      {"type": "package", "package_id": "...", "item_id": "<table_uuid>"}
    ],
    "email": "user@example.com"  // za ghost checkout
  }

  Backend:
  1. resolve_or_create_profile(email) → user_id
  2. Kreiraj tickets (status='pending_payment')
  3. Kreiraj table_reservation ako ima stol (status='pending')
  4. extend_seat_locks_for_order() ako ima locked seats
  5. Kreiraj order (status='draft', expires_at=NOW+30min)
  6. Kreiraj order_items za svaku stavku
  7. Trigger auto-generira order_number: NOIR-YYYYMMDD-XXXX
  8. Trigger auto-računa subtotal + total_amount
  9. Vrati order ID + detalje

FAZA 2: PAYMENT SESSION
  POST /checkout/pay
  {
    "order_id": "...",
    "gateway_id": "..."  // koji payment gateway
  }

  Backend:
  1. Provjeri order status = 'draft' i nije expired
  2. Kreiraj Stripe/CorvusPay checkout session
  3. Update order: status='pending_payment', gateway_session_id=session.id
  4. Vrati redirect URL za payment

FAZA 3: WEBHOOK
  POST /checkout/webhook (Stripe/CorvusPay poziva)

  Backend (ako uspješno):
  1. Pronađi order po gateway_session_id
  2. Kreiraj transaction (type='charge', status='completed')
  3. Update order → status='completed', completed_at=NOW
  4. Update tickets → status='active', purchased_at=NOW
     → Trigger: sold_count +1 na tier, package, occurrence
  5. Update ticket_bundles → status='active' (ako bundle)
  6. Update table_reservations → status='confirmed' (ako stol)
  7. Update occurrence_item_status → status='sold' (za seats)
  8. Pošalji email s QR kodovima (async)

  Backend (ako neuspješno):
  1. Update order → status='failed'
  2. Oslobodi resurse (seats, reservations)

FAZA 4: TIMEOUT
  expire_pending_orders() cron (svake 2 min):
  - Draft/pending orders stariji od expires_at
  - Expire order + cancel tickets + oslobodi seats + cancel reservations
```

### 12.3 Order number format

`NOIR-YYYYMMDD-XXXX` (4 random hex znaka). Ako kolizija, retry do 10×, zatim 8-char fallback.

### 12.4 Multi-org checkout

Ako korisnik kupi od dvije organizacije u istom "košariku":
1. Frontend kreira **dva ordera** (jedan po org)
2. Svaki order ide na svoj payment gateway
3. Korisnik plaća dva puta (ili app prikaže kao dva koraka)

---

## 13. Flow 11: Door Sale (prodaja na vratima) {#13-flow-11-door-sale}

### 13.1 Flow

```
┌──────────────────────────────────────────┐
│  DOOR SALE (staff screen)               │
│  Permission: sell_at_door               │
│                                          │
│  1. Staff odabere izvedbu               │
│  2. Unese email kupca                    │
│  3. Odabere tier + količinu             │
│  4. (opcionalno) odabere sjedalo/stol   │
│                                          │
│  Backend (INSTANT — nema webhook):      │
│  1. resolve_or_create_profile(email)    │
│  2. Kreiraj order:                      │
│     - status = 'completed'              │
│     - gateway = 'door_sale'             │
│  3. Kreiraj tickets:                    │
│     - status = 'active'                 │
│  4. Kreiraj charge transaction:         │
│     - status = 'completed'             │
│  5. (async) Email s QR kodom            │
│                                          │
│  Gotovo — nema čekanja na payment.      │
│  Plaćanje je "cash/card on site".       │
└──────────────────────────────────────────┘
```

### 13.2 Door sale vs online

| Aspekt | Online | Door Sale |
|--------|--------|-----------|
| Gateway | Stripe/CorvusPay | `door_sale` (pseudo-gateway) |
| Webhook | Async, čeka potvrdu | Nema — instant |
| Order status | draft → pending → completed | Odmah completed |
| Ticket status | pending → active | Odmah active |
| Tko plaća | Korisnik (online) | Korisnik (cash/card na licu mjesta) |
| Tko operira | Korisnik sam | Staff s permisijom |

---

## 14. Flow 12: Dan eventa — scan, piće, ulaz {#14-flow-12-dan-eventa}

### 14.1 Ticket scan (Patch P14)

```
┌──────────────────────────────────────────┐
│  SCAN SCREEN (staff mobile app)         │
│  Permission: scan_ticket                │
│                                          │
│  1. Staff skenira QR kod kameron        │
│  2. scan_ticket(qr_token, occurrence_id,│
│     scanned_by) → JSONB                 │
│                                          │
│  Mogući rezultati:                       │
│  ✅ success        → "Dobrodošli!"      │
│     - ticket → 'scanned'                │
│     - prikazuje: ime, tier, sjedalo,    │
│       preostala pića                     │
│  ❌ already_scanned → "Već skenirano"   │
│     - prikazuje: kad i tko              │
│  ❌ wrong_occurrence → "Krivi event"    │
│  ❌ invalid_status → "Ticket nevažeći"  │
│  ❌ not_found → "QR ne postoji"         │
│                                          │
│  SVE se logira u ticket_scans tablicu   │
│  (audit trail čak i za neuspjele)       │
└──────────────────────────────────────────┘
```

### 14.2 Drink redeem (Patch P16)

```
┌──────────────────────────────────────────┐
│  BAR SCREEN (bar_staff mobile)          │
│  Permission: redeem_drink               │
│                                          │
│  1. Skenira QR ticketa                  │
│  2. redeem_drink(ticket_id, staff_id)   │
│     → atomični dekrement                 │
│                                          │
│  ✅ success → "Piće iskorišteno"        │
│     - remaining: 1 (od 3)              │
│  ❌ no_drinks_left → "Nema više pića"   │
│  ❌ invalid_ticket → "Ticket nevažeći"  │
│     (mora biti 'scanned' status)        │
│                                          │
│  SVE se logira u drink_redemptions      │
│  (drinks_before, drinks_after, staff)   │
└──────────────────────────────────────────┘
```

### 14.3 Reservation check-in

Staff može potvrditi dolazak za stol:
```
UPDATE table_reservations SET status = 'completed'
WHERE id = :reservation_id AND status = 'confirmed';
```

No-show:
```
UPDATE table_reservations SET status = 'no_show'
WHERE id = :reservation_id AND status = 'confirmed';
```

---

## 15. Flow 13: Post-event — analitika i obračun {#15-flow-13-post-event}

### 15.1 Completion flow

```
1. Organizator markira occurrence kao 'completed'
2. Trigger auto_generate_payment_order():
   - Provjeri: self-hosted (from_org == to_org)? → Preskoči
   - Provjeri: rental_terms_snapshot.pricing_model
     - 'free' → Preskoči
     - 'fixed' → PO amount = fixed_amount
     - 'revenue_share' → PO = ticket_revenue × share_pct (min guarantee)
     - 'hybrid' → PO = fixed + ticket_revenue × share_pct
     - 'negotiable' → PO amount = 0 (draft za ručno ispunjavanje)
   - Kreiraj payment_order (status='draft', due_date=event_date+14 dana)

3. Venue owner vidi PO u dashboardu → izdaje račun
4. Organizator plaća → PO status='paid'
```

### 15.2 Analytics dashboard (org_revenue_view)

View `org_revenue_view` daje:
- Svaki order za organizaciju
- Total charged (suma uspješnih charges)
- Total refunded (suma refundova)
- Item count po orderu
- Gateway info

**Dashboard metrike (app-level kalkulacija):**

| Metrika | Izvor |
|---------|-------|
| Ukupno prodano ulaznica | `SUM(event_tiers.sold_count)` po occurrence |
| Ukupan prihod | `org_revenue_view.total_charged` |
| Neto prihod | total_charged - total_refunded |
| Popunjenost | sold_count / total_capacity × 100 |
| Prihod po izvedbi | Grupa po occurrence_id |
| Top-selling tier | ORDER BY sold_count DESC |
| Aktivnih rezervacija | COUNT table_reservations WHERE status='confirmed' |
| Scan rate | (scanned / active tickets) × 100 |
| Drink redemption | SUM(drink_redemptions) / SUM(tickets.remaining_drinks_at_purchase) |

---

## 16. Flow 14: Refund i otkazivanje {#16-flow-14-refund-i-otkazivanje}

### 16.1 Admin refund (ručni)

```
POST /refunds/create
{
  "order_id": "...",
  "items": [
    {"order_item_id": "...", "amount": 25.00}
  ],
  "reason": "Korisnik zatražio refund"
}

Backend:
1. Pronađi charge transaction za order
2. Kreiraj refund transaction (parent=charge)
3. Update order_item refunded_amount
4. Trigger sync_order_refund_status → order status
5. Update ticket status → 'refunded'
6. Trigger auto_cancel_reservation → oslobodi stol
7. Trigger sold_count -1
8. (Stripe API) Issue refund
```

### 16.2 Occurrence cancellation (kaskadni)

Kad organizator otkaže izvedbu:

```
UPDATE event_occurrences SET status = 'cancelled' WHERE id = :occ_id;

Trigger handle_occurrence_cancellation() (STRIKTAN REDOSLIJED):
1. occurrence_item_status → 'unavailable' (svi itemsi)
2. table_reservations → 'cancelled' (svi pending/confirmed)
3. tickets → 'cancelled' (svi active/reserved/pending)
4. Bundle refund loop:
   - Za svaki bundle koji ima ticket na ovoj izvedbi
   - Proporcionalni refund: total_price / original_occurrence_count
   - SAMO ako postoji charge transaction (free events → preskoči)
   - Full refund: ako su SVE occurrence cancelled + 0 scanned
   - Partial refund: ako su sve cancelled ali neki skenirani
```

---

## 17. Sigurnosni model (RLS + RBAC) {#17-sigurnosni-model}

### 17.1 RLS matrica

| Entitet | Anonimni | Korisnik (auth) | Org member | Platform admin |
|---------|----------|-----------------|------------|----------------|
| profiles | - | Svoj: R/W, Tuđi: R | Isto | service_role bypass |
| events | published: R | published: R | Org: R/W | bypass |
| venues | public: R | public+unlisted: R | Org: R/W | bypass |
| tickets | - | Svoje: R | Org: R | bypass |
| orders | - | Svoje: R | Org: R | bypass |
| transactions | - | Kroz order | Kroz order | bypass |
| occurrence_item_status | - | R (seat map) | Org: R/W | bypass |
| payment_orders | - | - | from_org: R/W, to_org: R | bypass |
| audit_log | - | - | Org owner/admin: R | bypass |
| venue_rental_terms | publicly_visible: R | publicly_visible: R | Org: R/W | bypass |

### 17.2 Viewovi s security_invoker

Sva tri viewa koriste `security_invoker = true`:
- `user_tickets_view` — RLS na tickets se primjenjuje → korisnik vidi samo svoje
- `user_transactions_view` — RLS na orders/transactions → samo svoje
- `org_revenue_view` — RLS na orders → samo za svoju organizaciju

**Kritično:** Organizacija A NE MOŽE vidjeti prihode organizacije B. RLS na `orders.org_id` + `organization_members` to osigurava.

### 17.3 Izolacija podataka između organizacija

Baza garantira potpunu izolaciju:
- Orders pripadaju org_id → RLS filtrira
- Tickets su vidljivi samo kupcu + org koji je event kreirao
- Payment orders: from_org vidi sve, to_org vidi samo svoje primljene
- Venue inquiries: obe strane vide, ali samo svoje
- Audit log: samo owner/admin svoje organizacije

---

## 18. API Endpoint Plan {#18-api-endpoint-plan}

### 18.1 Auth & Profiles

| Metoda | Path | Opis | Auth |
|--------|------|------|------|
| POST | `/auth/register` | Registracija | - |
| POST | `/auth/login` | Login | - |
| POST | `/auth/google` | Google OAuth | - |
| GET | `/profiles/me` | Moj profil | ✅ |
| PUT | `/profiles/me` | Update profil | ✅ |
| PUT | `/preferences/me` | Update preferencije | ✅ |

### 18.2 Events & Discovery

| Metoda | Path | Opis | Auth |
|--------|------|------|------|
| GET | `/events/discover` | Feed s paginacijom + personalizacija | ✅ (opcionalno) |
| GET | `/events/{id}` | Event detail | - |
| GET | `/events/{id}/occurrences` | Izvedbe eventa | - |
| GET | `/occurrences/{id}/tiers` | Tierovi + dostupnost | - |
| GET | `/occurrences/{id}/packages` | Paketi | - |
| GET | `/occurrences/{id}/seat-map` | Seat mapa (statusi) | - |
| GET | `/events/{id}/bundles` | Multi-day bundleovi | - |

### 18.3 Checkout & Purchase

| Metoda | Path | Opis | Auth |
|--------|------|------|------|
| POST | `/seats/lock` | Lock sjedala | ✅ |
| DELETE | `/seats/lock` | Release lock | ✅ |
| POST | `/checkout/create` | Kreiraj draft order | ✅ |
| POST | `/checkout/pay` | Pokreni plaćanje | ✅ |
| POST | `/checkout/webhook` | Payment webhook | Webhook secret |
| POST | `/checkout/cancel` | Odustani od ordera | ✅ |
| POST | `/tables/{id}/reserve` | Standalone rezervacija | ✅ |

### 18.4 Tickets & User

| Metoda | Path | Opis | Auth |
|--------|------|------|------|
| GET | `/my/tickets` | Moje ulaznice (view) | ✅ |
| GET | `/my/orders` | Moje narudžbe | ✅ |
| GET | `/my/transactions` | Moje transakcije (view) | ✅ |

### 18.5 Organization Management

| Metoda | Path | Opis | Auth + Perm |
|--------|------|------|-------------|
| POST | `/organizations` | Kreiraj organizaciju | ✅ |
| PUT | `/organizations/{id}` | Update | owner/admin |
| GET | `/organizations/{id}/members` | Članovi | member |
| POST | `/organizations/{id}/members/invite` | Pozovi | owner/admin |
| PUT | `/organizations/{id}/members/{mid}` | Promijeni rolu | owner/admin |
| POST | `/organizations/{id}/gateways` | Dodaj gateway | owner/admin |

### 18.6 Venues & Builder

| Metoda | Path | Opis | Auth + Perm |
|--------|------|------|-------------|
| POST | `/venues` | Kreiraj venue | manage_venue |
| PUT | `/venues/{id}` | Update venue | manage_venue |
| GET | `/venues/{id}/layout` | Current layout JSON | public (read) |
| POST | `/venues/{id}/layout/save` | Spremi layout | manage_venue |
| GET | `/venues/{id}/layouts` | Sve verzije | manage_venue |
| POST | `/venues/{id}/rental-terms` | Dodaj uvjete | manage_venue |

### 18.7 Event Management (org)

| Metoda | Path | Opis | Auth + Perm |
|--------|------|------|-------------|
| POST | `/events` | Kreiraj event | manage_events |
| PUT | `/events/{id}` | Update | manage_events |
| POST | `/events/{id}/publish` | Publish event | manage_events |
| POST | `/occurrences` | Kreiraj izvedbu | manage_events |
| POST | `/occurrences/{id}/tiers` | Dodaj tier | manage_events |
| POST | `/tiers/{id}/sections` | Mapiraj sekciju | manage_events |
| POST | `/occurrences/{id}/packages` | Dodaj paket | manage_events |
| POST | `/events/{id}/bundles` | Dodaj bundle | manage_events |

### 18.8 Inquiry Flow

| Metoda | Path | Opis | Auth + Perm |
|--------|------|------|-------------|
| POST | `/venues/{id}/inquiries` | Pošalji upit | manage_events |
| GET | `/inquiries/sent` | Moji poslani upiti | manage_events |
| GET | `/inquiries/received` | Primljeni upiti | manage_venue |
| POST | `/inquiries/{id}/respond` | Odgovori | manage_venue |
| POST | `/inquiries/{id}/accept` | Prihvati | manage_venue |

### 18.9 Operations (dan eventa)

| Metoda | Path | Opis | Auth + Perm |
|--------|------|------|-------------|
| POST | `/scan` | Skeniraj ticket | scan_ticket |
| POST | `/drinks/redeem` | Iskoristi piće | redeem_drink |
| POST | `/door-sale` | Door sale | sell_at_door |
| POST | `/reservations/{id}/swap` | Swap stol | manage_reservations |

### 18.10 Analytics & Finance

| Metoda | Path | Opis | Auth + Perm |
|--------|------|------|-------------|
| GET | `/organizations/{id}/analytics` | Dashboard podaci | view_analytics |
| GET | `/organizations/{id}/payment-orders` | Payment orders | manage_finances |
| POST | `/refunds/create` | Admin refund | manage_finances |

---

## 19. Frontend Screen Map {#19-frontend-screen-map}

### 19.1 Mobile App (Flutter) — Korisnik

| Screen | Opis | Prioritet |
|--------|------|-----------|
| **Splash** | Logo + auth check | MVP |
| **Login/Register** | Google + Email | MVP |
| **Onboarding** | Upitnik (3-4 koraka) | MVP |
| **Discovery Feed** | Swipe kartice evenata | MVP |
| **Event Detail** | Puni detalj + cijene + mapa | MVP |
| **Seat Map** | Interaktivna mapa (odabir) | MVP |
| **Cart/Checkout** | Order summary + plaćanje | MVP |
| **Payment** | WebView za Stripe/CorvusPay | MVP |
| **My Tickets** | Lista karata + QR | MVP |
| **Ticket Detail** | QR kod + info | MVP |
| **My Orders** | Povijest narudžbi | MVP |
| **Profile** | Osobni podaci + preferencije | MVP |
| **Filters** | Filtriranje evenata | MVP |

### 19.2 Web App (Next.js) — Korisnik

| Screen | Opis | Prioritet |
|--------|------|-----------|
| **Landing Page** | Marketing + CTA | MVP |
| **Event Listing** | Grid/lista evenata | MVP |
| **Event Detail** | Isto kao mobile, responsive | MVP |
| **Seat Map** | Interaktivna mapa (veći canvas) | MVP |
| **Checkout** | Stripe/CorvusPay embedded | MVP |
| **My Tickets** | Account sekcija | MVP |

### 19.3 Web Dashboard (Next.js) — Organizacije

| Screen | Opis | Prioritet |
|--------|------|-----------|
| **Org Onboarding** | Register + capability + podaci | MVP |
| **Dashboard Home** | Analitika pregled | MVP |
| **Event List** | CRUD eventi | MVP |
| **Event Editor** | Konfiguracija tierova, paketa, bundleova | MVP |
| **Venue Builder** | Drag & drop tlocrt | MVP |
| **Venue List** | CRUD prostori | MVP |
| **Inquiry Inbox** | Poslani/primljeni upiti | MVP |
| **Door Sale** | Prodaja na vratima | MVP |
| **Scan** | QR skener (kamera) | MVP |
| **Drink Redeem** | QR skener za piće | MVP |
| **Orders/Transactions** | Financijski pregled | MVP |
| **Payment Orders** | Obračun s venue ownerima | MVP |
| **Team** | Upravljanje članovima | MVP |
| **Settings** | Org profil + gateways | MVP |

### 19.4 Mobile App (Flutter) — Staff/Org

| Screen | Opis | Prioritet |
|--------|------|-----------|
| **Door Sale** | Brzi unos za prodaju | MVP |
| **Scan** | QR skener kameron | MVP |
| **Drink Redeem** | QR skener za piće | MVP |
| **Reservations** | Pregled rezervacija | MVP |

---

## 20. MVP Prioritizacija {#20-mvp-prioritizacija}

### 20.1 Sprint plan (12 tjedana)

**Tjedan 1-2: Temelji**
- [x] Database schema (gotovo — 6ver + patch)
- [ ] FastAPI skeleton + auth middleware
- [ ] Supabase auth konfiguracija (Google OAuth + email)
- [ ] RBAC middleware (permission check)
- [ ] Audit log middleware
- [ ] Osnovni CRUD za profiles, organizations, members

**Tjedan 3-4: Venue & Event Core**
- [ ] Venue CRUD + visibility
- [ ] Venue Builder backend (JSON parse → DB sync)
- [ ] Venue Builder frontend (drag & drop canvas)
- [ ] Event CRUD + occurrence kreiranje
- [ ] Tier/Package/Bundle konfiguracija endpointi
- [ ] Self-hosted event shortcut

**Tjedan 5-6: Inquiry + Discovery**
- [ ] Inquiry flow (CRUD + respond + accept/reject)
- [ ] Venue availability s exclusion constraint
- [ ] Event discovery feed (personalizacija query)
- [ ] Swipe UI komponenta (mobile)
- [ ] Event listing (web)
- [ ] Event detail screen (mobile + web)

**Tjedan 7-8: Checkout + Payment**
- [ ] Seat map rendering (iz JSON + OIS statusi)
- [ ] Seat locking (lock_seat_for_checkout frontend integracija)
- [ ] Checkout flow (create → pay → webhook)
- [ ] Stripe integration (test mode)
- [ ] CorvusPay integration (konfigurabilno)
- [ ] Door sale flow
- [ ] Order management (my orders, org orders)
- [ ] Ghost checkout

**Tjedan 9-10: Dan eventa + Analitika**
- [ ] QR scan screen (mobile kamera + scan_ticket)
- [ ] Drink redeem screen
- [ ] Ticket detail s QR kodom
- [ ] My Tickets screen
- [ ] Analytics dashboard (org_revenue_view + metrike)
- [ ] Payment orders (auto-generiranje + pregled)
- [ ] Bundle checkout flow
- [ ] Refund admin flow

**Tjedan 11-12: Polish + Demo**
- [ ] Seed data za demo
- [ ] UI/UX polish (animacije, loading states, error handling)
- [ ] Edge case testing (timeout, refund, cancellation)
- [ ] Performance optimizacija (indeksi, RLS efikasnost)
- [ ] Landing page
- [ ] Demo scenario priprema

### 20.2 Što MORA biti u MVP

| Feature | Razlog | Baza podržava |
|---------|--------|--------------|
| Auth (Google + email) | Osnova | ✅ profiles + auth.users |
| Org onboarding | Osnova | ✅ organizations + members |
| Venue Builder | Ključni differentiator | ✅ layouts + sections + items + JSON |
| Event kreiranje + tierovi | Core prodaja | ✅ events + occurrences + tiers |
| Inquiry flow | Trostrani model | ✅ inquiries + responses + availability |
| Ticket kupovina (numbered + unnumbered) | Core prodaja | ✅ tickets + OIS + locks |
| Paketi (occurrence_packages) | Upsell | ✅ packages + tier + section |
| Multi-day bundleovi | Višednevni eventi | ✅ bundle_types + BTO + ticket_bundles |
| Stolovi (rezervacija + stol u paketu) | Premium | ✅ table_reservations + locks |
| Checkout + Stripe | Plaćanje | ✅ orders + transactions + gateways |
| Door sale | Operativa | ✅ gateway_type='door_sale' |
| QR scan | Ulaz | ✅ ticket_scans + scan_ticket() |
| Drink redeem | Operativa | ✅ drink_redemptions + redeem_drink() |
| Dashboard analitika | Org pregled | ✅ org_revenue_view |
| Discovery feed (swipe) | UX | ✅ events + prefs + tags |

### 20.3 Što je POST-MVP

| Feature | Razlog | Što treba |
|---------|--------|-----------|
| Push notifikacije | UX improvement | Nova tablica + FCM/APNs |
| Email notifikacije | Order confirmation, reminders | Email service (Resend/Postmark) |
| Bookmark/save events | Discovery UX | Nova tablica `saved_events` |
| Social sharing | Marketing | Deeplink + OG meta |
| Promo kodovi / popusti | Sales tool | Nova tablica `promo_codes` + discount logic |
| Waitlist za sold out | Sales tool | Nova tablica `waitlists` |
| Multi-currency po orderu | Internacionalizacija | Već podržano u bazi (FK na currencies) |
| Reporting export (CSV/PDF) | Analytics | App-level export |
| Recurring events | Convenience | App-level cloning occurrence |
| Venue rating/reviews | Discovery | Nova tablica `reviews` |
| Chat/messaging | Inquiry UX | Nova tablica + real-time |
| Ticket transfer | P2P | App-level status change |
| Dynamic pricing | Revenue | App-level tier price update |

---

## 21. Skalabilnost i post-MVP smjernice {#21-skalabilnost}

### 21.1 Što je već skalabilno

| Aspekt | Zašto |
|--------|-------|
| **Kapacitet enforcement** | Trostruka DB-level zaštita — nikad ne ovisi o app logici |
| **Organizacijske sposobnosti** | Boolean flags, ne ENUM — nova capability = nova kolona |
| **Payment gateways** | ENUM je proširiv, config je JSONB — novi provider = dodaj value + .env |
| **Layout verzioniranje** | Potpuna izolacija verzija — stare izvedbe nisu pogođene |
| **Multi-currency** | FK na supported_currencies, enforcano triggerima |
| **RLS** | Defense-in-depth — čak i ako API ima bug, podaci su sigurni |
| **Audit log** | App-level middleware — lako proširiv za nove entitete |
| **Seat locking** | Advisory lock + atomic DB operations — race condition safe |
| **Cron jobs** | Tri pg_cron zadatka za automatsko čišćenje |

### 21.2 Skalabilnost za buduće potrebe

**Dodavanje novog payment providera (npr. CorvusPay):**
```sql
ALTER TYPE gateway_type ADD VALUE 'corvuspay';
-- Backend: novi handler u gateway_factory.py
-- Config: CORVUSPAY_API_KEY u .env
```

**Dodavanje nove organizacijske sposobnosti:**
```sql
ALTER TABLE organizations ADD COLUMN can_manage_artists BOOLEAN DEFAULT FALSE;
-- Nema utjecaja na CHECK — or je proširiv
-- Update CHECK:
ALTER TABLE organizations DROP CONSTRAINT chk_org_has_capability;
ALTER TABLE organizations ADD CONSTRAINT chk_org_has_capability
    CHECK (can_organize OR can_own_venues OR can_manage_artists);
```

**Dodavanje promo kodova (post-MVP):**
```sql
CREATE TABLE promo_codes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id UUID NOT NULL REFERENCES organizations(id),
    code VARCHAR(50) UNIQUE NOT NULL,
    discount_type VARCHAR(20) NOT NULL, -- 'percentage', 'fixed'
    discount_value DECIMAL(10,2) NOT NULL,
    applies_to_tier_id UUID REFERENCES event_tiers(id),
    max_uses INT,
    used_count INT DEFAULT 0,
    valid_from TIMESTAMPTZ,
    valid_until TIMESTAMPTZ,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);
-- + FK na orders za tracking
```

**Dodavanje notifikacija (post-MVP):**
```sql
CREATE TABLE notifications (
    id BIGSERIAL PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES auth.users(id),
    type VARCHAR(50) NOT NULL,
    title VARCHAR(255) NOT NULL,
    body TEXT,
    data JSONB,
    read_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_notif_user_unread ON notifications(user_id, created_at DESC)
    WHERE read_at IS NULL;
```

### 21.3 Performance smjernice

**Indeksiranje:** 70+ indeksa već postoji, uključujući partial indekse za najčešće upite:
- `idx_orders_pending_expiry` WHERE status IN (draft, pending) — za cron
- `idx_item_status_locked_expires` WHERE status=locked — za cron
- `idx_tickets_user_purchased` WHERE status NOT IN (cancelled, expired) — za "Moje karte"
- `idx_profiles_unclaimed` WHERE claimed_at IS NULL — za ghost account cleanup

**Potencijalni bottleneckovi i rješenja:**

| Scenarij | Problem | Rješenje |
|----------|---------|---------|
| Visoki promet na seat mapu | Česti SELECT na OIS | Supabase Realtime subscription umjesto pollinga |
| Spike na sale start | Mnogo lockova istovremeno | Advisory lock + SKIP LOCKED već riješen |
| Discovery feed | Kompleksni JOIN s personalizacijom | Materialized view ili cache (Redis) za hot events |
| Audit log rast | Velika tablica | Particioniranje po mjesecu (post-MVP) |
| QR scan na ulazu | Mnogo scanove u kratkom roku | scan_ticket() je FOR UPDATE — serializiran, ali brz |

### 21.4 Supabase-specifične preporuke

- **Real-time:** Koristi Supabase Realtime za seat map updates (OIS promjene)
- **Storage:** Layout JSON na Supabase Storage (već predviđeno)
- **Edge Functions:** Za webhook handling (Stripe/CorvusPay) — brži odgovor
- **Connection pooling:** Supavisor (default u Supabaseu) — dovoljan za MVP
- **Row-level limits:** RLS s IN(subquery) može biti spor na velikim tablicama → pratiti EXPLAIN ANALYZE

---

## 22. Seed Data strategija {#22-seed-data}

### 22.1 Lokalni test seed

```
Organizacije (3):
  1. "Noir Events" (can_organize=TRUE, can_own_venues=TRUE)
     - Venue: "Club Noir" (Zagreb, club, public, 500 cap)
     - Layout v1: standing (200) + seated (100) + VIP lounge (30) + VIP tables (6×5=30)
  2. "Zagreb Nights" (can_organize=TRUE, can_own_venues=FALSE)
     - Nema venue — šalje inquiry
  3. "Space Hall" (can_organize=FALSE, can_own_venues=TRUE)
     - Venue: "Space Hall" (Zagreb, concert_hall, public, 1200 cap)

Eventi (3):
  1. "Techno Friday" — Noir Events @ Club Noir (self-hosted)
     - 1 occurrence (petak)
     - 3 tiera: Early Bird (15€, 100), Regular (25€, 200), VIP (50€, 50)
     - 2 paketa: "Drink & Dance" (35€), "VIP Table for 6" (300€)
  2. "Weekend Festival" — Noir Events @ Club Noir (self-hosted)
     - 3 occurrences (pet+sub+ned)
     - Bundle: "Weekend Pass" (60€)
  3. "Concert Night" — Zagreb Nights @ Space Hall (inquiry flow)
     - 1 occurrence
     - Inquiry → accepted → occurrence kreirana

Korisnici (5):
  - 2 regular usera s preferencijama
  - 1 ghost account (samo email)
  - 1 staff member (door_staff rola)
  - 1 bar_staff member

Ticketi (10):
  - Mix: active, scanned, cancelled, pending
  - Uključuje bundle i package tickete

Orders (5):
  - Mix: completed, refunded, expired
  - Uključuje door_sale order
```

### 22.2 Seed script format

FastAPI management command ili standalone Python script koji:
1. Kreira auth.users preko Supabase Admin API
2. Insertira podatke redom (poštujući FK)
3. Koristi service_role key (bypass RLS)
4. Generira realistične datume (sljedeći tjedan od runtime)

---

## 23. Tehničke mehanike baze — deep dive {#23-tehničke-mehanike}

### 23.1 Kompletna lista DB-level zaštita

| Zaštita | Mehanizam | Tablica/Funkcija |
|---------|-----------|-----------------|
| Oversell — occurrence | CHECK: `sold_count <= total_capacity` | event_occurrences |
| Oversell — tier | CHECK: `sold_count <= total_count` | event_tiers |
| Oversell — package | CHECK: `max_quantity IS NULL OR sold_count <= max_quantity` | occurrence_packages |
| Oversell — bundle | CHECK: `sold_count <= total_count` | bundle_types |
| Tier sum ≤ occurrence | Trigger T5 | event_tiers |
| Occurrence ≤ layout | Trigger T6 | event_occurrences |
| Tier sum po sekciji ≤ section | Trigger T23/T24 | event_tiers + tier_sections |
| Double-booking venue | GiST exclusion constraint | venue_availability |
| Double-sell seat | UNIQUE(occurrence_id, item_id) + FOR UPDATE | occurrence_item_status |
| Double-reserve table | Partial unique index | table_reservations |
| Race condition locks | Advisory lock + atomic function | lock_seat_for_checkout() |
| Cross-venue layout | Trigger P1 | event_occurrences |
| Cross-occurrence tier | Trigger T19/T20/T21 | packages + BTO |
| Cross-layout section | Trigger T28 | tier_sections |
| Immutable venue | Trigger T22 | event_occurrences |
| Currency mismatch | Triggers T10/T11/T12 | tiers + packages + bundles |
| Sale window violation | Trigger T9 | tickets |
| Over-refund bundle | CHECK + LEAST() | ticket_bundles |
| Negative counts | CHECK: `>= 0` na svim countovima | tier, package, occurrence |
| Invalid timezone | CHECK: `AT TIME ZONE` validacija | venues |
| Orphan capabilities | CHECK: `can_organize OR can_own_venues` | organizations |
| Polimorfna FK | Trigger T15 | order_items |
| QR token uniqueness | UNIQUE constraint + crypto default | tickets, ticket_bundles |

### 23.2 Cron jobs — automatsko čišćenje

| Job | Interval | Funkcija | Što čisti |
|-----|----------|----------|-----------|
| expire-seat-locks | Svaku minutu | `expire_seat_locks()` | Locked seats s isteklim reserved_until |
| expire-pending-orders | Svake 2 minute | `expire_pending_orders()` | Draft/pending orders + sve vezane resurse |
| expire-standalone-reservations | Svakih 5 min | `expire_standalone_reservations()` | 48h standalone table holds |

### 23.3 Trigger execution order (kritičan)

**Occurrence cancellation — redoslijed je BITAN:**
```
1. OIS → unavailable       (sprečava nove lockove)
2. Reservations → cancelled (oslobađa stolove)
3. Tickets → cancelled      (oslobađa ulaznice, PALI T1: sold_count-1 i T3: auto-cancel reservation)
4. Bundle refund loop       (proporcionalni refund, kreira transactions)
```

Pogrešan redoslijed može uzrokovati:
- T3 se pali na ticket cancel → pokušava cancelirati već canceliranu rezervaciju → OK (idempotent)
- T1 se pali na ticket cancel → smanjuje sold_count → OK
- Ali ako bi bundle refund bio PRIJE ticket cancela → refund kreira transakciju za active ticket koji se onda cancela → inkonzistencija

### 23.4 ENUM lista (kompletna)

```
platform_role: super_admin, support, finance_admin
org_member_role: owner, admin, manager, staff, door_staff, bar_staff
gateway_type: stripe, paypal, monri, wspay, keks_pay, bank_transfer, cash, door_sale
venue_type: club, bar, concert_hall, outdoor, sports_arena, theater, restaurant, rooftop, other
venue_visibility: public, private, unlisted
section_type: standing, seated, table_area, vip_lounge, vip_table, stage, other
item_type: seat, table
rental_pricing_model: fixed, revenue_share, hybrid, free, negotiable
event_status: draft, pending_venue, venue_confirmed, published, cancelled, completed
occurrence_status: scheduled, on_sale, sold_out, cancelled, completed
inquiry_status: draft, sent, under_review, terms_proposed, organizer_reviewing, accepted, rejected, cancelled, expired
inquiry_response_type: accepted, rejected, counter_proposal, info_request
venue_availability_status: tentative, blocked, available, rejected
item_availability: available, locked, reserved, sold, blocked, unavailable
ticket_status: reserved, pending_payment, active, scanned, cancelled, refunded, expired
bundle_status: pending_payment, active, partially_used, partially_refunded, fully_used, cancelled, refunded
reservation_status: pending, confirmed, cancelled, no_show, completed, expired
reservation_source: ticket_purchase, manual_booking, standalone
order_status: draft, pending_payment, completed, failed, expired, partially_refunded, refunded, cancelled, disputed
order_item_type: ticket, bundle, table_reservation
order_item_status: pending, active, refunded, cancelled, fulfilled
transaction_type: charge, refund, void, dispute, dispute_reversal
transaction_status: pending, completed, failed
payment_order_status: draft, issued, paid, overdue, disputed, cancelled, waived
audit_action: INSERT, UPDATE, DELETE
scan_result: success, already_scanned, invalid_status, wrong_occurrence, not_found
drink_result: success, no_drinks_left, invalid_ticket
```

---

## Zaključak

NOIR baza podataka (v6 + patch) je **production-grade fundacija** za MVP. Sa 37 tablica, 30+ triggera i 60+ RLS politika, pokriva:

- **Potpuni ticket lifecycle**: od otkrivanja eventa, kroz lock/checkout/pay/scan/redeem, do refunda i cancellation
- **Trostrani model**: korisnici kupuju, organizatori prodaju, vlasnici prostora iznajmljuju — s potpunom izolacijom podataka
- **Venue Builder**: verzioniran tlocrt s JSON ↔ DB sinkronizacijom
- **Fleksibilno pricing**: tierovi (early bird, regular, VIP), paketi (tier + extras + stol), bundleovi (multi-day)
- **Operativne alate**: door sale, QR scan, drink redeem — sve s audit trailom
- **Race condition safety**: advisory locks, FOR UPDATE, atomic functions, CHECK constraints
- **Automatizaciju**: capacity enforcement, sold count sync, order total sync, payment order generiranje, venue availability management

Sve arhitekturne odluke su dokumentirane i referencirane. Edge caseovi su pokriveni. Baza je spremna — fokus je na FastAPI + Flutter + Next.js implementaciju.

---

*Dokument generiran iz analize `6ver.sql` (2708 linija), `6ver_patch1.sql` (746 linija) i `noir_db_review_v6.md` (698 linija).*
*Projekt: TVZ MC2 2026, Zagreb, Hrvatska.*