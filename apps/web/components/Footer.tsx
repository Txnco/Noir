interface FooterLink {
  label: string;
  href: string;
}

interface FooterProps {
  links?: FooterLink[];
}

const defaultLinks: FooterLink[] = [
  { label: "Kako radi", href: "/#kako-radi" },
  { label: "Za organizatore", href: "/#za-organizatore" },
  { label: "Kontakt", href: "mailto:info@noir.hr" },
];

export default function Footer({ links = defaultLinks }: FooterProps) {
  return (
    <footer id="kontakt" className="border-t border-border bg-surface-white/40 py-14">
      <div className="mx-auto max-w-6xl px-6">
        <div className="flex flex-col items-center gap-8 md:flex-row md:justify-between">
          <div>
            <span className="font-display text-lg font-extrabold tracking-[0.18em] text-primary">
              NOIR
            </span>
            <p className="mt-1 text-sm text-text-muted">Cijeli izlazak u jednom kliku.</p>
          </div>

          <div className="flex items-center gap-8">
            {links.map((link) => (
              <a
                key={link.href}
                href={link.href}
                className="text-sm text-text-muted transition-colors hover:text-primary"
              >
                {link.label}
              </a>
            ))}
          </div>
        </div>

        <div className="mt-10 flex flex-col items-center justify-between gap-4 border-t border-border pt-8 md:flex-row">
          <p className="text-xs text-text-muted">&copy; 2026 Noir. Sva prava pridržana.</p>
          <div className="flex gap-6">
            <a href="#" className="text-xs text-text-muted transition-colors hover:text-primary">
              Privatnost
            </a>
            <a href="#" className="text-xs text-text-muted transition-colors hover:text-primary">
              Uvjeti korištenja
            </a>
          </div>
        </div>
      </div>
    </footer>
  );
}
