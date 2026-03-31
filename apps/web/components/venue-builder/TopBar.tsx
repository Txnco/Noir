'use client';

import React, { useState, useCallback } from 'react';
import {
  Undo2, Redo2, Minus, Plus, Maximize2,
  Grid3X3, Magnet, Map, Save, ChevronDown,
} from 'lucide-react';
import { useBuilderStore } from '../../store/venueBuilderStore';
import type { SaveStatus } from './SaveNotification';

interface TopBarProps {
  onSave: () => void;
  saveStatus: SaveStatus;
  savedVenues: string[];
  onLoadVenue: (venueId: string) => void;
}

export function TopBar({ onSave, saveStatus, savedVenues, onLoadVenue }: TopBarProps) {
  const store = useBuilderStore();
  const {
    venue_name, is_dirty, viewport, showGrid, snapEnabled, showMinimap,
  } = store;

  const [zoomInput, setZoomInput] = useState('');
  const [editingZoom, setEditingZoom] = useState(false);
  const [venueDropdown, setVenueDropdown] = useState(false);

  const zoomPercent = Math.round(viewport.zoom * 100);

  function handleZoomCommit() {
    const val = parseInt(zoomInput);
    if (!isNaN(val) && val > 0) {
      store.zoomTo(val / 100);
    }
    setEditingZoom(false);
  }

  const canUndo = store.canUndo();
  const canRedo = store.canRedo();

  const saveLabel = (() => {
    if (saveStatus === 'saving') return 'Saving...';
    if (saveStatus === 'autosaving') return 'Autosaving...';
    if (saveStatus === 'saved') return '✓ Saved';
    if (saveStatus === 'autosaved') return '✓ Autosaved';
    if (saveStatus === 'error') return '⚠ Save failed';
    if (store.last_saved) {
      return `Last saved ${store.last_saved.toLocaleTimeString('en', { hour: '2-digit', minute: '2-digit' })}`;
    }
    return 'Autosaves every 30s';
  })();

  return (
    <div
      className="fixed top-0 left-0 right-0 bg-white border-b border-slate-200 shadow-sm flex items-center px-3 gap-2"
      style={{ height: 56, zIndex: 50 }}
    >
      {/* Logo + Venue name */}
      <div className="flex items-center gap-2 mr-2">
        <div className="w-7 h-7 bg-[#456981] rounded-lg flex items-center justify-center">
          <span className="text-white text-xs font-bold">N</span>
        </div>
        <input
          type="text"
          value={venue_name}
          onChange={(e) => store.setVenueName(e.target.value)}
          placeholder="Venue name..."
          className="text-sm font-medium text-[#2C3840] bg-transparent border-b border-transparent hover:border-slate-200 focus:border-[#456981] focus:outline-none min-w-[140px] max-w-[240px] py-0.5 px-0"
        />
      </div>

      <div className="w-px h-5 bg-slate-200" />

      {/* Load saved venues */}
      <div className="relative">
        <button
          onClick={() => setVenueDropdown((v) => !v)}
          className="flex items-center gap-1 text-xs text-[#6B8FA3] hover:text-[#2C3840] px-2 py-1 rounded hover:bg-slate-50"
        >
          Open <ChevronDown size={12} />
        </button>
        {venueDropdown && (
          <div className="absolute top-full left-0 mt-1 bg-white rounded-lg border border-slate-200 shadow-xl min-w-[160px] py-1 z-50">
            {savedVenues.length === 0 ? (
              <div className="px-3 py-2 text-xs text-slate-400">No saved venues</div>
            ) : (
              savedVenues.map((v) => (
                <button
                  key={v}
                  onClick={() => { onLoadVenue(v); setVenueDropdown(false); }}
                  className="w-full text-left px-3 py-2 text-sm text-[#2C3840] hover:bg-[#F5F4F0]"
                >
                  {v}
                </button>
              ))
            )}
          </div>
        )}
      </div>

      <div className="flex-1" />

      {/* Undo / Redo */}
      <div className="flex items-center gap-0.5">
        <button
          onClick={() => store.undo()}
          disabled={!canUndo}
          title="Undo (Ctrl+Z)"
          className="w-8 h-8 flex items-center justify-center rounded hover:bg-slate-50 text-[#6B8FA3] disabled:opacity-30"
        >
          <Undo2 size={15} />
        </button>
        <button
          onClick={() => store.redo()}
          disabled={!canRedo}
          title="Redo (Ctrl+Shift+Z)"
          className="w-8 h-8 flex items-center justify-center rounded hover:bg-slate-50 text-[#6B8FA3] disabled:opacity-30"
        >
          <Redo2 size={15} />
        </button>
      </div>

      <div className="w-px h-5 bg-slate-200" />

      {/* Zoom controls */}
      <div className="flex items-center gap-0.5">
        <button
          onClick={() => store.zoomOut()}
          title="Zoom out (Ctrl+-)"
          className="w-7 h-7 flex items-center justify-center rounded hover:bg-slate-50 text-[#6B8FA3]"
        >
          <Minus size={13} />
        </button>
        {editingZoom ? (
          <input
            type="text"
            defaultValue={`${zoomPercent}`}
            autoFocus
            onChange={(e) => setZoomInput(e.target.value)}
            onBlur={handleZoomCommit}
            onKeyDown={(e) => e.key === 'Enter' && handleZoomCommit()}
            className="w-12 text-center text-xs border border-[#456981] rounded px-1 py-0.5 focus:outline-none"
          />
        ) : (
          <button
            onClick={() => { setZoomInput(`${zoomPercent}`); setEditingZoom(true); }}
            className="w-12 text-center text-xs text-[#2C3840] hover:bg-slate-50 rounded py-0.5"
          >
            {zoomPercent}%
          </button>
        )}
        <button
          onClick={() => store.zoomIn()}
          title="Zoom in (Ctrl++)"
          className="w-7 h-7 flex items-center justify-center rounded hover:bg-slate-50 text-[#6B8FA3]"
        >
          <Plus size={13} />
        </button>
        <button
          onClick={() => store.fitToContent()}
          title="Fit to content (Ctrl+0)"
          className="w-7 h-7 flex items-center justify-center rounded hover:bg-slate-50 text-[#6B8FA3]"
        >
          <Maximize2 size={13} />
        </button>
      </div>

      <div className="w-px h-5 bg-slate-200" />

      {/* Toggles */}
      <div className="flex items-center gap-0.5">
        <button
          onClick={() => store.toggleGrid()}
          title="Toggle grid (G)"
          className={`w-8 h-8 flex items-center justify-center rounded transition-colors ${showGrid ? 'bg-[#E8EEF2] text-[#456981]' : 'text-[#6B8FA3] hover:bg-slate-50'}`}
        >
          <Grid3X3 size={15} />
        </button>
        <button
          onClick={() => store.setSnapEnabled(!snapEnabled)}
          title="Toggle snap"
          className={`w-8 h-8 flex items-center justify-center rounded transition-colors ${snapEnabled ? 'bg-[#E8EEF2] text-[#456981]' : 'text-[#6B8FA3] hover:bg-slate-50'}`}
        >
          <Magnet size={15} />
        </button>
        <button
          onClick={() => store.toggleMinimap()}
          title="Toggle minimap (M)"
          className={`w-8 h-8 flex items-center justify-center rounded transition-colors ${showMinimap ? 'bg-[#E8EEF2] text-[#456981]' : 'text-[#6B8FA3] hover:bg-slate-50'}`}
        >
          <Map size={15} />
        </button>
      </div>

      <div className="w-px h-5 bg-slate-200" />

      {/* Autosave status */}
      <span className="text-xs text-[#9AB3C0] whitespace-nowrap hidden md:block">
        {saveLabel}
      </span>

      {/* Save button */}
      <button
        onClick={onSave}
        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${is_dirty ? 'bg-[#456981] text-white hover:bg-[#3D4F59]' : 'border border-slate-200 text-[#6B8FA3] hover:bg-slate-50'}`}
      >
        <Save size={14} />
        Save
      </button>
    </div>
  );
}
