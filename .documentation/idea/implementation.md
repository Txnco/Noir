# NOIR — MVP Base Document

> **Interni dokument tima** | Verzija 1.0 | Ožujak 2026.
> Ovaj dokument služi kao jedinstvena baza za razvoj, dizajn i poslovni plan projekta Noir — od danas do finala natjecanja.

---

## 1. Kontekst projekta

**Natjecanje:** TVZ noir
**Tema:** "Svijet nadohvat ruke" (World at your fingertips)
**Timeline:** Ožujak 2026. → Lipanj 2026. (3 mjeseca)
**Faze natjecanja:**

- **Pitch Day** — 3-minutni pitch ideje + networking s mentorima nakon svih pitcheva
- **Polufinale** — Tri zasebne sekcije: Kod, Poslovni plan, Dizajn (svaka se prezentira odvojeno)
- **Finale** — Prezentacija gotovog MVP-a

**Kriteriji ocjenjivanja:** Tehnička izvedba, Dizajn, Poslovni plan — svaka kategorija mora biti snažna.

---

## 2. Što je Noir

Noir je platforma koja studentima i mladima omogućuje da na jednom mjestu pronađu evente u gradu, kupe ulaznice, rezerviraju stolove i kupe pakete (ulaz + piće + stol) — sve u nekoliko tapova. Za organizatore i vlasnike prostora, Noir je operativni alat za kreiranje evenata, upravljanje rezervacijama, provjeru ulaznica i praćenje analitike.

**Jednom rečenicom:** Noir pretvara cijeli izlazak u jedan klik — od otkrivanja eventa do ulaska na vrata.

**Poveznica s temom natjecanja:** Korisnik doslovno ima "svijet nadohvat ruke" — cijeli noćni život grada u jednoj aplikaciji, bez skrolanja po društvenim mrežama, bez pozivanja na info telefone, bez čekanja u redu za kartu.

---

## 3. Tim i resursi

| Član | Fokus | Sati/tjedan |
|------|-------|-------------|
| Osoba 1 | Backend (FastAPI, Supabase) + Baza podataka | 4–6h |
| Osoba 2 | Frontend (Flutter mobile + Next.js web) | 4–6h |
| Osoba 3 | Poslovni plan, istraživanje, pitch priprema + pomoć u razvoju | 4–6h |

**Ukupni raspoloživi resursi:** ~12–18 sati tjedno × 12 tjedana = **144–216 radnih sati**

**Redoslijed razvoja:**
1. Baza podataka i modeli (tjedan 1–2)
2. FastAPI backend — API endpointi (tjedan 2–6, iterativno)
3. Paralelno s API-jem: Flutter mobilna app + Next.js web (tjedan 3–10)
4. Integracije (Stripe test, QR sustav) (tjedan 6–9)
5. Polish, testiranje, demo podaci (tjedan 10–12)

---

## 4. Branding — Noir

**Ime:** Noir (franc. "crno / noć")

**Zašto Noir:**
- Direktna asocijacija na noćni život bez potrebe za objašnjavanjem
- Kratko, pamtljivo, internacionalno prepoznatljivo
- Vizualni identitet se prirodno gradi: tamna elegancija + neon akcenti
- Unikatno u app store kontekstu — nema konkurentskog šuma

**Vizualni smjer (početni):**
- Background: blago tonirana bijela (off-white, npr. `#F8F7F4` ili slična topla nijansa) — čist, čitljiv, ne sterilan
- Primarna boja: TBD — treba biti prepoznatljiva, kontrastna na svijetloj pozadini, nightlife-kompatibilna (kandidati za istraživanje: duboka ljubičasta, electric indigo, neon coral)
- Sekundarna boja: TBD — komplementarna primarnoj, koristi se za akcente i CTA gumbe
- Tipografija: TBD — moderna, geometric sans-serif (kandidati: Inter, Satoshi, Plus Jakarta Sans)
- Logo: TBD — istraživanje i izrada putem Google Stitch + iteracija

