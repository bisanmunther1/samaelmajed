import { useCallback, useEffect, useState } from "react";
import Card from "../ui/Card/Card";
import RatingSummary from "./RatingSummary";
import ReviewForm from "./ReviewForm";
import ReviewList from "./ReviewList";
import { fetch_pending_reviews, fetch_summary, is_logged_in } from "./reviewsApi";
import { REVIEW_STRINGS } from "./strings";
import "./ReviewsSection.css";

const EMPTY_SUMMARY = { average: 0, count: 0, distribution: {} };

/**
 * The whole reviews block for one trip or hotel: aggregate summary, the list,
 * and — only for a user with a finished, paid, not-yet-reviewed booking of this
 * exact target — the form.
 */
export default function ReviewsSection({ targetType, targetId }) {
  const [summary, set_summary] = useState(EMPTY_SUMMARY);
  const [summary_loading, set_summary_loading] = useState(true);
  const [eligible_booking, set_eligible_booking] = useState(null);
  const [refresh_key, set_refresh_key] = useState(0);

  useEffect(() => {
    if (!targetId) return undefined;
    let cancelled = false;

    set_summary_loading(true);
    fetch_summary({ targetType, targetId })
      .then((data) => {
        if (cancelled) return;
        set_summary(data);
      })
      .catch(() => {
        if (cancelled) return;
        set_summary(EMPTY_SUMMARY);
      })
      .finally(() => {
        if (!cancelled) set_summary_loading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [targetType, targetId, refresh_key]);

  // Eligibility is the server's call: a booking only shows up in /pending/ when
  // it is paid, finished and not yet reviewed.
  useEffect(() => {
    if (!targetId || !is_logged_in()) {
      set_eligible_booking(null);
      return undefined;
    }
    let cancelled = false;

    fetch_pending_reviews()
      .then((rows) => {
        if (cancelled) return;
        // Matched on the target, not the booking: a reviewed hotel must never
        // hide the trip form for the same booking, or the other way round.
        const match = (rows || []).find(
          (row) => row.target_type === targetType && row.target_id === targetId
        );
        set_eligible_booking(match ? match.booking : null);
      })
      .catch(() => {
        if (cancelled) return;
        set_eligible_booking(null);
      });

    return () => {
      cancelled = true;
    };
  }, [targetType, targetId, refresh_key]);

  const handle_changed = useCallback(() => {
    set_refresh_key((key) => key + 1);
  }, []);

  if (!targetId) return null;

  return (
    <section className="reviews-section" dir="rtl">
      <h3 className="reviews-section-title">{REVIEW_STRINGS.section_title}</h3>

      <Card className="reviews-section-card">
        <RatingSummary
          average={summary.average}
          count={summary.count}
          distribution={summary.distribution}
          loading={summary_loading}
        />
      </Card>

      {eligible_booking !== null && (
        <Card className="reviews-section-card">
          <h4 className="reviews-section-subtitle">{REVIEW_STRINGS.form_title}</h4>
          <ReviewForm
            booking={eligible_booking}
            targetType={targetType}
            targetId={targetId}
            onSaved={handle_changed}
          />
        </Card>
      )}

      <Card className="reviews-section-card">
        <ReviewList
          targetType={targetType}
          targetId={targetId}
          refreshKey={refresh_key}
          onChanged={handle_changed}
        />
      </Card>
    </section>
  );
}
