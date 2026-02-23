export type PatternMode = 'radial' | 'wedge' | 'cropped-radial';
export type Direction = 'T2B' | 'B2T' | 'L2R' | 'R2L';
export type Corner = 'TL' | 'TR' | 'BL' | 'BR' | 'T' | 'R' | 'B' | 'L';
export type AnimationMode = 'linear' | 'staccato' | 'wipe' | 'random' | 'spiral' | 'two-way-wipe' | 'random-wipe';
export type OutlineMode = 'draw' | 'expand';
export type DrawDirection = 'outwards' | 'inwards';

export interface BaseLayer {
  id: number;
  type: PatternMode;
  visible: boolean;
  countIndex: number; // Index referencing the line count array
  fill: boolean;
  highCountUnlocked?: boolean;
}

export interface RadialLayer extends BaseLayer {
  type: 'radial';
  rInner: number;
  rOuter: number;
  outline: boolean;
}

export interface WedgeLayer extends BaseLayer {
  type: 'wedge';
  rInner: number;
  rOuter: number;
  // Center and Spread are now global/derived
  outline: boolean;
}

export interface CroppedRadialLayer extends BaseLayer {
  type: 'cropped-radial';
  rInner: number;
  rOuter: number;
  startOffset: number; // Number of lines to skip from the start edge
  outline: boolean;
}

export type Layer = RadialLayer | WedgeLayer | CroppedRadialLayer;

// Extending Window for P5 and GIFshot global access
declare global {
  interface Window {
    p5: any;
    gifshot: any;
  }
}