'use client';

import React, { useEffect, useRef } from 'react';
import { useBuilderStore } from '../../store/venueBuilderStore';
import { SHAPE_PRESETS, SEAT_PRESETS, TABLE_PRESETS } from '../../lib/venue-builder/shapePresets';
import type { ShapePreset } from '../../types/venueBuilder';
import { X } from 'lucide-react';

interface FloatingItemEditorProps {
  svgRef: React.RefObject<SVGSVGElement | null>;
}

export function FloatingItemEditor({ svgRef }: FloatingItemEditorProps) {
  const store = useBuilderStore();
  const { floatingEditorItemId, items, viewport } = store;
  const ref = useRef<HTMLDivElement>(null);

  const item = items.find((i) => i.id === floatingEditorItemId);

  useEffect(() => {
    function close(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        store.setFloatingEditorItemId(null);
      }
    }
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, [store]);

  if (!item) return null;

  // Convert item world coords to screen coords
  const svgRect = svgRef.current?.getBoundingClientRect();
  const screenX = svgRect ? item.x * viewport.zoom + viewport.x + svgRect.left + 56 : item.x;
  const screenY = svgRect ? item.y * viewport.zoom + viewport.y + svgRect.top + 56 : item.y;

  // Position to the right of the item, or left if too close to edge
  const editorW = 240;
  const editorH = 220;
  const posX = Math.min(screenX + item.width * viewport.zoom + 8, window.innerWidth - editorW - 8);
  const posY = Math.max(8, Math.min(screenY, window.innerHeight - editorH - 8));

  const presets: ShapePreset[] = item.item_type === 'seat' ? SEAT_PRESETS : TABLE_PRESETS;

  return (
    <div
      ref={ref}
      className="fixed z-50 bg-white rounded-xl border border-slate-200 shadow-2xl"
      style={{ left: posX, top: posY, width: editorW }}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-slate-100">
        <span className="text-sm font-medium text-[#2C3840]">{item.label || 'Item'}</span>
        <button
          onClick={() => store.setFloatingEditorItemId(null)}
          className="text-slate-400 hover:text-slate-600 p-0.5 rounded"
        >
          <X size={14} />
        </button>
      </div>

      <div className="p-3 space-y-3">
        {/* Label */}
        <div>
          <label className="text-xs text-slate-500 block mb-1">Label</label>
          <input
            type="text"
            value={item.label}
            onChange={(e) => store.updateItem(item.id, { label: e.target.value })}
            className="w-full text-sm border border-slate-200 rounded px-2 py-1 focus:outline-none focus:border-[#456981]"
          />
        </div>

        {/* Capacity */}
        <div>
          <label className="text-xs text-slate-500 block mb-1">Capacity (seats)</label>
          <input
            type="number"
            value={item.capacity}
            min={1}
            disabled={item.item_type === 'seat'}
            onChange={(e) => store.updateItem(item.id, { capacity: parseInt(e.target.value) || 1 })}
            className="w-full text-sm border border-slate-200 rounded px-2 py-1 focus:outline-none focus:border-[#456981] disabled:opacity-50"
          />
        </div>

        {/* Shape */}
        <div>
          <label className="text-xs text-slate-500 block mb-1">Shape</label>
          <select
            value={item.shape_preset}
            onChange={(e) => store.updateItem(item.id, { shape_preset: e.target.value as ShapePreset })}
            className="w-full text-sm border border-slate-200 rounded px-2 py-1 focus:outline-none focus:border-[#456981]"
          >
            {presets.map((p) => (
              <option key={p} value={p}>{SHAPE_PRESETS[p].label}</option>
            ))}
          </select>
        </div>

        {/* Rotation */}
        <div>
          <label className="text-xs text-slate-500 block mb-1">Rotation: {item.rotation}°</label>
          <input
            type="range"
            min={0} max={360}
            value={item.rotation}
            onChange={(e) => store.updateItem(item.id, { rotation: parseInt(e.target.value) })}
            className="w-full accent-[#456981]"
          />
        </div>

        {/* Open in panel link */}
        <button
          onClick={() => {
            store.selectElement(item.id, 'item');
            store.setFloatingEditorItemId(null);
          }}
          className="text-xs text-[#456981] hover:underline"
        >
          Open in properties panel →
        </button>
      </div>
    </div>
  );
}
