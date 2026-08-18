// FR-38 copy, now resolved through i18next (namespace "reviews").
// The exported shape is unchanged, so every call site still reads
// `REVIEW_STRINGS.submit` / `REVIEW_STRINGS.reviews_count(n)` as before.

import { translate } from "../../i18n";
import { make_error_messages, make_strings } from "../../i18n/strings_shim";

export const REVIEW_STRINGS = make_strings("reviews", {
  star_option: ["value"],
  stars_out_of: ["value"],
  rating_value: ["value"],
  reviews_count: ["count"],
  distribution_row: ["stars"],
  characters_left: ["used", "max"],
  page_position: ["page", "total"],
  pending_date: ["date"],
});

export const REVIEW_ERROR_MESSAGES = make_error_messages();

export const MAX_COMMENT_LENGTH = 1000;

// A function rather than a constant array: the labels have to be read in the
// language that is active when the control renders, not at module load.
export function sort_options() {
  return [
    { value: "-created_at", label: translate("reviews:sort_newest") },
    { value: "-rating", label: translate("reviews:sort_highest") },
    { value: "rating", label: translate("reviews:sort_lowest") },
  ];
}
