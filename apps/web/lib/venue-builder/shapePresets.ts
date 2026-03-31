import type { ShapePreset } from '../../types/venueBuilder';

export interface ShapePresetDef {
  svgElement: 'path' | 'circle' | 'rect' | 'g';
  svgPath: string;
  defaultWidth: number;
  defaultHeight: number;
  label: string;
  icon: string;
  viewBox: string;
}

export const SHAPE_PRESETS: Record<ShapePreset, ShapePresetDef> = {
  circle: {
    svgElement: 'circle',
    svgPath: '',
    defaultWidth: 32,
    defaultHeight: 32,
    label: 'Seat (circle)',
    icon: 'Circle',
    viewBox: '0 0 40 40',
  },
  rounded_square: {
    svgElement: 'rect',
    svgPath: '',
    defaultWidth: 32,
    defaultHeight: 32,
    label: 'Seat (rounded square)',
    icon: 'Square',
    viewBox: '0 0 40 40',
  },
  chair_topdown: {
    svgElement: 'path',
    svgPath:
      'M10,4 h20 a4,4 0 0 1 4,4 v4 H6 V8 a4,4 0 0 1 4,-4 Z M4,17 h32 a3,3 0 0 1 3,3 v16 a3,3 0 0 1 -3,3 H4 a3,3 0 0 1 -3,-3 V20 a3,3 0 0 1 3,-3 Z',
    defaultWidth: 32,
    defaultHeight: 36,
    label: 'Seat (top-down)',
    icon: 'Armchair',
    viewBox: '0 0 40 40',
  },
  round_table_4: {
    svgElement: 'g',
    svgPath: '',
    defaultWidth: 80,
    defaultHeight: 80,
    label: 'Round table (4 seats)',
    icon: 'CircleDot',
    viewBox: '0 0 80 80',
  },
  round_table_6: {
    svgElement: 'g',
    svgPath: '',
    defaultWidth: 96,
    defaultHeight: 96,
    label: 'Round table (6 seats)',
    icon: 'CircleDot',
    viewBox: '0 0 96 96',
  },
  round_table_8: {
    svgElement: 'g',
    svgPath: '',
    defaultWidth: 112,
    defaultHeight: 112,
    label: 'Round table (8 seats)',
    icon: 'CircleDot',
    viewBox: '0 0 112 112',
  },
  rectangular_table: {
    svgElement: 'g',
    svgPath: '',
    defaultWidth: 120,
    defaultHeight: 60,
    label: 'Rectangular table',
    icon: 'RectangleHorizontal',
    viewBox: '0 0 120 60',
  },
  booth_l_shape: {
    svgElement: 'path',
    svgPath: 'M 5,5 H 60 V 35 H 35 V 60 H 5 Z',
    defaultWidth: 100,
    defaultHeight: 80,
    label: 'Booth / L-bench',
    icon: 'LayoutTemplate',
    viewBox: '0 0 80 80',
  },
  bar_stool: {
    svgElement: 'circle',
    svgPath: '',
    defaultWidth: 24,
    defaultHeight: 24,
    label: 'Bar stool',
    icon: 'Circle',
    viewBox: '0 0 24 24',
  },
  sofa: {
    svgElement: 'path',
    svgPath:
      'M4,8 h72 a4,4 0 0 1 4,4 v8 H4 V12 a4,4 0 0 1 4,-4 Z M0,22 h80 v24 a4,4 0 0 1 -4,4 H4 a4,4 0 0 1 -4,-4 Z M0,22 v28 a4,4 0 0 0 4,4 v-28 a4,4 0 0 0 -4,-4 Z M80,22 v28 a4,4 0 0 1 -4,4 v-28 a4,4 0 0 1 4,-4 Z',
    defaultWidth: 160,
    defaultHeight: 60,
    label: 'Sofa',
    icon: 'Sofa',
    viewBox: '0 0 80 54',
  },
  high_table: {
    svgElement: 'circle',
    svgPath: '',
    defaultWidth: 40,
    defaultHeight: 40,
    label: 'High table (cocktail)',
    icon: 'Circle',
    viewBox: '0 0 40 40',
  },
};

// Seat presets (item_type = 'seat')
export const SEAT_PRESETS: ShapePreset[] = [
  'circle',
  'rounded_square',
  'chair_topdown',
  'bar_stool',
];

// Table presets (item_type = 'table')
export const TABLE_PRESETS: ShapePreset[] = [
  'round_table_4',
  'round_table_6',
  'round_table_8',
  'rectangular_table',
  'booth_l_shape',
  'sofa',
  'high_table',
];

export function getDefaultCapacity(preset: ShapePreset): number {
  switch (preset) {
    case 'round_table_4': return 4;
    case 'round_table_6': return 6;
    case 'round_table_8': return 8;
    case 'rectangular_table': return 6;
    case 'booth_l_shape': return 4;
    case 'sofa': return 3;
    case 'high_table': return 4;
    default: return 1;
  }
}
