import { defineConfig } from "vite";
import tailwindcss from "@tailwindcss/vite";
import tsConfigPaths from "vite-tsconfig-paths";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import viteReact from "@vitejs/plugin-react";
import { cloudflare } from "@cloudflare/vite-plugin";

// Standalone TanStack Start + Cloudflare Workers build. This previously imported
// defineConfig from @lovable.dev/vite-tanstack-config, which bundled the plugins
// below automatically; they are now declared explicitly so the project builds
// with no Lovable dependency. The plugin set the wrapper provided (kept here for
// reference) — do NOT add duplicates of the ones already listed below or the app
// will break with duplicate plugins:
//   - tanstackStart, viteReact, tailwindcss, tsConfigPaths, cloudflare (build-only),
//     componentTagger (dev-only), VITE_* env injection, @ path alias, React/TanStack dedupe,
//     error logger plugins, and sandbox detection (port/host/strictPort).
// The dev-only / sandbox-only plugins (componentTagger, error loggers, sandbox
// detection) are Lovable-specific and intentionally dropped. Vite loads `.env`
// and exposes VITE_* via import.meta.env natively, and the @ path alias comes
// from tsconfig.json via vite-tsconfig-paths.

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
