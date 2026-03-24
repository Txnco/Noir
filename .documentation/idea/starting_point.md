<img src="https://r2cdn.perplexity.ai/pplx-full-logo-primary-dark%402x.png" style="height:64px;margin-right:32px"/>

# Hej želimo napraviti ovaj sustav. Prouči sve datoteke.

Prvi cilj nam je kreirati bazu podataka i identificirati cijeli workflow kako ćemo što raditi da budemo što efikasiniji u implementiranju novih featurea. Ako imaš pitanja slobodno pitaj prije nego što kreneš

Pročitao sam sve četiri datoteke. Projekt **Noir** je jasno definiran i dobro dokumentiran. Prije nego krenem s izradom sheme, imam **3 konkretna pitanja** koja direktno utječu na dizajn baze — bez odgovora bih morao raditi pretpostavke koje bi zahtijevale refaktoriranje.

***

## Što sam razumio (potvrdi da se slažemo)

Iz dokumenata, sustav ima:[^1]

- **3 uloge:** User, Organizer, VenueOwner s RBAC-om via Supabase RLS
- **Stack:** Supabase (PostgreSQL) + FastAPI + Flutter + Next.js + Stripe
- **Core entiteti:** User → Venue → Event → EventTier → Package → Ticket → Transaction → TableReservation

**Approval flow:** Organizator kreira event → Venue Owner mora odobriti → tek tada se objavljuje. Vlasnik može kreirati za vlastiti prostor bez odobrenja.[^2]

***

## 3 pitanja prije sheme

### ❓ Pitanje 1 — Multi-day eventi

`idea.md` jasno kaže: event može trajati 3 dana, svaki dan ima **zasebne ulaznice + bundle za sve dane**.  Međutim `implementation-2.md` modelira `Event` s jednim `date` i `time` fieldom.[^2][^1]

**Trebam znati:** Modeliramo li multi-day event kao:

- **A)** Jedan `Event` s više `EventDay` tablica (svaki dan = zaseban entitet s vlastitim tierovima i ulaznicama)?
- **B)** Više zasebnih `Event` zapisa linked zajedničkim `event_group_id`?
- **C)** Za MVP ignoriramo multi-day i radimo samo single-day evente?

> Ovo drastično mijenja strukturu `Event`, `EventTier` i `Ticket` tablica.

***

### ❓ Pitanje 2 — Approval workflow statusi

Organizator šalje upit za venue → vlasnik odobrava/odbija. Trebam točne **statuse** za `Event` tablicu i moguće za posebnu `VenueInquiry` tablicu:[^2]

**Trebam znati:** Koji su točni statusi?

- Prijedlog: `draft → pending_venue_approval → approved → published → cancelled`
- Ili vlasnik i organizator direktno komuniciraju van sustava, a sustav samo bilježi finalni dogovor?

> Utječe na to trebamo li `VenueInquiry` kao zasebnu tablicu s messaging logikom, ili samo `status` field na `Event`.

***

### ❓ Pitanje 3 — Numerirana sjedala vs. stolovi

`idea.md` spominje i **kupovinu sjedala** (npr. za koncerte) i **rezervaciju stolova** (za klubove/barove).  `implementation-2.md` modelira samo `TableReservation`.[^1][^2]

**Trebam znati:** Je li u MVP scope:

- **A)** Samo **rezervacija stolova** (stol 1, stol 2... bez fiksnih sjedala) — kao što implementation-2.md opisuje?
- **B)** I **numerirana sjedala** (npr. red A, mjesto 5 — seating mapa za koncerte)?
- **C)** Oba, ovisno o tipu venue-a?

> Seating mapa je značajno kompleksniji feature koji zahtijeva dodatne tablice (`Seat`, `SeatMap`) i višestruko više backend logike.

***

Kada dobijem odgovore na ova tri pitanja, mogu odmah isporučiti:

1. **Kompletni SQL migration file** za Supabase (sve tablice, constrainti, indexi, RLS policies)
2. **Feature-by-feature workflow** s jasnim redoslijedom implementacije i ovisnostima između backend/frontend taska
<span style="display:none">[^3][^4]</span>

<div align="center">⁂</div>

[^1]: implementation-2.md

[^2]: idea.md

[^3]: colors-4.md

[^4]: scamper-3.md

