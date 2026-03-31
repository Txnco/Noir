'use client';

import React from 'react';
import { useBuilderStore } from '../../store/venueBuilderStore';
import type { CanvasItem, ShapePreset } from '../../types/venueBuilder';

interface CanvasItemsProps {
  onItemMouseDown: (e: React.MouseEvent, itemId: string) => void;
  onItemDoubleClick: (e: React.MouseEvent, itemId: string) => void;
}

function getItemColor(
  item: CanvasItem,
  sections: { id: string; fill_color: string; border_color: string }[]
): { fill: string; stroke: string } {
  const section = sections.find((s) => s.id === item.section_id);
  if (section) {
    // Slightly darker than section fill
    return { fill: section.border_color, stroke: section.border_color };
  }
  return { fill: '#7B9EB0', stroke: '#5A8299' };
}

function renderShape(item: CanvasItem, fill: string, stroke: string, sw: number) {
  const { width: w, height: h, shape_preset } = item;

  switch (shape_preset as ShapePreset) {
    case 'circle':
      return (
        <circle
          cx={w / 2} cy={h / 2}
          r={Math.min(w, h) / 2 - sw}
          fill={fill} stroke={stroke} strokeWidth={sw}
        />
      );

    case 'rounded_square':
      return (
        <rect
          x={sw / 2} y={sw / 2}
          width={w - sw} height={h - sw}
          rx={4} ry={4}
          fill={fill} stroke={stroke} strokeWidth={sw}
        />
      );

    case 'chair_topdown': {
      const scaleX = w / 40;
      const scaleY = h / 40;
      return (
        <g transform={`scale(${scaleX}, ${scaleY})`}>
          <path
            d="M10,4 h20 a4,4 0 0 1 4,4 v4 H6 V8 a4,4 0 0 1 4,-4 Z M4,17 h32 a3,3 0 0 1 3,3 v16 a3,3 0 0 1 -3,3 H4 a3,3 0 0 1 -3,-3 V20 a3,3 0 0 1 3,-3 Z"
            fill={fill} stroke={stroke} strokeWidth={sw / scaleX}
          />
        </g>
      );
    }

    case 'bar_stool':
      return (
        <circle
          cx={w / 2} cy={h / 2}
          r={Math.min(w, h) / 2 - sw}
          fill={fill} stroke={stroke} strokeWidth={sw}
          strokeDasharray={`${3} ${2}`}
        />
      );

    case 'round_table_4':
    case 'round_table_6':
    case 'round_table_8': {
      const capacity = shape_preset === 'round_table_4' ? 4 : shape_preset === 'round_table_6' ? 6 : 8;
      return <RoundTable w={w} h={h} fill={fill} stroke={stroke} sw={sw} capacity={capacity} />;
    }

    case 'rectangular_table':
      return <RectTable w={w} h={h} fill={fill} stroke={stroke} sw={sw} />;

    case 'booth_l_shape': {
      const scaleX = w / 80;
      const scaleY = h / 80;
      return (
        <g transform={`scale(${scaleX}, ${scaleY})`}>
          <path
            d="M 5,5 H 60 V 35 H 35 V 60 H 5 Z"
            fill={fill} stroke={stroke} strokeWidth={sw / scaleX}
          />
        </g>
      );
    }

    case 'sofa': {
      const scaleX = w / 80;
      const scaleY = h / 54;
      return (
        <g transform={`scale(${scaleX}, ${scaleY})`}>
          <path
            d="M4,8 h72 a4,4 0 0 1 4,4 v8 H4 V12 a4,4 0 0 1 4,-4 Z M0,22 h80 v24 a4,4 0 0 1 -4,4 H4 a4,4 0 0 1 -4,-4 Z"
            fill={fill} stroke={stroke} strokeWidth={sw / scaleX}
          />
        </g>
      );
    }

    case 'high_table':
      return (
        <circle
          cx={w / 2} cy={h / 2}
          r={Math.min(w, h) / 2 - sw}
          fill={fill} stroke={stroke} strokeWidth={sw * 2}
        />
      );

    default:
      return (
        <rect
          x={sw / 2} y={sw / 2}
          width={w - sw} height={h - sw}
          fill={fill} stroke={stroke} strokeWidth={sw}
        />
      );
  }
}

