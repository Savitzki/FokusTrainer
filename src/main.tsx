import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import "./styles.css";
import { initializeTheme } from "./theme";

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
          console.warn(
            "Não foi possível preparar o modo offline do FokusTrainer.",
          );
        });
    },
    { once: true },
  );
}

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
