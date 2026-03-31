'use client';

import React, { useRef, useCallback, useState, useEffect } from 'react';
import { useBuilderStore } from '../../store/venueBuilderStore';
import { snapPoint } from '../../lib/venue-builder/snapUtils';
import { SHAPE_PRESETS, getDefaultCapacity } from '../../lib/venue-builder/shapePresets';
import { SECTION_TYPE_DEFAULTS, STATIC_TYPE_DEFAULTS } from '../../lib/venue-builder/sectionDefaults';
import { CanvasGrid } from './CanvasGrid';
import { CanvasSections } from './CanvasSections';
import { CanvasItems } from './CanvasItems';
import { CanvasStaticObjects } from './CanvasStaticObjects';
import { CanvasSectionDraw } from './CanvasSectionDraw';
import { CanvasSelection } from './CanvasSelection';
import { Minimap } from './Minimap';
import { ContextMenu } from './ContextMenu';
import { FloatingItemEditor } from './FloatingItemEditor';
import { v4 as uuidv4 } from 'uuid';
import type { CanvasSection, CanvasItem, StaticObject, PlaceRowContext } from '../../types/venueBuilder';

interface DragState {
  isDragging: boolean;
  isPanning: boolean;
  isDrawingRect: boolean;
  isDrawingPolygon: boolean;
  isResizing: boolean;
  isMarqueeSelecting: boolean;
  startX: number;
  startY: number;
  lastX: number;
  lastY: number;
  targetId: string | null;
  targetType: 'section' | 'item' | 'static' | null;
  resizeHandle: string | null;
  resizeOriginX: number;
  resizeOriginY: number;
  resizeOriginW: number;
  resizeOriginH: number;
  polygonPoints: [number, number][];
  spaceDown: boolean;
  // Origin-based drag tracking (canvas coords at drag start + element position at drag start)
  dragOriginCanvasX: number;
  dragOriginCanvasY: number;
  dragOriginElemX: number;
  dragOriginElemY: number;
  // Row tool state
  isPlacingRow: boolean;
  rowStartX: number;
  rowStartY: number;
}

const initialDragState = (): DragState => ({
  isDragging: false,
  isPanning: false,
  isDrawingRect: false,
  isDrawingPolygon: false,
  isResizing: false,
  isMarqueeSelecting: false,
  startX: 0, startY: 0, lastX: 0, lastY: 0,
  targetId: null, targetType: null,
  resizeHandle: null,
  resizeOriginX: 0, resizeOriginY: 0, resizeOriginW: 0, resizeOriginH: 0,
  polygonPoints: [],
  spaceDown: false,
  dragOriginCanvasX: 0,
  dragOriginCanvasY: 0,
  dragOriginElemX: 0,
  dragOriginElemY: 0,
  isPlacingRow: false,
  rowStartX: 0,
  rowStartY: 0,
});

interface DrawPreview {
  type: 'rect';
  x: number; y: number; width: number; height: number;
}
interface PolygonPreview {
  type: 'polygon';
  points: [number, number][];
  mouseX: number; mouseY: number;
}
interface RowPreview {
  type: 'row';
  startX: number; startY: number;
  endX: number; endY: number;
  rowCtx: PlaceRowContext;
}

