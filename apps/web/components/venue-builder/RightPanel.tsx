'use client';

import React from 'react';
import { useBuilderStore } from '../../store/venueBuilderStore';
import { SectionPanel } from './panels/SectionPanel';
import { ItemPanel } from './panels/ItemPanel';
import { StaticObjectPanel } from './panels/StaticObjectPanel';
import { EmptyPanel } from './panels/EmptyPanel';
import { ChevronRight, LayoutDashboard, Armchair, Box } from 'lucide-react';

const TYPE_ICONS = {
  section: <LayoutDashboard size={14} />,
  item: <Armchair size={14} />,
  static: <Box size={14} />,
};

const TYPE_LABELS = {
  section: 'Section',
  item: 'Item',
  static: 'Static Object',
};

export function RightPanel() {
  const store = useBuilderStore();
  const { selection, rightPanelOpen } = store;
  const hasSelection = selection.type !== null && selection.ids.length > 0;

  return (
    <div
      className="fixed top-14 right-0 bottom-0 bg-white border-l border-slate-200 shadow-lg flex flex-col"
      style={{
        width: 300,
        transform: rightPanelOpen || true ? 'translateX(0)' : 'translateX(100%)',
        transition: 'transform 200ms ease-out',
        zIndex: 40,
      }}
    >
      {/* Panel header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100">
        <div className="flex items-center gap-2 text-[#2C3840]">
          {selection.type && TYPE_ICONS[selection.type]}
          <span className="text-sm font-medium">
            {selection.type ? TYPE_LABELS[selection.type] : 'Properties'}
          </span>
          {selection.ids.length > 1 && (
            <span className="text-xs text-slate-400">({selection.ids.length})</span>
          )}
        </div>
        <button
          onClick={() => store.setRightPanelOpen(false)}
          className="text-slate-400 hover:text-slate-600 p-1 rounded"
        >
          <ChevronRight size={16} />
        </button>
      </div>

      {/* Panel content */}
      <div className="flex-1 overflow-hidden">
        {selection.type === 'section' && <SectionPanel />}
        {selection.type === 'item' && <ItemPanel />}
        {selection.type === 'static' && <StaticObjectPanel />}
        {!selection.type && <EmptyPanel />}
      </div>
    </div>
  );
}
