# NOIR Venue Builder — Implementation Plan

> **Za Claude Code:** Ovo je kompletan vodič za implementaciju standalone Venue Buildera unutar `apps/web/` foldera Next.js projekta. Čitaj cijeli dokument prije pisanja ijedne linije koda.
>
> Stack: Next.js 16 (App Router) · TypeScript · Tailwind CSS v3 · Lucide React · Zustand · plain SVG (bez canvas biblioteka)
>
> Verzija plana: 1.0 | Ožujak 2026.

---

## Sadržaj

1. [Cilj i opseg](#1-cilj-i-opseg)
2. [Folder struktura](#2-folder-struktura)
3. [Instalacija ovisnosti](#3-instalacija-ovisnosti)
4. [TypeScript tipovi](#4-typescript-tipovi)
5. [Zustand store](#5-zustand-store)
6. [Utility funkcije](#6-utility-funkcije)
7. [Komponente — detaljan opis](#7-komponente)
8. [Dizajn sistem i CSS varijable](#8-dizajn-sistem)
9. [Keyboard shortcuti](#9-keyboard-shortcuti)
10. [Save flow i file struktura](#10-save-flow)
11. [Onboarding flow](#11-onboarding-flow)
12. [Validacija](#12-validacija)
13. [Rubni slučajevi i napomene](#13-rubni-slučajevi)
14. [Redoslijed implementacije](#14-redoslijed-implementacije)

---

## 1. Cilj i opseg

Standalone interaktivni venue builder koji:
- Radi isključivo na frontendu (nema backend poziva, nema Supabase)
- Sprema JSON na disk u `apps/web/public/venues/{venue_id}/v{N}.json`
- Prati NOIR JSON Schema v2.0 (dokumentirano u sekciji 4)
- Pokreće se na ruti `/venue-builder` (ili `/venue-builder/[venue_id]`)

**Što builder MORA podržavati:**
- Sekcije (sections): crtanje, resize, premještanje, konfiguracija, brisanje
- Itemi (sjedala/stolovi): dodavanje, konfiguracija, premještanje, brisanje
- Statički objekti (bina, bar, ulaz, WC): isti workflow, samo vizualni
- Unlimited canvas s dot-grid pozadinom
- Pan (space+drag, middle mouse, ruka alat)
- Zoom (Ctrl+scroll, +/- gumbi)
- Snap to grid (default ON; CTRL za free roam)
- Undo/Redo (10 koraka)
- Autosave svake 30s u localStorage + eksplicitni Save gumb
- Minimap u donjem desnom kutu
- Onboarding overlay za prvi posjet
- Validacija pri spremu
- Context menu (desni klik)

---

## 2. Folder struktura

```
apps/web/
├── app/
│   └── venue-builder/
│       ├── page.tsx                          # Entry point, učitava builder
│       └── [venue_id]/
│           └── page.tsx                      # Edit postojećeg venua
├── components/
│   └── venue-builder/
│       ├── VenueBuilder.tsx                  # Root kompozitor, nema logike
│       ├── TopBar.tsx                        # Gornja akcijska traka
│       ├── LeftToolbar.tsx                   # Lijevi sidebar s alatima
│       ├── Canvas.tsx                        # SVG canvas + pan/zoom/grid
│       ├── CanvasGrid.tsx                    # Dot grid pattern
│       ├── CanvasSections.tsx                # Render svih sekcija
│       ├── CanvasItems.tsx                   # Render svih itemsa
│       ├── CanvasStaticObjects.tsx           # Render statičkih objekata
│       ├── CanvasSelection.tsx               # Selection box (marquee)
│       ├── CanvasSectionDraw.tsx             # Crtanje nove sekcije (rect/polygon)
│       ├── RightPanel.tsx                    # Desni fiksni properties panel
│       ├── panels/
│       │   ├── SectionPanel.tsx              # Properties za sekciju
│       │   ├── ItemPanel.tsx                 # Properties za item
│       │   ├── StaticObjectPanel.tsx         # Properties za static obj
│       │   └── EmptyPanel.tsx               # Ništa nije selektirano
│       ├── FloatingItemEditor.tsx            # Mini floating modal uz item
│       ├── Minimap.tsx                       # Minimap donji desni kut
│       ├── ContextMenu.tsx                   # Desni klik menu
│       ├── OnboardingOverlay.tsx             # First-time walkthrough
│       ├── SaveNotification.tsx              # Toast notifikacija za save
│       ├── ValidationModal.tsx               # Modal pri save s greškama
│       └── BatchItemModal.tsx                # Modal za batch dodavanje sjedala
├── hooks/
│   └── venue-builder/
│       ├── useBuilderKeyboard.ts             # Keyboard shortcuts
│       ├── useCanvasPan.ts                   # Pan logika
│       ├── useCanvasZoom.ts                  # Zoom logika
│       ├── useItemDrag.ts                    # Drag itemsa po canvasu
│       ├── useItemResize.ts                  # Resize sekcija
│       ├── useHistory.ts                     # Undo/redo
│       ├── useAutosave.ts                    # 30s autosave
│       └── useMinimap.ts                     # Minimap viewport tracking
├── store/
│   └── venueBuilderStore.ts                  # Zustand store (jedini state)
├── types/
│   └── venueBuilder.ts                       # Svi TypeScript tipovi
├── lib/
│   └── venue-builder/
│       ├── snapUtils.ts                      # Snap to grid logika
│       ├── labelGenerator.ts                 # Auto-label A-1, T1, ...
│       ├── canvasCrop.ts                     # Crop canvas na save
│       ├── jsonSerializer.ts                 # Store → JSON schema v2.0
│       ├── jsonParser.ts                     # JSON schema v2.0 → Store
│       ├── saveToFile.ts                     # Zapis na disk (public/venues/)
│       ├── shapePresets.ts                   # SVG path definicije za shape presete
│       └── sectionDefaults.ts               # Default boje/config po section_type
└── public/
    └── venues/                               # JSON fajlovi (gitignore ili uključi)
```

---

## 3. Instalacija ovisnosti

```bash
# U apps/web/ folderu
npm install zustand lucide-react uuid
npm install --save-dev @types/uuid
```

**Koristi se:**
- `zustand` — state management
- `lucide-react` — ikone (već navedeno)
- `uuid` — generiranje json_id-ova (db_id se generira na backendu, ovdje je placeholder)
- Sve ostalo je native SVG + React + Tailwind

**NE instalirati:**
- react-konva, fabric.js, konva, d3, roughjs — nije potrebno
- @dnd-kit — za ovo koristimo custom mouse event handling

---

## 4. TypeScript tipovi

**Datoteka: `types/venueBuilder.ts`**

```typescript
// ============================================================
// ENUMI — prate SQL ENUM tipove iz baze
// ============================================================

export type SectionType =
  | 'standing'
  | 'seated'
  | 'table_area'
  | 'vip_lounge'
  | 'vip_table'
  | 'stage'
  | 'other';

export type ItemType = 'seat' | 'table';

export type ShapePreset =
  | 'circle'                  // sjedalo — krug
  | 'rounded_square'          // sjedalo — zaobljeni kvadrat
  | 'chair_topdown'           // sjedalo — top-down pogled
  | 'round_table_4'           // stol — okrugli za 4
  | 'round_table_6'           // stol — okrugli za 6
  | 'round_table_8'           // stol — okrugli za 8
  | 'rectangular_table'       // stol — pravokutni
  | 'booth_l_shape'           // stol — booth/L-oblik
  | 'bar_stool'               // stolica za bar
  | 'sofa'                    // sofa
  | 'high_table';             // visoki stol (cocktail)

export type StaticObjectType = 'stage' | 'bar' | 'entrance' | 'restroom' | 'dj_booth' | 'coat_check' | 'custom';

export type SectionShape = 'rect' | 'polygon';

export type ToolMode =
  | 'select'          // default — odabir i premještanje
  | 'pan'             // ruka alat
  | 'draw_section'    // crtanje sekcije
  | 'place_item'      // postavljanje itema
  | 'place_static';   // postavljanje statičkog objekta

// ============================================================
// CANVAS ELEMENTI
// ============================================================

export interface CanvasSection {
  id: string;               // json_id (npr. "section-1")
  db_id: string | null;     // UUID iz baze (null dok nije spremljeno)
  label: string;
  section_type: SectionType;
  fill_color: string;
  border_color: string;
  opacity: number;          // 0.0 – 1.0
  shape: SectionShape;

  // Rect
  x?: number;
  y?: number;
  width?: number;
  height?: number;

  // Polygon
  points?: [number, number][];

  z_index: number;
  capacity: number;
  is_numbered: boolean;
  is_locked: boolean;       // lock da se ne može slučajno premjestiti

  // Computed — ne sprema se u JSON
  _selected?: boolean;
}

export interface CanvasItem {
  id: string;               // json_id
  db_id: string | null;
  section_id: string;       // json_id sekcije kojoj pripada
  item_type: ItemType;
  shape_preset: ShapePreset;
  x: number;
  y: number;
  width: number;            // bounding box width
  height: number;           // bounding box height
  rotation: number;         // stupnjevi, 0-360
  label: string;            // "A-1", "T3", "VIP-1"
  label_visible: boolean;
  label_position: 'below' | 'above' | 'center';
  z_index: number;
  capacity: number;         // za stolove: broj mjesta; za sjedala: 1

  // Chair positions za stolove (relativne koordinate unutar bounding boxa)
  chair_positions?: { x: number; y: number }[];

  _selected?: boolean;
}

export interface StaticObject {
  id: string;               // json_id
  type: StaticObjectType;
  label: string;
  label_visible: boolean;
  shape: SectionShape;
  x?: number;
  y?: number;
  width?: number;
  height?: number;
  points?: [number, number][];
  fill_color: string;
  border_color: string;
  opacity: number;
  z_index: number;
  icon?: string;            // Lucide icon name

  _selected?: boolean;
}

// ============================================================
// VIEWPORT STATE
// ============================================================

export interface ViewportState {
  x: number;                // pan offset X
  y: number;                // pan offset Y
  zoom: number;             // 0.25 – 4.0
}

// ============================================================
// SELECTION STATE
// ============================================================

export type SelectionType = 'section' | 'item' | 'static' | null;

export interface SelectionState {
  type: SelectionType;
  ids: string[];            // multi-select podržano
}

// ============================================================
// TOOL CONTEXT — šta se dodaje kad je tool aktivan
// ============================================================

export interface PlaceItemContext {
  item_type: ItemType;
  shape_preset: ShapePreset;
}

export interface PlaceStaticContext {
  static_type: StaticObjectType;
}

export interface DrawSectionContext {
  section_type: SectionType;
  shape: SectionShape;
}

// ============================================================
// HISTORY ENTRY (za undo/redo)
// ============================================================

export interface HistoryEntry {
  sections: CanvasSection[];
  items: CanvasItem[];
  statics: StaticObject[];
  timestamp: number;
}

// ============================================================
// BUILDER STATE (cijeli Zustand store)
// ============================================================

export interface BuilderState {
  // Meta
  venue_id: string;
  venue_name: string;
  layout_version: number;
  schema_version: 2;
  is_dirty: boolean;         // ima li nespremljenih promjena
  last_saved: Date | null;

  // Canvas elementi
  sections: CanvasSection[];
  items: CanvasItem[];
  statics: StaticObject[];

  // Viewport
  viewport: ViewportState;

  // Alati
  tool: ToolMode;
  placeItemContext: PlaceItemContext | null;
  placeStaticContext: PlaceStaticContext | null;
  drawSectionContext: DrawSectionContext | null;

  // Selekcija
  selection: SelectionState;

  // UI state
  rightPanelOpen: boolean;
  floatingEditorItemId: string | null;  // koji item ima otvoren floating editor
  contextMenu: { x: number; y: number; targetId: string; targetType: SelectionType } | null;
  showMinimap: boolean;
  showGrid: boolean;
  snapEnabled: boolean;       // default true, CTRL toggle
  showOnboarding: boolean;

  // History
  history: HistoryEntry[];
  historyIndex: number;       // trenutna pozicija u historiji
}

// ============================================================
// JSON SCHEMA v2.0 (output format)
// ============================================================

export interface VenueBuilderJSON {
  venue_id: string;
  layout_id: string | null;
  schema_version: 2;
  canvas: {
    width: number;
    height: number;
    background_color: string;
  };
  viewport: {
    min_zoom: number;
    max_zoom: number;
    default_zoom: number;
  };
  sections: JsonSection[];
  items: JsonItem[];
  static_objects: JsonStaticObject[];
  shape_presets: Record<ShapePreset, JsonShapePresetDef>;
}

export interface JsonSection {
  json_id: string;
  db_id: string | null;
  label: string;
  section_type: SectionType;
  fill_color: string;
  border_color: string;
  opacity: number;
  shape: SectionShape;
  // rect
  x?: number;
  y?: number;
  width?: number;
  height?: number;
  // polygon
  points?: [number, number][];
  z_index: number;
  capacity: number;
  is_numbered: boolean;
}

export interface JsonItem {
  json_id: string;
  db_id: string | null;
  section_json_id: string;
  item_type: ItemType;
  shape_preset: ShapePreset;
  x: number;
  y: number;
  width: number;
  height: number;
  rotation: number;
  label: string;
  label_visible: boolean;
  label_position: 'below' | 'above' | 'center';
  z_index: number;
  capacity: number;
  chair_positions?: { x: number; y: number }[];
}

export interface JsonStaticObject {
  json_id: string;
  type: StaticObjectType;
  label: string;
  label_visible: boolean;
  shape: SectionShape;
  x?: number;
  y?: number;
  width?: number;
  height?: number;
  points?: [number, number][];
  fill_color: string;
  border_color: string;
  opacity: number;
  z_index: number;
}

export interface JsonShapePresetDef {
  svg_path: string;
  default_width: number;
  default_height: number;
  label: string;
}
```

---

## 5. Zustand Store

**Datoteka: `store/venueBuilderStore.ts`**

Store mora imati sve akcije kao metode. Akcije koje mijenjaju stanje **UVIJEK** prvo pushaju u history pa onda mijenjaju.

```typescript
// Pseudokod store strukture — implementiraj sve metode

import { create } from 'zustand';
import { subscribeWithSelector } from 'zustand/middleware';
import type { BuilderState, CanvasSection, CanvasItem, StaticObject, ... } from '../types/venueBuilder';

interface BuilderStore extends BuilderState {
  // ---- SECTIONS ----
  addSection: (section: CanvasSection) => void;
  updateSection: (id: string, updates: Partial<CanvasSection>) => void;
  deleteSection: (id: string) => void;
  duplicateSection: (id: string) => void;

  // ---- ITEMS ----
  addItem: (item: CanvasItem) => void;
  addItemsBatch: (items: CanvasItem[]) => void;
  updateItem: (id: string, updates: Partial<CanvasItem>) => void;
  deleteItem: (id: string) => void;
  deleteSelectedItems: () => void;
  moveItem: (id: string, dx: number, dy: number) => void;     // delta, ne absolutno

  // ---- STATIC OBJECTS ----
  addStaticObject: (obj: StaticObject) => void;
  updateStaticObject: (id: string, updates: Partial<StaticObject>) => void;
  deleteStaticObject: (id: string) => void;

  // ---- SELECTION ----
  selectElement: (id: string, type: SelectionType, addToSelection?: boolean) => void;
  selectMultiple: (ids: string[], type: SelectionType) => void;
  clearSelection: () => void;
  selectAll: () => void;

  // ---- VIEWPORT ----
  setViewport: (viewport: Partial<ViewportState>) => void;
  panBy: (dx: number, dy: number) => void;
  zoomTo: (zoom: number, centerX?: number, centerY?: number) => void;
  zoomIn: () => void;
  zoomOut: () => void;
  fitToContent: () => void;    // Ctrl+0 — fit sve elemente u view

  // ---- TOOL ----
  setTool: (tool: ToolMode, context?: PlaceItemContext | PlaceStaticContext | DrawSectionContext) => void;

  // ---- HISTORY ----
  pushHistory: () => void;
  undo: () => void;
  redo: () => void;
  canUndo: () => boolean;
  canRedo: () => boolean;

  // ---- UI ----
  setRightPanelOpen: (open: boolean) => void;
  setFloatingEditorItemId: (id: string | null) => void;
  setContextMenu: (menu: BuilderState['contextMenu']) => void;
  toggleMinimap: () => void;
  toggleGrid: () => void;
  setSnapEnabled: (enabled: boolean) => void;
  setShowOnboarding: (show: boolean) => void;

  // ---- SAVE / LOAD ----
  markDirty: () => void;
  markSaved: () => void;
  loadFromJSON: (json: VenueBuilderJSON) => void;

  // ---- META ----
  setVenueMeta: (id: string, name: string) => void;
}
```

**Napomene za implementaciju store-a:**

1. `pushHistory` sprema snapshot `{ sections, items, statics, timestamp }` u `history` array. Ako je `historyIndex < history.length - 1`, briše sve entrie nakon trenutnog indexa (standardno undo/redo ponašanje). Max 10 entrya — ako je > 10, briše najstariji.

2. Svaka akcija koja mijenja `sections`, `items` ili `statics` mora zvati `pushHistory()` PRIJE promjene, a potom `markDirty()`.

3. `undo()` smanjuje `historyIndex` i puni `sections/items/statics` iz history entrya. `redo()` povećava.

4. `fitToContent()` izračunava bounding box svih elemenata i podeša viewport tako da budu vidljivi s padinijom od 80px.

---

## 6. Utility funkcije

### 6.1 Snap utilities (`lib/venue-builder/snapUtils.ts`)

```typescript
const GRID_SIZE = 20; // px, na default zoom=1

export function snapToGrid(value: number, enabled: boolean): number {
  if (!enabled) return value;
  return Math.round(value / GRID_SIZE) * GRID_SIZE;
}

export function snapPoint(x: number, y: number, enabled: boolean): [number, number] {
  return [snapToGrid(x, enabled), snapToGrid(y, enabled)];
}
```

### 6.2 Label generator (`lib/venue-builder/labelGenerator.ts`)

```typescript
// Za sjedala u sekciji generira A-1, A-2, ..., B-1, B-2, ...
// Za stolove: T1, T2, T3, ...
// Za VIP: VIP-1, VIP-2, ...
// Prefix se može konfigurirati po sekciji

export function generateSeatLabel(
  sectionLabel: string,     // npr. "A" ili "Balkon"
  index: number,            // 0-based
  seatsPerRow: number       // koliko sjedala po redu
): string {
  const row = String.fromCharCode(65 + Math.floor(index / seatsPerRow)); // A, B, C, ...
  const seat = (index % seatsPerRow) + 1;
  return `${row}-${seat}`;
}

export function generateTableLabel(
  sectionLabel: string,
  existingCount: number     // koliko stolova već postoji u sekciji
): string {
  return `T${existingCount + 1}`;
}
```

### 6.3 Canvas crop (`lib/venue-builder/canvasCrop.ts`)

Na save, treba:
1. Naći bounding box svih elemenata (items, sections, statics)
2. Dodati margin od 60px sa svih strana
3. Prilagoditi sve koordinate (oduzeti min_x - margin, min_y - margin)
4. Postaviti canvas.width = max_x - min_x + 2*margin, canvas.height = max_y - min_y + 2*margin

```typescript
export interface BoundingBox {
  min_x: number;
  min_y: number;
  max_x: number;
  max_y: number;
}

const SAVE_MARGIN = 60;

export function computeBoundingBox(
  sections: CanvasSection[],
  items: CanvasItem[],
  statics: StaticObject[]
): BoundingBox { /* ... */ }

export function cropAndNormalizeCanvas(
  sections: CanvasSection[],
  items: CanvasItem[],
  statics: StaticObject[]
): {
  sections: CanvasSection[];
  items: CanvasItem[];
  statics: StaticObject[];
  canvasWidth: number;
  canvasHeight: number;
}
```

### 6.4 Shape presets (`lib/venue-builder/shapePresets.ts`)

SVG path definicije i default dimenzije za svaki preset. Sve putanje su normalizirane na viewBox `0 0 40 40`. Na canvasu se skaliraju na `width × height` itema.

```typescript
export const SHAPE_PRESETS: Record<ShapePreset, {
  svgPath: string;          // SVG <path> d attribute ili <circle>/<rect> atributi
  svgElement: 'path' | 'circle' | 'rect' | 'g'; // koji SVG element
  defaultWidth: number;     // px na zoom=1
  defaultHeight: number;
  label: string;            // za tooltip
  icon: string;             // Lucide icon name za toolbar
  viewBox: string;
}> = {
  circle: {
    svgElement: 'circle',
    // cx=20 cy=20 r=18 — krug koji gotovo puni viewBox
    defaultWidth: 32,
    defaultHeight: 32,
    label: 'Sjedalo (krug)',
    icon: 'Circle',
    viewBox: '0 0 40 40',
    svgPath: '',
  },
  rounded_square: {
    svgElement: 'rect',
    // rx=6 ry=6 x=2 y=2 width=36 height=36
    defaultWidth: 32,
    defaultHeight: 32,
    label: 'Sjedalo (zaobljeni kvadrat)',
    icon: 'Square',
    viewBox: '0 0 40 40',
    svgPath: '',
  },
  chair_topdown: {
    svgElement: 'path',
    // Top-down pogled sjedala: tijelo + naslon
    // Tijelo: rect rx=3 x=4 y=14 width=32 height=22
    // Naslon: rect rx=4 x=10 y=4 width=20 height=12
    svgPath: 'M10,4 h20 a4,4 0 0 1 4,4 v4 H6 V8 a4,4 0 0 1 4,-4 Z M4,17 h32 a3,3 0 0 1 3,3 v16 a3,3 0 0 1 -3,3 H4 a3,3 0 0 1 -3,-3 V20 a3,3 0 0 1 3,-3 Z',
    defaultWidth: 32,
    defaultHeight: 36,
    label: 'Sjedalo (top-down)',
    icon: 'Armchair',
    viewBox: '0 0 40 40',
  },
  round_table_4: {
    svgElement: 'g',
    // Krug + 4 mala kruga oko njega za stolice
    svgPath: '', // implementiraj kao <g> s krugom i 4 male stolice
    defaultWidth: 80,
    defaultHeight: 80,
    label: 'Okrugli stol (4 mjesta)',
    icon: 'Circle',
    viewBox: '0 0 80 80',
  },
  round_table_6: {
    svgElement: 'g',
    defaultWidth: 96,
    defaultHeight: 96,
    label: 'Okrugli stol (6 mjesta)',
    icon: 'Circle',
    viewBox: '0 0 96 96',
    svgPath: '',
  },
  round_table_8: {
    svgElement: 'g',
    defaultWidth: 112,
    defaultHeight: 112,
    label: 'Okrugli stol (8 mjesta)',
    icon: 'Circle',
    viewBox: '0 0 112 112',
    svgPath: '',
  },
  rectangular_table: {
    svgElement: 'g',
    defaultWidth: 120,
    defaultHeight: 60,
    label: 'Pravokutni stol',
    icon: 'RectangleHorizontal',
    viewBox: '0 0 120 60',
    svgPath: '',
  },
  booth_l_shape: {
    svgElement: 'path',
    svgPath: 'M 5,5 H 60 V 35 H 35 V 60 H 5 Z', // L-oblik
    defaultWidth: 100,
    defaultHeight: 80,
    label: 'Booth / L-klupa',
    icon: 'LayoutTemplate',
    viewBox: '0 0 80 80',
  },
  bar_stool: {
    svgElement: 'circle',
    defaultWidth: 24,
    defaultHeight: 24,
    label: 'Bar stolica',
    icon: 'Circle',
    viewBox: '0 0 24 24',
    svgPath: '',
  },
  sofa: {
    svgElement: 'path',
    // Top-down sofa: pravokutnik s naslonom i dvije ruke
    svgPath: 'M4,8 h72 a4,4 0 0 1 4,4 v8 H4 V12 a4,4 0 0 1 4,-4 Z M0,22 h80 v24 a4,4 0 0 1 -4,4 H4 a4,4 0 0 1 -4,-4 Z M0,22 v28 a4,4 0 0 0 4,4 v-28 a4,4 0 0 0 -4,-4 Z M80,22 v28 a4,4 0 0 1 -4,4 v-28 a4,4 0 0 1 4,-4 Z',
    defaultWidth: 160,
    defaultHeight: 60,
    label: 'Sofa',
    icon: 'Sofa',
    viewBox: '0 0 80 54',
  },
  high_table: {
    svgElement: 'circle',
    defaultWidth: 40,
    defaultHeight: 40,
    label: 'Visoki stol (cocktail)',
    icon: 'Circle',
    viewBox: '0 0 40 40',
    svgPath: '',
  },
};
```

**Napomena:** Za stolove (round_table_*, rectangular_table), SVG element je `<g>` koji sadrži centralni stol + stolice oko njega. Broj stolica = capacity itema.

### 6.5 Section defaults (`lib/venue-builder/sectionDefaults.ts`)

```typescript
export const SECTION_TYPE_DEFAULTS: Record<SectionType, {
  fill_color: string;
  border_color: string;
  opacity: number;
  label_prefix: string;
  icon: string;             // Lucide
}> = {
  standing:   { fill_color: '#E8EEF2', border_color: '#B0C4D0', opacity: 0.6, label_prefix: 'Pod', icon: 'Users' },
  seated:     { fill_color: '#EAF0F5', border_color: '#9BB5C5', opacity: 0.6, label_prefix: 'Sjedala', icon: 'Armchair' },
  table_area: { fill_color: '#F0EDF5', border_color: '#B5A8CC', opacity: 0.5, label_prefix: 'Stolovi', icon: 'LayoutGrid' },
  vip_lounge: { fill_color: '#F5EDF5', border_color: '#C4A0C4', opacity: 0.5, label_prefix: 'VIP', icon: 'Star' },
  vip_table:  { fill_color: '#F8EBF3', border_color: '#CC9BB8', opacity: 0.5, label_prefix: 'VIP Stolovi', icon: 'Star' },
  stage:      { fill_color: '#F0F0E8', border_color: '#B8B490', opacity: 0.7, label_prefix: 'Bina', icon: 'Music' },
  other:      { fill_color: '#EEEEEE', border_color: '#BBBBBB', opacity: 0.5, label_prefix: 'Zona', icon: 'Box' },
};

export const STATIC_TYPE_DEFAULTS: Record<StaticObjectType, {
  fill_color: string;
  border_color: string;
  icon: string;
  label: string;
}> = {
  stage:       { fill_color: '#E8E4D0', border_color: '#A09870', icon: 'Music2',     label: 'Bina' },
  bar:         { fill_color: '#D0E4E8', border_color: '#70A0A8', icon: 'GlassWater', label: 'Bar' },
  entrance:    { fill_color: '#D0E8D4', border_color: '#70A870', icon: 'DoorOpen',   label: 'Ulaz' },
  restroom:    { fill_color: '#E8E8D0', border_color: '#A8A870', icon: 'Waves',      label: 'WC' },
  dj_booth:    { fill_color: '#E0D0E8', border_color: '#9870A8', icon: 'Disc3',      label: 'DJ Booth' },
  coat_check:  { fill_color: '#E8D8D0', border_color: '#A88870', icon: 'Shirt',      label: 'Garderoba' },
  custom:      { fill_color: '#EEEEEE', border_color: '#AAAAAA', icon: 'Box',        label: 'Prilagođeno' },
};
```

### 6.6 JSON Serializer (`lib/venue-builder/jsonSerializer.ts`)

Konvertira Zustand store state u `VenueBuilderJSON` objekt. Poziva `cropAndNormalizeCanvas` internalno.

```typescript
export function serializeToJSON(
  state: Pick<BuilderState, 'sections' | 'items' | 'statics' | 'venue_id' | 'layout_version'>
): VenueBuilderJSON
```

### 6.7 Save to file (`lib/venue-builder/saveToFile.ts`)

```typescript
// U Next.js App Routeru, pisanje na disk se mora raditi kroz API Route
// Kreiraj: apps/web/app/api/venue-builder/save/route.ts

// Frontend poziva:
export async function saveVenueJSON(
  venue_id: string,
  version: number,
  json: VenueBuilderJSON
): Promise<{ success: boolean; path: string }>
```

**API Route (`app/api/venue-builder/save/route.ts`):**

```typescript
import { NextResponse } from 'next/server';
import { writeFile, mkdir } from 'fs/promises';
import path from 'path';

export async function POST(request: Request) {
  const { venue_id, version, json } = await request.json();

  // Sanitizacija venue_id — samo alfanumerički i crtica
  if (!/^[a-zA-Z0-9-_]+$/.test(venue_id)) {
    return NextResponse.json({ error: 'Invalid venue_id' }, { status: 400 });
  }

  const dir = path.join(process.cwd(), 'public', 'venues', venue_id);
  await mkdir(dir, { recursive: true });

  const filename = `v${version}.json`;
  const filepath = path.join(dir, filename);
  await writeFile(filepath, JSON.stringify(json, null, 2), 'utf-8');

  return NextResponse.json({
    success: true,
    path: `/venues/${venue_id}/${filename}`,
  });
}
```

**API Route za učitavanje (`app/api/venue-builder/load/route.ts`):**

```typescript
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const venue_id = searchParams.get('venue_id');
  const version = searchParams.get('version') || 'latest';

  // Učitaj JSON iz public/venues/{venue_id}/v{N}.json
  // 'latest' = uzmi najveći version broj
  // Vrati JSON ili { error: 'not_found' }
}
```

---

## 7. Komponente

### 7.1 `VenueBuilder.tsx` — Root komponent

**Ulaz:** `venue_id?: string`, `venue_name?: string`

**Odgovornosti:**
- Inicijalizira Zustand store (setVenueMeta, učita JSON ako postoji venue_id)
- Registrira keyboard listener (useBuilderKeyboard)
- Inicijalizira autosave (useAutosave)
- Komponuje layout: `TopBar + LeftToolbar + Canvas + RightPanel + overlaysi`

**Layout (CSS):**
```
┌──────────────────────────────────────────────┐
│              TOP BAR (h-12, fixed)           │
├──────┬───────────────────────────────────────┤
│      │                                       │
│  L   │         CANVAS (flex-1)              │
│  E   │     (SVG + pan + zoom)               │
│  F   │                                       │
│  T   │                                       │
│  56px│                              RIGHT    │
│      │                            PANEL      │
│      │                            (320px,    │
│      │                            overlay)   │
└──────┴───────────────────────────────────────┘
```

**Bitno:** Right panel je `position: fixed`, preklapa canvas — NE mijenja `width` canvasa.

---

### 7.2 `TopBar.tsx`

**Visina:** `h-14` (56px), `position: fixed`, `z-index: 50`, full width, pozicioniran odmah ispod mogućeg globalnog navbara.

**Sadržaj (lijevo → desno):**
```
[NOIR logo/ikona] | [Venue naziv (editable inline)] | -- FLEX GAP -- | [UNDO] [REDO] | [ZOOM-] [ZOOM%] [ZOOM+] [FIT] | [GRID toggle] [SNAP toggle] [MINIMAP toggle] | [AUTOSAVE status] | [SPREMI gumb]
```

**Elementi:**
- **Venue naziv** — `<input>` koji izgleda kao tekst dok nije u fokusu. Placeholder: "Naziv prostora...". Klik → editing mode s border-om.
- **UNDO/REDO** — Lucide `Undo2` / `Redo2`. Disabled ako nema historije. Tooltip: "Poništi (Ctrl+Z)" / "Ponovi (Ctrl+Shift+Z)".
- **ZOOM kontrole** — `-` gumb, input koji pokazuje `75%` (editabilno, Enter potvrđuje), `+` gumb, `⊞` (fit to content).
- **GRID toggle** — Lucide `Grid3x3`. Active state (filled/colored) kad je grid vidljiv.
- **SNAP toggle** — Lucide `Magnet`. Active kad je snap uključen.
- **MINIMAP toggle** — Lucide `Map`. Active kad je minimap vidljiv.
- **Autosave status** — mali tekst "Automatiski sprema svakih 30s" ili "Sprema..." ili "Spremljeno 14:32". Nije gumb.
- **SPREMI** — primary gumb, Lucide `Save`. `is_dirty` = solid; nije dirty = outline. Klik → validacija → save.

**Stilovi:**
```
bg-white border-b border-slate-200 shadow-sm
Text: text-[#2C3840]
Primary button: bg-[#456981] text-white hover:bg-[#3D4F59]
Toggle active: text-[#456981] bg-[#E8EEF2]
```

---

### 7.3 `LeftToolbar.tsx`

**Širina:** `w-14` (56px), fiksni, od ispod TopBara do dna ekrana.
**Pozicija:** `position: fixed; left: 0; top: 56px; bottom: 0`
**Stil:** `bg-white border-r border-slate-200 shadow-sm`

**Sadržaj (vertikalno, top → bottom):**

**Sekcija 1 — Navigation tools:**
```
[Strelica/Select]    icon: MousePointer2    shortcut: V / ESC
[Ruka/Pan]           icon: Hand              shortcut: H
```

**Separator**

**Sekcija 2 — Crtanje sekcija:**
```
[Nacrtaj sekciju]    icon: PenTool           shortcut: S
  ↳ Na hover ili klik otvori submenu/flyout s opcijama:
     - Pravokutna sekcija (Rectangle)
     - Poligon sekcija (Polygon - točka po točka)
  ↳ Zadnji odabrani oblik se pamti
```

**Separator**

**Sekcija 3 — Postavljanje itemsa (sjedala/stolovi):**

Svaki item je zasebni gumb s Lucide ikonom i tooltip-om. Groupirani u 2 grupe:

*Sjedala:*
```
[Krug sjedalo]       circle
[Kvadrat sjedalo]    rounded_square
[Top-down sjedalo]   chair_topdown
```

*Stolovi:*
```
[Okrugli 4]          round_table_4
[Okrugli 6]          round_table_6
[Okrugli 8]          round_table_8
[Pravokutni]         rectangular_table
[Booth/L]            booth_l_shape
[Bar stolica]        bar_stool
[Sofa]               sofa
[Visoki stol]        high_table
```

**Separator**

**Sekcija 4 — Statički objekti:**
```
[Bina]               icon: Music2
[Bar]                icon: GlassWater
[Ulaz]               icon: DoorOpen
[WC]                 icon: Waves
[DJ Booth]           icon: Disc3
[Garderoba]          icon: Shirt
[Prilagođeno]        icon: Box
```

**Separator**

**Bottom:**
```
[?] Help / onboarding    icon: HelpCircle
```

**Ponašanje alata:**
- Aktivan alat ima `bg-[#E8EEF2] text-[#456981] rounded-lg` highlight.
- Hover na svaki gumb pokazuje **tooltip** desno od toolbara (ne gore/dolje) s imenom alata i keyboard shortcutom.
- Kad je "Place item" tool aktivan, cursor na canvasu postaje crosshair.
- Klik na isti aktivni item tool ga deselektira (vraća na select tool).
- Toolbaru treba biti scrollable ako je ekran premalen (overflow-y: auto, ali scrollbar skriven).

---

### 7.4 `Canvas.tsx`

Ovo je najvažnija komponenta. Sve se događa unutar SVG elementa.

**Struktura:**
```tsx
<div className="absolute inset-0" style={{ left: 56, top: 56 }}
     onMouseDown={handleMouseDown}
     onMouseMove={handleMouseMove}
     onMouseUp={handleMouseUp}
     onWheel={handleWheel}
     onContextMenu={handleContextMenu}>

  <svg width="100%" height="100%" style={{ cursor: getCursor() }}>
    {/* 1. Dot grid background */}
    <CanvasGrid viewport={viewport} showGrid={showGrid} />

    {/* 2. Canvas content — sve transformirano s viewport */}
    <g transform={`translate(${viewport.x}, ${viewport.y}) scale(${viewport.zoom})`}>

      {/* 3. Statički objekti (ispod sekcija) */}
      <CanvasStaticObjects />

      {/* 4. Sekcije */}
      <CanvasSections />

      {/* 5. Itemi (iznad sekcija) */}
      <CanvasItems />

      {/* 6. U-tijeku crtanje sekcije */}
      <CanvasSectionDraw />

      {/* 7. Selection marquee */}
      <CanvasSelection />
    </g>

    {/* Minimap (fixed pozicija, izvan transform grupe) */}
    {showMinimap && <Minimap />}
  </svg>

  {/* Floating item editor (HTML overlay, ne SVG) */}
  {floatingEditorItemId && <FloatingItemEditor />}
</div>
```

**Mouse event handling:**

```typescript
// State za drag tracking (useRef, ne useState — ne smije triggerat re-render)
const dragState = useRef({
  isDragging: false,
  isPanning: false,
  isDrawingSection: false,
  isResizing: false,
  isMarqueeSelecting: false,
  startX: 0,
  startY: 0,
  lastX: 0,
  lastY: 0,
  targetId: null as string | null,
  targetType: null as SelectionType,
  resizeHandle: null as string | null, // 'n','s','e','w','ne','nw','se','sw'
});
```

**Koordinatna transformacija:**
```typescript
// Ekranske koordinate → canvas koordinate
function screenToCanvas(screenX: number, screenY: number): [number, number] {
  const rect = svgRef.current!.getBoundingClientRect();
  return [
    (screenX - rect.left - viewport.x) / viewport.zoom,
    (screenY - rect.top - viewport.y) / viewport.zoom,
  ];
}
```

**Zoom logika:**
```typescript
function handleWheel(e: WheelEvent) {
  e.preventDefault();
  if (e.ctrlKey) {
    // Zoom in/out — centered na poziciji miša
    const delta = -e.deltaY * 0.001;
    const newZoom = Math.max(0.1, Math.min(4.0, viewport.zoom * (1 + delta)));
    // Podeši pan tako da točka ispod miša ostane ista
    const rect = svgRef.current!.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;
    const newX = mouseX - (mouseX - viewport.x) * (newZoom / viewport.zoom);
    const newY = mouseY - (mouseY - viewport.y) * (newZoom / viewport.zoom);
    setViewport({ zoom: newZoom, x: newX, y: newY });
  } else if (e.shiftKey) {
    // Horizontal pan
    panBy(-e.deltaY * 0.8, 0);
  } else {
    // Vertical pan
    panBy(0, -e.deltaY * 0.8);
  }
}
```

**Pan logika:**
- Space+drag: promijeniti cursor u grabbing, track dragState.isPanning
- Middle mouse drag: isto kao space+drag
- Hand tool (H): svaki drag je pan

**Snap + CTRL:**
```typescript
function getSnapEnabled(e: MouseEvent): boolean {
  return store.snapEnabled && !e.ctrlKey;
}
```

**Crtanje sekcije (draw_section mode):**
- **Rect:** mousedown = startX/startY, mousemove = pokazuje preview rectangle, mouseup = kreira sekciju
- **Polygon:** svaki klik dodaje točku, dvostruki klik zatvara polygon, ESC odustaje

**Cursor mapping:**
```typescript
function getCursor(): string {
  if (isPanning || tool === 'pan') return isDragging ? 'grabbing' : 'grab';
  if (tool === 'draw_section' || tool === 'place_item' || tool === 'place_static') return 'crosshair';
  if (isOverResizeHandle) return getResizeCursor(resizeHandle);
  if (isOverElement) return 'move';
  return 'default';
}
```

---

### 7.5 `CanvasGrid.tsx`

Dot grid koji se skalira s viewportom. Implementiraj kao SVG `<defs>` + `<pattern>`:

```tsx
// Dot grid: točkica na svakom grid intersectu
// Grid size u world koordinatama = 20px
// Pattern se transformira s viewport-om (translate + scale)
// Točkice su r=0.8 u default zoomu, prilagoditi s viewport.zoom

const gridSize = 20; // world px
const dotRadius = Math.max(0.5, 0.8 / viewport.zoom); // ostaje isti vizualni radius

// SVG pattern:
<defs>
  <pattern
    id="dot-grid"
    x={viewport.x % (gridSize * viewport.zoom)}
    y={viewport.y % (gridSize * viewport.zoom)}
    width={gridSize * viewport.zoom}
    height={gridSize * viewport.zoom}
    patternUnits="userSpaceOnUse"
  >
    <circle
      cx={gridSize * viewport.zoom / 2}
      cy={gridSize * viewport.zoom / 2}
      r={dotRadius}
      fill="#C5D0D8"
    />
  </pattern>
</defs>
<rect width="100%" height="100%" fill="url(#dot-grid)" />
```

---

### 7.6 `CanvasSections.tsx`

Renderira sve sekcije iz store-a.

**Za svaku sekciju:**
- Ako `shape === 'rect'`: `<rect>` s `x, y, width, height`
- Ako `shape === 'polygon'`: `<polygon points="x1,y1 x2,y2 ..."`
- SVG atributi: `fill={fill_color}`, `fillOpacity={opacity}`, `stroke={border_color}`, `strokeWidth={2/viewport.zoom}` (border ostaje isti vizualni debljinom)
- Label u centru sekcije: `<text>` sa sekcijskim imenom + ikonom (emoji ili SVG ikona)
- Capacity badge: mali `<text>` u donjem desnom kutu sekcije
- **Selection state:** kad je sekcija selektirana, dodaj `stroke=[#7DB5C8]` i `strokeWidth={2.5/viewport.zoom}` + selection handles

**Resize handles** (8 točaka: 4 ugla + 4 središta rubova):
- Vidljivi samo kad je sekcija selektirana
- `<rect>` 8×8px, bijeli s border-om, cursor se mijenja ovisno o poziciji
- Drag na handle = resize sekcije

**Sekcija Lock:** locked sekcije imaju `fill-opacity * 0.7` i `cursor: not-allowed` na hover (osim ako si u select mode).

---

### 7.7 `CanvasItems.tsx`

Renderira sve iteme. Svaki item je SVG `<g>` s transform:

```tsx
<g
  key={item.id}
  transform={`translate(${item.x}, ${item.y}) rotate(${item.rotation}, ${item.width/2}, ${item.height/2})`}
  onClick={handleItemClick}
  onDoubleClick={handleItemDoubleClick}  // otvori floating editor
  style={{ cursor: 'move' }}
>
  {/* SVG shape prema shape_preset */}
  {renderItemShape(item)}

  {/* Label */}
  {item.label_visible && (
    <text
      x={item.width / 2}
      y={item.label_position === 'below' ? item.height + 10 : -4}
      textAnchor="middle"
      fontSize={10 / viewport.zoom}
      fill="#2C3840"
    >
      {item.label}
    </text>
  )}

  {/* Selection indicator */}
  {item._selected && (
    <rect
      x={-3} y={-3}
      width={item.width + 6} height={item.height + 6}
      fill="none"
      stroke="#7DB5C8"
      strokeWidth={2/viewport.zoom}
      strokeDasharray={`${4/viewport.zoom} ${2/viewport.zoom}`}
      rx={3/viewport.zoom}
    />
  )}
</g>
```

**Render item shapes** — posebna render funkcija za svaki shape_preset:
- `circle`: `<circle cx={w/2} cy={h/2} r={Math.min(w,h)/2 - 1}>`
- `rounded_square`: `<rect rx={4} width={w} height={h}>`
- `chair_topdown`: SVG path (skala na w×h)
- `round_table_N`: centralni krug + N manjih krugova-stolica raspoređenih u krug
- `rectangular_table`: pravokutnik + stolice gore/dolje
- itd.

**Boja sjedala/stolova:** Koristi boju sekcije kojoj pripada (fill_color iz sekcije, ali malo tamniji). Default: `#7B9EB0`.

---

### 7.8 `RightPanel.tsx`

**Pozicija:** `position: fixed; right: 0; top: 56px; bottom: 0; width: 300px`
**Stil:** `bg-white border-l border-slate-200 shadow-lg`
**Otvaranje:** Kad se selektira element, panel se animirano otvara (`translateX(0)`, transition 200ms). Zatvara se na ESC ili klik na prazni canvas.

**Struktura panela:**
```
┌──────────────────────────────┐
│ [← Zatvori]  [Tip elementa] │  header s ikonom i imenom
├──────────────────────────────┤
│                              │
│  PROPERTIES                  │
│  (ovisi o tipu selekcije)   │
│                              │
├──────────────────────────────┤
│  [🗑 Obriši]  [⊕ Dupliraj]  │  akcije na dnu panela
└──────────────────────────────┘
```

**Routanje prema tipu selekcije:**
```tsx
{selection.type === 'section' && <SectionPanel />}
{selection.type === 'item' && <ItemPanel />}
{selection.type === 'static' && <StaticObjectPanel />}
{!selection.type && <EmptyPanel />}
```

---

### 7.9 `panels/SectionPanel.tsx`

Pokazuje se u RightPanelu kad je sekcija selektirana.

**Polja:**
- **Naziv** — text input, inline edit
- **Tip sekcije** — dropdown/select s ikonama: `SectionType` ENUM
- **Je li numeriran** — toggle switch. Kad je ON, kapacitet se auto-računna iz broja itemsa. Kad je OFF, kapacitet je ručni unos.
- **Kapacitet** — number input (disabled ako is_numbered=true, u tom slučaju prikaži computed vrijednost)
- **Boja pozadine** — color picker (native `<input type="color">` ili custom)
- **Boja obruba** — color picker
- **Opacity** — slider 0-100%
- **Z-index** — number input (s ↑↓ gumbima)
- **Zaključan** — toggle (kad je locked, ne može se premjestiti)

**Batch akcije (kad je sekcija is_numbered):**
- `[+ Dodaj sjedala u grupi]` gumb → otvori `BatchItemModal`
- Pregled: "Sekcija sadrži 24 sjedala"

---

### 7.10 `panels/ItemPanel.tsx`

Polja:
- **Labela** — text input
- **Prikaži labelu** — toggle
- **Pozicija labele** — segmented control: Iznad / Ispod / Centar
- **Oblik** — dropdown s ikonama i preview (sve ShapePreset vrijednosti)
- **Kapacitet** — number (za stolove: mjesta; za sjedala: uvijek 1, disabled)
- **Rotacija** — slider 0-360° + number input
- **Veličina** — W × H number inputi (u px, world koordinate)
- **Pozicija** — X, Y number inputi (za precizno pozicioniranje)
- **Sekcija** — dropdown koji pokazuje kojoj sekciji item pripada (promjena = premješta item u drugu sekciju)

---

### 7.11 `panels/StaticObjectPanel.tsx`

Slično SectionPanelu ali bez: is_numbered, kapacitet je hidden.

Polja:
- **Naziv** — text input
- **Prikaži naziv** — toggle
- **Tip** — dropdown: StaticObjectType
- **Oblik** — Rect / Polygon
- **Boja pozadine** — color picker
- **Boja obruba** — color picker
- **Opacity** — slider
- **Z-index** — number

---

### 7.12 `panels/EmptyPanel.tsx`

Prikazuje se kad ništa nije selektirano. Sadržaj:
- NOIR logo mali
- Tekst: "Odaberi element za uređivanje"
- Quick stats: "Ukupno sjedala: X | Stolova: Y | Sekcija: Z"
- Shortcuts cheatsheet (kompaktan, 2 stupca)

---

### 7.13 `FloatingItemEditor.tsx`

**Trigger:** Dvostruki klik na item ILI desni klik → "Brzo uredi"

**Pozicija:** Absolutno pozicioniran uz item. Izračunaj da ne izlazi van ekrana (ako bi, prebaci stranu). HTML overlay (ne SVG).

**Nema backdrop.** Zatvara se na klik van floatera.

**Sadržaj (kompaktan, max 240px širine):**
```
┌─────────────────────────┐
│ [Item ikona] A-1   [×]  │  header
├─────────────────────────┤
│ Labela: [_________]     │
│ Kapacitet: [__] mjesta  │
│ Oblik: [dropdown]       │
│ [🔄 Rotiraj] [□ Veličina]│
└─────────────────────────┘
```

Samo najčešće korištena polja. Za sve opcije: "Otvori u panelu →" link.

---

### 7.14 `Minimap.tsx`

**Pozicija:** `position: absolute; bottom: 16px; right: 16px` unutar canvas div-a (not fixed — da RightPanel ne pokriva).

**Veličina:** 160×120px. `bg-white/90 backdrop-blur-sm rounded-lg border border-slate-200 shadow-lg`

**Sadržaj:** Skalirana verzija cijelog canvasa. Prikazuje sekcije kao obojene pravokutnike (bez itemsa za performanse). Crveni/plavi rectangle pokazuje trenutni viewport.

**Interakcija:** Klik na minimap pomiče viewport na tu poziciju.

**Toggle:** Gumb u TopBaru; `M` shortcut.

---

### 7.15 `ContextMenu.tsx`

**Trigger:** `onContextMenu` event na canvasu i elementima.

**Pozicija:** Absolutno na mouse poziciji. `position: fixed` da ne bude odrezan. Zatvara se na klik van ili ESC.

**Sadržaj ovisi o context target:**

*Na sekciji:*
```
✏ Uredi sekciju              → otvori RightPanel
🔒 Zaključaj / Otključaj
⊕ Dupliraj sekciju
--- separator ---
➕ Dodaj sjedala u sekciju   → BatchItemModal
➕ Dodaj stol u sekciju
--- separator ---
🗑 Obriši sekciju
```

*Na itemu:*
```
✏ Brzo uredi                 → FloatingItemEditor
⊕ Dupliraj
🔀 Premjesti u sekciju →     → submenu sa sekcijama
--- separator ---
🗑 Obriši
```

*Na statičkom objektu:*
```
✏ Uredi
⊕ Dupliraj
🗑 Obriši
```

*Na praznom canvasu:*
```
📋 Zalijepi (ako ima nešto u clipboardu)
🔍 Fit to content
--- separator ---
+ Dodaj sekciju
```

**Stil:**
```
bg-white border border-slate-200 rounded-lg shadow-xl
min-w-[200px] py-1
Item: px-3 py-2 text-sm hover:bg-[#F5F4F0] cursor-pointer flex items-center gap-2
Danger (brisanje): text-red-600 hover:bg-red-50
Separator: border-t border-slate-100 my-1
```

---

### 7.16 `OnboardingOverlay.tsx`

**Trigger:** `showOnboarding === true` u storeu. Postavi true ako `localStorage.getItem('noir-builder-onboarding') === null`.

**Stil:** Backdrop `bg-black/40 backdrop-blur-sm`. Centriran modal (ne fullscreen).

**Koraci (3 koraka, walkthrough arrows):**

*Korak 1:*
```
🏗 Dobrodošli u NOIR Venue Builder
Kreiraj tlocrt svog prostora u nekoliko koraka.
[Počnimo →]
```

*Korak 2 — Highlight na LeftToolbar:*
```
👈 Alati su ovdje
Odaberi alat za crtanje sekcije, postavljanje stolova
ili sjedala. Lebdi mišem za opis svakog alata.
[Dalje →]
```

*Korak 3 — Highlight na Canvas:*
```
🎨 Crtaj, postavljaj, konfigiraj
1. Nacrtaj sekciju (S) — definiraj zonu
2. Postavi stolove/sjedala unutar sekcije
3. Klikni element za uređivanje
4. Spremi (Ctrl+S) kad završiš
[Zatvori i počni]
```

**Po zatvaranju:** `localStorage.setItem('noir-builder-onboarding', 'done')`. Može se ponovo otvoriti s `?` gumbom u toolbaru.

---

### 7.17 `SaveNotification.tsx`

**Toast notifikacija** u gornjem desnom kutu canvasa (ispod TopBara).

**Stanja:**
- **Autosave in progress:** `💾 Automatski sprema...` — spinner + tekst, `bg-[#EAF0F5]`
- **Autosave done:** `✓ Automatski snimljeno 14:32` — zeleni check, nestaje za 2s
- **Manual save in progress:** `💾 Sprema...`
- **Manual save done:** `✓ Snimljeno` — nestaje za 3s
- **Save error:** `⚠ Greška pri snimanju` — `bg-red-50 text-red-700`, ostaje dok korisnik ne klikne ×

---

### 7.18 `ValidationModal.tsx`

Modal koji se prikazuje pri klik na Save ako ima validacijskih grešaka.

**Greške (hard — blokiraju save):**
- Nema nijedne sekcije
- Sekcija bez naziva
- Numbered sekcija nema niti jednog itema

**Upozorenja (soft — korisnik može ipak snimiti):**
- Sekcija s kapacitetom = 0
- Item koji nije ni u jednoj sekciji (lebdi sam)
- Venue bez naziva

**Stil:**
```
Modal: bg-white rounded-xl shadow-2xl p-6 max-w-md
Header: text-red-600 za greške, text-amber-600 za upozorenja
Lista grešaka: bullet lista s ikonama
Gumbi: [Ispravi] (primary) | [Spremi svejedno] (samo ako nema hard grešaka)
```

---

### 7.19 `BatchItemModal.tsx`

Otvara se kad korisnik želi batch dodati sjedala u sekciju.

**Polja:**
- Broj redova: number input (1-50)
- Sjedala po redu: number input (1-50)
- Razmak između sjedala: number input (px, default 40)
- Razmak između redova: number input (px, default 50)
- Prefiks labele: text input (default = prva slova sekcijskog naziva)
- Oblik sjedala: dropdown (shape_presets za sjedala)
- Preview: mali SVG koji pokazuje kako će izgledati raspored

**Gumbi:** `[Postavi u sekciju]` | `[Odustani]`

**Na potvrdi:**
1. Izračunaj pozicije (grid pattern unutar sekcije)
2. Generiraj labele (A-1, A-2, ..., B-1, ...)
3. `addItemsBatch(items)` u storeu

---

## 8. Dizajn sistem

### CSS varijable (u `globals.css` ili layout komponentu)

```css
:root {
  --color-primary: #456981;
  --color-primary-dark: #3D4F59;
  --color-secondary: #6B8FA3;
  --color-accent: #7DB5C8;
  --color-background: #F5F4F0;
  --color-neutral: #2C3840;
  --color-surface: #FFFFFF;
  --color-border: #D8E2E8;
  --color-border-subtle: #EDF1F4;
  --color-text-primary: #2C3840;
  --color-text-secondary: #6B8FA3;
  --color-text-muted: #9AB3C0;
  --color-selection: #7DB5C8;
  --color-selection-bg: #EAF5F9;
  --color-canvas-bg: #F5F4F0;
  --color-dot-grid: #C5D0D8;

  --radius-sm: 6px;
  --radius-md: 8px;
  --radius-lg: 12px;
  --shadow-sm: 0 1px 3px rgba(44, 56, 64, 0.08);
  --shadow-md: 0 4px 12px rgba(44, 56, 64, 0.12);
  --shadow-lg: 0 8px 24px rgba(44, 56, 64, 0.16);
}
```

### Tipografija

**Font:** `Geist` (dolazi s Next.js) za UI tekst. Funkcionalan, čist, bez generičnog osjećaja.

```css
/* U layout.tsx ili globals.css */
body {
  font-family: 'Geist', system-ui, sans-serif;
  color: var(--color-text-primary);
  background: var(--color-background);
}
```

### Tailwind custom klase (u tailwind.config.ts)

```typescript
theme: {
  extend: {
    colors: {
      noir: {
        primary: '#456981',
        secondary: '#6B8FA3',
        accent: '#7DB5C8',
        bg: '#F5F4F0',
        neutral: '#2C3840',
        border: '#D8E2E8',
      }
    }
  }
}
```

### Animacije

```css
/* Otvaranje right panela */
.panel-enter { transform: translateX(100%); }
.panel-enter-active { transform: translateX(0); transition: transform 200ms ease-out; }

/* Floating editor */
.floating-enter { opacity: 0; transform: scale(0.95); }
.floating-enter-active { opacity: 1; transform: scale(1); transition: all 150ms ease-out; }

/* Toast */
.toast-enter { opacity: 0; transform: translateX(20px); }
.toast-enter-active { opacity: 1; transform: translateX(0); transition: all 200ms ease-out; }
```

---

## 9. Keyboard Shortcuti

Implementirati u `hooks/venue-builder/useBuilderKeyboard.ts`. Listener na `window` (ne na element) da radi uvijek.

**Pazi:** Shortcuti se NE aktiviraju kad je fokus u `<input>`, `<textarea>` ili `contentEditable` elementu.

```
ESC             — deselektira sve / odustaje od aktivnog alata / zatvara modalove
Ctrl+Z          — Undo
Ctrl+Shift+Z    — Redo (ili Ctrl+Y)
Ctrl+S          — Save
Ctrl+A          — Select all
Ctrl+D          — Duplicate selektirano
Delete / Backspace — Briše selektirane elemente
Ctrl+0          — Fit to content
Ctrl++ / Ctrl+= — Zoom in
Ctrl+-          — Zoom out

V               — Select alat
H               — Hand (pan) alat
S               — Draw Section alat (zadnji odabrani oblik)

Arrow keys      — Premještaj selektirane elemente za 1px (ili 10px s Shift)
Ctrl+L          — Lock/Unlock selektiranu sekciju
M               — Toggle minimap
G               — Toggle grid
```

---

## 10. Save Flow i File Struktura

### Eksplicitni Save (Ctrl+S ili gumb)

```
1. Provjeri validaciju (synchrno)
   → Hard greške? Otvori ValidationModal, ne spašavaj
   → Soft upozorenja? Prikaži ValidationModal s opcijom "Spremi svejedno"

2. Pokreni canvas crop:
   → canvasCrop.cropAndNormalizeCanvas(sections, items, statics)
   → Dobij normalizirane koordinate + new canvas width/height

3. Serijaliziraj u VenueBuilderJSON:
   → jsonSerializer.serializeToJSON(croppedState)
   → Postavi schema_version: 2

4. Pozovi API:
   → POST /api/venue-builder/save
   → Body: { venue_id, version, json }

5. Na success:
   → markSaved() u storeu
   → Prikaži SaveNotification (success)

6. Na error:
   → Prikaži SaveNotification (error)
   → Ne mijenjaj is_dirty
```

### Autosave (svake 30s)

```
1. Provjeri is_dirty === true
2. Provjeri da nema hard validacijskih grešaka (tiha provjera)
3. Isto kao eksplicitni save, ali:
   → Bez ValidationModal (tiho)
   → SaveNotification pokazuje "Automatski sprema..."
   → Spremat se u localStorage kao backup i u file
```

### LocalStorage Backup

Ključ: `noir-builder-${venue_id}-backup`
Sprema cijeli store state (sections + items + statics) kao JSON.
Učitava se automatski ako se detekata da file save nije uspio.

### File struktura

```
apps/web/public/venues/
├── demo-venue/
│   ├── v1.json          # Prva verzija layouta
│   └── v2.json          # Druga verzija (ako je editiran)
├── test-club/
│   └── v1.json
```

---

## 11. Onboarding Flow

```
App mount
  ↓
Provjeri localStorage.getItem('noir-builder-onboarding')
  ↓ null
Postavi store.showOnboarding = true
  ↓
Prikaži OnboardingOverlay (3 koraka)
  ↓ Korisnik klikne "Zatvori i počni"
localStorage.setItem('noir-builder-onboarding', 'done')
store.setShowOnboarding(false)
  ↓
Prazan canvas s tooltip hint: "Započni crtanjem sekcije (S)"
```

---

## 12. Validacija

### Hard greške (blokiraju save):

| Provjera | Poruka |
|---|---|
| `sections.length === 0` | "Dodaj barem jednu sekciju prije snimanja." |
| Sekcija bez `label` | "Sve sekcije moraju imati naziv." |
| Numbered sekcija s 0 itemsa | `"Sekcija '${name}' je označena kao numerirana ali nema sjedala/stolova."` |

### Soft upozorenja (mogu se zanemariti):

| Provjera | Poruka |
|---|---|
| `venue_name === ''` | "Prostor nema naziv — korisnici ga neće moći prepoznati." |
| Sekcija s `capacity === 0` | `"Sekcija '${name}' ima kapacitet 0."` |
| Item bez sekcije | "Postoje elementi izvan sekcija — neće biti pridruženi nijednoj zoni." |

---

## 13. Rubni slučajevi i napomene

### Canvas koordinate

- Sve koordinate u storeu su **world koordinate** (ne screen koordinate).
- Transformacija: `screen = world * zoom + panOffset`
- Snap se primjenjuje na world koordinate.

### Z-index redoslijed (renderiranje)

1. `static_objects` s `z_index=0` (pozadina — bina, bar)
2. `sections` sortirane po `z_index`
3. `static_objects` s `z_index > 0`
4. `items` sortirani po `z_index`
5. `selection_marquee`
6. `drawing_preview`

### Multi-select

- Shift+klik dodaje/uklanja iz selekcije.
- Drag-marquee selektira sve elemente koji se preklapaju s marquee box-om.
- Multi-select podržava samo isti tip (ili miks — na tebi da odlučiš, ali preporuča se miks jer je korisnik ugodniji).
- Delete na multi-selekciji briše sve.
- Move na multi-selekciji pomiče sve relativno.

### Sekcija → Item relationship

- Svaki item ima `section_id` koji referencira `json_id` sekcije.
- Kad se sekcija briše, brišu se i svi njeni itemi (user confirmation potreban).
- Kad se item drag-a izvan sekcije → auto-assign na novu sekciju (detektiraj point-in-polygon/rect) ili postavi `section_id = null` (floating).

### Polygon sekcija crtanje

```
1. Alat → Draw Section → Polygon
2. Kursor → crosshair
3. Klik → dodaj točku, prikazuje se linija od zadnje točke do kursora (preview)
4. Dvostruki klik ILI klik na prvu točku → zatvori polygon, kreira sekciju
5. ESC → odustani (obriši preview)
6. Minimum 3 točke za validni polygon
```

### Resize sekcije

- Samo `rect` sekcije imaju resize handles.
- Polygon sekcije nemaju resize — mogu se premjestiti ali ne resize (kompleksno za MVP).
- `postoji li opcija` u context menu: "Pretvori u pravokutnik" (bounding box polygon-a).

### Performance

- Koristiti `React.memo` na `CanvasItem` i `CanvasSection` komponentama.
- Izbjegavati re-render cijelog canvasa na svaki mousemove — koristiti `useRef` za drag state.
- Za 500+ itemsa, razmotriti virtualizaciju (ali za MVP nije potrebno).

### Undo/Redo

- History entry se kreira SAMO na "završenim" akcijama (mouseUp, input blur).
- Ne kreira se entry za svaki mousemove (previše). Kreira se na mouseUp.
- Viewport (pan/zoom) NIJE dio historije.

---

## 14. Redoslijed implementacije

Implementiraj **u ovom točnom redoslijedu** — svaki korak je testabilan:

### Faza 1: Temelji (bez interakcije)

1. `types/venueBuilder.ts` — svi tipovi
2. `lib/venue-builder/shapePresets.ts` — SVG definicije
3. `lib/venue-builder/sectionDefaults.ts` — default boje/ikone
4. `store/venueBuilderStore.ts` — Zustand store (bez historije za sad)
5. `app/venue-builder/page.tsx` — osnovna ruta
6. `VenueBuilder.tsx` — shell layout (TopBar placeholder + LeftToolbar placeholder + Canvas div)

### Faza 2: Canvas rendering (read-only)

7. `lib/venue-builder/snapUtils.ts`
8. `CanvasGrid.tsx` — dot grid
9. `CanvasSections.tsx` — render sekcija bez interakcije
10. `CanvasItems.tsx` — render itemsa bez interakcije
11. `CanvasStaticObjects.tsx` — render statičkih objekata
12. `Canvas.tsx` — pan + zoom (wheel, space+drag, middle mouse)

### Faza 3: LeftToolbar + postavljanje elemenata

13. `LeftToolbar.tsx` — sve grupe alata, tooltipovi
14. `CanvasSectionDraw.tsx` — crtanje rect/polygon sekcija
15. Place item mode — klik na canvas postavlja item na poziciju
16. Place static mode — isti workflow

### Faza 4: Selekcija i premještanje

17. `CanvasSelection.tsx` — marquee select
18. Klik na element → selekcija
19. Drag element → premještanje (snap)
20. Multi-select (Shift+klik, marquee)
21. Resize handles za sekcije
22. `useBuilderKeyboard.ts` — keyboard shortcuts (Arrow keys, Delete, ESC, Ctrl+Z/S/A/D)

### Faza 5: Properties paneli

23. `RightPanel.tsx` — shell s animacijom
24. `panels/SectionPanel.tsx`
25. `panels/ItemPanel.tsx`
26. `panels/StaticObjectPanel.tsx`
27. `panels/EmptyPanel.tsx`
28. `FloatingItemEditor.tsx` — dvostruki klik

### Faza 6: Undo/Redo i History

29. `useHistory.ts` — history logika
30. Integracija history u sve store akcije
31. TopBar Undo/Redo gumbi

### Faza 7: Batch, Context Menu, Minimap

32. `BatchItemModal.tsx`
33. `ContextMenu.tsx`
34. `Minimap.tsx`
35. `useMinimap.ts`

### Faza 8: Save flow

36. `lib/venue-builder/canvasCrop.ts`
37. `lib/venue-builder/jsonSerializer.ts`
38. `app/api/venue-builder/save/route.ts`
39. `app/api/venue-builder/load/route.ts`
40. `lib/venue-builder/saveToFile.ts`
41. `ValidationModal.tsx`
42. `SaveNotification.tsx`
43. `useAutosave.ts`

### Faza 9: Onboarding i polish

44. `OnboardingOverlay.tsx`
45. Tooltipovi na svim gumbima
46. Animacije (panel open/close, toast)
47. Error stanja i edge caseovi
48. `TopBar.tsx` — finalizacija svih kontrola

---

## Napomene za Claude Code

- **Ne koristi** react-dnd, @dnd-kit, konva, fabric.js, roughjs ili slično. Sve je native SVG + mouse events.
- **Zustand** je jedini state — nema lokalnih useState osim za transient UI (npr. "je li input u focus-u").
- **TypeScript strict mode** — nema `any`, nema implicit `any`.
- **`use client`** direktiva obavezna na svim interaktivnim komponentama (ovo je App Router).
- Canvas div mora imati `overflow: hidden` i `user-select: none` da drag ne selektira tekst.
- SVG elementi moraju imati `pointer-events` postavljen ispravno — sections imaju `pointer-events: all`, tekst labele `pointer-events: none`.
- Sve dimenzije u CSS-u su `px` — ne koristiti `rem` za pixelno precizne komponente (toolbar, panel widths).
- Komentari u kodu neka budu na **engleskom** (konvencija projekta), komentari u SQL-u su na hrvatskom ali ovdje je TypeScript.

---

*Ovaj dokument generiran u suradnji s NOIR timom. Verzija 1.0 | Ožujak 2026.*

claude --resume e6b93a64-71a6-4495-8aa5-eae53feefdfa