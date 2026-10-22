// Runs in <head> before the page paints, so a saved theme never flashes.
try {
  const saved = localStorage.getItem("theme");
  if (saved === "light" || saved === "dark") document.documentElement.dataset.theme = saved;
} catch {
  // Storage unavailable (private mode, blocked cookies): fall back to the device setting.
}
