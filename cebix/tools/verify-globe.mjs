/**
 * Verificación del globo rápido contra la referencia exacta (renderSphere).
 *
 *   node tools/verify-globe.mjs            # pruebas + tiempos
 *   node tools/verify-globe.mjs --png out  # además guarda volcados RGBA para inspección visual
 *
 * Requiere que el proyecto sea ESM ("type": "module" en package.json, como en una plantilla de Vite).
 * No necesita navegador: solo usa los módulos puros (sin DOM).
 */
import { writeFileSync, mkdirSync } from "node:fs";
import { renderSphere } from "../src/components/earthengine/globeRender.js";
import { SphereRaster, prepareGlobeTexture, fastAtan2, SMAX } from "../src/components/earthengine/globeFast.js";
import { SphereLayer, BUDGET_MOVING, BUDGET_IDLE } from "../src/components/earthengine/globeLayer.js";

const D2R = Math.PI / 180;
let failed = 0;
const ok = (cond, msg, extra = "") => {
  console.log(`${cond ? "  ✔" : "  ✘ FALLA"} ${msg}${extra ? "  " + extra : ""}`);
  if (!cond) failed++;
};
const pngDir = process.argv.includes("--png") ? process.argv[process.argv.indexOf("--png") + 1] : null;
if (pngDir) mkdirSync(pngDir, { recursive: true });

/* ───────────── texturas sintéticas (Web Mercator) ───────────── */
function makeMercator(size, fn) {
  const data = new Uint32Array(size * size);
  for (let j = 0; j < size; j++) {
    const lat = Math.atan(Math.sinh(Math.PI * (1 - (2 * (j + 0.5)) / size)));
    for (let i = 0; i < size; i++) {
      const lon = ((i + 0.5) / size - 0.5) * 2 * Math.PI;
      const [r, g, b] = fn(lon, lat);
      data[j * size + i] = 0xff000000 | (b << 16) | (g << 8) | r;
    }
  }
  const avg = (row) => {
    let r = 0, g = 0, b = 0, n = 0;
    const step = Math.max(1, Math.floor(size / 128));
    for (let x = 0; x < size; x += step) {
      const c = data[row * size + x];
      r += c & 255; g += (c >> 8) & 255; b += (c >> 16) & 255; n++;
    }
    return [r / n, g / n, b / n];
  };
  return { data, w: size, h: size, top: avg(0), bottom: avg(size - 1) };
}

// Campo suave sobre la esfera (función de la posición 3D: sin singularidad en los polos),
// para validar la geometría sin que el remuestreo estorbe.
const smooth = (lon, lat) => {
  const cl = Math.cos(lat), px = cl * Math.cos(lon), py = Math.sin(lat), pz = cl * Math.sin(lon);
  return [
    Math.round(128 + 100 * Math.sin(2.3 * px + 1.1 * py + 0.4)),
    Math.round(128 + 100 * Math.cos(1.7 * pz - 2 * py)),
    Math.round(128 + 100 * Math.sin(3 * px * pz + py)),
  ];
};

