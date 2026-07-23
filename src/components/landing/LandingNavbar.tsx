import { SniperLogoMark } from "@/components/brand/SniperLogoMark";

export function LandingNavbar() {
  return (
    <header className="relative z-30 mx-auto flex w-full max-w-[1280px] items-center justify-between gap-3 px-5 py-4 sm:px-8 lg:px-12">
      <SniperLogoMark className="h-10 w-auto max-w-[160px] sm:h-12 sm:max-w-[200px]" />
    </header>
  );
}
