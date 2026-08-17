import { useEffect, useRef, useState } from "react";
import axios from "axios";
import Button from "../ui/Button/Button";
import Card from "../ui/Card/Card";
import Input from "../ui/Input/Input";
import StarRating from "../Reviews/StarRating";
import { FILTER_STRINGS, SORT_OPTIONS } from "./strings";
import "./FilterBar.css";

const API_BASE = "http://127.0.0.1:8000";
const SEARCH_DEBOUNCE_MS = 300;

export default function FilterBar({ filters, onChange, onReset, hasActiveFilters, resultCount }) {
  // The search box is uncontrolled between keystrokes so typing stays smooth;
  // it is pushed into the shared filter state on a 300ms trailing edge.
  const [search_text, set_search_text] = useState(filters.search);
  const last_pushed = useRef(filters.search);

  useEffect(() => {
    if (filters.search !== last_pushed.current) {
      last_pushed.current = filters.search;
      set_search_text(filters.search);
    }
  }, [filters.search]);

  useEffect(() => {
    if (search_text === last_pushed.current) return undefined;

    const timer = setTimeout(() => {
      last_pushed.current = search_text;
      onChange("search", search_text);
    }, SEARCH_DEBOUNCE_MS);

    return () => clearTimeout(timer);
  }, [search_text, onChange]);

  const [options, set_options] = useState({ places: [], min_price: 0, max_price: 0 });

  useEffect(() => {
    let cancelled = false;

    axios
      .get(`${API_BASE}/api/trips/filter-options/`)
      .then((res) => {
        if (cancelled) return;
        const data = (res && res.data) || {};
        set_options({
          places: Array.isArray(data.places) ? data.places : [],
          min_price: data.min_price || 0,
          max_price: data.max_price || 0,
        });
      })
      .catch(() => {
        // The bar still works without the option list — the dropdown just
        // falls back to "all destinations" and the price inputs to no hint.
      });

    return () => {
      cancelled = true;
    };
  }, []);

  const min_rating = filters.min_rating ? Number(filters.min_rating) : 0;

  return (
    <Card className="filter-bar" dir="rtl">
      <div className="filter-bar-head">
        <h3 className="filter-bar-title">{FILTER_STRINGS.title}</h3>
        <span className="filter-bar-count">{FILTER_STRINGS.results_count(resultCount)}</span>
      </div>

      <div className="filter-bar-grid">
        <Input
          label={FILTER_STRINGS.search_label}
          name="trip_search"
          type="search"
          icon="fa-solid fa-magnifying-glass"
          placeholder={FILTER_STRINGS.search_placeholder}
          containerClassName="filter-bar-field"
          value={search_text}
          onChange={(event) => set_search_text(event.target.value)}
        />

        <div className="ui-field filter-bar-field">
          <label className="ui-field-label" htmlFor="trip_place">
            {FILTER_STRINGS.place_label}
          </label>
          <select
            id="trip_place"
            className="filter-bar-select"
            value={filters.place}
            onChange={(event) => onChange("place", event.target.value)}
          >
            <option value="">{FILTER_STRINGS.place_any}</option>
            {options.places.map((place) => (
              <option key={place} value={place}>
                {place}
              </option>
            ))}
          </select>
        </div>

        <div className="ui-field filter-bar-field filter-bar-price">
          <span className="ui-field-label">{FILTER_STRINGS.price_label}</span>
          <div className="filter-bar-price-inputs">
            <input
              type="number"
              min="0"
              className="filter-bar-number"
              aria-label={FILTER_STRINGS.min_price_placeholder}
              placeholder={`${FILTER_STRINGS.min_price_placeholder} ${options.min_price}`}
              value={filters.min_price}
              onChange={(event) => onChange("min_price", event.target.value)}
            />
            <span className="filter-bar-price-dash">—</span>
            <input
              type="number"
              min="0"
              className="filter-bar-number"
              aria-label={FILTER_STRINGS.max_price_placeholder}
              placeholder={`${FILTER_STRINGS.max_price_placeholder} ${options.max_price}`}
              value={filters.max_price}
              onChange={(event) => onChange("max_price", event.target.value)}
            />
          </div>
        </div>

        <div className="ui-field filter-bar-field">
          <span className="ui-field-label">{FILTER_STRINGS.rating_label}</span>
          <div className="filter-bar-rating">
            <StarRating
              value={min_rating}
              onChange={(value) => onChange("min_rating", String(value))}
              label={FILTER_STRINGS.rating_label}
            />
            {min_rating > 0 && (
              <button
                type="button"
                className="filter-bar-clear-rating"
                onClick={() => onChange("min_rating", "")}
              >
                {FILTER_STRINGS.rating_any}
              </button>
            )}
          </div>
        </div>

        <div className="ui-field filter-bar-field">
          <label className="ui-field-label" htmlFor="trip_ordering">
            {FILTER_STRINGS.sort_label}
          </label>
          <select
            id="trip_ordering"
            className="filter-bar-select"
            value={filters.ordering}
            onChange={(event) => onChange("ordering", event.target.value)}
          >
            {SORT_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>

        <div className="filter-bar-actions">
          <Button variant="ghost" size="sm" onClick={onReset} disabled={!hasActiveFilters}>
            {FILTER_STRINGS.reset}
          </Button>
        </div>
      </div>
    </Card>
  );
}
