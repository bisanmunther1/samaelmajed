import { useState } from "react";
import Button from "../ui/Button/Button";
import { Textarea } from "../ui/Input/Input";
import { useToast } from "../ui/Toast/ToastContext";
import StarRating from "./StarRating";
import { create_review, review_error_message, update_review } from "./reviewsApi";
import { MAX_COMMENT_LENGTH, REVIEW_STRINGS } from "./strings";
import "./ReviewForm.css";

/**
 * Write or edit one review. `review` switches the form into edit mode; in
 * create mode `booking` says which booking the review hangs off.
 */
export default function ReviewForm({
  booking,
  targetType,
  targetId,
  review = null,
  onSaved,
  onCancel,
}) {
  const editing = review !== null;
  const { showToast } = useToast();

  const [rating, set_rating] = useState(editing ? review.rating : 0);
  const [comment, set_comment] = useState(editing ? review.comment || "" : "");
  const [submitting, set_submitting] = useState(false);
  const [submitted, set_submitted] = useState(false);
  const [server_error, set_server_error] = useState("");

  // The same rules the serializer enforces, checked up front so the user is
  // not made to wait on a round trip to hear about them.
  function client_error() {
    if (!(rating >= 1 && rating <= 5)) return REVIEW_STRINGS.rating_required;
    if (comment.length > MAX_COMMENT_LENGTH) return REVIEW_STRINGS.comment_too_long_client;
    return "";
  }

  const validation_error = client_error();
  const shown_error = server_error || (submitted ? validation_error : "");

  async function handle_submit(event) {
    event.preventDefault();
    set_submitted(true);
    set_server_error("");

    if (client_error()) return;

    set_submitting(true);
    try {
      const saved = editing
        ? await update_review({ id: review.id, rating, comment })
        : await create_review({ booking, targetType, targetId, rating, comment });

      showToast(editing ? REVIEW_STRINGS.updated : REVIEW_STRINGS.created, "success");
      if (!editing) {
        set_rating(0);
        set_comment("");
        set_submitted(false);
      }
      if (onSaved) onSaved(saved);
    } catch (error) {
      set_server_error(review_error_message(error));
    } finally {
      set_submitting(false);
    }
  }

  return (
    <form className="review-form" onSubmit={handle_submit} noValidate>
      <div className="review-form-stars">
        <span className="review-form-stars-label">{REVIEW_STRINGS.stars_label}</span>
        <StarRating
          value={rating}
          onChange={(next) => {
            set_rating(next);
            set_server_error("");
          }}
          size="lg"
          showValue
          label={REVIEW_STRINGS.stars_label}
        />
      </div>

      <Textarea
        label={REVIEW_STRINGS.comment_label}
        name={editing ? `review_comment_${review.id}` : "review_comment"}
        rows={4}
        placeholder={REVIEW_STRINGS.comment_placeholder}
        value={comment}
        maxLength={MAX_COMMENT_LENGTH}
        onChange={(event) => {
          set_comment(event.target.value);
          set_server_error("");
        }}
      />

      <div className="review-form-counter" aria-live="polite">
        {REVIEW_STRINGS.characters_left(comment.length, MAX_COMMENT_LENGTH)}
      </div>

      {shown_error && (
        <p className="review-form-error" role="alert">
          {shown_error}
        </p>
      )}

      <div className="review-form-actions">
        <Button type="submit" loading={submitting} disabled={submitting}>
          {editing ? REVIEW_STRINGS.submit_edit : REVIEW_STRINGS.submit}
        </Button>

        {onCancel && (
          <Button type="button" variant="ghost" onClick={onCancel} disabled={submitting}>
            {REVIEW_STRINGS.cancel}
          </Button>
        )}
      </div>
    </form>
  );
}
