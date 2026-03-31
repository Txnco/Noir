import { create } from 'zustand';
import { subscribeWithSelector } from 'zustand/middleware';
import type {
  BuilderState,
  CanvasSection,
  CanvasItem,
  StaticObject,
  ViewportState,
  ToolMode,
  PlaceItemContext,
  PlaceStaticContext,
  DrawSectionContext,
  PlaceRowContext,
  SelectionType,
  VenueBuilderJSON,
  HistoryEntry,
} from '../types/venueBuilder';

const MAX_HISTORY = 10;
const MIN_ZOOM = 0.1;
const MAX_ZOOM = 4.0;

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
  moveItem: (id: string, dx: number, dy: number) => void;

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
  fitToContent: () => void;

  // ---- TOOL ----
  setTool: (
    tool: ToolMode,
    context?: PlaceItemContext | PlaceStaticContext | DrawSectionContext | PlaceRowContext
  ) => void;

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
  resetStore: (venueId: string, venueName: string) => void;

  // ---- META ----
  setVenueMeta: (id: string, name: string) => void;
  setVenueName: (name: string) => void;
}

const initialState: BuilderState = {
  venue_id: 'new-venue',
  venue_name: '',
  layout_version: 1,
  schema_version: 2,
  is_dirty: false,
  last_saved: null,

  sections: [],
  items: [],
  statics: [],

  viewport: { x: 0, y: 0, zoom: 1 },

  tool: 'select',
  placeItemContext: null,
  placeStaticContext: null,
  drawSectionContext: null,
  placeRowContext: null,

  selection: { type: null, ids: [] },

  rightPanelOpen: false,
  floatingEditorItemId: null,
  contextMenu: null,
  showMinimap: true,
  showGrid: true,
  snapEnabled: true,
  showOnboarding: false,

  history: [],
  historyIndex: -1,
};

