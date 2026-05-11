"use client";

import { motion } from "framer-motion";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import Reveal from "@/components/Reveal";

// Mock tickets for demo - same as event data for consistency
const MOCK_TICKETS = [
  {
    id: "tk-12903",
    eventName: "Neon Nights",
    venue: "Club Boogaloo",
    date: "Danas, 05. Svi",
    time: "23:00",
    qrToken: "noir-demo-token-1",
    gradient: "linear-gradient(135deg, #1e1b4b 0%, #4338ca 50%, #7c3aed 100%)",
    price: "8€"
  }
];

export default function WalletPage() {
  return (
    <div className="noise-bg min-h-screen bg-surface text-neutral">
      <Navbar />

      <main className="mx-auto max-w-4xl px-6 pt-32 pb-20 relative z-10">
        <header className="mb-16 text-center">
          <Reveal variant="fade-up">
            <span className="text-[10px] font-bold uppercase tracking-[0.3em] text-accent mb-3 block">Moje ulaznice</span>
            <h1 className="text-6xl font-display font-bold text-neutral tracking-tight">Novčanik</h1>
            <div className="mt-6 flex items-center justify-center gap-4">
              <div className="h-px w-12 bg-border" />
              <p className="text-text-muted font-medium text-sm">
                {MOCK_TICKETS.length} {MOCK_TICKETS.length === 1 ? 'aktivna karta' : 'aktivne karte'}
              </p>
              <div className="h-px w-12 bg-border" />
            </div>
          </Reveal>
        </header>

        <div className="grid gap-12">
          {MOCK_TICKETS.map((ticket, i) => (
            <Reveal key={ticket.id} variant="fade-up" delay={i * 100}>
              <div className="group relative">
                {/* Ticket Body */}
                <div className="relative flex flex-col md:flex-row bg-surface-white border border-border rounded-[2.5rem] shadow-xl shadow-primary/5 overflow-hidden">
                  
                  {/* Left Section - Event Visual */}
                  <div className="relative w-full md:w-56 h-48 md:h-auto overflow-hidden border-b md:border-b-0 md:border-r border-border">
                    <div 
                      className="absolute inset-0 transition-transform duration-700 group-hover:scale-110"
                      style={{ background: ticket.gradient }}
                    />
                    <div className="absolute inset-0 bg-primary/10 mix-blend-overlay" />
                    <div className="absolute inset-0 flex items-center justify-center">
                        <span className="font-display font-black text-2xl tracking-[0.2em] text-white/20 rotate-90 whitespace-nowrap">ADMIT ONE</span>
                    </div>
                  </div>

                  {/* Middle Section - Info */}
                  <div className="flex-1 p-10 relative">
                    <div className="flex justify-between items-start mb-8">
                      <div>
                        <h2 className="text-3xl font-display font-bold text-neutral tracking-tight mb-2 leading-none">{ticket.eventName}</h2>
                        <div className="flex items-center gap-2 text-text-muted font-medium">
                          <svg className="w-4 h-4 text-accent" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                          </svg>
                          <span className="text-sm">{ticket.venue}</span>
                        </div>
                      </div>
                      <div className="bg-accent/10 border border-accent/20 text-accent px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-widest">
                        Aktivna
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-y-6 gap-x-12 border-t border-border pt-8">
                      <div>
                        <span className="text-[10px] font-bold uppercase tracking-widest text-text-muted block mb-1">Datum</span>
                        <span className="text-base font-bold text-neutral">{ticket.date}</span>
                      </div>
                      <div>
                        <span className="text-[10px] font-bold uppercase tracking-widest text-text-muted block mb-1">Vrijeme</span>
                        <span className="text-base font-bold text-neutral">{ticket.time}</span>
                      </div>
                      <div>
                        <span className="text-[10px] font-bold uppercase tracking-widest text-text-muted block mb-1">Cijena</span>
                        <span className="text-base font-bold text-neutral">{ticket.price}</span>
                      </div>
                      <div>
                        <span className="text-[10px] font-bold uppercase tracking-widest text-text-muted block mb-1">Broj karte</span>
                        <span className="text-base font-mono font-bold text-neutral opacity-40">#{ticket.id}</span>
                      </div>
                    </div>
                  </div>

                  {/* Right Section - QR Code (Stub) */}
                  <div className="w-full md:w-64 bg-surface p-10 flex flex-col items-center justify-center border-t md:border-t-0 md:border-l border-dashed border-border relative">
                    {/* Perforation circles */}
                    <div className="hidden md:block absolute -top-4 -left-4 w-8 h-8 bg-surface border border-border rounded-full" />
                    <div className="hidden md:block absolute -bottom-4 -left-4 w-8 h-8 bg-surface border border-border rounded-full" />
                    
                    <div className="bg-white p-3 border border-border rounded-2xl shadow-sm mb-4">
                       <div className="w-32 h-32 flex items-center justify-center relative overflow-hidden bg-white">
                          <img 
                            src={`https://api.qrserver.com/v1/create-qr-code/?size=128x128&data=${ticket.qrToken}&color=3D4F59`}
                            alt="Scan for entry"
                            className="w-full h-full"
                          />
                       </div>
                    </div>
                    <span className="text-text-muted text-[10px] font-bold uppercase tracking-[0.2em]">Pokaži na ulazu</span>
                  </div>
                </div>

                {/* Decorative glow */}
                <div className="absolute -inset-4 bg-accent/5 blur-3xl rounded-[3rem] -z-10 opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
              </div>
            </Reveal>
          ))}

          {MOCK_TICKETS.length === 0 && (
            <div className="py-32 text-center border-2 border-dashed border-border rounded-[3rem] bg-surface-white/50">
              <div className="w-16 h-16 bg-surface border border-border rounded-2xl flex items-center justify-center mx-auto mb-6 text-text-muted">
                 <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 5v2m0 4v2m0 4v2M5 5a2 2 0 00-2 2v3a2 2 0 110 4v3a2 2 0 002 2h14a2 2 0 002-2v-3a2 2 0 110-4V7a2 2 0 00-2-2H5z" />
                 </svg>
              </div>
              <h3 className="text-2xl font-display font-bold text-neutral mb-2">Novčanik je prazan</h3>
              <p className="text-text-muted mb-8 max-w-xs mx-auto">Vrijeme je da stvoriš nove uspomene. Pronađi idući izlazak.</p>
              <a href="/eventi" className="inline-flex items-center gap-2 px-10 py-4 bg-primary text-white rounded-full font-bold uppercase tracking-widest text-xs hover:bg-neutral transition-all shadow-lg shadow-primary/10">
                Istraži evente
              </a>
            </div>
          )}
        </div>
      </main>

      <Footer />
    </div>
  );
}
