import { useCallback, useMemo, useState } from "react";

export const PAGE_SIZE_OPTIONS = [10, 25, 50];

/**
 * Paginación en cliente: devuelve solo la "rebanada" de items que se debe
 * pintar, para no montar cientos de filas a la vez.
 *
 * @param {Array} items  Lista completa (ya filtrada).
 * @param {{ pageSize?: number, scrollRef?: React.RefObject<HTMLElement> }} [options]
 *   scrollRef: al cambiar de página, si la parte de arriba de ese elemento ya
 *   quedó fuera de la pantalla, se regresa a ella para no dejar al usuario en
 *   medio de la nueva página.
 */
export default function usePagination(items, { pageSize: initialPageSize = PAGE_SIZE_OPTIONS[0], scrollRef } = {}) {
  const [page, setPageState] = useState(1);
  const [pageSize, setPageSizeState] = useState(initialPageSize);

  const total = items.length;
  const pageCount = Math.max(1, Math.ceil(total / pageSize));
  // Si la lista se encoge (p. ej. al filtrar) nunca queda una página vacía.
  const currentPage = Math.min(page, pageCount);

  const pageItems = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return items.slice(start, start + pageSize);
  }, [items, currentPage, pageSize]);

  const scrollToTop = useCallback(() => {
    const el = scrollRef?.current;
    if (el && el.getBoundingClientRect().top < 0) el.scrollIntoView({ block: "start" });
  }, [scrollRef]);

  const setPage = useCallback(
    (next) => {
      setPageState(Math.min(Math.max(1, next), pageCount));
      scrollToTop();
    },
    [pageCount, scrollToTop]
  );

  const setPageSize = useCallback(
    (size) => {
      setPageSizeState(size);
      setPageState(1);
      scrollToTop();
    },
    [scrollToTop]
  );

  const reset = useCallback(() => setPageState(1), []);

  return {
    pageItems,
    reset,
    // Se esparce directo en <Pagination {...paginationProps} />
    paginationProps: {
      page: currentPage,
      pageCount,
      pageSize,
      total,
      onPageChange: setPage,
      onPageSizeChange: setPageSize,
    },
  };
}
