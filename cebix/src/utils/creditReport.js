import { formatDateTime } from "./intl";
import { RISK_COLORS } from "./riskColors";
import logoFira from "../assets/acerca/logo-fira.webp";

/**
 * Genera y descarga el reporte de elegibilidad en PDF de una parcela, con los
 * mismos datos que se muestran en el panel (rendimiento, score, variables, SHAP local).
 * No hay texto de relleno: todos los valores vienen del objeto `parcel` real.
 *
 * jsPDF pesa bastante (~350 KB): se descarga solo al generar el primer reporte.
 */

/* ---------- Paleta sobria (RGB) ---------- */
const INK = [24, 28, 33];
const MUTED = [107, 114, 122];
const RULE = [214, 218, 222];
const ZEBRA = [247, 248, 249];
const ACCENT = [122, 88, 26]; // brand-700, el dorado oscuro de la marca
const POS = [60, 122, 78];
const NEG = [184, 73, 59];

const hexToRgb = (hex) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));

/* ---------- Isotipo CEBIX (misma geometría que components/ui/Logo.jsx) ---------- */
const MARK_W = 697;
const MARK_H = 509;
const MARK_PATH = [
  "M16 0H206L453 253L195 508H0L258 253Z",
  "M689 0H501L377 122L471 222Z",
  "M374 374L501 508H696L471 283Z",
].join("");

/** Dibuja el isotipo en un canvas y lo devuelve como PNG (jsPDF no admite SVG). */
function markToPng(color = "#181c21") {
  try {
    const scale = 3;
    const canvas = document.createElement("canvas");
    canvas.width = MARK_W * scale;
    canvas.height = MARK_H * scale;
    const ctx = canvas.getContext("2d");
    ctx.scale(scale, scale);
    ctx.fillStyle = color;
    ctx.fill(new Path2D(MARK_PATH));
    return { data: canvas.toDataURL("image/png"), w: MARK_W, h: MARK_H };
  } catch {
    return null;
  }
}

/** Carga una imagen (webp incluido) y la convierte a PNG para jsPDF. */
function imageToPng(src) {
  return new Promise((resolve) => {
    if (typeof Image === "undefined") return resolve(null);
    const img = new Image();
    img.onload = () => {
      try {
        const canvas = document.createElement("canvas");
        canvas.width = img.naturalWidth;
        canvas.height = img.naturalHeight;
        const ctx = canvas.getContext("2d");
        ctx.fillStyle = "#ffffff";
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(img, 0, 0);
        resolve({ data: canvas.toDataURL("image/png"), w: img.naturalWidth, h: img.naturalHeight });
      } catch {
        resolve(null);
      }
    };
    img.onerror = () => resolve(null);
    img.src = src;
  });
}

/* ---------- Utilidades de formato ---------- */
const num = (v) => {
  const n = typeof v === "number" ? v : parseFloat(String(v ?? "").replace(",", "."));
  return Number.isFinite(n) ? n : null;
};
const fix = (v, d = 2, suffix = "") => {
  const n = num(v);
  return n === null ? "—" : `${n.toFixed(d)}${suffix}`;
};
/** Helvetica estándar de jsPDF solo cubre Latin-1: se cambian los símbolos que no existen. */
const clean = (v) =>
  String(v ?? "—")
    .replace(/[≥]/g, ">=")
    .replace(/[≤]/g, "<=")
    .replace(/[‘’]/g, "'")
    .replace(/[“”]/g, '"');

function riskRgb(parcel) {
  const hex = RISK_COLORS[parcel.riskColor];
  return hex ? hexToRgb(hex) : MUTED;
}

