
import React, { useState, useRef, useEffect } from 'react';
import { Plus, Download, ArrowDown, ArrowUp, ArrowRight, ArrowLeft, ArrowUpLeft, ArrowUpRight, ArrowDownLeft, ArrowDownRight, Sun, Moon, Play, Square, Video, Settings2, Shuffle, PanelRightClose, PanelRightOpen, RotateCcw, FileImage, Loader2 } from 'lucide-react';
import Canvas, { CanvasHandle } from './components/Canvas';
import { LayerCard } from './components/LayerCard';
import { Layer, PatternMode, Direction, Corner, AnimationMode, OutlineMode, DrawDirection } from './types';
import { createLayer, SPREAD_OPTIONS, CONFIG, WEDGE_COUNTS } from './constants';
import { Slider } from './components/Slider';

/**
 * Utility to generate the standardized filename
 * Format: Capacity_Pattern_PATTERNTYPE_YYMMDD-HHMM
 */
export const getPatternFileName = (patternType: PatternMode, extension: string) => {
  const now = new Date();
  const yy = String(now.getFullYear()).slice(-2);
  const mm = String(now.getMonth() + 1).padStart(2, '0');
  const dd = String(now.getDate()).padStart(2, '0');
  const hh = String(now.getHours()).padStart(2, '0');
  const mins = String(now.getMinutes()).padStart(2, '0');
  
  const typeMap: Record<PatternMode, string> = {
    'radial': 'RADIAL',
    'wedge': 'WEDGE',
    'cropped-radial': 'CROPPED'
  };
  
  const typeStr = typeMap[patternType] || 'PATTERN';
  // Note: Colons are usually illegal in filenames on Windows, using HHMM instead of HH:MM for safety.
  return `Capacity_Pattern_${typeStr}_${yy}${mm}${dd}-${hh}${mins}.${extension}`;
};