> **Napomena:** Detaljan vizualni identitet razvija se u zasebnom dizajn sprintu. Ovaj dokument definira samo smjer.

---

## 5. Korisničke uloge i RBAC

Noir ima tri korisničke uloge. Autentikacija i role-based pristup su **prvi tehnički zadatak** jer sve ostalo ovisi o njima.

### 5.1 Korisnik (User)
- Registracija putem Google/Apple Sign-In ili guest checkout (samo email)
- Pregledava evente na webu i mobilnoj aplikaciji
- Kupuje ulaznice, rezervira stolove, kupuje pakete (ulaz + piće)
- Čuva karte u digitalnom walletu (QR kod u aplikaciji)
- Postavlja interese (tagove) za personalizirani feed
- Ispunjava datum rođenja pri registraciji (za dobnu verifikaciju na 16+/18+ eventima)

### 5.2 Organizator (Organizer)
- Pristup Creator Hubu (web panel)
- Pretražuje prostore na mapi i dogovara termine s vlasnicima
- Kreira evente: naziv, opis, cover, cijena, paketi, Early Bird tierovi, tagovi
- Objavljuje evente koji postaju vidljivi korisnicima
- Prati analitiku svojih evenata (prodaja, popunjenost, peak ulazak)
- Provjerava ulaznice na ulazu putem QR skenera

### 5.3 Vlasnik prostora (Venue Owner)
- Pristup Creator Hubu (web panel)
- Kreira i oglašava svoj prostor: kapacitet, adresa, tip, dostupni termini, fotografije
- Može samostalno kreirati i promovirati vlastite evente
- Prima upite od organizatora za suradnju
- Prati analitiku svog prostora: koji organizatori donose najviše gostiju, prihodi, popunjenost

---

## 6. Tech stack

| Sloj | Tehnologija | Svrha |
|------|-------------|-------|
| Baza | Supabase (PostgreSQL) | Baza, auth, real-time, storage |
| Backend | FastAPI (Python) | REST API, poslovna logika, QR generiranje |
| Mobile | Flutter | iOS + Android aplikacija za korisnike |
| Web | Next.js | Landing page + pregled evenata + Creator Hub |
| Plaćanje | Stripe (test mode) | Simulacija kupnje ulaznica i paketa |
| QR | Backend generira QR → Flutter/Next.js renderira | Digitalne ulaznice |
| Hosting | TBD (Vercel za Next.js, Railway/Fly za FastAPI) | Deploy |

**Supabase pokriva:**
- Auth (Google/Apple Sign-In, magic link, email/password)
- Row Level Security (RLS) za RBAC
- Storage za slike evenata i prostora
- Real-time subscriptions (opcionalno za live podatke)

---

## 7. MVP Feature mapa

Ovo su funkcionalnosti koje Noir MVP mora imati za natjecanje. Svaki feature je izveden iz SCAMPER analize ili core zahtjeva projekta.

### 7.1 CORE — Temelj bez kojeg ništa ne radi

**Auth + RBAC**
- Google/Apple Sign-In (jedan tap)
- Guest checkout (samo email za kupnju bez registracije)
- Magic link login (email → klik → unutra)
- Progressive profiling: ne traži sve podatke odjednom, nego nakon 1. i 2. kupnje
- Tri role: User, Organizer, VenueOwner
- Datum rođenja u registracijskom upitniku za dobnu verifikaciju

> *Izvor: SCAMPER E1 — Eliminacija obavezne registracije*

**Prikaz evenata**
- Feed evenata s karticama: cover slika, naziv, datum, lokacija, cijena
- Filtriranje i pretraga
- Stranica pojedinog eventa s detaljima

**Digitalne ulaznice i QR sustav**
- Kupnja generira jedinstveni QR kod vezan za ticket_id + user_id
- Korisnik vidi QR u aplikaciji (wallet screen) ili ga prima emailom
- Organizator/volonter skenira QR putem companion scan screena
- Scan rezultat: ✅ zeleno (validan) ili ❌ crveno (već skeniran / nevažeći)
- Anti-screenshot: QR prikazuje timestamp zadnjeg osvježavanja
- Backend endpoint: `POST /tickets/{id}/scan` — idempotent

