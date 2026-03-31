'use client';

import React, { useState } from 'react';
import { useBuilderStore } from '../../../store/venueBuilderStore';
import { SECTION_TYPE_DEFAULTS, SECTION_TYPE_LABELS } from '../../../lib/venue-builder/sectionDefaults';
import { BatchItemModal } from '../BatchItemModal';
import type { SectionType } from '../../../types/venueBuilder';

export function SectionPanel() {
  const store = useBuilderStore();
  const selectedId = store.selection.ids[0];
  const section = store.sections.find((s) => s.id === selectedId);
  const [showBatch, setShowBatch] = useState(false);

  if (!section) return null;

  const itemsInSection = store.items.filter((i) => i.section_id === section.id);
  const computedCapacity = section.is_numbered
    ? itemsInSection.reduce((acc, i) => acc + i.capacity, 0)
    : section.capacity;

  function update(updates: Parameters<typeof store.updateSection>[1]) {
    store.updateSection(section!.id, updates);
  }

  return (
    <div className="flex flex-col h-full overflow-y-auto">
      <div className="p-4 space-y-4 flex-1">

        {/* Name */}
        <div>
          <label className="text-xs text-slate-500 block mb-1">Section name</label>
          <input
            type="text"
            value={section.label}
            onChange={(e) => update({ label: e.target.value })}
            className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 focus:outline-none focus:border-[#456981]"
            placeholder="Section name..."
          />
        </div>

        {/* Type */}
        <div>
          <label className="text-xs text-slate-500 block mb-1">Section type</label>
          <select
            value={section.section_type}
            onChange={(e) => {
              const t = e.target.value as SectionType;
              const defaults = SECTION_TYPE_DEFAULTS[t];
              update({
                section_type: t,
                fill_color: defaults.fill_color,
                border_color: defaults.border_color,
                opacity: defaults.opacity,
              });
            }}
            className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 focus:outline-none focus:border-[#456981]"
          >
            {(Object.keys(SECTION_TYPE_LABELS) as SectionType[]).map((t) => (
              <option key={t} value={t}>{SECTION_TYPE_LABELS[t]}</option>
            ))}
          </select>
        </div>

        {/* Numbered + Capacity */}
        <div>
          <div className="flex items-center justify-between mb-1">
            <label className="text-xs text-slate-500">Numbered (auto capacity)</label>
            <button
              onClick={() => update({ is_numbered: !section.is_numbered })}
              className={`relative w-9 h-5 rounded-full transition-colors ${section.is_numbered ? 'bg-[#456981]' : 'bg-slate-200'}`}
            >
              <span className={`absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${section.is_numbered ? 'translate-x-4' : ''}`} />
            </button>
          </div>
          <div>
            <label className="text-xs text-slate-500 block mb-1">Capacity</label>
            <input
              type="number"
              value={computedCapacity}
              disabled={section.is_numbered}
              min={0}
              onChange={(e) => update({ capacity: parseInt(e.target.value) || 0 })}
              className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 focus:outline-none focus:border-[#456981] disabled:opacity-50 disabled:bg-slate-50"
            />
            {section.is_numbered && (
              <p className="text-xs text-[#6B8FA3] mt-1">
                {itemsInSection.length} item(s) → {computedCapacity} seats
              </p>
            )}
          </div>
        </div>

        {/* Colors */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-xs text-slate-500 block mb-1">Fill color</label>
            <div className="flex items-center gap-2">
              <input
                type="color"
                value={section.fill_color}
                onChange={(e) => update({ fill_color: e.target.value })}
                className="w-8 h-8 rounded border border-slate-200 cursor-pointer"
              />
              <span className="text-xs text-slate-400">{section.fill_color}</span>
            </div>
          </div>
          <div>
            <label className="text-xs text-slate-500 block mb-1">Border color</label>
            <div className="flex items-center gap-2">
              <input
                type="color"
                value={section.border_color}
                onChange={(e) => update({ border_color: e.target.value })}
                className="w-8 h-8 rounded border border-slate-200 cursor-pointer"
              />
              <span className="text-xs text-slate-400">{section.border_color}</span>
            </div>
          </div>
        </div>

        {/* Opacity */}
        <div>
          <label className="text-xs text-slate-500 block mb-1">
            Opacity: {Math.round(section.opacity * 100)}%
          </label>
          <input
            type="range"
            min={0} max={100}
            value={Math.round(section.opacity * 100)}
            onChange={(e) => update({ opacity: parseInt(e.target.value) / 100 })}
            className="w-full accent-[#456981]"
          />
        </div>

        {/* Lock */}
        <div className="flex items-center justify-between">
          <label className="text-xs text-slate-500">Locked (prevent move)</label>
          <button
            onClick={() => update({ is_locked: !section.is_locked })}
            className={`relative w-9 h-5 rounded-full transition-colors ${section.is_locked ? 'bg-[#456981]' : 'bg-slate-200'}`}
          >
            <span className={`absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${section.is_locked ? 'translate-x-4' : ''}`} />
          </button>
        </div>

        {/* Z-index */}
        <div>
          <label className="text-xs text-slate-500 block mb-1">Z-index</label>
          <input
            type="number"
            value={section.z_index}
            onChange={(e) => update({ z_index: parseInt(e.target.value) || 0 })}
            className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 focus:outline-none focus:border-[#456981]"
          />
        </div>

        {/* Items in section */}
        <div className="bg-[#F5F4F0] rounded-lg p-3">
          <p className="text-xs text-[#6B8FA3]">
            <span className="font-medium text-[#2C3840]">{itemsInSection.length}</span> item(s) in section
          </p>
        </div>

        {/* Batch add seats */}
        {section.shape === 'rect' && (
          <button
            onClick={() => setShowBatch(true)}
            className="w-full text-xs border border-[#456981] text-[#456981] rounded-lg py-2 hover:bg-[#E8EEF2] transition-colors"
          >
            + Batch add seats
          </button>
        )}
      </div>

      {showBatch && (
        <BatchItemModal sectionId={section.id} onClose={() => setShowBatch(false)} />
      )}

      {/* Actions */}
      <div className="border-t border-slate-100 p-3 flex gap-2">
        <button
          onClick={() => store.duplicateSection(section.id)}
          className="flex-1 text-xs border border-slate-200 rounded-lg py-2 hover:bg-slate-50 text-[#2C3840]"
        >
          ⊕ Duplicate
        </button>
        <button
          onClick={() => store.deleteSection(section.id)}
          className="flex-1 text-xs border border-red-200 rounded-lg py-2 hover:bg-red-50 text-red-600"
        >
          🗑 Delete
        </button>
      </div>
    </div>
  );
}
