/**
 * Carga las fuentes de Google SIN bloquear el primer pintado.
 *
 * Antes iban en un `@import url(...)` dentro de index.css: el navegador tenía que descargar ese CSS (y, de ahí, el de
 * Google Fonts) antes de pintar nada. Un <link> insertado desde JS no bloquea el render, y `display=swap` muestra el
 * texto de inmediato con la fuente del sistema hasta que llega la tipografía. El preconnect adelanta la conexión.
 * (Si prefieres, puedes poner estos mismos 3 <link> directo en index.html.)
 */
const FONTS_HREF =
  "https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&family=Poppins:wght@800&family=Sora:wght@500;600;700;800&display=swap";

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
