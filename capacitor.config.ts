import type { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
  appId: "com.mokhtaralkmaly.shabka",
  appName: "شبكة - تغطية اليمن",
  webDir: "dist",
  android: {
    // يسمح بتحميل بلاطات الخرائط من خوادم https فقط
    allowMixedContent: false,
  },
  plugins: {
    // تحديث الواجهة داخل التطبيق (يدوي: التطبيق نفسه يفحص GitHub Releases ويعرض إشعاراً)
    CapacitorUpdater: {
      autoUpdate: false,
      statsUrl: "",
      resetWhenUpdate: true,
      appReadyTimeout: 15000,
    },
  },
};

export default config;
