/**
 * Municipio y estado de un punto (lat/lng) con Nominatim (OpenStreetMap), gratis y sin llave.
 * Funciona en cualquier lugar (no solo en Hidalgo / Tlaxcala / Puebla).
 * Devuelve { municipio, estado } (cada uno puede ser null). Lanza AbortError si se cancela.
 */
const cache = new Map();

function sleep(ms, signal) {
  return new Promise((resolve, reject) => {
    const id = setTimeout(resolve, ms);
    signal?.addEventListener(
      "abort",
      () => {
        clearTimeout(id);
        reject(new DOMException("Aborted", "AbortError"));
      },
      { once: true }
    );
  });
}

export async function reverseLocation(lat, lng, { signal } = {}) {
  const key = `${lat.toFixed(3)},${lng.toFixed(3)}`;
  if (cache.has(key)) return cache.get(key);

  // Pequeña espera: si el usuario mueve el pin varias veces seguidas solo se consulta la última
  // (y se respeta el límite de ~1 consulta por segundo de Nominatim).
  await sleep(450, signal);

  const url =
    `https://nominatim.openstreetmap.org/reverse?format=jsonv2&zoom=10&addressdetails=1` +
    `&accept-language=es&lat=${lat}&lon=${lng}`;
  const res = await fetch(url, { signal, headers: { Accept: "application/json" } });
  if (!res.ok) throw new Error(`Nominatim ${res.status}`);
  const a = (await res.json())?.address ?? {};
  const result = {
    municipio: a.municipality || a.city || a.town || a.village || a.county || null,
    estado: a.state || a.region || null,
  };
  if (result.municipio || result.estado) cache.set(key, result);
  return result;
}
