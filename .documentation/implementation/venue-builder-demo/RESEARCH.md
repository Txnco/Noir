# Venue Builder Demo — Research & Technical Decisions

> Prepared before implementation. Identifies deviations from the plan, open questions, and recommended approaches.

---

## 1. Critical: Tailwind v4 vs v3 Mismatch

**Plan says:** Tailwind CSS v3 (with `tailwind.config.ts` + `theme.extend.colors`)
**Project has:** Tailwind CSS v4 (`"tailwindcss": "^4"`)

### Differences that affect implementation

| Topic | Tailwind v3 (plan) | Tailwind v4 (actual) |
|---|---|---|
| Config file | `tailwind.config.ts` | No config file (CSS-first) |
| Custom colors | `theme.extend.colors.noir` | `@theme` block in CSS |
| Import | `@tailwind base/components/utilities` | `@import "tailwindcss"` |
| Arbitrary values | `bg-[#456981]` | Same — works in both |
| CSS variables | Manual | Built-in via `@theme` |

### Recommendation: Stay on v4, adapt the approach

The project is already bootstrapped with v4. Downgrading would be unnecessary churn. Instead:

**Define NOIR design tokens in `globals.css`:**
```css
@import "tailwindcss";

@theme {
  --color-noir-primary: #456981;
  --color-noir-primary-dark: #3D4F59;
  --color-noir-secondary: #6B8FA3;
  --color-noir-accent: #7DB5C8;
  --color-noir-bg: #F5F4F0;
  --color-noir-neutral: #2C3840;
  --color-noir-border: #D8E2E8;
  --color-noir-border-subtle: #EDF1F4;
  --color-canvas-bg: #F5F4F0;
  --color-dot-grid: #C5D0D8;

  --radius-sm: 6px;
  --radius-md: 8px;
  --radius-lg: 12px;
}
```

This generates `bg-noir-primary`, `text-noir-neutral`, etc. — same Tailwind utility classes, different config mechanism.

**Arbitrary values (e.g., `bg-[#456981]`) still work** in v4, so most plan code works as-is.

---

## 2. React 19 + Zustand Compatibility

**Project has:** React 19.2.3

**Recommendation:** Install Zustand v5 (supports React 19 fully).

```bash
npm install zustand@^5 lucide-react uuid
npm install --save-dev @types/uuid
```

Zustand v5 changes from v4:
- `create()` import is the same
- `subscribeWithSelector` middleware still exists
- No breaking changes for the patterns in the plan

---

## 3. Next.js 16 App Router — File Save

The plan uses a Next.js API route (`app/api/venue-builder/save/route.ts`) to write JSON to `public/venues/`. This is **the right approach** for a frontend-only demo — it doesn't require FastAPI.

**One concern:** In Next.js 16, `process.cwd()` in API routes resolves to the Next.js project root (`apps/web/`). So `path.join(process.cwd(), 'public', 'venues', venue_id)` → `apps/web/public/venues/{venue_id}/` — correct.

**Caveat:** Files written to `public/` at runtime are served statically but are not in the git-tracked build. For the demo this is fine.

---

## 4. SVG Canvas vs Canvas API

The plan specifies **native SVG** (no react-konva, fabric.js, etc.). This is the right call for this use case:

**Pros of SVG approach:**
- React renders SVG natively — no separate canvas lifecycle
- CSS/Tailwind styles apply to SVG elements directly
- Hit testing is automatic (browser handles it)
- Selection/hover states via React state
- No canvas coordinate system complexity

**Cons / things to watch:**
- Large numbers of items (500+) can cause performance issues — plan addresses this with `React.memo`
- SVG text rendering can be inconsistent at small zoom levels — set `font-size` in world coords, scale inversely with zoom
- `pointer-events` must be set carefully on text labels (`pointer-events: none`) or clicks pass through

**Performance pattern for drag state:**
```typescript
// Use useRef (not useState) for drag tracking — avoids re-renders during mousemove
const dragState = useRef({ isDragging: false, startX: 0, startY: 0, ... });
```

---

## 5. Pan/Zoom Implementation

The plan has correct zoom math. One subtle point:

**Zoom centered on mouse cursor:**
```typescript
const scale = newZoom / viewport.zoom;
const newX = mouseX - (mouseX - viewport.x) * scale;
const newY = mouseY - (mouseY - viewport.y) * scale;
```
This keeps the canvas point under the cursor fixed — standard behavior.

