import { useCallback, useEffect, useState } from "react";
import { FILTER_KEYS } from "./strings";

// Filter state lives in the URL so a filtered view survives a refresh, works
// with the back button and can be pasted to someone else.
//
// Deliberately built on window.history rather than react-router's
// useSearchParams: the trip gallery is rendered outside a Router in its own
// tests, and this hook only ever touches the query string, never the path.

function read_params() {
  const params = new URLSearchParams(window.location.search);
  const values = {};
  FILTER_KEYS.forEach((key) => {
    values[key] = params.get(key) || "";
  });
  return values;
}

function write_params(values, replace) {
  const params = new URLSearchParams(window.location.search);

  FILTER_KEYS.forEach((key) => {
    const value = values[key];
    if (value === "" || value === null || value === undefined) {
      params.delete(key);
    } else {
      params.set(key, value);
    }
  });

  const query = params.toString();
  const url = `${window.location.pathname}${query ? `?${query}` : ""}`;

  if (replace) {
    window.history.replaceState({}, "", url);
  } else {
    window.history.pushState({}, "", url);
  }
}

export default function useUrlFilters() {
  const [filters, set_filters] = useState(read_params);

  // Back/forward buttons move through the filter history.
  useEffect(() => {
    function handle_pop() {
      set_filters(read_params());
    }
    window.addEventListener("popstate", handle_pop);
    return () => window.removeEventListener("popstate", handle_pop);
  }, []);

  const set_filter = useCallback((key, value) => {
    set_filters((current) => {
      const next = { ...current, [key]: value };
      // Typing replaces rather than stacks, so the back button steps out of
      // the filtered view instead of walking every keystroke.
      write_params(next, key === "search");
      return next;
    });
  }, []);

  const reset_filters = useCallback(() => {
    const cleared = {};
    FILTER_KEYS.forEach((key) => {
      cleared[key] = "";
    });
    set_filters(cleared);
    write_params(cleared, false);
  }, []);

  const has_active_filters = FILTER_KEYS.some((key) => filters[key] !== "");

  return { filters, set_filter, reset_filters, has_active_filters };
}
