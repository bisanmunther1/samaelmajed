// Bridges the per-feature strings modules onto i18next.
//
// The earlier FRs each exported a plain object of Arabic strings, and dozens of
// call sites read `SOME_STRINGS.key` (or call `SOME_STRINGS.key(arg)` for the
// interpolated ones). Resolving those through a Proxy keeps every one of those
// call sites working untouched, while the value now comes from the active
// language at the moment it is read rather than being frozen at module load.

import { translate } from "./index";

/**
 * @param namespace     i18n namespace, e.g. "reviews"
 * @param interpolated  { key: [positional param names] } for the entries that
 *                      used to be functions
 */
export function make_strings(namespace, interpolated = {}) {
  return new Proxy(
    {},
    {
      get(_target, key) {
        if (typeof key !== "string") return undefined;

        const params = interpolated[key];
        if (params) {
          return (...args) => {
            const options = {};
            params.forEach((name, index) => {
              options[name] = args[index];
            });
            return translate(`${namespace}:${key}`, options);
          };
        }

        return translate(`${namespace}:${key}`);
      },

      has() {
        return true;
      },
    }
  );
}

/**
 * Server error code -> message in the active language.
 *
 * The backend sends Arabic with a stable `code` (FR-38 onwards). Reading an
 * unknown code returns undefined so the caller falls back to the server's own
 * `detail`, which is exactly the behaviour the API layers already expect.
 */
export function make_error_messages() {
  return new Proxy(
    {},
    {
      get(_target, code) {
        if (typeof code !== "string") return undefined;

        const translated = translate(`errors:${code}`);
        // i18next returns the key itself when it is missing.
        return translated === code || translated === `errors:${code}` ? undefined : translated;
      },

      has(_target, code) {
        const translated = translate(`errors:${code}`);
        return translated !== code && translated !== `errors:${code}`;
      },
    }
  );
}
