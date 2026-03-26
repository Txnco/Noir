# NOIR — Database Architecture Review v5.0

> **Interni dokument tima** | Verzija 5.0 | Ožujak 2026.
> TVZ MC2 | Zagreb, Hrvatska
> Nadogradnja na v4.0 — transakcijski sustav, package restrukturiranje, dodatni popravci

---

## Sadržaj

1. Pregled svih v5 promjena
2. Transakcijski sustav (orders / order_items / transactions)
3. Package restrukturiranje (tier + extras model)
4. Bundle-package podrška
5. Korisnički flowovi (detaljan walk-through)
6. Dodatni popravci (11 identificiranih problema)
7. Potvrđene odluke (ne-problemi)
8. Ažurirani popis tablica (35 + 3 viewa)
9. Ažurirani popis triggera i funkcija
10. App-level zadaci za FastAPI

---

## 1. Pregled svih v5 promjena

| # | Promjena | Grupa | Tip |
|---|----------|-------|-----|
| 1 | `orders` tablica | A | Nova tablica |
| 2 | `order_items` tablica | A | Nova tablica |
| 3 | `transactions_v2` tablica | A | Nova tablica |
| 4 | 5 novih ENUM tipova (order_status, order_item_type/status, transaction_type, transaction_status_v2) | A | Novi tipovi |
| 5 | `generate_order_number()` | A | Nova funkcija |
| 6 | `validate_order_item_reference()` | A | Nova funkcija |
| 7 | `sync_order_totals()` | A | Nova funkcija |
| 8 | `sync_order_refund_status()` | A | Nova funkcija |
| 9 | `expire_pending_orders()` | A | Nova funkcija |
| 10 | `occurrence_packages`: +tier_id, +entries_included, +table_section_id | B | Modifikacija |
| 11 | `validate_package_tier_consistency()` | B | Nova funkcija |
| 12 | `validate_package_section_venue()` | B | Nova funkcija |
| 13 | `bundle_type_occurrences`: +tier_id, +package_id | C | Modifikacija |
| 14 | `validate_bto_tier_occurrence()` | C | Nova funkcija |
| 15 | `event_occurrences`: +CHECK sold_count | D | Novi constraint |
| 16 | `set_updated_at()` generički trigger na 20+ tablica | D | Nova funkcija |
| 17 | `idx_one_default_gateway_per_org` partial unique | D | Novi constraint |
| 18 | `redeem_drink()` + CHECK remaining_drinks >= 0 | D | Nova funkcija + constraint |
| 19 | `updated_at` na venue_rental_terms, tags, bundle_types, organization_members | D | Nove kolone |
| 20 | Ažuriran `handle_occurrence_cancellation()` za orders model | E | Mod. triggera |
| 21 | 3 ažurirana viewa + 1 novi view (org_revenue_view) | E | Viewovi |
| 22 | 12+ novih indeksa | E | Performance |
| 23 | RLS politike za orders/order_items/transactions_v2 | E | Security |

---

## 2. Transakcijski sustav

### 2.1 Problem — zašto refaktor?

Stara `transactions` tablica imala je 5 strukturalnih problema:

**P1 — Nema grupiranja po narudžbi.** Korisnik kupi 3 karte u jednom checkoutu. Jedan Stripe PaymentIntent pokriva sve 3, ali svaka transakcija može referencirati samo jednu kartu. Rezultat: ili duplicirani iznosi ili izgubljena veza.

**P2 — Refund nema lanac.** Trigger T7 kreira refund transakciju bez veze na originalni charge. Stripe zahtijeva `payment_intent_id` za refund API, ali u bazi ta veza ne postoji.

**P3 — Standalone table_reservation ne može imati transakciju.** CHECK constraint zahtijeva `ticket_id OR bundle_id`. Plaćanje za stol bez karte se ne može evidentirati.

**P4 — 5 joinova za organizacijsku analitiku.** "Sve transakcije moje organizacije" zahtijeva: transactions → tickets → event_tiers → event_occurrences → events → organizations.

**P5 — Status miješa koncept i stanje.** `transaction_status = 'refunded'` je i status originalnog chargea i tip novog retka. Zbunjujuće za svaki query.

