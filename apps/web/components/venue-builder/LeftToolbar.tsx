'use client';

import React, { useState, useRef, useEffect } from 'react';
import {
  MousePointer2, Hand, PenTool, Square, Pentagon,
  Circle, Armchair, CircleDot, RectangleHorizontal,
  LayoutTemplate, Sofa, Music2, GlassWater, DoorOpen,
  Waves, Disc3, Shirt, Box, HelpCircle,
} from 'lucide-react';
import { useBuilderStore } from '../../store/venueBuilderStore';
import type { ToolMode, PlaceItemContext, PlaceStaticContext, DrawSectionContext, SectionType } from '../../types/venueBuilder';

interface ToolButtonProps {
  icon: React.ReactNode;
  label: string;
  shortcut?: string;
  active?: boolean;
  onClick: () => void;
}

function ToolButton({ icon, label, shortcut, active, onClick }: ToolButtonProps) {
  const [showTooltip, setShowTooltip] = useState(false);

  return (
    <div className="relative">
      <button
        onClick={onClick}
        onMouseEnter={() => setShowTooltip(true)}
        onMouseLeave={() => setShowTooltip(false)}
        className={`w-10 h-10 flex items-center justify-center rounded-lg transition-colors ${active ? 'bg-[#E8EEF2] text-[#456981]' : 'text-[#6B8FA3] hover:bg-slate-50 hover:text-[#2C3840]'}`}
      >
        {icon}
      </button>
      {showTooltip && (
        <div className="absolute left-12 top-1/2 -translate-y-1/2 z-50 bg-[#2C3840] text-white text-xs rounded-lg px-2.5 py-1.5 whitespace-nowrap shadow-lg pointer-events-none">
          {label}
          {shortcut && <span className="ml-2 opacity-60">{shortcut}</span>}
          <div className="absolute right-full top-1/2 -translate-y-1/2 border-4 border-transparent border-r-[#2C3840]" />
        </div>
      )}
    </div>
  );
}

function Separator() {
  return <div className="w-6 h-px bg-slate-200 mx-auto my-1" />;
}

const SECTION_TYPES: { type: SectionType; label: string }[] = [
  { type: 'standing',   label: 'Standing area' },
  { type: 'seated',     label: 'Seated section' },
  { type: 'table_area', label: 'Table area' },
  { type: 'vip_lounge', label: 'VIP lounge' },
  { type: 'vip_table',  label: 'VIP tables' },
  { type: 'stage',      label: 'Stage section' },
  { type: 'other',      label: 'Other' },
];

