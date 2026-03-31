# Venue Builder Demo — Implementation State

> Legend: `[ ]` = not started · `[~]` = in progress · `[x]` = done · `[!]` = blocked / needs fix

---

## Environment

- Route: `apps/web/app/venue-builder/`
- Next.js: 16.1.6 (App Router, Turbopack)
- React: 19.2.3
- Tailwind: v4 (CSS-first config, no tailwind.config.ts)
- Zustand: v5.0.12 ✅ installed
- lucide-react: v1.7.0 ✅ installed (icon issues — see PENDING_FIXES.md)
- uuid: v13.0.0 ✅ installed
- @types/uuid: v10.0.0 ✅ installed

---

## Dependencies

| Package | Status | Notes |
|---|---|---|
| zustand | `[x]` | v5.0.12 |
| lucide-react | `[x]` | v1.7.0 — some icons may be missing, see fixes |
| uuid + @types/uuid | `[x]` | v13 + v10 |

---

## Phase 1: Foundation (types, store, shell)

| File | Status | Notes |
|---|---|---|
| `types/venueBuilder.ts` | `[x]` | All TypeScript types |
| `lib/venue-builder/shapePresets.ts` | `[x]` | SVG path defs + seat/table preset lists |
| `lib/venue-builder/sectionDefaults.ts` | `[x]` | Default colors/icons per section type |
| `lib/venue-builder/snapUtils.ts` | `[x]` | snapToGrid, snapPoint |
| `lib/venue-builder/labelGenerator.ts` | `[x]` | generateSeatLabel, generateTableLabel |
| `store/venueBuilderStore.ts` | `[x]` | Full Zustand store with all actions |
| `app/venue-builder/page.tsx` | `[x]` | Entry route |
| `app/venue-builder/[venue_id]/page.tsx` | `[x]` | Edit existing venue route |
| `components/venue-builder/VenueBuilder.tsx` | `[x]` | Root compositor — layout + save logic |
| `app/globals.css` (NOIR tokens) | `[x]` | @theme with all NOIR colors |

---

## Phase 2: Canvas Rendering

| File | Status | Notes |
|---|---|---|
| `components/venue-builder/CanvasGrid.tsx` | `[x]` | Dot grid SVG pattern |
| `components/venue-builder/CanvasSections.tsx` | `[x]` | Rect + polygon, resize handles |
| `components/venue-builder/CanvasItems.tsx` | `[x]` | All shape presets rendered |
| `components/venue-builder/CanvasStaticObjects.tsx` | `[x]` | Rect + polygon static objects |
| `components/venue-builder/Canvas.tsx` | `[x]` | Stale closure bugs fixed — all event handlers use `getState()` |

---

## Phase 3: LeftToolbar + Placing Elements

| File | Status | Notes |
|---|---|---|
| `components/venue-builder/TopBar.tsx` | `[x]` | All controls, venue dropdown |
| `components/venue-builder/LeftToolbar.tsx` | `[x]` | All icons confirmed present in lucide-react v1.7.0 |
| `components/venue-builder/CanvasSectionDraw.tsx` | `[x]` | Rect + polygon draw preview |
| Canvas: place_item mode | `[x]` | Implemented in Canvas.tsx |
| Canvas: place_static mode | `[x]` | Implemented in Canvas.tsx |

---

## Phase 4: Selection & Drag

| File | Status | Notes |
|---|---|---|
| `components/venue-builder/CanvasSelection.tsx` | `[x]` | Marquee select box |
| Canvas: click to select | `[x]` | Single + multi with Shift |
| Canvas: drag to move | `[x]` | Fixed — uses `getState()` for live positions |
| Canvas: resize handles (rect sections) | `[x]` | 8 handles in CanvasSections |
| `hooks/venue-builder/useBuilderKeyboard.ts` | `[x]` | All shortcuts |

---

## Phase 5: Properties Panels

