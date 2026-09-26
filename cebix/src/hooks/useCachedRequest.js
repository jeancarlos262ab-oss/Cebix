/**
 * Hook y utility para peticiones HTTP con caché persistente y deduplicación.
 * 
 * @module useCachedRequest
 * 
 * Características:
 * - Persistencia en localStorage con TTL configurable (default 24h)
 * - Deduplicación en vuelo: múltiples llamadas simultáneas comparten la misma promesa
 * - Clave determinista basada en endpoint + parámetros serializados
 * - Soporte para React hooks y funciones standalone
 * 
 * @example
 * // En un componente React
 * const { data, loading, error } = useCachedRequest('/api/places', { city: 'Mexico' });
 * 
 * @example
 * // Función standalone
 * const data = await cachedFetch('/api/geocode', { address: '123 Main St' });
 */

import { useEffect, useState } from "react";

// TTL por defecto: 24 horas en milisegundos
const DEFAULT_TTL = 24 * 60 * 60 * 1000;

// Mapa de promesas en vuelo para deduplicación
const inflightRequests = new Map();

/**
 * Genera una clave de caché determinista a partir del endpoint y parámetros.
 * 
 * @param {string} endpoint - URL o identificador del endpoint
 * @param {Object} params - Parámetros de la petición
 * @returns {string} Clave única para caché
 */
function getCacheKey(endpoint, params = {}) {
  const sortedParams = Object.keys(params)
    .sort()
    .reduce((acc, key) => {
      acc[key] = params[key];
      return acc;
    }, {});
  
  return `cache:${endpoint}:${JSON.stringify(sortedParams)}`;
}

/**
 * Lee del caché local verificando el TTL.
 * 
 * @param {string} key - Clave de caché
 * @returns {any|null} Datos en caché o null si expiró o no existe
 */
function readFromCache(key) {
  try {
    const cached = localStorage.getItem(key);
    if (!cached) return null;

    const { data, timestamp } = JSON.parse(cached);
    const now = Date.now();

    // Verificar si expiró
    if (now - timestamp > DEFAULT_TTL) {
      localStorage.removeItem(key);
      return null;
    }

    return data;
  } catch (error) {
    console.warn(`Error leyendo del caché [${key}]:`, error);
    return null;
  }
}

/**
 * Escribe en el caché local con timestamp.
 * 
 * @param {string} key - Clave de caché
 * @param {any} data - Datos a almacenar
 */
function writeToCache(key, data) {
  try {
    const entry = {
      data,
      timestamp: Date.now(),
    };
    localStorage.setItem(key, JSON.stringify(entry));
  } catch (error) {
    console.warn(`Error escribiendo en caché [${key}]:`, error);
  }
}

/**
 * Función standalone para peticiones con caché y deduplicación.
 * 
 * @param {string} endpoint - URL o identificador del endpoint
 * @param {Object} params - Parámetros de la petición
 * @param {Function} fetcher - Función que ejecuta la petición real (recibe endpoint y params)
 * @returns {Promise<any>} Promesa con los datos
 * 
 * @example
 * const data = await cachedFetch(
 *   'https://api.example.com/geocode',
 *   { address: '123 Main St', city: 'Mexico' },
 *   async (url, params) => {
 *     const response = await fetch(`${url}?${new URLSearchParams(params)}`);
 *     return response.json();
 *   }
 * );
 */
export async function cachedFetch(endpoint, params = {}, fetcher) {
  const cacheKey = getCacheKey(endpoint, params);

  // 1. Verificar caché
  const cached = readFromCache(cacheKey);
  if (cached !== null) {
    return cached;
  }

  // 2. Verificar si ya hay una petición en vuelo
  if (inflightRequests.has(cacheKey)) {
    return inflightRequests.get(cacheKey);
  }

  // 3. Ejecutar la petición y almacenar la promesa
  const promise = (async () => {
    try {
      const data = await fetcher(endpoint, params);
      writeToCache(cacheKey, data);
      return data;
    } catch (error) {
      throw error;
    } finally {
      // Limpiar la promesa en vuelo
      inflightRequests.delete(cacheKey);
    }
  })();

  inflightRequests.set(cacheKey, promise);
  return promise;
}

/**
 * Hook de React para peticiones con caché y deduplicación.
 * 
 * @param {string} endpoint - URL o identificador del endpoint
 * @param {Object} params - Parámetros de la petición
 * @param {Function} fetcher - Función que ejecuta la petición real
 * @param {Object} options - Opciones adicionales
 * @param {boolean} options.skip - Si es true, no ejecuta la petición
 * @returns {{ data: any, loading: boolean, error: Error|null, refetch: Function }}
 * 
 * @example
 * function MyComponent() {
 *   const { data, loading, error, refetch } = useCachedRequest(
 *     'https://api.example.com/places',
 *     { city: 'Mexico', type: 'restaurant' },
 *     async (url, params) => {
 *       const response = await fetch(`${url}?${new URLSearchParams(params)}`);
 *       return response.json();
 *     }
 *   );
 * 
 *   if (loading) return <div>Cargando...</div>;
 *   if (error) return <div>Error: {error.message}</div>;
 *   return <div>{JSON.stringify(data)}</div>;
 * }
 */
export function useCachedRequest(endpoint, params = {}, fetcher, options = {}) {
  const { skip = false } = options;
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(!skip);
  const [error, setError] = useState(null);

  const executeRequest = async () => {
    if (skip) return;

    setLoading(true);
    setError(null);

    try {
      const result = await cachedFetch(endpoint, params, fetcher);
      setData(result);
    } catch (err) {
      setError(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    executeRequest();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [endpoint, JSON.stringify(params), skip]);

  return {
    data,
    loading,
    error,
    refetch: executeRequest,
  };
}

/**
 * Limpia el caché completo o entradas específicas.
 * 
 * @param {string|RegExp} pattern - Patrón opcional para filtrar claves a eliminar
 * 
 * @example
 * // Limpiar todo el caché
 * clearCache();
 * 
 * @example
 * // Limpiar solo geocoding
 * clearCache(/geocode/);
 */
export function clearCache(pattern = null) {
  try {
    if (pattern === null) {
      // Limpiar todo el caché
      const keys = Object.keys(localStorage);
      keys.forEach((key) => {
        if (key.startsWith("cache:")) {
          localStorage.removeItem(key);
        }
      });
      return;
    }

    // Limpiar entradas que coincidan con el patrón
    const keys = Object.keys(localStorage);
    const regex = pattern instanceof RegExp ? pattern : new RegExp(pattern);
    
    keys.forEach((key) => {
      if (key.startsWith("cache:") && regex.test(key)) {
        localStorage.removeItem(key);
      }
    });
  } catch (error) {
    console.warn("Error limpiando caché:", error);
  }
}

/**
 * Obtiene estadísticas del caché.
 * 
 * @returns {{ count: number, size: number, keys: string[] }}
 */
export function getCacheStats() {
  try {
    const keys = Object.keys(localStorage).filter((key) => key.startsWith("cache:"));
    const size = keys.reduce((acc, key) => {
      const item = localStorage.getItem(key);
      return acc + (item ? item.length : 0);
    }, 0);

    return {
      count: keys.length,
      size,
      keys,
    };
  } catch (error) {
    console.warn("Error obteniendo estadísticas de caché:", error);
    return { count: 0, size: 0, keys: [] };
  }
}
