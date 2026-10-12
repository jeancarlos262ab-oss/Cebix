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

export const getLocale = () => current.idioma;

/* Construir un Intl.DateTimeFormat / Intl.NumberFormat es MUY caro (sobre todo con timeZone u opciones), y estas
 * funciones se llaman por cada fila de cada tabla en cada render. Se crean una sola vez por combinación
 * idioma + opciones y se reutilizan. */
const formatters = new Map();
function cached(Ctor, locale, options) {
  const key = `${Ctor.name}|${locale}|${options ? JSON.stringify(options) : ""}`;
  let f = formatters.get(key);
  if (!f) {
    f = new Ctor(locale, options);
    formatters.set(key, f);
  }
  return f;
}
const dateFormat = (locale, options) => cached(Intl.DateTimeFormat, locale, options);
const numberFormat = (locale, options) => cached(Intl.NumberFormat, locale, options);

const validZones = new Map();
function safeTimeZone(tz) {
  if (validZones.has(tz)) return validZones.get(tz);
  let ok;
  try {
    new Intl.DateTimeFormat("en", { timeZone: tz });
    ok = tz;
  } catch {
    ok = undefined; // zona inválida: usa la del dispositivo
  }
  validZones.set(tz, ok);
  return ok;
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
  const parts = dateFormat("en-US", {
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
  return dateFormat(current.idioma, {
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
  return dateFormat(current.idioma, {
    timeZone: safeTimeZone(current.zonaHoraria),
    year: "numeric",
    month: "long",
  }).format(d);
}

/** Separadores de miles y decimales según el idioma (1,234.5 en inglés; 1,234.5 en es-MX). */
export function formatNumber(value, options) {
  const n = Number(value);
  if (!Number.isFinite(n)) return "—";
  return numberFormat(current.idioma, options).format(n);
}

/** "Ciudad de México (GMT-6)" con el desfase real de la zona en este momento. */
export function timeZoneOffsetLabel(tz, locale = current.idioma) {
  try {
    const part = dateFormat(locale, { timeZone: tz, timeZoneName: "shortOffset" })
      .formatToParts(new Date())
      .find((p) => p.type === "timeZoneName");
    return part?.value ?? "";
  } catch {
    return "";
  }
}
