/**
 * Capas vectoriales de MapLibre dibujadas como SVG encima del mapa, con el MISMO método que la malla de la
 * parcela (glTraceOverlay.js): cada coordenada se reproyecta con map.project() al cuadro "render".
 *
 * Las capas GeoJSON nativas (type "line" / "circle") pasan por el worker de MapLibre; si el worker tarda,
 * llega tarde tras recrear el mapa, o el contenedor nació con 0×0 px, a veces nunca se pintan (mientras la
 * malla, que no depende del worker, siempre aparece). Dibujándolas aquí no hay worker ni teselado que pueda fallar.
 *
 * Costo: "render" se emite en cada cuadro aunque el mapa esté quieto (fundido de teselas, animaciones), así que
 * cada overlay compara una firma de la vista (centro, zoom, rumbo, tamaño) y no hace nada si no cambió.
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
/** Vector unitario de un [lng, lat] (se calcula una sola vez por punto). */
const unit = (lng, lat) => {
  const cl = Math.cos(lat * RAD);
  return [cl * Math.cos(lng * RAD), cl * Math.sin(lng * RAD), Math.sin(lat * RAD)];
};
// cos(84°): más allá de esto, un punto está del lado oculto del globo.
const HORIZON_DOT = 0.1;
// Desde este zoom el globo ya es casi plano y lo visible es una zona chica: no hace falta descartar nada.
const NO_CULL_ZOOM = 6;

/**
 * Vista del mapa: firma barata para saber si cambió algo, y descarte del hemisferio oculto (en el globo,
 * map.project() también devuelve un punto para el lado de atrás, y se dibujaría "a través" del planeta).
 */
