const LOCALE = "es-MX";

export const DEFAULT_REGION = {
  formatoFecha: "dd/mm/aaaa",
  zonaHoraria: "America/Mexico_City",
};

let current = { ...DEFAULT_REGION };

export function setIntlPrefs(prefs) {
  current = { ...DEFAULT_REGION, ...prefs };
}

export const getLocale = () => LOCALE;

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
    ok = undefined; 
  }
  validZones.set(tz, ok);
  return ok;
}

function toDate(value) {
  if (value === null || value === undefined || value === "") return null;
  const d = value instanceof Date ? value : new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}

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

export function formatTime(value) {
  const d = toDate(value);
  if (!d) return "—";
  return dateFormat(LOCALE, {
    timeZone: safeTimeZone(current.zonaHoraria),
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).format(d);
}

export function formatDateTime(value) {
  const d = toDate(value);
  if (!d) return "—";
  return `${formatDate(d)} ${formatTime(d)}`;
}

export function formatMonthYear(value) {
  const d = toDate(value);
  if (!d) return "—";
  return dateFormat(LOCALE, {
    timeZone: safeTimeZone(current.zonaHoraria),
    year: "numeric",
    month: "long",
  }).format(d);
}

export function formatNumber(value, options) {
  const n = Number(value);
  if (!Number.isFinite(n)) return "—";
  return numberFormat(LOCALE, options).format(n);
}

export function timeZoneOffsetLabel(tz, locale = LOCALE) {
  try {
    const part = dateFormat(locale, { timeZone: tz, timeZoneName: "shortOffset" })
      .formatToParts(new Date())
      .find((p) => p.type === "timeZoneName");
    return part?.value ?? "";
  } catch {
    return "";
  }
}

export function formatFixed(value, decimals = 1) {
  return formatNumber(value, { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
}