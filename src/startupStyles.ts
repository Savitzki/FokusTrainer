/** Keep the HTML splash visible while nonblocking application styles finish loading. */
export async function waitForStartupStyles(timeout = 15000) {
  await Promise.all(
    Array.from(
      document.querySelectorAll<HTMLLinkElement>("link[data-capibora-style]"),
      (link) =>
        new Promise<void>((resolve, reject) => {
          if (link.dataset.capiboraStyle === "failed") {
            reject(new Error("Não foi possível carregar o aplicativo"));
            return;
          }
          if (link.sheet || link.dataset.capiboraStyle === "ready") {
            link.media = "all";
            resolve();
            return;
          }
          const cleanup = () => {
            window.clearTimeout(timer);
            link.removeEventListener("load", loaded);
            link.removeEventListener("error", failed);
          };
          const loaded = () => {
            cleanup();
            link.media = "all";
            resolve();
          };
          const failed = () => {
            cleanup();
            reject(new Error("Não foi possível carregar o aplicativo"));
          };
          const timer = window.setTimeout(failed, timeout);
          link.addEventListener("load", loaded, { once: true });
          link.addEventListener("error", failed, { once: true });
        }),
    ),
  );
}

export function showStartupStyleError() {
  const loader = document.querySelector("#root .fokus-loading");
  if (!loader || loader.querySelector(".loading-recovery")) return;
  loader.classList.add("loading-failed");
  const recovery = document.createElement("div");
  recovery.className = "loading-recovery";
  const message = document.createElement("p");
  message.setAttribute("role", "alert");
  message.textContent = "Não foi possível carregar o aplicativo";
  const retry = document.createElement("button");
  retry.className = "primary-button";
  retry.textContent = "Tentar novamente";
  retry.addEventListener("click", () => window.location.reload());
  recovery.append(message, retry);
  loader.append(recovery);
}
