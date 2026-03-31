'use client';

import { useEffect } from 'react';
import { useBuilderStore } from '../../store/venueBuilderStore';

function isInputFocused(): boolean {
  const el = document.activeElement;
  if (!el) return false;
  const tag = el.tagName.toLowerCase();
  return (
    tag === 'input' ||
    tag === 'textarea' ||
    (el as HTMLElement).isContentEditable
  );
}

export function useBuilderKeyboard(onSave: () => void) {
  const store = useBuilderStore();

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (isInputFocused()) return;

      const ctrl = e.ctrlKey || e.metaKey;

      // ESC — deselect / cancel tool / close modals
      if (e.key === 'Escape') {
        store.clearSelection();
        store.setTool('select');
        store.setContextMenu(null);
        store.setFloatingEditorItemId(null);
        return;
      }

      // Ctrl+Z — Undo
      if (ctrl && !e.shiftKey && e.key === 'z') {
        e.preventDefault();
        store.undo();
        return;
      }

      // Ctrl+Shift+Z / Ctrl+Y — Redo
      if ((ctrl && e.shiftKey && e.key === 'z') || (ctrl && e.key === 'y')) {
        e.preventDefault();
        store.redo();
        return;
      }

      // Ctrl+S — Save
      if (ctrl && e.key === 's') {
        e.preventDefault();
        onSave();
        return;
      }

      // Ctrl+A — Select all
      if (ctrl && e.key === 'a') {
        e.preventDefault();
        store.selectAll();
        return;
      }

      // Ctrl+0 — Fit to content
      if (ctrl && e.key === '0') {
        e.preventDefault();
        store.fitToContent();
        return;
      }

      // Ctrl++ / Ctrl+= — Zoom in
      if (ctrl && (e.key === '+' || e.key === '=')) {
        e.preventDefault();
        store.zoomIn();
        return;
      }

      // Ctrl+- — Zoom out
      if (ctrl && e.key === '-') {
        e.preventDefault();
        store.zoomOut();
        return;
      }

      // Delete / Backspace — delete selected
      if (e.key === 'Delete' || e.key === 'Backspace') {
        store.deleteSelectedItems();
        return;
      }

      // V — Select tool
      if (e.key === 'v' || e.key === 'V') {
        store.setTool('select');
        return;
      }

      // H — Pan tool
      if (e.key === 'h' || e.key === 'H') {
        store.setTool('pan');
        return;
      }

      // S — Draw section tool
      if (e.key === 's' || e.key === 'S') {
        const prev = store.drawSectionContext;
        store.setTool('draw_section', {
          section_type: prev?.section_type ?? 'seated',
          shape: prev?.shape ?? 'rect',
        });
        return;
      }

      // M — Toggle minimap
      if (e.key === 'm' || e.key === 'M') {
        store.toggleMinimap();
        return;
      }

      // G — Toggle grid
      if (e.key === 'g' || e.key === 'G') {
        store.toggleGrid();
        return;
      }

      // Arrow keys — move selected elements
      if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.key)) {
        const { selection, items, sections, statics } = store;
        if (!selection.type || selection.ids.length === 0) return;
        e.preventDefault();

        const delta = e.shiftKey ? 10 : 1;
        const dx =
          e.key === 'ArrowLeft' ? -delta : e.key === 'ArrowRight' ? delta : 0;
        const dy =
          e.key === 'ArrowUp' ? -delta : e.key === 'ArrowDown' ? delta : 0;

        if (selection.type === 'item') {
          for (const id of selection.ids) {
            store.moveItem(id, dx, dy);
          }
        } else if (selection.type === 'section') {
          for (const id of selection.ids) {
            const sec = sections.find((s) => s.id === id);
            if (!sec || sec.is_locked) continue;
            store.updateSection(id, {
              x: (sec.x ?? 0) + dx,
              y: (sec.y ?? 0) + dy,
            });
          }
          // Also move items belonging to these sections
          for (const item of items) {
            if (selection.ids.includes(item.section_id ?? '')) {
              store.moveItem(item.id, dx, dy);
            }
          }
        } else if (selection.type === 'static') {
          for (const id of selection.ids) {
            const obj = statics.find((s) => s.id === id);
            if (!obj) continue;
            store.updateStaticObject(id, {
              x: (obj.x ?? 0) + dx,
              y: (obj.y ?? 0) + dy,
            });
          }
        }
        return;
      }
    }

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [store, onSave]);
}
