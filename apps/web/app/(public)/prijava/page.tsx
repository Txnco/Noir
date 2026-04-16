"use client";

import { useActionState, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import GoogleButton from "@/components/GoogleButton";
import { toast } from "@/components/Toaster";
import { loginAction } from "@/lib/auth/actions";
import { IDLE, type AuthState } from "@/lib/auth/types";
import { supabaseBrowser } from "@/lib/supabase/client";

export default function PrijavaPage() {
  const router = useRouter();
  const [state, formAction, pending] = useActionState<AuthState, FormData>(
    loginAction,
    IDLE,
  );
  const [showPassword, setShowPassword] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [googleError, setGoogleError] = useState<string | null>(null);

  useEffect(() => {
    if (state.status === "success") {
      toast.success("Prijava uspješna", state.message);
      router.replace(state.redirectTo);
      router.refresh();
    } else if (state.status === "error") {
      toast.error("Prijava nije uspjela", state.error);
    }
  }, [state, router]);

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
        <div className="pointer-events-none absolute -top-24 right-0 h-[420px] w-[420px] rounded-full bg-accent/10 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-32 -left-32 h-[320px] w-[320px] rounded-full bg-secondary/10 blur-3xl" />

        <div className="relative z-10 mx-auto grid w-full max-w-6xl items-center gap-8 px-6 lg:grid-cols-2 lg:gap-14">
          {/* ─────────── FORM COLUMN ─────────── */}
          <div className="mx-auto w-full max-w-md lg:mx-0">
            <div className="animate-fade-up">
              <p className="text-xs font-semibold tracking-widest text-accent uppercase">
                Prijava
              </p>
              <h1 className="font-display mt-2 text-2xl font-extrabold text-neutral md:text-3xl">
                Dobrodošao natrag
              </h1>
              <p className="mt-2 text-sm text-text-muted">
                Prijavi se i nastavi otkrivati najbolje evente u gradu.
              </p>
            </div>

            <div className="animate-fade-up delay-100 mt-5 rounded-2xl border border-border bg-surface-white p-5 shadow-sm md:p-6">
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
                  <div className="flex items-center justify-between">
                    <label
                      htmlFor="password"
                      className="block text-sm font-medium text-neutral"
                    >
                      Lozinka
                    </label>
                    <a
                      href="#"
                      className="text-xs font-medium text-secondary transition-colors hover:text-primary"
                    >
                      Zaboravljena lozinka?
                    </a>
                  </div>
                  <div className="relative mt-1">
                    <input
                      id="password"
                      name="password"
                      type={showPassword ? "text" : "password"}
                      autoComplete="current-password"
                      required
                      placeholder="••••••••"
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
                </div>

                <label className="flex cursor-pointer items-center gap-2 select-none">
                  <input
                    type="checkbox"
                    name="remember"
                    defaultChecked
                    className="h-4 w-4 rounded border-border text-accent focus:ring-2 focus:ring-accent/30"
                  />
                  <span className="text-sm text-text-muted">Zapamti me</span>
                </label>

                {error && (
                  <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                    {error}
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
                      Prijavljivanje...
                    </>
                  ) : (
                    <>
                      Prijavi se
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
              Nemaš račun?{" "}
              <Link
                href="/registracija"
                className="font-semibold text-secondary transition-colors hover:text-primary"
              >
                Registriraj se
              </Link>
            </p>
          </div>

          {/* ─────────── BRAND COLUMN ─────────── */}
          <div className="animate-fade-up delay-200 hidden lg:block">
            <div className="relative overflow-hidden rounded-3xl bg-primary p-8 text-white shadow-xl">
              <div className="pointer-events-none absolute -top-16 -right-16 h-64 w-64 rounded-full bg-accent/25 blur-3xl" />
              <div className="pointer-events-none absolute -bottom-16 -left-16 h-64 w-64 rounded-full bg-secondary/25 blur-3xl" />

              <div className="relative z-10">
                <span className="font-display text-lg font-extrabold tracking-[0.18em] text-white/90">
                  NOIR
                </span>
                <h2 className="font-display mt-5 text-2xl leading-tight font-extrabold md:text-3xl">
                  Tvoj sljedeći izlazak
                  <br />
                  <span className="text-accent">čeka te.</span>
                </h2>
                <p className="mt-3 max-w-sm text-sm leading-relaxed text-white/70">
                  Prati omiljene prostore, čuvaj evente i kupi ulaznice u par
                  tapova. Sve na jednom mjestu.
                </p>

                <ul className="mt-6 space-y-3 text-sm">
                  {[
                    "Personalizirani feed evenata",
                    "Brza kupnja i digitalne ulaznice",
                    "Paketi izlaska — ulaz, piće, stol",
                  ].map((item) => (
                    <li key={item} className="flex items-start gap-3">
                      <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-accent/25">
                        <svg width="11" height="11" viewBox="0 0 16 16" fill="none">
                          <path
                            d="M2 8.5l4 4 8-8"
                            stroke="white"
                            strokeWidth="2"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                          />
                        </svg>
                      </span>
                      <span className="text-white/85">{item}</span>
                    </li>
                  ))}
                </ul>

                <div className="mt-6 flex items-center gap-4 border-t border-white/15 pt-5">
                  <div className="flex -space-x-2">
                    {[
                      "from-accent/60 to-secondary/60",
                      "from-secondary/60 to-primary/60",
                      "from-accent/40 to-accent/80",
                    ].map((g, i) => (
                      <div
                        key={i}
                        className={`h-9 w-9 rounded-full border-2 border-primary bg-gradient-to-br ${g}`}
                      />
                    ))}
                  </div>
                  <p className="text-xs text-white/65">
                    <span className="font-bold text-white">10,000+</span>{" "}
                    studenata već koristi Noir
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
