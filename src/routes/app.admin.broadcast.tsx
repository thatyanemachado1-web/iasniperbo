import { createFileRoute } from "@tanstack/react-router";
import {
  Bell,
  BellRing,
  Globe,
  Image as ImageIcon,
  Megaphone,
  Save,
  Send,
} from "lucide-react";
import { useEffect, useState } from "react";
import {
  getAdminSiteContent,
  sendAdminBroadcast,
  updateAdminSiteContent,
} from "@/lib/adminApi";
import { readEffectiveAdminSession } from "@/lib/adminSession";
import {
  DEFAULT_SITE_CONTENT_SETTINGS,
  type AnnouncementTone,
  type SiteContentSettings,
} from "@/lib/siteContent";
import { GlassCard } from "@/components/ui-app/GlassCard";
import { SectionTitle } from "@/components/ui-app/SectionTitle";

export const Route = createFileRoute("/app/admin/broadcast")({
  component: AdminBroadcastPage,
});

const toneOptions: Array<{ value: AnnouncementTone; label: string }> = [
  { value: "info", label: "Azul" },
  { value: "success", label: "Verde" },
  { value: "warning", label: "Amarelo" },
  { value: "danger", label: "Vermelho" },
];

function AdminBroadcastPage() {
  const session = readEffectiveAdminSession();
  const [settings, setSettings] = useState<SiteContentSettings>(DEFAULT_SITE_CONTENT_SETTINGS);
  const [broadcast, setBroadcast] = useState({
    title: "",
    message: "",
    audience: "all",
    tone: "info" as AnnouncementTone,
    buttonLabel: "",
    buttonUrl: "",
  });
  const [status, setStatus] = useState("");
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(Boolean(session));

  useEffect(() => {
    let active = true;
    if (!session) return undefined;
    setLoading(true);
    getAdminSiteContent(session)
      .then((next) => {
        if (active) setSettings({ ...DEFAULT_SITE_CONTENT_SETTINGS, ...next });
      })
      .catch((err) => {
        if (active) setStatus(err instanceof Error ? err.message : "Falha ao carregar conteudo.");
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [session?.apiUrl, session?.token]);

  async function saveContent() {
    if (!session) return;
    setBusy(true);
    setStatus("");
    try {
      const next = await updateAdminSiteContent(session, settings);
      setSettings({ ...DEFAULT_SITE_CONTENT_SETTINGS, ...next });
      setStatus("Conteudo salvo. O preview do link pode demorar por causa do cache do WhatsApp.");
    } catch (err) {
      setStatus(err instanceof Error ? err.message : "Falha ao salvar conteudo.");
    } finally {
      setBusy(false);
    }
  }

  async function submitPopup() {
    if (!session) return;
    setBusy(true);
    setStatus("");
    try {
      const response = await sendAdminBroadcast(session, broadcast);
      if (response.siteContent) {
        setSettings({ ...DEFAULT_SITE_CONTENT_SETTINGS, ...response.siteContent });
      }
      setStatus("Pop-up disparado. Quem estiver no site recebe na próxima leitura.");
      setBroadcast((current) => ({ ...current, title: "", message: "" }));
    } catch (err) {
      setStatus(err instanceof Error ? err.message : "Falha ao disparar pop-up.");
    } finally {
      setBusy(false);
    }
  }

  function updateSetting<K extends keyof SiteContentSettings>(
    key: K,
    value: SiteContentSettings[K],
  ) {
    setSettings((current) => ({ ...current, [key]: value }));
  }

  if (!session) {
    return (
      <GlassCard className="border-destructive/35">
        <SectionTitle title="Acesso administrativo bloqueado" />
        <p className="text-sm text-muted-foreground">
          Somente admin ou owner pode alterar conteudo, favicon, banners e pop-ups.
        </p>
      </GlassCard>
    );
  }

  return (
    <div className="space-y-4">
      <GlassCard className="border-neon-cyan/25">
        <SectionTitle
          title="CONTEUDO E AVISOS"
          subtitle="Controle o preview do link, favicon, banner e pop-up do site."
          right={<Megaphone className="size-5 text-neon-cyan" />}
        />
        {status && (
          <div className="mt-4 rounded-xl border border-neon-cyan/25 bg-neon-cyan/10 px-3 py-2 text-sm text-neon-cyan">
            {status}
          </div>
        )}
        {loading && <p className="mt-4 text-sm text-muted-foreground">Carregando ajustes...</p>}
      </GlassCard>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1.1fr)_minmax(340px,0.9fr)]">
        <GlassCard className="border-neon-cyan/20">
          <SectionTitle
            title="PREVIEW DO LINK"
            subtitle="Texto que aparece quando alguem compartilha sniperbo.com."
            right={<Globe className="size-5 text-neon-cyan" />}
          />
          <div className="space-y-4">
            <TextField
              label="Titulo"
              value={settings.shareTitle}
              onChange={(value) => updateSetting("shareTitle", value)}
              required
            />
            <TextAreaField
              label="Descricao"
              value={settings.shareDescription}
              onChange={(value) => updateSetting("shareDescription", value)}
              required
            />
            <TextField
              label="Imagem do preview"
              hint="Use URL completa ou caminho publico, exemplo: /sniper-icon.svg"
              value={settings.shareImageUrl}
              onChange={(value) => updateSetting("shareImageUrl", value)}
            />
          </div>
        </GlassCard>

        <GlassCard className="border-neon-cyan/20">
          <SectionTitle title="COMO VAI APARECER" right={<ImageIcon className="size-5 text-neon-cyan" />} />
          <div className="rounded-2xl border border-success/25 bg-success/10 p-3">
            <div className="text-sm text-sky-300">https://sniperbo.com</div>
            <div className="mt-2 flex gap-3 rounded-xl bg-lime-200/90 p-3 text-black">
              <div className="min-w-0 flex-1">
                <div className="truncate text-sm font-semibold text-green-800">Sniperbo</div>
                <div className="mt-1 line-clamp-2 text-base font-black">{settings.shareTitle}</div>
                <p className="mt-1 line-clamp-3 text-sm">{settings.shareDescription}</p>
              </div>
              <img
                src={settings.shareImageUrl || "/sniper-icon.svg"}
                alt="Preview"
                className="size-24 shrink-0 rounded-lg border border-black/10 object-cover"
              />
            </div>
          </div>
          <div className="mt-4">
            <TextField
              label="Favicon do site"
              hint="Esse icone aparece na aba do navegador."
              value={settings.faviconUrl}
              onChange={(value) => updateSetting("faviconUrl", value)}
            />
          </div>
          <button
            type="button"
            disabled={busy}
            onClick={saveContent}
            className="btn-primary-grad mt-4 inline-flex w-full items-center justify-center gap-2 rounded-xl px-4 py-3 text-sm font-black disabled:opacity-50"
          >
            <Save className="size-4" />
            Salvar texto e favicon
          </button>
        </GlassCard>

        <GlassCard className="border-neon-cyan/20">
          <SectionTitle
            title="BANNER DO SITE"
            subtitle="Mensagem fixa no topo para avisos importantes."
            right={<Bell className="size-5 text-neon-cyan" />}
          />
          <div className="space-y-4">
            <ToggleField
              label="Mostrar banner"
              checked={settings.bannerEnabled}
              onChange={(value) => updateSetting("bannerEnabled", value)}
            />
            <TextField
              label="Titulo do banner"
              value={settings.bannerTitle}
              onChange={(value) => updateSetting("bannerTitle", value)}
            />
            <TextAreaField
              label="Mensagem do banner"
              value={settings.bannerMessage}
              onChange={(value) => updateSetting("bannerMessage", value)}
            />
            <ToneSelect
              label="Cor do banner"
              value={settings.bannerTone}
              onChange={(value) => updateSetting("bannerTone", value)}
            />
            <button
              type="button"
              disabled={busy}
              onClick={saveContent}
              className="btn-primary-grad inline-flex w-full items-center justify-center gap-2 rounded-xl px-4 py-3 text-sm font-black disabled:opacity-50"
            >
              <Save className="size-4" />
              Salvar banner
            </button>
          </div>
        </GlassCard>

        <GlassCard className="border-neon-cyan/20">
          <SectionTitle
            title="DISPARAR POP-UP"
            subtitle="Notificacao aparece para quem esta no site."
            right={<BellRing className="size-5 text-neon-cyan" />}
          />
          <div className="rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2 text-xs text-muted-foreground">
            Ultimo pop-up: {settings.popupEnabled ? settings.popupTitle : "Nenhum ativo"}
          </div>
          <div className="mt-4 space-y-4">
            <TextField
              label="Titulo"
              value={broadcast.title}
              onChange={(value) => setBroadcast((current) => ({ ...current, title: value }))}
              required
            />
            <TextAreaField
              label="Mensagem"
              value={broadcast.message}
              onChange={(value) => setBroadcast((current) => ({ ...current, message: value }))}
              required
            />
            <div className="grid gap-3 sm:grid-cols-2">
              <SelectField
                label="Publico"
                value={broadcast.audience}
                onChange={(value) => setBroadcast((current) => ({ ...current, audience: value }))}
                options={[
                  { value: "all", label: "Todos" },
                  { value: "premium", label: "Premium" },
                  { value: "trial", label: "Trial" },
                  { value: "expired", label: "Vencidos" },
                ]}
              />
              <ToneSelect
                label="Cor"
                value={broadcast.tone}
                onChange={(value) => setBroadcast((current) => ({ ...current, tone: value }))}
              />
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <TextField
                label="Botao opcional"
                value={broadcast.buttonLabel}
                onChange={(value) =>
                  setBroadcast((current) => ({ ...current, buttonLabel: value }))
                }
              />
              <TextField
                label="Link do botao"
                value={broadcast.buttonUrl}
                onChange={(value) => setBroadcast((current) => ({ ...current, buttonUrl: value }))}
              />
            </div>
            <button
              type="button"
              disabled={busy || !broadcast.title || !broadcast.message}
              onClick={submitPopup}
              className="btn-primary-grad inline-flex w-full items-center justify-center gap-2 rounded-xl px-4 py-3 text-sm font-black disabled:opacity-50"
            >
              <Send className="size-4" />
              Disparar pop-up agora
            </button>
          </div>
        </GlassCard>
      </div>
    </div>
  );
}

function TextField({
  label,
  value,
  onChange,
  hint,
  required,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  hint?: string;
  required?: boolean;
}) {
  return (
    <label className="block text-xs font-bold uppercase tracking-[0.16em] text-muted-foreground">
      {label}
      <input
        className="admin-input mt-2"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        required={required}
      />
      {hint && <span className="mt-1 block text-[11px] normal-case tracking-normal">{hint}</span>}
    </label>
  );
}

function TextAreaField({
  label,
  value,
  onChange,
  required,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  required?: boolean;
}) {
  return (
    <label className="block text-xs font-bold uppercase tracking-[0.16em] text-muted-foreground">
      {label}
      <textarea
        className="admin-input mt-2 min-h-28 resize-none"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        required={required}
      />
    </label>
  );
}

function ToggleField({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (value: boolean) => void;
}) {
  return (
    <label className="flex items-center justify-between gap-3 rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2 text-sm font-bold text-foreground">
      {label}
      <input
        type="checkbox"
        checked={checked}
        onChange={(event) => onChange(event.target.checked)}
        className="size-5 accent-cyan-400"
      />
    </label>
  );
}

function ToneSelect({
  label,
  value,
  onChange,
}: {
  label: string;
  value: AnnouncementTone;
  onChange: (value: AnnouncementTone) => void;
}) {
  return (
    <SelectField
      label={label}
      value={value}
      onChange={(next) => onChange(next as AnnouncementTone)}
      options={toneOptions}
    />
  );
}

function SelectField({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: Array<{ value: string; label: string }>;
}) {
  return (
    <label className="block text-xs font-bold uppercase tracking-[0.16em] text-muted-foreground">
      {label}
      <select className="admin-input mt-2" value={value} onChange={(event) => onChange(event.target.value)}>
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </label>
  );
}
