import { useEffect, useState } from "react";
import Button from "../ui/Button/Button";
import Modal from "../ui/Modal/Modal";
import Skeleton from "../ui/Skeleton/Skeleton";
import { Textarea } from "../ui/Input/Input";
import {
  booking_error_message, cancel_booking, fetch_cancellation_preview,
} from "./bookingsApi";
import { BOOKING_STRINGS, REFUND_TIER_LABELS } from "./strings";
import "./CancelBookingDialog.css";

/**
 * Confirmation dialog for cancelling a booking.
 *
 * The refund it shows is the server's own preview, and the cancel call
 * recomputes it independently — nothing here decides what is owed.
 */
export default function CancelBookingDialog({ booking, isOpen, onClose, onCancelled }) {
  const [preview, set_preview] = useState(null);
  const [status, set_status] = useState("loading"); // loading | ready | error
  const [reason, set_reason] = useState("");
  const [submitting, set_submitting] = useState(false);
  const [error, set_error] = useState("");

  useEffect(() => {
    if (!isOpen || !booking) return undefined;

    let cancelled = false;
    set_status("loading");
    set_error("");
    set_reason("");

    fetch_cancellation_preview(booking.id)
      .then((data) => {
        if (cancelled) return;
        set_preview(data);
        set_status("ready");
      })
      .catch((request_error) => {
        if (cancelled) return;
        set_error(booking_error_message(request_error));
        set_status("error");
      });

    return () => {
      cancelled = true;
    };
  }, [isOpen, booking]);

  async function handle_confirm() {
    set_submitting(true);
    set_error("");

    try {
      const result = await cancel_booking({ bookingId: booking.id, reason });
      onCancelled(result);
      onClose();
    } catch (request_error) {
      set_error(booking_error_message(request_error));
    } finally {
      set_submitting(false);
    }
  }

  const footer = (
    <div className="cancel-dialog-actions">
      <Button variant="ghost" size="sm" onClick={onClose} disabled={submitting}>
        {BOOKING_STRINGS.cancel_dismiss}
      </Button>
      <Button
        variant="danger"
        size="sm"
        loading={submitting}
        disabled={submitting || status !== "ready" || !preview?.can_cancel}
        onClick={handle_confirm}
      >
        {BOOKING_STRINGS.cancel_confirm}
      </Button>
    </div>
  );

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={BOOKING_STRINGS.cancel_title} footer={footer}>
      <div className="cancel-dialog" dir="rtl">
        {status === "loading" && (
          <div className="cancel-dialog-skeleton">
            <Skeleton height="18px" width="60%" />
            <Skeleton height="18px" width="40%" />
          </div>
        )}

        {status === "ready" && preview && (
          <>
            <div className="cancel-dialog-refund">
              <span className="cancel-dialog-refund-label">{BOOKING_STRINGS.refund_preview}</span>
              <span className="cancel-dialog-refund-amount">{preview.refund_amount}$</span>
            </div>

            <p className="cancel-dialog-tier">{REFUND_TIER_LABELS[preview.refund_tier]}</p>
            <p className="cancel-dialog-days">
              {BOOKING_STRINGS.days_until(preview.days_until_departure)}
            </p>

            <Textarea
              label={BOOKING_STRINGS.cancel_reason_label}
              name="cancellation_reason"
              rows={3}
              placeholder={BOOKING_STRINGS.cancel_reason_placeholder}
              value={reason}
              onChange={(event) => set_reason(event.target.value)}
            />
          </>
        )}

        {error && (
          <p className="cancel-dialog-error" role="alert">
            {error}
          </p>
        )}
      </div>
    </Modal>
  );
}
