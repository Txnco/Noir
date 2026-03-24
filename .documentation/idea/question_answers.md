<img src="https://r2cdn.perplexity.ai/pplx-full-logo-primary-dark%402x.png" style="height:64px;margin-right:32px"/>

# 1. Neka bude jedan event koji može imati više izvedbi u smislu može biti više datuma. Kako je najbolje nazvati tablice (neka bude sve na engleskom) da imamo znači definiciju događaja i onda da taj događaj ima izvedbe jer može biti isti event više dana u razmacima ili za redom u različitim vremenima. Ciljamo na skalabilnost u startu da kasnije bazu ne moramo pretjerano dirati. Slobodno se mijenja struktura koja je navedena u prijašnjim datotekama

2. Naš cilj je da imamo workflow gjde organizatori vide moguće prostore za izvedbu eventata i da se uz sve potrebne informacije pošalje upit prema vlasnicima prostora. Taj upit sadržava osnovne informacije o događaju i datume. Ti datumi moraju biti slobodni za taj prostor. Vlasnici prostora također mogu definirati kako će naplatiti za najam svog prostora npr hoće li biti određeni % prihoda od događaja ili fiksna cijena. Nakon potvrde vlasnika upit se vraća organizatoru da definira više detalja o izvedbi i cijenama ulaznica paketima izlaska i slično. Mogućnost opcija sa free ulazom i slično
3. Cilj nam je da možemo prodati bilo kakav događaj jer ćemo imati i venue builder uz to gdje se može definirati pozicija stolova, sjedala i slično jer neki prostori imaju numerirana sjedala, neki prostori imaju nenumerirana mjesta. Jedan venue može imati stajaća mjesa koja nisu numerirana i isto tako može imati i sjedala + vip lože i slično. Želimo skalabilnu strukturu baze za ovo.

Što se tiče payment providera želimo da tu postoji mogućnost da se prema vlasnicima organizatora može prilagoditi drugačiji payment getaway a cilj je da isto tako u sustavu postoji i uloga admina što smo mi da možemo nadzirati cijeli sustav.
Ako imaš još pitanja samo pitaj prije nego što kreneš raditi

Odlično — sve tri točke su mi jasne i mogu projektirati skalabilnu shemu. Imam još **3 konkretna pitanja** koja direktno utječu na strukturu prije nego krenem:

***

### ❓ Pitanje 1 — VenueInquiry + datumi

Kada organizator šalje upit vlasniku prostora, šalje li:

- **A)** Jedan upit za **jednu izvedbu** (jedan datum)?
- **B)** Jedan upit koji pokriva **više datuma odjednom** (npr. "želim Petak + Subotu + Nedjelju za isti event")?

> Ovo definira relaciju između `VenueInquiry` i `EventOccurrence` — 1:1 ili 1:N.

***

### ❓ Pitanje 2 — Payment gateway dodjela

Payment gateway (Stripe, PayPal, lokalni PSP...) — na kojoj razini se konfigurira?

- **A)** Na razini **accounta** (svaki organizator/vlasnik ima svoj gateway konfiguriran jednom)
- **B)** Na razini **eventa** (svaki event može imati drugačiji gateway)
- **C)** Vi kao admin definirate dostupne gatewayi, a organizatori biraju koji koriste

I — za **revenue split** (% model najma): planirate li **automatski split** (npr. Stripe Connect gdje novac automatski ide na više računa) ili **ručna/odgođena isplata** (mi skupljamo sve, pa isplaćujemo vlasniku)?

> Automatski split zahtijeva Stripe Connect arhitekturu i zasebne `ConnectedAccount` zapise u bazi. Ručni split je puno jednostavnija baza.

***

### ❓ Pitanje 3 — Venue builder granularnost

Za sjedala i zone — trebamo li u bazi čuvati **vizualne koordinate** (x, y position za drag-and-drop map builder), ili je dovoljno **logička hijerarhija** (Sekcija → Red → Broj sjedala)?

- **A)** Logička hijerarhija — `Section → Row → Seat(number)` — dovoljna za MVP, sjedala nemaju koordinate
- **B)** Vizualna mapa — svako sjedalo ima `x, y` koordinate jer gradimo interaktivni floor plan builder
- **C)** Hybrid — sekcije imaju oblik/koordinate (za prikaz mape), ali individualna sjedala su samo logički numerirana unutar sekcije

> Opcija B/C znači zasebna `shape`/`geometry` polja (JSON ili PostGIS), što je značajno kompleksnija implementacija.

***

Kada odgovorite na ovo troje, odmah krećem s kompletnom SQL shemom + workflow dokumentacijom.

