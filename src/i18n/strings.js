// Shims for the namespaces that cover the original site chrome. Same Proxy
// mechanism as the per-feature strings modules: read at render time, so a
// language switch is reflected without touching any call site.

import { make_strings } from "./strings_shim";

export const AUTH_STRINGS = make_strings("auth");
export const PROFILE_STRINGS = make_strings("profile", { member_since: ["date"] });
export const GALLERY_STRINGS = make_strings("gallery");
export const DISCOUNT_STRINGS = make_strings("discount");
export const RESERVE_STRINGS = make_strings("reserve", {
  more_photos: ["trip"],
  starts_at: ["when"],
  transport_summary: ["kind", "name"],
  hotel_summary: ["name", "date"],
});
