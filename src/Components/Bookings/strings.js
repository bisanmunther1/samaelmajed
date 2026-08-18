// FR-43 / FR-40 copy, now resolved through i18next (namespace "bookings").

import { translate } from "../../i18n";
import { make_error_messages, make_strings } from "../../i18n/strings_shim";

export const BOOKING_STRINGS = make_strings("bookings", {
  seats_remaining: ["remaining"],
  days_until: ["days"],
});

export const BOOKING_ERROR_MESSAGES = make_error_messages();

// Read at render time, so both stay in the active language.
export const REFUND_TIER_LABELS = new Proxy({}, {
  get: (_t, tier) => (typeof tier === "string" ? translate(`bookings:refund_tier_${tier}`) : undefined),
});

export const REFUND_STATUS_LABELS = new Proxy({}, {
  get: (_t, status) => (typeof status === "string" ? translate(`bookings:refund_status_${status}`) : undefined),
});
