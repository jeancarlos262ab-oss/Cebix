import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Search, CornerDownLeft } from "lucide-react";
import { useParcels } from "../../context/ParcelsContext";

const RISK_DOT = { green: "#16A34A", yellow: "#D97706", red: "#DC2626" };

function normalize(str) {
  return str
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

export default function GlobalSearch() {
  const { parcels } = useParcels();
  const navigate = useNavigate();
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const inputRef = useRef(null);
  const containerRef = useRef(null);

  const results = useMemo(() => {
    const q = normalize(query.trim());
    if (!q) return [];
    return parcels
      .filter((p) =>
        [p.name, p.municipio, p.region, p.polygonId].some((field) => normalize(String(field)).includes(q))
      )
      .slice(0, 8);
  }, [query, parcels]);

  useEffect(() => {
    setActiveIndex(0);
  }, [query]);

  // Atajo global ⌘K / Ctrl+K para enfocar la búsqueda desde cualquier parte de la app.
  useEffect(() => {
    function handleKeydown(e) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        inputRef.current?.focus();
        inputRef.current?.select();
      }
      if (e.key === "Escape") {
        setOpen(false);
        inputRef.current?.blur();
      }
    }
    window.addEventListener("keydown", handleKeydown);
    return () => window.removeEventListener("keydown", handleKeydown);
  }, []);

  useEffect(() => {
    function handleClickOutside(e) {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  function goTo(parcel) {
    navigate(`/parcelas/${parcel.id}`);
    setOpen(false);
    setQuery("");
    inputRef.current?.blur();
  }

  function handleKeyDown(e) {
    if (!open || results.length === 0) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActiveIndex((i) => (i + 1) % results.length);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveIndex((i) => (i - 1 + results.length) % results.length);
    } else if (e.key === "Enter") {
      e.preventDefault();
      goTo(results[activeIndex]);
    }
  }

  return (
    <div ref={containerRef} className="relative w-40 sm:w-56 lg:w-64">
      <Search
        size={16}
        className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
      />
      <input
        ref={inputRef}
        type="text"
        value={query}
        onChange={(e) => {
          setQuery(e.target.value);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        onKeyDown={handleKeyDown}
        placeholder="Buscar parcela"
        role="combobox"
        aria-expanded={open && results.length > 0}
        aria-controls="global-search-results"
        className="w-full border border-gray-200 bg-white py-2 pl-9 pr-12 text-sm text-gray-700 shadow-sm placeholder:text-gray-400 focus:border-accent-400 focus:outline-none focus:ring-2 focus:ring-accent-100 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-200 dark:placeholder:text-gray-500"
      />
      {!query && (
        <kbd className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 border border-gray-200 bg-gray-50 px-1.5 py-0.5 text-[11px] font-medium text-gray-400 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-400">
          ⌘K
        </kbd>
      )}

      {open && query && (
        <div
          id="global-search-results"
          role="listbox"
          className="absolute right-0 top-full z-50 mt-1.5 max-h-80 w-72 max-w-[calc(100vw-2rem)] overflow-y-auto border border-gray-200 bg-white py-1 shadow-card dark:border-gray-800 dark:bg-gray-900 sm:w-80"
        >
          {results.length === 0 ? (
            <p className="px-3 py-3 text-sm text-gray-500 dark:text-gray-400">
              Sin resultados para "{query}"
            </p>
          ) : (
            results.map((p, i) => (
              <button
                key={p.id}
                type="button"
                role="option"
                aria-selected={i === activeIndex}
                onMouseEnter={() => setActiveIndex(i)}
                onClick={() => goTo(p)}
                className={[
                  "flex w-full items-center gap-3 px-3 py-2 text-left text-sm",
                  i === activeIndex ? "bg-gray-100 dark:bg-gray-800" : "hover:bg-gray-50 dark:hover:bg-gray-800/60",
                ].join(" ")}
              >
                <span
                  className="h-2 w-2 shrink-0 rounded-full"
                  style={{ backgroundColor: RISK_DOT[p.riskColor] ?? "#98A2B3" }}
                />
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-medium text-gray-900 dark:text-gray-100">{p.name}</span>
                  <span className="block truncate text-xs text-gray-400 dark:text-gray-500">
                    {p.municipio}, {p.region} · {p.yieldEstimate.toFixed(1)} ton/ha
                  </span>
                </span>
                {i === activeIndex && <CornerDownLeft size={13} className="shrink-0 text-gray-300" />}
              </button>
            ))
          )}
        </div>
      )}
    </div>
  );
}
