/**
 * EJEMPLOS DE USO DEL HOOK useCachedRequest
 * 
 * Este archivo contiene ejemplos prácticos de cómo usar el hook de caché
 * con diferentes APIs y casos de uso comunes.
 */

import { useCachedRequest, cachedFetch, clearCache, getCacheStats } from './useCachedRequest';

// ============================================
// EJEMPLO 1: Geocoding (convertir dirección a coordenadas)
// ============================================

/**
 * Componente que geocodifica una dirección
 */
function GeocodingExample({ address }) {
  const { data, loading, error } = useCachedRequest(
    'https://nominatim.openstreetmap.org/search',
    { 
      q: address, 
      format: 'json',
      limit: 1 
    },
    async (url, params) => {
      const queryString = new URLSearchParams(params).toString();
      const response = await fetch(`${url}?${queryString}`, {
        headers: {
          'User-Agent': 'CebixApp/1.0' // Nominatim requiere User-Agent
        }
      });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      return response.json();
    }
  );

  if (loading) return <div>Geocodificando dirección...</div>;
  if (error) return <div>Error: {error.message}</div>;
  if (!data || data.length === 0) return <div>Dirección no encontrada</div>;

  const location = data[0];
  return (
    <div>
      <p>Latitud: {location.lat}</p>
      <p>Longitud: {location.lon}</p>
      <p>Nombre: {location.display_name}</p>
    </div>
  );
}

// ============================================
// EJEMPLO 2: Búsqueda de lugares (Places API)
// ============================================

/**
 * Componente que busca lugares cercanos
 */
function PlacesSearchExample({ lat, lng, type = 'restaurant', radius = 1000 }) {
  const { data, loading, error, refetch } = useCachedRequest(
    'https://api.example.com/places/nearby',
    { 
      lat, 
      lng, 
      type, 
      radius 
    },
    async (url, params) => {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${import.meta.env.VITE_PLACES_API_KEY}`
        },
        body: JSON.stringify(params)
      });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      return response.json();
    }
  );

  if (loading) return <div>Buscando lugares...</div>;
  if (error) return <div>Error: {error.message}</div>;

  return (
    <div>
      <button onClick={refetch}>Actualizar</button>
      <ul>
        {data?.results?.map((place) => (
          <li key={place.id}>
            {place.name} - {place.distance}m
          </li>
        ))}
      </ul>
    </div>
  );
}

// ============================================
// EJEMPLO 3: Búsqueda con skip condicional
// ============================================

/**
 * Componente que solo busca cuando el usuario ingresa un término
 */
function ConditionalSearchExample() {
  const [query, setQuery] = React.useState('');
  const [search, setSearch] = React.useState('');

  const { data, loading, error } = useCachedRequest(
    'https://api.example.com/search',
    { q: search },
    async (url, params) => {
      const response = await fetch(`${url}?${new URLSearchParams(params)}`);
      return response.json();
    },
    { skip: !search } // ← No ejecuta si search está vacío
  );

  return (
    <div>
      <input 
        value={query} 
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Buscar..."
      />
      <button onClick={() => setSearch(query)}>Buscar</button>
      
      {loading && <div>Buscando...</div>}
      {error && <div>Error: {error.message}</div>}
      {data && <pre>{JSON.stringify(data, null, 2)}</pre>}
    </div>
  );
}

// ============================================
// EJEMPLO 4: Función standalone para uso fuera de React
// ============================================

/**
 * Función que obtiene clima usando cachedFetch
 */
async function getWeather(city) {
  try {
    const data = await cachedFetch(
      'https://api.openweathermap.org/data/2.5/weather',
      { 
        q: city, 
        appid: import.meta.env.VITE_WEATHER_API_KEY,
        units: 'metric',
        lang: 'es'
      },
      async (url, params) => {
        const response = await fetch(`${url}?${new URLSearchParams(params)}`);
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        return response.json();
      }
    );
    
    return {
      temperature: data.main.temp,
      description: data.weather[0].description,
      humidity: data.main.humidity
    };
  } catch (error) {
    console.error('Error obteniendo clima:', error);
    throw error;
  }
}

// Uso:
// const weather = await getWeather('Mexico City');
// console.log(`Temperatura: ${weather.temperature}°C`);

// ============================================
// EJEMPLO 5: Múltiples peticiones en paralelo
// ============================================

/**
 * Componente que carga datos de múltiples endpoints
 */
function ParallelRequestsExample({ userId }) {
  // Todas estas peticiones se ejecutan en paralelo
  const userRequest = useCachedRequest(
    `/api/users/${userId}`,
    {},
    async (url) => {
      const response = await fetch(url);
      return response.json();
    }
  );

  const postsRequest = useCachedRequest(
    `/api/users/${userId}/posts`,
    {},
    async (url) => {
      const response = await fetch(url);
      return response.json();
    }
  );

  const followersRequest = useCachedRequest(
    `/api/users/${userId}/followers`,
    {},
    async (url) => {
      const response = await fetch(url);
      return response.json();
    }
  );

  if (userRequest.loading || postsRequest.loading || followersRequest.loading) {
    return <div>Cargando perfil...</div>;
  }

  const errors = [userRequest.error, postsRequest.error, followersRequest.error].filter(Boolean);
  if (errors.length > 0) {
    return <div>Errores: {errors.map(e => e.message).join(', ')}</div>;
  }

  return (
    <div>
      <h2>{userRequest.data.name}</h2>
      <p>Posts: {postsRequest.data.length}</p>
      <p>Seguidores: {followersRequest.data.length}</p>
    </div>
  );
}

// ============================================
// EJEMPLO 6: Administración del caché
// ============================================

/**
 * Componente para administrar el caché
 */
function CacheManagementExample() {
  const [stats, setStats] = React.useState(null);

  const updateStats = () => {
    const cacheStats = getCacheStats();
    setStats(cacheStats);
  };

  React.useEffect(() => {
    updateStats();
  }, []);

  return (
    <div>
      <h3>Estadísticas de Caché</h3>
      {stats && (
        <div>
          <p>Entradas: {stats.count}</p>
          <p>Tamaño: {(stats.size / 1024).toFixed(2)} KB</p>
        </div>
      )}
      
      <div style={{ marginTop: 16, display: 'flex', gap: 8 }}>
        <button onClick={() => { clearCache(); updateStats(); }}>
          Limpiar todo el caché
        </button>
        <button onClick={() => { clearCache(/geocode/); updateStats(); }}>
          Limpiar solo geocoding
        </button>
        <button onClick={() => { clearCache(/weather/); updateStats(); }}>
          Limpiar solo clima
        </button>
        <button onClick={updateStats}>
          Actualizar estadísticas
        </button>
      </div>

      <div style={{ marginTop: 16 }}>
        <h4>Claves en caché:</h4>
        <ul>
          {stats?.keys.map((key) => (
            <li key={key} style={{ fontSize: 12, fontFamily: 'monospace' }}>
              {key}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

// ============================================
// EJEMPLO 7: GraphQL con caché
// ============================================

/**
 * Función para peticiones GraphQL con caché
 */
async function graphqlQuery(query, variables = {}) {
  return await cachedFetch(
    'https://api.example.com/graphql',
    { query, variables },
    async (url, params) => {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${import.meta.env.VITE_GRAPHQL_TOKEN}`
        },
        body: JSON.stringify(params)
      });
      const result = await response.json();
      if (result.errors) {
        throw new Error(result.errors[0].message);
      }
      return result.data;
    }
  );
}

