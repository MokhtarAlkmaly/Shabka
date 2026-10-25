import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
// خط Tajawal مضمّن داخل التطبيق ليعمل بدون إنترنت
import "@fontsource/tajawal/arabic-400.css";
import "@fontsource/tajawal/arabic-500.css";
import "@fontsource/tajawal/arabic-700.css";
import "@fontsource/tajawal/arabic-800.css";
import "@fontsource/tajawal/arabic-900.css";
import "@fontsource/tajawal/latin-400.css";
import "@fontsource/tajawal/latin-700.css";
import "./index.css";
import App from "./App";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>
);