// Ruido de valor 3D en la esfera (sin costura) → continentes + detalle fino hasta ~8 px.
function hash3(x, y, z) {
  let h = (x * 374761393 + y * 668265263 + z * 2147483647) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967295;
}
function noise3(x, y, z) {
  const xi = Math.floor(x), yi = Math.floor(y), zi = Math.floor(z);
  const fx = x - xi, fy = y - yi, fz = z - zi;
  const sx = fx * fx * (3 - 2 * fx), sy = fy * fy * (3 - 2 * fy), sz = fz * fz * (3 - 2 * fz);
  const l = (a, b, t) => a + (b - a) * t;
  return l(
    l(l(hash3(xi, yi, zi), hash3(xi + 1, yi, zi), sx), l(hash3(xi, yi + 1, zi), hash3(xi + 1, yi + 1, zi), sx), sy),
    l(l(hash3(xi, yi, zi + 1), hash3(xi + 1, yi, zi + 1), sx), l(hash3(xi, yi + 1, zi + 1), hash3(xi + 1, yi + 1, zi + 1), sx), sy),
    sz,
  );
}
function earthLike(lon, lat) {
  const cl = Math.cos(lat);
  const px = cl * Math.cos(lon), py = Math.sin(lat), pz = cl * Math.sin(lon);
  let f = 0, a = 0.5, fr = 2;
  for (let o = 0; o < 8; o++) {
    f += a * noise3(px * fr + 11, py * fr + 7, pz * fr + 3);
    a *= 0.55; fr *= 2;
  }
  const detail = noise3(px * 180, py * 180, pz * 180);
  const land = f > 0.52;
  let r, g, b;
  if (land) {
    const t = Math.min(1, (f - 0.52) * 4);
    r = 60 + 110 * t + 40 * detail; g = 110 + 40 * (1 - t) + 40 * detail; b = 50 + 30 * t;
  } else {
    r = 15 + 20 * detail; g = 50 + 40 * detail; b = 110 + 50 * detail;
  }
  if (Math.abs(lat) > 1.2) { r = g = b = 235 - 20 * detail; }
  // retícula fina cada 10° (líneas de ~1 px a esta escala) → pone a prueba el submuestreo
  const gl = (Math.abs(((lon / D2R) % 10) + 10) % 10);
  if (gl < 0.12 || gl > 9.88) { r = 255; g = 255; b = 255; }
  return [Math.min(255, r) | 0, Math.min(255, g) | 0, Math.min(255, b) | 0];
}

/* ───────────── utilidades de comparación ───────────── */
function compare(a, b, w, h, pred = () => true) {
  let n = 0, sum = 0, big = 0, max = 0, covMismatch = 0;
  const hist = new Uint32Array(256);
  for (let i = 0; i < w * h; i++) {
    const ia = a[i] >>> 24, ib = b[i] >>> 24;
    if (ia !== ib) covMismatch++;
    if (!ia || !ib || !pred(i % w, (i / w) | 0)) continue;
    let d = 0;
    for (let c = 0; c < 24; c += 8) d += Math.abs(((a[i] >> c) & 255) - ((b[i] >> c) & 255));
    d /= 3;
    sum += d; n++; if (d > 12) big++; if (d > max) max = d;
    hist[Math.min(255, Math.round(d))]++;
  }
  let acc = 0, p99 = 0;
  for (let k = 0; k < 256; k++) { acc += hist[k]; if (acc >= n * 0.99) { p99 = k; break; } }
  return { n, mean: sum / n, p99, max, bigFrac: big / n, covMismatch };
}
const fmt = (s) => `media ${s.mean.toFixed(2)} · p99 ${s.p99} · máx ${s.max.toFixed(0)} · >12: ${(s.bigFrac * 100).toFixed(2)}%`;
const dump = (name, buf, w, h) => pngDir && writeFileSync(`${pngDir}/${name}.rgba.${w}x${h}`, Buffer.from(buf.buffer, buf.byteOffset, w * h * 4));

function fastRender(tex, aw, ah, cx, cy, R, lon, lat) {
  const r = new SphereRaster();
  r.setTexture(tex);
  r.configure(aw, aw, ah, cx, cy, R);
  const out = new Uint32Array(aw * ah);
  r.render(out, lon * D2R, lat * D2R);
  return out;
}
function refRender(merc, aw, ah, cx, cy, R, lon, lat) {
  const out = new Uint32Array(aw * ah);
  renderSphere(out, aw, ah, cx, cy, R, lon * D2R, lat * D2R, merc);
  return out;
}
const median = (a) => [...a].sort((x, y) => x - y)[a.length >> 1];
const p95 = (a) => [...a].sort((x, y) => x - y)[Math.min(a.length - 1, Math.floor(a.length * 0.95))];

/* ═════════════════════════════════════════════════════════════ */
console.log("\n1) atan2 aproximado vs Math.atan2");
{
  let maxErr = 0;
  const wrap = (d) => Math.abs(((d + Math.PI) % (2 * Math.PI) + 2 * Math.PI) % (2 * Math.PI) - Math.PI);
  for (let i = 0; i < 2_000_000; i++) {
    const t = (i / 2_000_000) * 2 * Math.PI - Math.PI;
    const r = 0.001 + (i % 97) / 97 * 3;
    const y = r * Math.sin(t), x = r * Math.cos(t);
    maxErr = Math.max(maxErr, wrap(fastAtan2(y, x) - Math.atan2(y, x)));
  }
  for (const [y, x] of [[0, 1], [0, -1], [1, 0], [-1, 0], [1e-12, -1], [0, 0]])
    maxErr = Math.max(maxErr, wrap(fastAtan2(y, x) - Math.atan2(y, x)));
  ok(maxErr < 2e-5, `error máximo ${maxErr.toExponential(2)} rad`, `(= ${(maxErr * 2048 / (2 * Math.PI)).toFixed(4)} texels de una textura de 2048)`);
}

