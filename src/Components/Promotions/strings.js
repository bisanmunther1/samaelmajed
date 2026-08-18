// FR-45 copy, now resolved through i18next (namespace "promotions").

import { make_error_messages, make_strings } from "../../i18n/strings_shim";

export const PROMO_STRINGS = make_strings("promotions", {
  applied_title: ["code"],
});

export const PROMO_ERROR_MESSAGES = make_error_messages();
