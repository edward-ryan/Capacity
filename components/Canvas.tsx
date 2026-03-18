import React, { useEffect, useRef, useImperativeHandle, forwardRef } from 'react';
import { Layer, RadialLayer, WedgeLayer, CroppedRadialLayer, Direction, Corner, AnimationMode, OutlineMode, DrawDirection } from '../types';
import { CONFIG, WEDGE_COUNTS } from '../constants';
import { getPatternFileName } from '../App';

interface CanvasProps {
  layers: Layer[];
  direction: Direction;
  spreadAngle: number;
  corner: Corner;
  isDarkMode: boolean;
  animationProgress: number; // 0 to 1
  animationMode: AnimationMode;
  easeIn: number;
  easeOut: number;
  outlineMode: OutlineMode;
  drawDirection: DrawDirection;
  strokeWeight: number;
}

export interface CanvasHandle {
  downloadSVG: () => void;
  getCanvas: () => HTMLCanvasElement | null;
}

// --- Animation Helpers ---

const solveCubicBezier = (p1x: number, p1y: number, p2x: number, p2y: number, x: number): number => {
    let t = x; 
    for (let i = 0; i < 5; i++) {
        const invT = 1 - t;
        const currentX = 3 * invT * invT * t * p1x + 3 * invT * t * t * p2x + t * t * t;
        const currentSlope = 3 * invT * invT * p1x + 6 * invT * t * (p2x - p1x) + 3 * t * t * (1 - p2x);
        
        if (Math.abs(currentSlope) < 1e-5) break;
        t -= (currentX - x) / currentSlope;
    }
    t = Math.max(0, Math.min(1, t));
    
    const invT = 1 - t;
    const y = 3 * invT * invT * t * p1y + 3 * invT * t * t * p2y + t * t * t;
    return y;
};

const getEased = (p: number, easeIn: number, easeOut: number) => {
    const p1x = easeIn * 0.8;
    const p1y = 0;
    const p2x = 1 - (easeOut * 0.8);
    const p2y = 1;
    return solveCubicBezier(p1x, p1y, p2x, p2y, p);
};

const pseudoRandom = (seed: number) => {
    return Math.abs(Math.sin(seed * 12.9898) * 43758.5453) % 1;
};

const getLayerProgress = (globalP: number, layerIndex: number, totalLayers: number, mode: AnimationMode, id: number) => {
    return globalP;
};

const calculateLineState = (
  globalProgress: number,
  mode: AnimationMode,
  index: number,
  totalCount: number,
  easeIn: number, 
  easeOut: number,
  layerType: 'radial' | 'wedge' | 'cropped-radial'
): { rProgress: number; angleProgress: number } => {
  
  if (globalProgress <= 0) return { rProgress: 0, angleProgress: 0 };
  if (globalProgress >= 1) return { rProgress: 1, angleProgress: 1 };

  if (mode === 'linear') {
    const p = getEased(globalProgress, easeIn, easeOut);
    return { rProgress: p, angleProgress: 1 };
  }

  if (mode === 'wipe' || mode === 'two-way-wipe' || mode === 'random-wipe') {
    const p = getEased(globalProgress, easeIn, easeOut);
    return { rProgress: 1, angleProgress: p };
  }

  if (mode === 'staccato') {
    let dist = 0;
    let maxDist = 0;

    if (layerType === 'radial') {
      const half = totalCount / 2;
      dist = index <= half ? index : totalCount - index;
      maxDist = half;
    } else {
      const center = (totalCount - 1) / 2;
      dist = Math.abs(index - center);
      maxDist = center;
    }

    const delayFactor = 0.6;
    const normDist = maxDist > 0 ? dist / maxDist : 0;
    const delay = normDist * delayFactor;
    const duration = 1 - delayFactor; 

    const rawLineP = (globalProgress - delay) / duration;
    const clampedLineP = Math.max(0, Math.min(1, rawLineP));
    const p = getEased(clampedLineP, easeIn, easeOut);

    return { rProgress: p, angleProgress: 1 };
  }

  if (mode === 'random') {
    const rand = pseudoRandom(index + 42); 
    const delayFactor = 0.6; 
    const delay = rand * delayFactor;
    const duration = 1 - delayFactor;

    const rawLineP = (globalProgress - delay) / duration;
    const clampedLineP = Math.max(0, Math.min(1, rawLineP));
    const p = getEased(clampedLineP, easeIn, easeOut);

    return { rProgress: p, angleProgress: 1 };
  }

  if (mode === 'spiral') {
      const normIndex = index / totalCount;
      const delayFactor = 0.7;
      const duration = 1 - delayFactor;
      
      const delay = normIndex * delayFactor;
      const rawLineP = (globalProgress - delay) / duration;
      const clampedLineP = Math.max(0, Math.min(1, rawLineP));
      const p = getEased(clampedLineP, easeIn, easeOut);
      
      return { rProgress: p, angleProgress: 1 };
  }

  return { rProgress: 0, angleProgress: 0 };
};

