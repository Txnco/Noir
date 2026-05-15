import type { Metadata } from "next";
import localFont from "next/font/local";
import Toaster from "@/components/Toaster";
import "./globals.css";
import { Geist } from "next/font/google";
import { cn } from "@/lib/utils";

const geist = Geist({subsets:['latin'],variable:'--font-sans'});

const fraunces = localFont({
  src: [
    {
      path: "../public/assets/fonts/Fraunces/Fraunces-VariableFont_SOFT,WONK,opsz,wght.ttf",
      style: "normal",
    },
    {
      path: "../public/assets/fonts/Fraunces/Fraunces-Italic-VariableFont_SOFT,WONK,opsz,wght.ttf",
      style: "italic",
    },
  ],
  variable: "--font-fraunces",
  display: "swap",
});

const montserrat = localFont({
  src: [
    {
      path: "../public/assets/fonts/Montserrat/Montserrat-VariableFont_wght.ttf",
      style: "normal",
    },
    {
      path: "../public/assets/fonts/Montserrat/Montserrat-Italic-VariableFont_wght.ttf",
      style: "italic",
    },
  ],
  variable: "--font-montserrat",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Noir | Cijeli izlazak u jednom kliku",
  description:
    "Otkrij evente, kupi ulaznice, rezerviraj stol i nabavi pakete izlaska — sve u jednoj aplikaciji. Noir pretvara noćni život Zagreba u jedan klik.",
  icons: {
    icon: [
      { url: "/assets/logo/MonogramBlack.svg", type: "image/svg+xml" },
    ],
    shortcut: "/assets/logo/MonogramBlack.svg",
    apple: "/assets/logo/MonogramBlack.svg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="hr" className={cn("font-sans", geist.variable)}>
      <body
        className={`${montserrat.variable} ${fraunces.variable} font-sans antialiased`}
      >
        {children}
        <Toaster />
      </body>
    </html>
  );
}
