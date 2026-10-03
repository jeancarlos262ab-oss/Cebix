import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "../services/supabaseClient";
import { resetPageRegistry } from "../utils/pageRegistry";
import { sendSignupOtp, sendResetOtp, verifySignupOtpApi, verifyResetOtpApi } from "../services/otpApi";

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

  // Se saca de useEffect y se vuelve reutilizable: signIn/signOut la llaman
  // directamente y esperan a que termine antes de resolver su promesa. Así
  // la pantalla que hace login puede navegar en cuanto `signIn` resuelve,
  // con la certeza de que `user`/`profile` ya están actualizados, en vez de
  // depender del evento asíncrono `onAuthStateChange` (que llegaba después
  // del `navigate("/")`, la pantalla protegida todavía veía `user = null` y
  // rebotaba a /login como si la sesión se hubiera reiniciado).
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
      // Sigue existiendo para cambios externos (otra pestaña, expiración de
      // sesión, etc). Para el login/logout disparados desde esta misma
      // pestaña, signIn/signOut ya actualizaron el estado antes de que este
      // evento llegue.
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

  // Ya no usa supabase.auth.signUp (que dispararía el correo integrado de
  // Supabase). En su lugar, la función serverless /api/send-otp crea al
  // usuario sin confirmar (o reutiliza uno pendiente) y manda el código de
  // 6 dígitos por Gmail SMTP.
  const signUp = useCallback(
    ({ email, password, name, role, region }) => sendSignupOtp({ email, password, name, role, region }),
    []
  );

  const signOut = useCallback(async () => {
    const result = await supabase.auth.signOut();
    await applySession(null);
    resetPageRegistry(); // las pantallas guardadas (singleton) no deben pasar al siguiente usuario
    return result;
  }, [applySession]);

  // Confirma el código de 6 dígitos que /api/send-otp mandó por Gmail SMTP.
  // La función serverless /api/verify-otp solo marca el correo como
  // confirmado en Supabase; la sesión se abre aquí mismo con signIn (mismo
  // password que ya se mandó al crear la cuenta), reutilizando la misma
  // lógica de "aplicar sesión antes de resolver" que ya usa el login.
  const verifySignupOtp = useCallback(
    async (email, code, password) => {
      const result = await verifySignupOtpApi({ email, code });
      if (result.error) return result;
      return signIn(email, password);
    },
    [signIn]
  );

  const resendSignupOtp = useCallback((email) => sendSignupOtp({ email }), []);

  // Manda el código de 6 dígitos para restablecer la contraseña por Gmail
  // SMTP. Siempre resuelve sin error (no revela si el correo tiene cuenta o
  // no); el código en sí se valida después con verifyResetOtp.
  const sendPasswordResetOtp = useCallback((email) => sendResetOtp({ email }), []);

  // Confirma el código de recuperación y deja la contraseña nueva. No
  // depende de ninguna sesión temporal: la función serverless valida el
  // código y cambia la contraseña directamente con la Service Role Key.
  const verifyPasswordResetOtp = useCallback(
    (email, code, newPassword) => verifyResetOtpApi({ email, code, newPassword }),
    []
  );

  const value = useMemo(
    () => ({
      user,
      profile,
      loading,
      signIn,
      signUp,
      signOut,
      verifySignupOtp,
      resendSignupOtp,
      sendPasswordResetOtp,
      verifyPasswordResetOtp,
    }),
    [
      user,
      profile,
      loading,
      signIn,
      signUp,
      signOut,
      verifySignupOtp,
      resendSignupOtp,
      sendPasswordResetOtp,
      verifyPasswordResetOtp,
    ]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth debe usarse dentro de <AuthProvider>");
  return context;
}
