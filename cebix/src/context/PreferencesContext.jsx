import { createContext, Fragment, useContext, useEffect, useMemo, useState } from "react";
import { appStorage } from "../services/AppStorage";
import {
  DEFAULT_REGION,
  formatDate,
  formatDateTime,
  formatMonthYear,
  formatNumber,
  formatTime,
  setIntlPrefs,
} from "../utils/intl";
import { TRANSLATIONS } from "../utils/translations";

const STORAGE_KEY = "cebix-region";

function load() {
  const saved = appStorage.getJSON(STORAGE_KEY, null);
  return { ...DEFAULT_REGION, ...(saved ?? {}) };
}

const PreferencesContext = createContext(null);

/**
 * Idioma, formato de fecha y zona horaria (ajuste "Idioma y región").
 * Se guardan en este dispositivo y se aplican a toda la app: textos traducidos con `t()`,
 * fechas, horas y números formateados con las funciones de `utils/intl`.
 *
 * Al cambiar una preferencia se vuelve a montar el contenido para que todas las pantallas
 * (incluidas las que ya estaban abiertas) se pinten con el nuevo formato.
 */
export function PreferencesProvider({ children }) {
  const [region, setRegion] = useState(load);

  // Debe estar al día antes de pintar a los hijos (también lo leen funciones fuera de React).
  setIntlPrefs(region);

  useEffect(() => {
    appStorage.setJSON(STORAGE_KEY, region);
    document.documentElement.lang = region.idioma.split("-")[0];
  }, [region]);

  const value = useMemo(() => {
    const dictionary = TRANSLATIONS[region.idioma];
    return {
      ...region,
      setIdioma: (idioma) => setRegion((r) => ({ ...r, idioma })),
      setFormatoFecha: (formatoFecha) => setRegion((r) => ({ ...r, formatoFecha })),
      setZonaHoraria: (zonaHoraria) => setRegion((r) => ({ ...r, zonaHoraria })),
      resetRegion: () => setRegion({ ...DEFAULT_REGION }),
      t: (text) => dictionary?.[text] ?? text,
      formatDate,
      formatTime,
      formatDateTime,
      formatMonthYear,
      formatNumber,
    };
  }, [region]);

  const key = `${region.idioma}|${region.formatoFecha}|${region.zonaHoraria}`;
  return (
    <PreferencesContext.Provider value={value}>
      <Fragment key={key}>{children}</Fragment>
    </PreferencesContext.Provider>
  );
}

export function usePreferences() {
  const ctx = useContext(PreferencesContext);
  if (!ctx) throw new Error("usePreferences debe usarse dentro de <PreferencesProvider>");
  return ctx;
}