// --- Drawing Helpers ---

const drawFillShape = (p: any, rIn: number, rOut: number, startAng: number, endAng: number, fillColor: string) => {
  p.fill(fillColor);
  p.noStroke();
  p.beginShape();
  
  const steps = 60;
  for (let i = 0; i <= steps; i++) {
    const a = p.map(i, 0, steps, startAng, endAng);
    p.vertex(p.cos(a) * rOut, p.sin(a) * rOut);
  }
  for (let i = steps; i >= 0; i--) {
    const a = p.map(i, 0, steps, startAng, endAng);
    p.vertex(p.cos(a) * rIn, p.sin(a) * rIn);
  }
  p.endShape(p.CLOSE);
};

const drawOutlineArc = (p: any, r: number, startAng: number, endAng: number, progress: number) => {
    if (progress <= 0 || r <= 0) return;
    const currentEnd = p.lerp(startAng, endAng, progress);
    if (Math.abs(currentEnd - startAng) > 0.001) {
       p.arc(0, 0, r * 2, r * 2, startAng, currentEnd);
    }
};

const drawOutlineCircle = (p: any, r: number, progress: number) => {
    if (progress <= 0 || r <= 0) return;
    const start = -p.HALF_PI;
    const end = p.TWO_PI - p.HALF_PI;
    const currentEnd = p.lerp(start, end, progress);
    p.arc(0, 0, r * 2, r * 2, start, currentEnd);
};


// --- Layer Drawers ---

const drawRadial = (
  p: any, 
  data: RadialLayer, 
  animMode: AnimationMode,
  easeIn: number,
  easeOut: number,
  outlineMode: OutlineMode,
  drawDir: DrawDirection,
  globalP: number, 
  strokeColor: number, 
  bgColor: string,
  layerIndex: number,
  totalLayers: number,
  strokeWeight: number
) => {
  const count = CONFIG.lineCounts[data.countIndex];
  const cx = p.width / 2;
  const cy = p.height / 2;

  const effectiveP = getLayerProgress(globalP, layerIndex, totalLayers, animMode, data.id);

  p.push();
  p.translate(cx, cy);

  if (data.fill) {
      const fillP = getEased(effectiveP, easeIn, easeOut);
      const startR = drawDir === 'outwards' ? data.rInner : data.rOuter;
      const endR = drawDir === 'outwards' ? data.rOuter : data.rInner;
      const fillR = p.lerp(startR, endR, fillP);
      
      if (drawDir === 'outwards') {
          drawFillShape(p, data.rInner, fillR, 0, p.TWO_PI, bgColor);
      } else {
          drawFillShape(p, fillR, data.rOuter, 0, p.TWO_PI, bgColor);
      }
  }

  p.stroke(strokeColor);
  p.strokeWeight(strokeWeight);
  p.noFill();

  for (let i = 0; i < count; i++) {
    const { rProgress, angleProgress } = calculateLineState(effectiveP, animMode, i, count, easeIn, easeOut, 'radial');
    
    const startR = drawDir === 'outwards' ? data.rInner : data.rOuter;
    const endR = drawDir === 'outwards' ? data.rOuter : data.rInner;
    const rCurrent = p.lerp(startR, endR, rProgress);
    const targetAngle = p.map(i, 0, count, -p.HALF_PI, p.TWO_PI - p.HALF_PI);
    
    let seedAngle = -p.HALF_PI; 
    if (animMode === 'two-way-wipe') {
        seedAngle = (layerIndex % 2 === 0) ? -p.HALF_PI : p.HALF_PI;
    } else if (animMode === 'random-wipe') {
        const r = pseudoRandom(data.id);
        if (r < 0.25) seedAngle = -p.HALF_PI;
        else if (r < 0.5) seedAngle = p.HALF_PI;
        else if (r < 0.75) seedAngle = 0;
        else seedAngle = p.PI;
    }

    const currentAngle = p.lerp(seedAngle, targetAngle, angleProgress);
    const anchorR = drawDir === 'outwards' ? data.rInner : data.rOuter;

    if (Math.abs(rCurrent - anchorR) > 0.1) {
        const x1 = p.cos(currentAngle) * anchorR;
        const y1 = p.sin(currentAngle) * anchorR;
        const x2 = p.cos(currentAngle) * rCurrent;
        const y2 = p.sin(currentAngle) * rCurrent;
        p.line(x1, y1, x2, y2);
    }
  }

  if (data.outline) {
    p.stroke(strokeColor);
    p.noFill();
    const outlineP = getEased(effectiveP, easeIn, easeOut);
    if (outlineMode === 'draw') {
        drawOutlineCircle(p, data.rInner, outlineP);
        let outerDelay = 0;
        if (animMode === 'linear') outerDelay = 0.2;
        const outerPRaw = (effectiveP - outerDelay) / (1 - outerDelay);
        const outerP = getEased(Math.max(0, Math.min(1, outerPRaw)), easeIn, easeOut);
        drawOutlineCircle(p, data.rOuter, outerP);
    } else {
        const startR = drawDir === 'outwards' ? data.rInner : data.rOuter;
        const endR = drawDir === 'outwards' ? data.rOuter : data.rInner;
        const rCurrent = p.lerp(startR, endR, outlineP);
        if (drawDir === 'outwards') {
            p.ellipse(0, 0, data.rInner * 2);
            p.ellipse(0, 0, rCurrent * 2);
        } else {
            p.ellipse(0, 0, data.rOuter * 2);
            p.ellipse(0, 0, rCurrent * 2);
        }
    }
  }
  p.pop();
};

