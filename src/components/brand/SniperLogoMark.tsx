type SniperLogoMarkProps = {
  className?: string;
  alt?: string;
};

export function SniperLogoMark({ className = "", alt = "SNIPER BO IA" }: SniperLogoMarkProps) {
  return (
    <img
      src="/assets/sniper-logo.png"
      alt={alt}
      draggable={false}
      className={`select-none object-contain ${className}`}
    />
  );
}
