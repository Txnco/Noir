// ============================================================
// ENUMS — mirrors SQL ENUM types from the database
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
  | 'circle'
  | 'rounded_square'
  | 'chair_topdown'
  | 'round_table_4'
  | 'round_table_6'
  | 'round_table_8'
  | 'rectangular_table'
  | 'booth_l_shape'
  | 'bar_stool'
  | 'sofa'
  | 'high_table';

export type StaticObjectType =
  | 'stage'
  | 'bar'
  | 'entrance'
  | 'restroom'
  | 'dj_booth'
  | 'coat_check'
  | 'custom';

export type SectionShape = 'rect' | 'polygon';

export type ToolMode =
  | 'select'
  | 'pan'
  | 'draw_section'
  | 'place_item'
  | 'place_static'
  | 'place_row';

// ============================================================
// CANVAS ELEMENTS
// ============================================================

export interface CanvasSection {
  id: string;
  db_id: string | null;
  label: string;
  section_type: SectionType;
  fill_color: string;
  border_color: string;
  opacity: number;
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
  is_locked: boolean;

  // Computed — not saved to JSON
  _selected?: boolean;
}

export interface CanvasItem {
  id: string;
  db_id: string | null;
  section_id: string | null;
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

  _selected?: boolean;
}

export interface StaticObject {
  id: string;
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
  icon?: string;

  _selected?: boolean;
}

// ============================================================
// VIEWPORT STATE
// ============================================================

export interface ViewportState {
  x: number;
  y: number;
  zoom: number;
}

// ============================================================
// SELECTION STATE
// ============================================================

export type SelectionType = 'section' | 'item' | 'static' | null;

export interface SelectionState {
  type: SelectionType;
  ids: string[];
}

// ============================================================
// TOOL CONTEXT
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

export interface PlaceRowContext {
  shape_preset: ShapePreset;
  spacing: number;   // px between seat centers (at zoom=1)
  count: number;     // 0 = auto-calculate from distance
  label_prefix: string;
}

// ============================================================
// HISTORY ENTRY (undo/redo)
// ============================================================

export interface HistoryEntry {
  sections: CanvasSection[];
  items: CanvasItem[];
  statics: StaticObject[];
  timestamp: number;
}

// ============================================================
// BUILDER STATE (full Zustand store state)
// ============================================================

export interface BuilderState {
  // Meta
  venue_id: string;
  venue_name: string;
  layout_version: number;
  schema_version: 2;
  is_dirty: boolean;
  last_saved: Date | null;

  // Canvas elements
  sections: CanvasSection[];
  items: CanvasItem[];
  statics: StaticObject[];

  // Viewport
  viewport: ViewportState;

  // Tools
  tool: ToolMode;
  placeItemContext: PlaceItemContext | null;
  placeStaticContext: PlaceStaticContext | null;
  drawSectionContext: DrawSectionContext | null;
  placeRowContext: PlaceRowContext | null;

  // Selection
  selection: SelectionState;

  // UI state
  rightPanelOpen: boolean;
  floatingEditorItemId: string | null;
  contextMenu: {
    x: number;
    y: number;
    targetId: string | null;
    targetType: SelectionType;
  } | null;
  showMinimap: boolean;
  showGrid: boolean;
  snapEnabled: boolean;
  showOnboarding: boolean;

  // History
  history: HistoryEntry[];
  historyIndex: number;
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
  x?: number;
  y?: number;
  width?: number;
  height?: number;
  points?: [number, number][];
  z_index: number;
  capacity: number;
  is_numbered: boolean;
}

export interface JsonItem {
  json_id: string;
  db_id: string | null;
  section_json_id: string | null;
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
