import { createContext, useCallback, useContext, useMemo, useState } from "react";
import { users as baseUsers } from "../data/users";
import { appStorage } from "../services/AppStorage";

const STORAGE_KEY = "cebix-users-overrides"; // { invited: User[], patches: Record<id, Partial<User>> }

const loadState = () => appStorage.getJSON(STORAGE_KEY, { invited: [], patches: {} });
const persistState = (state) => appStorage.setJSON(STORAGE_KEY, state);

function nextId(all) {
  return all.reduce((max, u) => Math.max(max, u.id), 0) + 1;
}

const UsersContext = createContext(null);

export function UsersProvider({ children }) {
  const [state, setState] = useState(loadState);

  const users = useMemo(() => {
    const merged = [...baseUsers, ...state.invited].map((u) => ({
      ...u,
      ...(state.patches[u.id] ?? {}),
    }));
    return merged;
  }, [state]);

  const inviteUser = useCallback((fields) => {
    setState((prev) => {
      const id = nextId([...baseUsers, ...prev.invited]);
      const record = {
        id,
        name: fields.name,
        email: fields.email,
        role: fields.role,
        region: fields.region,
        avatar: `https://i.pravatar.cc/72?img=${(id % 70) + 1}`,
        status: "Invitado",
        twoFactor: false,
      };
      const next = { ...prev, invited: [...prev.invited, record] };
      persistState(next);
      return next;
    });
  }, []);

  const updateUser = useCallback((id, patch) => {
    setState((prev) => {
      const next = { ...prev, patches: { ...prev.patches, [id]: { ...prev.patches[id], ...patch } } };
      persistState(next);
      return next;
    });
  }, []);

  const value = useMemo(() => ({ users, inviteUser, updateUser }), [users, inviteUser, updateUser]);

  return <UsersContext.Provider value={value}>{children}</UsersContext.Provider>;
}

export function useUsers() {
  const ctx = useContext(UsersContext);
  if (!ctx) throw new Error("useUsers debe usarse dentro de <UsersProvider>");
  return ctx;
}