export function LeftToolbar() {
  const store = useBuilderStore();
  const { tool, drawSectionContext, placeItemContext, placeStaticContext } = store;
  const [sectionFlyout, setSectionFlyout] = useState(false);
  const [sectionShape, setSectionShape] = useState<'rect' | 'polygon'>('rect');
  const [sectionType, setSectionType] = useState<SectionType>('seated');
  const sectionToolRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!sectionFlyout) return;
    const handler = (e: MouseEvent) => {
      if (sectionToolRef.current && !sectionToolRef.current.contains(e.target as Node)) {
        setSectionFlyout(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [sectionFlyout]);

  function isActiveTool(t: ToolMode) { return tool === t; }

  function activateSeatTool(preset: PlaceItemContext['shape_preset']) {
    store.setTool('place_item', { item_type: 'seat', shape_preset: preset } as PlaceItemContext);
  }

  function activateTableTool(preset: PlaceItemContext['shape_preset']) {
    store.setTool('place_item', { item_type: 'table', shape_preset: preset } as PlaceItemContext);
  }

  function activateStaticTool(type: PlaceStaticContext['static_type']) {
    store.setTool('place_static', { static_type: type } as PlaceStaticContext);
  }

  function activateSection(shape: 'rect' | 'polygon') {
    setSectionShape(shape);
    store.setTool('draw_section', { section_type: sectionType, shape } as DrawSectionContext);
    setSectionFlyout(false);
  }

  const isPlaceItem = (preset: string) => tool === 'place_item' && placeItemContext?.shape_preset === preset;
  const isPlaceStatic = (type: string) => tool === 'place_static' && placeStaticContext?.static_type === type;
  const isDrawSection = (shape?: string) => tool === 'draw_section' && (!shape || drawSectionContext?.shape === shape);

  return (
    <div
      className="fixed left-0 top-14 bottom-0 bg-white border-r border-slate-200 shadow-sm flex flex-col items-center py-2 gap-0.5 overflow-y-auto"
      style={{ width: 56, zIndex: 40, scrollbarWidth: 'none' }}
    >
      {/* Select */}
      <ToolButton icon={<MousePointer2 size={18} />} label="Select" shortcut="V"
        active={isActiveTool('select')}
        onClick={() => store.setTool('select')} />

      {/* Pan */}
      <ToolButton icon={<Hand size={18} />} label="Pan" shortcut="H"
        active={isActiveTool('pan')}
        onClick={() => store.setTool('pan')} />

      <Separator />

      {/* Draw section — with flyout */}
      <div ref={sectionToolRef} className="relative">
        <ToolButton
          icon={<PenTool size={18} />}
          label="Draw section"
          shortcut="S"
          active={isActiveTool('draw_section')}
          onClick={() => setSectionFlyout((v) => !v)}
        />
        {sectionFlyout && (
          <div className="absolute left-12 top-0 z-50 bg-white rounded-xl border border-slate-200 shadow-xl p-3 w-52">
            <p className="text-xs font-medium text-slate-500 mb-2">Section type</p>
            <div className="space-y-0.5 mb-3">
              {SECTION_TYPES.map((st) => (
                <button
                  key={st.type}
                  onClick={() => setSectionType(st.type)}
                  className={`w-full text-left text-xs px-2 py-1.5 rounded hover:bg-slate-50 ${sectionType === st.type ? 'text-[#456981] font-medium' : 'text-[#2C3840]'}`}
                >
                  {sectionType === st.type ? '● ' : '○ '}{st.label}
                </button>
              ))}
            </div>
            <p className="text-xs font-medium text-slate-500 mb-2">Shape</p>
            <div className="flex gap-2">
              <button
                onClick={() => activateSection('rect')}
                className={`flex-1 flex flex-col items-center gap-1 p-2 rounded-lg border text-xs transition-colors ${isDrawSection('rect') ? 'border-[#456981] bg-[#E8EEF2] text-[#456981]' : 'border-slate-200 hover:border-[#456981] text-slate-500'}`}
              >
                <Square size={16} />
                Rect
              </button>
              <button
                onClick={() => activateSection('polygon')}
                className={`flex-1 flex flex-col items-center gap-1 p-2 rounded-lg border text-xs transition-colors ${isDrawSection('polygon') ? 'border-[#456981] bg-[#E8EEF2] text-[#456981]' : 'border-slate-200 hover:border-[#456981] text-slate-500'}`}
              >
                <Pentagon size={16} />
                Polygon
              </button>
            </div>
          </div>
        )}
      </div>

      <Separator />

      {/* Seats */}
      <ToolButton icon={<Circle size={16} />} label="Circle seat" active={isPlaceItem('circle')} onClick={() => activateSeatTool('circle')} />
      <ToolButton icon={<Square size={16} />} label="Square seat" active={isPlaceItem('rounded_square')} onClick={() => activateSeatTool('rounded_square')} />
      <ToolButton icon={<Armchair size={16} />} label="Chair (top-down)" active={isPlaceItem('chair_topdown')} onClick={() => activateSeatTool('chair_topdown')} />
      <ToolButton icon={<Circle size={12} />} label="Bar stool" active={isPlaceItem('bar_stool')} onClick={() => activateSeatTool('bar_stool')} />

      <Separator />

      {/* Tables */}
      <ToolButton icon={<CircleDot size={16} />} label="Round table 4" active={isPlaceItem('round_table_4')} onClick={() => activateTableTool('round_table_4')} />
      <ToolButton icon={<CircleDot size={18} />} label="Round table 6" active={isPlaceItem('round_table_6')} onClick={() => activateTableTool('round_table_6')} />
      <ToolButton icon={<CircleDot size={20} />} label="Round table 8" active={isPlaceItem('round_table_8')} onClick={() => activateTableTool('round_table_8')} />
      <ToolButton icon={<RectangleHorizontal size={18} />} label="Rectangular table" active={isPlaceItem('rectangular_table')} onClick={() => activateTableTool('rectangular_table')} />
      <ToolButton icon={<LayoutTemplate size={16} />} label="Booth / L-bench" active={isPlaceItem('booth_l_shape')} onClick={() => activateTableTool('booth_l_shape')} />
      <ToolButton icon={<Sofa size={16} />} label="Sofa" active={isPlaceItem('sofa')} onClick={() => activateTableTool('sofa')} />
      <ToolButton icon={<Circle size={14} />} label="High table (cocktail)" active={isPlaceItem('high_table')} onClick={() => activateTableTool('high_table')} />

      <Separator />

      {/* Static objects */}
      <ToolButton icon={<Music2 size={16} />} label="Stage" active={isPlaceStatic('stage')} onClick={() => activateStaticTool('stage')} />
      <ToolButton icon={<GlassWater size={16} />} label="Bar" active={isPlaceStatic('bar')} onClick={() => activateStaticTool('bar')} />
      <ToolButton icon={<DoorOpen size={16} />} label="Entrance" active={isPlaceStatic('entrance')} onClick={() => activateStaticTool('entrance')} />
      <ToolButton icon={<Waves size={16} />} label="Restroom" active={isPlaceStatic('restroom')} onClick={() => activateStaticTool('restroom')} />
      <ToolButton icon={<Disc3 size={16} />} label="DJ Booth" active={isPlaceStatic('dj_booth')} onClick={() => activateStaticTool('dj_booth')} />
      <ToolButton icon={<Shirt size={16} />} label="Coat Check" active={isPlaceStatic('coat_check')} onClick={() => activateStaticTool('coat_check')} />
      <ToolButton icon={<Box size={16} />} label="Custom object" active={isPlaceStatic('custom')} onClick={() => activateStaticTool('custom')} />

      {/* Spacer */}
      <div className="flex-1" />

      <Separator />

      {/* Help */}
      <ToolButton icon={<HelpCircle size={16} />} label="Help / Onboarding" onClick={() => store.setShowOnboarding(true)} />
    </div>
  );
}