const drawWedge = (
  p: any, 
  data: WedgeLayer, 
  dir: Direction, 
  spread: number, 
  animMode: AnimationMode,
  easeIn: number,
  easeOut: number,
  outlineMode: OutlineMode,
  drawDir: DrawDirection,
  globalP: number,
  strokeColor: number, 
  bgColor: string,
  layerIndex: number,
  totalLayers: number,
  strokeWeight: number
) => {
  let cx = 400;
  let cy = 0;
  let baseAngle = 90;

  if (dir === 'T2B') { cx = 400; cy = 0; baseAngle = 90; }
  else if (dir === 'B2T') { cx = 400; cy = 800; baseAngle = 270; }
  else if (dir === 'L2R') { cx = 0; cy = 400; baseAngle = 0; }
  else if (dir === 'R2L') { cx = 800; cy = 400; baseAngle = 180; }

  const effectiveP = getLayerProgress(globalP, layerIndex, totalLayers, animMode, data.id);

  p.push();
  p.translate(cx, cy);

  const halfSpread = spread / 2;
  const startAng = p.radians(baseAngle - halfSpread);
  const endAng = p.radians(baseAngle + halfSpread);
  const centerAng = p.radians(baseAngle);

  if (data.fill) {
    const fillP = getEased(effectiveP, easeIn, easeOut);
    const startR = drawDir === 'outwards' ? data.rInner : data.rOuter;
    const endR = drawDir === 'outwards' ? data.rOuter : data.rInner;
    const fillR = p.lerp(startR, endR, fillP);
    
    if (drawDir === 'outwards') {
        drawFillShape(p, data.rInner, fillR, startAng, endAng, bgColor);
    } else {
        drawFillShape(p, fillR, data.rOuter, startAng, endAng, bgColor);
    }
  }

  p.stroke(strokeColor);
  p.strokeWeight(strokeWeight);
  p.noFill();

  const count = WEDGE_COUNTS[data.countIndex];
  const safeCount = count > 1 ? count - 1 : 1;
  
  for (let i = 0; i < count; i++) {
      const { rProgress, angleProgress } = calculateLineState(effectiveP, animMode, i, count, easeIn, easeOut, 'wedge');
      const startR = drawDir === 'outwards' ? data.rInner : data.rOuter;
      const endR = drawDir === 'outwards' ? data.rOuter : data.rInner;
      const rCurrent = p.lerp(startR, endR, rProgress);
      const targetAngle = p.map(i, 0, safeCount, startAng, endAng);
      
      let seedAngle = centerAng;
      if (animMode === 'two-way-wipe') {
          seedAngle = (layerIndex % 2 === 0) ? centerAng : startAng;
      } else if (animMode === 'random-wipe') {
          const r = pseudoRandom(data.id);
          if (r < 0.33) seedAngle = centerAng;
          else if (r < 0.66) seedAngle = startAng;
          else seedAngle = endAng;
      }

      const currentAngle = p.lerp(seedAngle, targetAngle, angleProgress);
      const anchorR = drawDir === 'outwards' ? data.rInner : data.rOuter;

      if (Math.abs(rCurrent - anchorR) > 0.1) {
        const x1 = p.cos(currentAngle) * anchorR;
        const y1 = p.sin(currentAngle) * anchorR;
        const x2 = p.cos(currentAngle) * rCurrent;
        const y2 = p.sin(currentAngle) * rCurrent;
        p.line(x1, y1, x2, y2);
      }
  }

  if (data.outline) {
     const outlineP = getEased(effectiveP, easeIn, easeOut);
     if (outlineMode === 'draw') {
        drawOutlineArc(p, data.rInner, startAng, endAng, outlineP);
        drawOutlineArc(p, data.rOuter, startAng, endAng, outlineP);
     } else {
         const startR = drawDir === 'outwards' ? data.rInner : data.rOuter;
         const endR = drawDir === 'outwards' ? data.rOuter : data.rInner;
         const rCurrent = p.lerp(startR, endR, outlineP);
         if (drawDir === 'outwards') {
             p.arc(0, 0, data.rInner * 2, data.rInner * 2, startAng, endAng);
             p.arc(0, 0, rCurrent * 2, rCurrent * 2, startAng, endAng);
         } else {
             p.arc(0, 0, data.rOuter * 2, data.rOuter * 2, startAng, endAng);
             p.arc(0, 0, rCurrent * 2, rCurrent * 2, startAng, endAng);
         }
     }
  }
  p.pop();
};

