import React, { useRef } from 'react';
import { X, Eye, EyeOff, Copy, ChevronDown, ChevronRight, GripVertical, PaintBucket, Lock, Unlock } from 'lucide-react';
import { Layer, RadialLayer, WedgeLayer, CroppedRadialLayer } from '../types';
import { CONFIG, WEDGE_COUNTS } from '../constants';
import { Slider } from './Slider';

interface LayerCardProps {
  layer: Layer;
  index: number;
  isExpanded: boolean;
  onToggleExpand: (id: number) => void;
  onUpdate: (id: number, updates: Partial<Layer>) => void;
  onRemove: (id: number) => void;
  onDuplicate: (id: number) => void;
  
  // DnD Props
  isDraggable?: boolean;
  onDragStart?: (e: React.DragEvent, index: number) => void;
  onDragEnter?: (e: React.DragEvent, index: number) => void;
  onDragEnd?: (e: React.DragEvent) => void;
}

export const LayerCard: React.FC<LayerCardProps> = ({ 
  layer, 
  index,
  isExpanded,
  onToggleExpand,
  onUpdate, 
  onRemove, 
  onDuplicate,
  isDraggable,
  onDragStart,
  onDragEnter,
  onDragEnd
}) => {
  const cardRef = useRef<HTMLDivElement>(null);

  const renderControls = () => {
    let controls = null;

    if (layer.type === 'radial') {
       const l = layer as RadialLayer;
       controls = (
          <>
            <Slider
              label="Inner Radius"
              min={0}
              max={400}
              value={l.rInner}
              onChange={(v) => onUpdate(l.id, { rInner: v })}
            />
            <Slider
              label="Outer Radius"
              min={0}
              max={600}
              value={l.rOuter}
              onChange={(v) => onUpdate(l.id, { rOuter: v })}
            />
          </>
       );
    } else if (layer.type === 'wedge') {
        const l = layer as WedgeLayer;
        controls = (
          <>
             <Slider
              label="Inner Radius"
              min={0}
              max={800}
              value={l.rInner}
              onChange={(v) => onUpdate(l.id, { rInner: v })}
            />
             <Slider
              label="Outer Radius"
              min={0}
              max={800}
              value={l.rOuter}
              onChange={(v) => onUpdate(l.id, { rOuter: v })}
            />
          </>
        );
    } else if (layer.type === 'cropped-radial') {
        const l = layer as CroppedRadialLayer;
        const currentCount = CONFIG.lineCounts[l.countIndex];
        controls = (
          <>
             <Slider
              label="Inner Radius"
              min={0}
              max={800}
              value={l.rInner}
              onChange={(v) => onUpdate(l.id, { rInner: v })}
            />
             <Slider
              label="Outer Radius"
              min={0}
              max={1200}
              value={l.rOuter}
              onChange={(v) => onUpdate(l.id, { rOuter: v })}
            />
            <Slider
              label="Edge Offset"
              min={0}
              max={Math.min(20, currentCount)}
              step={1}
              value={l.startOffset}
              displayValue={`${l.startOffset} lines`}
              onChange={(v) => onUpdate(l.id, { startOffset: v })}
            />
          </>
        );
    }

    return (
        <>
            {controls}
            
            {/* Toggles Group */}
            <div className="flex gap-2 mb-3 mt-4">
                {/* Outline Toggle */}
                <div 
                    className="flex-1 flex flex-col justify-center items-center p-2 rounded bg-zinc-800/50 border border-white/5 cursor-pointer hover:bg-zinc-800 transition-colors"
                    onClick={() => onUpdate(layer.id, { outline: !layer.outline })}
                >
                    <div className="flex items-center gap-2 mb-2 w-full justify-between px-1">
                        <span className="font-mono text-[10px] text-text-muted uppercase">Outline</span>
                    </div>
                    <div className={`w-8 h-4 rounded-full relative transition-colors ${layer.outline ? 'bg-accent' : 'bg-zinc-700'}`}>
                        <div className={`absolute top-0.5 left-0.5 w-3 h-3 bg-white rounded-full transition-transform ${layer.outline ? 'translate-x-4' : 'translate-x-0'}`} />
                    </div>
                </div>

                {/* Fill Toggle */}
                <div 
                    className="flex-1 flex flex-col justify-center items-center p-2 rounded bg-zinc-800/50 border border-white/5 cursor-pointer hover:bg-zinc-800 transition-colors"
                    onClick={() => onUpdate(layer.id, { fill: !layer.fill })}
                >
                    <div className="flex items-center gap-2 mb-2 w-full justify-between px-1">
                        <span className="font-mono text-[10px] text-text-muted uppercase">Fill</span>
                        {layer.fill && <PaintBucket size={10} className="text-text-muted" />}
                    </div>
                    <div className={`w-8 h-4 rounded-full relative transition-colors ${layer.fill ? 'bg-accent' : 'bg-zinc-700'}`}>
                         <div className={`absolute top-0.5 left-0.5 w-3 h-3 bg-white rounded-full transition-transform ${layer.fill ? 'translate-x-4' : 'translate-x-0'}`} />
                    </div>
                </div>

                {/* Line Limit Toggle - Keeps UI but effectively disabled as max is now low */}
                <div 
                    className="flex-1 flex flex-col justify-center items-center p-2 rounded bg-zinc-800/50 border border-white/5 cursor-pointer hover:bg-zinc-800 transition-colors opacity-50 pointer-events-none"
                    title="Max limit reached"
                >
                    <div className="flex items-center gap-2 mb-2 w-full justify-between px-1">
                        <span className="font-mono text-[10px] text-text-muted uppercase">Max Limit</span>
                    </div>
                    <div className={`flex items-center justify-center h-4`}>
                         <div className="flex items-center gap-1 text-text-muted">
                            <Lock size={12} />
                            <span className="text-[9px] font-bold">Max</span>
                        </div>
                    </div>
                </div>
            </div>
        </>
    );
  };

  const countArray = layer.type === 'wedge' ? WEDGE_COUNTS : CONFIG.lineCounts;
  
  // Enforce Specific Max Constraints
  let allowedMaxIndex = countArray.length - 1;
  if (layer.type === 'cropped-radial') {
      // Limit Cropped Radial to 32 lines
      // CONFIG.lineCounts: [4, 8, 12, 16, 24, 32, 48]
      // Index 5 is 32
      allowedMaxIndex = 5;
  }

  // Ensure current index is valid if we switched types or reduced array size
  const safeCountIndex = Math.min(layer.countIndex, allowedMaxIndex);

  return (
    <div 
        ref={cardRef}
        className="bg-[#202023] border border-border rounded-md overflow-hidden mb-3 animate-in fade-in slide-in-from-left-2 duration-300"
        onDragEnter={(e) => onDragEnter && onDragEnter(e, index)}
        onDragOver={(e) => e.preventDefault()} // Necessary for drop
    >
      <div 
        className="flex items-center justify-between px-2 py-2.5 bg-[#27272a] border-b border-border select-none"
      >
        <div className="flex items-center gap-2 flex-1 cursor-pointer" onClick={() => onToggleExpand(layer.id)}>
             {/* Drag Handle */}
            <div 
                className="cursor-grab text-zinc-600 hover:text-zinc-400 active:cursor-grabbing p-1"
                draggable={isDraggable}
                onDragStart={(e) => {
                    if (cardRef.current) {
                        e.dataTransfer.setDragImage(cardRef.current, 0, 0);
                    }
                    if (onDragStart) onDragStart(e, index);
                }}
                onDragEnd={onDragEnd}
                onClick={(e) => e.stopPropagation()}
                onMouseDown={(e) => e.stopPropagation()} 
            >
                <GripVertical size={14} />
            </div>

            <span className="text-text-muted">
              {isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
            </span>
            <span className="font-mono text-[9px] px-1.5 py-0.5 rounded bg-border text-text-muted uppercase tracking-wider">
                {layer.type.replace('cropped-radial', 'crop')}
            </span>
            <span className="text-xs font-semibold text-text-main">Layer {index + 1}</span>
        </div>

        <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
            <button 
                onClick={() => onDuplicate(layer.id)}
                className="text-text-muted hover:text-text-main transition-colors"
                title="Duplicate Layer"
            >
                <Copy size={14} />
            </button>
            <button 
                onClick={() => onUpdate(layer.id, { visible: !layer.visible })}
                className="text-text-muted hover:text-text-main transition-colors"
                title={layer.visible ? "Hide" : "Show"}
            >
                {layer.visible ? <Eye size={14} /> : <EyeOff size={14} />}
            </button>
            <button 
                onClick={() => onRemove(layer.id)}
                className="text-text-muted hover:text-red-400 transition-colors"
                title="Remove Layer"
            >
                <X size={14} />
            </button>
        </div>
      </div>
      
      {isExpanded && (
        <div className="p-3">
          <Slider
              label="Density"
              min={0}
              max={allowedMaxIndex}
              value={safeCountIndex}
              displayValue={`${countArray[safeCountIndex]} lines`}
              onChange={(v) => onUpdate(layer.id, { countIndex: v })}
          />
          {renderControls()}
        </div>
      )}
    </div>
  );
};