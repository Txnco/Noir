'use client';

import React, { useEffect, useRef, useState } from 'react';
import { useBuilderStore } from '../../store/venueBuilderStore';
import { BatchItemModal } from './BatchItemModal';

export function ContextMenu() {
  const store = useBuilderStore();
  const { contextMenu, sections } = store;
  const ref = useRef<HTMLDivElement>(null);
  const [batchSectionId, setBatchSectionId] = useState<string | null>(null);

  useEffect(() => {
    function close(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        store.setContextMenu(null);
      }
    }
    function closeKey(e: KeyboardEvent) {
      if (e.key === 'Escape') store.setContextMenu(null);
    }
    document.addEventListener('mousedown', close);
    document.addEventListener('keydown', closeKey);
    return () => {
      document.removeEventListener('mousedown', close);
      document.removeEventListener('keydown', closeKey);
    };
  }, [store]);

  if (!contextMenu) return null;

  const { x, y, targetId, targetType } = contextMenu;

  function close() {
    store.setContextMenu(null);
  }

  const menuItem = (
    label: string,
    onClick: () => void,
    icon?: string,
    danger = false
  ) => (
    <button
      key={label}
      onClick={() => { onClick(); close(); }}
      className={`w-full text-left px-3 py-2 text-sm flex items-center gap-2 hover:bg-[#F5F4F0] cursor-pointer ${danger ? 'text-red-600 hover:bg-red-50' : 'text-[#2C3840]'}`}
    >
      {icon && <span className="text-xs w-4 text-center opacity-60">{icon}</span>}
      {label}
    </button>
  );

  const separator = <div key="sep" className="border-t border-slate-100 my-1" />;

  let items: React.ReactNode[] = [];

  if (targetType === 'section' && targetId) {
    const sec = sections.find((s) => s.id === targetId);
    items = [
      menuItem('Edit section', () => store.selectElement(targetId, 'section'), '✏'),
      menuItem(sec?.is_locked ? 'Unlock' : 'Lock', () =>
        store.updateSection(targetId, { is_locked: !sec?.is_locked }), '🔒'),
      menuItem('Duplicate section', () => store.duplicateSection(targetId), '⊕'),
      ...(sec?.shape === 'rect' ? [menuItem('Batch add seats', () => setBatchSectionId(targetId), '⊞')] : []),
      separator,
      menuItem('Delete section', () => store.deleteSection(targetId), '🗑', true),
    ];
  } else if (targetType === 'item' && targetId) {
    items = [
      menuItem('Quick edit', () => store.setFloatingEditorItemId(targetId), '✏'),
      menuItem('Delete', () => store.deleteItem(targetId), '🗑', true),
    ];
  } else if (targetType === 'static' && targetId) {
    items = [
      menuItem('Edit', () => store.selectElement(targetId, 'static'), '✏'),
      menuItem('Delete', () => store.deleteStaticObject(targetId), '🗑', true),
    ];
  } else {
    // Empty canvas
    items = [
      menuItem('Fit to content', () => store.fitToContent(), '🔍'),
    ];
  }

  return (
    <>
      <div
        ref={ref}
        className="fixed z-[100] bg-white border border-slate-200 rounded-lg shadow-xl min-w-[200px] py-1"
        style={{ left: x, top: y }}
      >
        {items}
      </div>
      {batchSectionId && (
        <BatchItemModal sectionId={batchSectionId} onClose={() => setBatchSectionId(null)} />
      )}
    </>
  );
}