function makeView(map) {
  let sig = "";
  let cx = 1;
  let cy = 0;
  let cz = 0;
  let cull = false;
  let w = 0;
  let h = 0;
  const readSize = () => {
    const c = map.getCanvas();
    w = c.clientWidth;
    h = c.clientHeight;
  };
  readSize();
  map.on("resize", readSize);
  return {
    get w() {
      return w;
    },
    get h() {
      return h;
    },
    /** true si la vista cambió desde la última vez (o si `force`). Deja listo el descarte. */
    update(force) {
      const c = map.getCenter();
      const z = map.getZoom();
      const next = `${c.lng}|${c.lat}|${z}|${map.getBearing()}|${w}|${h}`;
      if (!force && next === sig) return false;
      sig = next;
      cull = z < NO_CULL_ZOOM && map.getProjection?.()?.type !== "mercator";
      if (cull) [cx, cy, cz] = unit(c.lng, c.lat);
      return true;
    },
    hidden: (v) => cull && v[0] * cx + v[1] * cy + v[2] * cz < HORIZON_DOT,
    destroy: () => map.off("resize", readSize),
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
  // Coordenadas y vectores se preparan una sola vez.
  const rings = collectLines(geojson).map((ring) => ({
    ll: ring,
    v: ring.map(([lng, lat]) => unit(lng, lat)),
  }));
  const view = makeView(map);
  let st = style;

  function applyStyle() {
    path.setAttribute("stroke", st.color);
    path.setAttribute("stroke-width", st.width);
    path.setAttribute("stroke-opacity", st.opacity);
    if (st.dashArray) path.setAttribute("stroke-dasharray", st.dashArray.join(" "));
    else path.removeAttribute("stroke-dasharray");
  }

  function draw(force) {
    if (!view.update(force === true)) return;
    const parts = [];
    for (const { ll, v } of rings) {
      let pen = false; // ¿hay un tramo visible abierto?
      let lx = 0;
      let ly = 0;
      for (let i = 0; i < ll.length; i++) {
        if (view.hidden(v[i])) {
          pen = false;
          continue;
        }
        const { x, y } = map.project(ll[i]);
        // Vértices a menos de 1.5 px del anterior no aportan nada a la vista (de lejos son la mayoría).
        if (pen && Math.abs(x - lx) < 1.5 && Math.abs(y - ly) < 1.5 && i < ll.length - 1) continue;
        parts.push(`${pen ? "L" : "M"}${x.toFixed(1)} ${y.toFixed(1)}`);
        lx = x;
        ly = y;
        pen = true;
      }
    }
    path.setAttribute("d", parts.join(""));
  }

  applyStyle();
  map.on("render", draw);
  draw(true);

  return {
    setStyle(next) {
      st = next;
      applyStyle();
    },
    destroy() {
      map.off("render", draw);
      view.destroy();
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
  const view = makeView(map);
  const fillOpacity = opts.fillOpacity ?? 0.9;
  let nodes = []; // { id, c, lng, lat, v, shown, r, sw }
  let byId = new Map();
  let items = [];
  let clickedId = null;
  let hoverId = null;
  let lastZoom = NaN;
  let baseR = 0;
  let baseSw = 0;

  let down = null;
  const onDown = (e) => (down = { x: e.clientX, y: e.clientY });

  function build() {
    svg.replaceChildren();
    byId = new Map();
    nodes = items.map((item) => {
      const c = el("circle", { fill: item.color, stroke: "#ffffff", "fill-opacity": fillOpacity, "stroke-opacity": 1 });
      c.style.cssText = "pointer-events:auto;cursor:pointer;display:none";
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
        styleOne(byId.get(item.id), lastZoom);
      });
      c.addEventListener("pointerleave", () => {
        if (hoverId === item.id) hoverId = null;
        opts.onHover?.(null);
        styleOne(byId.get(item.id), lastZoom);
      });
      svg.appendChild(c);
      const n = { id: item.id, c, lng: item.lng, lat: item.lat, v: unit(item.lng, item.lat), shown: false, r: -1, sw: -1 };
      byId.set(item.id, n);
      return n;
    });
  }

  /** Radio y trazo de un punto (el normal comparte valores calculados una vez por cuadro de zoom). */
  function styleOne(n, zoom) {
    if (!n) return;
    const special = n.id === clickedId || n.id === hoverId;
    const state = { hover: n.id === hoverId, clicked: n.id === clickedId };
    const r = special ? opts.radius(zoom, state) : baseR;
    const sw = special ? opts.strokeWidth(zoom, state) : baseSw;
    if (r !== n.r) {
      n.c.setAttribute("r", r);
      n.r = r;
    }
    if (sw !== n.sw) {
      n.c.setAttribute("stroke-width", sw);
      n.sw = sw;
    }
    const clicked = n.id === clickedId;
    // El punto seleccionado se oculta: lo reemplaza el rombo.
    n.c.setAttribute("fill-opacity", clicked ? 0 : fillOpacity);
    n.c.setAttribute("stroke-opacity", clicked ? 0 : 1);
    n.c.style.pointerEvents = clicked ? "none" : "auto";
  }

  function draw(force) {
    if (!view.update(force === true)) return;
    const zoom = map.getZoom();
    if (zoom !== lastZoom || force === true) {
      lastZoom = zoom;
      baseR = opts.radius(zoom, { hover: false, clicked: false });
      baseSw = opts.strokeWidth(zoom, { hover: false, clicked: false });
    }
    const w = view.w;
    const h = view.h;
    for (const n of nodes) {
      let on = !view.hidden(n.v);
      let x = 0;
      let y = 0;
      if (on) {
        ({ x, y } = map.project([n.lng, n.lat]));
        on = x > -40 && y > -40 && x < w + 40 && y < h + 40;
      }
      if (!on) {
        if (n.shown) {
          n.c.style.display = "none";
          n.shown = false;
        }
        continue;
      }
      if (!n.shown) {
        n.c.style.display = "";
        n.shown = true;
        n.r = -1; // al reaparecer se vuelve a estilar
        n.sw = -1;
      }
      n.c.setAttribute("cx", x.toFixed(1));
      n.c.setAttribute("cy", y.toFixed(1));
      if ((n.r !== baseR || n.sw !== baseSw || n.id === clickedId || n.id === hoverId)) styleOne(n, zoom);
    }
  }

  map.on("render", draw);

  return {
    set(next) {
      if (next.items && next.items !== items) {
        items = next.items;
        build();
      }
      if ("clickedId" in next && next.clickedId !== clickedId) {
        // El que dejó de estar seleccionado y el nuevo se vuelven a estilar.
        for (const id of [clickedId, next.clickedId]) {
          const n = byId.get(id);
          if (n) n.r = -1;
        }
        clickedId = next.clickedId;
      }
      lastZoom = NaN;
      draw(true);
    },
    destroy() {
      map.off("render", draw);
      view.destroy();
      svg.remove();
      nodes = [];
      byId.clear();
    },
  };
}
