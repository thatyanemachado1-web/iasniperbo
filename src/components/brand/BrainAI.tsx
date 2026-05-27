import { motion } from "framer-motion";

interface BrainAIProps {
  size?: number;
  speaking?: boolean;
  className?: string;
}

export function BrainAI({ size = 120, speaking = false, className = "" }: BrainAIProps) {
  return (
    <div
      className={`relative inline-flex items-center justify-center ${className}`}
      style={{ width: size, height: size }}
    >
      {/* halo */}
      <div
        className="absolute inset-0 rounded-full blur-2xl opacity-70"
        style={{
          background:
            "radial-gradient(circle, color-mix(in oklab, var(--neon-blue) 60%, transparent), transparent 70%)",
        }}
      />
      <div
        className="absolute inset-2 rounded-full blur-xl opacity-60"
        style={{
          background:
            "radial-gradient(circle, color-mix(in oklab, var(--neon-purple) 60%, transparent), transparent 70%)",
        }}
      />

      <motion.svg
        viewBox="0 0 200 200"
        width={size}
        height={size}
        className="animate-brain-pulse relative"
        animate={speaking ? { scale: [1, 1.04, 1] } : { scale: 1 }}
        transition={{ duration: 1.4, repeat: speaking ? Infinity : 0 }}
      >
        <defs>
          <linearGradient id="brainGrad" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="oklch(0.85 0.18 200)" />
            <stop offset="50%" stopColor="oklch(0.62 0.22 255)" />
            <stop offset="100%" stopColor="oklch(0.55 0.25 295)" />
          </linearGradient>
          <radialGradient id="coreGlow" cx="0.5" cy="0.5" r="0.5">
            <stop offset="0%" stopColor="white" stopOpacity="0.9" />
            <stop offset="60%" stopColor="oklch(0.7 0.22 245)" stopOpacity="0.3" />
            <stop offset="100%" stopColor="transparent" />
          </radialGradient>
        </defs>

        {/* brain silhouette */}
        <g stroke="url(#brainGrad)" strokeWidth="1.6" fill="none" strokeLinecap="round">
          <path d="M100 28c-22 0-36 14-36 30 0 4-6 6-10 12-6 8-6 18 0 24-6 8-4 18 4 24-2 10 6 20 18 22 4 10 14 16 24 16s20-6 24-16c12-2 20-12 18-22 8-6 10-16 4-24 6-6 6-16 0-24-4-6-10-8-10-12 0-16-14-30-36-30z" />
          <path d="M100 28v128" />
          <path d="M70 60c8 6 8 18 0 24M70 96c10 4 10 18 0 24M70 130c8 4 10 14 6 22" />
          <path d="M130 60c-8 6-8 18 0 24M130 96c-10 4-10 18 0 24M130 130c-8 4-10 14-6 22" />
          <path d="M86 50c-4 8-4 14 0 22M114 50c4 8 4 14 0 22M84 110c-4 8-2 18 4 24M116 110c4 8 2 18-4 24" />
        </g>

        {/* circuit nodes */}
        <g fill="oklch(0.85 0.18 200)">
          <circle cx="70" cy="60" r="2.5" />
          <circle cx="70" cy="96" r="2.5" />
          <circle cx="70" cy="130" r="2.5" />
          <circle cx="130" cy="60" r="2.5" />
          <circle cx="130" cy="96" r="2.5" />
          <circle cx="130" cy="130" r="2.5" />
          <circle cx="100" cy="92" r="3" fill="white" />
        </g>

        {/* core */}
        <circle cx="100" cy="92" r="40" fill="url(#coreGlow)" opacity="0.65" />

        {/* base light */}
        <ellipse cx="100" cy="178" rx="40" ry="5" fill="oklch(0.7 0.22 245)" opacity="0.5" />
      </motion.svg>

      {speaking && (
        <div className="absolute -bottom-2 left-1/2 -translate-x-1/2 flex items-end gap-1 h-6">
          {[0, 1, 2, 3, 4].map((i) => (
            <span
              key={i}
              className="wave-bar block w-1 rounded-full bg-neon-blue"
              style={{ height: 22, animationDelay: `${i * 0.12}s` }}
            />
          ))}
        </div>
      )}
    </div>
  );
}