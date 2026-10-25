import type { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
  appId: "com.mokhtaralkmaly.shabka",
  appName: "شبكة - تغطية اليمن",
  webDir: "dist",
  android: {
    // يسمح بتحميل بلاطات الخرائط من خوادم https فقط
    allowMixedContent: false,
  },
};

export default config;
