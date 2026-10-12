import { createContext, useContext, useMemo, useState, type ReactNode } from 'react';

import { defaultFilters, type SearchFilters } from './filters';

type SearchValue = {
  filters: SearchFilters;
  setFilters: (f: SearchFilters | ((prev: SearchFilters) => SearchFilters)) => void;
};

const SearchContext = createContext<SearchValue | null>(null);

/** One filter state shared by the map and list views so both always show the same query. */
export function SearchProvider({ children }: { children: ReactNode }) {
  const [filters, setFilters] = useState<SearchFilters>(defaultFilters);
  const value = useMemo(() => ({ filters, setFilters }), [filters]);
  return <SearchContext.Provider value={value}>{children}</SearchContext.Provider>;
}

export function useSearch() {
  const ctx = useContext(SearchContext);
  if (!ctx) throw new Error('useSearch must be used inside SearchProvider');
  return ctx;
}
