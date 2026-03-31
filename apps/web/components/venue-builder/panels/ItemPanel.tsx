'use client';

import React from 'react';
import { useBuilderStore } from '../../../store/venueBuilderStore';
import { SHAPE_PRESETS, SEAT_PRESETS, TABLE_PRESETS } from '../../../lib/venue-builder/shapePresets';
import type { ShapePreset } from '../../../types/venueBuilder';

export function ItemPanel() {
  const store = useBuilderStore();
  const selectedId = store.selection.ids[0];
  const item = store.items.find((i) => i.id === selectedId);

  if (!item) return null;

  function update(updates: Parameters<typeof store.updateItem>[1]) {
    store.updateItem(item!.id, updates);
  }

  const presets: ShapePreset[] = item.item_type === 'seat' ? SEAT_PRESETS : TABLE_PRESETS;

  return (
    <div className="flex flex-col h-full overflow-y-auto">
      <div className="p-4 space-y-4 flex-1">

        {/* Label */}
        <div>
          <label className="text-xs text-slate-500 block mb-1">Label</label>
          <input
            type="text"
            value={item.label}
            onChange={(e) => update({ label: e.target.value })}
            className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 focus:outline-none focus:border-[#456981]"
          />
        </div>

        {/* Show label + position */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <label className="text-xs text-slate-500">Show label</label>
            <button
              onClick={() => update({ label_visible: !item.label_visible })}
              className={`relative w-9 h-5 rounded-full transition-colors ${item.label_visible ? 'bg-[#456981]' : 'bg-slate-200'}`}
            >
              <span className={`absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${item.label_visible ? 'translate-x-4' : ''}`} />
            </button>
          </div>
          {item.label_visible && (
            <div className="flex gap-1">
              {(['above', 'center', 'below'] as const).map((pos) => (
                <button
                  key={pos}
                  onClick={() => update({ label_position: pos })}
                  className={`flex-1 text-xs py-1 rounded border capitalize transition-colors ${item.label_position === pos ? 'bg-[#456981] text-white border-[#456981]' : 'border-slate-200 text-slate-500 hover:border-[#456981]'}`}
                >
                  {pos}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Shape */}
        <div>
          <label className="text-xs text-slate-500 block mb-1">Shape</label>
          <select
            value={item.shape_preset}
            onChange={(e) => update({ shape_preset: e.target.value as ShapePreset })}
            className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 focus:outline-none focus:border-[#456981]"
          >
            {presets.map((p) => (
              <option key={p} value={p}>{SHAPE_PRESETS[p].label}</option>
            ))}
          </select>
        </div>

        {/* Capacity */}
        <div>
          <label className="text-xs text-slate-500 block mb-1">Capacity</label>
          <input
            type="number"
            value={item.capacity}
            min={1}
            disabled={item.item_type === 'seat'}
            onChange={(e) => update({ capacity: parseInt(e.target.value) || 1 })}
            className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 focus:outline-none focus:border-[#456981] disabled:opacity-50"
          />
        </div>

        {/* Rotation */}
        <div>
          <label className="text-xs text-slate-500 block mb-1">Rotation: {item.rotation}°</label>
          <div className="flex gap-2 items-center">
            <input
              type="range"
              min={0} max={360}
              value={item.rotation}
              onChange={(e) => update({ rotation: parseInt(e.target.value) })}
              className="flex-1 accent-[#456981]"
            />
            <input
              type="number"
              value={item.rotation}
              min={0} max={360}
              onChange={(e) => update({ rotation: parseInt(e.target.value) || 0 })}
              className="w-16 text-sm border border-slate-200 rounded px-2 py-1 focus:outline-none focus:border-[#456981]"
            />
          </div>
        </div>

        {/* Size */}
        <div>
          <label className="text-xs text-slate-500 block mb-1">Size (px)</label>
          <div className="flex gap-2">
            <div className="flex-1">
              <span className="text-xs text-slate-400 block mb-0.5">W</span>
              <input
                type="number"
                value={Math.round(item.width)}
                min={8}
                onChange={(e) => update({ width: parseInt(e.target.value) || 8 })}
                className="w-full text-sm border border-slate-200 rounded px-2 py-1 focus:outline-none focus:border-[#456981]"
              />
            </div>
            <div className="flex-1">
              <span className="text-xs text-slate-400 block mb-0.5">H</span>
              <input
                type="number"
                value={Math.round(item.height)}
                min={8}
                onChange={(e) => update({ height: parseInt(e.target.value) || 8 })}
                className="w-full text-sm border border-slate-200 rounded px-2 py-1 focus:outline-none focus:border-[#456981]"
              />
            </div>
          </div>
        </div>

        {/* Position */}
        <div>
          <label className="text-xs text-slate-500 block mb-1">Position (px)</label>
          <div className="flex gap-2">
            <div className="flex-1">
              <span className="text-xs text-slate-400 block mb-0.5">X</span>
              <input
                type="number"
                value={Math.round(item.x)}
                onChange={(e) => update({ x: parseInt(e.target.value) || 0 })}
                className="w-full text-sm border border-slate-200 rounded px-2 py-1 focus:outline-none focus:border-[#456981]"
              />
            </div>
            <div className="flex-1">
              <span className="text-xs text-slate-400 block mb-0.5">Y</span>
              <input
                type="number"
                value={Math.round(item.y)}
                onChange={(e) => update({ y: parseInt(e.target.value) || 0 })}
                className="w-full text-sm border border-slate-200 rounded px-2 py-1 focus:outline-none focus:border-[#456981]"
              />
            </div>
          </div>
        </div>

        {/* Section */}
        <div>
          <label className="text-xs text-slate-500 block mb-1">Section</label>
          <select
            value={item.section_id ?? ''}
            onChange={(e) => update({ section_id: e.target.value || null })}
            className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 focus:outline-none focus:border-[#456981]"
          >
            <option value="">(no section)</option>
            {store.sections.map((s) => (
              <option key={s.id} value={s.id}>{s.label}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Actions */}
      <div className="border-t border-slate-100 p-3 flex gap-2">
        <button
          onClick={() => store.deleteItem(item.id)}
          className="flex-1 text-xs border border-red-200 rounded-lg py-2 hover:bg-red-50 text-red-600"
        >
          🗑 Delete
        </button>
      </div>
    </div>
  );
}