function RoundTable({ w, h, fill, stroke, sw, capacity }: {
  w: number; h: number; fill: string; stroke: string; sw: number; capacity: number;
}) {
  const cx = w / 2, cy = h / 2;
  const tableR = Math.min(w, h) * 0.3;
  const chairR = Math.min(w, h) * 0.08;
  const orbitR = Math.min(w, h) * 0.42;
  const chairs = [];
  for (let i = 0; i < capacity; i++) {
    const angle = (i / capacity) * Math.PI * 2 - Math.PI / 2;
    chairs.push({
      x: cx + Math.cos(angle) * orbitR,
      y: cy + Math.sin(angle) * orbitR,
    });
  }
  return (
    <g>
      {chairs.map((c, i) => (
        <circle key={i} cx={c.x} cy={c.y} r={chairR} fill={fill} stroke={stroke} strokeWidth={sw * 0.7} />
      ))}
      <circle cx={cx} cy={cy} r={tableR} fill={fill} stroke={stroke} strokeWidth={sw} />
    </g>
  );
}

function RectTable({ w, h, fill, stroke, sw }: {
  w: number; h: number; fill: string; stroke: string; sw: number;
}) {
  const chairH = h * 0.15;
  const chairW = w * 0.12;
  const tableX = sw, tableY = chairH + sw;
  const tableW = w - sw * 2, tableH = h - chairH * 2 - sw * 2;
  const numTop = Math.max(2, Math.floor(w / (chairW * 1.8)));
  const chairs = [];
  for (let i = 0; i < numTop; i++) {
    const cx = sw + (i + 0.5) * (tableW / numTop);
    chairs.push(<rect key={`t${i}`} x={cx - chairW / 2} y={0} width={chairW} height={chairH} rx={2} fill={fill} stroke={stroke} strokeWidth={sw * 0.7} />);
    chairs.push(<rect key={`b${i}`} x={cx - chairW / 2} y={h - chairH} width={chairW} height={chairH} rx={2} fill={fill} stroke={stroke} strokeWidth={sw * 0.7} />);
  }
  return (
    <g>
      {chairs}
      <rect x={tableX} y={tableY} width={tableW} height={tableH} rx={3} fill={fill} stroke={stroke} strokeWidth={sw} />
    </g>
  );
}

export const CanvasItems = React.memo(function CanvasItems({
  onItemMouseDown,
  onItemDoubleClick,
}: CanvasItemsProps) {
  const items = useBuilderStore((s) => s.items);
  const sections = useBuilderStore((s) => s.sections);
  const viewport = useBuilderStore((s) => s.viewport);
  const sw = 1.5 / viewport.zoom;
  const dashArray = `${4 / viewport.zoom} ${2 / viewport.zoom}`;

  const sorted = [...items].sort((a, b) => a.z_index - b.z_index);

  return (
    <>
      {sorted.map((item) => {
        const { fill, stroke } = getItemColor(item, sections);
        return (
          <g
            key={item.id}
            transform={`translate(${item.x}, ${item.y}) rotate(${item.rotation}, ${item.width / 2}, ${item.height / 2})`}
            style={{ cursor: 'move' }}
            onMouseDown={(e) => onItemMouseDown(e, item.id)}
            onDoubleClick={(e) => onItemDoubleClick(e, item.id)}
          >
            {renderShape(item, fill, stroke, sw)}

            {item.label_visible && (
              <text
                x={item.width / 2}
                y={
                  item.label_position === 'below'
                    ? item.height + 11 / viewport.zoom
                    : item.label_position === 'above'
                    ? -4 / viewport.zoom
                    : item.height / 2
                }
                textAnchor="middle"
                dominantBaseline={item.label_position === 'center' ? 'middle' : 'auto'}
                fontSize={9 / viewport.zoom}
                fill="#2C3840"
                style={{ pointerEvents: 'none', userSelect: 'none' }}
              >
                {item.label}
              </text>
            )}

            {item._selected && (
              <rect
                x={-3 / viewport.zoom}
                y={-3 / viewport.zoom}
                width={item.width + 6 / viewport.zoom}
                height={item.height + 6 / viewport.zoom}
                fill="none"
                stroke="#7DB5C8"
                strokeWidth={2 / viewport.zoom}
                strokeDasharray={dashArray}
                rx={3 / viewport.zoom}
                style={{ pointerEvents: 'none' }}
              />
            )}
          </g>
        );
      })}
    </>
  );
});
