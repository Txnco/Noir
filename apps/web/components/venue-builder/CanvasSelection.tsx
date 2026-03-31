'use client';

import React from 'react';
import type { ViewportState } from '../../types/venueBuilder';

interface MarqueeState {
  x: number;
  y: number;
  width: number;
  height: number;
}

interface CanvasSelectionProps {
  marquee: MarqueeState | null;
  viewport: ViewportState;
}

export function CanvasSelection({ marquee, viewport }: CanvasSelectionProps) {
  if (!marquee) return null;

  const sw = 1 / viewport.zoom;
  const dashArray = `${5 / viewport.zoom} ${3 / viewport.zoom}`;

  return (
    <rect
      x={marquee.x}
      y={marquee.y}
      width={Math.abs(marquee.width)}
      height={Math.abs(marquee.height)}
      fill="#7DB5C8"
      fillOpacity={0.08}
      stroke="#7DB5C8"
      strokeWidth={sw}
      strokeDasharray={dashArray}
      style={{ pointerEvents: 'none' }}
    />
  );
}
