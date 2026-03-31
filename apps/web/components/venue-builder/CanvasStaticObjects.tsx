'use client';

import React from 'react';
import { useBuilderStore } from '../../store/venueBuilderStore';

interface CanvasStaticObjectsProps {
  onObjectMouseDown: (e: React.MouseEvent, objId: string) => void;
}

export const CanvasStaticObjects = React.memo(function CanvasStaticObjects({
  onObjectMouseDown,
}: CanvasStaticObjectsProps) {
  const statics = useBuilderStore((s) => s.statics);
  const viewport = useBuilderStore((s) => s.viewport);
  const sw = 1.5 / viewport.zoom;
  const selectedSw = 2.5 / viewport.zoom;

  const sorted = [...statics].sort((a, b) => a.z_index - b.z_index);

  return (
    <>
      {sorted.map((obj) => {
        const isSelected = obj._selected;
        const stroke = isSelected ? '#7DB5C8' : obj.border_color;
        const strokeW = isSelected ? selectedSw : sw;
        const cx = (obj.x ?? 0) + (obj.width ?? 0) / 2;
        const cy = (obj.y ?? 0) + (obj.height ?? 0) / 2;

        return (
          <g key={obj.id}>
            {obj.shape === 'rect' && (
              <rect
                x={obj.x}
                y={obj.y}
                width={obj.width}
                height={obj.height}
                fill={obj.fill_color}
                fillOpacity={obj.opacity}
                stroke={stroke}
                strokeWidth={strokeW}
                rx={4 / viewport.zoom}
                style={{ cursor: 'move', pointerEvents: 'all' }}
                onMouseDown={(e) => onObjectMouseDown(e, obj.id)}
              />
            )}

            {obj.shape === 'polygon' && obj.points && (
              <polygon
                points={obj.points.map(([x, y]) => `${x},${y}`).join(' ')}
                fill={obj.fill_color}
                fillOpacity={obj.opacity}
                stroke={stroke}
                strokeWidth={strokeW}
                style={{ cursor: 'move', pointerEvents: 'all' }}
                onMouseDown={(e) => onObjectMouseDown(e, obj.id)}
              />
            )}

            {obj.label_visible && (
              <text
                x={cx}
                y={cy}
                textAnchor="middle"
                dominantBaseline="middle"
                fontSize={12 / viewport.zoom}
                fontWeight="500"
                fill="#2C3840"
                fillOpacity={0.7}
                style={{ pointerEvents: 'none', userSelect: 'none' }}
              >
                {obj.label}
              </text>
            )}
          </g>
        );
      })}
    </>
  );
});
