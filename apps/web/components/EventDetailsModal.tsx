"use client";

import { motion, AnimatePresence } from "framer-motion";

interface EventDetailsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onPurchase: () => void;
  event: {
    id: string | number;
    name: string;
    venue: string;
    description?: string;
    dateLabel: string;
    price: number;
    gradient?: string;
    tags?: string[];
    min_age?: number;
  };
}

export default function EventDetailsModal({ isOpen, onClose, onPurchase, event }: EventDetailsModalProps) {
  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
        {/* Backdrop */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
          className="absolute inset-0 bg-primary/20 backdrop-blur-md"
        />

        {/* Modal Content */}
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 20 }}
          className="relative w-full max-w-2xl overflow-hidden bg-surface-white border border-border rounded-[2.5rem] shadow-2xl flex flex-col md:flex-row"
        >
          {/* Subtle noise overlay */}
          <div 
            className="pointer-events-none absolute inset-0 opacity-[0.03] mix-blend-multiply" 
            style={{ backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='3'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E")` }}
          />

          {/* Left: Visual/Cover */}
          <div className="relative w-full md:w-2/5 h-48 md:h-auto overflow-hidden">
             <div
                className="absolute inset-0"
                style={{ background: event.gradient || "linear-gradient(135deg, #1e1b4b 0%, #4338ca 50%, #7c3aed 100%)" }}
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/40 to-transparent" />
              
              <div className="absolute bottom-6 left-6">
                <div className="rounded-full bg-white/20 backdrop-blur-md px-3 py-1 text-[10px] font-bold text-white uppercase tracking-widest border border-white/30">
                  {event.min_age ? `${event.min_age}+` : "Svi uzrasti"}
                </div>
              </div>
          </div>

          {/* Right: Content */}
          <div className="p-8 md:p-10 flex-1 relative flex flex-col">
            <button 
              onClick={onClose}
              className="absolute top-6 right-6 p-2 rounded-full hover:bg-surface transition-colors"
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M18 6L6 18M6 6l12 12" />
              </svg>
            </button>

            <div className="mb-6">
              <h2 className="text-3xl font-display font-bold text-neutral tracking-tight mb-2 leading-tight">
                {event.name}
              </h2>
              <div className="flex flex-col gap-2">
                <div className="flex items-center gap-2 text-primary font-semibold">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0118 0z" />
                    <circle cx="12" cy="10" r="3" />
                  </svg>
                  <span className="text-sm">{event.venue}</span>
                </div>
                <div className="flex items-center gap-2 text-text-muted">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
                    <line x1="16" y1="2" x2="16" y2="6" />
                    <line x1="8" y1="2" x2="8" y2="6" />
                    <line x1="3" y1="10" x2="21" y2="10" />
                  </svg>
                  <span className="text-sm font-medium">{event.dateLabel}</span>
                </div>
              </div>
            </div>

            <div className="flex-1">
              <p className="text-text-muted text-sm leading-relaxed mb-6">
                {event.description || "Nema opisa za ovaj događaj."}
              </p>

              {event.tags && event.tags.length > 0 && (
                <div className="flex flex-wrap gap-2 mb-8">
                  {event.tags.map(tag => (
                    <span key={tag} className="px-2.5 py-1 rounded-full bg-accent/10 text-primary text-[10px] font-bold uppercase tracking-wider">
                      #{tag}
                    </span>
                  ))}
                </div>
              )}
            </div>

            <div className="pt-6 border-t border-border flex items-center justify-between mt-auto">
              <div>
                <p className="text-[10px] uppercase tracking-widest text-text-muted font-bold mb-0.5">Cijena od</p>
                <p className="text-2xl font-display font-bold text-neutral">
                  {event.price === 0 ? "Besplatno" : `${event.price}€`}
                </p>
              </div>
              <button
                onClick={onPurchase}
                className="bg-primary text-white px-8 py-4 rounded-2xl font-bold uppercase tracking-[0.1em] text-xs hover:bg-neutral hover:shadow-xl hover:shadow-primary/20 transition-all active:scale-[0.98] shadow-lg shadow-primary/10"
              >
                Kupi ulaznicu
              </button>
            </div>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
