# NOIR Landing Page — Implementation Checkpoint

## Project Identity
- **Name:** Noir (French for "black/night")
- **Tagline:** "Cijeli izlazak u jednom kliku" / "Your entire night out in one click"
- **Competition theme:** "Svijet nadohvat ruke" (World at your fingertips)
- **Target:** Students & young people (18-25) in Zagreb

## What Noir Is
A platform where users discover events, buy tickets, reserve tables, and purchase experience packages (entry + drinks + table) — all in a few taps. For organizers and venue owners, it's an operational tool (Creator Hub) for event creation, reservation management, ticket verification, and analytics.

## USP
- "We don't sell tickets — we sell the night out experience"
- Personalized tag-based event discovery (no ML needed)
- Transparent Early Bird tier pricing
- Free analytics for small organizers
- QR system with no extra hardware

## Color Palette (Slate Mist)
| Role       | HEX       | Description                              |
|------------|-----------|------------------------------------------|
| Primary    | `#3D4F59` | Deep slate — grounded, authoritative     |
| Secondary  | `#6B8FA3` | Airy mid-blue — nav bars, cards          |
| Accent     | `#7DB5C8` | Soft sky-blue — CTAs and highlights      |
| Background | `#F5F4F0` | Warm off-white — easy on the eyes        |
| Neutral    | `#2C3840` | Near-dark text color                     |

## Landing Page Requirements (from docs section 12.3)
1. **Hero section** — bold headline, subtext, CTA
2. **How it works** — 3 simple steps
3. **Features** — key value props
4. **CTA** — download app / browse events

## Design Principles (from docs section 12.1)
1. Minimal taps — max 4-5 to purchase
2. Show value before asking for anything — event feed visible before login
3. One screen, one task — one primary button per screen
4. Clean > fancy — nobody wants complexity at 23:00

## Tech Stack (Web)
- Next.js 16.1.6 (App Router)
- React 19
- Tailwind CSS 4
- TypeScript

## Three User Roles
1. **User** — discovers events, buys tickets/packages, QR wallet
2. **Organizer** — Creator Hub, creates events, analytics, QR scanner
3. **Venue Owner** — Creator Hub, manages venue, accepts inquiries, analytics

## Key Flows to Highlight on Landing
- Event discovery → purchase → QR entry (user flow)
- Creator Hub for organizers (B2B value prop)
- Package system (entry + drinks + table bundles)
