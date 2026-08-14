import React from 'react';
import { RiskLevel } from '@shared';
import { computeRiskDialAngle } from '../../utils/validators';

interface RiskDialProps {
  riskLevel: RiskLevel;
  confidenceScore?: number;
  size?: number;
  showLabels?: boolean;
}

export const RiskDial: React.FC<RiskDialProps> = ({
  riskLevel,
  confidenceScore = 0.95,
  size = 180,
  showLabels = true
}) => {
  const { angleDegrees, colorHex, labelVi } = computeRiskDialAngle(riskLevel, confidenceScore);

  // Center & radius for SVG arc
  const center = size / 2;
  const radius = center - 16;
  const needleLength = radius - 10;

  // Convert degrees (0 to 180) to radians for needle pointer
  // 0 deg = leftmost (180° in standard math / pi radians), 180 deg = rightmost (0° in standard math)
  const rad = Math.PI - (angleDegrees * Math.PI) / 180;
  const needleX = center + needleLength * Math.cos(rad);
  const needleY = center - needleLength * Math.sin(rad);

  return (
    <div className="flex flex-col items-center justify-center select-none">
      <div className="relative" style={{ width: size, height: size * 0.65 }}>
        <svg width={size} height={size * 0.65} viewBox={`0 0 ${size} ${size * 0.65}`} className="overflow-visible">
          <defs>
            <linearGradient id="dialGradient" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="#10B981" />
              <stop offset="40%" stopColor="#F59E0B" />
              <stop offset="75%" stopColor="#EF4444" />
              <stop offset="100%" stopColor="#7F1D1D" />
            </linearGradient>
            <filter id="dialGlow" x="-20%" y="-20%" width="140%" height="140%">
              <feDropShadow dx="0" dy="2" stdDeviation="3" floodColor={colorHex} floodOpacity="0.4" />
            </filter>
          </defs>

          {/* Background Arc */}
          <path
            d={`M ${center - radius} ${center} A ${radius} ${radius} 0 0 1 ${center + radius} ${center}`}
            fill="none"
            stroke="#334155"
            strokeWidth="14"
            strokeLinecap="round"
          />

          {/* Value Gradient Arc */}
          <path
            d={`M ${center - radius} ${center} A ${radius} ${radius} 0 0 1 ${center + radius} ${center}`}
            fill="none"
            stroke="url(#dialGradient)"
            strokeWidth="12"
            strokeLinecap="round"
            opacity="0.85"
          />

          {/* Needle */}
          <line
            x1={center}
            y1={center}
            x2={needleX}
            y2={needleY}
            stroke={colorHex}
            strokeWidth="3.5"
            strokeLinecap="round"
            filter="url(#dialGlow)"
            className="transition-all duration-700 ease-out"
          />

          {/* Center Hub */}
          <circle cx={center} cy={center} r="7" fill={colorHex} />
          <circle cx={center} cy={center} r="3" fill="#ffffff" />
        </svg>

        {/* Confidence Percentage in Center */}
        <div className="absolute inset-x-0 bottom-0 flex flex-col items-center justify-center">
          <span
            className="text-xs font-bold px-2 py-0.5 rounded-full border shadow-sm transition-colors duration-300"
            style={{
              backgroundColor: `${colorHex}15`,
              borderColor: `${colorHex}40`,
              color: colorHex
            }}
          >
            {labelVi} ({(confidenceScore * 100).toFixed(0)}%)
          </span>
        </div>
      </div>

      {showLabels && (
        <div className="flex justify-between w-full text-[10px] text-slate-400 font-semibold px-2 mt-1">
          <span className="text-emerald-400">An Toàn</span>
          <span className="text-amber-400">Nghi Vấn</span>
          <span className="text-red-400">Gian Lận</span>
        </div>
      )}
    </div>
  );
};
