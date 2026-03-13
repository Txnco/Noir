S2 – Umjesto „ulaznice + sve ostalo na licu mjesta“: paketi doživljaja (ulaz + piće + stol + merch)
Što mijenjamo:
Umjesto da korisnik razmišlja „prvo karta, pa ću kasnije vidjeti za piće/stol“, nudite pakete izlaska (npr. „Entry + 2 pića“, „Grupa 4 – ulaz + stol + boca“). Time mijenjate mentalni model s „kupujem proizvod (ulaznicu)“ u „kupujem cijeli doživljaj“ – što je jak fit za temu natjecanja.
1. Programiranje (Tech izvedba)
MVP za 3 mjeseca (trenutna implementacija)
•	Model „paketa“ u bazi:
•	Package entitet vezan na event: ima naziv, opis, cijenu i strukturu (npr. broj uključenih pića, pravo na stol, možda simbolični merch).
•	Jednostavna logika prava:
•	QR kod na ulaznici sadrži ID paketa.
•	Aplikacija za organizatora/klub na ulazu i šanku:
•	Na ulazu: scan → „Ulaznica + X pića, stol: DA/NE“.
•	Na šanku: scan → smanji „preostala pića“ za taj QR (jedan klik).
•	Plaćanje jednako kao i za obične karte:
•	Stripe / PayPal / lokalni PSP; paket je samo „proširena karta“ iz njihove perspektive.
•	Inspiracija iz svijeta:
•	Ticketor integrira ticketing s koncesijama, barom i restoranom, gdje kupci mogu naručivati piće/food povezano s ulaznicom, uključujući pre order i dostavu za stol.
•	TicketFairy omogućuje integraciju mercha s kupnjom ulaznica i bundleove (karta + majica), što diže prosječnu vrijednost narudžbe 40–50%.
•	Fever u svojem softveru za immersivne evente nudi cross sell dodataka (F&B, merch) direktno u checkoutu.
•	Vi u MVP u radite njihovu „light“ verziju fokusiranu na studente i nightlife.
Vizija za budućnost (Backlog)
•	Napredni upsell engine:
•	Dinamično preporučivanje paketa ovisno o tipu eventa (koncert → merch + piće, techno party → stol + boca, kviz → bucket pića + snack).
•	Napredna F&B integracija:
•	QR naručivanje s mjesta u klubu (kao Ticketor: QR kod na stolu, narudžbe na bar POS).
•	Integracija s blagajnom kluba i pravim POS om, gdje se svi podaci spajaju u jedinstvene izvještaje.
•	Full merch ekosustav:
•	Inspirirano TicketFairy i Seat Engine – online merch shop povezan s eventima (majice, kape, limited edicije), cross sell prije i poslije eventa.
________________________________________
2. Dizajn (UI/UX)
Kako izgleda u MVP u
•	Stranica eventa: fokus na pakete umjesto na „golu“ ulaznicu:
•	Velike kartice („tiles“) s jasnim nazivima:
•	„Basic“ – samo ulaznica.
•	„Drink & Chill“ – ulaznica + 2 pića.
•	„Squad Table“ – npr. 4 ulaza + stol + boca.
•	Svaka kartica ima 2–3 ključne ikonice (ticket, čaša, stol) da vizualno bude jasno što dobivaš.
•	1–2 klika do završetka kupnje:
•	Tap na paket → potvrda količine → checkout.
•	Time ispunjavate kriterij „clean“ iskustva: korisnik ne mora ručno dodavati „još jednu opciju“; paket je već smislen.
•	„Svijet nadohvat ruke“ u vizualnom narativu:
•	U jednom screenu vidiš cijeli svoj izlazak: vrijeme, mjesto, ulaz, piće, stol – sve označeno ikonama.
•	Nakon kupnje, digitalna „kartica“ u walletu s jasnim prikazom što imaš (npr. 2 preostala pića, oznaka stola).
________________________________________
3. Poslovni plan (Biznis & Prezentacija)
Kako se zamjena uklapa u poslovni model
•	Više prihoda po korisniku i jaka diferencijacija:
•	Globalne platforme pokazuju da integracija mercha i F&B s ulaznicom značajno diže prosječnu vrijednost narudžbe (TicketFairy navodi povećanje 40–50% s pametnim bundleovima i upsellom).
•	Vaš USP: „Mi ne prodajemo samo ulaznice – mi prodajemo paket izlaska.“
•	Dodana vrijednost za klubove i organizatore:
•	Klub dobiva prepaid potrošnju (pića) i bolju predvidljivost prihoda po gostu, slično kako Ticketor koristi integrirani F&B modul da pretvori hranu i piće u glavni profitni centar.
•	Za male organizatore (studentske udruge, kviz barove) paketi tipa „ulaz + 1 piće“ mogu biti jednostavan način da povećaju prihode bez kompliciranih sponzorstava.
Kako to ispričati žiriju i privući prve korisnike
•	Pitch žiriju:
•	„Umjesto da student kupi kartu pa onda satima mozgala hoće li imati stol, koliko će potrošiti na piće i hoće li gužva biti prevelika – naš sustav nudi gotove, pametne pakete koji cijeli izlazak stavljaju pod jedan klik. To je pravi ‘World at your fingertips’.“
•	Prva 3 mjeseca – strategija:
•	Nađete 1–2 kluba/barova spremnih za studentske pakete (npr. srijeda/četvrtak studentska večer).
•	Dogovorite ekskluzivan „student night paket“ samo kroz vašu aplikaciju: ulaz + 2 pića po povoljnoj cijeni.
•	Marketing:
•	Plakati i QR kodovi na faksovima i u domovima: „Uzmi cijeli izlazak u jednom kliku“.
•	Influenceri / studentske udruge – giveaway paketa.
•	Time dobivate realne brojke korištenja koje na prezentaciji žiriju izgledaju impresivno.
 
C2 – Kombinacija: „Creator Hub“ za organizatore + vlasnike prostora
Ideja:
Kombinirate alate za organizatore i alate za vlasnike prostora u jedan „Creator Hub“ gdje se event može složiti kao LEGO: prostor + termin + ulaznice + paketi + promocija. TablelistPro i slični alati već kombiniraju ticketing, stolove, guest liste, CRM, ali su skupi, B2B i nisu fokusirani na studentske / indie organizatore. Vi kombinirate te koncepte u pojednostavljeni, studentski friendly web panel.
1. Programiranje (Tech izvedba)
MVP za 3 mjeseca (trenutna implementacija)
•	Jednostavan web „Creator Hub“ panel:
•	Role based login: Organizer i VenueOwner.
•	Venue owner:
•	unos osnovnih podataka o prostoru (kapacitet, adresa, tip događaja, dostupni dani u tjednu),
•	definira „ponudu“: max broj stolova i osnovne pakete (ulaz + piće, stol + boca).
•	Organizer:
•	bira iz „kataloga prostora“ slobodan termin,
•	podešava detalje eventa (naziv, cover, opis, cijena ulaznice, aktiviranje paketa),
•	objavi event u korisničkoj aplikaciji.
•	Matchmaking logika:
•	U bazi: VenueAvailability tablica (datum, vremenski slot, status).
•	Organizer može filtrirati prostore prema: kapacitetu, cijeni najma (ručno uneseni raspon), tipu (klub, bar, kviz, koncert).
•	QR i operativni sloj:
•	Za vlasnika prostora: simple dashboard s listom nadolazećih evenata u njegovom prostoru + broj prodanih karata + broj rezervacija stolova.
•	Ovo je pojednostavljena verzija onoga što TablelistPro radi za centralizirano upravljanje eventima, rezervacijama i stolovima.
Vizija za budućnost (Backlog)
•	Napredni revenue sharing i ugovori:
•	Automatizirani modeli podjele prihoda (rev share), dinamično određivanje cijene najma po danu i sezoni (subota skuplja od srijede).
•	Marketing modul:
•	Jednostavna integracija za plaćene kampanje (Facebook / Instagram Ads) direktno iz Creator Huba.
•	Promocijski kodovi za influencere i studentske udruge, tracking tko je doveo koliko gostiju.
•	Analytics i CRM:
•	Za vlasnika prostora: „tko su mi top organizatori“ + statistika potrošnje publike.
•	Za organizatora: retargeting publike koja je već bila na njihovim eventima (newsletter, push).
________________________________________
2. Dizajn (UI/UX)
Kako izgleda u MVP u
•	Dva jednostavna web dashboarda, isti vizualni jezik:
•	Tabovi na vrhu: „Moji eventi“, „Moj prostor“, „Kalendar“.
•	Za organizatora:
•	veliki gumb „Napravi novi event“ → 3 koraka wizard:
1.	Odaberi prostor i termin,
2.	Postavi cijene (ulaznica + paketi),
3.	Pregled i objava.
•	Za vlasnika prostora:
•	ekran „Moji termini“ – lista slotova (Datum, Status: slobodno / zauzeto, Organisator).
•	Tema „svijeta nadohvat ruke“ za B2B stranu:
•	Karta (Google Maps / OpenStreetMap) s označenim prostorima + filter po gradu; naglasak da se sustav lako širi i na druge gradove i države.
•	U jednoj karti i jednom kalendaru organizator „vidi“ cijeli svoj mogući svijet evenata.
________________________________________
3. Poslovni plan (Biznis & Prezentacija)
Kako kombinacija postaje tržišna prednost
•	Vi niste samo ticketing app; vi ste „operativni OS“ za male organizatore i prostore:
•	Na tržištu već postoje heavy duty alati (TablelistPro, NightPro) koji integriraju ticketing, stolove i CRM za velika noćna mjesta.
•	Vi kombinirate te koncepte u pojednostavljen, freemium alat:
•	free za male studente organizatore i barove,
•	potencijalni premium za veće klubove kasnije.
•	Network efekt B2B2C:
•	Što više prostora u Creator Hubu, to više opcija za organizatore.
•	Što više organizatora koristi Hub, to više evenata za studente u mobilnoj aplikaciji.
•	Time gradite trostrano tržište: studenti ↔ organizatori ↔ vlasnici prostora.
Akvizicija prvih partnera (3 mjeseca)
•	Pilot s jednim prostorom i 2–3 studentske udruge:
•	Praktični case: jedan klub u Zagrebu nudi 2 termina mjesečno „otvoreno studentima“ kroz vaš Creator Hub, a dvije studentske udruge koriste vaš sustav za dogovaranje i prodaju karata.
•	Pitch žiriju:
•	„Naša aplikacija kombinira ono što Discotech, TablelistPro i DoorList rade odvojeno – ali u light, studentskoj verziji. Studenti dobivaju jedan app za otkriti i kupiti cijeli izlazak, organizatori dobivaju besplatan Creator Hub za planiranje evenata, a vlasnici prostora dobivaju jasan pregled termina i prihoda u jednom sučelju.“
 
