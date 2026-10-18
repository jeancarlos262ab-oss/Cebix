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

export function PreferencesProvider({ children }) {
  const [region, setRegion] = useState(load);

  
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