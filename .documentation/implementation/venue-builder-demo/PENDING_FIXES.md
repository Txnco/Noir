# Pending Fixes & Known Issues

> These must be resolved before the app compiles and runs correctly.
> Priority order: P1 = blocks compilation, P2 = blocks runtime, P3 = broken feature.

---

## P1 — Compilation Blockers

### 1. Lucide-react icon substitutions (`LeftToolbar.tsx`)

`lucide-react@1.7.0` does not include all icons used. Replace the following:

| Used (may not exist) | Replace with |
|---|---|
| `Pentagon` | `Hexagon` (or just use `PenTool` with a label) |
| `CircleDot` | `Target` |
| `Armchair` | `Armchair` — verify; if missing use `Chair` or `PersonStanding` |
| `Sofa` | `Sofa` — verify; if missing use `LayoutTemplate` |

**File:** `components/venue-builder/LeftToolbar.tsx`
**Fix:** Run `npm run dev`, check the import error, swap out missing icon names.

Also check in `RightPanel.tsx`:
- `Armchair` — same as above

---

### 2. `uuid` v13 — ESM import in Next.js

`uuid@13` is ESM-only. The import `import { v4 as uuidv4 } from 'uuid'` may cause issues with Turbopack/Next.js CJS interop.

**Files affected:**
- `components/venue-builder/Canvas.tsx`
- `components/venue-builder/BatchItemModal.tsx`
- `components/venue-builder/VenueBuilder.tsx`

**Fix if it breaks:** Downgrade uuid to v9 (`npm install uuid@^9 @types/uuid@^9`) which is CJS-compatible.
```bash
cd apps/web && npm install uuid@^9 @types/uuid@^9
```
Imports stay the same.

---

## P2 — Runtime Bugs

### 3. Stale closure in Canvas.tsx drag handlers

**Problem:** Inside `useCallback` handlers (handleMouseMove, handleMouseUp), accessing `store.items`, `store.sections`, `store.statics` reads the closure value from when the callback was created, not the current state.

**Affected operations:** item dragging, section dragging, marquee select.

**Fix:** Replace direct `store.items` / `store.sections` / `store.statics` reads inside event handlers with `useBuilderStore.getState().items` etc.

Example fix in `handleMouseMove`:
```typescript
// Instead of:
const item = store.items.find((i) => i.id === d.targetId);

// Use:
const item = useBuilderStore.getState().items.find((i) => i.id === d.targetId);
```

**Files:** `components/venue-builder/Canvas.tsx` — all `useCallback` handlers that read `store.items`, `store.sections`, `store.statics`.

---

### 4. `VenueBuilder.tsx` — stale `store` in `doSave`

**Problem:** `doSave` is in `useCallback([store])` but `store` from `useBuilderStore()` is the whole store object. When destructured state updates, `store` reference changes so this should be fine, BUT the `performSave` inner function closes over `store` without being in the dep array.

**Fix:** In `performSave`, use `useBuilderStore.getState()` instead of the closed-over `store`:
```typescript
async function performSave(silent: boolean) {
  const { sections, items, statics, venue_id, layout_version } = useBuilderStore.getState();
  // ...
}
```

**File:** `components/venue-builder/VenueBuilder.tsx`

---

### 5. Canvas.tsx — `selectElement` updates `_selected` incorrectly

