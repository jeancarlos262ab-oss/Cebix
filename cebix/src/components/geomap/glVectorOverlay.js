/**
 * Capas vectoriales de MapLibre dibujadas como SVG encima del mapa, con el MISMO método que la malla de la
 * parcela (glTraceOverlay.js): cada coordenada se reproyecta con map.project() en cada cuadro "render".
 *
 * Las capas GeoJSON nativas (type "line" / "circle") pasan por el worker de MapLibre; si el worker tarda,
 * llega tarde tras recrear el mapa, o el contenedor nació con 0×0 px, a veces nunca se pintan (mientras la
 * malla, que no depende del worker, siempre aparece). Dibujándolas aquí no hay worker, ni teselado, ni estado
 * intermedio que pueda fallar: si el mapa se pinta, se pintan.
 */

const NS = "http://www.w3.org/2000/svg";

function el(tag, attrs = {}) {
  const n = document.createElementNS(NS, tag);
  for (const [k, v] of Object.entries(attrs)) n.setAttribute(k, v);
  return n;
}

function makeSvg(map, { first = false } = {}) {
  const svg = el("svg", { "aria-hidden": "true" });
  svg.style.cssText = "position:absolute;left:0;top:0;width:100%;height:100%;overflow:visible;pointer-events:none";
  const host = map.getCanvasContainer();
  if (first && host.firstChild) host.insertBefore(svg, host.firstChild.nextSibling);
  else host.appendChild(svg);
  return svg;
}

const RAD = Math.PI / 180;
/** Distancia angular (°) entre dos puntos [lng, lat]. */
function angularDistance(lng1, lat1, lng2, lat2) {
  const a =
    Math.sin(((lat2 - lat1) * RAD) / 2) ** 2 +
    Math.cos(lat1 * RAD) * Math.cos(lat2 * RAD) * Math.sin(((lng2 - lng1) * RAD) / 2) ** 2;
  return (2 * Math.asin(Math.min(1, Math.sqrt(a)))) / RAD;
}

/**
 * ¿La coordenada está del lado oculto del globo? En el mapa plano nunca. En el globo, map.project() también
 * devuelve un punto para el hemisferio de atrás, así que hay que descartarlo para que no se dibuje "a través"
 * del planeta.
 */
function makeOccluded(map) {
  return (lng, lat) => {
    try {
      const t = map.transform;
      if (typeof t?.isLocationOccluded === "function") return t.isLocationOccluded({ lng, lat });
    } catch {
      // se usa el cálculo propio
    }
    const proj = map.getProjection?.()?.type;
    if (proj && proj !== "globe") return false;
    const c = map.getCenter();
    return angularDistance(c.lng, c.lat, lng, lat) > 84;
  };
}

/** Anillos [lng,lat][] de un GeoJSON (Polygon, MultiPolygon, LineString, MultiLineString, y colecciones). */
function collectLines(geojson) {
  const lines = [];
  const walk = (g) => {
    if (!g) return;
    switch (g.type) {
      case "FeatureCollection":
        g.features.forEach(walk);
        break;
      case "Feature":
        walk(g.geometry);
        break;
      case "GeometryCollection":
        g.geometries.forEach(walk);
        break;
      case "Polygon":
        g.coordinates.forEach((r) => lines.push(r));
        break;
      case "MultiPolygon":
        g.coordinates.forEach((p) => p.forEach((r) => lines.push(r)));
        break;
      case "LineString":
        lines.push(g.coordinates);
        break;
      case "MultiLineString":
        g.coordinates.forEach((l) => lines.push(l));
        break;
      default:
    }
  };
  walk(geojson);
  return lines;
}

/**
 * Líneas (contornos de estados) como un solo <path>.
 * @param style {{color, width, opacity, dashArray?: number[]}}  el guion va en píxeles, como en SVG
 * @returns {{setStyle(style): void, destroy(): void}}
 */
