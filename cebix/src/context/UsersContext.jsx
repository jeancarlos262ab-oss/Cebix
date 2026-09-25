import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { useAuth } from "./AuthContext";
import { supabase } from "../services/supabaseClient";

function toUser(profile, currentUser) {
  return {
    id: profile.id,
    name: profile.name,
    email: profile.email ?? (profile.id === currentUser?.id ? currentUser.email : ""),
    role: profile.role,
    region: profile.region,
    avatar: profile.avatar_url ?? `https://i.pravatar.cc/72?u=${profile.id}`,
    status: profile.status,
    twoFactor: Boolean(profile.two_factor),
  };
}

function toProfilePatch(patch) {
  const fields = {
    name: patch.name,
    role: patch.role,
    region: patch.region,
    status: patch.status,
    avatar_url: patch.avatar ?? patch.avatar_url,
    two_factor: patch.twoFactor ?? patch.two_factor,
  };

  return Object.fromEntries(Object.entries(fields).filter(([, value]) => value !== undefined));
}

const UsersContext = createContext(null);

export function UsersProvider({ children }) {
  const { user, loading: authLoading } = useAuth();
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const loadUsers = useCallback(async () => {
    if (!user) {
      setUsers([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    const { data, error: queryError } = await supabase.from("profiles").select("*").order("created_at");
    if (queryError) {
      setError(queryError);
      setUsers([]);
    } else {
      setError(null);
      setUsers(data.map((profile) => toUser(profile, user)));
    }
    setLoading(false);
  }, [user]);

  useEffect(() => {
    if (!authLoading) loadUsers();
  }, [authLoading, loadUsers]);

  const updateUser = useCallback(async (id, patch) => {
    const profilePatch = toProfilePatch(patch);
    const { error: updateError } = await supabase.from("profiles").update(profilePatch).eq("id", id);
    if (updateError) return { error: updateError };

    setUsers((current) =>
      current.map((item) => (item.id === id ? { ...item, ...patch } : item))
    );
    return { error: null };
  }, []);

  const value = useMemo(
    () => ({ users, loading, error, updateUser, reloadUsers: loadUsers }),
    [users, loading, error, updateUser, loadUsers]
  );

  return <UsersContext.Provider value={value}>{children}</UsersContext.Provider>;
}

export function useUsers() {
  const ctx = useContext(UsersContext);
  if (!ctx) throw new Error("useUsers debe usarse dentro de <UsersProvider>");
  return ctx;
}
