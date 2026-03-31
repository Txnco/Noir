'use client';

import React, { useState, useMemo } from 'react';
import { useBuilderStore } from '../../store/venueBuilderStore';
import { SHAPE_PRESETS, SEAT_PRESETS } from '../../lib/venue-builder/shapePresets';
import { generateSimpleSeatLabel } from '../../lib/venue-builder/labelGenerator';
import type { CanvasItem, ShapePreset } from '../../types/venueBuilder';
import { X } from 'lucide-react';
import { v4 as uuidv4 } from 'uuid';

interface BatchItemModalProps {
  sectionId: string;
  onClose: () => void;
}

export function BatchItemModal({ sectionId, onClose }: BatchItemModalProps) {
  const store = useBuilderStore();
  const section = store.sections.find((s) => s.id === sectionId);

  const [rows, setRows] = useState(4);
  const [seatsPerRow, setSeatsPerRow] = useState(6);
  const [seatSpacing, setSeatSpacing] = useState(40);
  const [rowSpacing, setRowSpacing] = useState(50);
  const [labelPrefix, setLabelPrefix] = useState(section?.label.charAt(0).toUpperCase() ?? 'A');
  const [shapePreset, setShapePreset] = useState<ShapePreset>('circle');

  if (!section || section.x === undefined || section.y === undefined) return null;

  const preview = useMemo(() => {
    const preset = SHAPE_PRESETS[shapePreset];
    const sw = preset.defaultWidth;
    const sh = preset.defaultHeight;
    const positions: { x: number; y: number; label: string }[] = [];

    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < seatsPerRow; c++) {
        const idx = r * seatsPerRow + c;
        const x = (section.x ?? 0) + seatSpacing / 2 + c * (sw + seatSpacing);
        const y = (section.y ?? 0) + rowSpacing / 2 + r * (sh + rowSpacing);
        positions.push({ x, y, label: `${labelPrefix}${generateSimpleSeatLabel(idx, seatsPerRow)}` });
      }
    }
    return { positions, sw, sh };
  }, [rows, seatsPerRow, seatSpacing, rowSpacing, shapePreset, section, labelPrefix]);

  function handleConfirm() {
    const preset = SHAPE_PRESETS[shapePreset];
    const existingCount = store.items.filter((i) => i.section_id === sectionId).length;
    const newItems: CanvasItem[] = preview.positions.map((pos, i) => ({
      id: `item-${uuidv4()}`,
      db_id: null,
      section_id: sectionId,
      item_type: 'seat',
      shape_preset: shapePreset,
      x: pos.x,
      y: pos.y,
      width: preset.defaultWidth,
      height: preset.defaultHeight,
      rotation: 0,
      label: pos.label,
      label_visible: true,
      label_position: 'below',
      z_index: existingCount + i,
      capacity: 1,
      _selected: false,
    }));
    store.addItemsBatch(newItems);
    onClose();
  }

  return (
    <div className="fixed inset-0 z-[200] bg-black/40 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white rounded-xl shadow-2xl max-w-lg w-full">
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
          <h2 className="text-base font-semibold text-[#2C3840]">Batch add seats</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600">
            <X size={18} />
          </button>
        </div>

        <div className="p-5 space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-xs text-slate-500 block mb-1">Rows</label>
              <input type="number" min={1} max={50} value={rows}
                onChange={(e) => setRows(Math.max(1, parseInt(e.target.value) || 1))}
                className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 focus:outline-none focus:border-[#456981]" />
            </div>
            <div>
              <label className="text-xs text-slate-500 block mb-1">Seats per row</label>
              <input type="number" min={1} max={50} value={seatsPerRow}
                onChange={(e) => setSeatsPerRow(Math.max(1, parseInt(e.target.value) || 1))}
                className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 focus:outline-none focus:border-[#456981]" />
            </div>
            <div>
              <label className="text-xs text-slate-500 block mb-1">Seat spacing (px)</label>
              <input type="number" min={4} max={200} value={seatSpacing}
                onChange={(e) => setSeatSpacing(Math.max(4, parseInt(e.target.value) || 4))}
                className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 focus:outline-none focus:border-[#456981]" />
            </div>
            <div>
              <label className="text-xs text-slate-500 block mb-1">Row spacing (px)</label>
              <input type="number" min={4} max={200} value={rowSpacing}
                onChange={(e) => setRowSpacing(Math.max(4, parseInt(e.target.value) || 4))}
                className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 focus:outline-none focus:border-[#456981]" />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-xs text-slate-500 block mb-1">Label prefix</label>
              <input type="text" value={labelPrefix} maxLength={4}
                onChange={(e) => setLabelPrefix(e.target.value)}
                className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 focus:outline-none focus:border-[#456981]" />
            </div>
            <div>
              <label className="text-xs text-slate-500 block mb-1">Seat shape</label>
              <select value={shapePreset}
                onChange={(e) => setShapePreset(e.target.value as ShapePreset)}
                className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 focus:outline-none focus:border-[#456981]">
                {SEAT_PRESETS.map((p) => (
                  <option key={p} value={p}>{SHAPE_PRESETS[p].label}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="bg-[#F5F4F0] rounded-lg p-3 text-sm text-[#6B8FA3]">
            Will place <span className="font-semibold text-[#2C3840]">{rows * seatsPerRow}</span> seats
            in <span className="font-semibold text-[#2C3840]">{rows}</span> rows
            × <span className="font-semibold text-[#2C3840]">{seatsPerRow}</span> per row
          </div>
        </div>

        <div className="flex gap-3 px-5 pb-5">
          <button
            onClick={handleConfirm}
            className="flex-1 py-2.5 text-sm font-medium bg-[#456981] text-white rounded-xl hover:bg-[#3D4F59] transition-colors"
          >
            Place in section
          </button>
          <button
            onClick={onClose}
            className="flex-1 py-2.5 text-sm border border-slate-200 rounded-xl hover:bg-slate-50 text-[#2C3840]"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}