export const useBuilderStore = create<BuilderStore>()(
  subscribeWithSelector((set, get) => ({
    ...initialState,

    // ---- HISTORY ----
    pushHistory: () => {
      const { sections, items, statics, history, historyIndex } = get();
      const snapshot: HistoryEntry = {
        sections: sections.map((s) => ({ ...s })),
        items: items.map((i) => ({ ...i })),
        statics: statics.map((s) => ({ ...s })),
        timestamp: Date.now(),
      };
      const newHistory = [
        ...history.slice(0, historyIndex + 1),
        snapshot,
      ].slice(-MAX_HISTORY);
      set({
        history: newHistory,
        historyIndex: newHistory.length - 1,
      });
    },

    undo: () => {
      const { history, historyIndex } = get();
      if (historyIndex <= 0) return;
      const entry = history[historyIndex - 1];
      set({
        sections: entry.sections.map((s) => ({ ...s })),
        items: entry.items.map((i) => ({ ...i })),
        statics: entry.statics.map((s) => ({ ...s })),
        historyIndex: historyIndex - 1,
        selection: { type: null, ids: [] },
        is_dirty: true,
      });
    },

    redo: () => {
      const { history, historyIndex } = get();
      if (historyIndex >= history.length - 1) return;
      const entry = history[historyIndex + 1];
      set({
        sections: entry.sections.map((s) => ({ ...s })),
        items: entry.items.map((i) => ({ ...i })),
        statics: entry.statics.map((s) => ({ ...s })),
        historyIndex: historyIndex + 1,
        selection: { type: null, ids: [] },
        is_dirty: true,
      });
    },

    canUndo: () => get().historyIndex > 0,
    canRedo: () => get().historyIndex < get().history.length - 1,

    // ---- SECTIONS ----
    addSection: (section) => {
      get().pushHistory();
      set((state) => ({
        sections: [...state.sections, section],
        is_dirty: true,
      }));
    },

    updateSection: (id, updates) => {
      set((state) => ({
        sections: state.sections.map((s) =>
          s.id === id ? { ...s, ...updates } : s
        ),
        is_dirty: true,
      }));
    },

    deleteSection: (id) => {
      get().pushHistory();
      set((state) => ({
        sections: state.sections.filter((s) => s.id !== id),
        items: state.items.filter((i) => i.section_id !== id),
        selection: { type: null, ids: [] },
        rightPanelOpen: false,
        is_dirty: true,
      }));
    },

    duplicateSection: (id) => {
      const section = get().sections.find((s) => s.id === id);
      if (!section) return;
      get().pushHistory();
      const newId = `section-${Date.now()}`;
      const duplicate: CanvasSection = {
        ...section,
        id: newId,
        db_id: null,
        label: `${section.label} (copy)`,
        x: (section.x ?? 0) + 20,
        y: (section.y ?? 0) + 20,
      };
      set((state) => ({
        sections: [...state.sections, duplicate],
        is_dirty: true,
      }));
    },

    // ---- ITEMS ----
    addItem: (item) => {
      get().pushHistory();
      set((state) => ({
        items: [...state.items, item],
        is_dirty: true,
      }));
    },

    addItemsBatch: (items) => {
      get().pushHistory();
      set((state) => ({
        items: [...state.items, ...items],
        is_dirty: true,
      }));
    },

    updateItem: (id, updates) => {
      set((state) => ({
        items: state.items.map((i) =>
          i.id === id ? { ...i, ...updates } : i
        ),
        is_dirty: true,
      }));
    },

    deleteItem: (id) => {
      get().pushHistory();
      set((state) => ({
        items: state.items.filter((i) => i.id !== id),
        selection: {
          type: state.selection.ids.length > 1 ? state.selection.type : null,
          ids: state.selection.ids.filter((sid) => sid !== id),
        },
        is_dirty: true,
      }));
    },

    deleteSelectedItems: () => {
      const { selection, sections, items, statics } = get();
      if (!selection.type || selection.ids.length === 0) return;
      get().pushHistory();
      if (selection.type === 'item') {
        const idsToDelete = new Set(selection.ids);
        set({
          items: items.filter((i) => !idsToDelete.has(i.id)),
          selection: { type: null, ids: [] },
          rightPanelOpen: false,
          is_dirty: true,
        });
      } else if (selection.type === 'section') {
        const idsToDelete = new Set(selection.ids);
        set({
          sections: sections.filter((s) => !idsToDelete.has(s.id)),
          items: items.filter(
            (i) => i.section_id === null || !idsToDelete.has(i.section_id)
          ),
          selection: { type: null, ids: [] },
          rightPanelOpen: false,
          is_dirty: true,
        });
      } else if (selection.type === 'static') {
        const idsToDelete = new Set(selection.ids);
        set({
          statics: statics.filter((s) => !idsToDelete.has(s.id)),
          selection: { type: null, ids: [] },
          rightPanelOpen: false,
          is_dirty: true,
        });
      }
    },

    moveItem: (id, dx, dy) => {
      set((state) => ({
        items: state.items.map((i) =>
          i.id === id ? { ...i, x: i.x + dx, y: i.y + dy } : i
        ),
        is_dirty: true,
      }));
    },

    // ---- STATIC OBJECTS ----
    addStaticObject: (obj) => {
      get().pushHistory();
      set((state) => ({
        statics: [...state.statics, obj],
        is_dirty: true,
      }));
    },

    updateStaticObject: (id, updates) => {
      set((state) => ({
        statics: state.statics.map((s) =>
          s.id === id ? { ...s, ...updates } : s
        ),
        is_dirty: true,
      }));
    },

    deleteStaticObject: (id) => {
      get().pushHistory();
      set((state) => ({
        statics: state.statics.filter((s) => s.id !== id),
        selection: { type: null, ids: [] },
        rightPanelOpen: false,
        is_dirty: true,
      }));
    },

    // ---- SELECTION ----
    selectElement: (id, type, addToSelection = false) => {
      set((state) => {
        let newIds: string[];
        if (addToSelection && state.selection.type === type) {
          const already = state.selection.ids.includes(id);
          newIds = already
            ? state.selection.ids.filter((sid) => sid !== id)
            : [...state.selection.ids, id];
        } else {
          newIds = [id];
        }
        const idSet = new Set(newIds);
        return {
          selection: { type, ids: newIds },
          rightPanelOpen: true,
          sections:
            type === 'section'
              ? state.sections.map((s) => ({ ...s, _selected: idSet.has(s.id) }))
              : state.sections.map((s) => ({ ...s, _selected: false })),
          items:
            type === 'item'
              ? state.items.map((i) => ({ ...i, _selected: idSet.has(i.id) }))
              : state.items.map((i) => ({ ...i, _selected: false })),
          statics:
            type === 'static'
              ? state.statics.map((s) => ({ ...s, _selected: idSet.has(s.id) }))
              : state.statics.map((s) => ({ ...s, _selected: false })),
        };
      });
    },

    selectMultiple: (ids, type) => {
      set({
        selection: { type, ids },
        rightPanelOpen: ids.length > 0,
      });
    },

    clearSelection: () => {
      set((state) => ({
        selection: { type: null, ids: [] },
        rightPanelOpen: false,
        sections: state.sections.map((s) => ({ ...s, _selected: false })),
        items: state.items.map((i) => ({ ...i, _selected: false })),
        statics: state.statics.map((s) => ({ ...s, _selected: false })),
      }));
    },

    selectAll: () => {
      const { sections, items } = get();
      if (sections.length > 0) {
        const ids = sections.map((s) => s.id);
        set({
          selection: { type: 'section', ids },
          sections: sections.map((s) => ({ ...s, _selected: true })),
          rightPanelOpen: true,
        });
      } else if (items.length > 0) {
        const ids = items.map((i) => i.id);
        set({
          selection: { type: 'item', ids },
          items: items.map((i) => ({ ...i, _selected: true })),
          rightPanelOpen: true,
        });
      }
    },

    // ---- VIEWPORT ----
    setViewport: (viewport) => {
      set((state) => ({ viewport: { ...state.viewport, ...viewport } }));
    },

    panBy: (dx, dy) => {
      set((state) => ({
        viewport: {
          ...state.viewport,
          x: state.viewport.x + dx,
          y: state.viewport.y + dy,
        },
      }));
    },

    zoomTo: (zoom, centerX, centerY) => {
      const newZoom = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, zoom));
      set((state) => {
        if (centerX !== undefined && centerY !== undefined) {
          const scale = newZoom / state.viewport.zoom;
          return {
            viewport: {
              zoom: newZoom,
              x: centerX - (centerX - state.viewport.x) * scale,
              y: centerY - (centerY - state.viewport.y) * scale,
            },
          };
        }
        return { viewport: { ...state.viewport, zoom: newZoom } };
      });
    },

    zoomIn: () => {
      const { viewport } = get();
      get().zoomTo(viewport.zoom * 1.2);
    },

    zoomOut: () => {
      const { viewport } = get();
      get().zoomTo(viewport.zoom / 1.2);
    },

    fitToContent: () => {
      const { sections, items, statics } = get();
      const allElements = [
        ...sections.map((s) => ({
          x: s.x ?? 0,
          y: s.y ?? 0,
          w: s.width ?? 100,
          h: s.height ?? 100,
        })),
        ...items.map((i) => ({ x: i.x, y: i.y, w: i.width, h: i.height })),
        ...statics.map((s) => ({
          x: s.x ?? 0,
          y: s.y ?? 0,
          w: s.width ?? 100,
          h: s.height ?? 100,
        })),
      ];

      if (allElements.length === 0) {
        set({ viewport: { x: 0, y: 0, zoom: 1 } });
        return;
      }

      const minX = Math.min(...allElements.map((e) => e.x));
      const minY = Math.min(...allElements.map((e) => e.y));
      const maxX = Math.max(...allElements.map((e) => e.x + e.w));
      const maxY = Math.max(...allElements.map((e) => e.y + e.h));

      const contentW = maxX - minX;
      const contentH = maxY - minY;
      const PADDING = 80;

      // Assume viewport is roughly window size
      const viewW = typeof window !== 'undefined' ? window.innerWidth - 56 - 300 : 800;
      const viewH = typeof window !== 'undefined' ? window.innerHeight - 56 : 600;

      const zoom = Math.min(
        (viewW - PADDING * 2) / contentW,
        (viewH - PADDING * 2) / contentH,
        1
      );
      const clampedZoom = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, zoom));

      set({
        viewport: {
          zoom: clampedZoom,
          x: PADDING - minX * clampedZoom + (viewW - contentW * clampedZoom) / 2,
          y: PADDING - minY * clampedZoom + (viewH - contentH * clampedZoom) / 2,
        },
      });
    },

    // ---- TOOL ----
    setTool: (tool, context) => {
      set({
        tool,
        placeItemContext:
          tool === 'place_item' && context && 'item_type' in context
            ? (context as PlaceItemContext)
            : null,
        placeStaticContext:
          tool === 'place_static' && context && 'static_type' in context
            ? (context as PlaceStaticContext)
            : null,
        drawSectionContext:
          tool === 'draw_section' && context && 'section_type' in context
            ? (context as DrawSectionContext)
            : null,
        placeRowContext:
          tool === 'place_row' && context && 'spacing' in context
            ? (context as PlaceRowContext)
            : null,
      });
    },

    // ---- UI ----
    setRightPanelOpen: (open) => set({ rightPanelOpen: open }),
    setFloatingEditorItemId: (id) => set({ floatingEditorItemId: id }),
    setContextMenu: (menu) => set({ contextMenu: menu }),
    toggleMinimap: () => set((state) => ({ showMinimap: !state.showMinimap })),
    toggleGrid: () => set((state) => ({ showGrid: !state.showGrid })),
    setSnapEnabled: (enabled) => set({ snapEnabled: enabled }),
    setShowOnboarding: (show) => set({ showOnboarding: show }),

    // ---- SAVE / LOAD ----
    markDirty: () => set({ is_dirty: true }),
    markSaved: () => set({ is_dirty: false, last_saved: new Date() }),

    loadFromJSON: (json) => {
      set({
        venue_id: json.venue_id,
        venue_name: json.venue_id,
        layout_version: 1,
        sections: json.sections.map((s) => ({
          id: s.json_id,
          db_id: s.db_id,
          label: s.label,
          section_type: s.section_type,
          fill_color: s.fill_color,
          border_color: s.border_color,
          opacity: s.opacity,
          shape: s.shape,
          x: s.x,
          y: s.y,
          width: s.width,
          height: s.height,
          points: s.points,
          z_index: s.z_index,
          capacity: s.capacity,
          is_numbered: s.is_numbered,
          is_locked: false,
          _selected: false,
        })),
        items: json.items.map((i) => ({
          id: i.json_id,
          db_id: i.db_id,
          section_id: i.section_json_id,
          item_type: i.item_type,
          shape_preset: i.shape_preset,
          x: i.x,
          y: i.y,
          width: i.width,
          height: i.height,
          rotation: i.rotation,
          label: i.label,
          label_visible: i.label_visible,
          label_position: i.label_position,
          z_index: i.z_index,
          capacity: i.capacity,
          chair_positions: i.chair_positions,
          _selected: false,
        })),
        statics: json.static_objects.map((s) => ({
          id: s.json_id,
          type: s.type,
          label: s.label,
          label_visible: s.label_visible,
          shape: s.shape,
          x: s.x,
          y: s.y,
          width: s.width,
          height: s.height,
          points: s.points,
          fill_color: s.fill_color,
          border_color: s.border_color,
          opacity: s.opacity,
          z_index: s.z_index,
          _selected: false,
        })),
        selection: { type: null, ids: [] },
        is_dirty: false,
        last_saved: null,
        history: [],
        historyIndex: -1,
      });
    },

    resetStore: (venueId, venueName) => {
      set({
        ...initialState,
        venue_id: venueId,
        venue_name: venueName,
      });
    },

    // ---- META ----
    setVenueMeta: (id, name) => set({ venue_id: id, venue_name: name }),
    setVenueName: (name) => set({ venue_name: name, is_dirty: true }),
  }))
);
