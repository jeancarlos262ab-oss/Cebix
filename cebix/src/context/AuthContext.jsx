import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { supabase } from "../services/supabaseClient";

const AuthContext = createContext(null);

async function fetchProfile(userId) {
  const { data, error } = await supabase.from("profiles").select("*").eq("id", userId).maybeSingle();
  if (error) throw error;
  return data;
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;

    const applySession = async (session) => {
      const nextUser = session?.user ?? null;
      let nextProfile = null;

      if (nextUser) {
        try {
          nextProfile = await fetchProfile(nextUser.id);
        } catch (error) {
          console.error("No se pudo cargar el perfil del usuario", error);
        }
      }

      if (!mounted) return;
      setUser(nextUser);
      setProfile(nextProfile);
      setLoading(false);
    };

    supabase.auth.getSession().then(({ data: { session } }) => applySession(session));

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      // Dejar que Supabase termine el callback antes de consultar la tabla.
      setTimeout(() => applySession(session), 0);
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  const signIn = useCallback(
    (email, password) => supabase.auth.signInWithPassword({ email, password }),
    []
  );

  const signUp = useCallback(
    ({ email, password, name, role, region }) =>
      supabase.auth.signUp({
        email,
        password,
        options: {
          data: { name, role, region },
        },
      }),
    []
  );

  const signOut = useCallback(() => supabase.auth.signOut(), []);

  const value = useMemo(
    () => ({ user, profile, loading, signIn, signUp, signOut }),
    [user, profile, loading, signIn, signUp, signOut]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth debe usarse dentro de <AuthProvider>");
  return context;
}
