import { formatDate, formatDateTime } from "./intl";
import { RISK_COLORS } from "./riskColors";

const INK = [0, 0, 0];
const MUTED = [150, 150, 150];
const RULE = [200, 200, 200];
const BAND = [228, 230, 233]; 
const POS = [60, 122, 78];
const NEG = [184, 73, 59];

const hexToRgb = (hex) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));

const MARK_W = 697;
const MARK_H = 509;
const MARK_PATH = [
  "M16 0H206L453 253L195 508H0L258 253Z",
  "M689 0H501L377 122L471 222Z",
  "M374 374L501 508H696L471 283Z",
].join("");

async function logoToPng(color = "#000000") {
  try {
    const E = 160; 
    const family = '"Garet", "Poppins", -apple-system, "Segoe UI", sans-serif';
    const fontSpec = `800 ${E}px ${family}`;
    try {
      await document.fonts.load(fontSpec, "CEBIX");
    } catch {
      
    }
    const markH = 1.05 * E;
    const markW = (markH * MARK_W) / MARK_H;
    const gap = 0.32 * E;

    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d");
    ctx.font = fontSpec;
    if ("letterSpacing" in ctx) ctx.letterSpacing = `${-0.025 * E}px`;
    const metrics = ctx.measureText("CEBIX");
    const textW = Math.ceil(metrics.width);
    const capH = metrics.actualBoundingBoxAscent;

    canvas.width = Math.ceil(markW + gap + textW + 4);
    canvas.height = Math.ceil(markH);
    
    ctx.font = fontSpec;
    if ("letterSpacing" in ctx) ctx.letterSpacing = `${-0.025 * E}px`;
    ctx.fillStyle = color;

    ctx.save();
    ctx.scale(markW / MARK_W, markH / MARK_H);
    ctx.fill(new Path2D(MARK_PATH));
    ctx.restore();

    ctx.textBaseline = "alphabetic";
    ctx.fillText("CEBIX", markW + gap, markH / 2 + capH / 2);
    return { data: canvas.toDataURL("image/png"), w: canvas.width, h: canvas.height };
  } catch {
    return null;
  }
}

const num = (v) => {
  const n = typeof v === "number" ? v : parseFloat(String(v ?? "").replace(",", "."));
  return Number.isFinite(n) ? n : null;
};
const fix = (v, d = 2, suffix = "") => {
  const n = num(v);
  return n === null ? "—" : `${n.toFixed(d)}${suffix}`;
};

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

import { MODE_CAVEAT, MODE_DESC, MODE_LABEL, modeModelNote, reportMode, stageRain } from "./reportMode";

