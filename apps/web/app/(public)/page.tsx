import Reveal from "@/components/Reveal";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";

export default function LandingPage() {
  return (
    <div className="noise-bg relative min-h-screen">
      <Navbar
        links={[
          { label: "Kako radi", href: "#kako-radi" },
          { label: "Za organizatore", href: "#za-organizatore" },
          { label: "Kontakt", href: "#kontakt" },
        ]}
      />

      {/* ═══════════ HERO ═══════════ */}
      <section className="relative overflow-hidden pt-28 pb-20 md:pt-40 md:pb-32">
        {/* decorative circles */}
        <div className="pointer-events-none absolute -top-24 -right-24 h-[420px] w-[420px] rounded-full bg-accent/10 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-32 -left-32 h-[320px] w-[320px] rounded-full bg-secondary/10 blur-3xl" />

        <div className="relative z-10 mx-auto grid max-w-6xl items-center gap-12 px-6 lg:grid-cols-2 lg:gap-20">
          {/* text column */}
          <div className="max-w-xl">
            <div className="animate-fade-up mb-4 inline-flex items-center gap-2 rounded-full border border-border bg-surface-white/70 px-4 py-1.5 text-xs font-medium text-text-muted">
              <span className="inline-block h-1.5 w-1.5 rounded-full bg-accent" />
              Svijet nadohvat ruke
            </div>

            <h1 className="animate-fade-up delay-100 font-display text-[2.5rem] leading-[1.1] font-extrabold tracking-tight text-neutral md:text-6xl">
              Cijeli izlazak
              <br />
              <span className="text-secondary">u jednom kliku</span>
            </h1>

            <p className="animate-fade-up delay-200 mt-6 max-w-md text-lg leading-relaxed text-text-muted">
              Otkrij evente u gradu, kupi ulaznicu i paket izlaska, rezerviraj stol
              &mdash; sve u par tapova. Bez skrolanja po mrežama, bez čekanja u redu.
            </p>

            <div className="animate-fade-up delay-300 mt-10 flex flex-wrap gap-4">
              <a
                href="/eventi"
                className="inline-flex items-center gap-2 rounded-full bg-primary px-7 py-3.5 text-sm font-semibold text-white shadow-lg shadow-primary/20 transition-all hover:bg-neutral hover:shadow-xl hover:shadow-primary/25 active:scale-[0.97]"
              >
                Pregledaj evente
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none" className="ml-0.5">
                  <path d="M3 8h10M9 4l4 4-4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              </a>
              <a
                href="#za-organizatore"
                className="inline-flex items-center rounded-full border border-border bg-surface-white px-7 py-3.5 text-sm font-semibold text-primary transition-all hover:border-secondary hover:text-secondary active:scale-[0.97]"
              >
                Za organizatore
              </a>
            </div>
          </div>

          {/* phone mockup */}
          <div className="animate-fade-up delay-400 relative flex justify-center lg:justify-end">
            <div className="animate-float relative">
              {/* phone frame */}
              <div className="relative h-[520px] w-[260px] overflow-hidden rounded-[2.5rem] border-[6px] border-neutral/90 bg-neutral shadow-2xl">
                {/* status bar */}
                <div className="flex items-center justify-between bg-neutral px-5 pt-3 pb-2">
                  <span className="text-[10px] font-medium text-white/60">21:37</span>
                  <div className="mx-auto h-5 w-20 rounded-full bg-neutral-light/80" />
                  <div className="flex gap-1">
                    <div className="h-2.5 w-2.5 rounded-full bg-white/40" />
                    <div className="h-2.5 w-2.5 rounded-full bg-white/40" />
                  </div>
                </div>
                {/* mock content */}
                <div className="space-y-3 bg-surface p-4">
                  {/* search */}
                  <div className="flex items-center gap-2 rounded-xl bg-surface-white px-3 py-2.5 shadow-sm">
                    <svg width="14" height="14" viewBox="0 0 16 16" fill="none"><circle cx="7" cy="7" r="5" stroke="#6B7B85" strokeWidth="1.5"/><path d="M11 11l3 3" stroke="#6B7B85" strokeWidth="1.5" strokeLinecap="round"/></svg>
                    <span className="text-[11px] text-text-muted">Pretraži evente...</span>
                  </div>
                  {/* tag pills */}
                  <div className="flex gap-1.5 overflow-hidden">
                    {["techno", "live", "kviz", "stand-up"].map((tag) => (
                      <span key={tag} className="shrink-0 rounded-full bg-accent/15 px-2.5 py-1 text-[10px] font-medium text-primary">
                        #{tag}
                      </span>
                    ))}
                  </div>
                  {/* event cards */}
                  {[
                    { name: "Neon Nights", venue: "Club Boogaloo", price: "8€", color: "bg-secondary/20" },
                    { name: "Jazz & Wine", venue: "Vintage Industrial", price: "12€", color: "bg-accent/20" },
                    { name: "Student Kviz", venue: "Craft Room", price: "5€", color: "bg-primary/15" },
                  ].map((evt, i) => (
                    <div key={i} className="overflow-hidden rounded-2xl bg-surface-white shadow-sm">
                      <div className={`h-20 ${evt.color}`} />
                      <div className="px-3 py-2.5">
                        <p className="text-xs font-bold text-neutral">{evt.name}</p>
                        <p className="mt-0.5 text-[10px] text-text-muted">{evt.venue}</p>
                        <div className="mt-1.5 flex items-center justify-between">
                          <span className="rounded-full bg-accent/15 px-2 py-0.5 text-[10px] font-semibold text-primary">{evt.price}</span>
                          <span className="text-[9px] font-medium text-accent">Early Bird</span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
              {/* glow behind phone */}
              <div className="absolute -inset-6 -z-10 rounded-[3rem] bg-gradient-to-br from-accent/20 via-secondary/10 to-transparent blur-2xl" />
            </div>
          </div>
        </div>
      </section>

      {/* ═══════════ SOCIAL PROOF STRIP ═══════════ */}
      <Reveal variant="fade-up">
        <section className="border-y border-border bg-surface-white/60">
          <div className="mx-auto flex max-w-4xl flex-wrap items-center justify-center gap-8 px-6 py-10 md:justify-between md:gap-4 md:py-12">
            {[
              { value: "500+", label: "evenata" },
              { value: "10,000+", label: "korisnika" },
              { value: "50+", label: "prostora" },
              { value: "4.9", label: "ocjena" },
            ].map((stat, i) => (
              <Reveal key={i} variant="scale" delay={i * 100} className="flex flex-col items-center gap-1 px-4">
                <span className="font-display text-3xl font-extrabold text-primary md:text-4xl">
                  {stat.value}
                </span>
                <span className="text-sm text-text-muted">{stat.label}</span>
              </Reveal>
            ))}
          </div>
        </section>
      </Reveal>

      {/* ═══════════ HOW IT WORKS ═══════════ */}
      <section id="kako-radi" className="py-24 md:py-32">
        <div className="mx-auto max-w-6xl px-6">
          <Reveal variant="fade-up" className="mx-auto max-w-2xl text-center">
            <p className="text-sm font-semibold tracking-widest text-accent uppercase">Kako radi</p>
            <h2 className="font-display mt-3 text-3xl font-extrabold text-neutral md:text-4xl">
              Od otkrivanja do ulaska &mdash; u 3 koraka
            </h2>
            <p className="mt-4 text-text-muted">
              Noir je napravljen da bude brz. Nema čekanja, nema komplikacija.
            </p>
          </Reveal>

          <div className="mt-16 grid gap-8 md:grid-cols-3 md:gap-6">
            {[
              {
                step: "01",
                title: "Otkrij",
                desc: "Pregledaj personalizirani feed evenata. Filtriraj po tagovima, datumu i blizini. Pronađi svoj izlazak.",
                icon: (
                  <svg width="28" height="28" viewBox="0 0 28 28" fill="none">
                    <circle cx="12" cy="12" r="8" stroke="#7DB5C8" strokeWidth="2"/>
                    <path d="M18 18l6 6" stroke="#7DB5C8" strokeWidth="2" strokeLinecap="round"/>
                    <circle cx="12" cy="12" r="3" fill="#7DB5C8" fillOpacity="0.25"/>
                  </svg>
                ),
              },
              {
                step: "02",
                title: "Kupi",
                desc: "Odaberi ulaznicu ili paket izlaska — ulaz, piće, stol. Plati u 2 tapa. Gotovo.",
                icon: (
                  <svg width="28" height="28" viewBox="0 0 28 28" fill="none">
                    <rect x="3" y="6" width="22" height="16" rx="3" stroke="#7DB5C8" strokeWidth="2"/>
                    <path d="M3 12h22" stroke="#7DB5C8" strokeWidth="2"/>
                    <rect x="6" y="16" width="6" height="2" rx="1" fill="#7DB5C8" fillOpacity="0.4"/>
                  </svg>
                ),
              },
              {
                step: "03",
                title: "Uđi",
                desc: "Pokaži QR kod na ulazu — jedan scan i unutra si. Bez papirnatih karata, bez gužve.",
                icon: (
                  <svg width="28" height="28" viewBox="0 0 28 28" fill="none">
                    <rect x="4" y="4" width="8" height="8" rx="1.5" stroke="#7DB5C8" strokeWidth="2"/>
                    <rect x="16" y="4" width="8" height="8" rx="1.5" stroke="#7DB5C8" strokeWidth="2"/>
                    <rect x="4" y="16" width="8" height="8" rx="1.5" stroke="#7DB5C8" strokeWidth="2"/>
                    <rect x="18" y="18" width="4" height="4" rx="1" fill="#7DB5C8" fillOpacity="0.5"/>
                  </svg>
                ),
              },
            ].map((item, i) => (
              <Reveal key={i} variant="fade-up" delay={i * 120}>
                <div className="group relative rounded-2xl border border-border bg-surface-white p-8 shadow-sm transition-all hover:border-accent/40 hover:shadow-md">
                  {/* step number */}
                  <span className="font-display absolute top-6 right-6 text-5xl font-extrabold text-border/60 transition-colors group-hover:text-accent/20">
                    {item.step}
                  </span>

                  <div className="mb-5 flex h-12 w-12 items-center justify-center rounded-xl bg-accent/10">
                    {item.icon}
                  </div>

                  <h3 className="font-display text-xl font-bold text-neutral">{item.title}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-text-muted">{item.desc}</p>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* ═══════════ FEATURES ═══════════ */}
      <section className="bg-surface-white/50 py-24 md:py-32">
        <div className="mx-auto max-w-6xl px-6">
          <Reveal variant="fade-up" className="mx-auto max-w-2xl text-center">
            <p className="text-sm font-semibold tracking-widest text-secondary uppercase">Zašto Noir</p>
            <h2 className="font-display mt-3 text-3xl font-extrabold text-neutral md:text-4xl">
              Više od ulaznice
            </h2>
            <p className="mt-4 text-text-muted">
              Ne prodajemo karte &mdash; prodajemo cijeli doživljaj izlaska.
            </p>
          </Reveal>

          <div className="mt-16 grid gap-8 md:grid-cols-3">
            {/* Package card */}
            <Reveal variant="fade-up" delay={0}>
              <div className="group relative overflow-hidden rounded-2xl border border-border bg-surface-white p-8 shadow-sm transition-all hover:shadow-lg">
                <div className="mb-5 flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-accent/20 to-secondary/10">
                  <svg width="28" height="28" viewBox="0 0 28 28" fill="none">
                    <path d="M5 8a3 3 0 013-3h12a3 3 0 013 3v2a1 1 0 01-1 1H6a1 1 0 01-1-1V8z" stroke="#3D4F59" strokeWidth="1.5"/>
                    <path d="M5 14h18v6a3 3 0 01-3 3H8a3 3 0 01-3-3v-6z" stroke="#3D4F59" strokeWidth="1.5"/>
                    <circle cx="10" cy="18" r="1.5" fill="#7DB5C8"/>
                    <circle cx="14" cy="18" r="1.5" fill="#6B8FA3"/>
                    <circle cx="18" cy="18" r="1.5" fill="#3D4F59"/>
                    <path d="M10 11v3M18 11v3" stroke="#3D4F59" strokeWidth="1.5" strokeLinecap="round"/>
                  </svg>
                </div>
                <h3 className="font-display text-lg font-bold text-neutral">Paketi izlaska</h3>
                <p className="mt-2 text-sm leading-relaxed text-text-muted">
                  Ulaz + piće + stol u jednom paketu. Odaberi &ldquo;Drink &amp; Chill&rdquo; ili
                  &ldquo;Squad Table&rdquo; i cijeli izlazak je riješen.
                </p>
                <div className="mt-5 flex flex-wrap gap-2">
                  {["Ulaz", "Piće", "Stol"].map((t) => (
                    <span key={t} className="rounded-full bg-accent/10 px-3 py-1 text-xs font-medium text-primary">{t}</span>
                  ))}
                </div>
              </div>
            </Reveal>

            {/* Early Bird card */}
            <Reveal variant="fade-up" delay={120}>
              <div className="group relative overflow-hidden rounded-2xl border border-border bg-surface-white p-8 shadow-sm transition-all hover:shadow-lg">
                <div className="mb-5 flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-secondary/20 to-accent/10">
                  <svg width="28" height="28" viewBox="0 0 28 28" fill="none">
                    <path d="M14 4v2M14 22v2M4 14h2M22 14h2" stroke="#3D4F59" strokeWidth="1.5" strokeLinecap="round"/>
                    <circle cx="14" cy="14" r="7" stroke="#3D4F59" strokeWidth="1.5"/>
                    <path d="M14 10v4l3 2" stroke="#7DB5C8" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                </div>
                <h3 className="font-display text-lg font-bold text-neutral">Early Bird cijene</h3>
                <p className="mt-2 text-sm leading-relaxed text-text-muted">
                  Transparentni cjenovni tierovi. Kupi ranije &mdash; plati manje.
                  Vidi u realnom vremenu koliko karata je preostalo po svakoj cijeni.
                </p>
                <div className="mt-5">
                  <div className="flex items-center justify-between text-xs text-text-muted">
                    <span>Early Bird</span>
                    <span className="font-semibold text-accent">82% prodano</span>
                  </div>
                  <div className="mt-1.5 h-2 w-full overflow-hidden rounded-full bg-border">
                    <div className="h-full w-[82%] rounded-full bg-gradient-to-r from-accent to-secondary" />
                  </div>
                </div>
              </div>
            </Reveal>

            {/* Digital tickets card */}
            <Reveal variant="fade-up" delay={240}>
              <div className="group relative overflow-hidden rounded-2xl border border-border bg-surface-white p-8 shadow-sm transition-all hover:shadow-lg">
                <div className="mb-5 flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-primary/15 to-secondary/10">
                  <svg width="28" height="28" viewBox="0 0 28 28" fill="none">
                    <rect x="6" y="3" width="16" height="22" rx="3" stroke="#3D4F59" strokeWidth="1.5"/>
                    <rect x="10" y="8" width="8" height="8" rx="1" stroke="#7DB5C8" strokeWidth="1.5"/>
                    <rect x="12" y="10" width="4" height="4" rx="0.5" fill="#7DB5C8" fillOpacity="0.3"/>
                    <path d="M11 20h6" stroke="#3D4F59" strokeWidth="1.5" strokeLinecap="round"/>
                  </svg>
                </div>
                <h3 className="font-display text-lg font-bold text-neutral">Digitalne ulaznice</h3>
                <p className="mt-2 text-sm leading-relaxed text-text-muted">
                  QR kod u aplikaciji &mdash; bez papira, bez printanja. Jedan scan na ulazu i gotovo.
                  Tvoja karta je uvijek s tobom.
                </p>
                <div className="mt-5 flex items-center gap-2 text-xs text-accent">
                  <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
                    <path d="M2 8.5l4 4 8-8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                  <span className="font-medium">Anti-screenshot zaštita</span>
                </div>
              </div>
            </Reveal>
          </div>
        </div>
      </section>

      {/* ═══════════ FOR ORGANIZERS ═══════════ */}
      <section id="za-organizatore" className="py-24 md:py-32">
        <div className="mx-auto max-w-6xl px-6">
          <div className="grid items-center gap-12 lg:grid-cols-2 lg:gap-20">
            {/* text */}
            <Reveal variant="fade-left">
              <div>
                <p className="text-sm font-semibold tracking-widest text-accent uppercase">Za organizatore</p>
                <h2 className="font-display mt-3 text-3xl font-extrabold text-neutral md:text-4xl">
                  Creator Hub &mdash; sve na jednom mjestu
                </h2>
                <p className="mt-4 max-w-md text-text-muted leading-relaxed">
                  Besplatan alat za kreiranje evenata, prodaju ulaznica, upravljanje
                  rezervacijama i praćenje analitike. Bez kompleksnih sustava, bez
                  skupih alata.
                </p>
                <div className="mt-8 flex flex-wrap gap-3">
                  <a
                    href="#kontakt"
                    className="inline-flex items-center gap-2 rounded-full bg-primary px-6 py-3 text-sm font-semibold text-white shadow-sm transition-all hover:bg-neutral active:scale-[0.97]"
                  >
                    Postani organizator
                    <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                      <path d="M3 8h10M9 4l4 4-4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                  </a>
                </div>
              </div>
            </Reveal>

            {/* feature list */}
            <div className="space-y-4">
              {[
                {
                  title: "Kreiraj event u 3 koraka",
                  desc: "Prostor → cijene i paketi → objava. Wizard koji vodi kroz sve.",
                  icon: (
                    <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
                      <rect x="2" y="2" width="16" height="16" rx="3" stroke="#6B8FA3" strokeWidth="1.5"/>
                      <path d="M7 10h6M10 7v6" stroke="#6B8FA3" strokeWidth="1.5" strokeLinecap="round"/>
                    </svg>
                  ),
                },
                {
                  title: "Analitika u realnom vremenu",
                  desc: "Prodaja, popunjenost, peak sati ulaska — sve na jednom dashboardu.",
                  icon: (
                    <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
                      <path d="M3 17V9l4-4 4 3 6-5" stroke="#6B8FA3" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                      <circle cx="3" cy="17" r="1" fill="#6B8FA3"/>
                      <circle cx="7" cy="5" r="1" fill="#6B8FA3"/>
                      <circle cx="11" cy="8" r="1" fill="#6B8FA3"/>
                      <circle cx="17" cy="3" r="1" fill="#6B8FA3"/>
                    </svg>
                  ),
                },
                {
                  title: "QR skeniranje na ulazu",
                  desc: "Koristi mobitel kao skener — bez dodatnog hardvera.",
                  icon: (
                    <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
                      <rect x="2" y="2" width="6" height="6" rx="1" stroke="#6B8FA3" strokeWidth="1.5"/>
                      <rect x="12" y="2" width="6" height="6" rx="1" stroke="#6B8FA3" strokeWidth="1.5"/>
                      <rect x="2" y="12" width="6" height="6" rx="1" stroke="#6B8FA3" strokeWidth="1.5"/>
                      <path d="M13 13h4v4h-4" stroke="#6B8FA3" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                  ),
                },
                {
                  title: "Pronađi prostor na mapi",
                  desc: "Pretraži prostore po kapacitetu, tipu i dostupnosti. Pošalji upit vlasniku.",
                  icon: (
                    <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
                      <path d="M10 2C6.69 2 4 4.69 4 8c0 4.5 6 10 6 10s6-5.5 6-10c0-3.31-2.69-6-6-6z" stroke="#6B8FA3" strokeWidth="1.5"/>
                      <circle cx="10" cy="8" r="2" fill="#6B8FA3" fillOpacity="0.3" stroke="#6B8FA3" strokeWidth="1"/>
                    </svg>
                  ),
                },
                {
                  title: "CSV export podataka",
                  desc: "Preuzmi sve podatke o prodaji i posjetiteljima za vlastitu analizu.",
                  icon: (
                    <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
                      <path d="M6 2h8l4 4v10a2 2 0 01-2 2H6a2 2 0 01-2-2V4a2 2 0 012-2z" stroke="#6B8FA3" strokeWidth="1.5"/>
                      <path d="M14 2v4h4M7 12h6M7 15h4" stroke="#6B8FA3" strokeWidth="1.5" strokeLinecap="round"/>
                    </svg>
                  ),
                },
              ].map((feat, i) => (
                <Reveal key={i} variant="fade-right" delay={i * 80}>
                  <div className="flex gap-4 rounded-xl border border-border bg-surface-white p-5 shadow-sm transition-all hover:border-secondary/30 hover:shadow-md">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-secondary/10">
                      {feat.icon}
                    </div>
                    <div>
                      <h4 className="font-display text-sm font-bold text-neutral">{feat.title}</h4>
                      <p className="mt-1 text-sm text-text-muted">{feat.desc}</p>
                    </div>
                  </div>
                </Reveal>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ═══════════ CTA ═══════════ */}
      <Reveal variant="scale" duration={900}>
        <section className="py-24 md:py-32">
          <div className="mx-auto max-w-6xl px-6">
            <div className="relative overflow-hidden rounded-3xl bg-primary px-8 py-16 text-center shadow-xl md:px-16 md:py-24">
              {/* decorative shapes */}
              <div className="pointer-events-none absolute -top-16 -left-16 h-64 w-64 rounded-full bg-secondary/20 blur-3xl" />
              <div className="pointer-events-none absolute -right-16 -bottom-16 h-64 w-64 rounded-full bg-accent/20 blur-3xl" />

              <div className="relative z-10">
                <h2 className="font-display text-3xl font-extrabold text-white md:text-5xl">
                  Spreman za izlazak?
                </h2>
                <p className="mx-auto mt-4 max-w-md text-base text-white/70">
                  Pridruži se tisućama studenata koji već koriste Noir za otkrivanje
                  najboljih evenata u Zagrebu.
                </p>
                <div className="mt-10 flex flex-wrap justify-center gap-4">
                  <a
                    href="/eventi"
                    className="inline-flex items-center gap-2 rounded-full bg-white px-8 py-4 text-sm font-bold text-primary shadow-lg transition-all hover:bg-surface hover:shadow-xl active:scale-[0.97]"
                  >
                    Pregledaj evente
                    <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                      <path d="M3 8h10M9 4l4 4-4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                  </a>
                  <a
                    href="#kontakt"
                    className="inline-flex items-center rounded-full border border-white/25 px-8 py-4 text-sm font-semibold text-white transition-all hover:border-white/50 hover:bg-white/10 active:scale-[0.97]"
                  >
                    Kontaktiraj nas
                  </a>
                </div>
              </div>
            </div>
          </div>
        </section>
      </Reveal>

      <Footer
        links={[
          { label: "Kako radi", href: "#kako-radi" },
          { label: "Za organizatore", href: "#za-organizatore" },
          { label: "Kontakt", href: "mailto:info@noir.hr" },
        ]}
      />
    </div>
  );
}
