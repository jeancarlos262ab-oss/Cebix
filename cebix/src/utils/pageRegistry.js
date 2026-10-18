import { lazySingleton } from "./singleton";

export const getPageRegistry = lazySingleton(() => ({
  entries: new Map(),
  scroll: new Map(),
  search: new Map(),
  active: { key: null },
}));

export function resetPageRegistry() {
  const r = getPageRegistry();
  r.entries.clear();
  r.scroll.clear();
  r.search.clear();
  r.active.key = null;
}