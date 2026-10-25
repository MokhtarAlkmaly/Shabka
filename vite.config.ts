import { createHash } from "crypto";
import { execSync } from "child_process";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig, type Plugin } from "vite";
import { viteSingleFile } from "vite-plugin-singlefile";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/* ------------------------------------------------------------------ */
/*                 معلومات النسخة (لإشعارات التحديث)                    */
/* ------------------------------------------------------------------ */

/** معرّف النسخة = رقم الـ commit (نفسه على Vercel و GitHub Actions) */
function buildId(): string {
  const env = process.env.VERCEL_GIT_COMMIT_SHA || process.env.GITHUB_SHA;
  if (env) return env;
  try {
    return execSync("git rev-parse HEAD", { cwd: __dirname, stdio: ["ignore", "pipe", "ignore"] })
      .toString()
      .trim();
  } catch {
    return `local-${Date.now()}`;
  }
}

function walk(dir: string, skip: (rel: string) => boolean, base = dir, out: string[] = []): string[] {
  if (!fs.existsSync(dir)) return out;
  for (const e of fs.readdirSync(dir, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))) {
    const full = path.join(dir, e.name);
    const rel = path.relative(base, full).split(path.sep).join("/");
    if (skip(rel)) continue;
    if (e.isDirectory()) walk(full, skip, base, out);
    else out.push(full);
  }
  return out;
}

/**
 * بصمة الجزء الأصلي (Native) من تطبيق أندرويد.
 * إذا تغيرت (إضافة/تحديث إضافة Capacitor، الصلاحيات، الأيقونة، الإعدادات...)
 * فالتحديث يحتاج تثبيت APK جديد، وإلا يكفي تحديث الواجهة مباشرة داخل التطبيق.
 */
function nativeHash(): string {
  const h = createHash("sha256");
  try {
    const lock = JSON.parse(fs.readFileSync(path.join(__dirname, "package-lock.json"), "utf8"));
    const pkgs = Object.entries(lock.packages ?? {})
      .filter(([k]) => /^node_modules\/@(capacitor|capgo)\/[^/]+$/.test(k) && k !== "node_modules/@capacitor/cli")
      .map(([k, v]) => `${k}@${(v as { version?: string }).version}`)
      .sort();
    h.update(pkgs.join("\n"));
  } catch {
    /* ignore */
  }
  const files = [
    "capacitor.config.ts",
    "android/build.gradle",
    "android/variables.gradle",
    "android/app/build.gradle",
    ...walk(path.join(__dirname, "android/app/src/main"), (rel) => rel === "assets" || rel === "res/xml/config.xml").map(
      (f) => path.relative(__dirname, f)
    ),
  ];
  for (const f of files) {
    const full = path.join(__dirname, f);
    if (!fs.existsSync(full)) continue;
    h.update(f.split(path.sep).join("/"));
    h.update(fs.readFileSync(full));
  }
  return h.digest("hex").slice(0, 16);
}

const APP_BUILD = buildId();
const NATIVE_HASH = nativeHash();

/** يكتب dist/version.json ليقارن التطبيق نسخته بآخر نسخة منشورة */
function versionFile(): Plugin {
  return {
    name: "shabka-version-file",
    apply: "build",
    generateBundle() {
      this.emitFile({
        type: "asset",
        fileName: "version.json",
        source: JSON.stringify(
          { build: APP_BUILD, nativeHash: NATIVE_HASH, date: new Date().toISOString() },
          null,
          2
        ),
      });
    },
  };
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss(), viteSingleFile(), versionFile()],
  define: {
    __APP_BUILD__: JSON.stringify(APP_BUILD),
    __NATIVE_HASH__: JSON.stringify(NATIVE_HASH),
  },
  server: { host: "0.0.0.0", allowedHosts: true },
  preview: { host: "0.0.0.0", allowedHosts: true },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "src"),
    },
  },
});
