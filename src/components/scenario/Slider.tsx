"use client";

export function Slider({
  label,
  value,
  min,
  max,
  step,
  unit,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  unit: string;
  onChange: (v: number) => void;
}) {
  const pct = ((value - min) / (max - min)) * 100;
  return (
    <div>
      <div className="flex items-center justify-between">
        <label className="text-xs text-slate-400">{label}</label>
        <span className="font-mono text-xs font-semibold text-neon">
          {value}
          <span className="ml-0.5 text-slate-500">{unit}</span>
        </span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="range-input mt-2 h-1.5 w-full cursor-pointer appearance-none rounded-full bg-white/10"
        style={{
          background: `linear-gradient(to right, #39ff8b ${pct}%, rgba(255,255,255,0.1) ${pct}%)`,
        }}
      />
      <style jsx>{`
        .range-input::-webkit-slider-thumb {
          appearance: none;
          height: 14px;
          width: 14px;
          border-radius: 9999px;
          background: #39ff8b;
          box-shadow: 0 0 10px rgba(57, 255, 139, 0.6);
          cursor: pointer;
        }
        .range-input::-moz-range-thumb {
          height: 14px;
          width: 14px;
          border: none;
          border-radius: 9999px;
          background: #39ff8b;
          box-shadow: 0 0 10px rgba(57, 255, 139, 0.6);
          cursor: pointer;
        }
      `}</style>
    </div>
  );
}