// Uso:
// const query = `
//   query GetParcels($region: String!) {
//     parcels(region: $region) {
//       id
//       name
//       ndvi
//     }
//   }
// `;
// const data = await graphqlQuery(query, { region: 'Puebla' });

// ============================================
// EJEMPLO 8: Reverse Geocoding (coordenadas a dirección)
// ============================================

/**
 * Componente que obtiene dirección desde coordenadas
 */
function ReverseGeocodingExample({ lat, lng }) {
  const { data, loading, error } = useCachedRequest(
    'https://nominatim.openstreetmap.org/reverse',
    { 
      lat, 
      lon: lng,
      format: 'json',
      zoom: 18
    },
    async (url, params) => {
      const queryString = new URLSearchParams(params).toString();
      const response = await fetch(`${url}?${queryString}`, {
        headers: {
          'User-Agent': 'CebixApp/1.0'
        }
      });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      return response.json();
    }
  );

  if (loading) return <div>Obteniendo dirección...</div>;
  if (error) return <div>Error: {error.message}</div>;

  return (
    <div>
      <p><strong>Dirección:</strong></p>
      <p>{data?.display_name}</p>
      {data?.address && (
        <ul>
          <li>Calle: {data.address.road}</li>
          <li>Ciudad: {data.address.city || data.address.town}</li>
          <li>Estado: {data.address.state}</li>
          <li>Código Postal: {data.address.postcode}</li>
        </ul>
      )}
    </div>
  );
}

// ============================================
// EXPORTAR EJEMPLOS (opcional)
// ============================================

export {
  GeocodingExample,
  PlacesSearchExample,
  ConditionalSearchExample,
  ParallelRequestsExample,
  CacheManagementExample,
  ReverseGeocodingExample,
  getWeather,
  graphqlQuery
};