const App: React.FC = () => {
  const [activeTab, setActiveTab] = useState<PatternMode>('radial');
  const [direction, setDirection] = useState<Direction>('T2B');
  const [spreadAngle, setSpreadAngle] = useState<number>(45);
  const [corner, setCorner] = useState<Corner>('TL');
  
  const initialLayer = createLayer('radial');
  const [layers, setLayers] = useState<Layer[]>([initialLayer]);
  const [expandedLayerId, setExpandedLayerId] = useState<number | null>(initialLayer.id);

  const canvasRef = useRef<CanvasHandle>(null);

  const [isDarkMode, setIsDarkMode] = useState(true);
  const [isRightPanelOpen, setIsRightPanelOpen] = useState(false);
  
  const [duration, setDuration] = useState(4);
  const [isPlaying, setIsPlaying] = useState(false);
  const [progress, setProgress] = useState(1);
  const [animMode, setAnimMode] = useState<AnimationMode>('linear');
  
  const [easeIn, setEaseIn] = useState(0.5);
  const [easeOut, setEaseOut] = useState(0.5);
  
  const [outlineMode, setOutlineMode] = useState<OutlineMode>('draw');
  const [drawDirection, setDrawDirection] = useState<DrawDirection>('outwards');

  const [isExportingGIF, setIsExportingGIF] = useState(false);
  const [exportProgress, setExportProgress] = useState(0);
  const [exportStatus, setExportStatus] = useState<'Capturing' | 'Converting' | 'Saving'>('Capturing');

  const animationReqRef = useRef<number>(0);
  const startTimeRef = useRef<number>(0);
  const isRecordingRef = useRef(false);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const recordedChunksRef = useRef<Blob[]>([]);

  const dragItem = useRef<number | null>(null);
  const dragOverItem = useRef<number | null>(null);

  // Library Readiness check
  const [gifLibReady, setGifLibReady] = useState(false);
  useEffect(() => {
    const check = () => {
      if ((window as any).GIF) {
        setGifLibReady(true);
      } else {
        setTimeout(check, 500);
      }
    };
    check();
  }, []);

  const switchTab = (mode: PatternMode) => {
    setActiveTab(mode);
    const newLayer = createLayer(mode);
    setLayers([newLayer]);
    setExpandedLayerId(newLayer.id);
  };

  const addLayer = () => {
    const newLayer = createLayer(activeTab);
    newLayer.id = Date.now() + Math.random(); 
    setLayers(prev => [...prev, newLayer]);
    setExpandedLayerId(newLayer.id);
  };

  const resetComposition = () => {
      const newLayer = createLayer(activeTab);
      setLayers([newLayer]);
      setExpandedLayerId(newLayer.id);
  };

  const generateRandomComposition = () => {
    const newLayers: Layer[] = [];
    const count = 4;
    const baseTime = Date.now();
    for (let i = 0; i < count; i++) {
        const l = createLayer(activeTab);
        l.id = baseTime + i + Math.random(); 
        newLayers.push(l);
    }
    const numFills = Math.floor(Math.random() * 3);
    for (let i = 0; i < count; i++) {
        newLayers[i].fill = i < numFills;
    }
    const indices = [0, 1, 2, 3].sort(() => Math.random() - 0.5);
    const outlineIndices = indices.slice(0, 2);
    for (let i = 0; i < count; i++) {
        newLayers[i].outline = outlineIndices.includes(i);
    }
    const countArray = activeTab === 'wedge' ? WEDGE_COUNTS : CONFIG.lineCounts;
    let maxIdxLimit = countArray.length - 1;
    if (activeTab === 'cropped-radial') maxIdxLimit = 5;
    const usedCounts: number[] = [];
    let maxLimitUsed = false;
    for (let i = 0; i < count; i++) {
        let candidates: number[] = [];
        for (let idx = 0; idx <= maxIdxLimit; idx++) {
             if (idx === maxIdxLimit && maxLimitUsed) continue;
             const existing = usedCounts.filter(c => c === idx).length;
             if (existing >= 2) continue;
             candidates.push(idx);
        }
        if (candidates.length === 0) candidates = [0];
        const chosen = candidates[Math.floor(Math.random() * candidates.length)];
        newLayers[i].countIndex = chosen;
        usedCounts.push(chosen);
        // Fixed: chosen is a number, maxLimitUsed is a boolean. Comparison should be with maxIdxLimit to track max density usage.
        if (chosen === maxIdxLimit) maxLimitUsed = true;
    }
    const maxOuterIdx = Math.floor(Math.random() * count);
    const zeroInnerIdx = Math.floor(Math.random() * count);
    for (let i = 0; i < count; i++) {
        const l = newLayers[i];
        let maxR = 0;
        if (l.type === 'radial') maxR = 600; 
        else if (l.type === 'wedge') maxR = 800;
        else if (l.type === 'cropped-radial') maxR = 1200;
        if (i === zeroInnerIdx) l.rInner = 0;
        else l.rInner = Math.floor(Math.random() * (maxR * 0.4));
        if (i === maxOuterIdx) l.rOuter = maxR;
        else {
            const minOuter = l.rInner + 20;
            l.rOuter = minOuter + Math.floor(Math.random() * (maxR - minOuter));
        }
        if (l.type === 'cropped-radial') l.startOffset = Math.floor(Math.random() * 5);
    }
    setExpandedLayerId(newLayers[0].id);
    setLayers(newLayers);
  };

  const duplicateLayer = (id: number) => {
    const layerToCopy = layers.find(l => l.id === id);
    if (layerToCopy) {
      const newLayer = { ...layerToCopy, id: Date.now() + Math.random() };
      setLayers(prev => [...prev, newLayer]);
      setExpandedLayerId(newLayer.id);
    }
  };

  const removeLayer = (id: number) => {
    setLayers(prev => prev.filter(l => l.id !== id));
  };

  const updateLayer = (id: number, updates: Partial<Layer>) => {
    setLayers(prev => prev.map(l => l.id === id ? { ...l, ...updates } as Layer : l));
  };

  const handleToggleExpand = (id: number) => {
      setExpandedLayerId(prev => prev === id ? null : id);
  };

  const handleDownloadSVG = () => {
    canvasRef.current?.downloadSVG();
  };

  const handleExportGIF = async () => {
    const canvas = canvasRef.current?.getCanvas();
    const gif_Maker = (window as any).GIF;
    
    if (!canvas || !gif_Maker) {
      alert("GIF Engine not ready.");
      return;
    }

    setIsExportingGIF(true);
    setExportStatus('Capturing');
    setExportProgress(0);

    // Stop existing play
    if (isPlaying) {
      cancelAnimationFrame(animationReqRef.current);
      setIsPlaying(false);
    }

    const frameRate = 12; 
    const totalFrames = Math.ceil(duration * frameRate);
    const capturedFrames: HTMLCanvasElement[] = [];
    const targetWidth = canvas.width;
    const targetHeight = canvas.height;

    // Capture Loop
    for (let i = 0; i < totalFrames; i++) {
      const p = i / (totalFrames - 1);
      setProgress(p);
      setExportProgress(Math.floor(p * 50)); 
      
      await new Promise(resolve => requestAnimationFrame(resolve));
      await new Promise(resolve => setTimeout(resolve, 80)); 

      const offscreen = document.createElement('canvas');
      offscreen.width = targetWidth; 
      offscreen.height = targetHeight;
      const ctx = offscreen.getContext('2d');
      if (ctx) {
        ctx.drawImage(canvas, 0, 0, canvas.width, canvas.height, 0, 0, targetWidth, targetHeight);
        capturedFrames.push(offscreen);
      }
    }

    setExportStatus('Converting');
    setExportProgress(55);

    try {
      const workerUrl = 'https://cdnjs.cloudflare.com/ajax/libs/gif.js/0.2.0/gif.worker.js';
      const response = await fetch(workerUrl);
      const blob = await response.blob();
      const localWorkerUrl = URL.createObjectURL(blob);

      const gif = new gif_Maker({
        workers: 4,
        quality: 5, 
        width: targetWidth,
        height: targetHeight,
        workerScript: localWorkerUrl
      });

      capturedFrames.forEach(frame => {
        gif.addFrame(frame, { delay: 1000 / frameRate, copy: true });
      });

      gif.on('progress', (p: number) => {
        setExportProgress(Math.floor(55 + (p * 45)));
      });

      gif.on('finished', (gifBlob: Blob) => {
        setExportStatus('Saving');
        const url = URL.createObjectURL(gifBlob);
        const link = document.createElement('a');
        link.href = url;
        link.download = getPatternFileName(activeTab, 'gif');
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);

        URL.revokeObjectURL(localWorkerUrl);
        URL.revokeObjectURL(url);

        setTimeout(() => {
          setIsExportingGIF(false);
          setProgress(1);
        }, 800);
      });

      gif.render();
    } catch (err) {
      console.error(err);
      alert("Conversion failed.");
      setIsExportingGIF(false);
    }
  };

  const animate = (timestamp: number) => {
    if (!startTimeRef.current) startTimeRef.current = timestamp;
    const elapsed = (timestamp - startTimeRef.current) / 1000;
    let newProgress = Math.min(elapsed / duration, 1);
    setProgress(newProgress);
    if (newProgress < 1) {
      animationReqRef.current = requestAnimationFrame(animate);
    } else {
      setIsPlaying(false);
      if (isRecordingRef.current && mediaRecorderRef.current) {
         mediaRecorderRef.current.stop();
         isRecordingRef.current = false;
      }
    }
  };

  const togglePlay = () => {
    if (isPlaying) {
      cancelAnimationFrame(animationReqRef.current);
      setIsPlaying(false);
      setProgress(1); 
    } else {
      setIsPlaying(true);
      setProgress(0);
      startTimeRef.current = 0;
      animationReqRef.current = requestAnimationFrame(animate);
    }
  };

  const handleExportVideo = () => {
    const canvas = canvasRef.current?.getCanvas();
    if (!canvas) return;
    if (isPlaying) cancelAnimationFrame(animationReqRef.current);
    setIsPlaying(false);
    setProgress(0);
    const stream = (canvas as any).captureStream(30); 
    const mimeCandidates = ["video/mp4; codecs=avc1.42E01E", "video/mp4", "video/webm; codecs=vp9", "video/webm"];
    let selectedMimeType = "";
    for (const type of mimeCandidates) {
        if (MediaRecorder.isTypeSupported(type)) {
            selectedMimeType = type;
            break;
        }
    }
    if (!selectedMimeType) {
        alert("Video capture not supported in this browser.");
        return;
    }
    try {
        const recorder = new MediaRecorder(stream, { mimeType: selectedMimeType, videoBitsPerSecond: 8000000 });
        mediaRecorderRef.current = recorder;
        recordedChunksRef.current = [];
        isRecordingRef.current = true;
        recorder.ondataavailable = (event) => {
          if (event.data.size > 0) recordedChunksRef.current.push(event.data);
        };
        recorder.onstop = () => {
          const blob = new Blob(recordedChunksRef.current, { type: selectedMimeType });
          const url = URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url;
          a.download = getPatternFileName(activeTab, selectedMimeType.includes('mp4') ? 'mp4' : 'webm');
          a.click();
        };
        recorder.start();
        setIsPlaying(true);
        startTimeRef.current = 0;
        animationReqRef.current = requestAnimationFrame(animate);
    } catch (e) { console.error(e); }
  };

  const handleDragStart = (e: React.DragEvent, index: number) => {
    dragItem.current = index;
    e.dataTransfer.effectAllowed = "move";
  };
  const handleDragEnter = (e: React.DragEvent, index: number) => {
    dragOverItem.current = index;
    if (dragItem.current === null || dragItem.current === dragOverItem.current) return;
    const copyListItems = [...layers];
    const dragItemContent = copyListItems[dragItem.current];
    copyListItems.splice(dragItem.current, 1);
    copyListItems.splice(dragOverItem.current, 0, dragItemContent);
    dragItem.current = index;
    setLayers(copyListItems);
  };
  const handleDragEnd = () => {
    dragItem.current = null;
    dragOverItem.current = null;
  };

  return (
    <div className="flex h-screen w-screen overflow-hidden">
      {/* Left Panel */}
      <div className="w-[340px] bg-panel border-r border-border flex flex-col shadow-2xl z-10 shrink-0">
        <div className="p-5 border-b border-border">
          <div className="flex justify-between items-start mb-2">
            <h1 className="font-gothic text-2xl leading-[1.1] tracking-tight text-white uppercase max-w-[180px]">
              Capacity Pattern Generator
            </h1>
            <button onClick={() => setIsDarkMode(!isDarkMode)} className="text-text-muted hover:text-white transition-colors pt-1">
               {isDarkMode ? <Sun size={18} /> : <Moon size={18} />}
            </button>
          </div>
        </div>

        {activeTab === 'wedge' && (
          <div className="px-5 py-3 border-b border-border bg-zinc-900/50">
             <div className="mb-3">
               <span className="text-[10px] font-mono text-text-muted uppercase tracking-wide block mb-2">Flow Direction</span>
               <div className="flex gap-2 bg-black/20 p-1 rounded-md">
                  {(['T2B', 'B2T', 'L2R', 'R2L'] as Direction[]).map(d => (
                     <button key={d} onClick={() => setDirection(d)} className={`flex-1 p-1.5 rounded flex justify-center ${direction === d ? 'bg-accent text-white' : 'text-text-muted hover:bg-white/5'}`}>
                        {d === 'T2B' && <ArrowDown size={14} />}
                        {d === 'B2T' && <ArrowUp size={14} />}
                        {d === 'L2R' && <ArrowRight size={14} />}
                        {d === 'R2L' && <ArrowLeft size={14} />}
                     </button>
                  ))}
               </div>
             </div>
             <div>
               <div className="flex items-center justify-between mb-2">
                 <span className="text-[10px] font-mono text-text-muted uppercase tracking-wide">Master Spread</span>
                 <span className="text-[10px] font-mono text-accent">{spreadAngle}°</span>
               </div>
               <div className="flex gap-1 bg-black/20 p-1 rounded-md">
                  {SPREAD_OPTIONS.map(opt => (
                    <button key={opt} onClick={() => setSpreadAngle(opt)} className={`flex-1 text-[10px] py-1.5 rounded ${spreadAngle === opt ? 'bg-accent text-white font-bold' : 'text-text-muted hover:text-white'}`}>
                      {opt}
                    </button>
                  ))}
               </div>
             </div>
          </div>
        )}

        {activeTab === 'cropped-radial' && (
          <div className="px-5 py-3 border-b border-border bg-zinc-900/50">
             <span className="text-[10px] font-mono text-text-muted uppercase tracking-wide block mb-2">Origin Point</span>
             <div className="grid grid-cols-4 gap-2 w-full">
                 {(['TL', 'T', 'TR', 'L', 'R', 'BL', 'B', 'BR'] as Corner[]).map(c => (
                   <button key={c} onClick={() => setCorner(c)} className={`p-1.5 rounded flex justify-center items-center ${corner === c ? 'bg-accent text-white' : 'bg-black/20 text-text-muted hover:bg-white/5'}`}>
                     {c === 'TL' && <ArrowUpLeft size={14} />} {c === 'TR' && <ArrowUpRight size={14} />}
                     {c === 'BL' && <ArrowDownLeft size={14} />} {c === 'BR' && <ArrowDownRight size={14} />}
                     {c === 'T' && <ArrowUp size={14} />} {c === 'B' && <ArrowDown size={14} />}
                     {c === 'L' && <ArrowLeft size={14} />} {c === 'R' && <ArrowRight size={14} />}
                   </button>
                 ))}
             </div>
          </div>
        )}

        <div className="flex border-b border-border">
          {(['radial', 'wedge', 'cropped-radial'] as PatternMode[]).map((mode) => (
            <button key={mode} onClick={() => switchTab(mode)} className={`flex-1 py-3 bg-transparent border-0 border-b-2 font-mono text-[10px] uppercase transition-all ${activeTab === mode ? 'border-accent text-accent bg-accent/5' : 'border-transparent text-text-muted hover:text-text-main'}`}>
              {mode.replace('-', ' ')}
            </button>
          ))}
        </div>

        <div className="flex-1 overflow-y-auto p-4 scrollbar-thin scrollbar-thumb-zinc-700">
          {layers.map((layer, index) => (
            <LayerCard key={layer.id} index={index} layer={layer} isExpanded={expandedLayerId === layer.id} onToggleExpand={handleToggleExpand} onUpdate={updateLayer} onRemove={removeLayer} onDuplicate={duplicateLayer} isDraggable={true} onDragStart={handleDragStart} onDragEnter={handleDragEnter} onDragEnd={handleDragEnd} />
          ))}
        </div>

        <div className="p-4 border-t border-border bg-[#1c1c1f]">
            <div className="flex gap-2">
                <button onClick={addLayer} className="flex-1 flex items-center justify-center gap-2 bg-zinc-800 hover:bg-zinc-700 text-text-main text-[11px] font-mono uppercase py-3 rounded transition-colors border border-zinc-700"><Plus size={14} strokeWidth={3} />Add</button>
                <button onClick={generateRandomComposition} className="flex items-center justify-center gap-2 bg-zinc-800 hover:bg-zinc-700 text-text-main py-3 px-3 rounded transition-colors border border-zinc-700" title="Randomize"><Shuffle size={14} /></button>
                <button onClick={resetComposition} className="flex items-center justify-center gap-2 bg-zinc-800 hover:bg-zinc-700 text-text-main py-3 px-3 rounded transition-colors border border-zinc-700" title="Reset"><RotateCcw size={14} /></button>
            </div>
        </div>
      </div>

      {/* Center Panel */}
      <div className="flex-1 flex flex-col relative min-w-0">
          <Canvas layers={layers} direction={direction} spreadAngle={spreadAngle} corner={corner} isDarkMode={isDarkMode} animationProgress={progress} animationMode={animMode} easeIn={easeIn} easeOut={easeOut} outlineMode={outlineMode} drawDirection={drawDirection} ref={canvasRef} />
          {!isRightPanelOpen && (
            <button onClick={() => setIsRightPanelOpen(true)} className="absolute top-5 right-5 z-20 w-8 h-8 rounded-md bg-panel border border-border flex items-center justify-center text-text-muted hover:text-white transition-colors shadow-lg"><Settings2 size={16} /></button>
          )}
          {isExportingGIF && (
            <div className="absolute inset-0 bg-black/60 z-50 flex items-center justify-center backdrop-blur-sm">
                <div className="bg-panel border border-border p-8 rounded-xl shadow-2xl flex flex-col items-center gap-6 max-w-sm w-full">
                    <div className="relative">
                        <Loader2 className="animate-spin text-accent" size={48} />
                        <span className="absolute inset-0 flex items-center justify-center text-[10px] font-mono font-bold">{exportProgress}%</span>
                    </div>
                    <div className="text-center">
                        <h3 className="text-sm font-mono uppercase font-bold text-white mb-2">{exportStatus} GIF</h3>
                        <p className="text-xs text-text-muted leading-relaxed">
                          {exportStatus === 'Capturing' && "Recoring canvas snapshots at full resolution..."}
                          {exportStatus === 'Converting' && "Applying high-quality compression..."}
                          {exportStatus === 'Saving' && "Preparing your file for download..."}
                        </p>
                    </div>
                    <div className="w-full bg-black/40 h-1.5 rounded-full overflow-hidden">
                        <div className="bg-accent h-full transition-all duration-300" style={{ width: `${exportProgress}%` }} />
                    </div>
                </div>
            </div>
          )}
      </div>

      {/* Right Panel */}
      <div className={`${isRightPanelOpen ? 'w-[300px] border-l' : 'w-0 border-l-0'} bg-panel border-border flex flex-col shadow-2xl z-10 transition-all duration-300 overflow-hidden`}>
          <div className="w-[300px] flex flex-col h-full">
              <div className="p-5 border-b border-border flex justify-between items-center bg-[#1c1c1f]">
                  <h2 className="text-xs font-mono uppercase tracking-wider text-text-main font-bold">Export & Motion</h2>
                  <button onClick={() => setIsRightPanelOpen(false)} className="text-text-muted hover:text-white"><PanelRightClose size={16} /></button>
              </div>

              <div className="flex-1 overflow-y-auto p-5 scrollbar-thin scrollbar-thumb-zinc-700">
                  <div className="mb-8">
                     <span className="text-[10px] font-mono text-text-muted uppercase tracking-wide block mb-3">Motion Mode</span>
                     <div className="flex flex-col gap-4 mb-4">
                        <div>
                             <h3 className="text-[9px] font-mono text-zinc-500 uppercase tracking-widest mb-2 pl-1">Growth</h3>
                             <div className="flex flex-col gap-1.5">
                               {(['linear', 'staccato', 'spiral', 'random'] as AnimationMode[]).map(mode => (
                                 <button key={mode} onClick={() => setAnimMode(mode)} className={`flex items-center justify-between px-3 py-2 rounded transition-all text-[11px] uppercase font-mono border ${animMode === mode ? 'bg-accent/10 border-accent text-accent' : 'bg-black/20 border-transparent text-text-muted hover:text-white hover:bg-white/5'}`}>
                                     <span>{mode}</span>{animMode === mode && <div className="w-1.5 h-1.5 rounded-full bg-accent" />}
                                 </button>
                               ))}
                             </div>
                        </div>
                        <div>
                             <h3 className="text-[9px] font-mono text-zinc-500 uppercase tracking-widest mb-2 pl-1">Radial Wipe</h3>
                             <div className="flex flex-col gap-1.5">
                               {[{ id: 'wipe', label: 'Single' }, { id: 'two-way-wipe', label: 'Two Way' }, { id: 'random-wipe', label: 'Random' }].map(item => (
                                 <button key={item.id} onClick={() => setAnimMode(item.id as AnimationMode)} className={`flex items-center justify-between px-3 py-2 rounded transition-all text-[11px] uppercase font-mono border ${animMode === item.id ? 'bg-accent/10 border-accent text-accent' : 'bg-black/20 border-transparent text-text-muted hover:text-white hover:bg-white/5'}`}>
                                     <span>{item.label}</span>{animMode === item.id && <div className="w-1.5 h-1.5 rounded-full bg-accent" />}
                                 </button>
                               ))}
                             </div>
                        </div>
                     </div>
                     
                     <span className="text-[10px] font-mono text-text-muted uppercase tracking-wide block mb-3 mt-4">Flow Direction</span>
                     <div className="flex bg-black/20 p-1 rounded mb-4">
                        {(['outwards', 'inwards'] as DrawDirection[]).map(d => (
                            <button key={d} onClick={() => setDrawDirection(d)} className={`flex-1 py-1.5 rounded text-[10px] uppercase font-mono transition-all ${drawDirection === d ? 'bg-zinc-700 text-white shadow-sm' : 'text-text-muted hover:text-white'}`}>{d.replace('s', '')}</button>
                        ))}
                     </div>

                     <span className="text-[10px] font-mono text-text-muted uppercase tracking-wide block mb-3 mt-4">Outline Style</span>
                     <div className="flex bg-black/20 p-1 rounded mb-4">
                        {(['draw', 'expand'] as OutlineMode[]).map(m => (
                            <button key={m} onClick={() => setOutlineMode(m)} className={`flex-1 py-1.5 rounded text-[10px] uppercase font-mono transition-all ${outlineMode === m ? 'bg-zinc-700 text-white shadow-sm' : 'text-text-muted hover:text-white'}`}>{m}</button>
                        ))}
                     </div>
                     
                     <div className="border-t border-white/5 my-4" />
                     <Slider label="Ease In Velocity" min={0} max={1} step={0.1} value={easeIn} onChange={setEaseIn} displayValue={easeIn.toFixed(1)} />
                     <Slider label="Ease Out Velocity" min={0} max={1} step={0.1} value={easeOut} onChange={setEaseOut} displayValue={easeOut.toFixed(1)} />
                     <Slider label="Duration" min={2} max={10} step={0.5} value={duration} onChange={setDuration} displayValue={`${duration}s`} />
                     
                     <button onClick={togglePlay} className={`w-full py-3 rounded flex items-center justify-center gap-2 border ${isPlaying ? 'bg-accent border-accent text-white' : 'bg-black/20 border-border text-text-main hover:bg-zinc-700'}`}>
                        {isPlaying ? <Square size={14} fill="currentColor" /> : <Play size={14} fill="currentColor" />}
                        <span className="text-[11px] font-mono uppercase font-bold">{isPlaying ? 'Stop' : 'Play Preview'}</span>
                     </button>
                  </div>

                  <div className="border-t border-border mb-8" />
                  <span className="text-[10px] font-mono text-text-muted uppercase tracking-wide block mb-4">Export Composition</span>
                  <div className="grid gap-3">
                    <button onClick={handleExportVideo} disabled={isRecordingRef.current || isExportingGIF} className="flex items-center justify-between bg-zinc-800 hover:bg-zinc-700 disabled:opacity-50 text-text-main text-[11px] font-mono uppercase py-3 px-4 rounded transition-colors border border-zinc-700 group">
                        <span className="flex items-center gap-2"><Video size={14} className="group-hover:text-accent" />{isRecordingRef.current ? 'Recording...' : 'Export Video (MP4)'}</span>
                        <ArrowRight size={14} className="opacity-0 group-hover:opacity-100 -translate-x-2 group-hover:translate-x-0 transition-all text-accent" />
                    </button>
                    <button onClick={handleExportGIF} disabled={!gifLibReady || isRecordingRef.current || isExportingGIF} className="flex items-center justify-between bg-zinc-800 hover:bg-zinc-700 disabled:opacity-50 text-text-main text-[11px] font-mono uppercase py-3 px-4 rounded transition-colors border border-zinc-700 group">
                        <span className="flex items-center gap-2"><FileImage size={14} className="group-hover:text-accent" />{!gifLibReady ? 'Loading Module...' : 'Export GIF'}</span>
                        <ArrowRight size={14} className="opacity-0 group-hover:opacity-100 -translate-x-2 group-hover:translate-x-0 transition-all text-accent" />
                    </button>
                    <button onClick={handleDownloadSVG} className="flex items-center justify-between bg-zinc-800 hover:bg-zinc-700 text-text-main text-[11px] font-mono uppercase py-3 px-4 rounded transition-colors border border-zinc-700 group">
                        <span className="flex items-center gap-2"><Download size={14} className="group-hover:text-accent" />Export SVG</span>
                        <ArrowRight size={14} className="opacity-0 group-hover:opacity-100 -translate-x-2 group-hover:translate-x-0 transition-all text-accent" />
                    </button>
                  </div>
              </div>
          </div>
      </div>
    </div>
  );
};

export default App;
