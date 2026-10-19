import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import "./styles.css";
import { initializeTheme } from "./theme";
import { waitForStartupStyles, showStartupStyleError } from "./startupStyles";

initializeTheme();

if (
  import.meta.env.PROD &&
  "serviceWorker" in navigator &&
  window.isSecureContext
) {
  window.addEventListener(
    "load",
    () => {
      void navigator.serviceWorker
        .register(new URL("sw.js", document.baseURI).href, {
          updateViaCache: "none",
        })
        .catch(() => {
          // The online app remains available if the browser blocks offline storage.
          console.warn("Não foi possível preparar o modo offline do Capibora.");
        });
    },
    { once: true },
  );
}

// Adopt the already visible startup screen instead of clearing it and flashing the page background.
void waitForStartupStyles().then(() => {
  ReactDOM.hydrateRoot(
    document.getElementById("root")!,
    <React.StrictMode>
      <App />
    </React.StrictMode>,
  );
}, showStartupStyleError);
