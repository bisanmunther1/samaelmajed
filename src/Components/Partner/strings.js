// FR-46 copy, now resolved through i18next (namespace "partner").

import { translate } from "../../i18n";
import { make_error_messages, make_strings } from "../../i18n/strings_shim";

export const PARTNER_STRINGS = make_strings("partner");

export const PARTNER_ERROR_MESSAGES = make_error_messages();

export function partner_type_options() {
  return [
    { value: "tour_operator", label: translate("partner:register_type_tour") },
    { value: "hotel_manager", label: translate("partner:register_type_hotel") },
  ];
}

export const BOOKING_STATUS_LABELS = new Proxy({}, {
  get: (_t, status) => (typeof status === "string" ? translate(`partner:status_${status}`) : undefined),
});
