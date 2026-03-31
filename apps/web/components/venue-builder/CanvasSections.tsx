'use client';

import React from 'react';
import { useBuilderStore } from '../../store/venueBuilderStore';

interface CanvasSectionsProps {
  onSectionMouseDown: (e: React.MouseEvent, sectionId: string) => void;
  onResizeHandleMouseDown: (
    e: React.MouseEvent,
    sectionId: string,
    handle: string
  ) => void;
}

function getSectionCenter(section: { x?: number; y?: number; width?: number; height?: number; points?: [number, number][] }) {
  if (section.x !== undefined && section.y !== undefined) {
    return {
      cx: section.x + (section.width ?? 0) / 2,
      cy: section.y + (section.height ?? 0) / 2,
    };
  }
  if (section.points && section.points.length > 0) {
    const xs = section.points.map(([x]) => x);
    const ys = section.points.map(([, y]) => y);
    return {
      cx: (Math.min(...xs) + Math.max(...xs)) / 2,
      cy: (Math.min(...ys) + Math.max(...ys)) / 2,
    };
  }
  return { cx: 0, cy: 0 };
}

export const CanvasSections = React.memo(function CanvasSections({
  onSectionMouseDown,
  onResizeHandleMouseDown,
}: CanvasSectionsProps) {
  const sections = useBuilderStore((s) => s.sections);
  const viewport = useBuilderStore((s) => s.viewport);
  const strokeWidth = 2 / viewport.zoom;
  const selectedStroke = 2.5 / viewport.zoom;
  const handleSize = 8 / viewport.zoom;

  const sorted = [...sections].sort((a, b) => a.z_index - b.z_index);

  return (
    <>
      {sorted.map((section) => {
        const isSelected = section._selected;
        const stroke = isSelected ? '#7DB5C8' : section.border_color;
        const sw = isSelected ? selectedStroke : strokeWidth;
        const { cx, cy } = getSectionCenter(section);

        return (
          <g key={section.id}>
            {section.shape === 'rect' && (
              <rect
                x={section.x}
                y={section.y}
                width={section.width}
                height={section.height}
                fill={section.fill_color}
                fillOpacity={section.opacity * (section.is_locked ? 0.7 : 1)}
                stroke={stroke}
                strokeWidth={sw}
                rx={4 / viewport.zoom}
                style={{
                  cursor: section.is_locked ? 'not-allowed' : 'move',
                  pointerEvents: 'all',
                }}
                onMouseDown={(e) => !section.is_locked && onSectionMouseDown(e, section.id)}
              />
            )}

            {section.shape === 'polygon' && section.points && (
              <polygon
                points={section.points.map(([x, y]) => `${x},${y}`).join(' ')}
                fill={section.fill_color}
                fillOpacity={section.opacity * (section.is_locked ? 0.7 : 1)}
                stroke={stroke}
                strokeWidth={sw}
                style={{
                  cursor: section.is_locked ? 'not-allowed' : 'move',
                  pointerEvents: 'all',
                }}
                onMouseDown={(e) => !section.is_locked && onSectionMouseDown(e, section.id)}
              />
            )}

            {/* Section label */}
            <text
              x={cx}
              y={cy}
              textAnchor="middle"
              dominantBaseline="middle"
              fontSize={13 / viewport.zoom}
              fontWeight="500"
              fill="#2C3840"
              fillOpacity={0.8}
              style={{ pointerEvents: 'none', userSelect: 'none' }}
            >
              {section.label}
            </text>

            {/* Capacity badge */}
            {section.capacity > 0 && (
              <text
                x={(section.x ?? 0) + (section.width ?? 0) - 4 / viewport.zoom}
                y={(section.y ?? 0) + (section.height ?? 0) - 4 / viewport.zoom}
                textAnchor="end"
                fontSize={9 / viewport.zoom}
                fill="#6B8FA3"
                fillOpacity={0.8}
                style={{ pointerEvents: 'none', userSelect: 'none' }}
              >
                {section.capacity}
              </text>
            )}

            {/* Resize handles — only for rect sections when selected */}
            {isSelected && section.shape === 'rect' &&
              section.x !== undefined && section.y !== undefined && (
                <ResizeHandles
                  x={section.x}
                  y={section.y}
                  w={section.width ?? 0}
                  h={section.height ?? 0}
                  handleSize={handleSize}
                  strokeWidth={strokeWidth}
                  sectionId={section.id}
                  onHandleMouseDown={onResizeHandleMouseDown}
                />
              )}
          </g>
        );
      })}
    </>
  );
});

const HANDLES = [
  { id: 'nw', cx: 0,   cy: 0   },
  { id: 'n',  cx: 0.5, cy: 0   },
  { id: 'ne', cx: 1,   cy: 0   },
  { id: 'e',  cx: 1,   cy: 0.5 },
  { id: 'se', cx: 1,   cy: 1   },
  { id: 's',  cx: 0.5, cy: 1   },
  { id: 'sw', cx: 0,   cy: 1   },
  { id: 'w',  cx: 0,   cy: 0.5 },
];

const HANDLE_CURSORS: Record<string, string> = {
  n: 'n-resize', s: 's-resize',
  e: 'e-resize', w: 'w-resize',
  ne: 'ne-resize', nw: 'nw-resize',
  se: 'se-resize', sw: 'sw-resize',
};

function ResizeHandles({
  x, y, w, h, handleSize, strokeWidth, sectionId, onHandleMouseDown,
}: {
  x: number; y: number; w: number; h: number;
  handleSize: number; strokeWidth: number; sectionId: string;
  onHandleMouseDown: (e: React.MouseEvent, id: string, handle: string) => void;
}) {
  const hs = handleSize;

  return (
    <>
      {HANDLES.map((handle) => (
        <rect
          key={handle.id}
          x={x + w * handle.cx - hs / 2}
          y={y + h * handle.cy - hs / 2}
          width={hs}
          height={hs}
          fill="white"
          stroke="#7DB5C8"
          strokeWidth={strokeWidth}
          rx={1 / 1}
          style={{ cursor: HANDLE_CURSORS[handle.id], pointerEvents: 'all' }}
          onMouseDown={(e) => {
            e.stopPropagation();
            onHandleMouseDown(e, sectionId, handle.id);
          }}
        />
      ))}
    </>
  );
}
