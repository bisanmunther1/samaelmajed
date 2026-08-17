import StarRating from "./StarRating";
import Skeleton from "../ui/Skeleton/Skeleton";
import { REVIEW_STRINGS } from "./strings";
import "./RatingSummary.css";

const STAR_ROWS = [5, 4, 3, 2, 1];

export default function RatingSummary({ average = 0, count = 0, distribution = {}, loading = false }) {
  if (loading) {
    return (
      <div className="review-summary">
        <div className="review-summary-score">
          <Skeleton height="42px" width="70px" />
          <Skeleton height="16px" width="110px" />
        </div>
        <div className="review-summary-bars">
          {STAR_ROWS.map((star) => (
            <Skeleton key={star} height="12px" />
          ))}
        </div>
      </div>
    );
  }

  const numeric_average = Number(average || 0);

  return (
    <div className="review-summary">
      <div className="review-summary-score">
        <div className="review-summary-average">{numeric_average.toFixed(1)}</div>
        <StarRating value={numeric_average} size="md" />
        <div className="review-summary-count">{REVIEW_STRINGS.reviews_count(count)}</div>
      </div>

      <div className="review-summary-bars">
        {STAR_ROWS.map((star) => {
          const star_count = distribution[star] || distribution[String(star)] || 0;
          const percent = count > 0 ? Math.round((star_count / count) * 100) : 0;

          return (
            <div className="review-summary-row" key={star}>
              <span className="review-summary-row-label">{REVIEW_STRINGS.distribution_row(star)}</span>
              <span
                className="review-summary-track"
                role="progressbar"
                aria-label={REVIEW_STRINGS.distribution_row(star)}
                aria-valuenow={percent}
                aria-valuemin={0}
                aria-valuemax={100}
              >
                <span className="review-summary-fill" style={{ width: `${percent}%` }}></span>
              </span>
              <span className="review-summary-row-count">{star_count}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
