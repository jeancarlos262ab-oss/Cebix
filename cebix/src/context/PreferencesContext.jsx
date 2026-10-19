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

const STORAGE_KEY = "cebix-region";

function load() {
  const saved = appStorage.getJSON(STORAGE_KEY, null);
  const { idioma: _legacy, ...rest } = saved ?? {};
  return { ...DEFAULT_REGION, ...rest };
}

const PreferencesContext = createContext(null);

export function PreferencesProvider({ children }) {
  const [region, setRegion] = useState(load);

  
  setIntlPrefs(region);

  useEffect(() => {
    appStorage.setJSON(STORAGE_KEY, region);
    document.documentElement.lang = "es";
  }, [region]);

  const value = useMemo(() => {
    return {
      ...region,
      setFormatoFecha: (formatoFecha) => setRegion((r) => ({ ...r, formatoFecha })),
      setZonaHoraria: (zonaHoraria) => setRegion((r) => ({ ...r, zonaHoraria })),
      resetRegion: () => setRegion({ ...DEFAULT_REGION }),
      formatDate,
      formatTime,
      formatDateTime,
      formatMonthYear,
      formatNumber,
    };
  }, [region]);

  const key = `${region.formatoFecha}|${region.zonaHoraria}`;
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