import { Capacitor, registerPlugin, type PluginListenerHandle } from "@capacitor/core";

export interface LiveHouseBounds {
  left: number;
  top: number;
  width: number;
  height: number;
}

interface LiveHousePlugin {
  show(options: LiveHouseBounds & { url: string }): Promise<{ active: boolean }>;
  updateBounds(options: LiveHouseBounds): Promise<{ active: boolean }>;
  reload(): Promise<{ active: boolean }>;
  hide(): Promise<{ active: boolean }>;
  destroy(): Promise<{ active: boolean }>;
  addListener(
    eventName: "pageFinished",
    listener: (event: { url: string; requestedUrl: string }) => void,
  ): Promise<PluginListenerHandle>;
}

export const LiveHouseNative = registerPlugin<LiveHousePlugin>("LiveHouse");

export function isNativeLiveHouseAvailable() {
  return Capacitor.isNativePlatform() && Capacitor.getPlatform() === "android";
}

export function elementBounds(element: HTMLElement): LiveHouseBounds {
  const rect = element.getBoundingClientRect();
  return {
    left: rect.left,
    top: rect.top,
    width: rect.width,
    height: rect.height,
  };
}