export function Canvas() {
  const store = useBuilderStore();
  const {
    viewport, tool, snapEnabled, showGrid, showMinimap,
    drawSectionContext, placeItemContext, placeStaticContext, placeRowContext,
    floatingEditorItemId, contextMenu,
  } = store;

  const svgRef = useRef<SVGSVGElement>(null);
  const drag = useRef<DragState>(initialDragState());
  const [drawPreview, setDrawPreview] = useState<DrawPreview | PolygonPreview | RowPreview | null>(null);
  const [marquee, setMarquee] = useState<{ x: number; y: number; width: number; height: number } | null>(null);

  // Section counter refs for label generation
  const sectionCountRef = useRef(0);
  const staticCountRef = useRef(0);

  function screenToCanvas(screenX: number, screenY: number): [number, number] {
    const rect = svgRef.current!.getBoundingClientRect();
    return [
      (screenX - rect.left - viewport.x) / viewport.zoom,
      (screenY - rect.top - viewport.y) / viewport.zoom,
    ];
  }

  function getSnapEnabled(e: MouseEvent | React.MouseEvent): boolean {
    return snapEnabled && !e.ctrlKey;
  }

  function getCursor(): string {
    const d = drag.current;
    if (d.isPanning || tool === 'pan') return d.isDragging ? 'grabbing' : 'grab';
    if (d.spaceDown) return d.isDragging ? 'grabbing' : 'grab';
    if (tool === 'draw_section' || tool === 'place_item' || tool === 'place_static') return 'crosshair';
    return 'default';
  }

  // ---- MOUSE DOWN ----
  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if (e.button === 1) {
      // Middle mouse = pan
      e.preventDefault();
      drag.current.isPanning = true;
      drag.current.isDragging = true;
      drag.current.lastX = e.clientX;
      drag.current.lastY = e.clientY;
      return;
    }
    if (e.button !== 0) return;

    const [cx, cy] = screenToCanvas(e.clientX, e.clientY);
    const d = drag.current;
    d.startX = cx; d.startY = cy;
    d.lastX = e.clientX; d.lastY = e.clientY;

    // Space is held = pan
    if (d.spaceDown || tool === 'pan') {
      d.isPanning = true;
      d.isDragging = true;
      return;
    }

    // Draw section (rect)
    if (tool === 'draw_section' && drawSectionContext?.shape === 'rect') {
      d.isDrawingRect = true;
      setDrawPreview({ type: 'rect', x: cx, y: cy, width: 0, height: 0 });
      return;
    }

    // Draw polygon — handled in click
    if (tool === 'draw_section' && drawSectionContext?.shape === 'polygon') {
      return;
    }

    // Place item — handled in click
    if (tool === 'place_item') return;

    // Place static — handled in click
    if (tool === 'place_static') return;

    // Place row — handled in click
    if (tool === 'place_row') return;

    // Select mode on empty canvas — start marquee
    if (tool === 'select') {
      store.clearSelection();
      d.isMarqueeSelecting = true;
      setMarquee({ x: cx, y: cy, width: 0, height: 0 });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tool, drawSectionContext, snapEnabled]);

  // ---- MOUSE MOVE ----
  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    const d = drag.current;
    const dx = e.clientX - d.lastX;
    const dy = e.clientY - d.lastY;

    if (d.isPanning) {
      store.panBy(dx, dy);
      d.lastX = e.clientX;
      d.lastY = e.clientY;
      return;
    }

    const [cx, cy] = screenToCanvas(e.clientX, e.clientY);

    if (d.isDrawingRect) {
      const [sx, sy] = [d.startX, d.startY];
      const [snappedX, snappedY] = snapPoint(cx, cy, getSnapEnabled(e));
      setDrawPreview({
        type: 'rect',
        x: Math.min(sx, snappedX),
        y: Math.min(sy, snappedY),
        width: Math.abs(snappedX - sx),
        height: Math.abs(snappedY - sy),
      });
      return;
    }

    if (d.isDrawingPolygon) {
      const [snappedX, snappedY] = snapPoint(cx, cy, getSnapEnabled(e));
      setDrawPreview({
        type: 'polygon',
        points: d.polygonPoints,
        mouseX: snappedX,
        mouseY: snappedY,
      });
      return;
    }

    if (d.isPlacingRow && placeRowContext) {
      const [snappedX, snappedY] = snapPoint(cx, cy, getSnapEnabled(e));
      setDrawPreview({
        type: 'row',
        startX: d.rowStartX, startY: d.rowStartY,
        endX: snappedX, endY: snappedY,
        rowCtx: placeRowContext,
      });
      return;
    }

    if (d.isMarqueeSelecting) {
      setMarquee({
        x: Math.min(d.startX, cx),
        y: Math.min(d.startY, cy),
        width: Math.abs(cx - d.startX),
        height: Math.abs(cy - d.startY),
      });
      return;
    }

    if (d.isDragging && d.targetId && d.targetType) {
      const snap = getSnapEnabled(e);
      const liveState = useBuilderStore.getState();

      if (d.targetType === 'item') {
        // Origin-based: compute new position from drag start, then snap
        const newX = d.dragOriginElemX + (cx - d.dragOriginCanvasX);
        const newY = d.dragOriginElemY + (cy - d.dragOriginCanvasY);
        const [nx, ny] = snapPoint(newX, newY, snap);
        store.updateItem(d.targetId, { x: nx, y: ny });
      } else if (d.targetType === 'section') {
        const sec = liveState.sections.find((s) => s.id === d.targetId);
        if (sec && !sec.is_locked) {
          if (sec.shape === 'rect') {
            // Origin-based snap for section; apply actual snapped delta to children
            const newX = d.dragOriginElemX + (cx - d.dragOriginCanvasX);
            const newY = d.dragOriginElemY + (cy - d.dragOriginCanvasY);
            const [nx, ny] = snapPoint(newX, newY, snap);
            const actualDx = nx - (sec.x ?? 0);
            const actualDy = ny - (sec.y ?? 0);
            store.updateSection(d.targetId, { x: nx, y: ny });
            for (const item of liveState.items) {
              if (item.section_id === d.targetId) {
                store.updateItem(item.id, { x: item.x + actualDx, y: item.y + actualDy });
              }
            }
          } else if (sec.shape === 'polygon' && sec.points) {
            // Polygon sections: increment-based (no grid snap on individual points)
            const worldDx = dx / viewport.zoom;
            const worldDy = dy / viewport.zoom;
            const newPoints = sec.points.map(([px, py]) => [px + worldDx, py + worldDy] as [number, number]);
            store.updateSection(d.targetId, { points: newPoints });
          }
        }
      } else if (d.targetType === 'static') {
        // Origin-based snap for static objects
        const newX = d.dragOriginElemX + (cx - d.dragOriginCanvasX);
        const newY = d.dragOriginElemY + (cy - d.dragOriginCanvasY);
        const [nx, ny] = snapPoint(newX, newY, snap);
        store.updateStaticObject(d.targetId, { x: nx, y: ny });
      }

      d.lastX = e.clientX;
      d.lastY = e.clientY;
      return;
    }

    if (d.isResizing && d.targetId && d.resizeHandle) {
      const worldDx = dx / viewport.zoom;
      const worldDy = dy / viewport.zoom;
      const sec = useBuilderStore.getState().sections.find((s) => s.id === d.targetId);
      if (sec && sec.shape === 'rect') {
        let { x, y, width, height } = {
          x: sec.x ?? 0,
          y: sec.y ?? 0,
          width: sec.width ?? 0,
          height: sec.height ?? 0,
        };
        const handle = d.resizeHandle;
        if (handle.includes('e')) width = Math.max(20, width + worldDx);
        if (handle.includes('s')) height = Math.max(20, height + worldDy);
        if (handle.includes('w')) { x += worldDx; width = Math.max(20, width - worldDx); }
        if (handle.includes('n')) { y += worldDy; height = Math.max(20, height - worldDy); }
        store.updateSection(d.targetId, { x, y, width, height });
      }
      d.lastX = e.clientX;
      d.lastY = e.clientY;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [viewport.zoom, snapEnabled, placeRowContext]);

  // ---- MOUSE UP ----
  const handleMouseUp = useCallback((e: React.MouseEvent) => {
    const d = drag.current;

    if (d.isDrawingRect) {
      d.isDrawingRect = false;
      const preview = drawPreview as DrawPreview | null;
      if (preview && preview.width > 20 && preview.height > 20) {
        const sectionType = drawSectionContext?.section_type ?? 'seated';
        const defaults = SECTION_TYPE_DEFAULTS[sectionType];
        sectionCountRef.current++;
        const newSection: CanvasSection = {
          id: `section-${uuidv4()}`,
          db_id: null,
          label: `${defaults.label_prefix} ${sectionCountRef.current}`,
          section_type: sectionType,
          fill_color: defaults.fill_color,
          border_color: defaults.border_color,
          opacity: defaults.opacity,
          shape: 'rect',
          x: preview.x,
          y: preview.y,
          width: preview.width,
          height: preview.height,
          z_index: useBuilderStore.getState().sections.length,
          capacity: 0,
          is_numbered: false,
          is_locked: false,
        };
        store.addSection(newSection);
        store.selectElement(newSection.id, 'section');
      }
      setDrawPreview(null);
      return;
    }

    if (d.isMarqueeSelecting && marquee) {
      d.isMarqueeSelecting = false;
      setMarquee(null);
      // Find elements inside marquee
      const { x: mx, y: my, width: mw, height: mh } = marquee;
      const inMarquee = (ex: number, ey: number, ew: number, eh: number) =>
        ex + ew > mx && ex < mx + mw && ey + eh > my && ey < my + mh;

      const liveItems = useBuilderStore.getState().items;
      const selectedItems = liveItems
        .filter((i) => inMarquee(i.x, i.y, i.width, i.height))
        .map((i) => i.id);

      if (selectedItems.length > 0) {
        store.selectMultiple(selectedItems, 'item');
        liveItems.forEach((i) => {
          store.updateItem(i.id, { _selected: selectedItems.includes(i.id) } as never);
        });
      }
      return;
    }

    if (d.isDragging) {
      store.pushHistory();
    }

    d.isDragging = false;
    d.isPanning = false;
    d.isResizing = false;
    d.targetId = null;
    d.targetType = null;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [drawPreview, marquee, drawSectionContext]);

  // ---- CLICK (for place tools and polygon) ----
  const handleClick = useCallback((e: React.MouseEvent) => {
    const d = drag.current;
    if (d.isPanning) return;
    if (d.isDragging) return;

    const [cx, cy] = screenToCanvas(e.clientX, e.clientY);
    const [snappedX, snappedY] = snapPoint(cx, cy, getSnapEnabled(e));

    // Draw polygon — add point
    if (tool === 'draw_section' && drawSectionContext?.shape === 'polygon') {
      if (!d.isDrawingPolygon) {
        d.isDrawingPolygon = true;
        d.polygonPoints = [[snappedX, snappedY]];
        setDrawPreview({
          type: 'polygon',
          points: [[snappedX, snappedY]],
          mouseX: snappedX, mouseY: snappedY,
        });
      } else {
        // Check if clicking near first point to close
        const first = d.polygonPoints[0];
        const dist = Math.hypot(snappedX - first[0], snappedY - first[1]);
        const closeThreshold = 15 / viewport.zoom;
        if (dist < closeThreshold && d.polygonPoints.length >= 3) {
          finishPolygon(d.polygonPoints);
        } else {
          d.polygonPoints = [...d.polygonPoints, [snappedX, snappedY]];
          setDrawPreview({
            type: 'polygon',
            points: d.polygonPoints,
            mouseX: snappedX, mouseY: snappedY,
          });
        }
      }
      return;
    }

    // Place item
    if (tool === 'place_item' && placeItemContext) {
      const preset = SHAPE_PRESETS[placeItemContext.shape_preset];
      const w = preset.defaultWidth;
      const h = preset.defaultHeight;
      const [px, py] = snapPoint(snappedX - w / 2, snappedY - h / 2, getSnapEnabled(e));

      // Find which section this lands in
      const { sections: liveSections, items: liveItemsPlace } = useBuilderStore.getState();
      const sectionId = findSectionAtPoint(snappedX, snappedY, liveSections);
      const existingInSection = liveItemsPlace.filter(
        (i) => i.section_id === sectionId
      ).length;

      const newItem: CanvasItem = {
        id: `item-${uuidv4()}`,
        db_id: null,
        section_id: sectionId,
        item_type: placeItemContext.item_type,
        shape_preset: placeItemContext.shape_preset,
        x: px, y: py, width: w, height: h,
        rotation: 0,
        label: `${existingInSection + 1}`,
        label_visible: true,
        label_position: 'below',
        z_index: useBuilderStore.getState().items.length,
        capacity: getDefaultCapacity(placeItemContext.shape_preset),
        _selected: false,
      };
      store.addItem(newItem);
      return;
    }

    // Place static
    if (tool === 'place_static' && placeStaticContext) {
      const defaults = STATIC_TYPE_DEFAULTS[placeStaticContext.static_type];
      staticCountRef.current++;
      const [px, py] = snapPoint(
        snappedX - defaults.default_width / 2,
        snappedY - defaults.default_height / 2,
        getSnapEnabled(e)
      );
      const newObj: StaticObject = {
        id: `static-${uuidv4()}`,
        type: placeStaticContext.static_type,
        label: defaults.label,
        label_visible: true,
        shape: 'rect',
        x: px, y: py,
        width: defaults.default_width,
        height: defaults.default_height,
        fill_color: defaults.fill_color,
        border_color: defaults.border_color,
        opacity: 0.8,
        z_index: useBuilderStore.getState().statics.length,
        _selected: false,
      };
      store.addStaticObject(newObj);
      return;
    }

    // Place row — two-click: first click sets start, second click places seats
    if (tool === 'place_row' && placeRowContext) {
      const d = drag.current;
      if (!d.isPlacingRow) {
        d.isPlacingRow = true;
        d.rowStartX = snappedX;
        d.rowStartY = snappedY;
        setDrawPreview({
          type: 'row',
          startX: snappedX, startY: snappedY,
          endX: snappedX, endY: snappedY,
          rowCtx: placeRowContext,
        });
      } else {
        d.isPlacingRow = false;
        setDrawPreview(null);
        placeRowSeats(d.rowStartX, d.rowStartY, snappedX, snappedY, placeRowContext);
      }
      return;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tool, drawSectionContext, placeItemContext, placeStaticContext, placeRowContext, viewport.zoom, snapEnabled]);

  // ---- DOUBLE CLICK (close polygon) ----
  const handleDoubleClick = useCallback((e: React.MouseEvent) => {
    const d = drag.current;
    if (d.isDrawingPolygon && d.polygonPoints.length >= 3) {
      e.preventDefault();
      finishPolygon(d.polygonPoints);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [drawSectionContext]);

  function finishPolygon(points: [number, number][]) {
    const d = drag.current;
    d.isDrawingPolygon = false;
    d.polygonPoints = [];
    setDrawPreview(null);

    const sectionType = drawSectionContext?.section_type ?? 'seated';
    const defaults = SECTION_TYPE_DEFAULTS[sectionType];
    sectionCountRef.current++;

    const newSection: CanvasSection = {
      id: `section-${uuidv4()}`,
      db_id: null,
      label: `${defaults.label_prefix} ${sectionCountRef.current}`,
      section_type: sectionType,
      fill_color: defaults.fill_color,
      border_color: defaults.border_color,
      opacity: defaults.opacity,
      shape: 'polygon',
      points,
      z_index: useBuilderStore.getState().sections.length,
      capacity: 0,
      is_numbered: false,
      is_locked: false,
    };
    store.addSection(newSection);
    store.selectElement(newSection.id, 'section');
  }

  function placeRowSeats(startX: number, startY: number, endX: number, endY: number, ctx: PlaceRowContext) {
    const dist = Math.hypot(endX - startX, endY - startY);
    const preset = SHAPE_PRESETS[ctx.shape_preset];
    const sw = preset.defaultWidth;
    const sh = preset.defaultHeight;

    let count = ctx.count;
    if (count === 0) {
      count = Math.max(1, Math.round(dist / ctx.spacing) + 1);
    }

    const liveState = useBuilderStore.getState();
    const newItems: CanvasItem[] = [];
    for (let i = 0; i < count; i++) {
      const t = count === 1 ? 0 : i / (count - 1);
      const cx = startX + t * (endX - startX);
      const cy = startY + t * (endY - startY);
      const sectionId = findSectionAtPoint(cx, cy, liveState.sections);
      newItems.push({
        id: `item-${uuidv4()}`,
        db_id: null,
        section_id: sectionId,
        item_type: 'seat',
        shape_preset: ctx.shape_preset,
        x: cx - sw / 2,
        y: cy - sh / 2,
        width: sw,
        height: sh,
        rotation: 0,
        label: `${ctx.label_prefix}${i + 1}`,
        label_visible: true,
        label_position: 'below',
        z_index: liveState.items.length + i,
        capacity: 1,
        _selected: false,
      });
    }
    store.addItemsBatch(newItems);
  }

  // ---- WHEEL (zoom + pan) ----
  const handleWheel = useCallback((e: React.WheelEvent) => {
    e.preventDefault();
    if (e.ctrlKey) {
      const delta = -e.deltaY * 0.001;
      const newZoom = Math.max(0.1, Math.min(4.0, viewport.zoom * (1 + delta)));
      const rect = svgRef.current!.getBoundingClientRect();
      const mouseX = e.clientX - rect.left;
      const mouseY = e.clientY - rect.top;
      const scale = newZoom / viewport.zoom;
      store.setViewport({
        zoom: newZoom,
        x: mouseX - (mouseX - viewport.x) * scale,
        y: mouseY - (mouseY - viewport.y) * scale,
      });
    } else if (e.shiftKey) {
      store.panBy(-e.deltaY * 0.8, 0);
    } else {
      store.panBy(-e.deltaX * 0.8, -e.deltaY * 0.8);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [viewport]);

  // ---- CONTEXT MENU ----
  const handleContextMenu = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    store.setContextMenu({
      x: e.clientX,
      y: e.clientY,
      targetId: null,
      targetType: null,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ---- KEYBOARD (space for pan) ----
  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.code === 'Space' && !e.repeat) {
        const el = document.activeElement;
        if (el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA')) return;
        drag.current.spaceDown = true;
      }
    };
    const up = (e: KeyboardEvent) => {
      if (e.code === 'Space') drag.current.spaceDown = false;
    };
    window.addEventListener('keydown', down);
    window.addEventListener('keyup', up);
    return () => {
      window.removeEventListener('keydown', down);
      window.removeEventListener('keyup', up);
    };
  }, []);

  // Element mousedown handlers passed to child components
  const handleSectionMouseDown = useCallback((e: React.MouseEvent, sectionId: string) => {
    e.stopPropagation();
    const d = drag.current;
    if (d.spaceDown || tool === 'pan') return;
    if (tool !== 'select') return;
    store.selectElement(sectionId, 'section', e.shiftKey);
    const liveState = useBuilderStore.getState();
    const { viewport: vp } = liveState;
    const rect = svgRef.current!.getBoundingClientRect();
    const cx = (e.clientX - rect.left - vp.x) / vp.zoom;
    const cy = (e.clientY - rect.top - vp.y) / vp.zoom;
    const sec = liveState.sections.find((s) => s.id === sectionId);
    d.isDragging = true;
    d.targetId = sectionId;
    d.targetType = 'section';
    d.lastX = e.clientX;
    d.lastY = e.clientY;
    d.dragOriginCanvasX = cx;
    d.dragOriginCanvasY = cy;
    d.dragOriginElemX = sec?.x ?? 0;
    d.dragOriginElemY = sec?.y ?? 0;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tool]);

  const handleResizeHandleMouseDown = useCallback((e: React.MouseEvent, sectionId: string, handle: string) => {
    e.stopPropagation();
    const d = drag.current;
    d.isResizing = true;
    d.isDragging = false;
    d.targetId = sectionId;
    d.resizeHandle = handle;
    d.lastX = e.clientX;
    d.lastY = e.clientY;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleItemMouseDown = useCallback((e: React.MouseEvent, itemId: string) => {
    e.stopPropagation();
    const d = drag.current;
    if (d.spaceDown || tool === 'pan') return;
    if (tool !== 'select') return;
    store.selectElement(itemId, 'item', e.shiftKey);
    const liveState = useBuilderStore.getState();
    const { viewport: vp } = liveState;
    const rect = svgRef.current!.getBoundingClientRect();
    const cx = (e.clientX - rect.left - vp.x) / vp.zoom;
    const cy = (e.clientY - rect.top - vp.y) / vp.zoom;
    const item = liveState.items.find((i) => i.id === itemId);
    d.isDragging = true;
    d.targetId = itemId;
    d.targetType = 'item';
    d.lastX = e.clientX;
    d.lastY = e.clientY;
    d.dragOriginCanvasX = cx;
    d.dragOriginCanvasY = cy;
    d.dragOriginElemX = item?.x ?? 0;
    d.dragOriginElemY = item?.y ?? 0;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tool]);

  const handleItemDoubleClick = useCallback((e: React.MouseEvent, itemId: string) => {
    e.stopPropagation();
    store.setFloatingEditorItemId(itemId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleStaticMouseDown = useCallback((e: React.MouseEvent, objId: string) => {
    e.stopPropagation();
    const d = drag.current;
    if (d.spaceDown || tool === 'pan') return;
    if (tool !== 'select') return;
    store.selectElement(objId, 'static', e.shiftKey);
    const liveState = useBuilderStore.getState();
    const { viewport: vp } = liveState;
    const rect = svgRef.current!.getBoundingClientRect();
    const cx = (e.clientX - rect.left - vp.x) / vp.zoom;
    const cy = (e.clientY - rect.top - vp.y) / vp.zoom;
    const obj = liveState.statics.find((s) => s.id === objId);
    d.isDragging = true;
    d.targetId = objId;
    d.targetType = 'static';
    d.lastX = e.clientX;
    d.lastY = e.clientY;
    d.dragOriginCanvasX = cx;
    d.dragOriginCanvasY = cy;
    d.dragOriginElemX = obj?.x ?? 0;
    d.dragOriginElemY = obj?.y ?? 0;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tool]);

  const transform = `translate(${viewport.x}, ${viewport.y}) scale(${viewport.zoom})`;
  const cursor = getCursor();

  return (
    <div
      className="absolute inset-0 canvas-area overflow-hidden"
      style={{ left: 56, top: 56 }}
      onContextMenu={handleContextMenu}
    >
      <svg
        ref={svgRef}
        width="100%"
        height="100%"
        style={{ cursor, display: 'block' }}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onClick={handleClick}
        onDoubleClick={handleDoubleClick}
        onWheel={handleWheel}
      >
        {/* Background + dot grid */}
        <rect width="100%" height="100%" fill="#F5F4F0" />
        <CanvasGrid viewport={viewport} showGrid={showGrid} />

        {/* Canvas content group — all transformed */}
        <g transform={transform}>
          {/* Static objects below z_index 0 */}
          <CanvasStaticObjects onObjectMouseDown={handleStaticMouseDown} />
          <CanvasSections
            onSectionMouseDown={handleSectionMouseDown}
            onResizeHandleMouseDown={handleResizeHandleMouseDown}
          />
          <CanvasItems
            onItemMouseDown={handleItemMouseDown}
            onItemDoubleClick={handleItemDoubleClick}
          />
          <CanvasSectionDraw preview={drawPreview} viewport={viewport} />
          <CanvasSelection marquee={marquee} viewport={viewport} />
        </g>
      </svg>

      {/* Minimap — HTML overlay outside SVG */}
      {showMinimap && <Minimap svgRef={svgRef} />}

      {/* Floating editor — HTML overlay */}
      {floatingEditorItemId && <FloatingItemEditor svgRef={svgRef} />}

      {/* Context menu */}
      {contextMenu && <ContextMenu />}
    </div>
  );
}

// Find which section a canvas point falls into
function findSectionAtPoint(
  x: number,
  y: number,
  sections: CanvasSection[]
): string | null {
  for (let i = sections.length - 1; i >= 0; i--) {
    const s = sections[i];
    if (s.shape === 'rect' && s.x !== undefined && s.y !== undefined) {
      if (x >= s.x && x <= s.x + (s.width ?? 0) && y >= s.y && y <= s.y + (s.height ?? 0)) {
        return s.id;
      }
    } else if (s.shape === 'polygon' && s.points) {
      if (pointInPolygon(x, y, s.points)) return s.id;
    }
  }
  return null;
}

function pointInPolygon(x: number, y: number, polygon: [number, number][]): boolean {
  let inside = false;
  const n = polygon.length;
  for (let i = 0, j = n - 1; i < n; j = i++) {
    const [xi, yi] = polygon[i];
    const [xj, yj] = polygon[j];
    const intersect = yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi;
    if (intersect) inside = !inside;
  }
  return inside;
}
