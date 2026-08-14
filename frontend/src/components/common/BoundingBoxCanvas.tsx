import React, { useState } from 'react';
import { normalizeBoundingBox, BoundingBox } from '../../utils/validators';

interface BoundingBoxCanvasProps {
  imageSrc: string;
  boxes?: BoundingBox[];
  className?: string;
}

export const BoundingBoxCanvas: React.FC<BoundingBoxCanvasProps> = ({
  imageSrc,
  boxes = [],
  className = ''
}) => {
  const [hoveredBox, setHoveredBox] = useState<BoundingBox | null>(null);

  const getAnomalyColor = (type?: string) => {
    switch (type) {
      case 'FONT_MISMATCH':
        return { border: 'border-red-500', bg: 'bg-red-500/20', text: 'text-red-300' };
      case 'CLOCK_PARADOX':
        return { border: 'border-amber-500', bg: 'bg-amber-500/20', text: 'text-amber-300' };
      case 'COMPRESSION_ELA':
        return { border: 'border-purple-500', bg: 'bg-purple-500/20', text: 'text-purple-300' };
      case 'LOGO_BLUR':
        return { border: 'border-blue-500', bg: 'bg-blue-500/20', text: 'text-blue-300' };
      default:
        return { border: 'border-red-500', bg: 'bg-red-500/20', text: 'text-red-300' };
    }
  };

  return (
    <div className={`relative inline-block overflow-hidden rounded-xl bg-slate-950 border border-slate-800 ${className}`}>
      <img
        src={imageSrc}
        alt="Receipt Forensics"
        className="w-full h-auto object-contain block max-h-[500px]"
      />

      {/* Bounding Box Overlays */}
      {boxes.map((rawBox, idx) => {
        const box = normalizeBoundingBox(rawBox);
        const top = (box.ymin / 1000) * 100;
        const left = (box.xmin / 1000) * 100;
        const width = ((box.xmax - box.xmin) / 1000) * 100;
        const height = ((box.ymax - box.ymin) / 1000) * 100;
        const colors = getAnomalyColor(box.anomalyType);

        return (
          <div
            key={`box-${idx}`}
            onMouseEnter={() => setHoveredBox(box)}
            onMouseLeave={() => setHoveredBox(null)}
            style={{
              top: `${top}%`,
              left: `${left}%`,
              width: `${width}%`,
              height: `${height}%`
            }}
            className={`absolute border-2 ${colors.border} ${colors.bg} rounded cursor-pointer transition-all duration-150 animate-pulse`}
          >
            <span
              className={`absolute -top-5 left-0 px-1.5 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-slate-900/90 ${colors.text} border ${colors.border} shadow whitespace-nowrap`}
            >
              {box.label || box.anomalyType || 'Anomaly'}
            </span>
          </div>
        );
      })}

      {hoveredBox && (
        <div className="absolute bottom-2 left-2 right-2 p-2 rounded-lg bg-slate-900/95 border border-red-500/40 text-xs text-slate-200 shadow-xl backdrop-blur-md">
          <span className="font-bold text-red-400">⚠️ Bất Thường Phát Hiện: </span>
          <span>{hoveredBox.label} ({hoveredBox.anomalyType || 'FORENSIC_FLAG'})</span>
        </div>
      )}
    </div>
  );
};