const drawCroppedRadial = (
  p: any, 
  data: CroppedRadialLayer, 
  corner: Corner, 
  animMode: AnimationMode,
  easeIn: number,
  easeOut: number,
  outlineMode: OutlineMode,
  drawDir: DrawDirection,
  globalP: number,
  strokeColor: number, 
  bgColor: string,
  layerIndex: number,
  totalLayers: number,
  strokeWeight: number
) => {
  let cx = 0;
  let cy = 0;
  let startRad = 0;
  let endRad = p.HALF_PI;
  let seedRad = p.QUARTER_PI; 

  switch (corner) {
    case 'TL': cx = 0; cy = 0; startRad = 0; endRad = p.HALF_PI; seedRad = p.QUARTER_PI; break;
    case 'TR': cx = p.width; cy = 0; startRad = p.HALF_PI; endRad = p.PI; seedRad = p.PI - p.QUARTER_PI; break;
    case 'BR': cx = p.width; cy = p.height; startRad = p.PI; endRad = p.PI + p.HALF_PI; seedRad = p.PI + p.QUARTER_PI; break;
    case 'BL': cx = 0; cy = p.height; startRad = p.PI + p.HALF_PI; endRad = p.TWO_PI; seedRad = p.TWO_PI - p.QUARTER_PI; break;
    case 'T': cx = p.width / 2; cy = 0; startRad = 0; endRad = p.PI; seedRad = p.HALF_PI; break;
    case 'R': cx = p.width; cy = p.height / 2; startRad = p.HALF_PI; endRad = p.PI + p.HALF_PI; seedRad = p.PI; break;
    case 'B': cx = p.width / 2; cy = p.height; startRad = p.PI; endRad = p.TWO_PI; seedRad = p.PI + p.HALF_PI; break;
    case 'L': cx = 0; cy = p.height / 2; startRad = -p.HALF_PI; endRad = p.HALF_PI; seedRad = 0; break;
  }

  const effectiveP = getLayerProgress(globalP, layerIndex, totalLayers, animMode, data.id);

  p.push();
  p.translate(cx, cy);

  if (data.fill) {
    const fillP = getEased(effectiveP, easeIn, easeOut);
    const startR = drawDir === 'outwards' ? data.rInner : data.rOuter;
    const endR = drawDir === 'outwards' ? data.rOuter : data.rInner;
    const fillR = p.lerp(startR, endR, fillP);
    
    if (drawDir === 'outwards') {
        drawFillShape(p, data.rInner, fillR, startRad, endRad, bgColor);
    } else {
        drawFillShape(p, fillR, data.rOuter, startRad, endRad, bgColor);
    }
  }

  p.stroke(strokeColor);
  p.strokeWeight(strokeWeight);
  p.noFill();

  const count = CONFIG.lineCounts[data.countIndex];
  for (let i = 0; i <= count; i++) {
      if (i < data.startOffset) continue;
      if (i > count - data.startOffset) continue;
      
      const { rProgress, angleProgress } = calculateLineState(effectiveP, animMode, i, count, easeIn, easeOut, 'cropped-radial');
      const startR = drawDir === 'outwards' ? data.rInner : data.rOuter;
      const endR = drawDir === 'outwards' ? data.rOuter : data.rInner;
      const rCurrent = p.lerp(startR, endR, rProgress);
      const targetAngle = p.map(i, 0, count, startRad, endRad);
      
      let angleSeed = seedRad; 
      if (animMode === 'two-way-wipe') {
          angleSeed = (layerIndex % 2 === 0) ? seedRad : startRad;
      } else if (animMode === 'random-wipe') {
          const r = pseudoRandom(data.id);
          if (r < 0.33) angleSeed = seedRad;
          else if (r < 0.66) angleSeed = startRad;
          else angleSeed = endRad;
      }

      const currentAngle = p.lerp(angleSeed, targetAngle, angleProgress);
      const anchorR = drawDir === 'outwards' ? data.rInner : data.rOuter;

      if (Math.abs(rCurrent - anchorR) > 0.1) {
        const x1 = p.cos(currentAngle) * anchorR;
        const y1 = p.sin(currentAngle) * anchorR;
        const x2 = p.cos(currentAngle) * rCurrent;
        const y2 = p.sin(currentAngle) * rCurrent;
        p.line(x1, y1, x2, y2);
      }
  }

  if (data.outline) {
      const outlineP = getEased(effectiveP, easeIn, easeOut);
      if (outlineMode === 'draw') {
          drawOutlineArc(p, data.rInner, startRad, endRad, outlineP);
          drawOutlineArc(p, data.rOuter, startRad, endRad, outlineP);
      } else {
          const startR = drawDir === 'outwards' ? data.rInner : data.rOuter;
          const endR = drawDir === 'outwards' ? data.rOuter : data.rInner;
          const rCurrent = p.lerp(startR, endR, outlineP);
          if (drawDir === 'outwards') {
              p.arc(0, 0, data.rInner * 2, data.rInner * 2, startRad, endRad);
              p.arc(0, 0, rCurrent * 2, rCurrent * 2, startRad, endRad);
          } else {
              p.arc(0, 0, data.rOuter * 2, data.rOuter * 2, startRad, endRad);
              p.arc(0, 0, rCurrent * 2, rCurrent * 2, startRad, endRad);
          }
      }
  }
  p.pop();
};

