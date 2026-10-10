import { createHmac, timingSafeEqual } from "node:crypto";

const secret = () => {
  const s = process.env.UNSUBSCRIBE_SECRET;
  if (!s) throw new Error("Falta UNSUBSCRIBE_SECRET");
  return s;
};

const sign = (uid, type) => createHmac("sha256", secret()).update(`${uid}:${type}`).digest("hex");

export const appUrl = () => (process.env.APP_URL || "").replace(/\/$/, "");

/** Enlace de baja de un tipo de aviso: "risk" | "weekly" | "all". No requiere iniciar sesión. */
export function unsubscribeUrl(uid, type) {
  return `${appUrl()}/api/unsubscribe?u=${encodeURIComponent(uid)}&t=${type}&k=${sign(uid, type)}`;
}

export function validUnsubscribe(uid, type, key) {
  if (!uid || !["risk", "weekly", "all"].includes(type) || typeof key !== "string") return false;
  const a = Buffer.from(sign(uid, type));
  const b = Buffer.from(key);
  return a.length === b.length && timingSafeEqual(a, b);
}
