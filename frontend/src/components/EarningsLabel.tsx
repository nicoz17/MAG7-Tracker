import React from "react";
import type { EarningsHover } from "../types";

export function EarningsLabel({ viewBox, earningEvent, onEnter, onLeave }: any) {
  if (!viewBox) return null;
  const { x, y, height } = viewBox;
  const bY = y + height;
  const w = 14, h = 9;
  return (
    <g
      style={{ cursor: "pointer" }}
      onMouseEnter={(e: React.MouseEvent) => onEnter?.({ clientX: e.clientX, clientY: e.clientY, event: earningEvent })}
      onMouseLeave={() => onLeave?.()}
    >
      <polygon points={`${x},${bY} ${x - w/2},${bY + h} ${x + w/2},${bY + h}`} fill="#f0c27f" opacity={0.9} />
      <text x={x} y={bY + h + 9} textAnchor="middle" fill="#f0c27f" fontSize={8} fontFamily="'Space Mono', monospace" fontWeight={700}>E</text>
      {/* Invisible wider hit area */}
      <rect x={x - 10} y={bY - 4} width={20} height={h + 16} fill="transparent" />
    </g>
  );
}
