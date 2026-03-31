import type { CanvasSection, CanvasItem, StaticObject } from '../../types/venueBuilder';

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
): BoundingBox | null {
  const xs: number[] = [];
  const ys: number[] = [];

  for (const s of sections) {
    if (s.shape === 'rect' && s.x !== undefined && s.y !== undefined) {
      xs.push(s.x, s.x + (s.width ?? 0));
      ys.push(s.y, s.y + (s.height ?? 0));
    } else if (s.shape === 'polygon' && s.points) {
      for (const [px, py] of s.points) {
        xs.push(px);
        ys.push(py);
      }
    }
  }

  for (const i of items) {
    xs.push(i.x, i.x + i.width);
    ys.push(i.y, i.y + i.height);
  }

  for (const s of statics) {
    if (s.shape === 'rect' && s.x !== undefined && s.y !== undefined) {
      xs.push(s.x, s.x + (s.width ?? 0));
      ys.push(s.y, s.y + (s.height ?? 0));
    } else if (s.shape === 'polygon' && s.points) {
      for (const [px, py] of s.points) {
        xs.push(px);
        ys.push(py);
      }
    }
  }

  if (xs.length === 0) return null;

  return {
    min_x: Math.min(...xs),
    min_y: Math.min(...ys),
    max_x: Math.max(...xs),
    max_y: Math.max(...ys),
  };
}

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
} {
  const bb = computeBoundingBox(sections, items, statics);

  if (!bb) {
    return { sections, items, statics, canvasWidth: 800, canvasHeight: 600 };
  }

  const offsetX = bb.min_x - SAVE_MARGIN;
  const offsetY = bb.min_y - SAVE_MARGIN;
  const canvasWidth = bb.max_x - bb.min_x + 2 * SAVE_MARGIN;
  const canvasHeight = bb.max_y - bb.min_y + 2 * SAVE_MARGIN;

  const normalizedSections = sections.map((s) => {
    const out = { ...s };
    if (s.shape === 'rect' && s.x !== undefined && s.y !== undefined) {
      out.x = s.x - offsetX;
      out.y = s.y - offsetY;
    } else if (s.shape === 'polygon' && s.points) {
      out.points = s.points.map(([px, py]) => [px - offsetX, py - offsetY]);
    }
    return out;
  });

  const normalizedItems = items.map((i) => ({
    ...i,
    x: i.x - offsetX,
    y: i.y - offsetY,
  }));

  const normalizedStatics = statics.map((s) => {
    const out = { ...s };
    if (s.shape === 'rect' && s.x !== undefined && s.y !== undefined) {
      out.x = s.x - offsetX;
      out.y = s.y - offsetY;
    } else if (s.shape === 'polygon' && s.points) {
      out.points = s.points.map(([px, py]) => [px - offsetX, py - offsetY]);
    }
    return out;
  });

  return { sections: normalizedSections, items: normalizedItems, statics: normalizedStatics, canvasWidth, canvasHeight };
}
