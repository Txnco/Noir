"use client";

import { Inter, Plus_Jakarta_Sans } from "next/font/google";
import "@/app/globals.css";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin", "latin-ext"],
});

const plusJakarta = Plus_Jakarta_Sans({
  variable: "--font-plus-jakarta",
  subsets: ["latin", "latin-ext"],
});

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="hr">
      <body className={`${inter.variable} ${plusJakarta.variable} font-sans antialiased text-white bg-black flex`}>
        <div className="flex h-screen w-full flex-col items-center justify-center space-y-4">
          <h2 className="text-2xl font-bold">Dogodila se neočekivana pogreška!</h2>
          <button
            className="rounded-lg bg-white px-4 py-2 text-black transition-opacity hover:opacity-80"
            onClick={() => reset()}
          >
            Pokušaj ponovno
          </button>
        </div>
      </body>
    </html>
  );
}