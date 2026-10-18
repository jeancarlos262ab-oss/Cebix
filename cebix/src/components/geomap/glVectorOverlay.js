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

const unit = (lng, lat) => {
  const cl = Math.cos(lat * RAD);
  return [cl * Math.cos(lng * RAD), cl * Math.sin(lng * RAD), Math.sin(lat * RAD)];
};

const HORIZON_DOT = 0.1;

const NO_CULL_ZOOM = 6;

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

export function createLinesOverlay(map, geojson, style) {
  const svg = makeSvg(map, { first: true });
  const path = el("path", { fill: "none", "stroke-linejoin": "round", "stroke-linecap": "butt" });
  svg.appendChild(path);
  
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
      let pen = false; 
      let lx = 0;
      let ly = 0;
      for (let i = 0; i < ll.length; i++) {
        if (view.hidden(v[i])) {
          pen = false;
          continue;
        }
        const { x, y } = map.project(ll[i]);
        
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

export function createPointsOverlay(map, opts) {
  const cv = document.createElement("canvas");
  cv.setAttribute("aria-hidden", "true");
  cv.style.cssText = "position:absolute;left:0;top:0;width:100%;height:100%;pointer-events:none";
  const host = map.getCanvasContainer();
  if (host.firstChild) host.insertBefore(cv, host.firstChild.nextSibling);
  else host.appendChild(cv);
  const ctx = cv.getContext("2d");
  const view = makeView(map);
  const fillOpacity = opts.fillOpacity ?? 0.9;

  let items = [];
  let vecs = [];
  let n = 0;
  let xs = new Float32Array(0);
  let ys = new Float32Array(0);
  let vis = new Uint8Array(0);
  let groups = []; 
  let clickedIdx = -1;
  let hoverIdx = -1;
  let baseR = 0;
  let baseSw = 0;
  let zoom = 0;
  let dpr = 1;

  function sizeCanvas() {
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    cv.width = Math.max(1, Math.round(view.w * dpr));
    cv.height = Math.max(1, Math.round(view.h * dpr));
  }

  function build(next) {
    items = next;
    n = items.length;
    vecs = items.map((it) => unit(it.lng, it.lat));
    xs = new Float32Array(n);
    ys = new Float32Array(n);
    vis = new Uint8Array(n);
    const byColor = new Map();
    items.forEach((it, i) => {
      if (!byColor.has(it.color)) byColor.set(it.color, []);
      byColor.get(it.color).push(i);
    });
    groups = [...byColor].map(([color, idx]) => ({ color, idx }));
    clickedIdx = -1;
    hoverIdx = -1;
  }

  const indexOf = (id) => (id == null ? -1 : items.findIndex((it) => it.id === id));

  function project() {
    for (let i = 0; i < n; i++) {
      if (view.hidden(vecs[i])) {
        vis[i] = 0;
        continue;
      }
      const { x, y } = map.project([items[i].lng, items[i].lat]);
      xs[i] = x;
      ys[i] = y;
      vis[i] = x > -40 && y > -40 && x < view.w + 40 && y < view.h + 40 ? 1 : 0;
    }
  }

  function paint() {
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, view.w, view.h);
    if (!n) return;
    zoom = map.getZoom();
    baseR = opts.radius(zoom, { hover: false, clicked: false });
    baseSw = opts.strokeWidth(zoom, { hover: false, clicked: false });
    ctx.strokeStyle = "#ffffff";
    ctx.lineWidth = baseSw;
    for (const { color, idx } of groups) {
      ctx.beginPath();
      for (const i of idx) {
        if (!vis[i] || i === clickedIdx || i === hoverIdx) continue;
        ctx.moveTo(xs[i] + baseR, ys[i]);
        ctx.arc(xs[i], ys[i], baseR, 0, 6.2832);
      }
      ctx.globalAlpha = fillOpacity;
      ctx.fillStyle = color;
      ctx.fill();
      ctx.globalAlpha = 1;
      ctx.stroke();
    }
    
    if (hoverIdx >= 0 && hoverIdx !== clickedIdx && vis[hoverIdx]) {
      const st = { hover: true, clicked: false };
      ctx.beginPath();
      ctx.arc(xs[hoverIdx], ys[hoverIdx], opts.radius(zoom, st), 0, 6.2832);
      ctx.globalAlpha = fillOpacity;
      ctx.fillStyle = items[hoverIdx].color;
      ctx.fill();
      ctx.globalAlpha = 1;
      ctx.lineWidth = opts.strokeWidth(zoom, st);
      ctx.stroke();
    }
  }

  function draw(force) {
    const changed = view.update(force === true);
    if (!changed) return;
    project();
    paint();
  }

  
  function hit(px, py) {
    for (let i = n - 1; i >= 0; i--) {
      if (!vis[i] || i === clickedIdx) continue;
      const r = (i === hoverIdx ? opts.radius(zoom, { hover: true, clicked: false }) : baseR) + 2;
      const dx = xs[i] - px;
      const dy = ys[i] - py;
      if (dx * dx + dy * dy <= r * r) return i;
    }
    return -1;
  }

  let raf = 0;
  let pending = null;
  const onMove = (e) => {
    pending = e.point;
    if (raf) return;
    raf = requestAnimationFrame(() => {
      raf = 0;
      if (!pending) return;
      const i = hit(pending.x, pending.y);
      pending = null;
      if (i === hoverIdx) return;
      hoverIdx = i;
      map.getCanvas().style.cursor = i >= 0 ? "pointer" : "";
      opts.onHover?.(i >= 0 ? items[i].id : null);
      paint();
    });
  };
  const onLeave = () => {
    if (hoverIdx < 0) return;
    hoverIdx = -1;
    map.getCanvas().style.cursor = "";
    opts.onHover?.(null);
    paint();
  };
  const onClick = (e) => {
    const i = hit(e.point.x, e.point.y);
    if (i >= 0) opts.onClick?.(items[i].id);
  };
  const onResize = () => {
    sizeCanvas();
    draw(true);
  };

  sizeCanvas();
  map.on("render", draw);
  map.on("resize", onResize);
  map.on("mousemove", onMove);
  map.on("mouseout", onLeave);
  map.on("click", onClick);

  return {
    set(next) {
      if (next.items && next.items !== items) build(next.items);
      if ("clickedId" in next) clickedIdx = indexOf(next.clickedId);
      draw(true);
    },
    destroy() {
      cancelAnimationFrame(raf);
      map.off("render", draw);
      map.off("resize", onResize);
      map.off("mousemove", onMove);
      map.off("mouseout", onLeave);
      map.off("click", onClick);
      try {
        map.getCanvas().style.cursor = "";
      } catch {
        
      }
      view.destroy();
      cv.remove();
    },
  };
}