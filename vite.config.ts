import { defineConfig } from "vite";
import tailwindcss from "@tailwindcss/vite";
import tsConfigPaths from "vite-tsconfig-paths";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import viteReact from "@vitejs/plugin-react";
import { cloudflare } from "@cloudflare/vite-plugin";

// Standalone TanStack Start + Cloudflare Workers build.
// Previously this was wrapped by @lovable.dev/vite-tanstack-config; the plugin
// set is now inlined so the project builds with no Lovable dependency. Vite
// loads `.env` and exposes VITE_* via import.meta.env natively, so no extra
// env-injection plugin is needed.
export default defineConfig({
  plugins: [
    tailwindcss(),
    tsConfigPaths({ projects: ["./tsconfig.json"] }),
    // Cloudflare Workers SSR environment; reads wrangler.jsonc (main: src/server.ts).
    cloudflare({ viteEnvironment: { name: "ssr" } }),
    tanstackStart({
      // Redirect TanStack Start's bundled server entry to src/server.ts (our SSR
      // error wrapper). wrangler.jsonc `main` alone is insufficient.
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
