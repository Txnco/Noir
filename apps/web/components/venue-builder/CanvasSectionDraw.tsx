'use client';

import React from 'react';
import type { ViewportState } from '../../types/venueBuilder';

interface DrawPreview {
  type: 'rect';
  x: number;
  y: number;
  width: number;
  height: number;
}

interface PolygonPreview {
  type: 'polygon';
  points: [number, number][];
  mouseX: number;
  mouseY: number;
}

interface CanvasSectionDrawProps {
  preview: DrawPreview | PolygonPreview | null;
  viewport: ViewportState;
}

export function CanvasSectionDraw({ preview, viewport }: CanvasSectionDrawProps) {
  if (!preview) return null;

  const sw = 1.5 / viewport.zoom;
  const dashArray = `${6 / viewport.zoom} ${3 / viewport.zoom}`;

  if (preview.type === 'rect') {
    return (
      <rect
        x={preview.x}
        y={preview.y}
        width={Math.abs(preview.width)}
        height={Math.abs(preview.height)}
        fill="#7DB5C8"
        fillOpacity={0.15}
        stroke="#7DB5C8"
        strokeWidth={sw}
        strokeDasharray={dashArray}
        rx={4 / viewport.zoom}
        style={{ pointerEvents: 'none' }}
      />
    );
  }

  if (preview.type === 'polygon') {
    const { points, mouseX, mouseY } = preview;
    if (points.length === 0) return null;

    const pointsStr = points.map(([x, y]) => `${x},${y}`).join(' ');
    const lastPoint = points[points.length - 1];

    return (
      <g style={{ pointerEvents: 'none' }}>
        {points.length >= 3 && (
          <polygon
            points={pointsStr}
            fill="#7DB5C8"
            fillOpacity={0.1}
            stroke="#7DB5C8"
            strokeWidth={sw}
            strokeDasharray={dashArray}
          />
        )}
        {points.length >= 2 && (
          <polyline
            points={pointsStr}
            fill="none"
            stroke="#7DB5C8"
            strokeWidth={sw}
          />
        )}
        {/* Line from last point to cursor */}
        <line
          x1={lastPoint[0]} y1={lastPoint[1]}
          x2={mouseX} y2={mouseY}
          stroke="#7DB5C8"
          strokeWidth={sw}
          strokeDasharray={dashArray}
        />
        {/* Vertex dots */}
        {points.map(([x, y], i) => (
          <circle
            key={i}
            cx={x} cy={y}
            r={4 / viewport.zoom}
            fill={i === 0 ? '#456981' : 'white'}
            stroke="#456981"
            strokeWidth={sw}
          />
        ))}
      </g>
    );
  }

  return null;
}
