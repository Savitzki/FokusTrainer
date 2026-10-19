import { useState, useSyncExternalStore } from "react";
import { CAPIBORA } from "./brand";
import { BRAND_ASSETS } from "./brandAssets";
const currentTheme = () =>
  document.documentElement.dataset.theme === "light" ? "light" : "dark";
function subscribeTheme(onChange: () => void) {
  const observer = new MutationObserver(onChange);
  observer.observe(document.documentElement, {
    attributes: true,
    attributeFilter: ["data-theme"],
  });
  return () => observer.disconnect();
}
/** The real logo when supplied; otherwise the wordmark, never a mascot substitute. */
export default function Brand({
  full = false,
  symbol = false,
}: {
  full?: boolean;
  symbol?: boolean;
}) {
  const theme = useSyncExternalStore(
    subscribeTheme,
    currentTheme,
    () => "dark",
  );
  const [failed, setFailed] = useState<string | undefined>();
  const source =
    symbol && BRAND_ASSETS.symbol
      ? BRAND_ASSETS.symbol
      : full && BRAND_ASSETS.fullLogo
        ? BRAND_ASSETS.fullLogo
        : ((theme === "light"
            ? BRAND_ASSETS.lightLogo
            : BRAND_ASSETS.darkLogo) ?? BRAND_ASSETS.logo);
  return source && source !== failed ? (
    <img
      className={`brand-logo ${symbol ? "brand-logo-symbol" : full ? "brand-logo-full" : ""}`}
      src={source}
      alt={CAPIBORA.name}
      decoding="async"
      onError={() => setFailed(source)}
    />
  ) : (
    <span className="brand-wordmark">{CAPIBORA.name}</span>
  );
}