> *Izvor: SCAMPER E2 — Eliminacija fizičke ulaznice*

---

### 7.2 S2 — Paketi doživljaja

Umjesto da korisnik kupuje golu ulaznicu pa razmišlja o piću i stolu, Noir nudi gotove pakete izlaska.

**Kako radi:**
- Organizator pri kreiranju eventa definira pakete: npr. "Basic" (samo ulaz), "Drink & Chill" (ulaz + 2 pića), "Squad Table" (4 ulaza + stol + boca)
- Svaki paket ima naziv, opis, cijenu i strukturu (broj pića, pravo na stol)
- QR kod sadrži ID paketa — na ulazu i šanku se skenira isti kod
- Na šanku: scan → smanji "preostala pića" za taj QR (jedan klik)

**Baza:**
- `Package` entitet vezan na `Event`: name, description, price, includes_drinks (int), includes_table (bool), max_quantity
- `TicketPackage` povezuje kupljenu kartu s paketom i prati stanje (remaining_drinks)

**UI (korisnik):**
- Event stranica prikazuje pakete kao velike kartice (tiles) s ikonama (🎫 ulaz, 🍺 piće, 🪑 stol)
- 1–2 klika do kupnje: tap paket → potvrda količine → checkout
- Nakon kupnje: digitalna kartica u walletu pokazuje što imaš (npr. "2 preostala pića, stol: DA")

---

### 7.3 A2 — Tag-based discovery

Personalizirani feed evenata bez ML-a — samo pametno korištenje tagova.

**Kako radi:**
- Korisnik pri onboardingu bira 3–5 interesnih tagova: #techno, #kvizovi, #live_glazba, #cajke, #stand_up, #studentska_večer...
- Organizator pri kreiranju eventa označava iste tagove
- Feed prikazuje evente sortirane po: tag overlap s korisnikovim interesima (desc) + blizina datuma (asc)
- Implementacija: `SELECT events ORDER BY (tag_overlap_count DESC, date ASC)`

**FOMO elementi na karticama:**
- 🔥 "Rasprodaje se" — ispod 20% slobodnih ulaznica
- 👥 "Prijatelji idu" — overlap s kontaktima (backlog, ne MVP)
- ⭐ "Preporučeno za tebe" — odgovara korisnikovim tagovima

**UI:**
- Onboarding: grid s 10–12 tag pilula, korisnik tapne 3–5, odmah vidi preview feeda
- Search bar permanentno vidljiv na vrhu (ne skriven iza ikone)
- Default home screen: "Za tebe" (personalizirani feed), drugi tab: "Svi eventi"

---

### 7.4 C2 — Creator Hub

Jedan web panel za organizatore i vlasnike prostora — event se slaže kao LEGO.

**Venue Owner panel:**
- Unos prostora: kapacitet, adresa, tip, dostupni dani, fotografije
- Tablica `VenueAvailability`: datum, vremenski slot, status (slobodno/zauzeto)
- Dashboard: lista nadolazećih evenata u prostoru + broj prodanih karata + rezervacije stolova

**Organizer panel:**
- Katalog prostora s filterima: kapacitet, cijena najma, tip (klub, bar, kviz, koncert)
- Mapa prostora (OpenStreetMap / Google Maps embed)
- Wizard za kreiranje eventa (3 koraka): 1) Odaberi prostor i termin → 2) Postavi cijene, pakete, tierove, tagove → 3) Pregled i objava
- Dashboard s listom svojih evenata i quick stats

**Zajednički elementi:**
- Role-based login: Organizer vidi svoj panel, VenueOwner svoj
- Isti vizualni jezik, tabovi na vrhu: "Moji eventi", "Moj prostor", "Kalendar"
- Mapa s označenim prostorima — komunicira skalabilnost (tema natjecanja)

