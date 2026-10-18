import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "../services/supabaseClient";
import { resetPageRegistry } from "../utils/pageRegistry";
import { sendSignupOtp, sendResetOtp, verifySignupOtpApi, verifyResetOtpApi, checkResetOtpApi } from "../services/otpApi";

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
  const mountedRef = useRef(true);

  
  
  
  
  
  
  
  const applySession = useCallback(async (session) => {
    const nextUser = session?.user ?? null;
    let nextProfile = null;

    if (nextUser) {
      try {
        nextProfile = await fetchProfile(nextUser.id);
      } catch (error) {
        console.error("No se pudo cargar el perfil del usuario", error);
      }
    }

    if (!mountedRef.current) return;
    setUser(nextUser);
    setProfile(nextProfile);
    setLoading(false);
  }, []);

  useEffect(() => {
    mountedRef.current = true;

    supabase.auth.getSession().then(({ data: { session } }) => applySession(session));

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      
      
      
      
      setTimeout(() => applySession(session), 0);
    });

    return () => {
      mountedRef.current = false;
      subscription.unsubscribe();
    };
  }, [applySession]);

  const signIn = useCallback(
    async (email, password) => {
      const result = await supabase.auth.signInWithPassword({ email, password });
      if (!result.error) {
        await applySession(result.data.session);
      }
      return result;
    },
    [applySession]
  );

  
  
  
  
  const signUp = useCallback(
    ({ email, password, name }) => sendSignupOtp({ email, password, name }),
    []
  );

  
  
  const patchProfile = useCallback((patch) => {
    setProfile((current) => (current ? { ...current, ...patch } : current));
  }, []);

  const signOut = useCallback(async () => {
    const result = await supabase.auth.signOut();
    await applySession(null);
    resetPageRegistry(); 
    return result;
  }, [applySession]);

  
  
  
  
  
  const verifySignupOtp = useCallback(
    async (email, code, password) => {
      const result = await verifySignupOtpApi({ email, code });
      if (result.error) return result;
      return signIn(email, password);
    },
    [signIn]
  );

  const resendSignupOtp = useCallback((email) => sendSignupOtp({ email }), []);

  
  
  
  const sendPasswordResetOtp = useCallback((email) => sendResetOtp({ email }), []);

  
  const checkPasswordResetOtp = useCallback((email, code) => checkResetOtpApi({ email, code }), []);

  
  
  
  const verifyPasswordResetOtp = useCallback(
    (email, code, newPassword) => verifyResetOtpApi({ email, code, newPassword }),
    []
  );

  const value = useMemo(
    () => ({
      user,
      profile,
      loading,
      patchProfile,
      signIn,
      signUp,
      signOut,
      verifySignupOtp,
      resendSignupOtp,
      sendPasswordResetOtp,
      verifyPasswordResetOtp,
      checkPasswordResetOtp,
    }),
    [
      user,
      profile,
      loading,
      patchProfile,
      signIn,
      signUp,
      signOut,
      verifySignupOtp,
      resendSignupOtp,
      sendPasswordResetOtp,
      verifyPasswordResetOtp,
      checkPasswordResetOtp,
    ]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth debe usarse dentro de <AuthProvider>");
  return context;
}