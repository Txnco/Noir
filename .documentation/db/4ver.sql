**NOIR**

Database Architecture Review

v3.0 → v4.0 Delta Analysis

Interni dokument tima | Verzija 4.0 | Ožujak 2026.

TVZ MC2 | Zagreb, Hrvatska

Temeljeno na code review sesiji - 7 ključnih pitanja

# **Sadržaj**

Ovaj dokument pokriva 7 ključnih arhitekturnih pitanja identificiranih tijekom code reviewa v3 baze. Svako poglavlje sadrži: analizu problema, utjecaj na produkciju, donesenu odluku i SQL implementaciju.

**Poglavlje 1: Multi-lock seat mehanizam** - Jedan korisnik, više sjedala istovremeno

**Poglavlje 2: Bundle full refund detekcija** - Automatsko prepoznavanje potpunog povrata

**Poglavlje 3: Automatsko generiranje payment ordera** - Trigger na occurrence completion

**Poglavlje 4: Timezone handling** - DATE + TIME → TSTZRANGE kanonska konverzija

**Poglavlje 5: Sale window enforcement** - DB constraint za tier prodajni prozor

**Poglavlje 6: Ghost account i korisnički prikazi** - Account resolution + viewovi za ulaznice i transakcije

**Poglavlje 7: Multi-currency podrška** - Fleksibilna valutna arhitektura

**Konsolidirani pregled promjena** - Potpuni popis svih v4 delta promjena

# **1\. Multi-lock seat mehanizam**

**KRITIČNO**

## **1.1 Problem**

Funkcija lock_seat_for_checkout() u v3 prima p_user_id parametar ali ga nikad ne sprema u bazu. Kolona locked_by ne postoji na occurrence_item_status tablici. Posljedice:

