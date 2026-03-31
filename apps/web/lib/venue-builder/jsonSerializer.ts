import type {
  BuilderState,
  VenueBuilderJSON,
  JsonSection,
  JsonItem,
  JsonStaticObject,
  ShapePreset,
  JsonShapePresetDef,
} from '../../types/venueBuilder';
import { cropAndNormalizeCanvas } from './canvasCrop';
import { SHAPE_PRESETS } from './shapePresets';

export function serializeToJSON(
  state: Pick<
    BuilderState,
    'sections' | 'items' | 'statics' | 'venue_id' | 'layout_version'
  >
): VenueBuilderJSON {
  const { sections: normalSections, items: normalItems, statics: normalStatics, canvasWidth, canvasHeight } =
    cropAndNormalizeCanvas(state.sections, state.items, state.statics);

  const jsonSections: JsonSection[] = normalSections.map((s) => ({
    json_id: s.id,
    db_id: s.db_id,
    label: s.label,
    section_type: s.section_type,
    fill_color: s.fill_color,
    border_color: s.border_color,
    opacity: s.opacity,
    shape: s.shape,
    x: s.x,
    y: s.y,
    width: s.width,
    height: s.height,
    points: s.points,
    z_index: s.z_index,
    capacity: s.capacity,
    is_numbered: s.is_numbered,
  }));

  const jsonItems: JsonItem[] = normalItems.map((i) => ({
    json_id: i.id,
    db_id: i.db_id,
    section_json_id: i.section_id,
    item_type: i.item_type,
    shape_preset: i.shape_preset,
    x: i.x,
    y: i.y,
    width: i.width,
    height: i.height,
    rotation: i.rotation,
    label: i.label,
    label_visible: i.label_visible,
    label_position: i.label_position,
    z_index: i.z_index,
    capacity: i.capacity,
    chair_positions: i.chair_positions,
  }));

  const jsonStatics: JsonStaticObject[] = normalStatics.map((s) => ({
    json_id: s.id,
    type: s.type,
    label: s.label,
    label_visible: s.label_visible,
    shape: s.shape,
    x: s.x,
    y: s.y,
    width: s.width,
    height: s.height,
    points: s.points,
    fill_color: s.fill_color,
    border_color: s.border_color,
    opacity: s.opacity,
    z_index: s.z_index,
  }));

  const shapePresetsOut: Record<ShapePreset, JsonShapePresetDef> = {} as Record<ShapePreset, JsonShapePresetDef>;
  for (const [key, def] of Object.entries(SHAPE_PRESETS)) {
    shapePresetsOut[key as ShapePreset] = {
      svg_path: def.svgPath,
      default_width: def.defaultWidth,
      default_height: def.defaultHeight,
      label: def.label,
    };
  }

  return {
    venue_id: state.venue_id,
    layout_id: null,
    schema_version: 2,
    canvas: {
      width: canvasWidth,
      height: canvasHeight,
      background_color: '#F5F4F0',
    },
    viewport: {
      min_zoom: 0.1,
      max_zoom: 4.0,
      default_zoom: 1.0,
    },
    sections: jsonSections,
    items: jsonItems,
    static_objects: jsonStatics,
    shape_presets: shapePresetsOut,
  };
}
