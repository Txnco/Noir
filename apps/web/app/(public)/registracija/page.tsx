"use client";

import { useActionState, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import GoogleButton from "@/components/GoogleButton";
import { toast } from "@/components/Toaster";
import { registerAction } from "@/lib/auth/actions";
import { IDLE, type AuthState } from "@/lib/auth/types";
import { supabaseBrowser } from "@/lib/supabase/client";

export default function RegistracijaPage() {
  const router = useRouter();
  const [state, formAction, pending] = useActionState<AuthState, FormData>(
    registerAction,
    IDLE,
  );
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [googleError, setGoogleError] = useState<string | null>(null);

  useEffect(() => {
    if (state.status === "success") {
      toast.success("Račun kreiran", state.message);
      router.replace(state.redirectTo);
      router.refresh();
    } else if (state.status === "error") {
      toast.error("Registracija nije uspjela", state.error);
    }
  }, [state, router]);

  // ── password strength meter ──
  const strength = useMemo(() => {
    let score = 0;
    if (password.length >= 8) score++;
    if (/[A-Z]/.test(password)) score++;
    if (/[0-9]/.test(password)) score++;
    if (/[^A-Za-z0-9]/.test(password)) score++;
    return score; // 0..4
  }, [password]);

  const strengthLabels = ["Preslaba", "Slaba", "Solidna", "Jaka", "Vrlo jaka"];
  const strengthColors = [
    "bg-border",
    "bg-red-400",
    "bg-amber-400",
    "bg-secondary",
    "bg-accent",
  ];

  async function handleGoogle() {
    setGoogleError(null);
    setGoogleLoading(true);
    const supabase = supabaseBrowser();
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: `${window.location.origin}/auth/callback`,
      },
    });
    if (error) {
      const msg = "Greška kod Google prijave. Pokušaj ponovno.";
      setGoogleError(msg);
      toast.error("Google prijava", msg);
      setGoogleLoading(false);
    }
    // on success, Supabase redirects — no need to unset loading
  }

  const error = (state.status === "error" ? state.error : null) ?? googleError;

  return (
    <div className="noise-bg relative min-h-screen overflow-hidden">
      {/* minimal brand mark, top-left */}
      <Link
        href="/"
        className="font-display absolute top-5 left-6 z-20 text-lg font-extrabold tracking-[0.18em] text-primary select-none md:top-6 md:left-10"
      >
        NOIR
      </Link>

      <main className="relative flex min-h-screen items-center py-14 md:py-10">
        {/* decorative background */}
        <div className="pointer-events-none absolute -top-24 -left-24 h-[420px] w-[420px] rounded-full bg-secondary/10 blur-3xl" />
        <div className="pointer-events-none absolute -right-32 -bottom-32 h-[320px] w-[320px] rounded-full bg-accent/10 blur-3xl" />

        <div className="relative z-10 mx-auto grid w-full max-w-6xl items-center gap-8 px-6 lg:grid-cols-2 lg:gap-14">
          {/* ─────────── BRAND COLUMN (left on desktop) ─────────── */}
          <div className="animate-fade-up delay-100 order-2 hidden lg:order-1 lg:block">
            <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-primary via-primary to-neutral p-8 text-white shadow-xl">
              <div className="pointer-events-none absolute -top-16 -left-16 h-64 w-64 rounded-full bg-secondary/25 blur-3xl" />
              <div className="pointer-events-none absolute -right-16 -bottom-16 h-64 w-64 rounded-full bg-accent/25 blur-3xl" />

              <div className="relative z-10">
                <span className="font-display text-lg font-extrabold tracking-[0.18em] text-white/90">
                  NOIR
                </span>
                <h2 className="font-display mt-5 text-2xl leading-tight font-extrabold md:text-3xl">
                  Pridruži se i otkrij
                  <br />
                  <span className="text-accent">izlazak iz snova.</span>
                </h2>
                <p className="mt-3 max-w-sm text-sm leading-relaxed text-white/70">
                  Otvori račun i dobij personalizirani feed evenata, ekskluzivne
                  Early Bird cijene i sve karte na jednom mjestu.
                </p>

                <div className="mt-6 grid grid-cols-2 gap-3">
                  {[
                    { num: "500+", label: "evenata" },
                    { num: "50+", label: "prostora" },
                    { num: "10k+", label: "korisnika" },
                    { num: "4.9", label: "ocjena" },
                  ].map((s) => (
                    <div
                      key={s.label}
                      className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 backdrop-blur-sm"
                    >
                      <p className="font-display text-xl font-extrabold text-white">
                        {s.num}
                      </p>
                      <p className="mt-0.5 text-xs text-white/65">{s.label}</p>
                    </div>
                  ))}
                </div>

                <div className="mt-6 flex items-center gap-3 border-t border-white/15 pt-5">
                  <span className="flex h-9 w-9 items-center justify-center rounded-full bg-accent/25">
                    <svg width="16" height="16" viewBox="0 0 20 20" fill="none">
                      <path
                        d="M10 2l2.4 5 5.6.8-4 4 1 5.6-5-2.7-5 2.7 1-5.6-4-4 5.6-.8L10 2z"
                        stroke="white"
                        strokeWidth="1.5"
                        strokeLinejoin="round"
                      />
                    </svg>
                  </span>
                  <p className="text-xs text-white/70">
                    Besplatno. Bez skrivenih troškova.
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* ─────────── FORM COLUMN (right on desktop) ─────────── */}
          <div className="order-1 mx-auto w-full max-w-md lg:order-2 lg:mx-0">
            <div className="animate-fade-up">
              <p className="text-xs font-semibold tracking-widest text-secondary uppercase">
                Registracija
              </p>
              <h1 className="font-display mt-2 text-2xl font-extrabold text-neutral md:text-3xl">
                Otvori svoj Noir račun
              </h1>
              <p className="mt-1.5 text-sm text-text-muted">
                Otkrij evente, kupi ulaznice i nikad više ne propusti dobar izlazak.
              </p>
            </div>

            <div className="animate-fade-up delay-100 mt-4 rounded-2xl border border-border bg-surface-white p-5 shadow-sm md:p-6">
              {/* Google */}
              <GoogleButton
                label="Nastavi s Google računom"
                onClick={handleGoogle}
                loading={googleLoading}
              />

              {/* divider */}
              <div className="my-4 flex items-center gap-4">
                <div className="h-px flex-1 bg-border" />
                <span className="text-xs font-medium tracking-wider text-text-muted uppercase">
                  ili
                </span>
                <div className="h-px flex-1 bg-border" />
              </div>

              {/* form */}
              <form action={formAction} className="space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label
                      htmlFor="firstName"
                      className="block text-sm font-medium text-neutral"
                    >
                      Ime
                    </label>
                    <input
                      id="firstName"
                      name="firstName"
                      type="text"
                      autoComplete="given-name"
                      required
                      placeholder="Ana"
                      className="mt-1 w-full rounded-xl border border-border bg-surface px-4 py-2.5 text-sm text-neutral placeholder:text-text-muted/70 transition-all focus:border-accent focus:bg-surface-white focus:outline-none focus:ring-4 focus:ring-accent/15"
                    />
                  </div>
                  <div>
                    <label
                      htmlFor="lastName"
                      className="block text-sm font-medium text-neutral"
                    >
                      Prezime
                    </label>
                    <input
                      id="lastName"
                      name="lastName"
                      type="text"
                      autoComplete="family-name"
                      required
                      placeholder="Anić"
                      className="mt-1 w-full rounded-xl border border-border bg-surface px-4 py-2.5 text-sm text-neutral placeholder:text-text-muted/70 transition-all focus:border-accent focus:bg-surface-white focus:outline-none focus:ring-4 focus:ring-accent/15"
                    />
                  </div>
                </div>

                <div>
                  <label
                    htmlFor="email"
                    className="block text-sm font-medium text-neutral"
                  >
                    Email
                  </label>
                  <input
                    id="email"
                    name="email"
                    type="email"
                    autoComplete="email"
                    required
                    placeholder="ime@primjer.hr"
                    className="mt-1 w-full rounded-xl border border-border bg-surface px-4 py-2.5 text-sm text-neutral placeholder:text-text-muted/70 transition-all focus:border-accent focus:bg-surface-white focus:outline-none focus:ring-4 focus:ring-accent/15"
                  />
                </div>

                <div>
                  <label
                    htmlFor="password"
                    className="block text-sm font-medium text-neutral"
                  >
                    Lozinka
                  </label>
                  <div className="relative mt-1">
                    <input
                      id="password"
                      name="password"
                      type={showPassword ? "text" : "password"}
                      autoComplete="new-password"
                      required
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="Najmanje 8 znakova"
                      className="w-full rounded-xl border border-border bg-surface px-4 py-2.5 pr-12 text-sm text-neutral placeholder:text-text-muted/70 transition-all focus:border-accent focus:bg-surface-white focus:outline-none focus:ring-4 focus:ring-accent/15"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword((s) => !s)}
                      className="absolute top-1/2 right-3 -translate-y-1/2 rounded-md p-1.5 text-text-muted transition-colors hover:text-primary"
                      aria-label={
                        showPassword ? "Sakrij lozinku" : "Prikaži lozinku"
                      }
                    >
                      {showPassword ? (
                        <svg width="18" height="18" viewBox="0 0 20 20" fill="none">
                          <path
                            d="M3 3l14 14M8.5 8.5a2 2 0 002.83 2.83M11.7 6.3a6.6 6.6 0 015.3 3.7 6.6 6.6 0 01-2 2.5M6.3 6.3A6.6 6.6 0 003 10a6.6 6.6 0 008.7 3.7"
                            stroke="currentColor"
                            strokeWidth="1.5"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                          />
                        </svg>
                      ) : (
                        <svg width="18" height="18" viewBox="0 0 20 20" fill="none">
                          <path
                            d="M1.5 10S4.5 4 10 4s8.5 6 8.5 6-3 6-8.5 6-8.5-6-8.5-6z"
                            stroke="currentColor"
                            strokeWidth="1.5"
                            strokeLinejoin="round"
                          />
                          <circle
                            cx="10"
                            cy="10"
                            r="2.5"
                            stroke="currentColor"
                            strokeWidth="1.5"
                          />
                        </svg>
                      )}
                    </button>
                  </div>

                  {/* strength meter */}
                  {password.length > 0 && (
                    <div className="mt-1.5 flex items-center gap-3">
                      <div className="flex flex-1 gap-1.5">
                        {[1, 2, 3, 4].map((i) => (
                          <div
                            key={i}
                            className={`h-1 flex-1 rounded-full transition-colors ${
                              i <= strength ? strengthColors[strength] : "bg-border"
                            }`}
                          />
                        ))}
                      </div>
                      <span className="text-[11px] font-medium text-text-muted">
                        {strengthLabels[strength]}
                      </span>
                    </div>
                  )}
                </div>

                <div>
                  <label
                    htmlFor="password_confirm"
                    className="block text-sm font-medium text-neutral"
                  >
                    Potvrdi lozinku
                  </label>
                  <input
                    id="password_confirm"
                    name="password_confirm"
                    type={showPassword ? "text" : "password"}
                    autoComplete="new-password"
                    required
                    placeholder="Ponovi lozinku"
                    className="mt-1 w-full rounded-xl border border-border bg-surface px-4 py-2.5 text-sm text-neutral placeholder:text-text-muted/70 transition-all focus:border-accent focus:bg-surface-white focus:outline-none focus:ring-4 focus:ring-accent/15"
                  />
                </div>

                <label className="flex cursor-pointer items-start gap-2 select-none">
                  <input
                    type="checkbox"
                    name="acceptTerms"
                    className="mt-0.5 h-4 w-4 rounded border-border text-accent focus:ring-2 focus:ring-accent/30"
                  />
                  <span className="text-xs leading-snug text-text-muted">
                    Prihvaćam{" "}
                    <a
                      href="#"
                      className="font-medium text-secondary transition-colors hover:text-primary"
                    >
                      uvjete korištenja
                    </a>{" "}
                    i{" "}
                    <a
                      href="#"
                      className="font-medium text-secondary transition-colors hover:text-primary"
                    >
                      politiku privatnosti
                    </a>
                    .
                  </span>
                </label>

                {error && (
                  <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                    {error}
                    {state.status === "error" && state.code === "email_exists" && (
                      <Link
                        href="/prijava"
                        className="mt-1 block font-semibold text-red-800 underline underline-offset-2 hover:text-red-900"
                      >
                        Prijavi se →
                      </Link>
                    )}
                  </div>
                )}

                <button
                  type="submit"
                  disabled={pending}
                  className="mt-1 flex w-full items-center justify-center gap-2 rounded-full bg-primary px-7 py-3 text-sm font-semibold text-white shadow-lg shadow-primary/20 transition-all hover:bg-neutral hover:shadow-xl hover:shadow-primary/25 active:scale-[0.97] disabled:cursor-not-allowed disabled:opacity-70"
                >
                  {pending ? (
                    <>
                      <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                      Kreiranje računa...
                    </>
                  ) : (
                    <>
                      Kreiraj račun
                      <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                        <path
                          d="M3 8h10M9 4l4 4-4 4"
                          stroke="currentColor"
                          strokeWidth="1.5"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />
                      </svg>
                    </>
                  )}
                </button>
              </form>
            </div>

            <p className="animate-fade-up delay-200 mt-4 text-center text-sm text-text-muted">
              Već imaš račun?{" "}
              <Link
                href="/prijava"
                className="font-semibold text-secondary transition-colors hover:text-primary"
              >
                Prijavi se
              </Link>
            </p>
          </div>
        </div>
      </main>
    </div>
  );
}
