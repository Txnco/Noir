'use client';

import React from 'react';
import type { ViewportState } from '../../types/venueBuilder';

interface CanvasGridProps {
  viewport: ViewportState;
  showGrid: boolean;
}

export const CanvasGrid = React.memo(function CanvasGrid({
  viewport,
  showGrid,
}: CanvasGridProps) {
  if (!showGrid) return null;

  const GRID_SIZE = 20;
  const patternSize = GRID_SIZE * viewport.zoom;
  const dotRadius = Math.max(0.4, 0.8 / viewport.zoom);

  const offsetX = ((viewport.x % patternSize) + patternSize) % patternSize;
  const offsetY = ((viewport.y % patternSize) + patternSize) % patternSize;

  return (
    <>
      <defs>
        <pattern
          id="dot-grid"
          x={offsetX}
          y={offsetY}
          width={patternSize}
          height={patternSize}
          patternUnits="userSpaceOnUse"
        >
          <circle
            cx={patternSize / 2}
            cy={patternSize / 2}
            r={dotRadius}
            fill="#C5D0D8"
          />
        </pattern>
      </defs>
      <rect width="100%" height="100%" fill="url(#dot-grid)" />
    </>
  );
});
