/** Cache delivery assets, never large source artwork that the UI does not use. */
export function shouldPrecache(path) {
  if (path === "sw.js" || path.endsWith("README.md")) return false;
  if (/^brand\/[^/]+\.png$/.test(path)) return false;
  if (path.startsWith("mascot/"))
    return path.startsWith("mascot/web/") && path.endsWith(".webp");
  if (path.startsWith("images/"))
    return /^images\/(?:web\/|shop\/(?:frames|banners)\/web\/|achievements\/web\/).+\.webp$/.test(
      path,
    );
  return !/^(beast|blaze|champion|energy|king|knockout|pink-power|royal|thunder)\.png$/.test(
    path,
  );
}
