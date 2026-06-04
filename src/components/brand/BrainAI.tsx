import { motion } from "framer-motion";

interface BrainAIProps {
  size?: number;
  speaking?: boolean;
  className?: string;
}

export function BrainAI({ size = 120, speaking = false, className = "" }: BrainAIProps) {
  const visualSize = Math.round(size * 1.18);
  const particleCount = visualSize >= 220 ? 14 : visualSize >= 120 ? 8 : 0;
  return (
    <div
      className={`relative inline-flex items-center justify-center ${className}`}
      style={{ width: visualSize, height: visualSize }}
    >
      {/* outer halo */}
      <div
        className="absolute inset-0 rounded-full blur-3xl opacity-80 animate-brain-pulse"
        style={{
          background:
            "radial-gradient(circle, color-mix(in oklab, var(--neon-blue) 70%, transparent), transparent 65%)",
        }}
      />
      <div
        className="absolute inset-[10%] rounded-full blur-2xl opacity-70"
        style={{
          background:
            "radial-gradient(circle, color-mix(in oklab, var(--neon-purple) 70%, transparent), transparent 65%)",
        }}
      />

      {/* holographic base ring */}
      <div
        className="absolute left-1/2 -translate-x-1/2 rounded-full animate-base-pulse"
        style={{
          bottom: visualSize * 0.02,
          width: visualSize * 0.78,
          height: visualSize * 0.1,
          background:
            "radial-gradient(ellipse at center, color-mix(in oklab, var(--neon-blue) 80%, transparent), transparent 70%)",
          filter: "blur(6px)",
        }}
      />

      {/* floating brain image */}
      <motion.div
        className="relative animate-brain-pulse"
        animate={{ y: [0, -6, 0] }}
        transition={{ duration: 4.2, repeat: Infinity, ease: "easeInOut" }}
        style={{ width: visualSize, height: visualSize }}
      >
        <motion.div
          className="w-full h-full"
          style={{
            filter:
              "drop-shadow(0 0 14px color-mix(in oklab, var(--neon-blue) 85%, transparent)) drop-shadow(0 0 32px color-mix(in oklab, var(--neon-purple) 55%, transparent))",
          }}
          animate={speaking ? { scale: [1, 1.035, 1] } : { scale: 1 }}
          transition={{ duration: 1.4, repeat: speaking ? Infinity : 0, ease: "easeInOut" }}
        >
          <img
            src="/assets/ai-brain.png"
            alt="Cérebro IA holográfico SNIPER BO IA"
            loading="lazy"
            draggable={false}
            className="w-full h-full object-contain select-none pointer-events-none"
          />
        </motion.div>

        {/* holographic scan overlay */}
        <div
          className="absolute inset-0 rounded-full pointer-events-none opacity-40 holo-scan"
          style={{
            background:
              "repeating-linear-gradient(180deg, transparent 0 3px, color-mix(in oklab, var(--neon-cyan) 18%, transparent) 3px 4px)",
            mixBlendMode: "overlay",
          }}
        />
      </motion.div>

      {/* orbit particles */}
      {particleCount > 0 && (
        <div className="absolute inset-0 pointer-events-none">
          {Array.from({ length: particleCount }).map((_, i) => {
            const angle = (i * 360) / particleCount;
            const delay = (i * 0.4) % 3;
            return (
              <span
                key={i}
                className="absolute left-1/2 top-1/2 size-1.5 rounded-full bg-neon-cyan animate-orbit-particle"
                style={{
                  boxShadow: "0 0 8px color-mix(in oklab, var(--neon-cyan) 80%, transparent)",
                  // @ts-expect-error css var
                  "--angle": `${angle}deg`,
                  "--radius": `${visualSize * 0.42}px`,
                  animationDelay: `${delay}s`,
                }}
              />
            );
          })}
        </div>
      )}

      {speaking && (
        <div className="absolute -bottom-3 left-1/2 -translate-x-1/2 flex items-end gap-1 h-6">
          {[0, 1, 2, 3, 4, 5, 6].map((i) => (
            <span
              key={i}
              className="wave-bar block w-1 rounded-full bg-gradient-to-t from-neon-blue to-neon-purple"
              style={{ height: 22, animationDelay: `${i * 0.1}s` }}
            />
          ))}
        </div>
      )}
    </div>
  );
}