### 2.2 Novi model — 3 tablice

```
orders (checkout sesija)
├── order_items[] (što je kupljeno — polimorfna referenca)
└── transactions_v2[] (financijski pokreti — charge, refund, void)
```

**`orders`** — grupira jedan checkout. Ima `org_id` (direktan pristup!), `gateway_session_id` (Stripe/Monri/WSPay), `order_number` (human-readable za support). Status prati lifecycle od draft do completed/refunded.

**`order_items`** — stavke narudžbe. `item_type` ENUM + `item_id` UUID je polimorfna referenca. Trigger `validate_order_item_reference()` provjerava postojanje u odgovarajućoj tablici. `description` je denormalizirano — kad se event preimenuje, račun ostaje isti.

**`transactions_v2`** — čisti financijski zapis. Ne zna ništa o kartama/bundleovima/stolovima. Zna samo za narudžbe i novac. `transaction_type` razlučuje smjer (charge/refund/void/dispute). `parent_transaction_id` stvara eksplicitan refund lanac. CHECK constraint osigurava da refund MORA imati parent.

### 2.3 Ključna ograničenja

**Jedna narudžba = jedna organizacija.** Svaka org ima svoj payment gateway. Mix kupnja od 2 organizacije = 2 zasebna ordera = 2 PaymentIntenta. Ovo je identičan pattern koji koriste Amazon, Shopify, Eventbrite.

**Order number format:** `NOIR-YYYYMMDD-XXXX` (4 alfanumerička znaka). 36^4 = 1.6M kombinacija po danu — dovoljno za MVP. Trigger ga automatski generira ako app ne pošalje custom.

**Polimorfna referenca:** `order_items.item_id` nema klasičan FK jer pokazuje na različite tablice. Kompenzacija: trigger na BEFORE INSERT validira da referencirani zapis postoji.

### 2.4 Automatski triggeri

- **`sync_order_totals()`** — kad se doda/mijena order_item, automatski rekalkulira subtotal i total_amount na orderu
- **`sync_order_refund_status()`** — kad se kreira completed refund transakcija, automatski prebacuje order u partially_refunded ili refunded
- **`expire_pending_orders()`** — cron (svake 2 min) čisti expired draft/pending_payment ordere i oslobađa sve vezane resurse (tickets, bundles, reservations)

---

## 3. Package restrukturiranje

### 3.1 Stari model — problemi

`occurrence_packages` je imao:
- `includes_entry BOOLEAN` — da/ne, ali ne govori KOJI tier
- `includes_drinks INT` — broj pića
- `includes_table BOOLEAN` — da/ne, ali ne govori IZ KOJE sekcije
- Nema `tier_id` — ticket zahtijeva `tier_id NOT NULL`, app mora pogađati

### 3.2 Novi model — Package = Tier + Extras

Organizator slaže paket kao "recept":

```
VIP Paket Petak — 80€
  tier_id         = VIP tier UUID
  entries_included = 1
  drinks_included  = 3  (kokteli)
  table_section_id = VIP Lounge UUID
  items            = {"merch": "NOIR majica"}
```

```
Party Paket — 45€
  tier_id         = Regular tier UUID
  entries_included = 2
  drinks_included  = 5  (piva)
  table_section_id = NULL  (bez stola)
  items            = NULL
```

```
Drink paket za stol — 120€
  tier_id         = NULL
  entries_included = 0    (bez ulaznica)
  drinks_included  = 0    (ali items ima boca votke + miksevi)
  table_section_id = Table Area UUID
  items            = {"bottles": [{"name": "Absolut", "qty": 1}], "mixers": [...]}
```

### 3.3 Nove kolone

| Kolona | Tip | Opis |
|--------|-----|------|
| `tier_id` | UUID FK → event_tiers | Koji tier ulaznica (NULL = bez ulaza) |
| `entries_included` | INT NOT NULL DEFAULT 1 | Koliko ulaznica (0 = samo extras) |
| `table_section_id` | UUID FK → venue_sections | Iz koje sekcije su stolovi (NULL = nije table paket) |

### 3.4 Constrainti

