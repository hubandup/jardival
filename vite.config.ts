import { defineConfig, type Plugin } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import fs from "fs";
import { componentTagger } from "lovable-tagger";

const SUPABASE_URL = "https://nwqhzsjajjluvwrbaemw.supabase.co";

/**
 * Generates static /llms.txt and /llms-full.txt at build time
 * by calling the deployed `llms` edge function.
 * This gives clean root URLs while keeping the content dynamic at deploy time.
 */
function llmsTxtPlugin(): Plugin {
  return {
    name: "lovable-llms-txt",
    apply: "build",
    async writeBundle(opts) {
      const outDir = opts.dir ?? "dist";
      const targets = [
        { url: `${SUPABASE_URL}/functions/v1/llms`, file: "llms.txt" },
        { url: `${SUPABASE_URL}/functions/v1/llms?full=1`, file: "llms-full.txt" },
      ];
      for (const t of targets) {
        try {
          const res = await fetch(t.url);
          if (!res.ok) {
            console.warn(`[llms-txt] ${t.file}: HTTP ${res.status}, skipping`);
            continue;
          }
          const text = await res.text();
          fs.writeFileSync(path.join(outDir, t.file), text, "utf8");
          console.log(`[llms-txt] generated /${t.file} (${text.length} bytes)`);
        } catch (e) {
          console.warn(`[llms-txt] ${t.file} failed:`, (e as Error).message);
        }
      }
    },
  };
}

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  server: {
    host: "::",
    port: 8080,
    hmr: {
      overlay: false,
    },
  },
  plugins: [
    react(),
    mode === "development" && componentTagger(),
    llmsTxtPlugin(),
  ].filter(Boolean),
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
    dedupe: ["react", "react-dom", "react/jsx-runtime", "react/jsx-dev-runtime", "@tanstack/react-query", "@tanstack/query-core"],
  },
}));
