import { useMemo } from "react";

interface NeuralLinesProps {
  /** convergence target in % of viewBox (0-100) */
  cx?: number;
  cy?: number;
  /** number of lines */
  count?: number;
  /** opacity of the whole layer */
  opacity?: number;
  /** distance the lines start from, as fraction of viewBox half-diagonal */
  reach?: number;
  className?: string;
}

/**
 * Decorative SVG layer: thin neon curves originating from the edges of the
 * viewport and converging to (cx, cy). Animated luminous dots travel along
 * each path. Pure SVG/CSS, very light.
 */
export function NeuralLines({
  cx = 50,
  cy = 50,
  count = 14,
  opacity = 0.55,
  reach = 1.1,
  className = "",
}: NeuralLinesProps) {
  const paths = useMemo(() => {
    const items: { d: string; dur: number; delay: number; stroke: string; key: number }[] = [];
    const palette = [
      "url(#nl-grad-blue)",
      "url(#nl-grad-cyan)",
      "url(#nl-grad-purple)",
    ];
    for (let i = 0; i < count; i++) {
      const angle = (i / count) * Math.PI * 2 + (i % 2 === 0 ? 0.12 : -0.18);
      const r = 60 * reach + ((i * 7) % 15);
      const sx = cx + Math.cos(angle) * r;
      const sy = cy + Math.sin(angle) * r;
      // control point: pulled toward center with a tangential offset for a smooth arc
      const tanX = -Math.sin(angle) * (12 + (i % 5) * 3);
      const tanY = Math.cos(angle) * (12 + (i % 5) * 3);
      const mx = (sx + cx) / 2 + tanX;
      const my = (sy + cy) / 2 + tanY;
      items.push({
        d: `M ${sx.toFixed(2)} ${sy.toFixed(2)} Q ${mx.toFixed(2)} ${my.toFixed(2)} ${cx} ${cy}`,
        dur: 3.6 + ((i * 0.37) % 3.4),
        delay: (i * 0.27) % 4,
        stroke: palette[i % palette.length],
        key: i,
      });
    }
    return items;
  }, [count, cx, cy, reach]);

  return (
    <svg
      aria-hidden
      viewBox="0 0 100 100"
      preserveAspectRatio="none"
      className={`pointer-events-none absolute inset-0 w-full h-full ${className}`}
      style={{ opacity }}
    >
      <defs>
        <linearGradient id="nl-grad-blue" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="oklch(0.7 0.22 245)" stopOpacity="0" />
          <stop offset="60%" stopColor="oklch(0.7 0.22 245)" stopOpacity="0.55" />
          <stop offset="100%" stopColor="oklch(0.85 0.18 200)" stopOpacity="0.95" />
        </linearGradient>
        <linearGradient id="nl-grad-cyan" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="oklch(0.85 0.18 200)" stopOpacity="0" />
          <stop offset="100%" stopColor="oklch(0.85 0.18 200)" stopOpacity="0.85" />
        </linearGradient>
        <linearGradient id="nl-grad-purple" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="oklch(0.65 0.25 295)" stopOpacity="0" />
          <stop offset="100%" stopColor="oklch(0.65 0.25 295)" stopOpacity="0.9" />
        </linearGradient>
        <filter id="nl-glow" x="-20%" y="-20%" width="140%" height="140%">
          <feGaussianBlur stdDeviation="0.6" result="b" />
          <feMerge>
            <feMergeNode in="b" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>

      <g style={{ filter: "url(#nl-glow)" }}>
        {paths.map((p) => (
          <g key={p.key}>
            <path
              d={p.d}
              fill="none"
              stroke={p.stroke}
              strokeWidth={1.4}
              strokeLinecap="round"
              vectorEffect="non-scaling-stroke"
              style={{
                animation: `nl-line-pulse ${4 + (p.key % 3)}s ease-in-out ${p.delay}s infinite`,
              }}
            />
            {/* moving luminous dot */}
            <circle r={0.9} fill="white" style={{ filter: "drop-shadow(0 0 2px white)" }}>
              <animateMotion
                dur={`${p.dur}s`}
                begin={`${p.delay}s`}
                repeatCount="indefinite"
                path={p.d}
                rotate="auto"
              />
              <animate
                attributeName="opacity"
                values="0;1;1;0"
                keyTimes="0;0.15;0.85;1"
                dur={`${p.dur}s`}
                begin={`${p.delay}s`}
                repeatCount="indefinite"
              />
            </circle>
          </g>
        ))}
      </g>
    </svg>
  );
}