/* ───────────── texturas ───────────── */
console.log("\nGenerando texturas sintéticas (2048² suave y con detalle)…");
const SIZE = 2048;
let t = performance.now();
const mercSmooth = makeMercator(SIZE, smooth);
const mercDetail = makeMercator(SIZE, earthLike);
console.log(`  listas en ${((performance.now() - t) / 1000).toFixed(1)} s`);

console.log("\n2) Preparación de textura (sen(lat) + mipmaps) en rebanadas");
let texSmooth, texDetail;
{
  const gaps = [];
  let last = performance.now();
  const yieldFn = () => new Promise((r) => { gaps.push(performance.now() - last); setImmediate(() => { last = performance.now(); r(); }); });
  t = performance.now();
  texDetail = await prepareGlobeTexture(mercDetail, { yieldFn });
  const total = performance.now() - t;
  gaps.push(performance.now() - last);
  texSmooth = await prepareGlobeTexture(mercSmooth);
  const maxSlice = Math.max(...gaps);
  console.log(`  z3 (2048²): ${total.toFixed(0)} ms en ${gaps.length} rebanadas; la más larga ${maxSlice.toFixed(1)} ms`);
  ok(maxSlice < 25, "ninguna rebanada bloquea el hilo más de ~25 ms");
  ok(texDetail.levels[0].w === 2048 && texDetail.levels[0].h === 1024, "nivel 0 = 2048×1024");
  ok(texDetail.levels.length >= 7, `${texDetail.levels.length} niveles de mip`, texDetail.levels.map((l) => `${l.w}×${l.h}`).join(" "));
  // El nivel 0 debe coincidir con la Mercator en puntos de control (campo suave)
  let sum = 0, n = 0;
  const L0 = texSmooth.levels[0];
  for (let k = 0; k < 20000; k++) {
    const lat = (Math.random() * 2 - 1) * 80 * D2R;
    const lon = (Math.random() * 2 - 1) * Math.PI;
    const exp = smooth(lon, lat);
    const s = Math.sin(lat);
    const row = Math.min(L0.h - 1, Math.max(0, Math.round((0.5 - s / (2 * SMAX)) * L0.h - 0.5)));
    const col = Math.round(((lon / (2 * Math.PI)) + 0.5) * L0.w - 0.5) & (L0.w - 1);
    const c = L0.data[row * L0.w + col];
    sum += (Math.abs((c & 255) - exp[0]) + Math.abs(((c >> 8) & 255) - exp[1]) + Math.abs(((c >> 16) & 255) - exp[2])) / 3;
    n++;
  }
  ok(sum / n < 1.5, `nivel 0 reproduce el campo en (lon, sen lat): error medio ${(sum / n).toFixed(2)}/255`);
}