export async function generateCreditReportPDF(parcel, { modelSummary = null } = {}) {
  if (!parcel) throw new Error("No hay parcela para generar el reporte.");

  const [{ jsPDF }, fira] = await Promise.all([import("jspdf"), imageToPng(logoFira)]);
  const mark = markToPng();

  const doc = new jsPDF({ unit: "pt", format: "letter" });
  const PW = doc.internal.pageSize.getWidth();
  const PH = doc.internal.pageSize.getHeight();
  const M = 56; // margen lateral
  const R = PW - M; // borde derecho del contenido
  const TOP = 56;
  const BOTTOM = PH - 64;
  let y = TOP;

  const color = (rgb) => doc.setTextColor(rgb[0], rgb[1], rgb[2]);
  const stroke = (rgb) => doc.setDrawColor(rgb[0], rgb[1], rgb[2]);
  const fill = (rgb) => doc.setFillColor(rgb[0], rgb[1], rgb[2]);
  const font = (style, size, rgb = INK) => {
    doc.setFont("helvetica", style);
    doc.setFontSize(size);
    color(rgb);
  };
  const txt = (value, x, yy = y, opts) => doc.text(clean(value), x, yy, opts);
  const rule = (yy = y, rgb = RULE, w = 0.6) => {
    stroke(rgb);
    doc.setLineWidth(w);
    doc.line(M, yy, R, yy);
  };

  /* ---------- Encabezado de la primera página ---------- */
  const drawHeader = () => {
    const markH = 26;
    let x = M;
    if (mark) {
      const markW = (markH * mark.w) / mark.h;
      doc.addImage(mark.data, "PNG", x, y, markW, markH);
      x += markW + 8;
    }
    font("bold", 21, INK);
    txt("CEBIX", x, y + 21, { charSpace: 1 });

    if (fira) {
      const h = 34;
      const w = (h * fira.w) / fira.h;
      doc.addImage(fira.data, "PNG", R - w, y - 4, w, h);
    }
    y += markH + 14;
    rule(y, ACCENT, 1.4);
    y += 30;
  };
  drawHeader();

  /* ---------- Título ---------- */
  font("bold", 17, INK);
  txt("Reporte de elegibilidad crediticia", M);
  y += 17;
  font("normal", 9.5, MUTED);
  txt(`Generado el ${formatDateTime(new Date())}  ·  Reto AgroCebada 2026`, M);
  y += 28;

  /* Salto de página si el siguiente bloque no cabe. */
  const ensure = (needed) => {
    if (y + needed > BOTTOM) {
      doc.addPage();
      y = TOP;
    }
  };
  const sectionTitle = (title) => {
    ensure(48);
    font("bold", 8.5, ACCENT);
    txt(title.toUpperCase(), M, y, { charSpace: 0.8 });
    y += 7;
    rule(y);
    y += 6;
  };

  /* ---------- 1. Identificación de la parcela ---------- */
  sectionTitle("Identificación de la parcela");
  const lat = num(parcel.lat);
  const lng = num(parcel.lng);
  const area = String(parcel.area ?? "").trim() || "—";
  const idRows = [
    ["Nombre", parcel.name ?? "—"],
    ["Identificador", String(parcel.polygonId ?? parcel.id ?? "—")],
    ["Municipio", parcel.municipio ?? "—"],
    ["Estado", parcel.region ?? "—"],
    ["Superficie", area],
    ["Coordenadas", lat !== null && lng !== null ? `${lat.toFixed(5)}, ${lng.toFixed(5)}` : "Sin coordenadas"],
    ["Origen del dato", parcel.isCustom ? "Registro manual en CEBIX" : "Corrida del modelo / dataset Reto AgroCebada 2026"],
  ];
  const kv = (rows, labelX = M + 6, valueX = M + 190) => {
    rows.forEach(([label, value], i) => {
      font("bold", 9.5, INK);
      const lines = doc.splitTextToSize(clean(value), R - valueX - 6);
      const rowH = Math.max(22, lines.length * 12 + 10);
      ensure(rowH);
      if (i % 2 === 0) {
        fill(ZEBRA);
        doc.rect(M, y, R - M, rowH, "F");
      }
      font("normal", 9.5, MUTED);
      txt(label, labelX, y + 14);
      font("bold", 9.5, INK);
      doc.text(lines, valueX, y + 14);
      y += rowH;
    });
  };
  kv(idRows);
  y += 26;

  /* ---------- 2. Resultado del modelo ---------- */
  sectionTitle("Resultado de la predicción");
  ensure(86);
  const ic = Array.isArray(parcel.ic90) ? parcel.ic90.map(num) : [];
  const hasIc = ic.length === 2 && ic[0] !== null && ic[1] !== null;
  const cells = [
    {
      label: "RENDIMIENTO ESPERADO",
      value: fix(parcel.yieldEstimate),
      unit: "ton/ha",
      note: hasIc ? `IC 90%: ${ic[0].toFixed(2)} – ${ic[1].toFixed(2)}` : `± ${fix(parcel.confidence)} ton/ha`,
    },
    { label: "SCORE DE ELEGIBILIDAD", value: String(parcel.score ?? "—"), unit: "/ 100", note: "Escala de 0 a 100" },
    { label: "CLASIFICACIÓN", value: String(parcel.risk ?? "—"), unit: "", note: "Semáforo de elegibilidad", dot: riskRgb(parcel) },
  ];
  const gap = 12;
  const cw = (R - M - gap * 2) / 3;
  const ch = 76;
  cells.forEach((c, i) => {
    const x = M + i * (cw + gap);
    stroke(RULE);
    doc.setLineWidth(0.8);
    doc.roundedRect(x, y, cw, ch, 4, 4, "S");
    font("bold", 7, MUTED);
    txt(c.label, x + 12, y + 17, { charSpace: 0.5 });
    let vx = x + 12;
    if (c.dot) {
      fill(c.dot);
      doc.circle(x + 17, y + 41, 5, "F");
      vx = x + 29;
    }
    const vSize = c.dot ? 15 : 22;
    font("bold", vSize, INK);
    txt(c.value, vx, y + 47);
    if (c.unit) {
      const w = doc.getTextWidth(clean(c.value));
      font("normal", 9, MUTED);
      txt(c.unit, vx + w + 4, y + 47);
    }
    font("normal", 8, MUTED);
    txt(c.note, x + 12, y + 65);
  });
  y += ch + 26;

  /* ---------- 3. Variables satelitales y climáticas ---------- */
  sectionTitle("Variables satelitales y climáticas del ciclo");
  kv([
    ["NDVI pico del ciclo", fix(parcel.ndvi, 3)],
    ["EVI", fix(parcel.evi, 3)],
    ["Precipitación acumulada", `${fix(parcel.precip, 0)} mm`],
    ["Grados-día de crecimiento (GDD)", fix(parcel.gdd, 0)],
  ]);
  y += 26;

  /* ---------- 4. SHAP local ---------- */
  sectionTitle("Variables que explican la predicción (SHAP local)");
  const shap = (Array.isArray(parcel.shap) ? parcel.shap : [])
    .map((item) => ({ feature: item?.feature ?? "—", impact: num(item?.impact ?? item?.value) ?? 0, direction: item?.direction }))
    .map((item) => ({ ...item, impact: item.direction === "negativo" ? -Math.abs(item.impact) : item.impact }))
    .sort((a, b) => Math.abs(b.impact) - Math.abs(a.impact));

  if (shap.length === 0) {
    font("normal", 9.5, MUTED);
    txt("Sin desglose SHAP disponible para esta parcela.", M + 6, y + 14);
    y += 26;
  } else {
    const max = Math.max(...shap.map((s) => Math.abs(s.impact)), 0.0001);
    const barCenter = M + 330;
    const barHalf = 95;
    font("normal", 7.5, MUTED);
    txt("Resta", barCenter - barHalf, y + 9);
    txt("Suma", barCenter + barHalf, y + 9, { align: "right" });
    y += 14;
    shap.forEach((item, i) => {
      ensure(22);
      if (i % 2 === 0) {
        fill(ZEBRA);
        doc.rect(M, y, R - M, 22, "F");
      }
      font("normal", 9.5, INK);
      const label = doc.splitTextToSize(clean(item.feature), 215)[0];
      doc.text(label, M + 6, y + 14.5);

      // Barra divergente alrededor del eje central.
      stroke(RULE);
      doc.setLineWidth(0.6);
      doc.line(barCenter, y + 4, barCenter, y + 18);
      const len = Math.max(1.5, (Math.abs(item.impact) / max) * barHalf);
      const positive = item.impact >= 0;
      fill(positive ? POS : NEG);
      doc.rect(positive ? barCenter : barCenter - len, y + 7, len, 8, "F");

      font("bold", 9.5, positive ? POS : NEG);
      txt(`${positive ? "+" : "-"}${Math.abs(item.impact).toFixed(3)}`, R - 6, y + 14.5, { align: "right" });
      y += 22;
    });
    y += 6;
    font("normal", 8, MUTED);
    const note = doc.splitTextToSize(
      "Cada barra indica cuánto sumó (verde) o restó (rojo) esa variable al rendimiento estimado de esta parcela, en ton/ha respecto al promedio del modelo.",
      R - M
    );
    ensure(note.length * 10 + 6);
    doc.text(note, M, y + 8);
    y += note.length * 10 + 10;
  }
  y += 14;

  /* ---------- 5. Nota metodológica ---------- */
  const modelNote = modelSummary
    ? `El rendimiento se estimó con ${modelSummary.modelName} (${modelSummary.validation}; RMSE ${modelSummary.rmse} ton/ha).`
    : "El rendimiento se estimó con el modelo predictivo de CEBIX.";
  font("normal", 8.5, MUTED);
  const method = doc.splitTextToSize(
    `${modelNote} El score y el semáforo de elegibilidad se derivan del rendimiento esperado, su incertidumbre y el vigor del cultivo (NDVI). Este documento es informativo y de apoyo a la decisión; no constituye por sí mismo una resolución de crédito.`,
    R - M
  );
  sectionTitle("Nota metodológica");
  font("normal", 8.5, MUTED);
  ensure(method.length * 11 + 6);
  doc.text(method, M, y + 8);
  y += method.length * 11 + 8;

  /* ---------- Pie de página en todas las hojas ---------- */
  const pages = doc.getNumberOfPages();
  for (let i = 1; i <= pages; i++) {
    doc.setPage(i);
    rule(PH - 48);
    font("normal", 8, MUTED);
    doc.text("CEBIX  ·  Reto AgroCebada 2026", M, PH - 34);
    doc.text(clean(parcel.name ?? ""), PW / 2, PH - 34, { align: "center", maxWidth: 220 });
    doc.text(`Página ${i} de ${pages}`, R, PH - 34, { align: "right" });
  }

  const safeId = String(parcel.polygonId || parcel.id || "parcela").replace(/[^\w.-]+/g, "_");
  const filename = `reporte-elegibilidad-${safeId}.pdf`;
  doc.save(filename);
  return filename;
}
