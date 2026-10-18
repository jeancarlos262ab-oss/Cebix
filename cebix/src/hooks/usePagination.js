import { useCallback, useMemo, useState } from "react";

export const PAGE_SIZE_OPTIONS = [10, 25, 50];

export default function usePagination(items, { pageSize: initialPageSize = PAGE_SIZE_OPTIONS[0], scrollRef } = {}) {
  const [page, setPageState] = useState(1);
  const [pageSize, setPageSizeState] = useState(initialPageSize);

  const total = items.length;
  const pageCount = Math.max(1, Math.ceil(total / pageSize));
  
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