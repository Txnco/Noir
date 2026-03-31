'use client';

import React from 'react';
import { useBuilderStore } from '../../../store/venueBuilderStore';
import type { StaticObjectType } from '../../../types/venueBuilder';

const STATIC_TYPE_LABELS: Record<StaticObjectType, string> = {
  stage: 'Stage', bar: 'Bar', entrance: 'Entrance',
  restroom: 'Restroom', dj_booth: 'DJ Booth',
  coat_check: 'Coat Check', custom: 'Custom',
};

export function StaticObjectPanel() {
  const store = useBuilderStore();
  const selectedId = store.selection.ids[0];
  const obj = store.statics.find((s) => s.id === selectedId);

  if (!obj) return null;

  function update(updates: Parameters<typeof store.updateStaticObject>[1]) {
    store.updateStaticObject(obj!.id, updates);
  }

  return (
    <div className="flex flex-col h-full overflow-y-auto">
      <div className="p-4 space-y-4 flex-1">

        {/* Label */}
        <div>
          <label className="text-xs text-slate-500 block mb-1">Label</label>
          <input
            type="text"
            value={obj.label}
            onChange={(e) => update({ label: e.target.value })}
            className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 focus:outline-none focus:border-[#456981]"
          />
        </div>

        {/* Show label */}
        <div className="flex items-center justify-between">
          <label className="text-xs text-slate-500">Show label</label>
          <button
            onClick={() => update({ label_visible: !obj.label_visible })}
            className={`relative w-9 h-5 rounded-full transition-colors ${obj.label_visible ? 'bg-[#456981]' : 'bg-slate-200'}`}
          >
            <span className={`absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${obj.label_visible ? 'translate-x-4' : ''}`} />
          </button>
        </div>

        {/* Type */}
        <div>
          <label className="text-xs text-slate-500 block mb-1">Type</label>
          <select
            value={obj.type}
            onChange={(e) => update({ type: e.target.value as StaticObjectType })}
            className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 focus:outline-none focus:border-[#456981]"
          >
            {(Object.keys(STATIC_TYPE_LABELS) as StaticObjectType[]).map((t) => (
              <option key={t} value={t}>{STATIC_TYPE_LABELS[t]}</option>
            ))}
          </select>
        </div>

        {/* Colors */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-xs text-slate-500 block mb-1">Fill</label>
            <input
              type="color"
              value={obj.fill_color}
              onChange={(e) => update({ fill_color: e.target.value })}
              className="w-8 h-8 rounded border border-slate-200 cursor-pointer"
            />
          </div>
          <div>
            <label className="text-xs text-slate-500 block mb-1">Border</label>
            <input
              type="color"
              value={obj.border_color}
              onChange={(e) => update({ border_color: e.target.value })}
              className="w-8 h-8 rounded border border-slate-200 cursor-pointer"
            />
          </div>
        </div>

        {/* Opacity */}
        <div>
          <label className="text-xs text-slate-500 block mb-1">
            Opacity: {Math.round(obj.opacity * 100)}%
          </label>
          <input
            type="range" min={0} max={100}
            value={Math.round(obj.opacity * 100)}
            onChange={(e) => update({ opacity: parseInt(e.target.value) / 100 })}
            className="w-full accent-[#456981]"
          />
        </div>

        {/* Z-index */}
        <div>
          <label className="text-xs text-slate-500 block mb-1">Z-index</label>
          <input
            type="number"
            value={obj.z_index}
            onChange={(e) => update({ z_index: parseInt(e.target.value) || 0 })}
            className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 focus:outline-none focus:border-[#456981]"
          />
        </div>
      </div>

      {/* Actions */}
      <div className="border-t border-slate-100 p-3">
        <button
          onClick={() => store.deleteStaticObject(obj.id)}
          className="w-full text-xs border border-red-200 rounded-lg py-2 hover:bg-red-50 text-red-600"
        >
          🗑 Delete
        </button>
      </div>
    </div>
  );
}