- `chk_pkg_entries_non_negative` — entries_included >= 0
- `chk_pkg_tier_required_for_entries` — ako entries > 0, tier_id MORA biti postavljen
- Trigger `validate_package_tier_consistency()` — tier mora pripadati istoj izvedbi kao paket
- Trigger `validate_package_section_venue()` — sekcija mora pripadati istom venueu

### 3.5 Display logika (app-level)

- **Prikaži paket** ako `table_section_id IS NULL` → paketi bez stola, za sve korisnike
- **Prikaži paket** ako `table_section_id IS NOT NULL` I korisnik ima aktivnu rezervaciju u toj sekciji
- **Sakrij paket** ako `table_section_id IS NOT NULL` I nema dostupnih stolova I korisnik nema rezervaciju
- **Paket "rasprodano"** ako `sold_count >= max_quantity`

---

## 4. Bundle-package podrška

### 4.1 Promjena

`bundle_type_occurrences` dobiva 2 nove kolone:

| Kolona | Tip | Opis |
|--------|-----|------|
| `tier_id` | UUID FK → event_tiers | Koji tier za ovu izvedbu (obavezno) |
| `package_id` | UUID FK → occurrence_packages | Koji paket za ovu izvedbu (opcijski) |

### 4.2 Primjer

"Weekend Pass VIP" bundle za 3-dnevni festival:

```
bundle_type_occurrences:
  Petak:   tier_id = VIP Petak,   package_id = VIP Paket Petak (piće + stol)
  Subota:  tier_id = VIP Subota,  package_id = VIP Paket Subota (piće + stol)
  Nedjelja: tier_id = Regular Ned, package_id = NULL (samo karta)
```

### 4.3 Kreiranje bundle ticketa (app-level flow)

Kad se kupi bundle:
1. Za svaki `bundle_type_occurrences` zapis:
   - Kreiraj ticket s `tier_id` iz BTO (ili iz package.tier_id ako BTO.package_id je postavljen)
   - Postavi `package_id` na ticket ako BTO.package_id postoji
   - Tier sold_count se automatski ažurira kroz trigger T1
   - Package sold_count se automatski ažurira kroz trigger T1

---

## 5. Korisnički flowovi

### 5.1 Flow A — "Kupi ulaznice" (instant checkout)

```
1. Korisnik otvara event stranicu
2. Odabire tier (Early Bird / Regular / VIP) i broj ulaznica
3. [Opcija: numerirana mjesta → seat map → lock_seat_for_checkout()]

4. Sustav pita: "Želiš li rezervirati stol?"
   ├── NE → Prikazuju se paketi BEZ stola za taj tier
   │         Korisnik bira paket ili kupuje samo karte
   │         → Korak 5
   └── DA → Seat map stolova → odabir stola → 48h hold
            → Prikazuju se paketi ZA STOL iz te sekcije
            Korisnik bira obavezni drink paket
            + opcijski extra karte
            → Korak 5

5. APP kreira:
   - orders (draft) s org_id, user_id
   - tickets (pending_payment) za svaku kartu
   - order_items za svaki ticket + opcijski table_reservation + bundle
   - Ako stol: table_reservations (pending) s source='ticket_purchase'

6. APP kreira gateway sesiju (Stripe/Monri/WSPay)
   - orders.gateway_session_id = session_id
   - orders.status = 'pending_payment'

7. Webhook potvrda:
   - transactions_v2 INSERT (type='charge', status='completed')
   - tickets.status → 'active'
   - orders.status → 'completed'
   - table_reservations.status → 'confirmed' (ako ima stol)
   - Trigger T1 ažurira sold_count na tier/package/occurrence
```

### 5.2 Flow B — "Rezerviraj stol" (two-step, 48h hold)

