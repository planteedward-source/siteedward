import { build } from "esbuild";
import { loadEnv } from "vite";
import { rename } from "node:fs/promises";
const env = loadEnv("production", process.cwd(), "VITE_");
await build({
  entryPoints: ["src/App.jsx"],
  outfile: "dist/server/app.mjs",
  bundle: true,
  platform: "node",
  format: "esm",
  target: "node22",
  external: ["react", "react-dom", "@supabase/supabase-js"],
  define: {
    "import.meta.env": JSON.stringify({
      VITE_SUPABASE_URL: env.VITE_SUPABASE_URL,
      VITE_SUPABASE_PUBLISHABLE_KEY: env.VITE_SUPABASE_PUBLISHABLE_KEY,
    }),
  },
});
// Leave no static homepage that could bypass Vercel's server rewrite.
await rename("dist/index.html", "dist/server/template.html");
console.log("Server rendering bundle ready.");
