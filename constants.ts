import { Layer, PatternMode, RadialLayer, WedgeLayer, CroppedRadialLayer, Direction } from './types';

export const CONFIG = {
  width: 800,
  height: 800,
  logicalWidth: 800,
  logicalHeight: 800,
  // Reduced to max 48 lines
  lineCounts: [4, 8, 12, 16, 24, 32, 48],
};

// Reduced to max 25 lines
export const WEDGE_COUNTS = [4, 7, 13, 25];
export const SPREAD_OPTIONS = [15, 30, 45, 60, 90];

export const DEFAULT_RADIAL: Omit<RadialLayer, 'id'> = {
  type: 'radial',
  visible: true,
  countIndex: 4, // 24 lines
  rInner: 50,
  rOuter: 300,
  outline: false,
  fill: false,
  highCountUnlocked: false,
};

export const DEFAULT_WEDGE: Omit<WedgeLayer, 'id'> = {
  type: 'wedge',
  visible: true,
  countIndex: 0, // 4 lines
  rInner: 0,
  rOuter: 500,
  outline: false,
  fill: false,
  highCountUnlocked: false,
};

export const DEFAULT_CROPPED_RADIAL: Omit<CroppedRadialLayer, 'id'> = {
  type: 'cropped-radial',
  visible: true,
  countIndex: 4, // 24 lines
  rInner: 50,
  rOuter: 800,
  startOffset: 0,
  outline: false,
  fill: false,
  highCountUnlocked: false,
};

export const createLayer = (mode: PatternMode): Layer => {
  const id = Date.now();
  if (mode === 'radial') return { ...DEFAULT_RADIAL, id } as RadialLayer;
  if (mode === 'wedge') return { ...DEFAULT_WEDGE, id } as WedgeLayer;
  return { ...DEFAULT_CROPPED_RADIAL, id } as CroppedRadialLayer;
};