**Coordinate conversion (critical for all interactions):**
```typescript
// Screen → World (canvas) coordinates
const canvasX = (screenX - svgRect.left - viewport.x) / viewport.zoom;
const canvasY = (screenY - svgRect.top - viewport.y) / viewport.zoom;
```
Every placement, hit test, and drag MUST use this conversion. Easy to forget.

---

## 6. `use client` Boundary Strategy

In Next.js App Router, the rule is: interactive = `'use client'`.

**Server components (no `use client`):**
- `app/venue-builder/page.tsx` — can be server component that just renders `<VenueBuilder />`
- `app/venue-builder/[venue_id]/page.tsx` — same

**Client components (all need `'use client'`):**
- Everything in `components/venue-builder/`
- Everything in `hooks/venue-builder/`
- `store/venueBuilderStore.ts`

**Recommendation:** Put `'use client'` on `VenueBuilder.tsx` (the root) and it cascades. Don't put it on every single sub-component — they inherit it when imported from a client component.

Actually for Zustand stores: the store itself doesn't need `'use client'` since it's not a component. But components that use `useStore` hooks must be client components.

---

## 7. Polygon Section Drawing

The plan describes polygon drawing (click → add point, double-click → close). Implementation notes:

- Store in-progress polygon points in a local `useRef` (not in Zustand) — this is transient UI state
- When double-clicking on the first point (within ~10px), also close the polygon
- Preview: render a `<polyline>` + a line from last point to cursor
- ESC clears the preview ref

---

## 8. Undo/Redo Strategy

The plan says: push history on every "completed action" (mouseUp, input blur), not on every mousemove.

**Max 10 entries** — implement as a circular buffer or just slice array:
```typescript
const MAX_HISTORY = 10;
const newHistory = [...history.slice(0, historyIndex + 1), snapshot].slice(-MAX_HISTORY);
```

**What goes in history:** `{ sections, items, statics }` — NOT viewport (pan/zoom stays independent).

---

## 9. BatchItemModal — Grid Calculation

When batch-adding seats inside a section, need to calculate grid positions relative to the section:

```typescript
// For a rect section at (sx, sy) with (sw, sh):
const startX = sx + seatSpacing / 2;
const startY = sy + rowSpacing / 2;

for (let row = 0; row < numRows; row++) {
  for (let col = 0; col < seatsPerRow; col++) {
    const x = startX + col * (seatWidth + seatSpacing);
    const y = startY + row * (seatHeight + rowSpacing);
    // Check x + seatWidth < sx + sw  (clip to section bounds)
  }
}
```

---

## 10. Open Questions for User

1. **Tailwind v4:** Confirmed — staying on v4 is the right call. No action needed from user.

2. **Save destination:** The plan saves to `public/venues/{venue_id}/v{N}.json` via an API route. For a demo, should we also include a "Download JSON" button (client-side, no API needed) as a simpler fallback? This would work even in a static export.

3. **Demo data:** Should there be a pre-loaded demo venue that opens when visiting `/venue-builder` (so reviewers can immediately see a working example), or start blank?

4. **Lucide icons used in plan:** `Armchair`, `Sofa` — verify these exist in the version of lucide-react we install. Some icons were added in newer versions.

5. **Font:** The plan says use `Geist` font (comes with Next.js). The current `layout.tsx` likely already has Geist. No change needed.

---

## 11. Implementation Phase Summary

From the plan's 9 phases, here is a risk/complexity assessment:

| Phase | Complexity | Risk | Notes |
|---|---|---|---|
| 1. Types + Store + Shell | Low | Low | Pure TypeScript, no UI |
| 2. Canvas Rendering | Medium | Low | SVG rendering, no interaction |
| 3. LeftToolbar + Drawing | Medium | Medium | Section draw state machine |
| 4. Selection + Drag | High | High | Coordinate math, edge cases |
| 5. Properties Panels | Low | Low | Forms + store bindings |
| 6. Undo/Redo | Medium | Medium | History splice logic |
| 7. Batch + Context + Minimap | Medium | Low | Isolated components |
| 8. Save Flow | Low | Low | File write + validation |
| 9. Onboarding + Polish | Low | Low | UX layer on top |

**Critical path:** Phases 1-4 are the hardest and most interdependent. Get Phase 4 right before moving on.

---

*Research completed: March 2026. Ready to begin implementation.*
