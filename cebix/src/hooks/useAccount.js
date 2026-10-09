import { useCallback, useEffect, useMemo, useState } from "react";
import { useAuth } from "../context/AuthContext";
import { supabase } from "../services/supabaseClient";

function toAccount(profile, user) {
  return {
    name: profile?.name ?? user?.user_metadata?.name ?? "",
    email: user?.email ?? "",
    avatar: profile?.avatar_url ?? "",
    twoFactor: Boolean(profile?.two_factor),
    status: profile?.status ?? "",
  };
}

function toProfilePatch(patch) {
  const fields = {
    name: patch.name,
    status: patch.status,
    // `in` y no `??`: quitar la foto manda avatar = null y debe llegar a la base.
    avatar_url: "avatar" in patch ? patch.avatar : patch.avatar_url,
    two_factor: patch.twoFactor ?? patch.two_factor,
  };

  return Object.fromEntries(Object.entries(fields).filter(([, value]) => value !== undefined));
}

/** Cuenta de la persona autenticada, sincronizada con AuthContext y Supabase. */
export default function useAccount() {
  const { user, profile, patchProfile } = useAuth();
  const [overrides, setOverrides] = useState({});

  useEffect(() => {
    setOverrides({});
  }, [user?.id]);

  const account = useMemo(
    () => ({ ...toAccount(profile, user), ...overrides }),
    [profile, user, overrides]
  );

  const updateAccount = useCallback(async (patch) => {
    if (!user) return { error: new Error("No hay una sesión activa") };

    const profilePatch = toProfilePatch(patch);
    if (Object.keys(profilePatch).length > 0) {
      const { error } = await supabase.from("profiles").update(profilePatch).eq("id", user.id);
      if (error) return { error };
    }

    if (patch.email && patch.email !== user.email) {
      const { error } = await supabase.auth.updateUser({ email: patch.email });
      if (error) return { error };
    }

    if (Object.keys(profilePatch).length > 0) patchProfile(profilePatch);
    setOverrides((current) => ({ ...current, ...patch }));
    return { error: null };
  }, [user, patchProfile]);

  return { account, updateAccount };
}