---

### 7.5 M2 — Early Bird tier sustav

Transparentni cijenski tierovi koji nagrađuju rane kupce i stvaraju FOMO.

**Kako radi:**
- Organizator pri kreiranju eventa definira do 3 tiera:
  - Tier 1 (Early Bird): X karata po cijeni A (npr. 5€)
  - Tier 2 (Regular): Y karata po cijeni B (npr. 8€)
  - Tier 3 (Last Minute): Z karata po cijeni C (npr. 12€)
- Sustav automatski prelazi na sljedeći tier kad se iscrpe karte trenutnog
- Backend: `SELECT current_tier FROM event_tiers WHERE sold_count < total_count ORDER BY tier_order LIMIT 1`

**UI:**
- Progress bar na stranici eventa: `[████████░░] 80% Early Bird prodano`
- Ispod: trenutna cijena (bold) + napomena: "Sljedeći tier: 8€ (za 10 karata)"
- Badge na kartici u feedu: 🟢 "Early Bird dostupno" ili 🟠 "Zadnji tier!"
- Checkout: "Kupuješ po Early Bird cijeni. Šteidiš 3€ vs. Regular tier."

---

### 7.6 P1 — Venue Intelligence (Analytics)

Podaci koji već postoje u bazi, prezentirani kao dashboard za organizatore i vlasnike.

**KPI kartice (4–5 na vrhu dashboarda):**
- Ukupno prodano karata
- Prihod
- Popunjenost (%)
- Peak sat ulaska (iz QR scan timestampova)

**Grafikon:**
- Linijski: prodaja karata po danu (0–7 dana prije eventa)
- Bar lista: top tier po prihodu

**Za vlasnike prostora dodatno:**
- "Koji organizatori su doveli najviše gostiju?" — JOIN events × organizers × tickets

**Export:** Gumb "Preuzmi CSV" za vlastitu analizu

**UI:** Zaseban tab "Statistike" u Creator Hubu, čist layout, 4 KPI kartice + 1 grafikon + lista evenata s quick stats.

---

## 8. Platforma — Što je web, što je mobile

| Funkcionalnost | Mobile (Flutter) | Web (Next.js) |
|----------------|:-:|:-:|
| Landing page | — | ✅ |
| Pregled evenata + feed | ✅ | ✅ |
| Tag-based discovery + personalizirani feed | ✅ (primary) | ✅ (simplified) |
| Kupnja ulaznice / paketa | ✅ | ✅ |
| Rezervacija stola | ✅ | ✅ |
| Digitalni wallet (QR karte) | ✅ (primary) | ✅ (email fallback) |
| Onboarding upitnik (tagovi, datum rođenja) | ✅ | ✅ |
| Creator Hub (Organizer + Venue Owner) | — | ✅ |
| QR scan na ulazu | ✅ (companion screen) | — |
| Analytics dashboard | — | ✅ (Creator Hub) |

**Mobile app** = društvena mreža za izlaske: discovery, kupnja, wallet, osobni profil
**Web app** = landing page + event pregled + kupnja + Creator Hub za B2B korisnike

---

## 9. Baza podataka — Ključni entiteti

Ovo je konceptualni pregled glavnih tablica. Detaljna shema razvija se u prvom sprintu.

```
User
├── id, email, name, date_of_birth, role (user/organizer/venue_owner)
├── auth via Supabase Auth
└── UserPreferences (interest_tags[])

Venue
├── id, owner_id (FK → User), name, address, capacity, type, description, photos[]
└── VenueAvailability (venue_id, date, time_slot, status)

Event
├── id, organizer_id (FK → User), venue_id (FK → Venue)
├── name, description, cover_image, date, time, tags[]
├── is_published, min_age
└── EventTier[] (tier_order, name, price, total_count, sold_count)

Package
├── id, event_id (FK → Event)
├── name, description, price, includes_drinks (int), includes_table (bool), max_quantity
└── sold_count

Ticket
├── id, user_id (FK → User, nullable za guest), event_id, package_id (nullable)
├── tier_id (FK → EventTier), qr_code, status (active/scanned/cancelled)
├── scanned_at, remaining_drinks (int, nullable)
└── purchase_email (za guest checkout)

TableReservation
├── id, event_id, user_id, table_number, status
└── linked_ticket_id (nullable)

Transaction
├── id, user_id, ticket_id, amount, stripe_payment_id, status
└── created_at
```

