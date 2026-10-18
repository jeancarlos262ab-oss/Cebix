const WATCHDOG_MS = 4000;

export class SphereWorkerClient {
  static supported() {
    return (
      typeof Worker !== "undefined" &&
      typeof OffscreenCanvas !== "undefined" &&
      typeof OffscreenCanvas.prototype.transferToImageBitmap === "function" &&
      typeof ImageData !== "undefined"
    );
  }

  

  constructor({ onFrame, onFail, createWorker }) {
    this.onFrame = onFrame;
    this.onFail = onFail;
    this.busy = false;
    this.seq = 0;
    this.dead = false;
    this.timer = 0;
    try {
      this.worker =
        createWorker?.() ?? new Worker(new URL("./globeWorker.js", import.meta.url), { type: "module" });
    } catch (err) {
      this.dead = true;
      this.worker = null;
      queueMicrotask(() => onFail(String(err)));
      return;
    }
    this.worker.onmessage = (e) => {
      const m = e.data;
      if (m.type === "frame") {
        clearTimeout(this.timer);
        this.busy = false;
        if (this.dead) m.bitmap.close();
        else this.onFrame(m);
      } else if (m.type === "fail") this._fail(m.error);
    };
    this.worker.onerror = (e) => this._fail(e.message || "error del worker");
    this.worker.onmessageerror = () => this._fail("mensaje ilegible");
  }

  _fail(why) {
    if (this.dead) return;
    this.terminate();
    this.onFail(why);
  }

  
  setTexture(tex) {
    if (this.dead) return;
    this.worker.postMessage({ type: "tex", tex: tex ? { levels: tex.levels, top: tex.top, bottom: tex.bottom } : null });
  }

  
  draw(p) {
    if (this.dead || this.busy) return false;
    this.busy = true;
    this.worker.postMessage({ type: "draw", seq: ++this.seq, ...p });
    clearTimeout(this.timer);
    this.timer = setTimeout(() => this._fail("el hilo no responde"), WATCHDOG_MS);
    return true;
  }

  terminate() {
    this.dead = true;
    clearTimeout(this.timer);
    this.busy = false;
    this.worker?.terminate();
    this.worker = null;
  }
}