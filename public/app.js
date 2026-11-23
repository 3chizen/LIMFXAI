// LIMFXAI — ordered classic-script loader.
// Classic scripts share the global lexical scope used by the existing app.
(async () => {
  const baseUrl = document.currentScript?.src || new URL("./app.js", location.href).href;
  const files = [
    "utils.js",
    "wallet-auth.js",
    "trading-sim.js",
    "market-forensics.js",
    "ui-effects.js",
  ];

  for (const file of files) {
    await new Promise((resolve, reject) => {
      const script = document.createElement("script");
      script.src = new URL(file, baseUrl).href;
      script.async = false;
      script.onload = resolve;
      script.onerror = () => reject(new Error(`Failed to load LIMFXAI script: ${file}`));
      document.head.append(script);
    });
  }
})().catch((error) => {
  console.error("LIMFXAI initialization failed:", error);
  const status = document.getElementById("authStatus") || document.getElementById("research");
  if (status) status.textContent = error.message;
});
