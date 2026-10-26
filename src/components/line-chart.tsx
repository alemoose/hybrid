import { formatNumber } from "@/lib/format";

/** Line + soft area chart in the Paper Night style. Values in order, oldest first. */
export function LineChart({
  values,
  labels,
  ariaLabel,
  width = 314,
  height = 150,
}: {
  values: number[];
  /** Up to three x-axis labels: start, middle, end. */
  labels: string[];
  ariaLabel: string;
  width?: number;
  height?: number;
}) {
  const left = 38;
  const right = width - 4;
  const top = 12;
  const bottom = height - 28;
  const n = values.length;
  const lo = Math.min(...values);
  const hi = Math.max(...values);
  const pad = (hi - lo) * 0.15 || Math.max(1, hi * 0.05);
  const y0 = lo - pad;
  const y1 = hi + pad;
  const X = (i: number) => (n === 1 ? (left + right) / 2 : left + (i * (right - left)) / (n - 1));
  const Y = (v: number) => top + ((y1 - v) / (y1 - y0)) * (bottom - top);
  const coords = values.map((v, i) => `${X(i).toFixed(1)},${Y(v).toFixed(1)}`);
  const area = `M${X(0).toFixed(1)},${bottom} L${coords.join(" L")} L${X(n - 1).toFixed(1)},${bottom} Z`;
  const hiY = Y(hi);
  const loY = Y(lo);

  return (
    <svg role="img" aria-label={ariaLabel} viewBox={`0 0 ${width} ${height}`} className="block h-auto w-full">
      <path
        d={`M${left},${hiY.toFixed(1)}H${right}M${left},${loY.toFixed(1)}H${right}M${left},${bottom}H${right}`}
        stroke="var(--color-line)"
        strokeWidth="1"
      />
      <g fill="var(--color-muted)" fontSize="11" fontFamily="var(--font-sans)">
        <text x="0" y={hiY + 4}>
          {formatNumber(hi)}
        </text>
        {hi !== lo ? (
          <text x="0" y={loY + 4}>
            {formatNumber(lo)}
          </text>
        ) : null}
        {labels[0] ? <text x={left} y={height - 6}>{labels[0]}</text> : null}
        {labels.length === 3 ? (
          <text x={(left + right) / 2} y={height - 6} textAnchor="middle">
            {labels[1]}
          </text>
        ) : null}
        {labels.length > 1 ? (
          <text x={right} y={height - 6} textAnchor="end">
            {labels[labels.length - 1]}
          </text>
        ) : null}
      </g>
      {n > 1 ? (
        <>
          <path d={area} fill="var(--color-accent)" fillOpacity="0.12" />
          <polyline
            points={coords.join(" ")}
            fill="none"
            stroke="var(--color-accent)"
            strokeWidth="2.5"
            strokeLinejoin="round"
            strokeLinecap="round"
          />
        </>
      ) : null}
      <circle cx={X(n - 1)} cy={Y(values[n - 1])} r="5" fill="var(--color-accent)" stroke="var(--color-card)" strokeWidth="2.5" />
    </svg>
  );
}
