import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";

import { AuthPanel } from "@/components/landing/AuthPanel";
import { FinalCTA } from "@/components/landing/FinalCTA";
import { HowItWorks } from "@/components/landing/HowItWorks";
import { InstitutionalNotice } from "@/components/landing/InstitutionalNotice";
import { LandingFooter } from "@/components/landing/LandingFooter";
import { LandingHero } from "@/components/landing/LandingHero";
import { LandingNavbar } from "@/components/landing/LandingNavbar";
import { PlatformFeatures } from "@/components/landing/PlatformFeatures";
import { PricingSection } from "@/components/landing/PricingSection";
import { ResponsibleGamingNotice } from "@/components/landing/ResponsibleGamingNotice";
import { SupportedEnvironments } from "@/components/landing/SupportedEnvironments";
import { getSalesSettings } from "@/lib/accessApi";

export const Route = createFileRoute("/")({
  component: LandingPage,
  head: () => ({
    meta: [
      { title: "SNIPER BO IA — Plataforma de análise com IA" },
      {
        name: "description",
        content:
          "Plataforma de análise, validação histórica e monitoramento em tempo real com inteligência artificial aplicada ao estudo de estratégias.",
      },
      { property: "og:type", content: "website" },
      { property: "og:title", content: "SNIPER BO IA — Plataforma de análise com IA" },
      {
        property: "og:description",
        content:
          "Análise antes da decisão. Mais contexto, menos achismo. Estudo de estratégias com dados e IA.",
      },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "twitter:title", content: "SNIPER BO IA — Plataforma de análise com IA" },
      {
        name: "twitter:description",
        content: "Análise, validação histórica e monitoramento em tempo real com IA.",
      },
    ],
  }),
});

function LandingPage() {
  const navigate = useNavigate();
  const [salesClosed, setSalesClosed] = useState(false);
  const [authOpen, setAuthOpen] = useState(false);
  const [authMode, setAuthMode] = useState<"login" | "register">("login");

  useEffect(() => {
    let active = true;
    getSalesSettings()
      .then((settings) => {
        if (active) setSalesClosed(settings.salesClosed);
      })
      .catch(() => {
        if (active) setSalesClosed(false);
      });
    return () => {
      active = false;
    };
  }, []);

  function openLogin() {
    setAuthMode("login");
    setAuthOpen(true);
  }

  function openRegister() {
    if (salesClosed) {
      window.location.href = "https://wa.me/5567992308362";
      return;
    }
    setAuthMode("register");
    setAuthOpen(true);
  }

  function goPlatform() {
    void navigate({ to: "/app" });
  }

  return (
    <div className="relative min-h-screen bg-[#050816] text-[#F7F8FC]">
      <ResponsibleGamingNotice />
      <LandingNavbar
        onLogin={openLogin}
        onRegister={openRegister}
        hideRegister={salesClosed}
      />
      <main>
        <LandingHero onPrimary={goPlatform} onSecondary={openLogin} />
        <SupportedEnvironments />
        <HowItWorks />
        <PlatformFeatures />
        <PricingSection onCta={goPlatform} />
        <FinalCTA onCta={goPlatform} />
        <InstitutionalNotice />
      </main>
      <LandingFooter />

      <AuthPanel
        open={authOpen}
        mode={authMode}
        salesClosed={salesClosed}
        onClose={() => setAuthOpen(false)}
        onSwitchMode={setAuthMode}
      />
    </div>
  );
}
