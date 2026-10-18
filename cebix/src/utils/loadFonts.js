const FONTS_HREF =
  "https://fonts.googleapis.com/css2?family=Bebas+Neue&family=Inter:wght@400;500;600;700;800&family=Poppins:wght@800&family=Sora:wght@500;600;700;800&display=swap";

export function loadFonts() {
  if (typeof document === "undefined" || document.getElementById("app-fonts")) return;

  const preconnect = (href, crossOrigin) => {
    const l = document.createElement("link");
    l.rel = "preconnect";
    l.href = href;
    if (crossOrigin) l.crossOrigin = "";
    document.head.appendChild(l);
  };
  preconnect("https://fonts.googleapis.com");
  preconnect("https://fonts.gstatic.com", true);

  const link = document.createElement("link");
  link.id = "app-fonts";
  link.rel = "stylesheet";
  link.href = FONTS_HREF;
  document.head.appendChild(link);
}