```
KORAK 1: REZERVACIJA (besplatno, samo hold)
─────────────────────────────────────────────
1. Korisnik (MORA biti prijavljen) otvara event
2. Klikne "Rezerviraj stol"
3. Seat map stolova → odabire stol
4. APP kreira:
   - table_reservations (pending, source='standalone', expires_at=NOW()+48h)
   - orders (draft, expires_at=NOW()+48h)
   - order_items (item_type='table_reservation', status='pending')
5. Korisnik dobije potvrdu: "Stol X rezerviran do DD.MM. HH:MM"

KORAK 2: PLAĆANJE (unutar 48h)
─────────────────────────────────────────────
1. Korisnik se vraća u "Moje rezervacije"
2. Otvara rezervaciju stola
3. Vidi:
   - Rezervirani stol (A-1, VIP Lounge)
   - Ponudu paketa za tu sekciju (obavezni drink paket)
   - Opciju za extra ulaznice (bira tier + broj)
4. Bira paket + ulaznice
5. APP ažurira postojeći draft order:
   - Dodaje order_items za paket tickets
   - Dodaje order_items za extra tickets (ako ih ima)
   - sync_order_totals() automatski rekalkulira
6. Gateway sesija → plaćanje → webhook
7. Sve se aktivira: tickets, bundle (ako ima), reservation → confirmed

AKO ISTEKNE 48h:
─────────────────────────────────────────────
- expire_pending_orders() cron hvata expired draft
- orders.status → 'expired'
- table_reservations.status → 'expired'
- Stol se oslobađa (occurrence_item_status → 'available')
- Korisnik dobije notifikaciju (app-level)
```

### 5.3 Flow C — "Kupi bundle" (Weekend Pass)

```
1. Korisnik na event stranici vidi "Weekend Pass" opcije
2. Odabire bundle tip (npr. "Weekend Pass VIP — 150€")
3. Bundle pokriva Petak + Subota + Nedjelja
4. [Opcija: ako bundle uključuje stol → seat map za svaku izvedbu]
5. APP kreira:
   - ticket_bundles (pending_payment)
   - tickets × N (jedan po occurrence, s tier_id i package_id iz BTO)
   - orders (draft)
   - order_items: 1 stavka (item_type='bundle', item_id=ticket_bundle_uuid)
6. Gateway → charge → webhook → aktivacija
7. Trigger T1 ažurira sold_count na SVAKOM tieru za svaku izvedbu
8. Trigger T2 ažurira sold_count na bundle_type
```

### 5.4 Flow D — Mix checkout

```
Korisnik u jednom checkoutu kupuje:
- 2× standalone karte (Regular, petak) → 2 ticketa
- 1× bundle (Weekend Pass) → 1 ticket_bundle + 3 ticketa
- 1× rezervacija stola (VIP, petak) → 1 table_reservation

APP kreira JEDAN order s 4 order_items:
  [0] item_type='ticket',            item_id=ticket_1,     subtotal=15.00
  [1] item_type='ticket',            item_id=ticket_2,     subtotal=15.00
  [2] item_type='bundle',            item_id=bundle_1,     subtotal=150.00
  [3] item_type='table_reservation', item_id=reserv_1,     subtotal=0.00*

*Stol rezervacija ima subtotal=0 jer se plaća kroz drink paket.
Ili: ako standalone stol ima cijenu, onda subtotal > 0.

Total: 180.00€ → jedan PaymentIntent → jedna charge transakcija.
```

---

## 6. Dodatni popravci

### 6.1 event_occurrences.sold_count CHECK (SREDNJE)

**Problem:** Nema zaštite od oversella na occurrence razini.

**Fix:** `CHECK (total_capacity IS NULL OR sold_count <= total_capacity)` + `CHECK (sold_count >= 0)`

### 6.2 Generički updated_at trigger (SREDNJE)

**Problem:** 20+ tablica ima updated_at kolonu ali nijedna ne ažurira automatski pri UPDATE.

**Fix:** Jedna `set_updated_at()` funkcija primijenjena kao BEFORE UPDATE trigger na sve relevantne tablice. Ovo eliminira potrebu da svaki trigger i svaki app query ručno postavlja `updated_at = NOW()`.

**Popis tablica:** profiles, user_preferences, organizations, payment_gateways, venues, events, venue_inquiries, event_occurrences, event_tiers, occurrence_packages, ticket_bundles, tickets, occurrence_item_status, table_reservations, payment_orders, orders, order_items, transactions_v2, venue_rental_terms, tags, bundle_types, organization_members

### 6.3 Jedan default gateway po organizaciji (SREDNJE)