console.log("\n3) Imagen nueva vs renderSphere (referencia), campo suave");
const views = [
  ["México", -98.1, 19.6], ["Ecuador/Greenwich", 0, 0], ["Costura +180°", 180, 10], ["Costura −179.9°", -179.9, 45],
  ["Sur", 30, -60], ["Polo N visible", 100, 80], ["Casi polo S", -45, -85], ["Inclinado", 77, 33],
];
const geoms = [
  ["esfera completa 400×400", 400, 400, 200, 200, 190],
  ["recortada (zoom alto)", 400, 300, 200, 150, 330],
  ["chica 140×140", 140, 140, 70, 70, 66],
];
// Estricto bajo 80° de latitud; la banda polar (>80°) pierde detalle por diseño (filas lineales en sen lat).
const latOf = (cx, cy, R, lat) => (x, y) => {
  const nx = (x + 0.5 - cx) / R, ny = (cy - y - 0.5) / R;
  const nz = Math.sqrt(Math.max(0, 1 - nx * nx - ny * ny));
  return Math.abs(ny * Math.cos(lat * D2R) + nz * Math.sin(lat * D2R));
};
const SIN80 = Math.sin(80 * D2R);
let polarSum = 0, polarN = 0, polarMax = 0;
for (const [gname, aw, ah, cx, cy, R] of geoms) {
  for (const [vname, lon, lat] of views) {
    const a = fastRender(texSmooth, aw, ah, cx, cy, R, lon, lat);
    const b = refRender(mercSmooth, aw, ah, cx, cy, R, lon, lat);
    const sinLat = latOf(cx, cy, R, lat);
    const s = compare(a, b, aw, ah, (x, y) => sinLat(x, y) < SIN80);
    const pol = compare(a, b, aw, ah, (x, y) => sinLat(x, y) >= SIN80);
    if (pol.n) { polarSum += pol.mean * pol.n; polarN += pol.n; polarMax = Math.max(polarMax, pol.mean); }
    const pass = s.covMismatch === 0 && s.mean < 1.2 && s.p99 <= 6;
    ok(pass, `${gname} · ${vname.padEnd(18)}`, fmt(s) + (s.covMismatch ? ` · cobertura difiere en ${s.covMismatch}px` : ""));
    if (gname.startsWith("esfera") && ["México", "Polo N visible"].includes(vname)) {
      dump(`smooth_${vname.replace(/\W/g, "")}_fast`, a, aw, ah);
      dump(`smooth_${vname.replace(/\W/g, "")}_ref`, b, aw, ah);
    }
  }
}
console.log(`  ℹ banda polar (>80° de latitud): diferencia media ${(polarSum / polarN).toFixed(1)}/255 (peor vista: ${polarMax.toFixed(1)}) — pérdida de detalle esperada`);

console.log("\n4) Girar de lado reutiliza la tabla y da exactamente lo mismo que recalcular");
{
  const aw = 360, ah = 360, cx = 180, cy = 180, R = 170;
  const r = new SphereRaster();
  r.setTexture(texDetail);
  r.configure(aw, aw, ah, cx, cy, R);
  const out = new Uint32Array(aw * ah);
  r.render(out, -98 * D2R, 19.6 * D2R);
  let identical = true, anyTilt = false;
  for (const lon of [-97, -60, 0, 123.4, 179.99, -179.99]) {
    r.render(out, lon * D2R, 19.6 * D2R);
    anyTilt ||= r.lastTilt;
    const fresh = fastRender(texDetail, aw, ah, cx, cy, R, lon, 19.6);
    for (let i = 0; i < out.length; i++) if (out[i] !== fresh[i]) { identical = false; break; }
  }
  ok(!anyTilt, "no recalcula la inclinación al girar solo en longitud");
  ok(identical, "resultado idéntico bit a bit al de una instancia nueva");
  r.render(out, 0, 19.7 * D2R);
  ok(r.lastTilt, "sí recalcula al cambiar la latitud");
}

console.log("\n5) Submuestreo: error contra la 'verdad' (referencia a 4× y promedio 4×4), textura con detalle fino");
{
  for (const [name, R, lon, lat] of [["R=190 (zoom 1)", 190, -98.1, 19.6], ["R=110 (ventana chica)", 110, -98.1, 19.6], ["R=110 inclinado 55°", 110, 20, 55]]) {
    const aw = Math.round(R * 2 + 4), ah = aw, cx = aw / 2, cy = ah / 2;
    const S = 4;
    const big = refRender(mercDetail, aw * S, ah * S, cx * S, cy * S, R * S, lon, lat);
    const truth = new Uint32Array(aw * ah);
    for (let y = 0; y < ah; y++) for (let x = 0; x < aw; x++) {
      let r = 0, g = 0, b = 0, cnt = 0;
      for (let dy = 0; dy < S; dy++) for (let dx = 0; dx < S; dx++) {
        const c = big[(y * S + dy) * aw * S + x * S + dx];
        if (c >>> 24) { r += c & 255; g += (c >> 8) & 255; b += (c >> 16) & 255; cnt++; }
      }
      if (cnt === S * S) truth[y * aw + x] = 0xff000000 | ((b / cnt) << 16) | ((g / cnt) << 8) | (r / cnt);
    }
    const a = fastRender(texDetail, aw, ah, cx, cy, R, lon, lat);
    const b = refRender(mercDetail, aw, ah, cx, cy, R, lon, lat);
    const interior = (x, y) => Math.hypot(x + 0.5 - cx, y + 0.5 - cy) < R * 0.9;
    const sf = compare(a, truth, aw, ah, interior);
    const sr = compare(b, truth, aw, ah, interior);
    ok(sf.mean < sr.mean, `${name}`, `error medio: nuevo ${sf.mean.toFixed(2)} vs referencia ${sr.mean.toFixed(2)} (menor es mejor)`);
    if (R === 190) { dump("detail_truth", truth, aw, ah); dump("detail_fast", a, aw, ah); dump("detail_ref", b, aw, ah); }
  }
}