---

## 10. API struktura — Glavni endpointi

Grupirani po domeni. Svaki endpoint zahtijeva odgovarajuću ulogu (RBAC middleware).

```
AUTH
  POST   /auth/google          — Google Sign-In
  POST   /auth/apple           — Apple Sign-In
  POST   /auth/magic-link      — Pošalji magic link na email
  POST   /auth/guest           — Guest checkout (email + name)
  GET    /auth/me              — Trenutni korisnik + role

EVENTS (public)
  GET    /events               — Lista evenata (filteri: tag, date, search)
  GET    /events/for-you       — Personalizirani feed (tag overlap sort)
  GET    /events/{id}          — Detalji eventa + tierovi + paketi

EVENTS (organizer)
  POST   /events               — Kreiraj event
  PUT    /events/{id}          — Uredi event
  POST   /events/{id}/publish  — Objavi event

VENUES (public)
  GET    /venues               — Lista prostora (filteri: capacity, type, area)
  GET    /venues/{id}          — Detalji prostora + dostupnost

VENUES (venue_owner)
  POST   /venues               — Kreiraj prostor
  PUT    /venues/{id}          — Uredi prostor
  POST   /venues/{id}/availability — Postavi dostupne termine

PACKAGES (organizer)
  POST   /events/{id}/packages — Kreiraj paket za event
  PUT    /packages/{id}        — Uredi paket

TIERS (organizer)
  POST   /events/{id}/tiers    — Definiraj tier strukturu
  GET    /events/{id}/tiers    — Trenutni tier status

TICKETS
  POST   /tickets/purchase     — Kupnja karte (tier + optional package)
  GET    /tickets/my           — Moje karte (wallet)
  GET    /tickets/{id}/qr      — QR kod za kartu
  POST   /tickets/{id}/scan    — Skeniraj kartu na ulazu (door_staff)
  POST   /tickets/{id}/redeem-drink — Smanji piće na šanku

TABLE RESERVATIONS
  POST   /reservations         — Rezerviraj stol
  GET    /reservations/my      — Moje rezervacije

ANALYTICS (organizer + venue_owner)
  GET    /analytics/event/{id} — KPI za event
  GET    /analytics/venue/{id} — KPI za prostor
  GET    /analytics/export/{id}— CSV export

USER PREFERENCES
  PUT    /users/me/preferences — Postavi tagove i preferencije
  PUT    /users/me/profile     — Dopuni profil (progressive)
```

---

## 11. Poslovni plan — Osnove

### 11.1 Problem
Studenti i mladi u Zagrebu nemaju jedno mjesto gdje mogu otkriti sve evente u gradu, kupiti karte, rezervirati stol i organizirati izlazak. Trenutno koriste kombinaciju Instagrama, WhatsApp grupa, Entria, Facebook evenata i usmene predaje — fragmentirano, sporo, frustrirajuće.

Organizatori (posebno mali: studentske udruge, kviz barovi) nemaju pristupačan alat za kreiranje evenata, prodaju karata i pronalaženje prostora. Postojeća rješenja su skupa, komplicirana ili fokusirana na veće igrače.

### 11.2 Rješenje
Noir — jedna platforma koja spaja tri strane: korisnike (studente), organizatore i vlasnike prostora. Korisnici kupuju cijeli doživljaj izlaska u par klikova, organizatori dobivaju besplatan Creator Hub, a vlasnici prostora dobivaju vidljivost i analitiku.