**Problem:** `is_default = TRUE` na 3 od 5 gatewaya iste organizacije.

**Fix:** Partial unique index: `UNIQUE(org_id) WHERE is_default = TRUE AND is_active = TRUE`

### 6.4 remaining_drinks zaštita (POBOLJŠANJE)

**Problem:** Nema CHECK >= 0 niti atomične funkcije za dekrement. Bug u appu = beskonačna pića.

**Fix:** CHECK constraint + `redeem_drink()` funkcija s atomičnim UPDATE ... WHERE remaining_drinks > 0 AND status = 'scanned'.

### 6.5 Nedostajuće updated_at kolone (POBOLJŠANJE)

**Problem:** venue_rental_terms, tags, bundle_types, organization_members nemaju updated_at.

**Fix:** ALTER TABLE ADD COLUMN za svaku.

---

## 7. Potvrđene odluke (NE-problemi)

### 7.1 Bundle/Package "double-counting" na tier sold_count

**Inicijalna sumnja:** Isti ticket se broji i na tier razini i na bundle/package razini.

**Odluka: Ovo je ISPRAVNO i NAMJERNO.**
- **Tier sold_count** = mjera KAPACITETA. "Koliko mjesta je zauzeto u ovom cjenovnom razredu?"
- **Package/Bundle sold_count** = mjera PRODAJE. "Koliko ovog proizvoda smo prodali?"
- To su RAZLIČITE metrike. Tier je "koliko ljudi ulazi", bundle je "koliko bundleova je kupljeno".
- Organizator MORA planirati tier kapacitet uzimajući u obzir bundle/package prodaju.
- Primjer: Tier "VIP" ima 100 mjesta. "VIP Paket" sadrži VIP tier. Ako prodamo 60 standalone VIP karata i 40 VIP Paketa, tier je na 100/100 — ispravno.

### 7.2 venue_inquiry_dates.end_time NOT NULL vs occurrence.end_time NULL

**Inicijalna sumnja:** Nekonzistentnost — upit zahtijeva end_time, izvedba ne.

**Odluka: Ovo je ISPRAVNO.**
- Inquiry end_time je NOT NULL jer vlasnik prostora MORA znati kad se event završava za booking
- Occurrence end_time je nullable jer postoje open-end eventi (afterparty)
- `build_occurrence_tstzrange()` ima fallback (+6h) za NULL end_time — to je feature, ne bug

---

## 8. Ažurirani popis tablica (35 + 3 viewa)

| # | Tablica | Status v5 |
|---|---------|-----------|
| 1 | user_platform_roles | Neprom. |
| 2 | profiles | Neprom. (claimed_at iz v3) |
| 3 | user_preferences | Neprom. |
| 4 | organizations | Neprom. (default_currency iz v4) |
| 5 | organization_members | **+updated_at** |
| 6 | payment_gateways | **+partial unique idx** |
| 7 | tags | **+created_at, +updated_at** |
| 8 | venues | Neprom. (timezone iz v4) |
| 9 | venue_tags | Neprom. |
| 10 | venue_sections | Neprom. |
| 11 | venue_items | Neprom. |
| 12 | venue_rental_terms | **+updated_at** |
| 13 | events | Neprom. |
| 14 | event_tags | Neprom. |
| 15 | venue_inquiries | Neprom. |
| 16 | venue_inquiry_dates | Neprom. |
| 17 | venue_inquiry_responses | Neprom. |
| 18 | event_occurrences | **+CHECK constraints** |
| 19 | venue_availability | Neprom. |
| 20 | event_tiers | Neprom. (updated_at iz v4) |
| 21 | tier_sections | Neprom. |
| 22 | occurrence_packages | **CHANGED: +tier_id, +entries_included, +table_section_id** |
| 23 | bundle_types | **+updated_at** |
| 24 | bundle_type_occurrences | **CHANGED: +tier_id, +package_id** |
| 25 | ticket_bundles | Neprom. |
| 26 | tickets | **+CHECK remaining_drinks** |
| 27 | occurrence_item_status | Neprom. |
| 28 | table_reservations | Neprom. |
| 29 | transactions (legacy) | **ZAMIJENJENO → transactions_v2** |
| 30 | payment_orders | Neprom. |
| 31 | audit_log | Neprom. |
| 32 | supported_currencies | Neprom. |
| 33 | **orders** | **NOVO** |
| 34 | **order_items** | **NOVO** |
| 35 | **transactions_v2** | **NOVO** |