export async function generateCreditReportPDF(parcel, { modelSummary = null, modelModes = null } = {}) {
  if (!parcel) throw new Error("No hay parcela para generar el reporte.");

  const [{ jsPDF }, logo] = await Promise.all([import("jspdf"), logoToPng()]);
  

  
  const doc = new jsPDF({ unit: "pt", format: "letter" });
  const PW = doc.internal.pageSize.getWidth(); 
  const PH = doc.internal.pageSize.getHeight(); 
  const M = 30;
  const R = PW - M;
  const HEADER_H = 64;
  const FOOTER_H = 112;
  const FOOTER_Y = PH - FOOTER_H;

  const color = (rgb) => doc.setTextColor(rgb[0], rgb[1], rgb[2]);
  const stroke = (rgb) => doc.setDrawColor(rgb[0], rgb[1], rgb[2]);
  const fill = (rgb) => doc.setFillColor(rgb[0], rgb[1], rgb[2]);
  const font = (style, size, rgb = INK) => {
    doc.setFont("helvetica", style);
    doc.setFontSize(size);
    color(rgb);
  };
  const txt = (value, x, y, opts) => doc.text(clean(value), x, y, opts);
  const hline = (y, x1 = M, x2 = R, rgb = RULE, w = 0.6) => {
    stroke(rgb);
    doc.setLineWidth(w);
    doc.line(x1, y, x2, y);
  };
  const wrap = (value, width) => doc.splitTextToSize(clean(value), width);

  
  fill(BAND);
  doc.rect(0, 0, PW, HEADER_H, "F");

  
  const boxX = M;
  const boxY = 21;
  const logoH = 22;
  if (logo) {
    doc.addImage(logo.data, "PNG", boxX, boxY, (logoH * logo.w) / logo.h, logoH);
  } else {
    font("bold", 15, INK);
    txt("CEBIX", boxX, boxY + 16);
  }

  font("bold", 16, INK);
  txt("REPORTE", R, 31, { align: "right" });
  font("normal", 7, INK);
  txt(`Apoyo a comité de crédito  ·  ${parcel.polygonId ?? parcel.id ?? "—"}`, R, 44, { align: "right" });

  
  const lat = num(parcel.lat);
  const lng = num(parcel.lng);
  const area = String(parcel.area ?? "").trim() || "—";
  const origin = parcel.isCustom ? "Registro manual en CEBIX" : "Corrida del modelo";
  const coords = lat !== null && lng !== null ? `${lat.toFixed(5)}, ${lng.toFixed(5)}` : "Sin coordenadas";

  const label = (t, x, y, opts) => {
    font("normal", 7, MUTED);
    txt(t, x, y, opts);
  };
  const strong = (t, x, y, opts) => {
    font("bold", 9, INK);
    txt(t, x, y, opts);
  };
  const soft = (t, x, y, opts) => {
    font("normal", 7.5, MUTED);
    txt(t, x, y, opts);
  };

  let y = HEADER_H + 34;
  label("PARCELA", M, y);
  strong(wrap(parcel.name ?? "—", 180)[0], M, y + 14);
  soft(`ID: ${parcel.polygonId ?? parcel.id ?? "—"}`, M, y + 28);
  soft(`${parcel.municipio ?? "—"}, ${parcel.region ?? "—"}`, M, y + 40);

  label("SUPERFICIE Y UBICACIÓN", 234, y);
  strong(area, 234, y + 14);
  soft(`Coordenadas: ${coords}`, 234, y + 28);
  font("normal", 7.5, MUTED);
  doc.text(wrap(`Origen: ${origin}`, 190).slice(0, 2), 234, y + 40);

  label("GENERADO", R - 105, y, { align: "right" });
  label("PROYECTO", R, y, { align: "right" });
  strong(formatDate(new Date()), R - 105, y + 14, { align: "right" });
  font("bold", 9, INK);
  txt("CEBIX", R, y + 14, { align: "right" });

  
  y += 78;
  const COL = { concept: M + 10, desc: 130, value: 410, unit: 470 };
  const tableHeader = (cols, yy) => {
    font("bold", 8, INK);
    cols.forEach(([t, x, opts]) => txt(t, x, yy, opts));
    hline(yy + 8, M, R, [150, 150, 150], 0.7);
  };
  tableHeader(
    [
      ["Variable", COL.concept],
      ["Descripción", COL.desc],
      ["Valor", COL.value],
      ["Unidad", COL.unit],
    ],
    y
  );
  y += 8;

  const ic = Array.isArray(parcel.ic90) ? parcel.ic90.map(num) : [];
  const hasIc = ic.length === 2 && ic[0] !== null && ic[1] !== null;
  const modo = reportMode(parcel);
  const rows = [
    ...(modo ? [["Modo de cálculo", MODE_DESC[modo], MODE_LABEL[modo], ""]] : []),
    ["IC 90%", "Intervalo de confianza del rendimiento", hasIc ? `${ic[0].toFixed(2)} – ${ic[1].toFixed(2)}` : `± ${fix(parcel.confidence)}`, "ton/ha"],
    ...(modo === "lluvia"
      ? [["Precipitación", "Lluvia abril-mayo (variable del modelo)", fix(parcel.precip, 0), "mm"]]
      : modo === "ciclo"
      ? [
          ["Lluvia abr-may", "Emergencia-macollamiento (CHIRPS)", fix(parcel.precip, 0), "mm"],
          ["Lluvia jun-jul", "Encañado (CHIRPS)", fix(stageRain(parcel)?.enc, 0), "mm"],
          ["Lluvia ago-sep", "Espigado-llenado (CHIRPS)", fix(stageRain(parcel)?.esp, 0), "mm"],
        ]
      : [
          ["NDVI", "Vigor del cultivo, pico del ciclo", fix(parcel.ndvi, 3), "índice"],
          ["EVI", "Índice de vegetación mejorado", fix(parcel.evi, 3), "índice"],
          ["Precipitación", "Lluvia abril-mayo (CHIRPS)", fix(parcel.precip, 0), "mm"],
          ["GDD", "Grados-día de crecimiento", fix(parcel.gdd, 0), "°C·día"],
        ]),
  ];
  const RH = 19;
  rows.forEach(([a, b, c, d]) => {
    font("normal", 8, INK);
    txt(a, COL.concept, y + 13);
    txt(b, COL.desc, y + 13);
    txt(c, COL.value, y + 13);
    txt(d, COL.unit, y + 13);
    y += RH;
    hline(y);
  });

  
  y += 6;
  const TX = 410;
  const totalRows = [
    ["Rendimiento esperado", `${fix(parcel.yieldEstimate)} ton/ha`],
    ["Índice de rendimiento esperado", `${parcel.score ?? "—"} / 100`],
  ];
  totalRows.forEach(([a, b]) => {
    font("normal", 8, INK);
    txt(a, TX, y + 14);
    txt(b, R - 10, y + 14, { align: "right" });
    y += 24;
    hline(y, TX, R);
  });
  
  hline(y + 1.5, TX, R, [170, 170, 170], 1.4);
  font("bold", 9, INK);
  txt("Clasificación", TX, y + 18);
  const dot = riskRgb(parcel);
  font("bold", 9, INK);
  const riskTxt = String(parcel.risk ?? "—");
  txt(riskTxt, R - 10, y + 18, { align: "right" });
  fill(dot);
  doc.circle(R - 10 - doc.getTextWidth(clean(riskTxt)) - 8, y + 15.5, 3.5, "F");
  const totalsBottom = y + 26;

  
  font("normal", 7, MUTED);
  doc.text(
    wrap(
      "El score (0 a 100) es la probabilidad estimada de superar 3.5 ton/ha, calculada con el rendimiento esperado y su incertidumbre (IC 90%). El semáforo se deriva de ese score.",
      300
    ),
    M + 10,
    y - 40
  );

  
  y = totalsBottom + 18;
  const shapAll = (Array.isArray(parcel.shap) ? parcel.shap : [])
    .map((item) => ({ feature: item?.feature ?? "—", impact: num(item?.impact ?? item?.value) ?? 0, direction: item?.direction }))
    .map((item) => ({ ...item, impact: item.direction === "negativo" ? -Math.abs(item.impact) : item.impact }))
    .sort((a, b) => Math.abs(b.impact) - Math.abs(a.impact));

  const barCenter = 360;
  const barHalf = 95;
  tableHeader(
    [
      ["Variables que explican la predicción (SHAP local)", COL.concept],
      ["Resta", barCenter - barHalf, { align: "left" }],
      ["Suma", barCenter + barHalf, { align: "right" }],
      ["Impacto", R - 10, { align: "right" }],
    ],
    y
  );
  y += 8;

  const availBottom = FOOTER_Y - 14;
  if (shapAll.length === 0) {
    font("normal", 8, MUTED);
    txt("Sin desglose SHAP disponible para esta parcela.", COL.concept, y + 14);
  } else {
    
    const SH = Math.min(18, Math.floor((availBottom - y) / Math.min(shapAll.length, 12)));
    const maxRows = Math.max(1, Math.floor((availBottom - y) / SH));
    const shap = shapAll.slice(0, maxRows);
    const max = Math.max(...shap.map((s) => Math.abs(s.impact)), 0.0001);
    shap.forEach((item) => {
      const mid = y + SH / 2;
      font("normal", 8, INK);
      txt(wrap(item.feature, 215)[0], COL.concept, mid + 2.8);
      stroke(RULE);
      doc.setLineWidth(0.6);
      doc.line(barCenter, y + 3, barCenter, y + SH - 3);
      const len = Math.max(1.5, (Math.abs(item.impact) / max) * barHalf);
      const positive = item.impact >= 0;
      fill(positive ? POS : NEG);
      doc.rect(positive ? barCenter : barCenter - len, mid - 3, len, 6, "F");
      font("bold", 8, positive ? POS : NEG);
      txt(`${positive ? "+" : "-"}${Math.abs(item.impact).toFixed(3)}`, R - 10, mid + 2.8, { align: "right" });
      y += SH;
      hline(y);
    });
  }

  
  fill(BAND);
  doc.rect(0, FOOTER_Y, PW, FOOTER_H, "F");

  const modelNote = modeModelNote(modo, modelSummary, modelModes);
  const fy = FOOTER_Y + 24;
  font("bold", 8.5, INK);
  txt("Nota metodológica:", M, fy);
  font("normal", 7, INK);
  doc.text(wrap(modelNote, 190), M, fy + 14);

  font("bold", 8.5, INK);
  txt("Interpretación:", 234, fy);
  font("normal", 7, INK);
  doc.text(
    wrap(
      "Cada barra SHAP indica cuánto sumó (verde) o restó (rojo) esa variable al rendimiento estimado de esta parcela, en ton/ha respecto al promedio del modelo. Este documento es informativo y de apoyo a la decisión; no constituye por sí mismo una resolución de crédito." + (MODE_CAVEAT[modo] ?? ""),
      R - 234
    ),
    234,
    fy + 14
  );

  font("normal", 6.5, INK);
  txt(`CEBIX  ·  Generado el ${formatDateTime(new Date())}`, M, PH - 14);
  txt(clean(parcel.name ?? ""), R, PH - 14, { align: "right", maxWidth: 220 });

  const safeId = String(parcel.polygonId || parcel.id || "parcela").replace(/[^\w.-]+/g, "_");
  const filename = `reporte-elegibilidad-${safeId}.pdf`;
  doc.save(filename);
  return filename;
}