console.log("\n6) Lógica de la capa (zoom, giro, inclinación, calidad adaptativa) con lienzo simulado");
{
  const calls = [];
  const mkCanvas = (w, h) => ({ width: w, height: h, getContext: () => ({ putImageData: () => calls.push("put") }) });
  const mkImage = (w, h) => ({ width: w, height: h, data: new Uint8ClampedArray(w * h * 4) });
  let clock = 0;
  const tick = { step: 0.2 }; // cada draw() llama now() dos veces: ms medido = step
  const now = () => (clock += tick.step);
  const layer = new SphereLayer({ createCanvas: mkCanvas, createImage: mkImage, now });
  layer.setTexture(texDetail);
  let lastDraw = null;
  const ctx = { drawImage: (...a) => (lastDraw = a), imageSmoothingEnabled: true };
  const cw = 1000, ch = 700, cx = 500, cy = 350;
  const base = { cw, ch, cx, cy, R: 300, lon0: -98 * D2R, lat0: 19.6 * D2R, fast: false };
  const d = (o) => layer.draw(ctx, { ...base, ...o });

  ok(d({}).kind === "geom", "primer cuadro en reposo: construye geometría");
  ok(d({}).kind === "scale", "mismo estado: no muestrea de nuevo, solo dibuja");
  ok(d({ fast: true }).kind === "geom", "al empezar a arrastrar: geometría con menos píxeles");
  const px = layer.geo.bw * layer.geo.bh;
  ok(px <= BUDGET_MOVING * 1.05, `píxeles en movimiento ≈ ${px} (presupuesto ${BUDGET_MOVING})`);
  ok(d({ fast: true, lon0: -90 * D2R }).kind === "lateral", "giro lateral: solo desplazamiento");
  ok(layer.raster.lastTilt === false, "…sin recalcular la tabla de inclinación");
  ok(d({ fast: true, lon0: -90 * D2R, lat0: 25 * D2R }).kind === "tilt", "arrastre vertical: recalcula la tabla");
  const g0 = layer.geo;
  const z = d({ fast: true, lon0: -90 * D2R, lat0: 25 * D2R, R: 330 });
  ok(z.kind === "scale" && layer.geo === g0, "zoom +10% en movimiento: solo re-escala el último cuadro");
  const s = 330 / g0.R;
  const centerDest = lastDraw[5] + ((cx - g0.x0) * g0.k) * (lastDraw[7] / g0.bw);
  ok(Math.abs(lastDraw[7] - (g0.bw / g0.k) * s) < 1e-6 && Math.abs(centerDest - cx) < 1e-6, "…y el centro de la esfera queda en el centro del lienzo");
  ok(d({ fast: true, lon0: -90 * D2R, lat0: 25 * D2R, R: 330 * 1.6 }).kind === "geom", "zoom fuera de [0.8, 1.25]×: reconstruye geometría");
  const settled = d({ lon0: -90 * D2R, lat0: 25 * D2R, R: 330 * 1.6 });
  ok(settled.kind === "geom" && Math.abs(layer.geo.R - 330 * 1.6) < 1e-9, "zoom asentado (reposo): reconstruye a la escala exacta");
  ok(d({ lon0: -90 * D2R, lat0: 25 * D2R, R: 330 * 1.6 * 1.01 }).kind === "scale", "≤2% de diferencia en reposo: no reconstruye");
  // vista con zoom alto: el raster debe cubrir el lienzo entero (con margen)
  const gg = layer.geo;
  const covers = gg.x0 <= 0 && gg.y0 <= 0 && gg.x0 + gg.bw / gg.k >= cw && gg.y0 + gg.bh / gg.k >= ch;
  ok(covers, "con zoom alto el raster cubre todo el lienzo (sin huecos)");

  // Calidad adaptativa: simula un equipo lento (cada muestreo "tarda" 20 ms)
  layer.invalidate();
  tick.step = 25; // cada muestreo "tarda" 25 ms
  let lon = -98;
  for (let i = 0; i < 40; i++) d({ fast: true, lon0: (lon += 0.7) * D2R });
  const qLow = layer.quality;
  ok(qLow < 1 && qLow >= 0.3, `equipo lento: baja la resolución (calidad ${qLow.toFixed(2)})`);
  const pxLow = layer.geo.bw * layer.geo.bh;
  tick.step = 0.1;
  for (let i = 0; i < 60; i++) d({ fast: true, lon0: (lon += 0.7) * D2R });
  ok(layer.quality > qLow, `equipo rápido otra vez: recupera (calidad ${layer.quality.toFixed(2)})`);
  ok(pxLow < px, `…con ${pxLow} px bajo carga frente a ${px} normales`);
}