### 11.3 USP (Unique Selling Proposition)
- "Mi ne prodajemo ulaznice — mi prodajemo paket izlaska."
- Jedna app: od otkrivanja eventa do ulaska na vrata, sve u jednom
- Personalizirani feed: app zna što voliš od prvog dana
- Transparentni Early Bird tier: rano kupuješ, manje plaćaš, bez skrivenih troškova
- Besplatan analytics za male organizatore i lokale koji inače nemaju nikakav uvid u podatke
- QR sustav bez hardwarea: jedini uvjet je mobitel s kamerom

### 11.4 Tržište
- **Primarno:** Studenti i mladi (18–25) u Zagrebu
- **Sekundarno:** Srednjoškolci (16+) za evente prikladne dobi
- **B2B:** Studentske udruge, kviz barovi, mali klubovi, indie organizatori u Zagrebu
- **Dugoročno:** Ekspanzija na Split, Rijeku, ostale hrvatske gradove, pa regionalno

### 11.5 Konkurencija

| Platforma | Što rade | Noir prednost |
|-----------|----------|---------------|
| Entrio | Prodaja ulaznica | Noir nudi pakete (ulaz+piće+stol), personalizirani feed, analytics |
| CoreEvent | Event management | Noir je jednostavniji, besplatan za male organizatore, fokus na studente |
| Upad.hr | Clubbing scene | Noir ima širi scope (kvizovi, koncerti, stand-up) + kupnja u app |
| Eventim | Ticketing za velike evente | Noir cilja small/mid evente, brži checkout, studentski fokus |
| Facebook Events | Event discovery | Noir nudi kupnju u app, pakete, personalizaciju, nema noise |

### 11.6 Monetizacija (smjer za istraživanje)
- **Kratkoročno:** Transakcijska provizija (% po prodanoj karti/paketu)
- **Srednjoročno:** Premium analytics za veće lokale (SaaS)
- **Dugoročno:** Sponzorirani eventi i brand aktivacije

> **Napomena:** Detaljan model monetizacije razvija se u zasebnom poslovnom planu. Za MVP i natjecanje, fokus je na demonstraciji vrijednosti, ne na profitabilnosti.

### 11.7 Akvizicija prvih korisnika (3 mjeseca)
- Kontakt s 1–2 kluba/bara u Zagrebu za pilot (studentska večer)
- Kontakt s 2–3 studentske udruge i kviz organizatora
- Ručno kreiranje evenata za demo
- Plakati i QR kodovi na fakultetima: "Uzmi cijeli izlazak u jednom kliku"
- Word-of-mouth kroz kolege i studentske krugove
- Early Bird ekskluzivno kroz Noir app → razlog za preuzimanje

---

## 12. Dizajn — Smjer i principi

### 12.1 Načela
1. **Minimalan broj tapova** — od otvaranja app do kupljene karte: max 4–5 tapova
2. **Pokaži vrijednost prije nego tražiš išta** — feed evenata vidljiv prije loginа, auth tek pri kupnji
3. **Jedan ekran, jedan zadatak** — svaki screen ima jedan primarni gumb i max jedan sekundarni
4. **Clean > fancy** — nitko ne želi kompleksno sučelje za kupnju karte u 23:00

### 12.2 Ključni screenovi (mobile)

1. **Onboarding** — Odabir tagova (3–5) + datum rođenja → odmah personalizirani feed
2. **Home / Feed** — "Za tebe" tab (default) + "Svi eventi" tab. Kartice s cover slikom, imenom, datumom, cijenom, FOMO badge
3. **Event detalji** — Cover, info, paketi kao tile kartice s ikonama, tier progress bar, CTA gumb
4. **Checkout** — Odabrani paket/tier → Google/Apple Sign-In ili guest → Stripe (test) → potvrda
5. **Wallet / Moje karte** — Lista nadolazećih evenata, tap → full-screen QR kod
6. **Profil** — Interesi (tagovi), datum rođenja, povijest kupnji

### 12.3 Ključni screenovi (web)

