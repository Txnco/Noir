import type { SectionType, StaticObjectType } from '../../types/venueBuilder';

export const SECTION_TYPE_DEFAULTS: Record<
  SectionType,
  {
    fill_color: string;
    border_color: string;
    opacity: number;
    label_prefix: string;
    icon: string;
  }
> = {
  standing:   { fill_color: '#E8EEF2', border_color: '#B0C4D0', opacity: 0.6, label_prefix: 'Floor',      icon: 'Users' },
  seated:     { fill_color: '#EAF0F5', border_color: '#9BB5C5', opacity: 0.6, label_prefix: 'Seating',    icon: 'Armchair' },
  table_area: { fill_color: '#F0EDF5', border_color: '#B5A8CC', opacity: 0.5, label_prefix: 'Tables',     icon: 'LayoutGrid' },
  vip_lounge: { fill_color: '#F5EDF5', border_color: '#C4A0C4', opacity: 0.5, label_prefix: 'VIP',        icon: 'Star' },
  vip_table:  { fill_color: '#F8EBF3', border_color: '#CC9BB8', opacity: 0.5, label_prefix: 'VIP Tables', icon: 'Star' },
  stage:      { fill_color: '#F0F0E8', border_color: '#B8B490', opacity: 0.7, label_prefix: 'Stage',      icon: 'Music' },
  other:      { fill_color: '#EEEEEE', border_color: '#BBBBBB', opacity: 0.5, label_prefix: 'Zone',       icon: 'Box' },
};

export const STATIC_TYPE_DEFAULTS: Record<
  StaticObjectType,
  {
    fill_color: string;
    border_color: string;
    icon: string;
    label: string;
    default_width: number;
    default_height: number;
  }
> = {
  stage:      { fill_color: '#E8E4D0', border_color: '#A09870', icon: 'Music2',      label: 'Stage',      default_width: 200, default_height: 80 },
  bar:        { fill_color: '#D0E4E8', border_color: '#70A0A8', icon: 'GlassWater',  label: 'Bar',        default_width: 160, default_height: 60 },
  entrance:   { fill_color: '#D0E8D4', border_color: '#70A870', icon: 'DoorOpen',    label: 'Entrance',   default_width: 80,  default_height: 40 },
  restroom:   { fill_color: '#E8E8D0', border_color: '#A8A870', icon: 'Waves',       label: 'Restroom',   default_width: 80,  default_height: 80 },
  dj_booth:   { fill_color: '#E0D0E8', border_color: '#9870A8', icon: 'Disc3',       label: 'DJ Booth',   default_width: 100, default_height: 80 },
  coat_check: { fill_color: '#E8D8D0', border_color: '#A88870', icon: 'Shirt',       label: 'Coat Check', default_width: 100, default_height: 60 },
  custom:     { fill_color: '#EEEEEE', border_color: '#AAAAAA', icon: 'Box',         label: 'Custom',     default_width: 100, default_height: 100 },
};

export const SECTION_TYPE_LABELS: Record<SectionType, string> = {
  standing:   'Standing area',
  seated:     'Seated section',
  table_area: 'Table area',
  vip_lounge: 'VIP lounge',
  vip_table:  'VIP tables',
  stage:      'Stage',
  other:      'Other',
};
