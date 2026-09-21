import { useCallback, useState } from "react";
import { appStorage } from "../services/AppStorage";

const STORAGE_KEY = "cebix-account";

const DEFAULT_ACCOUNT = {
  name: "Ana Torres",
  email: "ana.torres@cebix.mx",
  role: "Administradora",
  avatar: "https://i.pravatar.cc/72?img=48",
  twoFactor: false,
};

function load() {
  const saved = appStorage.getJSON(STORAGE_KEY, null);
  return saved ? { ...DEFAULT_ACCOUNT, ...saved } : DEFAULT_ACCOUNT;
}

/** Cuenta de la persona que usa la app (perfil, 2FA, contraseña) — persistida en localStorage. */
export default function useAccount() {
  const [account, setAccount] = useState(load);

  const updateAccount = useCallback((patch) => {
    setAccount((prev) => {
      const next = { ...prev, ...patch };
      appStorage.setJSON(STORAGE_KEY, next);
      return next;
    });
  }, []);

  return { account, updateAccount };
}
