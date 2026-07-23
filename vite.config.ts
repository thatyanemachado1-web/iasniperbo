import {
  defineConfig,
  type LovableViteTanstackOptions,
} from "@lovable.dev/vite-tanstack-config";

const frontendPort = Number(process.env.FRONTEND_PORT ?? process.env.VITE_FRONTEND_PORT ?? 5175);

export default defineConfig({
  nitro: {
    plugins: ["./plugins/trial-claim-backfill.ts"],
  } as NonNullable<LovableViteTanstackOptions["nitro"]>,
  tanstackStart: {
    server: { entry: "server" },
  },
  vite: {
    server: {
      host: "127.0.0.1",
      port: frontendPort,
      strictPort: true,
    },
    preview: {
      host: "127.0.0.1",
      port: frontendPort,
      strictPort: true,
    },
    build: {
      sourcemap: false,
      minify: "esbuild",
    },
  },
});
