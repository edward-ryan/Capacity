import React from 'react';

interface SliderProps {
  label: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  displayValue?: string;
  onChange: (val: number) => void;
}

export const Slider: React.FC<SliderProps> = ({
  label,
  value,
  min,
  max,
  step = 1,
  displayValue,
  onChange,
}) => {
  return (
    <div className="mb-3">
      <div className="flex justify-between items-center mb-1.5 font-mono text-[11px] text-text-muted">
        <span>{label}</span>
        <span className="text-text-main">{displayValue ?? value}</span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-full h-1 bg-zinc-800 rounded-lg appearance-none cursor-pointer focus:outline-none focus:ring-1 focus:ring-accent [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-3 [&::-webkit-slider-thumb]:h-3 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-accent"
      />
    </div>
  );
};