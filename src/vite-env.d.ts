/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_OPENCELLID_KEY?: string;
  readonly VITE_GITHUB_REPO?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

/** معرّف النسخة (commit SHA) — يُحقن وقت البناء */
declare const __APP_BUILD__: string;
/** بصمة الجزء الأصلي من تطبيق أندرويد — يُحقن وقت البناء */
declare const __NATIVE_HASH__: string;
