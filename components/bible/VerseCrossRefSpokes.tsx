"use client";

import { useMemo } from "react";
import { makeXMapper } from "@/lib/bible/bibleXAxis";
import {
  collectVerseCrossRefSpokes,
  type VerseCrossRefSpoke,
} from "@/lib/bible/verseCrossRefSpokes";
import { xrefColorForDistance } from "@/lib/bible/xrefColors";

const BASELINE_INSET = 2;

export interface VerseCrossRefSpokeHover {
  spoke: VerseCrossRefSpoke;
  clientX: number;
  clientY: number;
}

interface VerseCrossRefSpokesProps {
  width: number;
  height: number;
  activeIdx: number;
  pairs: Uint32Array;
  onHover?: (info: VerseCrossRefSpokeHover | null) => void;
  onClick?: (spoke: VerseCrossRefSpoke) => void;
}

/**
 * SVG spokes from the active verse to each cross-reference target. Always
 * anchored on the books baseline — unlike Harrison semicircles, long spans
 * stay connected at both endpoints in a compact band.
 */
export function VerseCrossRefSpokes({
  width,
  height,
  activeIdx,
  pairs,
  onHover,
  onClick,
}: VerseCrossRefSpokesProps) {
  const xOf = useMemo(() => makeXMapper(width, "word"), [width]);
  const baseline = height - BASELINE_INSET;
  const cpY = Math.max(2, baseline - Math.max(6, height - 10));
  const spokes = useMemo(
    () => collectVerseCrossRefSpokes(pairs, activeIdx),
    [pairs, activeIdx],
  );
  if (width <= 0 || height <= 0) return null;

  const xActive = xOf(activeIdx);

  return (
    <svg
      className="absolute inset-0 overflow-visible"
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      aria-hidden
    >
      {spokes.map((spoke) => {
        const otherIdx =
          spoke.fromIdx === activeIdx ? spoke.toIdx : spoke.fromIdx;
        const xTarget = xOf(otherIdx);
        const dist = Math.abs(otherIdx - activeIdx);
        const color = xrefColorForDistance(dist);
        const d = `M ${xActive} ${baseline} C ${xActive} ${cpY}, ${xTarget} ${cpY}, ${xTarget} ${baseline}`;
        return (
          <g key={spoke.pairIdx}>
            <path
              d={d}
              fill="none"
              stroke="transparent"
              strokeWidth={14}
              className="cursor-pointer"
              onPointerEnter={(e) =>
                onHover?.({
                  spoke,
                  clientX: e.clientX,
                  clientY: e.clientY,
                })
              }
              onPointerMove={(e) =>
                onHover?.({
                  spoke,
                  clientX: e.clientX,
                  clientY: e.clientY,
                })
              }
              onPointerLeave={() => onHover?.(null)}
              onClick={(e) => {
                e.stopPropagation();
                onClick?.(spoke);
              }}
            />
            <path
              d={d}
              fill="none"
              stroke={color}
              strokeWidth={1.5}
              strokeOpacity={0.92}
              pointerEvents="none"
            />
            <circle
              cx={xTarget}
              cy={baseline}
              r={2}
              fill={color}
              pointerEvents="none"
            />
          </g>
        );
      })}
    </svg>
  );
}
