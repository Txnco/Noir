export const GRID_SIZE = 20; // px at zoom=1

export function snapToGrid(value: number, enabled: boolean): number {
  if (!enabled) return value;
  return Math.round(value / GRID_SIZE) * GRID_SIZE;
}

export function snapPoint(
  x: number,
  y: number,
  enabled: boolean
): [number, number] {
  return [snapToGrid(x, enabled), snapToGrid(y, enabled)];
}
