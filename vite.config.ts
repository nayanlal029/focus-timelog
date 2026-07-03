import { defineConfig } from "vite";
import tailwindcss from "@tailwindcss/vite";
import tsConfigPaths from "vite-tsconfig-paths";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import viteReact from "@vitejs/plugin-react";
import { cloudflare } from "@cloudflare/vite-plugin";

// Standalone TanStack Start + Cloudflare Workers build.
//
// This config previously came from @lovable.dev/vite-tanstack-config, which
// bundled the Vite plugins automatically. They are now declared explicitly here
// so the project builds with no Lovable dependency. For anyone editing this file:
//
//   ACTIVE (declared in `plugins` below — don't add duplicates or the build breaks):
//     tailwindcss, tsConfigPaths, cloudflare, tanstackStart (with importProtection),
//     viteReact — plus the React / TanStack Query `dedupe` in `resolve`.
//   NATIVE (handled by Vite, no plugin needed):
//     VITE_* env vars via import.meta.env; the `@` -> src alias via tsconfig.json
//     (resolved by vite-tsconfig-paths).
//   DROPPED (were Lovable/sandbox dev-only — intentionally NOT carried over, so
//     don't expect them here): componentTagger, dev SSR/server-fn error loggers,
//     HMR gate, dev-server bridge, sandbox detection (port/host/strictPort), and
//     the nitro deploy plugin.

// Redirect TanStack Start's bundled server entry to src/server.ts (our SSR error wrapper).
// @cloudflare/vite-plugin builds from this — wrangler.jsonc main alone is insufficient.
export default defineConfig({
  plugins: [
    tailwindcss(),
    tsConfigPaths({ projects: ["./tsconfig.json"] }),
    // Cloudflare Workers SSR environment; reads wrangler.jsonc (main: src/server.ts).
    cloudflare({ viteEnvironment: { name: "ssr" } }),
    tanstackStart({
      server: { entry: "server" },
      importProtection: {
        behavior: "error",
        client: {
          files: ["**/server/**"],
          specifiers: ["server-only"],
        },
      },
    }),
    viteReact(),
  ],
  resolve: {
    dedupe: [
      "react",
      "react-dom",
      "react/jsx-runtime",
      "react/jsx-dev-runtime",
      "@tanstack/react-query",
      "@tanstack/query-core",
    ],
  },
});
