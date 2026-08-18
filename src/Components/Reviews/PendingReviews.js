import { useCallback, useEffect, useState } from "react";
import Button from "../ui/Button/Button";
import Card from "../ui/Card/Card";
import Modal from "../ui/Modal/Modal";
import Skeleton from "../ui/Skeleton/Skeleton";
import ReviewForm from "./ReviewForm";
import { fetch_pending_reviews, is_logged_in } from "./reviewsApi";
import { REVIEW_STRINGS } from "./strings";
import "./PendingReviews.css";

/**
 * The "قيّم رحلتك" prompt on the bookings page: one call to action per booking
 * the user has finished but not yet reviewed. Clicking one opens the review
 * form in a modal.
 */
export default function PendingReviews() {
  const [status, set_status] = useState("loading"); // loading | error | success
  const [rows, set_rows] = useState([]);
  const [active, set_active] = useState(null); // { booking, targetType, targetId }
  const [reload_key, set_reload_key] = useState(0);

  useEffect(() => {
    if (!is_logged_in()) {
      set_rows([]);
      set_status("success");
      return undefined;
    }
    let cancelled = false;

    set_status("loading");
    fetch_pending_reviews()
      .then((data) => {
        if (cancelled) return;
        set_rows(data || []);
        set_status("success");
      })
      .catch(() => {
        if (cancelled) return;
        // A logged-out or expired session is not an error worth shouting
        // about here — the prompt simply does not apply.
        set_rows([]);
        set_status("error");
      });

    return () => {
      cancelled = true;
    };
  }, [reload_key]);

  const handle_saved = useCallback(() => {
    set_active(null);
    set_reload_key((key) => key + 1);
  }, []);

  if (status === "error") return null;

  if (status === "loading") {
    return (
      <Card className="pending-reviews">
        <Skeleton height="18px" width="40%" />
        <Skeleton height="38px" />
      </Card>
    );
  }

  if (rows.length === 0) return null;

  // The endpoint already returns one entry per outstanding target, so a
  // booking with both an unreviewed trip and an unreviewed hotel arrives as
  // two rows and gets two calls to action.
  const calls_to_action = rows.map((row) => ({
    key: `${row.target_type}-${row.booking}`,
    booking: row.booking,
    targetType: row.target_type,
    targetId: row.target_id,
    targetName: row.target_name,
    targetDate: row.target_date,
    label: row.target_type === "trip" ? REVIEW_STRINGS.rate_your_trip : REVIEW_STRINGS.rate_your_stay,
  }));

  return (
    <Card className="pending-reviews">
      <div className="pending-reviews-head">
        <h3 className="pending-reviews-title">{REVIEW_STRINGS.pending_title}</h3>
        <p className="pending-reviews-hint">{REVIEW_STRINGS.pending_hint}</p>
      </div>

      <ul className="pending-reviews-items">
        {calls_to_action.map((item) => (
          <li className="pending-reviews-item" key={item.key}>
            <span className="pending-reviews-target">
              <i
                className={item.targetType === "trip" ? "fa-solid fa-plane-departure" : "fa-solid fa-hotel"}
                aria-hidden="true"
              ></i>
              {item.targetName}
              {item.targetDate && (
                <span className="pending-reviews-date">
                  {REVIEW_STRINGS.pending_date(item.targetDate)}
                </span>
              )}
            </span>

            <Button size="sm" onClick={() => set_active(item)}>
              {item.label}
            </Button>
          </li>
        ))}
      </ul>

      <Modal
        isOpen={active !== null}
        onClose={() => set_active(null)}
        title={active ? `${active.label} — ${active.targetName}` : ""}
      >
        {active && (
          <div>
            <ReviewForm
              booking={active.booking}
              targetType={active.targetType}
              targetId={active.targetId}
              onSaved={handle_saved}
              onCancel={() => set_active(null)}
            />
          </div>
        )}
      </Modal>
    </Card>
  );
}