**Viewovi:**
- user_tickets_view — **AŽURIRAN** (+ order_number, + package info)
- user_transactions_view — **AŽURIRAN** (order-centric)
- **org_revenue_view** — **NOVO** (analitika za organizatore)

---

## 9. Ažurirani popis triggera i funkcija

### Triggeri (18 ukupno)

| # | Trigger | Tablica | Status |
|---|---------|---------|--------|
| T1 | trg_ticket_sold_counts | tickets | Neprom. |
| T2 | trg_bundle_sold_counts | ticket_bundles | Neprom. |
| T3 | trg_cancel_reservation_on_ticket_cancel | tickets | Neprom. |
| T4 | trg_reject_overlapping_on_confirm | venue_availability | v3 (FOR UPDATE) |
| T5 | trg_enforce_tier_capacity | event_tiers | v4 (is_active fix) |
| T6 | trg_enforce_occurrence_venue_capacity | event_occurrences | Neprom. |
| T7 | trg_handle_occurrence_cancellation | event_occurrences | **CHANGED v5** (orders model) |
| T8 | trg_auto_generate_payment_order | event_occurrences | v4 |
| T9 | trg_enforce_tier_sale_window | tickets | v4 |
| T10 | trg_enforce_tier_currency | event_tiers | v4 |
| T11 | trg_enforce_package_currency | occurrence_packages | v4 |
| T12 | trg_enforce_bundle_currency | bundle_types | v4 |
| T13 | trg_sync_va_time_range | venue_availability | v4 |
| T14 | trg_generate_order_number | orders | **NEW v5** |
| T15 | trg_validate_order_item_ref | order_items | **NEW v5** |
| T16 | trg_sync_order_totals | order_items | **NEW v5** |
| T17 | trg_sync_order_refund_status | transactions_v2 | **NEW v5** |
| T18 | trg_set_updated_at (×20+) | sve tablice s updated_at | **NEW v5** |
| T19 | trg_validate_package_tier | occurrence_packages | **NEW v5** |
| T20 | trg_validate_package_section | occurrence_packages | **NEW v5** |
| T21 | trg_validate_bto_references | bundle_type_occurrences | **NEW v5** |

### Funkcije (18 ukupno)

| # | Funkcija | Status |
|---|----------|--------|
| F1 | swap_table_reservation() | Neprom. |
| F2 | expire_standalone_reservations() | Neprom. |
| F3 | lock_seat_for_checkout() | v4 (locked_by) |
| F4 | expire_seat_locks() | v4 |
| F5 | release_user_seat_locks() | v4 |
| F6 | release_single_seat_lock() | v4 |
| F7 | build_occurrence_tstzrange() | v4 |
| F8 | check_venue_date_available() | v4 |
| F9 | resolve_or_create_profile() | v4 |
| F10 | auto_generate_payment_order() | v4 |
| F11 | enforce_currency_consistency() | v4 |
| F12 | enforce_bundle_currency_consistency() | v4 |
| F13 | generate_order_number() | **NEW v5** |
| F14 | validate_order_item_reference() | **NEW v5** |
| F15 | sync_order_totals() | **NEW v5** |
| F16 | sync_order_refund_status() | **NEW v5** |
| F17 | expire_pending_orders() | **NEW v5** |
| F18 | redeem_drink() | **NEW v5** |
| F19 | set_updated_at() | **NEW v5** |
| F20 | validate_package_tier_consistency() | **NEW v5** |
| F21 | validate_package_section_venue() | **NEW v5** |
| F22 | validate_bto_tier_occurrence() | **NEW v5** |

---

## 10. App-level zadaci za FastAPI

### 10.1 Novi endpointi

