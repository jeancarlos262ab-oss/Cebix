import { useCallback, useState } from "react";

const STORAGE_KEY = "cebix-account";
const LEGACY_KEY = "cebix-users-overrides";

const DEFAULT_ACCOUNT = {
  name: "Ana Torres",
  email: "ana.torres@cebix.mx",
  role: "Administradora",
  avatar: "https://i.pravatar.cc/72?img=48",
  twoFactor: false,
};

function load() {
  try {
    window.localStorage.removeItem(LEGACY_KEY);
    const raw = window.localStorage.getItem(STORAGE_KEY);
    return raw ? { ...DEFAULT_ACCOUNT, ...JSON.parse(raw) } : DEFAULT_ACCOUNT;
  } catch {
    return DEFAULT_ACCOUNT;
  }
}

/** Cuenta de la persona que usa la app (perfil, 2FA, contraseña) — persistida en localStorage. */
export default function useAccount() {
  const [account, setAccount] = useState(load);

  const updateAccount = useCallback((patch) => {
    setAccount((prev) => {
      const next = { ...prev, ...patch };
      try {
        window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      } catch {
        // ignore
      }
      return next;
    });
  }, []);

  return { account, updateAccount };
}
