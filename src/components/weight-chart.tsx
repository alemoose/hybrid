import type { WeighIn } from "@/lib/body";
import { formatNumber } from "@/lib/format";

/** Weekly averages as a solid line, a dashed projection to the goal, and a dotted goal line. */
export function WeightChart({
  points,
  goal,
  projection,
  labels,
  ariaLabel,
}: {
  points: WeighIn[];
  goal: number;
  projection: WeighIn | null;
  labels: [string, string, string];
  ariaLabel: string;
}) {
  const width = 314;
  const height = 140;
  const left = 36;
  const right = width - 6;
  const top = 12;
  const bottom = height - 26;
  const t0 = points[0].at;
  const t1 = Math.max(points[points.length - 1].at, projection?.at ?? 0, t0 + 1);
  const ws = [...points.map((p) => p.weight), goal];
  const lo = Math.min(...ws) - 1;
  const hi = Math.max(...ws) + 1;
  const X = (t: number) => left + ((t - t0) / (t1 - t0)) * (right - left);
  const Y = (w: number) => top + ((hi - w) / (hi - lo)) * (bottom - top);
  const coords = points.map((p) => `${X(p.at).toFixed(1)},${Y(p.weight).toFixed(1)}`);
  const last = points[points.length - 1];

  return (
    <svg role="img" aria-label={ariaLabel} viewBox={`0 0 ${width} ${height}`} className="block h-auto w-full">
      <path d={`M${left},${Y(hi - 1).toFixed(1)}H${right}`} stroke="var(--color-line)" />
      <path d={`M${left},${Y(goal).toFixed(1)}H${right}`} stroke="var(--color-good)" strokeWidth="1.5" strokeDasharray="2 5" strokeLinecap="round" />
      <g fill="var(--color-muted)" fontSize="11" fontFamily="var(--font-sans)">
        <text x="0" y={Y(hi - 1) + 4}>
          {formatNumber(hi - 1)}
        </text>
        <text x="0" y={Y(goal) + 4}>
          {formatNumber(goal)}
        </text>
        <text x={left} y={height - 6}>
          {labels[0]}
        </text>
        <text x={X(last.at)} y={height - 6} textAnchor={projection ? "middle" : "end"}>
          {labels[1]}
        </text>
        {projection ? (
          <text x={right} y={height - 6} textAnchor="end">
            {labels[2]}
          </text>
        ) : null}
      </g>
      {points.length > 1 ? (
        <>
          <path
            d={`M${X(t0).toFixed(1)},${bottom} L${coords.join(" L")} L${X(last.at).toFixed(1)},${bottom} Z`}
            fill="var(--color-accent)"
            fillOpacity="0.12"
          />
          <polyline points={coords.join(" ")} fill="none" stroke="var(--color-accent)" strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round" />
        </>
      ) : null}
      {projection ? (
        <>
          <path
            d={`M${X(last.at).toFixed(1)},${Y(last.weight).toFixed(1)} L${X(projection.at).toFixed(1)},${Y(projection.weight).toFixed(1)}`}
            stroke="var(--color-accent)"
            strokeWidth="2"
            strokeDasharray="5 5"
            strokeLinecap="round"
          />
          <circle cx={X(projection.at)} cy={Y(projection.weight)} r="4.5" fill="var(--color-card)" stroke="var(--color-good)" strokeWidth="2" />
        </>
      ) : null}
      <circle cx={X(last.at)} cy={Y(last.weight)} r="5" fill="var(--color-accent)" stroke="var(--color-card)" strokeWidth="2.5" />
    </svg>
  );
}