export function createLinesOverlay(map, geojson, style) {
  const svg = makeSvg(map, { first: true });
  const path = el("path", { fill: "none", "stroke-linejoin": "round", "stroke-linecap": "butt" });
  svg.appendChild(path);
  const lines = collectLines(geojson);
  const occluded = makeOccluded(map);
  let st = style;

  function applyStyle() {
    path.setAttribute("stroke", st.color);
    path.setAttribute("stroke-width", st.width);
    path.setAttribute("stroke-opacity", st.opacity);
    if (st.dashArray) path.setAttribute("stroke-dasharray", st.dashArray.join(" "));
    else path.removeAttribute("stroke-dasharray");
  }

  function draw() {
    let d = "";
    for (const ring of lines) {
      let pen = false; // ¿hay un tramo visible abierto?
      for (const [lng, lat] of ring) {
        if (occluded(lng, lat)) {
          pen = false;
          continue;
        }
        const { x, y } = map.project([lng, lat]);
        d += `${pen ? "L" : "M"}${x.toFixed(1)} ${y.toFixed(1)}`;
        pen = true;
      }
    }
    path.setAttribute("d", d);
  }

  applyStyle();
  map.on("render", draw);
  draw();

  return {
    setStyle(next) {
      st = next;
      applyStyle();
    },
    destroy() {
      map.off("render", draw);
      svg.remove();
    },
  };
}

/**
 * Puntos (parcelas) como círculos SVG, con clic y hover.
 * @param opts {{
 *   radius: (zoom:number, state:{hover:boolean, clicked:boolean}) => number,
 *   strokeWidth: (zoom:number, state) => number,
 *   fillOpacity?: number,
 *   onClick?: (id) => void,
 *   onHover?: (id|null) => void,
 * }}
 * @returns {{set({items: {id, lng, lat, color}[], clickedId}): void, destroy(): void}}
 */
export function createPointsOverlay(map, opts) {
  const svg = makeSvg(map);
  const nodes = new Map(); // id -> { c: <circle>, item }
  let items = [];
  let clickedId = null;
  let hoverId = null;
  const occluded = makeOccluded(map);

  let down = null;
  const onDown = (e) => (down = { x: e.clientX, y: e.clientY });

  function build() {
    nodes.forEach(({ c }) => c.remove());
    nodes.clear();
    for (const item of items) {
      const c = el("circle", { fill: item.color, stroke: "#ffffff", cx: -100, cy: -100, r: 0 });
      c.style.cssText = "pointer-events:auto;cursor:pointer";
      c.addEventListener("pointerdown", onDown);
      c.addEventListener("click", (e) => {
        // Un arrastre del mapa que termina sobre un punto no cuenta como clic.
        if (down && Math.hypot(e.clientX - down.x, e.clientY - down.y) > 4) return;
        e.stopPropagation();
        opts.onClick?.(item.id);
      });
      c.addEventListener("pointerenter", () => {
        hoverId = item.id;
        opts.onHover?.(item.id);
        draw();
      });
      c.addEventListener("pointerleave", () => {
        if (hoverId === item.id) hoverId = null;
        opts.onHover?.(null);
        draw();
      });
      svg.appendChild(c);
      nodes.set(item.id, { c, item });
    }
  }

  function draw() {
    const zoom = map.getZoom();
    const w = map.getCanvas().clientWidth;
    const h = map.getCanvas().clientHeight;
    nodes.forEach(({ c, item }, id) => {
      const clicked = id === clickedId;
      const hover = id === hoverId;
      const hidden = occluded(item.lng, item.lat);
      const { x, y } = hidden ? { x: -1e4, y: -1e4 } : map.project([item.lng, item.lat]);
      if (hidden || x < -40 || y < -40 || x > w + 40 || y > h + 40) {
        c.style.display = "none";
        return;
      }
      const state = { hover, clicked };
      c.style.display = "";
      c.setAttribute("cx", x.toFixed(1));
      c.setAttribute("cy", y.toFixed(1));
      c.setAttribute("r", opts.radius(zoom, state));
      c.setAttribute("stroke-width", opts.strokeWidth(zoom, state));
      // El punto seleccionado se oculta: lo reemplaza el rombo.
      c.setAttribute("fill-opacity", clicked ? 0 : (opts.fillOpacity ?? 0.9));
      c.setAttribute("stroke-opacity", clicked ? 0 : 1);
      c.style.pointerEvents = clicked ? "none" : "auto";
    });
  }

  map.on("render", draw);

  return {
    set(next) {
      if (next.items && next.items !== items) {
        items = next.items;
        build();
      }
      if ("clickedId" in next) clickedId = next.clickedId;
      draw();
    },
    destroy() {
      map.off("render", draw);
      svg.remove();
      nodes.clear();
    },
  };
}
