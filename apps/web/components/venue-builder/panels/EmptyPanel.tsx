'use client';

import React from 'react';
import { useBuilderStore } from '../../../store/venueBuilderStore';

export function EmptyPanel() {
  const sections = useBuilderStore((s) => s.sections);
  const items = useBuilderStore((s) => s.items);
  const statics = useBuilderStore((s) => s.statics);

  const totalSeats = items.filter((i) => i.item_type === 'seat').reduce((acc, i) => acc + i.capacity, 0);
  const totalTables = items.filter((i) => i.item_type === 'table').length;

  return (
    <div className="flex flex-col h-full p-4">
      <div className="flex-1 flex flex-col items-center justify-center text-center gap-4">
        <div className="w-12 h-12 rounded-xl bg-[#EAF0F5] flex items-center justify-center">
          <span className="text-2xl">🏛</span>
        </div>
        <div>
          <p className="text-sm font-medium text-[#2C3840]">Select an element to edit</p>
          <p className="text-xs text-[#6B8FA3] mt-1">Click any section, seat, or table on the canvas</p>
        </div>

        {/* Quick stats */}
        <div className="w-full bg-[#F5F4F0] rounded-lg p-3 text-xs text-[#6B8FA3] space-y-1">
          <div className="flex justify-between">
            <span>Sections</span>
            <span className="font-medium text-[#2C3840]">{sections.length}</span>
          </div>
          <div className="flex justify-between">
            <span>Seats</span>
            <span className="font-medium text-[#2C3840]">{totalSeats}</span>
          </div>
          <div className="flex justify-between">
            <span>Tables</span>
            <span className="font-medium text-[#2C3840]">{totalTables}</span>
          </div>
          <div className="flex justify-between">
            <span>Static objects</span>
            <span className="font-medium text-[#2C3840]">{statics.length}</span>
          </div>
        </div>
      </div>

      {/* Shortcuts cheatsheet */}
      <div className="border-t border-slate-100 pt-3 mt-3">
        <p className="text-xs font-medium text-[#2C3840] mb-2">Shortcuts</p>
        <div className="grid grid-cols-2 gap-x-2 gap-y-1 text-xs text-[#6B8FA3]">
          {[
            ['V', 'Select'],
            ['H', 'Pan'],
            ['S', 'Draw section'],
            ['M', 'Minimap'],
            ['G', 'Grid'],
            ['Ctrl+Z', 'Undo'],
            ['Ctrl+S', 'Save'],
            ['Ctrl+0', 'Fit view'],
            ['Del', 'Delete'],
            ['Space+drag', 'Pan'],
          ].map(([key, label]) => (
            <React.Fragment key={key}>
              <span className="font-mono bg-slate-100 rounded px-1 text-[10px] text-center">{key}</span>
              <span className="text-[11px]">{label}</span>
            </React.Fragment>
          ))}
        </div>
      </div>
    </div>
  );
}