1. **Landing page** — Hero sekcija, kako radi (3 koraka), CTA za preuzimanje app / pregled evenata
2. **Event lista** — Grid/lista kartica, filteri, search
3. **Event detalji + kupnja** — Isti flow kao mobile, prilagođen za desktop
4. **Creator Hub** — Organizator: wizard za kreiranje eventa, dashboard, analytics. Vlasnik: upravljanje prostorom, termini, analytics

### 12.4 Alati
- **Ideacija:** Google Stitch za generiranje početnih koncepata
- **Iteracija:** Izvlačenje ključnih elemenata iz Stitch outputa, ručna dorada
- **Dokumentacija:** Screenshotovi ključnih flowova za prezentaciju

---

## 13. Roadmap — 12 tjedana

### Tjedan 1–2: Temelji
- [ ] Finalizirati bazu podataka shemu u Supabase
- [ ] Postaviti Supabase Auth (Google Sign-In, magic link, guest)
- [ ] Implementirati RBAC (RLS pravila za User, Organizer, VenueOwner)
- [ ] Postaviti FastAPI projekt: struktura, konekcija na Supabase, CORS
- [ ] Osnovni CRUD endpointi: Users, Venues
- [ ] Postaviti Next.js i Flutter projekte (boilerplate, navigacija, auth flow)

### Tjedan 3–4: Core event sustav
- [ ] Event CRUD endpointi (kreiranje, uređivanje, objava)
- [ ] Package model i endpointi
- [ ] EventTier model i automatski tier switching logika
- [ ] Event feed endpoint s tag-based sortiranjem
- [ ] Flutter: onboarding screen (tagovi + datum rođenja)
- [ ] Flutter: home feed s karticama evenata
- [ ] Next.js: landing page (statički sadržaj)

### Tjedan 5–6: Kupnja i QR
- [ ] Stripe test mode integracija (checkout session)
- [ ] Ticket generiranje nakon uspješne kupnje
- [ ] QR kod generiranje (backend) i prikaz (frontend)
- [ ] Scan endpoint (`POST /tickets/{id}/scan`)
- [ ] Flutter: event detail screen s paketima i tier progress barom
- [ ] Flutter: checkout flow (paket → auth → Stripe → potvrda)
- [ ] Flutter: wallet screen s QR prikazom
- [ ] Next.js: event lista + event detail + kupnja

### Tjedan 7–8: Creator Hub + rezervacije
- [ ] Next.js: Creator Hub layout (role-based routing)
- [ ] Venue Owner: kreiranje prostora, upravljanje terminima
- [ ] Organizer: wizard za kreiranje eventa (prostor → cijene → objava)
- [ ] Table reservation model i endpointi
- [ ] Flutter: rezervacija stola flow
- [ ] Drink redemption endpoint (`POST /tickets/{id}/redeem-drink`)

### Tjedan 9–10: Analytics + polish
- [ ] Analytics endpointi (KPI za event i venue)
- [ ] Next.js: analytics dashboard u Creator Hubu
- [ ] CSV export
- [ ] Flutter: QR scan companion screen (za door staff)
- [ ] Bug fixing, edge cases, error handling
- [ ] Responzivnost i prilagodba web layouta

### Tjedan 11–12: Demo priprema
- [ ] Ručno kreirati demo evente s realističnim podacima
- [ ] Testirati cijeli flow: discovery → kupnja → QR scan → analytics
- [ ] Pripremiti pitch prezentaciju i demo scenarij
- [ ] Final polish dizajna
- [ ] Pripremiti poslovni plan dokument za polufinale
- [ ] Pripremiti dizajn dokumentaciju za polufinale

---

## 14. Backlog — Post-MVP (nakon natjecanja)

Ove funkcionalnosti su identificirane kroz SCAMPER analizu ali nisu u MVP scopeu. Služe kao roadmap za nastavak razvoja.