```
POST   /checkout/create          → kreira order (draft) + stavke
POST   /checkout/pay             → kreira gateway sesiju, order → pending_payment
POST   /checkout/webhook         → gateway callback → charge transakcija → aktivacija
POST   /checkout/cancel          → poništi draft order, oslobodi resurse

POST   /tables/{id}/reserve      → 48h hold + draft order (zahtijeva login)
GET    /reservations/mine        → korisničke aktivne rezervacije
POST   /reservations/{id}/pay    → dodaj pakete/karte u draft order → plaćanje

POST   /refunds/create           → admin kreira refund transakciju
GET    /orders                   → korisničke narudžbe (filtrira po user_id)
GET    /orders/{id}              → detalj narudžbe + order_items + transactions

GET    /org/{id}/revenue         → org_revenue_view za dashboard
GET    /org/{id}/orders          → sve narudžbe organizacije

POST   /tickets/{id}/redeem-drink → poziva redeem_drink() funkciju
```

### 10.2 Webhook handling (gateway-agnostic)

```python
# Pseudo-kod za gateway webhook handler
async def handle_payment_webhook(gateway_type, payload):
    # 1. Validiraj webhook potpis (gateway-specifično)
    # 2. Dohvati order po gateway_session_id
    order = await db.get_order_by_session(payload.session_id)

    if payload.status == 'completed':
        # 3. Kreiraj charge transakciju
        await db.insert_transaction(
            order_id=order.id,
            type='charge',
            amount=payload.amount,
            gateway_payment_id=payload.payment_id,
            status='completed'
        )
        # 4. Aktiviraj sve stavke
        await activate_order_items(order.id)
        # 5. Ažuriraj order status
        await db.update_order(order.id, status='completed', completed_at=now())

    elif payload.status == 'failed':
        await db.insert_transaction(
            order_id=order.id, type='charge',
            amount=payload.amount, status='failed'
        )
        await db.update_order(order.id, status='failed')
```

### 10.3 Table reservation business rules (app-level, ne DB)

- **Obavezni drink paket:** Kad korisnik plaća stol, app MORA zahtijevati barem 1 paket s `table_section_id` koji odgovara sekciji stola. Ovo je app validacija, ne DB constraint.
- **48h expiry notifikacija:** Cron čisti expired ordere, ali app treba poslati reminder email/push 6h i 1h prije isteka.
- **Stol mora biti logiran:** `table_reservations` s `source='standalone'` MORA imati `user_id NOT NULL`. Ghost checkout nije moguć za stolove.

### 10.4 Package creation UI (organizator)

Organizator slaže paket:
1. Odabere izvedbu (occurrence)
2. Odabere tier iz ponuđenih za tu izvedbu → `tier_id`
3. Postavi `entries_included` (koliko ulaznica)
4. Opcijski: odabere sekciju za stol → `table_section_id`
5. Opcijski: piće, merch, extras → `items` JSONB
6. Postavi cijenu, naziv, opis
7. DB triggeri automatski validiraju konzistenciju

---

## 11. Poznati edge caseovi — ažurirani za v5

| Edge case | Odluka | Referenca |
|-----------|--------|-----------|
| Mix checkout od 2 organizacije | App MORA splitati u 2 ordera (svaka org = svoj gateway) | v5 §2.3 |
| Refund za expired order | Nemoguć — nema charge transakciju. Order ostaje expired. | v5 §2.4 |
| Duplicate order_number | Trigger retry loop s fallbackom na 8-char random | v5 §A5 |
| Package tier iz krive izvedbe | Trigger blokira INSERT | v5 §B2 |
| Package section iz krivog venuea | Trigger blokira INSERT | v5 §B3 |
| Bundle occurrence bez tiera | App MORA slati tier_id | v5 §C1 |
| Stol hold istekao ali korisnik plaća | expire_pending_orders() već cancelirao order → app vraća grešku | v5 §5.2 |
| Tier double-count iz paketa | NAMJERNO — tier mjeri kapacitet, paket mjeri prodaju | v5 §7.1 |
| Stol bez logina | App blokira — ghost checkout ne podržan za stolove | v5 §10.3 |
| remaining_drinks ispod nule | CHECK constraint + atomična redeem_drink() funkcija | v5 §6.4 |

---

*Ovaj dokument je generiran iz review sesije v4→v5. Ažurirati pri svakom značajnijem review ciklusu.*