Za slovo A – Adapt (Prilagodi) predložit ću 2 prijedloga – oba inspirirana globalnim liderima, ali prilagođena vašem MVP u i studentskoj publici.
________________________________________
A1 – Prilagodba Spotify Wrapped modela → „Semester Recap" za studente
Što prilagođavamo:
Spotify Wrapped je jedan od najmoćnijih viralnih engagement alata koji postoji – korisnikovi podaci pretvaraju se u personaliziranu, djeljivu priču koja potiče emocije, lojalnost i masovni organski marketing. Vi adaptirate taj isti mehanizam, ali umjesto glazbe – to su vaši izlasci. Na kraju semestra ili nakon svakog eventa, korisnik dobiva personalizirani „Semester Recap" koji može podijeliti na Instagram i TikTok.ioaglobal+2
1. Programiranje (Tech izvedba)
MVP za 3 mjeseca (trenutna implementacija)
•	Podaci koje već prikupljate (nuspojava arhitekture, ne dodatna tehnika):
o	Broj evenata na kojima je korisnik bio (→ QR scan).
o	Ukupno potrošeno (ulaznice + paketi).
o	Tip evenata (kviz, klub, koncert).
o	Grupe u kojima je bio i s kim.
•	Statički „Recap" generator (jednostavno za MVP):
o	Na kraju semestra (lipanj) backend prolazi kroz podatke i generiše za svakog korisnika JSON s nekoliko ključnih brojki.
o	Frontend rendera gotov screen sa 3–5 fact karata (npr. „Bio si na 8 evenata", „Tvoj najčešći izlazak: srijeda", „Tvoja omiljene noći su u [ime kluba]").
o	Sve što trebate je: zadnji screen u app s gumbom „Podijeli" → Share API koji spremi sliku screena u foto galeriju.
o	Nema AI a, nema ML a – samo agregirani COUNT i SUM upiti u bazi.
•	Tehnički stack:
o	Backend: jednostavni /recap/{user_id} endpoint koji vraća prekalkulirane metrike.
o	Frontend: statični dizajn od 3–5 „story" slajdova s korisnikovim podacima ubačenim dinamički.
o	Share: React Native Share API ili Web Share API.
Vizija za budućnost (Backlog)
•	Dinamična, stvarno personalizirana priča:
o	Segmentacija (npr. „Ti si club rat 🦇 – 80% tvojih noći su techno evenati") sa zabavnim „persona" tipovima kao što Spotify Wrapped ima Sound Town.wikipedia+2
o	Tjedni mini Wrapped („Tvoj tjedan u izlascima") kao retention mehanizam.
•	Viral loop s nagradama:
o	Svaki podijeljeni Recap → jedinstven promo kod koji prijatelja dovede na app → ti dobivaš popust na sljedeću kartu. Spotify Wrapped postiže masovni reach bez plaćenog marketinga – vi gradite isti organski kanal.clipcat+1
________________________________________
2. Dizajn (UI/UX)
Kako izgleda u MVP u
•	Notifikacija u junu: „Tvoj Spring Semester Recap je tu 🎉" → tap otvara app.
•	Vertikalni story format (kao Instagram Stories): korisnik swipe a kroz 4–5 slajdova:
1.	„Proveo si [X] noći na eventima ovog semestra."
2.	„Tvoj klub: [ime lokala]" – s animiranom ikonom.
3.	„Tvoja ekipa: bio si s grupama [N] puta."
4.	„Potrošio si [X] kn/EUR na izlaske."
5.	Zadnji slajd: veliki vaš logo + gumb „Podijeli".
•	Vizualni jezik:
o	Tamna pozadina, neon akcenti (fit za nightlife tematiku).
o	Svaki slajd ima jednu veliku broj/statistiku + kratku copy u jednom redu – čisto, bez gužve.
o	Boja pozadine varira ovisno o „tipu izlazača" (npr. kviz person → plava, club person → ljubičasta).
•	„Svijet nadohvat ruke" u narativu:
o	Zadnji slajd može pokazati kartu s točkicama svih lokacija na kojima je korisnik bio – vizualno prikazuje da je „osvojio" grad, direktno komunicira temu natjecanja.
________________________________________
3. Poslovni plan (Biznis & Prezentacija)
Zašto je ovo moćan USP
•	Organski marketing nula troška:
o	Svaki korisnik koji podijeli Recap na Instagramu/TikToku je živi oglas za vašu aplikaciju. Spotify Wrapped generira milijune organskih postova godišnje bez plaćenog oglašavanja – vaš Recap radi isto na mikroskali.econsultancy+2
o	U studentskoj zajednici Zagreb je mali ekosustav: 10–20 podijeljenih Recapa = cijeli smjer na faksu čuje za aplikaciju.
•	Retention i lojalnost:
o	Korisnici se vraćaju na app više samo da bi skupili bolje podatke za Recap – isti psihološki mehanizam koji Spotify koristi za godišnje zadržavanje korisnika.newsroom.spotify+1
•	Pitch žiriju:
o	„Naša aplikacija ne završava kad korisnik kupi kartu. Na kraju semestra, svaki student dobiva personaliziranu priču svojih noći – koju dijeli i tako postaje naš najboljib promoter. Taj viralnost model kopiran je iz Spotify Wrapped a, a prvi ga je na event tržištu testira Fever s 95%+ upsell stopom."[vizologi]
•	Akvizicija prvih korisnika:
o	Na prezentaciji natjecanja u lipnju živim prikazujete Recap demo za imaginarnog korisnika. To je vizualno atraktivno, emocionalno pogađa žiri i pokazuje da razumijete psihologiju korisnika dublje od samog „prodaj ulaznicu" koncepta.
________________________________________
A2 – Prilagodba Fever algoritma preporuka → jednostavan tag based discovery za Zagreb
Što prilagođavamo:
Fever koristi vlastititi algoritam koji analizira korisnikove interese, lokaciju i povijest da servira hiper personalizirane preporuke evenata u gradu. Keyword pretraga povećala im je ukupan prihod po korisniku za 12%. Vy adaptirate tu logiku – bez skupog ML a, s jednostavnim tag sistemom izvedivim za 3 mjeseca.hyperlocalcloud+3
1. Programiranje (Tech izvedba)
MVP za 3 mjeseca (trenutna implementacija)
•	Onboarding s odabirom interesa (3 koraka):
o	Nakon registracije: „Što te zanima?" → odabir 3–5 tagova: #techno, #kvizovi, #live_glazba, #cajke, #stand_up, #studentska_večer, itd.
o	Organizator pri kreiranju eventa označava iste tagove na eventu.
•	Matching logika (bez ML a):
o	Algoritam: prikaži evente čiji set tagova ima najveći overlap s korisnikovim interesima + prioritiziraj evente koji se bliže vremenski.
o	Implementacija: SELECT events ORDER BY (tag_overlap_count DESC, date ASC) – izvedivo u bilo kojoj relacijskoj bazi.
•	FOMO sloj na kartici eventa (inspiriran Eventbrite + Nudgify modelom):
o	Dinamički tekst ispod naslova eventa: „🔥 47 osoba zainteresirano", „⏳ Ostalo samo 12 ulaznica", „👥 3 tvoja prijatelja idu".
o	Eventbrite + FOMO alati tipa Nudgify dokazuju da real time socijalni dokaz direktno povećava konverziju kupnje.nudgify+2
o	Tehnički: ovo su samo COUNT upiti iz vaše baze (broj prodanih karata, broj korisnika koji „prate" event) – nema kompleksnosti.
•	Pretraga ključnim riječima:
o	Jednostavna full text pretraga po imenu eventa i opisu.
o	Fever je eksperimentima potvrdio da keyword search značajno diže CTR i konverziju.[linkedin]
Vizija za budućnost (Backlog)
•	Prava ML personalizacija:
o	Collaborative filtering: „Korisnici slični tebi išli su na ove evente" – kao što Fever koristi anonimne agregacije za preporuke organizatorima za planiranje novih evenata.techcrunch+1
•	Kontekstualne preporuke:
o	„Večeras je srijeda i pljušti – evo 3 covered eventa u tvojoj blizini."
o	Push notifikacija 2h prije eventa koji odgovara interesima: „Još 30 slobodnih mjesta!"
________________________________________
2. Dizajn (UI/UX)
Kako izgleda u MVP u
•	Onboarding ekran s tagovima:
o	Vizualno: 10–12 tag pilula u grid formatu, korisnik tapne 3–5 koji mu se sviđaju → odmah vidi live preview feeda koji se puni relevantnim eventima.
o	Psihološki efekt: korisnik odmah vidi vrijednost aplikacije, nema praznog ekrana.
•	Feed evenata:
o	Kartica eventa: cover slika (široka, vizualno jaka), ime, datum/sat, lokacija, cijena od – i jedan FOMO badge (samo jedan, da ne zagušuje):
	Crveni: „🔥 Rasprodaje se" (ako je ispod 20% slobodnih ulaznica).
	Zeleni: „👥 Prijatelji idu" (ako ima overlap s kontaktima/grupama).
	Narančasti: „⭐ Preporučeno za tebe" (ako odgovara tagovima).
o	Svaki badge je jasan signal – korisnik skenira feed vizualno, ne treba čitati opise.
•	Keyword search:
o	Permanentna search bar na vrhu (ne skrivena iza ikone) – direktna lekcija iz Fever eksperimenta.[linkedin]
________________________________________
3. Poslovni plan (Biznis & Prezentacija)
Zašto je ovo ključno za žiri i rast
•	Personalizacija = retention:
o	Fever je lost u competition jer rješava paradoks izbora u urbanim sredinama s previše opcija – isti problem postoji i u Zagrebu gdje studenti ne znaju gdje ići.vizologi+1
o	Vi rješavate isti problem: umjesto da student beskrajno skrolla Facebook grupe i Instagram, app mu servira 5 relevantnih prijedloga.
•	Vrijednost za organizatore:
o	Organizator koji pravilno označi event tagovima dobiva bolji organski doseg unutar aplikacije bez plaćanja.
o	To je jak argument za onboarding prvih partnera: „Mi smo besplatni discovery kanal koji šalje pravu publiku."
•	FOMO kao konverzijski alat:
o	Real-time socijalni dokaz (koliko karata ostalo, tko ide) dokazano povećava decision-making speed kod kupovine.prismm+1
o	Za žiri: pokazujete da ne prodajete samo karte – razumijete psihologiju kupnje i gradite sustav koji aktivno pomaže konverziji.
•	Pitch žiriju:
o	„Prilagodili smo Fever ov discovery model i Eventbrite ov FOMO sustav, ali bez skupe ML infrastrukture. U MVP u, naša aplikacija od prvog dana zna što ti se sviđa i tebe direktno upućuje na evente koji su za tebe – dok FOMO signali potiču odluku u sekundi, ne danima."
 
Za slovo M – Modify / Magnify (Modificiraj / Uvećaj) donosim vam 2 prijedloga koji su direktno izvedivi u MVP u.
________________________________________
M1 – Magnify: Uvećaj društveni pritisak → Gamificirani „Nightlife Passport"
Ideja:
Umjesto da app budete samo transakcijski alat (kupi kartu → idi na event → gotovo), uvećate društveni i emotivni sloj dodavanjem gamifikacije: korisnik skuplja „pečate" za evente na kojima je bio, otključava nagrade i gradi vlastiti Nightlife Passport. Istraživanja pokazuju da gamificirani loyalty programi povećavaju engagement korisnika do 47% i da organizacije s gamificiranim sustavima lojalnosti bilježe porast zadržavanja korisnika za 22%. Za Gen Z to nije „dječja igračka" – to je primarni motivacijski jezik.arxiv+2
1. Programiranje (Tech izvedba)
MVP za 3 mjeseca (trenutna implementacija)
•	Passport model u bazi:
o	Svaki korisnik ima UserPassport entitet s tablicom stamps – jedna oznaka = jedan posjećeni event.
o	Stamp se kreira automatski kad se skenira QR kod na ulasku (ista akcija koju već radite za provjeru ulaznice).
o	Nula dodatnog razvoja na ulazu – stamp je nuspojava QR scan akcije.
•	Jednostavna achievement logika (u backendу):
o	Badge sustav – nekoliko ručno definiranih uvjeta (ne kompleksan engine):
	"Novajlija" → 1. event
	"Redovni gost" → 5 evenata
	"Lokalni ekspert" → 3 različita lokala
	"Kviz master" → 3 kviz eventa
	"Noćna ptica" → 10 evenata ukupno
o	Backend: IF (count = threshold) → assign badge – to je doslovno par IF uvjeta.
•	Nagrade u MVP u (bez kompleksnog loyalty engine a):
o	Nakon X stampova, korisnik dobiva promo kod koji mu organizator/vlasnik lokala ručno dodijeli kroz admin panel (npr. „10% popust na sljedeću ulaznicu").
o	Promo kod je jednostavan string u bazi – ne treba platni sustav da ga implementira.
•	Push notifikacija kao okidač:
o	Kad korisnik osvoji badge → push notifikacija: „🏅 Otključao si 'Redovni gost'! Provjeri svoju nagradu."
o	Korisnici koji prime push notifikacije otvaraju aplikaciju prosječno 3x češće od onih koji ih ne primaju.[arxiv]
Vizija za budućnost (Backlog)
•	Leaderboard između prijatelja:
o	„Ti i još 3 prijatelja skupljate Passport – tko će prvi do 10 stampova?" – direktan social pressure.pdfs.semanticscholar+1
•	Dinamičke misije:
o	Tjedne mini challenge misije (npr. „Idi na 2 eventa ovaj tjedan i osvoji dvostruke stampove") – istraživanja pokazuju da personalizirani, vremenski ograničeni izazovi značajno povećavaju razinu završetka zadataka.[arxiv]
•	Partnerski loyalty:
o	Stampovi vrijede i kao „valuta" kod partnerskih lokala – npr. 15 stampova = besplatno piće dobrodošlice pri sljedećem posjetu.
________________________________________
2. Dizajn (UI/UX)
Kako izgleda u MVP u
•	Passport tab u navigaciji (4. tab, pored Home, Tickets, Profile):
o	Vizualni motiv: stilizirana putovnica s koricama u boji vašeg branda.
o	Unutar: rešetka „pečata" – posjećeni eventi imaju cover sličicu lokala, budući su „zamagljeni" siluete.
o	Efekt: korisnik vidi što mu nedostaje do sljedećeg badgea → inherentno motivira povratak u app.
•	Badge ekran:
o	Horizontalni strip na dnu Passport ekrana – zaključani badgevi su sivi i prikazuju uvjet (npr. „🔒 Još 2 eventa").
o	Kad se otključa badge → kratka animacija (confetti ili glow efekt) + push notifikacija.
•	„Svijet nadohvat ruke" u vizualnom narativu:
o	Dugoročna vizija (možete prikazati žiriju kao mockup): Passport ekran prikazuje kartu svijeta gdje su označene sve destinacije (gradovi) gdje korisnik može skupljati pečate – direktno komunicira temu natjecanja i internacionalni potencijal platforme.
________________________________________
3. Poslovni plan (Biznis & Prezentacija)
Zašto je ovo strateški ključno
•	Retention i habit formation:
o	Gamificirani loyalty programi grade naviku: korisnik ne otvara app samo kad kupuje kartu, nego redovito provjerava status svog Passporta.poket+2
o	Retention je najveći izazov za sve aplikacije – Passport ga rješava elegantno i bez visokih troškova.
•	B2B vrijednost za lokale:
o	Vlasnik lokala može vidjeti koliko korisnika ima „Redovni gost" stamp za njihov lokal → to su njihovi top kupci → mogu im slati ciljane ponude.
o	To je primitivni CRM koji mali lokali inače nemaju, a vi ga dajete besplatno kao dio platforme.
•	Pitch žiriju:
o	„Naša aplikacija nagrađuje lojalnost. Svaki izlazak gradi korisnikov Nightlife Passport – digitalnu putovnicu noćnog života. Gamificirani sustavi lojalnosti dokazano povećavaju engagement za 47% i zadržavanje korisnika za 22%. Mi taj model prilagođavamo studentima koji vole skupljati iskustva, a ne samo kupovati karte."strivecloud+1
•	Akvizicija prvih korisnika (3 mjeseca):
o	Launch kampanja: „Prvih 50 korisnika koji osvoje badge 'Noćna ptica' dobivaju besplatnu ulaznicu na X event."
o	Viralni moment: Korisnik dijeli sliku svog Passporta (na Instagramu) → organski marketing bez troška.
________________________________________
M2 – Modify: Zamijeni fiksne cijene ulaznica → transparentni „Early Bird tier" sustav
Ideja:
Umjesto jedne statične cijene ulaznice, modificirate model prodaje uvođenjem transparentnih cijenskih tierova koji nagrađuju rane kupce i stvaraju prirodni FOMO. Ticketmaster koristi demand-based dynamic pricing gdje cijene rastu u realnom vremenu. BoomEvents i slični alati pokazuju da čak i jednostavni time-based i demand-based tierovi – „cijena raste kad se proda X% karata" – maksimiziraju prihod organizatora i potiču ranu kupnju. Ključna razlika od Ticketmastera: vi to radite transparentno i studentski prijateljski, bez skrivenih troškova koji su jedan od glavnih razloga zašto publika mrzi dynamic pricing.boomevents+2
1. Programiranje (Tech izvedba)
MVP za 3 mjeseca (trenutna implementacija)
•	Tier model u bazi:
o	Organizator pri kreiranju eventa definira do 3 tiera:
	Tier 1 (Early Bird): X komada po cijeni A (npr. 5€)
	Tier 2 (Regular): Y komada po cijeni B (npr. 8€)
	Tier 3 (Last Minute): Z komada po cijeni C (npr. 12€)
o	Sustav automatski prelazi na sljedeći tier kada se iscrpe karte trenutnog.
•	Backend logika:
o	SELECT current_tier FROM event_tiers WHERE sold_count < total_count ORDER BY tier_order LIMIT 1 – jedan upit, nema kompleksnosti.
o	Svaka prodaja ulaznice: inkrement sold_count, provjera praga, po potrebi prelaz na sljedeći tier.
•	Transparentni prikaz za kupca:
o	Na stranici eventa vidljivo: „Tier 1: 18/50 prodano | Tier 2 počinje od 50 karata."
o	Ovo je namjerna transparentnost koja gradi povjerenje – suprotno od Ticketmaster modela gdje korisnici ne znaju zašto je cijena skočila.[reddit]
•	Notifikacija o promjeni tiera:
o	Push: „⚡ Early Bird karte za [Event] su rasprodane! Regular tier počinje od sada." → direktni FOMO okidač.
o	Push notifikacije povećavaju conversion rate za eCommerce transakcije ispod 23% prosječno, a segmentirane poruke dižu open rate za više od 50%.[xtremepush]
Vizija za budućnost (Backlog)
•	Prava dinamična cijena u realnom vremenu:
o	Inspiriran Ticketmaster algoritmom: cijena se automatski prilagođava na temelju brzine prodaje, dana u tjednu i prethodnih evenata istog organizatora/lokala.[pricefx]
•	Last-minute flash sale:
o	2h prije eventa: ako ima neprodanih karata, sustav automatski šalje push s popustom ciljanoj grupi korisnika (koji su pratili event ali nisu kupili) – demand-based discount umjesto demand-based surge.thepercentage+1
________________________________________
2. Dizajn (UI/UX)
Kako izgleda u MVP u
•	Progress bar na stranici eventa:
o	Vizualna traka: [████████░░] 80% Early Bird prodano – jedan pogled, jasna hitnost.
o	Ispod trake: trenutna cijena bold, velika + mala bijela napomena: „Sljedeći tier: 8€ (za 10 karata)."
•	Tier badges na listi evenata:
o	Na kartici eventa u feedu: mali zeleni badge „🟢 Early Bird dostupno" ili narančasti „🟠 Zadnji tier!".
o	Korisnik skrolla feed i odmah skenira – bez ulaska u event detalje zna je li vrijedno djelovati sada.
•	Checkout flow:
o	Korisnik dodaje u košaricu → vidljiva poruka u checkoutu: „Kupuješ po Early Bird cijeni. Spremi 3€ vs. Regular tiera."
o	To je pozitivan framing koji nagrađuje odluku umjesto da kažnjava neodlučnost.
•	„Svijet nadohvat ruke":
o	Cijeli tier sustav komunicira da je app alat koji radi za korisnika: nagrađuje brze i informirane – što je direktna metafora za temu natjecanja.
________________________________________
3. Poslovni plan (Biznis & Prezentacija)
Zašto je ovo win-win-win
•	Za organizatora: Early Bird tier potiče ranu prodaju → bolji cash flow i predvidljivost posjete, dok Last Minute tier maksimizira prihod.[boomevents]
•	Za korisnika/studenta: transparentna cijena nagrađuje planiranje i ranodolaznost umjesto kažnjavanja. Studenti imaju ograničen budžet – ovo im daje osjećaj kontrole i pameti.
•	Za platformu: viša prosječna vrijednost po eventu = veći prihod od transakcijske provizije (vaš model % po ulaznici).
•	Pitch žiriju:
o	„Ticketmaster zarađuje na dinamičnom cijenama ali korisnici ga mrze jer je netransparentan. Mi modificiramo taj isti mehanizam u studentski prijateljan tier sustav: rano kupuješ, manje plaćaš, i uvijek znaš što te čeka. Transparentni FOMO koji gradi povjerenje umjesto frustracije – to je naša prednost."pricefx+2
•	Akvizicija prvih korisnika (3 mjeseca):
o	Na prvom partnerskom eventu: Early Bird tier ekskluzivno dostupan samo kroz vašu aplikaciju → korisnici koji bi inače kupili na licu mjesta sada trebaju preuzeti app da dobiju bolju cijenu.
o	Ovo je klasični app-exclusive deal acquisition hack koji koriste gotovo sve velike platforme.
 
Za slovo P – Put to Other Uses (Stavi u drugu upotrebu) donosim 2 prijedloga koji isti sustav i iste podatke stavljaju u potpuno novu upotrebu – bez dodatnog razvoja od nule.
________________________________________
P1 – Isti podaci, nova upotreba: „Venue Intelligence" dashboard za lokale i organizatore
Ideja:
Svaki QR scan, svaka prodana karta, svaki rezervirani stol i svaki kupljeni paket u vašoj aplikaciji generira vrijedne podatke. Ti podaci su nusprodukt koji već postoji u vašoj bazi – pitanje je samo stavite li ih u novu upotrebu. TicketFairy i vodeći noćni klubovi danas koriste attendee analytics (demografija, dolasci, potrošnja, vrijeme ulaska) da optimiziraju osoblje, glazbu, promotivne strategije i marketing. Vivenu i AdmitONE već nude analytics kao ključni B2B prodajni argument platformi. Vi to radite za malu scenu – lokale i indie organizatore koji inače nemaju pristup nikakvim podacima.vivenu+2
1. Programiranje (Tech izvedba)
MVP za 3 mjeseca (trenutna implementacija)
•	Podaci koje već imate (nula dodatnog prikupljanja):
o	Broj prodanih karata po eventu i tieru.
o	Broj skeniranih QR kodova + vremenska oznaka (kad su ušli).
o	Broj rezerviranih stolova i paketa.
o	Ukupni prihod po eventu.
•	Jednostavan analytics ekran u Creator Hubu (za organizatore i vlasnike prostora):
o	4–5 KPI kartica na vrhu: „Ukupno prodano", „Prihod", „Popunjenost (%)", „Peak ulazak (sat)".
o	Jedan linijski grafikon: prodaja karata po danu (0–7 dana prije eventa) → vidljivo kad je Early Bird bio aktivan.
o	Jedna bar lista: „Top tier po prihodu".
o	Sve ovo su agregirani COUNT i SUM upiti – nema kompleksne analitike, samo prezentacija podataka koje već imate.
•	Za vlasnika prostora – poseban uvid:
o	„Koji organizatori su doveli najviše gostiju u moj prostor?" → jednostavni JOIN upit između evenata, organizatora i prodanih karata.
o	TicketFairy potvrđuje da lokali koji imaju uvid u tko su im top kupci mogu pokrenuti ciljane follow-up kampanje i dramatično poboljšati retention.[ticketfairy]
•	Export funkcionalnost:
o	Jedan gumb: „Preuzmi CSV" → organizator može uzeti podatke i dalje ih koristiti za vlastiti marketing.
Vizija za budućnost (Backlog)
•	Real-time dashboard:
o	Uživo prikaz toka gostiju za večer eventa: koliko je ušlo, koliko paketa iskorišteno, koliko stolova slobodno – kao što napredni klubovi koriste IoT i POS integracije za real-time operativne odluke.[ticketfairy]
•	Predictive insights:
o	„Na temelju prethodnih evenata, očekujemo X gostiju u subotu" – prediktivna analitika za planiranje osoblja i zaliha, inspirirana AI pristupima koje opisuje istraživanje transformativne uloge AI u event menadžmentu.[pdfs.semanticscholar]
•	Benchmark usporedba:
o	„Vaš event ima 15% bolju popunjenost od prosijeka za sličan tip eventa u vašoj kategoriji." – anonimizirana komparativna analitika među svim eventima na platformi.
________________________________________
2. Dizajn (UI/UX)
Kako izgleda u MVP u
•	Odvojeni tab „Statistike" u Creator Hubu, dostupan samo organizatoru/vlasniku:
o	Čist, minimalan layout: bijela pozadina, accent boja branda, 4 velike KPI kartice u redu na vrhu.
o	Ispod: jedan grafikon prodaje po danima (line chart, lagana krivulja, ne glomazna tablica).
o	Zatim: lista evenata s quick stats (📅 datum, 🎟️ prodano/kapacitet, 💶 prihod).
•	Mobile-first, ali i desktop:
o	Organizatori planiraju evente na laptopu → dashboard treba biti ugodan i na desktopu, ne samo na mobitelu.
•	„Svijet nadohvat ruke" za B2B stranu:
o	Vlasniku lokala cijeli njegov poslovni noćni svijet – prihodi, gosti, statistike – dostupan u jednom dashboardu, s bilo kojeg uređaja, u realnom vremenu. To je direktna interpretacija teme natjecanja za B2B korisnika.
________________________________________
3. Poslovni plan (Biznis & Prezentacija)
Zašto je ovo moćan argument za B2B onboarding
•	Vrijednost za lokale:
o	Mali barovi i klubovi u Zagrebu nemaju nikakav analytics alat. Njihov jedini uvid su ručno prebrojane karte na ulazu i osjećaj barmena. Vi im nudite besplatan, jednostavan uvid koji im pomaže poslovati bolje – i to je jak razlog da se prijave na platformu.
o	Studija TicketFairy pokazuje da klubovi koji koriste attendee analytics povećavaju retention gostiju i optimiziraju marketing kampanje, izbjegavajući uobičajene promotivne zamke.[ticketfairy]
•	Novi prihodni model (future):
o	Osnovni analytics besplatno → napredniji izvještaji (demographics breakdown, weekly trends) za pretplatu (SaaS model za lokale) → drugi revenue stream uz transakcijsku proviziju.
•	Pitch žiriju:
o	„Naša aplikacija nije samo prodaja karata. Svaki event generira vrijedne podatke koje stavljamo u novu upotrebu: vlasnici lokala i organizatori dobivaju besplatan analytics dashboard koji im govori što funkcionira, kad gosti dolaze i koji paketi donose najviše prihoda. To je alat kakav mali lokali do sada nisu imali – a mi ga dajemo kao dio platforme."pdfs.semanticscholar+2
•	Akvizicija prvih partnera:
o	Demonstrirate dashboard vlasniku lokala s fiktivnim ali realističnim podacima → reakcija je gotovo uvijek: „Ovo nam treba." → lako zatvaranje prvog B2B partnera.
________________________________________
P2 – Ista platforma, nova upotreba: kanal za brand aktivacije prema studentima
Ideja:
Vaša baza korisnika (studenti i mladi) je najtraženiji demografski segment za brendove poput Heinekena, Red Bulla, H&M-a, Revoluta, Glova i sličnih. Brendovi danas troše milijune na kampus aktivacije jer studenti grade lojalnost prema brendovima koje „otkriju" za studija. Vi imate nešto što oni žele: direktan, povjerljiv kanal do studenata u momentu izlaska – jednog od najemocionalnih i najreceptivnih trenutaka. Platforme poput Eventcube i white-label rješenja već pokazuju da ticketing infrastruktura može biti B2B produkt koji se prodaje brendovima i organizatorima.eventcube+5
1. Programiranje (Tech izvedba)
MVP za 3 mjeseca (trenutna implementacija)
•	Sponzorirani event slot u feedu:
o	U feed evenata dodajete mogućnost „Sponzorirani event" – vizualno označen malim badge-om (npr. „Sponzorirano by [brand]").
o	Tehnički: event kartica dobiva is_sponsored flag i sponsor_name / sponsor_logo polje u bazi. Nema posebne logike – samo prikazujete badge.
•	Branded paketi:
o	Organizator/lokal može kreirati paket tipa: „Red Bull Welcome Pack – ulaz + 2 Red Bulla po promotivnoj cijeni."
o	Tehnički: paket je isti model koji već imate (iz SCAMPER S2 prijedloga) – samo s dodanim sponsor_id poljem.
•	Promo kod distribucija kroz app:
o	Brend daje vama promo kodove (npr. „REVOLUT10 – 10% popust") → vi ih ubacite u admin panel → korisnici ih vide na profilu eventa kao „Posebna ponuda od [Brend]".
o	Nema nikakve API integracije s brendom – to je čisti sadržaj koji ručno unosite.
•	Analytics za sponzora:
o	Sponzoru šaljete jednostavan PDF/CSV izvještaj: koliko korisnika je vidjelo sponzorirani event, koliko karata prodano, koliko paketa s brendiranim pićem prodano.
Vizija za budućnost (Backlog)
•	Self-serve brand portal:
o	Brendovi se sami prijavljuju, kreiraju kampanje, uploadaju materijale i vide dashborad s rezultatima – kao što campus brand activation agencije tipa Elev8 i Campus Solutions nude organiziranim brendovima.elev8+1
•	Micro-influencer mreža unutar app-a:
o	Korisnici s visokim Passport scorom (iz M1 prijedloga) postaju „Campus Ambasadori" koji dobivaju ekskluzivne benefite od brendova u zamjenu za organsko dijeljenje – model sličan NIL (Name, Image, Likeness) programima koji brendovima nude autentičan doseg do studentskih zajednica.[pdfs.semanticscholar]
•	Targeted push notifikacije za brendove:
o	„Svi korisnici koji su bili na techno eventu u zadnja 30 dana" → Red Bull push kampanja. Segmentacija koja nije dostupna ni na jednom drugom kanalu za lokalne brendove.
________________________________________
2. Dizajn (UI/UX)
Kako izgleda u MVP u
•	Sponzorirani event u feedu:
o	Vizualno identičan ostalim karticama – isti layout, iste proporcije.
o	Jedina razlika: mala etiketa u gornjem desnom kutu kartice: „⭐ Sponzorirano" + logo brenda (mali, ne dominantan).
o	Cilj: native advertising pristup – ne smeta korisniku, ali je vidljivo i pošteno.[elev8]
•	Branded paket na event ekranu:
o	Jedan od paketa u listi ima brend ikonicu (npr. Red Bull „krilca" ili Heineken zvijezda) + kratki tag „Red Bull Night Pack".
o	Vizualno se ističe kao premium opcija, ali ne remeti čistoću ostatka ekrana.
•	„Posebne ponude" sekcija na Home screenu:
o	Horizontalni strip (scroll lijevo/desno) s aktivnim brand ponudama: „Red Bull promo na Techno Fridays", „10% popust s Revolut karticom".
o	Brzi vizualni pregled, korisnik može ignorirati – ne blokira glavni feed.
________________________________________
3. Poslovni plan (Biznis & Prezentacija)
Zašto je ovo strateški ključno za natjecanje
•	Treći revenue stream uz proviziju i SaaS:
o	Transakcijska provizija (% po karti) → kratkoročno.
o	SaaS analytics za lokale → srednjoročno.
o	Sponzorstvo i brand aktivacije → već u MVP fazi, jer ne zahtijeva tehničku složenost – samo dogovor s brendom i unos sadržaja.
•	Brendovi koji targetiraju studente u Hrvatskoj:
o	Red Bull (prisutan na svim studentskim eventima), Heineken, lokalni pivovari, Revolut/Wise (fintech za studente), Glovo, Bolt, lokalne odjevne i lifestyle marke.
o	Inicijalni razgovori ne zahtijevaju formalne ugovore – pilot sponzorstvo može biti i barter (brend daje proizvode, vi dajete vidljivost).
•	Pitch žiriju:
o	„Naša platforma nije samo event app – ona je targetirani marketing kanal prema studentima u momentu izlaska. Brendovi koji žele dosegnuti Gen Z tope potencijalne potrošače sada to mogu napraviti precizno, mjerljivo i kroz kontekst koji studenti sami biraju. Campus brand activation je industrija vrijedna stotine milijuna godišnje – mi ulazimo u nju s platformom koja je već tu, već ima korisničku bazu i već mjeri rezultate."slec.osu+2
•	Akvizicija prvih korisnika (3 mjeseca):
o	Pristupite lokalnom Red Bull studentskom timu ili lokalnoj pivovari s konkretnom ponudom: „Stavite vas brend na [X] evenata sljedećih 3 tjedna, prikazujemo vas [Y] studentima, dobivate izvještaj."
o	Barter deal (bez novca) u MVP fazi → brendovi su dobili vidljivost, vi ste dobili socialni dokaz i naziv brenda na prezentaciji natjecanju.
 
E1 – Eliminiraj: Obaveznu registraciju prije kupnje ulaznice
Ideja:
Jedan od najvećih ubojica konverzije u ticketing i event aplikacijama je zid registracije – korisnik želi kupiti kartu, ali mora prvo napraviti račun, verificirati email, postaviti lozinku... i ode. Istraživanja pokazuju da registracijski procesi koji traju više od 20 sekundi dramatično povećavaju abandon rate. EventCombo i vodeće platforme preporučuju: strip formu na apsolutni minimum (samo email), ponudi one-click sign-on i nikad ne traži više podataka nego što trebaš upravo sada. Vi to eliminirate na razinu „guest checkout" modela.
1. Programiranje (Tech izvedba)
MVP za 3 mjeseca (trenutna implementacija)
•	Tri načina kupnje – bez ijednog koji traje više od 30 sekundi:
1.	Google / Apple Sign-In (jedan tap) → automatski kreira account u pozadini, korisnik to ni ne primijeti.
2.	Email magic link → korisnik unese samo email → dobije link → tap → unutra je i karta je kupljena. Nema lozinke, nema verifikacije, nema forme.
3.	Guest checkout → unese email + ime → kupi → karta stiže na email. Možeš ga naknadno pitati da napravi pravi account.
•	QR karta funkcionira i bez accounta:
•	QR kod dolazi emailom i radi neovisno o tome ima li korisnik registriran profil – to je ključno za povjerenje.
•	Organizator skenira kod → validan. Gotovo.
•	Progressive profiling (lean startup princip):
•	Ne traži SVE odjednom. Nakon prvog eventa: „Dodaj ime i prezime za brži checkout sljedeći put." Nakon drugog: „Izaberi interese za personalizirane preporuke."
•	Svaki korak ima jasnu vrijednost za korisnika – ne samo za vas.
•	Tehnički stack:
•	Google Sign-In SDK + Apple Sign-In SDK (standardni, dobro dokumentirani, besplatni).
•	Magic link: generirate JWT token s expiry od 15 min, šaljete emailom, korisnik klikne → autentificiran. Nema posebnih servisa – to je 20-ak linija backend koda.
Vizija za budućnost (Backlog)
•	Biometrijska autentifikacija:
•	Face ID / Touch ID za povratnike – još brži checkout, nula tipkanja.
•	Wallet integracija:
•	Apple Wallet / Google Wallet: karta se direktno sprema, ne treba ni otvarati app na ulasku – samo privuci mobitel prema čitaču.
________________________________________
2. Dizajn (UI/UX)
Kako izgleda u MVP u
•	Kupnja ulaznice iz perspektive korisnika (cijeli flow):
1.	Otvori app / web → vidi event → tap „Kupi"
2.	Odaberi paket → tap „Nastavi"
3.	Jedan ekran: dva velika gumba: G [Google] i 🍎 [Apple] + ispod sitno: „Nastavi kao gost (email)"
4.	Platni screen (Stripe) → potvrdi
5.	✅ „Karta je tvoja! Provjerite email."
•	Ukupno: 4–5 tapova. Manje od 45 sekundi.
•	Nema stranice „Moj profil" kao prva destinacija:
•	Ne tjeraj korisnika da odmah popunjava profil. Profil je dostupan, ali nije u putu prema kupnji.
•	„Svijet nadohvat ruke" kroz UX:
•	Svaki ekran ima jedan primarni gumb i maksimalno jedan sekundarni. Nema navigacijskih labirinta. Korisnik nikad ne treba razmišljati koji gumb pritisnuti – to je definicija „na dohvat ruke".
•	Onboarding kao „aha!" moment:
•	Prva stvar koju korisnik vidi nije login screen nego feed evenata. Tek kad tapne „Kupi" – tada se traži autentifikacija. Ovo je model koji koriste najuspješnije consumer aplikacije: pokaži vrijednost prije nego što tražiš išta zauzvrat.
________________________________________
3. Poslovni plan (Biznis & Prezentacija)
Zašto je ovo kritična prednost
•	Direktna veza s konverzijom = direktna veza s prihodom:
•	Svaki korisnik koji odustane zbog registracije je izgubljena provizija za vas i izgubljena prodaja za organizatora. Eliminating friction = eliminating revenue leak.
•	Brže onboarding iskustvo direktno korelira s višim stopama završetka kupnje i dugoročnom lojalnosti korisnika.
•	USP prema konkurentima:
•	Eventbrite i slične platforme i dalje imaju višestepeni registracijski tok. Vi ste brži od svakog od njih jer idete na „od nule do karte za manje od minute" kao temeljni obećani UX.
•	Pitch žiriju:
•	„Naši konkurenti stavljaju zid registracije između studenta i njegove karte. Mi smo ga eliminirali. Jedan tap s Google računom – koji student već ima otvoren – i karta je kupljena. U ticketing industriji, svaka sekunda trenja znači izgubljenu prodaju. Mi smo taj trenje uklonili."
•	Akvizicija prvih korisnika (3 mjeseca):
•	Nema barijere = viši word-of-mouth. Kad student kaže prijatelju „kupio sam kartu za 30 sekundi", taj prijatelj preuzima app.
•	Na demo eventu: pokažete live pred žirijem koliko sekundi traje kupnja. To je nezaboravni pitch moment.
________________________________________
E2 – Eliminiraj: Fizičku ulaznicu i ručnu provjeru na ulazu
Ideja:
Eliminiramo papirnatih ulaznica, PDF printanja i ručnog unakrsnog provjeravanja s listama – sve što usporava ulaz i stvara gužve. Uz to, eliminiramo i potrebu za skupim dedicated hardware čitačima. Frictionless ticketing literatura i Ticket-Vision dokumentacija jasno pokazuju da je QR-based ulaz koji radi na bilo kojem pametnom telefonu organizatora optimalni balans sigurnosti i jednostavnosti za small-to-mid evente.
1. Programiranje (Tech izvedba)
MVP za 3 mjeseca (trenutna implementacija)
•	Korisnik: karta je QR kod unutar aplikacije (ili u emailu ako je guest checkout). Nema PDF-a koji treba printati. Nema screenshota koji se može dijeliti – svaki QR nosi jedinstveni ticket_id vezan za user_id.
•	Organizator / volonter na ulazu:
•	Preuzme vašu companion app za skeniranje (zasebna minimalna PWA ili native screen u istoj aplikaciji, zaključan za ulogu door_staff).
•	Otvori kameru → skenira QR → zeleno (✅ Ulaz potvrđen) ili crveno (❌ Već skeniran / Nevažeći).
•	Nema liste, nema papira, nema laptopa na ulazu.
•	Anti-screenshot zaštita (jednostavna MVP verzija):
•	QR kod prikazuje timestamp posljednjeg osvježavanja (u tekstu ispod koda). Organizator vidi „QR osvježen prije 5 sek" = validan. Stari screenshot nema live timestamp.
•	Napredna rotacija (kao DoorList) ide u backlog.
•	Backend:
•	Endpoint: POST /tickets/{id}/scan → provjeri status, postavi scanned_at = NOW(), vrati valid/invalid. Idempotent – drugi scan uvijek vraća already_scanned.
Vizija za budućnost (Backlog)
•	NFC ulaz – korisnik samo prisloni mobitel bez obraćanja pozornosti na ekran.
•	Automatska kapija integracija za veće festivale i dvorane s fizičkim turnstile čitačima.
•	Rotating QR (JWT s expiry od 30 sekundi) za evente s višim rizikom prevarim.
________________________________________
2. Dizajn (UI/UX)
Kako izgleda u MVP u
•	Korisnički wallet screen:
•	Tab „Moje karte": lista nadolazećih evenata, tapneš → otvori se full-screen QR kod s velikim zelenim rubom i nazivom eventa ispod. Nema ničeg drugog na ekranu – organizatoru treba 1 sekunda da skenira.
•	Timestamp: sitnim slovima ispod QR-a „Osvježeno: upravo sad" – daje osjećaj live validnosti.
•	Organizatorov scan screen:
•	Maksimalno minimalan: kamera zauzima 80% ekrana, mala ikona svjetiljke za tamne prostore, ispod feedback zona.
•	Nakon scana: puni ekran mijenja boju – zelena s imenom gosta ili crvena s porukom greške. Nema sitnog teksta koji treba čitati.
•	„Svijet nadohvat ruke" narativ:
•	Cijeli ulazak u event je u džepu: korisnik ne nosi ništa fizičko, ne treba printati ništa, ne treba čekati na email s PDF-om. Mobitel = karta = jedini potrebni predmet.
________________________________________
3. Poslovni plan (Biznis & Prezentacija)
Zašto je ovo važno i za B2B i za B2C
•	Za organizatore:
•	Eliminacija fizičkih karata znači eliminaciju troškova tiskanja, manipulacije gotovinom na blagajni i rizika od krivotvorenja. Za male studentske organizatore to je 100% ušteda operativnog stresa.
•	Za vlasnike prostora:
•	Skeniranje ulaznica na mobitelu znači da ne trebaju kupovati dedicated hardware. Jedini uvjet: pametni telefon s kamerom – što svaki volonter već ima.
•	Ekološka komponenta (bonus za žiri):
•	„Naša platforma je 100% paperless. Nula tiskanih ulaznica, nula fizičkog otpada. U svijetu gdje se Gen Z bori za ekologiju, to nije marginalna napomena – to je vrijednost."
•	Pitch žiriju:
•	„Eliminirali smo sve što usporava ulaz na event: nema printanja, nema lista, nema skupih čitača. Jedna kamera na mobitelu volontera i cijeli sustav radi. To znači da naš sustav može koristiti svaki mali organizator od prvog dana, bez ulaganja u hardware i bez tehničke podrške."
•	Akvizicija (3 mjeseca):
•	Ova eliminacija je ključan sales argument prema prvim partnerima: „Sve što trebate je mobitel." Nema prepreke za onboarding ni jednog kluba ili organizatora.
 
R1 – Reverse: Obrni tko koga traži → „Event traži tebe, ne ti event"
Ideja:
Klasičan model je: korisnik otvori app → skrolla → traži što mu odgovara → kupi. Okrenimo to: korisnik jednom postavi što voli i koliko ima za potrošiti → app automatski mu servira event prijedloge → jednim tapom potvrdi interes → organizator vidi „X studenata zainteresirano za techno event u petak" → tek tada objavi i popuni event. Umjesto ponude koja traži potražnju, potražnja vodi ponudu. Ovo je „demand-first" model – varijacija principa koji su koristili Groupon i crowdfunding platforme, a koji event industrija još nije primijenila na nightlife nišu.
1. Programiranje (Tech izvedba)
MVP za 3 mjeseca (trenutna implementacija)
•	„Wish list" feature – minimalna implementacija:
•	Korisnik na svom profilu postavlja do 5 „wish tagova": npr. #techno, #kviz, #stand_up, #cajke, #open_air.
•	Može opcijski dodati: preferirani dan u tjednu (petak/subota) i price cap (npr. „do 10€").
•	Tehnički: ovo je samo proširenje UserPreferences tablice s 3 polja. Nema algoritma, nema ML-a.
•	Dashboard za organizatora – sekcija „Demand Signal":
•	Organizator pri kreiranju eventa ili u Creator Hubu vidi: „47 korisnika u vašoj kategoriji (#techno, petak) još nema event za sljedeće 2 tjedna."
•	To je jedan COUNT upit: SELECT COUNT(*) FROM user_preferences WHERE tag IN (event.tags) AND available_day = event.day AND price_cap >= event.price.
•	Organizator dobiva konkretnu informaciju kolika je potencijalna publika prije nego što objavi event.
•	„Notify me" button na wish listu:
•	Kad organizator objavi event koji odgovara korisnikovim tagovima → automatska push notifikacija: „🎉 Event koji si čekao je tu! Techno petak u [Klub] – 8€."
•	Korisnik ne mora ništa tražiti. Event je našao njega.
•	Zatvori loop – „Interest meter" na event stranici:
•	Vidljivo svim korisnicima: „🔥 38 ljudi s ovim interesima je primilo obavijest o ovom eventu."
•	To je FOMO dokaz u realnom vremenu koji nastaje kao nusprodukt demand signala, bez ikakvog dodatnog razvoja.
Vizija za budućnost (Backlog)
•	Pravi „demand-driven" event model:
•	Studenti glasaju za event koji žele (npr. „Hoćeš Afro Beat večer u listopadu?"), i kad glasanje prijeđe threshold (npr. 100 glasova) → organizatori dobivaju alert da postoji garantirana publika.
•	Slično Kickstarter modelu, ali za izlaske: event se „crowdfunda" interesom publike, ne novcem.
•	Predictive event kalendar za organizatore:
•	Na temelju akumuliranih demand signala kroz tjedne/mjesece, platforma organizatoru predlaže optimalne termine i teme: „Subota 15. travnja ima 3x više interes signala od uobičajenog."
________________________________________
2. Dizajn (UI/UX)
Kako izgleda u MVP u
•	Onboarding redizajn – počni s „Čime ću te iznenaditi?":
•	Umjesto praznog feeda pri prvom otvaranju: ekran s pitanjem „Što te zanima kad izlaziš?" → korisnik bira 3–5 tagova (kao u A2 prijedlogu) + jedan optional slider: „Budget po izlasku: 5€ – 20€+".
•	Taj ekran se ne može preskočiti bez odabira barem jednog taga – tako gradite demand signal bazu od prvog dana.
•	„Za tebe" tab kao default home screen:
•	Umjesto da je default „svi eventi" feed (kao kod svih konkurenata), vaš default je personalizirani feed koji prikazuje samo evente koji odgovaraju korisnikovim tagovima.
•	Osjećaj: app te već poznaje. Odmah. Bez traženja.
•	„Svi eventi" je dostupan kao drugi tab za istraživanje.
•	Wish List ekran (profil sekcija):
•	Vizualno: vaša „nightlife wish lista" s aktivnim tagovima i toggleom za svaki dan u tjednu.
•	Korisnik vidi i koliko drugih ima isti wish tag: „🏷️ #techno – 142 korisnika u tvojoj kategoriji."
•	To stvara osjećaj zajednice i potvrde – „nisam jedini koji to želi."
________________________________________
3. Poslovni plan (Biznis & Prezentacija)
Zašto je obrtanje modela strateška prednost
•	Rješava cold-start problem s druge strane:
•	U S1 prijedlogu riješili smo cold-start za sadržaj (meta-agregacija evenata). Ovdje ga rješavamo za organizatore: umjesto da ih uvjeravate da kreiraju evente na platformi bez garancije publike, sada im pokazujete konkretan demand koji ih čeka. To je najjači B2B prodajni argument koji postoji.
•	Podaci kao konkurentska zaštita (moat):
•	Akumulirani demand signali korisnika su jedinstven dataset koji nitko drugi nema. Što više korisnika, to bolji signali, to privlačniji organizatorima, to više evenata, to više korisnika – klasični flywheel efekt.
•	Pitch žiriju:
•	„Okrenuli smo cijeli model event discovery-ja naopako. Ne čekamo da studenti traže evente – mi organizatorima donosimo garantiranu publiku i onda oni kreiraju event. To je world-first demand-driven nightlife model, i jedino je izvedivo jer imamo direktan, povjerljiv kanal do studentske publike."
•	Akvizicija prvih korisnika (3 mjeseca):
•	Pitch prvim organizatorima: „Kreirajte event na našoj platformi i vidjet ćete koliko studenata vas čeka PRIJE nego objavite." – nema rizika za njih.
•	Korisnicima: „Reci nam što voliš i mi ćemo ti naći event. Nikad više beskonačno skrolanje."
________________________________________
R2 – Rearrange: Presloži redoslijed – post-event iskustvo stavi NA POČETAK korisničkog puta
Ideja:
Klasični app lifecycle je linearni: Otkrij → Kupi → Idi → Zaboravi. Korisnik ode s eventa i app gubi relevantnost do sljedećeg puta. Preuredimo redoslijed tako da post-event iskustvo bude najvidljiviji i najvirusniji dio aplikacije – i da direktno vodi nove korisnike natrag na početak ciklusa. Inspiracija: Untappd ima između 8 i 9 milijuna korisnika i gotovo milijardu zabilježenih check-ina upravo jer je „ono što si doživio" učinio vidljivim, djeljivim i gamificiranim – i to je ono što vuče nove korisnike da se registriraju. Dryfta i Bitly event strategije potvrđuju da post-event engagement pretvaraja posjetitelje u promotere.
1. Programiranje (Tech izvedba)
MVP za 3 mjeseca (trenutna implementacija)
•	Check-in moment pri skeniranju QR koda:
•	Kad se QR skenira na ulazu → korisnik dobiva push: „Uživaj! 📸 Ostavi kratku reakciju poslije."
•	Nakon 2h (ili ručno u app): jednostavan post-event ekran s 3 elementa:
1.	Ocjena noći (1–5 zvjezdica, jedan tap).
2.	Mood tag (jedan od 5–6 predefiniranih: „🔥 Epska noć", „🎶 Glazba bila odlična", „🍻 Super ekipa", „😴 Razočaravajuće").
3.	Opcionalna kratka bilješka (max 100 znakova, poput tweeta).
•	Tehnički: EventReview entitet u bazi – user_id, event_id, rating, mood_tag, note, created_at. Petnaestak linija modela.
•	„Live vibe" na event stranici:
•	Za eventi koji se odvijaju ili su nedavno završili: vidljivo agregirana ocjena i dominantni mood tag u realnom vremenu.
•	Primjer: „🔥 Techno Friday – prosječna ocjena: 4.7 ⭐ | Prevladava vibe: 🔥 Epska noć."
•	Ovo je jedan AVG upit i jedan COUNT GROUP BY upit – minimalna kompleksnost.
•	Post-event sadržaj kao akvizicijski alat:
•	Svaki korisnikov review generira shareable card (kao Spotify Wrapped story slajd iz A1):
„Proveo sam epsku noć na [Event] 🔥 – ocjena 5/5. [App link]"
•	Korisnik to dijeli na Instagramu/WhatsAppu → prijatelji koji nemaju app vide review → kliknu link → landing page s eventom i gumbom „Preuzmi app i vidi što propuštaš."
•	Checkout completion raste do 75% kad je korisnik doveden kroz socijalni dokaz umjesto hladnog oglasa.
•	Feedback loop za organizatora:
•	U Creator Hubu: nakon eventa, organizator vidi agregirane ocjene i mood tagove. Ako je prosječna ocjena <3.5 → automatska sugestija: „Korisnici su označili 'Zvuk bio loš' – razmislite o audio pripremi."
Vizija za budućnost (Backlog)
•	UGC (User Generated Content) galerija:
•	Korisnici opcijski mogu uploadati fotografije s eventa → vidljive u app galereji eventa → živi dokaz o atmosferi koji organički privlači nove korisnike.
•	Community reviews s trust scorom:
•	Korisnici koji su više puta ocjenjivali dobivaju „Verified Regular" badge – njihove ocjene imaju veći display weight, slično Untappd trust modelu.
•	Organizer reputation score:
•	Agregat svih ocjena svih evenata jednog organizatora → vidljiv na njihovom profilu → tržišna diferencijacija između pouzdanih i nesigurnih organizatora.
________________________________________
2. Dizajn (UI/UX)
Kako izgleda u MVP u
•	Home screen redizajn – „Što se sinoć zbivalo":
•	Umjesto da je home screen samo predstojeći eventi, gornji dio prikazuje recentne recensije kao live stories:
•	„🔥 Techno Friday @ Klub X – 4.8⭐ sinoć" (s mood tagom i brojem reviews).
•	„😴 Quiz Night @ Bar Y – 3.1⭐ prošli četvrtak."
•	Korisnik vidi živi puls grada – što je bilo dobro, što nije – i taj FOMO („ovo sam propustio!") tjera ga da kupi kartu za sljedeći tjedan.
•	Post-event ekran – brutalno jednostavan:
•	Pojavi se 2h po završetku eventa (ili odmah po skeniranju): puni ekran, tamna pozadina, naziv eventa gore.
•	U sredini: 5 zvjezdica (tap za odabir).
•	Ispod: 6 mood tag pilula (tap jednu).
•	Dno: mali text field „Dodaj bilješku (opcionalno)" + gumb „Objavi".
•	Nema scrollanja, nema odlučivanja – 3 tapa i gotovo.
•	„Svijet nadohvat ruke" narativ kroz cijeli lifecycle:
•	Redoslijed korisničkog puta sada je krug, ne linija:
→ Vidiš review tuđe epske noći → Kupiš kartu → Ideš → Ostaviš review → Tvoj review vidi novi korisnik →
•	App je relevantna i PRIJE i ZA VRIJEME i POSLIJE eventa. Nikad nema mrtve točke u korisničkom iskustvu.
________________________________________
3. Poslovni plan (Biznis & Prezentacija)
Zašto preraspoređivanje lifecycle-a mijenja sve
•	Review sustav = besplatan trust engine:
•	Jedan od najvećih izazova novih platformi je izgradnja povjerenja. Reviews i ocjene su najjeftiniji i najefikasniji način da novi korisnik odmah vidi da platforma i eventi koje nudi vrijede.
•	Untappd je izgradio zajednicu od 8–9 milijuna korisnika primarno na osnovu check-in i review mehanike – bez ijednog plaćenog oglasa u ranoj fazi.
•	Viralni akvizicijski kanal:
•	Post-event shareable card → socijalni proof → organska akvizicija novih korisnika.
•	TicketFairy potvrđuje da socijalni dokaz i optimizirani checkout tok direktno podižu konverziju – platforma koja kombinira oba elementa ima strukturnu prednost.
•	Feedback za organizatore = razlog da ostanu:
•	Organizator koji dobiva konkretne, anonimne povratne informacije o svakom eventu ima razlog koristiti platformu i između evenata, ne samo u trenutku prodaje karata. To povećava B2B stickiness i smanjuje churn.
•	Pitch žiriju:
•	„Preuredili smo redoslijed korisničkog iskustva: post-event reviews nisu epilog – oni su prolog. Svaka ocjena u našoj aplikaciji postaje viralni sadržaj koji privlači novog korisnika i puni naš feed živim, autentičnim sadržajem koji nijedan marketing tim ne može kupiti. Untappd je tim mehanizmom izgradio zajednicu od gotovo 9 milijuna korisnika. Mi taj isti princip primjenjujemo na studentski nightlife."
•	Akvizicija prvih korisnika (3 mjeseca):
•	Na prvom partnerskom eventu: aktivno potaknite review (volonter na izlasku može reći: „Ostavite ocjenu i dobivate 10% popust na sljedeći event").
•	Prvih 20–30 reviewova stvara živu stranicu eventa → sljedeći event organizatora ima odmah vidljiv social proof i povjerenje novih kupaca.