const renderScene = (p: any, opts: {
    layers: Layer[],
    direction: Direction,
    spread: number,
    corner: Corner,
    isDarkMode: boolean,
    progress: number,
    animMode: AnimationMode,
    easeIn: number,
    easeOut: number,
    outlineMode: OutlineMode,
    drawDirection: DrawDirection,
    strokeWeight: number
}) => {
    const bg = opts.isDarkMode ? '#000000' : '#ffffff';
    const strokeColor = opts.isDarkMode ? 255 : 0;
    
    p.background(bg);

    opts.layers.forEach((layer, index) => {
      if (!layer.visible) return;
      const totalLayers = opts.layers.length;
      if (layer.type === 'radial') {
        drawRadial(p, layer as RadialLayer, opts.animMode, opts.easeIn, opts.easeOut, opts.outlineMode, opts.drawDirection, opts.progress, strokeColor, bg, index, totalLayers, opts.strokeWeight);
      } else if (layer.type === 'wedge') {
        drawWedge(p, layer as WedgeLayer, opts.direction, opts.spread, opts.animMode, opts.easeIn, opts.easeOut, opts.outlineMode, opts.drawDirection, opts.progress, strokeColor, bg, index, totalLayers, opts.strokeWeight);
      } else if (layer.type === 'cropped-radial') {
        drawCroppedRadial(p, layer as CroppedRadialLayer, opts.corner, opts.animMode, opts.easeIn, opts.easeOut, opts.outlineMode, opts.drawDirection, opts.progress, strokeColor, bg, index, totalLayers, opts.strokeWeight);
      }
    });
};

