import { useRef, useState } from "react";
import { REVIEW_STRINGS } from "./strings";
import "./StarRating.css";

const MAX_STARS = 5;
const STAR_VALUES = [1, 2, 3, 4, 5];

function star_icon_class(position, filled_up_to) {
  if (position <= Math.floor(filled_up_to)) return "fa-solid fa-star";
  if (position - filled_up_to <= 0.5) return "fa-solid fa-star-half-stroke";
  return "fa-regular fa-star";
}

// The nearest `dir` attribute wins, so a component dropped inside the RTL
// reviews section behaves correctly without having to be told; computed style
// is the fallback for pages that set direction in CSS alone.
function resolve_direction(node) {
  if (!node) return "ltr";

  const explicit = node.closest("[dir]");
  if (explicit) return explicit.getAttribute("dir") === "rtl" ? "rtl" : "ltr";

  return window.getComputedStyle(node).direction === "rtl" ? "rtl" : "ltr";
}

/**
 * Star rating, read-only by default and interactive as soon as `onChange` is
 * given. Keyboard: arrow keys move between the stars (selecting as they go, per
 * the ARIA radiogroup pattern), Enter/Space confirms, Home/End jump to 1/5.
 */
export default function StarRating({
  value = 0,
  onChange,
  size = "md",
  label,
  showValue = false,
  className = "",
}) {
  const interactive = typeof onChange === "function";
  const [hovered, set_hovered] = useState(0);
  const container_ref = useRef(null);
  const star_refs = useRef([]);

  const classes = ["review-stars", `review-stars-${size}`, className].filter(Boolean).join(" ");

  if (!interactive) {
    // Averages arrive as decimals, so round to the nearest half star.
    const display_value = Math.round(Number(value || 0) * 2) / 2;

    return (
      <span
        className={classes}
        role="img"
        aria-label={REVIEW_STRINGS.stars_out_of(display_value)}
      >
        {STAR_VALUES.map((star) => (
          <i key={star} className={star_icon_class(star, display_value)} aria-hidden="true"></i>
        ))}
        {showValue && (
          <span className="review-stars-value">{display_value.toFixed(1)}</span>
        )}
      </span>
    );
  }

  const filled_up_to = hovered || value;

  function focus_star(star) {
    const node = star_refs.current[star - 1];
    if (node) node.focus();
  }

  function select(star) {
    const clamped = Math.min(MAX_STARS, Math.max(1, star));
    onChange(clamped);
    focus_star(clamped);
  }

  function handle_key_down(event) {
    // In RTL the visually "next" star sits to the left, so the horizontal
    // arrows swap meaning. Vertical arrows and Home/End never do.
    const direction = resolve_direction(container_ref.current);
    const forward = direction === "rtl" ? "ArrowLeft" : "ArrowRight";
    const backward = direction === "rtl" ? "ArrowRight" : "ArrowLeft";

    const current = value || 0;

    if (event.key === forward || event.key === "ArrowUp") {
      event.preventDefault();
      select(current + 1 || 1);
    } else if (event.key === backward || event.key === "ArrowDown") {
      event.preventDefault();
      select(current - 1 || 1);
    } else if (event.key === "Home") {
      event.preventDefault();
      select(1);
    } else if (event.key === "End") {
      event.preventDefault();
      select(MAX_STARS);
    } else if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      select(current || 1);
    }
  }

  return (
    <span
      className={`${classes} review-stars-input`}
      role="radiogroup"
      aria-label={label || REVIEW_STRINGS.stars_label}
      ref={container_ref}
      onKeyDown={handle_key_down}
      onMouseLeave={() => set_hovered(0)}
    >
      {STAR_VALUES.map((star) => (
        <button
          key={star}
          type="button"
          role="radio"
          aria-checked={value === star}
          aria-label={REVIEW_STRINGS.star_option(star)}
          tabIndex={star === (value || 1) ? 0 : -1}
          ref={(node) => {
            star_refs.current[star - 1] = node;
          }}
          className="review-stars-button"
          onClick={() => select(star)}
          onMouseEnter={() => set_hovered(star)}
        >
          <i className={star_icon_class(star, filled_up_to)} aria-hidden="true"></i>
        </button>
      ))}
      {showValue && value > 0 && (
        <span className="review-stars-value">{REVIEW_STRINGS.rating_value(value)}</span>
      )}
    </span>
  );
}
