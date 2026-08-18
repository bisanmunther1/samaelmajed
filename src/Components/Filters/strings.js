// FR-39 copy, now resolved through i18next (namespace "filters").

import { translate } from "../../i18n";
import { make_error_messages, make_strings } from "../../i18n/strings_shim";

export const FILTER_STRINGS = make_strings("filters", {
  results_count: ["count"],
});

export const FILTER_ERROR_MESSAGES = make_error_messages();

// Values match the `ordering` whitelist in common/filtering.py.
export function sort_options() {
  return [
    { value: "", label: translate("filters:sort_default") },
    { value: "price", label: translate("filters:sort_price_asc") },
    { value: "-price", label: translate("filters:sort_price_desc") },
    { value: "-average_rating", label: translate("filters:sort_rating_reviews") },
    { value: "-rate", label: translate("filters:sort_rating_editorial") },
    { value: "-reviews_count", label: translate("filters:sort_reviews_count") },
    { value: "-num", label: translate("filters:sort_most_visited") },
    { value: "name", label: translate("filters:sort_name_asc") },
    { value: "-name", label: translate("filters:sort_name_desc") },
  ];
}

// The query-string keys. Shared by the FilterBar and the results grid so the
// two can never drift apart. Not user-facing, so not translated.
export const FILTER_KEYS = ["search", "place", "min_price", "max_price", "min_rating", "ordering"];
