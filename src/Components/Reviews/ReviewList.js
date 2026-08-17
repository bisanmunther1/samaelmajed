import { useCallback, useEffect, useState } from "react";
import Avatar from "../ui/Avatar/Avatar";
import Button from "../ui/Button/Button";
import EmptyState from "../ui/EmptyState/EmptyState";
import ErrorState from "../ui/ErrorState/ErrorState";
import Skeleton from "../ui/Skeleton/Skeleton";
import { useToast } from "../ui/Toast/ToastContext";
import ReviewForm from "./ReviewForm";
import StarRating from "./StarRating";
import { delete_review, fetch_reviews, review_error_message } from "./reviewsApi";
import { REVIEW_STRINGS, SORT_OPTIONS } from "./strings";
import "./ReviewList.css";

const PAGE_SIZE = 10;

function format_date(value) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleDateString("ar-EG", { year: "numeric", month: "long", day: "numeric" });
}

export default function ReviewList({ targetType, targetId, refreshKey = 0, onChanged }) {
  const [status, set_status] = useState("loading"); // loading | error | success
  const [reviews, set_reviews] = useState([]);
  const [count, set_count] = useState(0);
  const [page, set_page] = useState(1);
  const [ordering, set_ordering] = useState(SORT_OPTIONS[0].value);
  const [editing_id, set_editing_id] = useState(null);
  const [deleting_id, set_deleting_id] = useState(null);
  const [retry_key, set_retry_key] = useState(0);

  const { showToast } = useToast();

  // Sorting or reloading after a write should start again from page one.
  useEffect(() => {
    set_page(1);
  }, [ordering, targetType, targetId, refreshKey]);

  useEffect(() => {
    if (!targetId) return undefined;
    let cancelled = false;

    set_status("loading");
    fetch_reviews({ targetType, targetId, page, ordering })
      .then((data) => {
        if (cancelled) return;
        set_reviews(data.results || []);
        set_count(data.count || 0);
        set_status("success");
      })
      .catch(() => {
        if (cancelled) return;
        set_status("error");
      });

    return () => {
      cancelled = true;
    };
  }, [targetType, targetId, page, ordering, refreshKey, retry_key]);

  const notify_changed = useCallback(() => {
    set_editing_id(null);
    set_retry_key((key) => key + 1);
    if (onChanged) onChanged();
  }, [onChanged]);

  async function handle_delete(review) {
    // eslint-disable-next-line no-restricted-globals
    if (!window.confirm(REVIEW_STRINGS.delete_confirm)) return;

    set_deleting_id(review.id);
    try {
      await delete_review(review.id);
      showToast(REVIEW_STRINGS.deleted, "success");
      notify_changed();
    } catch (error) {
      showToast(review_error_message(error), "error");
    } finally {
      set_deleting_id(null);
    }
  }

  const total_pages = Math.max(1, Math.ceil(count / PAGE_SIZE));

  return (
    <div className="review-list">
      <div className="review-list-header">
        <h4 className="review-list-title">{REVIEW_STRINGS.list_title}</h4>

        <label className="review-list-sort">
          <span>{REVIEW_STRINGS.sort_label}</span>
          <select value={ordering} onChange={(event) => set_ordering(event.target.value)}>
            {SORT_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>
      </div>

      {status === "loading" && (
        <div className="review-list-skeleton">
          {[0, 1, 2].map((row) => (
            <div className="review-list-skeleton-row" key={row}>
              <Skeleton height="40px" width="40px" radius="50%" />
              <div className="review-list-skeleton-lines">
                <Skeleton height="14px" width="35%" />
                <Skeleton height="12px" width="80%" />
              </div>
            </div>
          ))}
        </div>
      )}

      {status === "error" && (
        <ErrorState
          message={REVIEW_STRINGS.load_error}
          onRetry={() => set_retry_key((key) => key + 1)}
        />
      )}

      {status === "success" && reviews.length === 0 && (
        <EmptyState
          icon="fa-regular fa-comment-dots"
          title={REVIEW_STRINGS.empty_title}
          message={REVIEW_STRINGS.empty_message}
        />
      )}

      {status === "success" && reviews.length > 0 && (
        <ul className="review-list-items">
          {reviews.map((review) => (
            <li className="review-item" key={review.id}>
              <Avatar name={review.user_display_name} size={40} />

              <div className="review-item-body">
                <div className="review-item-head">
                  <span className="review-item-author">{review.user_display_name}</span>
                  <StarRating value={review.rating} size="sm" />
                  <span className="review-item-date">
                    {format_date(review.created_at)}
                    {review.updated_at !== review.created_at && ` ${REVIEW_STRINGS.edited_marker}`}
                  </span>
                </div>

                {editing_id === review.id ? (
                  <ReviewForm
                    review={review}
                    targetType={targetType}
                    targetId={targetId}
                    onSaved={notify_changed}
                    onCancel={() => set_editing_id(null)}
                  />
                ) : (
                  <>
                    {review.comment && <p className="review-item-comment">{review.comment}</p>}

                    {(review.can_edit || review.can_delete) && (
                      <div className="review-item-actions">
                        {review.can_edit && (
                          <Button variant="ghost" size="sm" onClick={() => set_editing_id(review.id)}>
                            {REVIEW_STRINGS.edit}
                          </Button>
                        )}
                        {review.can_delete && (
                          <Button
                            variant="ghost"
                            size="sm"
                            loading={deleting_id === review.id}
                            onClick={() => handle_delete(review)}
                          >
                            {REVIEW_STRINGS.delete}
                          </Button>
                        )}
                      </div>
                    )}
                  </>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}

      {status === "success" && total_pages > 1 && (
        <div className="review-list-pager">
          <Button
            variant="ghost"
            size="sm"
            disabled={page <= 1}
            onClick={() => set_page((current) => Math.max(1, current - 1))}
          >
            {REVIEW_STRINGS.previous_page}
          </Button>

          <span className="review-list-page-position">
            {REVIEW_STRINGS.page_position(page, total_pages)}
          </span>

          <Button
            variant="ghost"
            size="sm"
            disabled={page >= total_pages}
            onClick={() => set_page((current) => Math.min(total_pages, current + 1))}
          >
            {REVIEW_STRINGS.next_page}
          </Button>
        </div>
      )}
    </div>
  );
}
