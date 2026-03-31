'use client';

import React, { useMemo } from 'react';
import { useBuilderStore } from '../../store/venueBuilderStore';

const MINIMAP_W = 160;
const MINIMAP_H = 110;

interface MinimapProps {
  svgRef: React.RefObject<SVGSVGElement | null>;
}

export function Minimap({ svgRef }: MinimapProps) {
  const sections = useBuilderStore((s) => s.sections);
  const viewport = useBuilderStore((s) => s.viewport);
  const store = useBuilderStore();

  const { scale, offsetX, offsetY, contentW, contentH } = useMemo(() => {
    const allX: number[] = [];
    const allY: number[] = [];
    const allX2: number[] = [];
    const allY2: number[] = [];

    for (const s of sections) {
      if (s.x !== undefined) {
        allX.push(s.x); allX2.push(s.x + (s.width ?? 0));
        allY.push(s.y ?? 0); allY2.push((s.y ?? 0) + (s.height ?? 0));
      } else if (s.points) {
        for (const [px, py] of s.points) { allX.push(px); allY.push(py); }
        allX2.push(...allX); allY2.push(...allY);
      }
    }

    if (allX.length === 0) {
      return { scale: 1, offsetX: 0, offsetY: 0, contentW: 800, contentH: 600 };
    }

    const minX = Math.min(...allX);
    const minY = Math.min(...allY);
    const maxX = Math.max(...allX2);
    const maxY = Math.max(...allY2);
    const cw = Math.max(maxX - minX, 100);
    const ch = Math.max(maxY - minY, 100);
    const s = Math.min(MINIMAP_W / cw, MINIMAP_H / ch) * 0.85;

    return {
      scale: s,
      offsetX: -minX * s + (MINIMAP_W - cw * s) / 2,
      offsetY: -minY * s + (MINIMAP_H - ch * s) / 2,
      contentW: cw,
      contentH: ch,
    };
  }, [sections]);

  function handleMinimapClick(e: React.MouseEvent) {
    const rect = (e.currentTarget as SVGElement).getBoundingClientRect();
    const mmX = e.clientX - rect.left;
    const mmY = e.clientY - rect.top;
    const worldX = (mmX - offsetX) / scale;
    const worldY = (mmY - offsetY) / scale;

    const svgRect = svgRef.current?.getBoundingClientRect();
    if (!svgRect) return;
    store.setViewport({
      x: svgRect.width / 2 - worldX * viewport.zoom,
      y: svgRect.height / 2 - worldY * viewport.zoom,
    });
  }

  // Viewport rect in minimap coords
  const svgW = svgRef.current?.clientWidth ?? 800;
  const svgH = svgRef.current?.clientHeight ?? 600;
  const vpLeft = -viewport.x / viewport.zoom;
  const vpTop = -viewport.y / viewport.zoom;
  const vpW = svgW / viewport.zoom;
  const vpH = svgH / viewport.zoom;

  return (
    <div
      className="absolute bottom-4 right-4 bg-white/90 rounded-lg border border-slate-200 shadow-lg overflow-hidden backdrop-blur-sm"
      style={{ width: MINIMAP_W, height: MINIMAP_H, zIndex: 30 }}
    >
      <svg
        width={MINIMAP_W}
        height={MINIMAP_H}
        style={{ cursor: 'pointer', display: 'block' }}
        onClick={handleMinimapClick}
      >
        <rect width={MINIMAP_W} height={MINIMAP_H} fill="#F5F4F0" />

        {sections.map((s) => {
          if (s.shape === 'rect' && s.x !== undefined) {
            return (
              <rect
                key={s.id}
                x={s.x * scale + offsetX}
                y={(s.y ?? 0) * scale + offsetY}
                width={(s.width ?? 0) * scale}
                height={(s.height ?? 0) * scale}
                fill={s.fill_color}
                fillOpacity={0.8}
                stroke={s.border_color}
                strokeWidth={0.5}
              />
            );
          }
          if (s.shape === 'polygon' && s.points) {
            return (
              <polygon
                key={s.id}
                points={s.points.map(([x, y]) => `${x * scale + offsetX},${y * scale + offsetY}`).join(' ')}
                fill={s.fill_color}
                fillOpacity={0.8}
                stroke={s.border_color}
                strokeWidth={0.5}
              />
            );
          }
          return null;
        })}

        {/* Viewport indicator */}
        <rect
          x={vpLeft * scale + offsetX}
          y={vpTop * scale + offsetY}
          width={vpW * scale}
          height={vpH * scale}
          fill="none"
          stroke="#456981"
          strokeWidth={1}
          strokeDasharray="3 2"
          fillOpacity={0.05}
        />
      </svg>
    </div>
  );
}