| File | Status | Notes |
|---|---|---|
| `components/venue-builder/RightPanel.tsx` | `[x]` | Shell + slide |
| `components/venue-builder/panels/SectionPanel.tsx` | `[x]` | |
| `components/venue-builder/panels/ItemPanel.tsx` | `[x]` | |
| `components/venue-builder/panels/StaticObjectPanel.tsx` | `[x]` | |
| `components/venue-builder/panels/EmptyPanel.tsx` | `[x]` | Stats + shortcuts cheatsheet |
| `components/venue-builder/FloatingItemEditor.tsx` | `[x]` | Double-click mini editor |

---

## Phase 6: Undo/Redo & History

| File | Status | Notes |
|---|---|---|
| History logic | `[x]` | Built into Zustand store (pushHistory, undo, redo) |
| TopBar Undo/Redo buttons | `[x]` | With disabled states |

Note: `useHistory.ts` and other hooks from plan (useCanvasPan, useCanvasZoom, useItemDrag, useItemResize, useMinimap) were intentionally inlined into Canvas.tsx and Minimap.tsx — no separate hook files needed.

---

## Phase 7: Batch, Context Menu, Minimap

| File | Status | Notes |
|---|---|---|
| `components/venue-builder/BatchItemModal.tsx` | `[x]` | Wired into SectionPanel (button) and ContextMenu (right-click) |
| `components/venue-builder/ContextMenu.tsx` | `[x]` | Right-click menu |
| `components/venue-builder/Minimap.tsx` | `[x]` | 160×110 overview, click to navigate |

---

## Phase 8: Save Flow

| File | Status | Notes |
|---|---|---|
| `lib/venue-builder/canvasCrop.ts` | `[x]` | Normalize canvas bounds on save |
| `lib/venue-builder/jsonSerializer.ts` | `[x]` | Store → VenueBuilderJSON v2 |
| `lib/venue-builder/jsonParser.ts` | `[x]` | Implemented as `loadFromJSON` in store — no separate file needed |
| `lib/venue-builder/saveToFile.ts` | `[x]` | saveVenueJSON, listSavedVenues, loadVenueJSON |
| `app/api/venue-builder/save/route.ts` | `[x]` | POST — write JSON to public/venues/ |
| `app/api/venue-builder/load/route.ts` | `[x]` | GET — read JSON, latest version support |
| `app/api/venue-builder/list/route.ts` | `[x]` | GET — list saved venue directories |
| `components/venue-builder/ValidationModal.tsx` | `[x]` | Hard errors + soft warnings |
| `components/venue-builder/SaveNotification.tsx` | `[x]` | Toast: saving/saved/error states |
| `hooks/venue-builder/useAutosave.ts` | `[x]` | 30s interval autosave |

---

## Phase 9: Onboarding & Polish

| File | Status | Notes |
|---|---|---|
| `components/venue-builder/OnboardingOverlay.tsx` | `[x]` | 3-step walkthrough |
| Tooltips on toolbar buttons | `[x]` | Implemented in LeftToolbar via ToolButton |
| Animations | `[x]` | CSS transitions in globals.css |
| Edge cases + error states | `[x]` | All pending fixes resolved |

---

## Open Decisions

| # | Decision | Status | Resolution |
|---|---|---|---|
| 1 | Tailwind v4 vs v3 | ✅ Resolved | Stay on v4, use `@theme` in CSS |
| 2 | Demo pre-loaded venue? | ✅ Resolved | Blank canvas. TopBar dropdown lists saved venues from public/venues/ |
| 3 | Download JSON button? | ✅ Resolved | Keep file-save API route, no extra download button needed |
| 4 | Lucide icon availability | ✅ Resolved | Documented in PENDING_FIXES.md — need substitutions |

---

## Notes / Issues

- All pending fixes applied. App compiles and runs. TypeScript: 0 errors.
- Dev server runs at http://localhost:3000/venue-builder
- All files created: 22 components, 7 lib utilities, 2 hooks, 3 API routes, 1 store, 1 types file, 2 pages.

*Last updated: 2026-03-27*
