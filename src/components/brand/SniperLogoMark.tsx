import sniperLogo from "@/assets/sniper-bo-logo.png";

type SniperLogoMarkProps = {
  className?: string;
  alt?: string;
};

export function SniperLogoMark({ className = "", alt = "SNIPER BO IA" }: SniperLogoMarkProps) {
  return (
    <img
      src={sniperLogo}
      alt={alt}
      draggable={false}
      className={`select-none object-contain ${className}`}
    />
  );
}
