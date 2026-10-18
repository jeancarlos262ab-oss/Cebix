let instance = null;

function pickStore() {
  try {
    return typeof window !== "undefined" ? window.localStorage ?? null : null;
  } catch {
    return null; 
  }
}

class AppStorage {
  constructor() {
    if (instance) {
      throw new Error("AppStorage es un singleton: usa AppStorage.getInstance().");
    }
    this.store = pickStore();
    this.memory = new Map(); 
  }

  static getInstance() {
    if (!instance) instance = new AppStorage();
    return instance;
  }

  
  getJSON(key, fallback = null) {
    let raw = null;
    try {
      raw = this.store?.getItem(key) ?? null;
    } catch {
      raw = null;
    }
    if (raw === null) raw = this.memory.get(key) ?? null;
    if (raw === null) return fallback;
    try {
      return JSON.parse(raw);
    } catch {
      return fallback;
    }
  }

  
  setJSON(key, value) {
    const raw = JSON.stringify(value);
    this.memory.set(key, raw);
    try {
      this.store?.setItem(key, raw);
    } catch {
      
    }
  }

  
  remove(key) {
    this.memory.delete(key);
    try {
      this.store?.removeItem(key);
    } catch {
      
    }
  }
}

export const appStorage = AppStorage.getInstance();