/* ═════════════════════════════════════════════════════════════ */
console.log("\n7) Tiempos en Node/V8 (indicativos; en tu laptop con Chrome serán distintos)");
{
  // Escenario típico: lienzo 1000×700 css a dpr 1.25; globo zoom 1 → R ≈ 376 px de lienzo
  const R = 376, vw = Math.ceil(R * 2);
  const scenarios = [
    ["antes: 60 000 px (presupuesto anterior en movimiento)", 60000],
    [`ahora: ${BUDGET_MOVING} px (en movimiento)`, BUDGET_MOVING],
    [`reposo: ${BUDGET_IDLE} px`, BUDGET_IDLE],
  ];
  const bench = (fn, iters = 60) => {
    for (let i = 0; i < 8; i++) fn(i);
    const ts = [];
    for (let i = 0; i < iters; i++) { const a = performance.now(); fn(i); ts.push(performance.now() - a); }
    return ts;
  };
  const rows = [];
  for (const [label, budget] of scenarios) {
    const k = Math.min(1, Math.sqrt(budget / (vw * vw)));
    const bw = Math.ceil(vw * k), aw = Math.ceil(bw / 32) * 32;
    const cxB = bw / 2, Rb = R * k;
    const out = new Uint32Array(aw * aw);
    const ref = bench((i) => { out.fill(0); renderSphere(out, aw, aw, cxB, cxB, Rb, (-98 + i * 0.7) * D2R, 19.6 * D2R, mercDetail); }, 25);
    const r = new SphereRaster();
    r.setTexture(texDetail);
    const cfg = bench(() => { r.configure(aw, bw, bw, cxB, cxB, Rb); }, 25);
    r.configure(aw, bw, bw, cxB, cxB, Rb);
    r.render(out, 0, 19.6 * D2R);
    const lateral = bench((i) => r.render(out, (-98 + i * 0.7) * D2R, 19.6 * D2R));
    const tilt = bench((i) => r.render(out, (-98 + i * 0.7) * D2R, (19.6 + i * 0.05) * D2R));
    const flat = (a) => `${median(a).toFixed(1)} (p95 ${p95(a).toFixed(1)})`;
    rows.push({ escenario: label, "px calculados": r.n, "ref. por cuadro": flat(ref), "nuevo: giro lateral": flat(lateral), "nuevo: con inclinación": flat(tilt), "nuevo: reconstruir geom.": flat(cfg) });
  }
  console.table(rows);
  console.log("  (ms por cuadro, mediana y p95; 'ref.' = renderSphere de antes, mismo búfer)");
}

console.log(failed ? `\n✘ ${failed} comprobación(es) fallaron` : "\n✔ todas las comprobaciones pasaron");
process.exit(failed ? 1 : 0);
