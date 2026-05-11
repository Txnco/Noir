"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";

interface CheckoutModalProps {
  isOpen: boolean;
  onClose: () => void;
  event: {
    id: string | number;
    name: string;
    price: number;
  };
}

export default function CheckoutModal({ isOpen, onClose, event }: CheckoutModalProps) {
  const [step, setStep] = useState<"form" | "loading" | "success">("form");
  const [cvv, setCvv] = useState("");

  const maskedCvv = Array(cvv.length).fill("•").join("");

  useEffect(() => {
    if (!isOpen) {
      setStep("form");
      setCvv("");
    }
  }, [isOpen]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setStep("loading");
    
    // Simulating API call and processing
    setTimeout(() => {
      setStep("success");
    }, 2500);
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
        {/* Backdrop - warm blur */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
          className="absolute inset-0 bg-primary/20 backdrop-blur-md"
        />

        {/* Modal Content - Noir Light Theme */}
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 20 }}
          className="relative w-full max-w-md overflow-hidden bg-surface-white border border-border rounded-[2rem] shadow-2xl"
        >
          {/* Subtle noise overlay */}
          <div 
            className="pointer-events-none absolute inset-0 opacity-[0.03] mix-blend-multiply" 
            style={{ backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='3'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E")` }}
          />

          {step === "form" && (
            <div className="p-10 relative">
              <h2 className="text-4xl font-display font-bold mb-1 text-neutral tracking-tight">Osiguraj mjesto</h2>
              <p className="text-text-muted mb-8 font-medium">
                {event.name} — <span className="text-primary">{event.price === 0 ? "Besplatno" : `${event.price}€`}</span>
              </p>

              <form onSubmit={handleSubmit} className="space-y-5">
                <div className="space-y-1.5">
                  <label className="text-[10px] uppercase tracking-[0.2em] text-text-muted font-bold ml-1">Vlasnik kartice</label>
                  <input
                    required
                    type="text"
                    className="w-full bg-surface border border-border rounded-xl px-5 py-3.5 text-neutral placeholder:text-text-muted/50 focus:outline-none focus:border-accent focus:ring-4 focus:ring-accent/10 transition-all font-medium"
                    placeholder="IME I PREZIME"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-[10px] uppercase tracking-[0.2em] text-text-muted font-bold ml-1">Broj kartice</label>
                  <div className="relative">
                    <input
                      required
                      type="text"
                      className="w-full bg-surface border border-border rounded-xl px-5 py-3.5 text-neutral placeholder:text-text-muted/50 focus:outline-none focus:border-accent focus:ring-4 focus:ring-accent/10 transition-all font-medium"
                      placeholder="**** **** **** ****"
                    />
                    <div className="absolute right-4 top-1/2 -translate-y-1/2 flex gap-1">
                      <div className="w-6 h-4 bg-primary/10 rounded-sm" />
                      <div className="w-6 h-4 bg-primary/20 rounded-sm" />
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-[10px] uppercase tracking-[0.2em] text-text-muted font-bold ml-1">Istek</label>
                    <input
                      required
                      type="text"
                      className="w-full bg-surface border border-border rounded-xl px-5 py-3.5 text-neutral placeholder:text-text-muted/50 focus:outline-none focus:border-accent focus:ring-4 focus:ring-accent/10 transition-all font-medium"
                      placeholder="MM/YY"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[10px] uppercase tracking-[0.2em] text-text-muted font-bold ml-1">CVV</label>
                    <input
                      required
                      type="text"
                      maxLength={3}
                      value={cvv}
                      onChange={(e) => setCvv(e.target.value.replace(/\D/g, ""))}
                      style={{ WebkitTextSecurity: 'disc' } as any}
                      className="w-full bg-surface border border-border rounded-xl px-5 py-3.5 text-neutral focus:outline-none focus:border-accent focus:ring-4 focus:ring-accent/10 transition-all font-medium tracking-[0.2em]"
                      placeholder="***"
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  className="w-full mt-6 bg-primary text-white py-4.5 rounded-2xl font-bold uppercase tracking-[0.15em] text-xs hover:bg-neutral hover:shadow-xl hover:shadow-primary/20 transition-all active:scale-[0.98] shadow-lg shadow-primary/10"
                >
                  Dovrši kupnju
                </button>
                
                <p className="text-center text-[10px] text-text-muted font-medium tracking-wide">
                  Osigurano putem Noir Payment Gateway sustava
                </p>
              </form>
            </div>
          )}

          {step === "loading" && (
            <div className="p-16 flex flex-col items-center justify-center text-center space-y-8 relative">
              <div className="relative">
                <div className="w-20 h-20 border-4 border-accent/20 border-t-accent rounded-full animate-spin" />
                <div className="absolute inset-0 flex items-center justify-center">
                  <span className="font-display font-black text-[10px] tracking-tighter text-accent">NOIR</span>
                </div>
              </div>
              <div>
                <h3 className="text-2xl font-display font-bold text-neutral">Obrađujemo...</h3>
                <p className="text-text-muted text-sm mt-2 font-medium">Trenutak, provjeravamo podatke s bankom.</p>
              </div>
            </div>
          )}

          {step === "success" && (
            <div className="p-10 flex flex-col items-center text-center relative">
              <div className="w-20 h-20 bg-accent/10 text-accent rounded-full flex items-center justify-center mb-8 shadow-inner">
                <svg className="w-10 h-10" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                </svg>
              </div>
              
              <h2 className="text-4xl font-display font-bold text-neutral tracking-tight mb-2">Karta je tvoja!</h2>
              <p className="text-text-muted mb-10 font-medium">Uživaj u eventu. Karta te čeka u tvojem Noir profilu.</p>

              <div className="bg-surface rounded-[2rem] p-8 border border-border shadow-inner mb-10 relative">
                <div className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-surface-white px-4 py-1 border border-border rounded-full text-[10px] font-bold tracking-widest text-text-muted uppercase">Digitalni Ulaz</div>
                
                {/* Real QR Code using GoQR API */}
                <div className="w-40 h-40 bg-white p-2 border border-border rounded-xl shadow-sm flex items-center justify-center overflow-hidden">
                   <img 
                    src={`https://api.qrserver.com/v1/create-qr-code/?size=160x160&data=noir-ticket-${event.id}-${Date.now()}&color=3D4F59`}
                    alt="Ticket QR Code"
                    className="w-full h-full"
                   />
                </div>
              </div>

              <button
                onClick={() => window.location.href = "/wallet"}
                className="w-full bg-surface-white text-primary border-2 border-primary py-4 rounded-2xl font-bold uppercase tracking-[0.15em] text-xs hover:bg-primary hover:text-white transition-all shadow-sm"
              >
                Pregledaj u novčaniku
              </button>
            </div>
          )}
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