// --- Component ---

const Canvas = forwardRef<CanvasHandle, CanvasProps>(({ 
  layers, direction, spreadAngle, corner, isDarkMode, animationProgress, animationMode, easeIn, easeOut, outlineMode, drawDirection, strokeWeight
}, ref) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const p5InstanceRef = useRef<any>(null);
  
  const stateRef = useRef({
      layers,
      direction,
      spreadAngle,
      corner,
      isDarkMode,
      animationProgress,
      animationMode,
      easeIn,
      easeOut,
      outlineMode,
      drawDirection,
      strokeWeight
  });

  useEffect(() => {
    stateRef.current = {
      layers,
      direction,
      spreadAngle,
      corner,
      isDarkMode,
      animationProgress,
      animationMode,
      easeIn,
      easeOut,
      outlineMode,
      drawDirection,
      strokeWeight
    };
  }, [layers, direction, spreadAngle, corner, isDarkMode, animationProgress, animationMode, easeIn, easeOut, outlineMode, drawDirection, strokeWeight]);

  useImperativeHandle(ref, () => ({
    downloadSVG: () => {
      const hiddenContainer = document.createElement('div');
      hiddenContainer.style.position = 'absolute';
      hiddenContainer.style.left = '-9999px';
      hiddenContainer.style.top = '-9999px';
      document.body.appendChild(hiddenContainer);

      const p5_GlobalRef = (window as any).p5;
      if (!p5_GlobalRef) return;
      
      const activeType = stateRef.current.layers[0]?.type || 'radial';

      new p5_GlobalRef((p: any) => {
        p.setup = () => {
          p.createCanvas(CONFIG.width, CONFIG.height, p.SVG);
          p.pixelDensity(1); 
          p.noLoop();
        };

        p.draw = () => {
           renderScene(p, {
               layers: stateRef.current.layers,
               direction: stateRef.current.direction,
               spread: stateRef.current.spreadAngle,
               corner: stateRef.current.corner,
               isDarkMode: stateRef.current.isDarkMode,
               progress: 1, 
               animMode: stateRef.current.animationMode,
               easeIn: stateRef.current.easeIn,
               easeOut: stateRef.current.easeOut,
               outlineMode: stateRef.current.outlineMode,
               drawDirection: stateRef.current.drawDirection,
               strokeWeight: stateRef.current.strokeWeight
           });
           
           p.save(getPatternFileName(activeType, 'svg'));
           
           setTimeout(() => {
               p.remove();
               if (hiddenContainer.parentNode) {
                 document.body.removeChild(hiddenContainer);
               }
           }, 100);
        };
      }, hiddenContainer);
    },
    getCanvas: () => {
       return containerRef.current?.querySelector('canvas') as HTMLCanvasElement;
    }
  }));

  useEffect(() => {
    const p5_GlobalRef = (window as any).p5;
    if (!p5_GlobalRef) return;

    const sketch = (p: any) => {
      p.setup = () => {
        const renderer = p.createCanvas(CONFIG.width, CONFIG.height);
        p.pixelDensity(1);
        renderer.parent(containerRef.current!);
      };

      p.draw = () => {
        const s = stateRef.current;
        renderScene(p, {
            layers: s.layers,
            direction: s.direction,
            spread: s.spreadAngle,
            corner: s.corner,
            isDarkMode: s.isDarkMode,
            progress: s.animationProgress,
            animMode: s.animationMode,
            easeIn: s.easeIn,
            easeOut: s.easeOut,
            outlineMode: s.outlineMode,
            drawDirection: s.drawDirection,
            strokeWeight: s.strokeWeight
        });
      };
    };

    p5InstanceRef.current = new p5_GlobalRef(sketch);

    return () => {
      if (p5InstanceRef.current) {
        p5InstanceRef.current.remove();
      }
    };
  }, []); 

  return (
    <div className={`flex-1 flex justify-center items-center relative overflow-hidden ${isDarkMode ? 'bg-[#27272a]' : 'bg-gray-100'}`}>
        <div ref={containerRef} className={`shadow-2xl ${isDarkMode ? 'shadow-black ring-white/10' : 'shadow-zinc-400 ring-black/10'} ring-1 transition-all duration-300`} />
    </div>
  );
});

Canvas.displayName = 'Canvas';

export default Canvas;