**Iz SCAMPER analize (neimplementirano u MVP):**
- S1: Meta-agregacija evenata iz vanjskih izvora (cold-start rješenje za sadržaj)
- A1: Semester Recap (Spotify Wrapped za izlaske) — viralni alat
- M1: Nightlife Passport (gamifikacija s pečatima i badgevima)
- R1: Demand-first model ("Event traži tebe" — wish list + demand signali za organizatore)
- R2: Post-event reviews i ocjene (viralni loop + feedback za organizatore)
- P2: Brand aktivacije i sponzorirani sadržaj (treći revenue stream)
- C1: (ako postoji iz SCAMPER-a)

**Napredne tehničke funkcionalnosti:**
- Produkcijsko plaćanje (Stripe live mode s poslovnim subjektom)
- Push notifikacije (tier promjena, event preporuke, reviews)
- NFC ulaz
- Rotating QR (JWT s 30s expiry)
- Real-time dashboard za evente u tijeku
- UGC galerija (fotografije s evenata)
- Leaderboard između prijatelja
- Apple Wallet / Google Wallet integracija
- Dinamični pricing u realnom vremenu
- Self-serve brand portal za sponzore

---

## 15. Pitch priprema — Ključne poruke

Za svaku fazu natjecanja, ovo su core poruke koje se moraju komunicirati:

### Pitch Day (3 min)
> "Noir pretvara cijeli izlazak u jedan klik. Student otvori app, vidi evente personalizirane za sebe, kupi paket — ulaznicu, piće i stol — i uđe na event samo s mobitelom. Organizator u istoj platformi pronalazi prostor, kreira event, prodaje karte i vidi tko dolazi. Sve je na dohvat ruke."

**Demo moment:** Pokazati brzinu — od otvaranja app do kupljene karte u 30 sekundi uživo.

### Polufinale — Kod
- Supabase + FastAPI + Flutter + Next.js = moderan, skalabilan stack
- RBAC s tri role, tag-based discovery bez ML-a, automatski tier switching, QR sustav bez dodatnog hardwarea
- Stripe test integracija pokazuje spremnost za produkciju

### Polufinale — Dizajn
- 4–5 tapova do karte
- Pokaži vrijednost prije auth-a
- Paketi kao vizualne tile kartice — "vidiš cijeli izlazak u jednom screenu"
- Tema natjecanja prožeta kroz cijeli UX

### Polufinale — Poslovni plan
- Problem je realan, konkurencija ne pokriva sve u jednom
- Trostrano tržište: studenti ↔ organizatori ↔ vlasnici prostora (network efekt)
- USP: paketi doživljaja, ne gole ulaznice
- Monetizacija: provizija + SaaS analytics + brand aktivacije
- Besplatan analytics je onboarding hook za B2B partnere

### Finale
- Demonstracija gotovog MVP-a s realnim demo podacima
- Live flow: otkrivanje → kupnja → scan na ulazu → analytics u Creator Hubu
- Poslovni rezultati pilota (ako postoje)

---

## 16. Otvorena pitanja za daljnje istraživanje

Ova pitanja treba riješiti u nadolazećim sprintovima i zasebnim chat sesijama:

1. **Vizualni identitet** — Primarna i sekundarna boja, tipografija, logo, ikone
2. **Detaljan model monetizacije** — Točan % provizije, SaaS pricing, sponzorski paketi
3. **Pravni aspekti** — Uvjeti korištenja, privatnost podataka (GDPR), dobna ograničenja
4. **Detaljni wireframeovi** — Screen-by-screen flow za mobile i web
5. **Deployment strategija** — Hosting, CI/CD, environment management
6. **Testiranje** — Strategija za QA, testni scenariji za demo
7. **Pitch deck dizajn** — Vizualni materijali za prezentaciju
8. **Partnerski razgovori** — Kontaktiranje klubova, barova, udruga u Zagrebu
9. **Detaljna shema baze** — Relacije, indeksi, RLS pravila, migracije
10. **Stripe integracija** — Detaljan checkout flow, webhook handling, test scenariji