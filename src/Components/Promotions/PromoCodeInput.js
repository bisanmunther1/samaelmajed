import { useState } from "react";
import Button from "../ui/Button/Button";
import Input from "../ui/Input/Input";
import { promo_error_message, validate_promo_code } from "./promotionsApi";
import { PROMO_STRINGS } from "./strings";
import "./PromoCodeInput.css";

/**
 * Promo code entry for the booking flow.
 *
 * The quote it shows comes from the server's dry run; the booking endpoint
 * re-validates and re-prices from scratch, so nothing here can decide what the
 * customer is actually charged.
 */
export default function PromoCodeInput({ tripName, amount, applied, onApplied, onRemoved }) {
  const [code, set_code] = useState("");
  const [submitting, set_submitting] = useState(false);
  const [error, set_error] = useState("");

  async function handle_apply(event) {
    event.preventDefault();
    set_error("");

    const trimmed = code.trim();
    if (!trimmed) {
      set_error(PROMO_STRINGS.empty_code);
      return;
    }

    set_submitting(true);
    try {
      const result = await validate_promo_code({ code: trimmed, trip: tripName, amount });
      onApplied(result);
      set_code("");
    } catch (request_error) {
      set_error(promo_error_message(request_error));
    } finally {
      set_submitting(false);
    }
  }

  function handle_remove() {
    set_error("");
    set_code("");
    onRemoved();
  }

  if (applied) {
    return (
      <div className="promo-box promo-box-applied">
        <div className="promo-applied-text">
          <span className="promo-applied-title">{PROMO_STRINGS.applied_title(applied.code)}</span>
          {applied.description && (
            <span className="promo-applied-description">{applied.description}</span>
          )}
        </div>

        <button type="button" className="promo-remove" onClick={handle_remove}>
          {PROMO_STRINGS.remove}
        </button>
      </div>
    );
  }

  return (
    <form className="promo-box" onSubmit={handle_apply} noValidate>
      <div className="promo-row">
        <Input
          label={PROMO_STRINGS.label}
          name="promo_code"
          placeholder={PROMO_STRINGS.placeholder}
          containerClassName="promo-field"
          value={code}
          onChange={(event) => set_code(event.target.value)}
        />

        <Button type="submit" size="sm" loading={submitting} disabled={submitting}>
          {PROMO_STRINGS.apply}
        </Button>
      </div>

      {error && (
        <p className="promo-error" role="alert">
          {error}
        </p>
      )}
    </form>
  );
}
