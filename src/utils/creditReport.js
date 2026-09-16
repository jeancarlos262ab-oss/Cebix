import { jsPDF } from "jspdf";

/**
 * Genera y descarga un reporte de crédito en PDF para una parcela, con los
 * mismos datos que se muestran en el panel (rendimiento, score, SHAP local).
 * No hay texto de relleno: todos los valores vienen del objeto `parcel` real.
 */
export function generateCreditReportPDF(parcel, { submitted = false } = {}) {
  const doc = new jsPDF({ unit: "pt", format: "letter" });
  const marginX = 56;
  let y = 64;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(18);
  doc.text("CEBIX — Reporte de elegibilidad crediticia", marginX, y);

  y += 20;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.setTextColor(110);
  doc.text(`Generado el ${new Date().toLocaleString("es-MX")}`, marginX, y);
  doc.setTextColor(0);

  y += 26;
  doc.setDrawColor(220);
  doc.line(marginX, y, 556, y);

  y += 26;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(13);
  doc.text(parcel.name, marginX, y);
  y += 16;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.text(`${parcel.municipio}, ${parcel.region} · ID ${parcel.polygonId} · ${parcel.area}`, marginX, y);

  y += 30;
  const fields = [
    ["Rendimiento esperado", `${parcel.yieldEstimate.toFixed(2)} ton/ha (± ${parcel.confidence.toFixed(2)})`],
    ["Score de elegibilidad", `${parcel.score} / 100 — ${parcel.risk}`],
    ["NDVI pico del ciclo", parcel.ndvi.toFixed(3)],
    ["EVI", parcel.evi.toFixed(3)],
    ["Precipitación acumulada", `${parcel.precip} mm`],
    ["Grados-día de crecimiento (GDD)", `${parcel.gdd}`],
    ["Coordenadas", `${parcel.lat.toFixed(5)}, ${parcel.lng.toFixed(5)}`],
    ["Origen del dato", parcel.isCustom ? "Registrada manualmente en CEBIX" : "Dataset Reto AgroCebada 2026"],
  ];

  doc.setFontSize(10.5);
  for (const [label, value] of fields) {
    doc.setFont("helvetica", "normal");
    doc.setTextColor(100);
    doc.text(label, marginX, y);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(20);
    doc.text(String(value), 300, y);
    y += 18;
  }

  y += 12;
  doc.setDrawColor(220);
  doc.line(marginX, y, 556, y);
  y += 24;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(12);
  doc.text("Variables que explican la predicción (SHAP local)", marginX, y);
  y += 20;

  doc.setFontSize(10);
  for (const item of parcel.shap ?? []) {
    doc.setFont("helvetica", "normal");
    doc.setTextColor(20);
    const sign = item.impact >= 0 ? "+" : "";
    doc.text(`• ${item.feature}`, marginX + 8, y);
    doc.setTextColor(item.impact >= 0 ? [76, 154, 99] : [192, 54, 46]);
    doc.text(`${sign}${item.impact.toFixed(3)}`, 460, y);
    doc.setTextColor(0);
    y += 16;
  }

  y += 20;
  doc.setDrawColor(220);
  doc.line(marginX, y, 556, y);
  y += 24;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(12);
  doc.text("Estado de la solicitud", marginX, y);
  y += 18;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.text(
    submitted
      ? "Enviada al comité de crédito de CEBIX para revisión."
      : "Reporte generado para revisión interna; aún no enviado al comité de crédito.",
    marginX,
    y
  );

  doc.setFontSize(8);
  doc.setTextColor(150);
  doc.text(
    "CEBIX — Reto AgroCebada 2026. Score calculado con un modelo Ridge validado espacialmente (leave-region-out).",
    marginX,
    770
  );

  const filename = `reporte-credito-${parcel.polygonId || parcel.id}.pdf`;
  doc.save(filename);
  return filename;
}
