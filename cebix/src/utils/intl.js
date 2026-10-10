/**
 * Formato regional compartido.
 *
 * Guarda las preferencias activas de "Idioma y región" (las actualiza PreferencesProvider)
 * para que también las usen funciones fuera de React (PDF, utilidades, etc.).
 */
export const DEFAULT_REGION = {
  idioma: "es-MX",
  formatoFecha: "dd/mm/aaaa",
  zonaHoraria: "America/Mexico_City",
};

let current = { ...DEFAULT_REGION };

export function setIntlPrefs(prefs) {
  current = { ...DEFAULT_REGION, ...prefs };
}

export const getIntlPrefs = () => current;
export const getLocale = () => current.idioma;

function safeTimeZone(tz) {
  try {
    new Intl.DateTimeFormat("en", { timeZone: tz });
    return tz;
  } catch {
    return undefined; // zona inválida: usa la del dispositivo
  }
}

function toDate(value) {
  if (value === null || value === undefined || value === "") return null;
  const d = value instanceof Date ? value : new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}

/** 10/10/2026 o 10/10/2026 según "Formato de fecha", en la zona horaria elegida. */
export function formatDate(value) {
  const d = toDate(value);
  if (!d) return "—";
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: safeTimeZone(current.zonaHoraria),
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).formatToParts(d);
  const get = (type) => parts.find((p) => p.type === type)?.value ?? "";
  const day = get("day");
  const month = get("month");
  const year = get("year");
  return current.formatoFecha === "mm/dd/aaaa" ? `${month}/${day}/${year}` : `${day}/${month}/${year}`;
}

/** Hora en la zona elegida: 24 h en español, 12 h (AM/PM) en inglés. */
export function formatTime(value) {
  const d = toDate(value);
  if (!d) return "—";
  const english = current.idioma.startsWith("en");
  return new Intl.DateTimeFormat(current.idioma, {
    timeZone: safeTimeZone(current.zonaHoraria),
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: english ? "h12" : "h23",
  }).format(d);
}

export function formatDateTime(value) {
  const d = toDate(value);
  if (!d) return "—";
  return `${formatDate(d)} ${formatTime(d)}`;
}

/** "octubre de 2026" / "October 2026". */
export function formatMonthYear(value) {
  const d = toDate(value);
  if (!d) return "—";
  return new Intl.DateTimeFormat(current.idioma, {
    timeZone: safeTimeZone(current.zonaHoraria),
    year: "numeric",
    month: "long",
  }).format(d);
}

/** Separadores de miles y decimales según el idioma (1,234.5 en inglés; 1,234.5 en es-MX). */
export function formatNumber(value, options) {
  const n = Number(value);
  if (!Number.isFinite(n)) return "—";
  return n.toLocaleString(current.idioma, options);
}

/** "Ciudad de México (GMT-6)" con el desfase real de la zona en este momento. */
export function timeZoneOffsetLabel(tz, locale = current.idioma) {
  try {
    const part = new Intl.DateTimeFormat(locale, { timeZone: tz, timeZoneName: "shortOffset" })
      .formatToParts(new Date())
      .find((p) => p.type === "timeZoneName");
    return part?.value ?? "";
  } catch {
    return "";
  }
}