**Problem:** In `selectElement` in the store, after calling `set({ selection: ... })`, the second `set()` call that marks `_selected` reads `state.selection.ids` but this is the PREVIOUS selection (Zustand's `set` is batched in React 18+).

**Fix:** In `venueBuilderStore.ts`, rewrite `selectElement` to do both operations in a single `set()` call, deriving the new IDs inline:
```typescript
selectElement: (id, type, addToSelection = false) => {
  set((state) => {
    let newIds: string[];
    if (addToSelection && state.selection.type === type) {
      const already = state.selection.ids.includes(id);
      newIds = already ? state.selection.ids.filter(s => s !== id) : [...state.selection.ids, id];
    } else {
      newIds = [id];
    }
    const idSet = new Set(newIds);
    return {
      selection: { type, ids: newIds },
      rightPanelOpen: true,
      sections: type === 'section' ? state.sections.map(s => ({ ...s, _selected: idSet.has(s.id) })) : state.sections.map(s => ({ ...s, _selected: false })),
      items: type === 'item' ? state.items.map(i => ({ ...i, _selected: idSet.has(i.id) })) : state.items.map(i => ({ ...i, _selected: false })),
      statics: type === 'static' ? state.statics.map(s => ({ ...s, _selected: idSet.has(s.id) })) : state.statics.map(s => ({ ...s, _selected: false })),
    };
  });
},
```

**File:** `store/venueBuilderStore.ts`

---

## P3 — Broken Features (compile fine, but don't work)

### 6. BatchItemModal not wired up

**Problem:** `BatchItemModal` component exists but is never rendered. No button triggers it.

**Fix:** Add state to `SectionPanel.tsx` and a button:
```typescript
// In SectionPanel.tsx — add near the top:
const [showBatch, setShowBatch] = useState(false);

// In the JSX, after the items count display:
{section.is_numbered && (
  <button onClick={() => setShowBatch(true)}
    className="w-full text-xs border border-[#456981] text-[#456981] rounded-lg py-2 hover:bg-[#E8EEF2]">
    + Batch add seats
  </button>
)}

{showBatch && (
  <BatchItemModal sectionId={section.id} onClose={() => setShowBatch(false)} />
)}
```

Also wire it from `ContextMenu.tsx` for the section context menu item "Add seats to section".

**Files:** `components/venue-builder/panels/SectionPanel.tsx`, `components/venue-builder/ContextMenu.tsx`

---

### 7. ContextMenu section options not wired to BatchItemModal

**Problem:** ContextMenu has placeholder for "Add seats to section" but it's not implemented (not even in the current ContextMenu code — it was omitted).

**Fix:** Add it to the section context menu items in `ContextMenu.tsx`. The ContextMenu would need to manage a `showBatchModal` state and render `BatchItemModal`.

---

### 8. Drag pushes history on every pixel moved (performance)

**Problem:** In `Canvas.tsx` `handleMouseMove`, `store.updateItem` / `store.updateSection` / `store.updateStaticObject` are called on every pixel of movement. These don't call `pushHistory` (correct), but they do call `markDirty` which triggers re-renders.

**Status:** Low priority — works but may be slow for many items. The history is correctly only pushed on `mouseUp`.

---

### 9. Minimap uses `foreignObject` — may not render in all browsers

**Problem:** `Minimap.tsx` uses `<foreignObject>` to wrap a `<div>` inside SVG for the backdrop-blur styling. Some SVG contexts have issues with `foreignObject`.

**Fix:** Rewrite Minimap as pure SVG (no foreignObject), position it absolutely as an HTML overlay outside the SVG element instead. Move the minimap `<div>` outside the `<svg>` in `Canvas.tsx` and position it with CSS `absolute bottom-4 right-4`.

---

### 10. `app/venue-builder/page.tsx` — `VenueBuilder` is a Client Component imported in a Server Component

**Problem:** `VenueBuilder.tsx` has `'use client'` but the import is from a page.tsx without `'use client'`. This is actually fine in Next.js App Router — server components CAN import client components. But the `export const metadata` in the same file as a default export of a client component wrapper may cause a warning.

**Fix (optional):** This likely works as-is since `VenueBuilder` is a client component and the page just renders it. No action needed unless Next.js warns.

---

## Fix Order Recommended

1. **P1-1**: Fix lucide icons (run dev, see what's missing, swap)
2. **P1-2**: Test uuid import — downgrade to v9 if Turbopack complains
3. **P2-5**: Fix `selectElement` in store (single set call)
4. **P2-3**: Fix stale closures in Canvas.tsx (use `getState()`)
5. **P2-4**: Fix stale closure in VenueBuilder.tsx (use `getState()`)
6. **P3-6**: Wire BatchItemModal into SectionPanel
7. **P3-7**: Wire BatchItemModal into ContextMenu
8. **P3-9**: Fix Minimap foreignObject → HTML overlay

---

*Created: 2026-03-27. Update as fixes are applied.*
