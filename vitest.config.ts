import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import { fileURLToPath } from "node:url";

export default defineConfig({
  plugins: [
    react(),
    // #CLASSIC-PARITY-1008 — i moduli condivisi caricano il filone classic con
    // `require("@/…")` dentro il ramo del flag di build (così a flag spento
    // Turbopack non lo segue). Il `require` di Node non conosce l'alias `@/` né
    // il TSX: nei test a flag acceso diventa un import statico in testa al
    // modulo (stesso grafo, stessi mock). A flag spento il ramo non si esegue.
    {
      name: "classic-require",
      enforce: "pre",
      transform(code, id) {
        if (process.env.NEXT_PUBLIC_CLASSIC !== "1" || id.includes("/node_modules/") || !code.includes('require("@/')) return null;
        const ids: string[] = [];
        const out = code.replace(/\brequire\("(@\/[^"]+)"\)/g, (_m, spec: string) => {
          ids.push(spec);
          return `__classicReq${ids.length - 1}`;
        });
        return ids.map((spec, i) => `import * as __classicReq${i} from "${spec}";\n`).join("") + out;
      },
    },
  ],
  // #CLASSIC-PARITY-1008 — lo stesso flag di build di next.config.ts (compiler.define).
  define: { __CLASSIC_BUILD__: JSON.stringify(process.env.NEXT_PUBLIC_CLASSIC === "1") },
  resolve: {
    alias: { "@": fileURLToPath(new URL("./", import.meta.url)) },
  },
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: ["./vitest.setup.ts"],
    include: ["{app,lib,components,features}/**/*.test.{ts,tsx}"],
  },
});