- Nemoguće identificirati tko drži lock na sjedalu
- Nemoguće osloboditi samo lockove jednog korisnika kad napusti checkout
- Nemoguće nametnuti limit na broj istovremenih lockova
- Debug u produkciji praktički nemoguć („zašto je sjedalo A-5 zaključano?")

## **1.2 Donesena odluka**

**Application-level limit** s DB podrškom (locked_by kolona + configurable max_locks parametar). NE DB constraint (UNIQUE/CHECK), jer:

- Različiti eventi imaju različite logike - rock koncert: max 6, VIP loža: max 20
- DB constraint zahtijeva migraciju kad se limit promijeni
- Limit se prosljeđuje kao parametar iz event_occurrences.max_seats_per_checkout

## **1.3 Implementacija**

**Nove kolone**

ALTER TABLE occurrence_item_status

ADD COLUMN locked_by UUID REFERENCES auth.users(id);

ALTER TABLE event_occurrences

ADD COLUMN max_seats_per_checkout INT DEFAULT 10;

ALTER TABLE event_occurrences

ADD CONSTRAINT chk_max_seats_positive

CHECK (max_seats_per_checkout IS NULL OR max_seats_per_checkout > 0);

**Funkcija: lock_seat_for_checkout() - nova verzija**

Ključne promjene vs v3: sprema locked_by, enforca max_locks, podržava lock refresh za istog korisnika, vraća JSONB s razlogom (success/failure + message).

**Race condition napomena**

**VAŽNO:** Count provjera broja lockova mora doći NAKON FOR UPDATE na konkretnom sjedalu, ne prije. Inače dva paralelna requesta istog korisnika mogu oba proći count provjeru.

\-- NAKON FOR UPDATE na retku sjedala:

IF p_max_locks > 0 THEN

SELECT COUNT(\*) INTO v_current_lock_count

FROM occurrence_item_status

WHERE occurrence_id = p_occurrence_id

AND locked_by = p_user_id AND status = 'locked'

AND reserved_until > NOW() AND item_id != p_item_id;

IF v_current_lock_count >= p_max_locks THEN

RETURN jsonb_build_object('success', FALSE, 'reason', 'max_locks_reached');

END IF;

END IF;

**Pomoćne funkcije**

- release_user_seat_locks(p_occurrence_id, p_user_id) - oslobađa SVE lockove korisnika (checkout cancel, session timeout)
- release_single_seat_lock(p_occurrence_id, p_item_id, p_user_id) - oslobađa JEDNO sjedalo (korisnik deselektira jedno od 4 odabrana)
- expire_seat_locks() - ažuriran da čisti i locked_by kolonu

**Checkout flow**

Korisnik odabire 4 sjedala:

POST /seats/lock {seat: A-1} -> lock(max=10) -> 1/10

POST /seats/lock {seat: A-2} -> lock(max=10) -> 2/10

POST /seats/lock {seat: A-3} -> lock(max=10) -> 3/10

POST /seats/lock {seat: A-4} -> lock(max=10) -> 4/10

Frontend: '4 sjedala odabrana | 14:32 preostalo'

Odustaje od jednog: POST /seats/release {seat: A-3}

Placa: purchase endpoint -> 3 ticketa -> status='sold', locked_by=NULL

# **2\. Bundle full refund detekcija**

**KRITIČNO**

## **2.1 Problem**

Trigger handle_occurrence_cancellation() u v3 uvijek postavlja bundle status na 'partially_refunded', čak i kad su SVE izvedbe u bundleu otkazane. Korisnik vidi krivi status i može dobiti manji povrat nego što mu pripada.

## **2.2 Donesena odluka**

**Trigger rješava ovo, ne app.** U istoj DB transakciji trigger već drži sve zaključane retke. Provjera je jedna linija: COUNT(aktivnih izvedbi) == 0.

**Potvrđeno:** Kad je status 'refunded', refunded_amount MORA biti jednak total_price (eksplicitno, ne kumulativno).

## **2.3 Logika odluke**

| **Aktivnih izvedbi** | **Skeniranih ulaznica** | **Finalni status**     | **refunded_amount**                  |
| -------------------- | ----------------------- | ---------------------- | ------------------------------------ |
| \> 0                 | bilo što                | partially_refunded     | kumulativni zbir po izvedbama        |
| 0                    | 0                       | refunded (puni povrat) | \= total_price                       |
| 0                    | \> 0                    | partially_refunded     | kumulativni zbir (nešto iskorišteno) |

## **2.4 Implementacija**

Unutar handle_occurrence_cancellation() FOR LOOP-a, NAKON updatea na partially_refunded, dodaje se:

\-- Provjeri jesu li SVE izvedbe sada cancelled/completed

SELECT COUNT(\*) INTO v_active_occurrence_count

FROM bundle_type_occurrences bto

JOIN event_occurrences eo ON eo.id = bto.occurrence_id

WHERE bto.bundle_type_id = v_bundle.bundle_type_id

AND eo.status NOT IN ('cancelled', 'completed');

IF v_active_occurrence_count = 0 THEN

SELECT COUNT(\*) INTO v_used_ticket_count

FROM tickets

WHERE bundle_id = v_bundle.bundle_id AND status = 'scanned';

IF v_used_ticket_count = 0 THEN

\-- Nista nije iskoristeno -> PUNI REFUND

UPDATE ticket_bundles

SET status = 'refunded',

refunded_amount = total_price, -- EKSPLICITNO

updated_at = NOW()

WHERE id = v_bundle.bundle_id;

END IF;

\-- Ako je v_used_ticket_count > 0, ostaje 'partially_refunded'

END IF;

**Zaštitni constraint**

ALTER TABLE ticket_bundles

ADD CONSTRAINT chk_refund_not_exceeds_price

CHECK (refunded_amount <= total_price);

# **3\. Automatsko generiranje payment ordera**

**NOVO**

## **3.1 Kontekst**

payment_orders tablica postoji od v2, ali nije postojao mehanizam za automatsko kreiranje naloga. Plan je bio ručno kreiranje, što je nepraktično za veći broj evenata.

## **3.2 Donesena odluka**

**Trigger kreira DRAFT payment order** kad occurrence prijeđe u 'completed'. Organizator ili admin pregledava izračun i izdaje nalog (draft → issued). Ovo je sigurnije od potpuno automatskog izdavanja jer sprječava financijske greške.

## **3.3 Logika po pricing modelu**

| **Model**     | **Izračun**                                                | **Automatski?** |
| ------------- | ---------------------------------------------------------- | --------------- |
| fixed         | amount = rental_terms_snapshot.fixed_amount                | Da              |
| revenue_share | ticket_revenue \* share_pct / 100 (min guarantee provjera) | Da              |
| hybrid        | fixed_amount + (ticket_revenue \* share_pct / 100)         | Da              |
| free          | Nema payment ordera                                        | Preskoči        |
| negotiable    | amount = 0, organizator ručno unosi                        | Draft s 0       |

**Ključne sigurnosne provjere u triggeru**

- Ako from_org == to_org (vlastiti prostor) → preskoči, nema naloga
- Ako nema rental_terms_snapshot → preskoči (free venue, interni event)
- Due date automatski: occurrence_date + 14 dana
- calculation_details JSONB sadrži puni breakdown izračuna za transparentnost

**App-level zadatak**

Endpoint POST /payment-orders/{id}/issue koji mijenja status draft → issued, šalje notifikaciju organizatoru, postavlja issued_at i issued_by.

# **4\. Timezone handling**

**KRITIČNO**

## **4.1 Problemi (4 identificirana)**

- **Problem 1:** DATE + TIME daje TIMESTAMP WITHOUT TIME ZONE. AT TIME ZONE obavezan ali nigdje nije enforceano.
- **Problem 2:** DST ambiguity - zadnja nedjelja u listopadu, 02:00-03:00 postoji dvaput (CEST i CET).
- **Problem 3:** Eventi koji prelaze ponoć (start 22:00, end 04:00) - negativan interval ruši exclusion constraint.
- **Problem 4:** Nema kanonskog mjesta za DATE+TIME → TSTZRANGE konverziju. Svaki developer to radi na svom mjestu, potencijalno različito.

## **4.2 Donesena odluka**

Jedan kanonski izvor istine: sva konverzija ide kroz jednu jedinu funkciju build_occurrence_tstzrange(). Venue ima timezone kolonu. Trigger automatski sync-a time_range na venue_availability.

## **4.3 Implementacija**

**venues.timezone**

ALTER TABLE venues

ADD COLUMN timezone VARCHAR(50) NOT NULL DEFAULT 'Europe/Zagreb';

\-- Validacija IANA zone:

ALTER TABLE venues

ADD CONSTRAINT chk_valid_timezone

CHECK (NOW() AT TIME ZONE timezone IS NOT NULL);

**build_occurrence_tstzrange() - STABLE, ne IMMUTABLE**

**ISPRAVKA:** Originalni prijedlog označavao je funkciju kao IMMUTABLE. AT TIME ZONE ovisi o sistemskim IANA timezone podacima koji se mogu ažurirati, pa je ispravna oznaka STABLE.

Funkcija pokriva: normalni isti-dan range, midnight crossover (end < start → +1 dan), NULL end_time (fallback +6h), sigurnosnu provjeru (end mora biti nakon start).

**Trigger: trg_sync_va_time_range**

**ISPRAVKA:** Originalni trigger koristio je SELECT INTO za ROW + scalar istovremeno, što ne kompajlira u PL/pgSQL. Popravljena verzija dohvaća individualne kolone.

**DST dokumentacija - obavezna u README**

| **Scenarij**   | **Kad**                      | **Utjecaj**                | **Rješenje**                                |
| -------------- | ---------------------------- | -------------------------- | ------------------------------------------- |
| Spring forward | Zadnja ned. ožujka, 02→03    | 02:00-03:00 ne postoji     | Nizak utjecaj za nightlife. App warning.    |
| Fall back      | Zadnja ned. listopada, 03→02 | 02:00-03:00 postoji dvaput | AT TIME ZONE uzima prvi. Backlog: UTC unos. |
| Midnight cross | start=22:00, end=04:00       | Negativan interval         | Funkcija dodaje +1 dan na end.              |
| NULL end_time  | Open-end event               | Nema definiranog kraja     | Fallback: start + 6 sati.                   |

# **5\. Sale window enforcement**

**POBOLJŠANJE**

## **5.1 Problem**

event_tiers ima sale_start i sale_end kolone, ali ih ništa ne enforca. Korisnik može kupiti kartu izvan prodajnog prozora ako API ne provjeri (a API može imati bug).

## **5.2 Donesena odluka**

**BEFORE INSERT trigger na tickets** koji provjerava: tier mora biti aktivan, NOW() mora biti unutar \[sale_start, sale_end\] prozora (NULL = neograničen).

## **5.3 Implementacija**

Trigger trg_enforce_tier_sale_window na BEFORE INSERT ON tickets.

Provjerava tri uvjeta:

- is_active = TRUE
- sale_start IS NULL OR NOW() >= sale_start
- sale_end IS NULL OR NOW() <= sale_end

**Edge case: admin/guestlist bypass**

Trigger se pali na SVAKI ticket INSERT. Za admin comp karte ili guestlist, postoje dva pristupa:

- Opcija A: Admin endpointi koriste zasebni tier označen kao 'comp' bez sale windowa
- Opcija B: Admin tier ima sale_start = NULL i sale_end = NULL (uvijek otvoren)

Opcija B je čišća jer ne zahtijeva bypass logiku.

# **6\. Ghost account i korisnički prikazi**

**NOVO**

## **6.1 Account resolution logika**

Kad neprijavljeni korisnik kupuje kartu:

- Ako email postoji u auth.users I account je aktivan (claimed) → koristi taj account
- Ako email postoji i account je ghost (claimed_at IS NULL) → koristi isti ghost account
- Ako email ne postoji → kreiraj novi ghost account kroz Supabase Admin API

Svaka kupnja je zasebna transakcija vezana na isti user_id. Korisnik vidi sve svoje ulaznice i transakcije nakon claimanja accounta.

**DB funkcija: resolve_or_create_profile()**

Provjerava auth.users po emailu. Ako postoji, ažurira profil (UPSERT). Ako ne postoji, vraća NULL kao signal app layeru da kreira auth.users kroz Supabase Admin API.

## **6.2 View: user_tickets_view („Moje karte")**

Kombinirani prikaz standalone ticketa i bundle ticketa. Sadrži:

| **Podatak**                        | **Izvor**                     | **Svrha**                           |
| ---------------------------------- | ----------------------------- | ----------------------------------- |
| ticket_id, status, qr_token        | tickets                       | Osnovna identifikacija              |
| purchased_at, created_at           | tickets                       | Datum kupnje za kronološki prikaz   |
| event_name, cover_image_url        | events                        | Vizualni prikaz                     |
| occurrence_date, start_time, venue | event_occurrences + venues    | Kad i gdje                          |
| tier_name, tier_price, currency    | event_tiers                   | Cijena i razred                     |
| bundle_name, bundle_status         | ticket_bundles + bundle_types | Bundle info (NULL za standalone)    |
| item_identifier, section_name      | venue_items + venue_sections  | Sjedalo/stol (NULL za standing)     |
| purchase_type                      | CASE izraz                    | 'bundle' / 'package' / 'standalone' |

## **6.3 View: user_transactions_view („Moj račun")**

Svaka kupnja prikazana kao zasebna transakcija s punim kontekstom: što je kupljeno, za koji event, koliko košta, koji payment gateway, te refund info za bundleove.

**Indeksi za performans**

CREATE INDEX idx_tickets_user_purchased

ON tickets(user_id, purchased_at DESC)

WHERE status NOT IN ('cancelled', 'expired');

CREATE INDEX idx_transactions_user_date

ON transactions(user_id, created_at DESC);

# **7\. Multi-currency podrška**

**NOVO**

## **7.1 Problem**

currency VARCHAR(3) DEFAULT 'EUR' postoji na 6+ tablica bez ikakve konzistencije. Ništa ne sprječava da tier bude u USD, a bundle za isti event u EUR. Nema validacije da je valuta uopće legitimna (netko može unijeti 'XYZ').

## **7.2 Donesena odluka**

**Valuta se definira na razini organizacije** (account currency). Sve cijene unutar te organizacije moraju koristiti istu valutu. Ovo je realno za MVP i skalabilno za ekspanziju.

## **7.3 Implementacija**

**Referentna tablica supported_currencies**

Tablica umjesto ENUM-a jer se valute dodaju bez migracije (npr. za ekspanziju na novo tržište).

CREATE TABLE supported_currencies (

code VARCHAR(3) PRIMARY KEY, -- ISO 4217

name VARCHAR(100) NOT NULL,

symbol VARCHAR(10) NOT NULL,

is_active BOOLEAN DEFAULT TRUE

);

\-- Inicijalni podaci:

EUR, HRK (legacy), USD, GBP, RSD, BAM

**Organization default currency**

ALTER TABLE organizations

ADD COLUMN default_currency VARCHAR(3) NOT NULL DEFAULT 'EUR'

REFERENCES supported_currencies(code);

**FK constraints na svim currency kolonama**

Dodane FOREIGN KEY reference na supported_currencies(code) za:

- event_tiers.currency
- occurrence_packages.currency
- bundle_types.currency
- ticket_bundles.currency
- transactions.currency
- payment_orders.currency

**Currency consistency trigger**

Tier, package i bundle moraju koristiti istu valutu kao organizacija koja posjeduje event. Trigger enforce_currency_consistency() na BEFORE INSERT OR UPDATE OF currency provjerava podudarnost.

**NAPOMENA:** Bundle koristi zasebnu verziju triggera (enforce_bundle_currency_consistency) jer referencira event_id umjesto occurrence_id.

# **8\. Dodatni popravci iz code reviewa**

## **8.1 Cascading trigger chain (Problem 4 iz reviewa)**

**KRITIČNO**

Kad se occurrence otkaže, trg_cancel_reservation_on_ticket_cancel stavlja occurrence_item_status na 'available', a handle_occurrence_cancellation ih stavlja na 'unavailable'. Ovisno o redoslijedu AFTER triggera, krajnji status može biti krivi.

**Rješenje:** Promijenjeni redoslijed operacija u handle_occurrence_cancellation() - prvo unavailable/cancel rezervacije, pa TEK ONDA cancel ticketa. T3 neće naći aktivne rezervacije jer su već cancelled.

## **8.2 enforce_tier_capacity_limit() fix**

**SREDNJE**

Trigger u v3 uvijek dodaje NEW.total_count čak i kad je tier deaktiviran (is_active = FALSE). Deaktiviran tier i dalje zauzima kapacitet.

**Rješenje:** IF NEW.is_active = TRUE THEN dodaj total_count, inače ne.

## **8.3 table_reservations source consistency**

**SREDNJE**

ALTER TABLE table_reservations

ADD CONSTRAINT chk_reservation_source_consistency

CHECK (

(source = 'ticket_purchase' AND ticket_id IS NOT NULL)

OR (source = 'manual_booking' AND ticket_id IS NULL)

OR (source = 'standalone' AND ticket_id IS NULL AND bundle_id IS NULL)

);

## **8.4 Nedostajuće kolone: updated_at**

**POBOLJŠANJE**

event_tiers i occurrence_packages nemaju updated_at, za razliku od svih ostalih tablica.

ALTER TABLE event_tiers ADD COLUMN updated_at TIMESTAMPTZ DEFAULT NOW();

ALTER TABLE occurrence_packages ADD COLUMN updated_at TIMESTAMPTZ DEFAULT NOW();

## **8.5 Nedostajući indeksi**

**POBOLJŠANJE**

CREATE INDEX idx_tickets_tier ON tickets(tier_id);

CREATE INDEX idx_transactions_user ON transactions(user_id);

CREATE INDEX idx_payment_orders_from_org ON payment_orders(from_org_id);

CREATE INDEX idx_payment_orders_to_org ON payment_orders(to_org_id);

CREATE INDEX idx_payment_orders_occurrence ON payment_orders(occurrence_id);

## **8.6 Refund transakcija bez user_id**

**SREDNJE**

handle_occurrence_cancellation() kreira refund transakciju bez user_id i gateway_id. Popravljeno: SELECT u FOR LOOP sada uključuje tb.user_id koji se prosljeđuje u INSERT.

# **9\. Konsolidirani pregled svih v4 promjena**

| **#** | **Promjena**                                             | **Izvor**     | **Tip**           |
| ----- | -------------------------------------------------------- | ------------- | ----------------- |
| 1     | locked_by na occurrence_item_status + nova lock funkcija | Poglavlje 1   | Modifikacija      |
| 2     | release_user_seat_locks() + release_single_seat_lock()   | Poglavlje 1   | Nova funkcija     |
| 3     | max_seats_per_checkout na event_occurrences              | Poglavlje 1   | Nova kolona       |
| 4     | Bundle full refund detekcija u triggeru                  | Poglavlje 2   | Mod. triggera     |
| 5     | refunded_amount <= total_price CHECK                     | Poglavlje 2   | Novi constraint   |
| 6     | venues.timezone + build_occurrence_tstzrange() STABLE    | Poglavlje 4   | Kolona + funkcija |
| 7     | trg_sync_va_time_range (popravljen SELECT INTO)          | Poglavlje 4   | Novi trigger      |
| 8     | check_venue_date_available()                             | Poglavlje 4   | Nova funkcija     |
| 9     | trg_auto_generate_payment_order                          | Poglavlje 3   | Novi trigger      |
| 10    | trg_enforce_tier_sale_window                             | Poglavlje 5   | Novi trigger      |
| 11    | resolve_or_create_profile()                              | Poglavlje 6   | Nova funkcija     |
| 12    | user_tickets_view + user_transactions_view               | Poglavlje 6   | Novi viewovi      |
| 13    | supported_currencies tablica + FK constraints            | Poglavlje 7   | Tablica + FK      |
| 14    | organizations.default_currency + currency triggeri       | Poglavlje 7   | Kolona + triggeri |
| 15    | Fix enforce_tier_capacity_limit() za deaktiviran tier    | Poglavlje 8.2 | Mod. triggera     |
| 16    | Fix redoslijed u handle_occurrence_cancellation()        | Poglavlje 8.1 | Mod. triggera     |
| 17    | CHECK na table_reservations za source konzistenciju      | Poglavlje 8.3 | Novi constraint   |
| 18    | updated_at na event_tiers i occurrence_packages          | Poglavlje 8.4 | Nove kolone       |
| 19    | user_id u refund transakciji iz bundle triggera          | Poglavlje 8.6 | Fix triggera      |
| 20    | Nedostajuci indeksi (tier, transactions, payment_orders) | Poglavlje 8.5 | Novi indeksi      |

## **Ukupan pregled po tipu**

| **Kategorija**        | **Broj** | **Detalj**                                                                     |
| --------------------- | -------- | ------------------------------------------------------------------------------ |
| Nove tablice          | 1        | supported_currencies                                                           |
| Novi viewovi          | 2        | user_tickets_view, user_transactions_view                                      |
| Nove kolone           | 6        | locked_by, max_seats_per_checkout, timezone, default_currency, 2x updated_at   |
| Novi triggeri         | 4        | payment order, sale window, currency (x2), va time_range sync                  |
| Modificirani triggeri | 3        | occurrence cancellation, tier capacity, seat lock                              |
| Nove funkcije         | 6        | lock v2, release all/single, build_tstzrange, resolve_profile, check_available |
| Novi constrainti      | 4        | refund cap, source consistency, max_seats, currency FKs                        |
| Novi indeksi          | 5        | tier, transactions user, payment_orders (x3)                                   |

# **10\. Ažurirani potpuni popis triggera i funkcija (v4)**

| **#** | **Trigger/Funkcija**                    | **Tablica**         | **Status**      |
| ----- | --------------------------------------- | ------------------- | --------------- |
| T1    | trg_ticket_sold_counts                  | tickets             | Neprom.         |
| T2    | trg_bundle_sold_counts                  | ticket_bundles      | Neprom.         |
| T3    | trg_cancel_reservation_on_ticket_cancel | tickets             | Neprom.         |
| T4    | trg_reject_overlapping_on_confirm       | venue_availability  | v3 (FOR UPDATE) |
| T5    | trg_enforce_tier_capacity               | event_tiers         | CHANGED v4      |
| T6    | trg_enforce_occurrence_venue_capacity   | event_occurrences   | Neprom.         |
| T7    | trg_handle_occurrence_cancellation      | event_occurrences   | CHANGED v4      |
| T8    | trg_auto_generate_payment_order         | event_occurrences   | NEW v4          |
| T9    | trg_enforce_tier_sale_window            | tickets             | NEW v4          |
| T10   | trg_enforce_tier_currency               | event_tiers         | NEW v4          |
| T11   | trg_enforce_package_currency            | occurrence_packages | NEW v4          |
| T12   | trg_enforce_bundle_currency             | bundle_types        | NEW v4          |
| T13   | trg_sync_va_time_range                  | venue_availability  | NEW v4          |
| F1    | swap_table_reservation()                | -                   | Neprom.         |
| F2    | expire_standalone_reservations()        | -                   | Neprom.         |
| F3    | lock_seat_for_checkout()                | -                   | CHANGED v4      |
| F4    | expire_seat_locks()                     | -                   | CHANGED v4      |
| F5    | release_user_seat_locks()               | -                   | NEW v4          |
| F6    | release_single_seat_lock()              | -                   | NEW v4          |
| F7    | build_occurrence_tstzrange()            | -                   | NEW v4          |
| F8    | check_venue_date_available()            | -                   | NEW v4          |
| F9    | resolve_or_create_profile()             | -                   | NEW v4          |
| F10   | auto_generate_payment_order()           | -                   | NEW v4          |
| F11   | enforce_currency_consistency()          | -                   | NEW v4          |
| F12   | enforce_bundle_currency_consistency()   | -                   | NEW v4          |