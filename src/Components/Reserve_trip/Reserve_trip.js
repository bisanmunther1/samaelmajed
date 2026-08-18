/* eslint-disable react/jsx-pascal-case */
import "./Reserve_trip.css";
import Hotels_reserve from "./Hotels_reserve";

import { Fragment, useEffect, useRef, useState } from "react";
import axios from "axios";
import Paypal from "./Paypal";
import { useBooking } from "./BookingContext";
import { useToast } from "../ui/Toast/ToastContext";
import Modal from "../ui/Modal/Modal";
import Button from "../ui/Button/Button";
import Input from "../ui/Input/Input";
import Skeleton from "../ui/Skeleton/Skeleton";
import ErrorState from "../ui/ErrorState/ErrorState";
import ReviewsSection from "../Reviews/ReviewsSection";
import PromoCodeInput from "../Promotions/PromoCodeInput";
import { PROMO_STRINGS } from "../Promotions/strings";
import { fetch_trip_availability } from "../Bookings/bookingsApi";
import { BOOKING_STRINGS } from "../Bookings/strings";
import { RESERVE_STRINGS } from "../../i18n/strings";

// Built per render, not at module load: labels must come from the language
// that is active now, not whichever one was active on import.
function steps() {
  return [
    { id: 1, label: RESERVE_STRINGS.step_transport },
    { id: 2, label: RESERVE_STRINGS.step_hotel },
    { id: 3, label: RESERVE_STRINGS.step_payment },
  ];
}

function today_iso() {
  return new Date().toISOString().substring(0, 10);
}

export default function Reserve_trip() {
  const { tripName, closeBooking } = useBooking();
  const { showToast } = useToast();

  const [features_status, set_features_status] = useState("idle"); // idle | loading | error | success
  const [features, set_features] = useState(null);

  const [hotel_options, set_hotel_options] = useState([]); // [{ name, price }]
  const [hotel_options_status, set_hotel_options_status] = useState("idle");

  const [step, set_step] = useState(1);
  const [transport_tab, set_transport_tab] = useState("plane");
  const [selected_transport, set_selected_transport] = useState({ kind: "none", index: null, price: 0, name: null });
  const [selected_hotel, set_selected_hotel] = useState(null); // { name, price } | null
  const [hotel_reserve_date, set_hotel_reserve_date] = useState(today_iso());
  // The departure date this booking is for. Bug fix: this used to be
  // hardcoded to today everywhere, so a capacity/availability row an admin
  // configured for a future date was never consulted and never enforced —
  // every booking silently went through "today" regardless of what the
  // customer saw or picked. Now it is real state, driving both the
  // availability check and the booking payload.
  const [trip_date, set_trip_date] = useState(today_iso());
  const [ready_to_pay, set_ready_to_pay] = useState(false);
  const [submitting, set_submitting] = useState(false);
  const submitting_lock_ref = useRef(false);
  const [lightbox_image, set_lightbox_image] = useState(null);
  const [retry_key, set_retry_key] = useState(0);

  // FR-43. Seats wanted, and what the departure has left.
  const [seats, set_seats] = useState(1);
  const [availability, set_availability] = useState(null); // { remaining_seats, is_sold_out }

  // fetch trip features whenever a new trip is opened
  useEffect(() => {
    if (!tripName) return;
    let cancelled = false;

    set_features_status("loading");
    set_features(null);
    set_hotel_options([]);
    set_hotel_options_status("idle");
    set_step(1);
    set_transport_tab("plane");
    set_selected_transport({ kind: "none", index: null, price: 0, name: null });
    set_selected_hotel(null);
    set_hotel_reserve_date(today_iso());
    set_trip_date(today_iso());
    set_ready_to_pay(false);
    set_lightbox_image(null);

    axios
      .get(`http://127.0.0.1:8000/trip_features/${tripName}/`)
      .then((res) => {
        if (cancelled) return;
        set_features(res.data);
        set_features_status("success");
      })
      .catch((err) => {
        if (cancelled) return;
        console.log("error in features", err);
        set_features_status("error");
      });

    return () => {
      cancelled = true;
    };
  }, [tripName, retry_key]);

  // default-select the first available plane option, else the first bus option
  useEffect(() => {
    if (!features) return;

    for (let i = 1; i <= 5; i++) {
      if (features[`access_plane_${i}`] && features[`access_plane_name_${i}`] !== "none" && features[`access_plane_price_${i}`] > 0) {
        set_selected_transport({
          kind: "plane",
          index: i,
          price: parseInt(features[`access_plane_price_${i}`]),
          name: features[`access_plane_name_${i}`],
        });
        set_transport_tab("plane");
        return;
      }
    }
    for (let i = 1; i <= 5; i++) {
      if (features[`access_bus_${i}`] && features[`access_bus_name_${i}`] !== "none" && features[`access_bus_price_${i}`] > 0) {
        set_selected_transport({
          kind: "bus",
          index: i,
          price: parseInt(features[`access_bus_price_${i}`]),
          name: features[`access_bus_name_${i}`],
        });
        set_transport_tab("bus");
        return;
      }
    }
  }, [features]);

  // Remaining seats for the selected departure date. Re-runs whenever the
  // customer changes the date, so what they see always matches what they are
  // about to book. Public endpoint, so no token juggling here.
  useEffect(() => {
    if (!tripName || !trip_date) return undefined;
    let cancelled = false;

    set_availability(null);
    set_seats(1);

    fetch_trip_availability({ tripName, from: trip_date, to: trip_date })
      .then((data) => {
        if (cancelled) return;
        set_availability((data.days && data.days[0]) || null);
      })
      .catch(() => {
        // Availability is advisory in the UI; the server enforces it either
        // way, so a failure here must not block the flow.
      });

    return () => {
      cancelled = true;
    };
  }, [tripName, trip_date, retry_key]);

  // hotel prices, once trip features have loaded
  useEffect(() => {
    if (!tripName || features_status !== "success") return;
    let cancelled = false;

    set_hotel_options_status("loading");

    axios
      .get(`http://127.0.0.1:8000/hotels/get_prices/${tripName}/`)
      .then((res) => {
        if (cancelled) return;
        const [prices, names] = res.data;
        const options = (names || []).map((name, index) => ({ name, price: parseInt(prices[index]) }));
        set_hotel_options(options);
        set_hotel_options_status("success");
      })
      .catch((err) => {
        if (cancelled) return;
        console.log("error in hotel prices", err);
        set_hotel_options_status("error");
      });

    return () => {
      cancelled = true;
    };
  }, [tripName, features_status]);

  // The trip's own catalog price (trip_features now carries it) -- without
  // it, booking with no transport and no hotel picked invoiced at $0, even
  // though the card advertises a real price for the trip itself.
  const trip_price = features && features.trip_price ? Number(features.trip_price) : 0;
  const total_price = trip_price + selected_transport.price + (selected_hotel ? selected_hotel.price : 0);

  // The server's quote for an applied promo code, or null. The booking endpoint
  // re-prices from scratch, so this only ever drives what is displayed.
  const [applied_promo, set_applied_promo] = useState(null);

  const discount_amount = applied_promo ? Number(applied_promo.discount_amount) : 0;
  const payable_price = Math.max(0, total_price - discount_amount);

  function handle_transport_change(kind, index, price, name) {
    set_selected_transport({ kind, index, price, name: name || null });
    if (ready_to_pay) set_ready_to_pay(false);
    // The quote was priced against the old total; make them re-apply.
    set_applied_promo(null);
  }

  function handle_hotel_change(hotel) {
    set_selected_hotel(hotel);
    if (ready_to_pay) set_ready_to_pay(false);
    set_applied_promo(null);
  }

  // Pre-flight checks only — no toast on success here. The old version of
  // this function fired a "reservation complete" success toast just from
  // these checks passing, before any request was ever made, so a real
  // customer saw "booked!" and nothing was ever created. The success message
  // now only fires once the server actually confirms the booking, in
  // submit_booking below.
  function can_submit_booking() {
    const username = localStorage.getItem("username");

    if (username === null || username === undefined) {
      showToast(RESERVE_STRINGS.need_account, "error");
      return false;
    }
    if (total_price <= 0) {
      showToast(RESERVE_STRINGS.need_selection, "error");
      return false;
    }
    if (availability && availability.is_sold_out) {
      showToast(BOOKING_STRINGS.seats_sold_out, "error");
      return false;
    }
    return true;
  }

  // The one real booking-submission path, used by both the primary "ready to
  // pay" action and the dev-only seed button below. There is no working
  // payment capture in this project (Paypal.js's onApprove never calls the
  // backend), so this — not a payment confirmation — is what actually creates
  // the booking; gating it behind a fake "ready_to_pay" flag that never
  // flipped true silently dropped every real booking a customer attempted.
  async function submit_booking() {
    if (submitting_lock_ref.current) return;
    submitting_lock_ref.current = true;

    if (!can_submit_booking()) {
      submitting_lock_ref.current = false;
      return;
    }

    set_submitting(true);
    const username = localStorage.getItem("username");
    const payload = {
      username: username,
      price: total_price,
      trip_date: trip_date,
      trip_name: tripName,
      hotel_name: selected_hotel ? selected_hotel.name : "no_name",
      hotel_reserve_date: selected_hotel ? hotel_reserve_date : "",
      seats: seats,
    };

    // Only the code travels — the server decides what it is worth. Omitted
    // entirely when unused, so an ordinary booking request is unchanged.
    if (applied_promo) payload.promo_code = applied_promo.code;

    try {
      await axios.post("http://127.0.0.1:8000/profile/update_profile/", payload);
      showToast(RESERVE_STRINGS.booked, "success");
    } catch (e) {
      console.log("error from trip log", e);
      showToast(RESERVE_STRINGS.booking_error, "error");
    } finally {
      set_submitting(false);
      submitting_lock_ref.current = false;
    }
  }

  function render_transport_options(kind) {
    if (!features) return [];
    const items = [];

    for (let i = 1; i <= 5; i++) {
      const active = features[`access_${kind}_${i}`];
      const name = features[`access_${kind}_name_${i}`];
      const price = features[`access_${kind}_price_${i}`];
      const start_at = features[`${kind}_start_at_${i}`];

      if (!active || name === "none" || !(price > 0)) continue;

      const is_selected = selected_transport.kind === kind && selected_transport.index === i;

      items.push(
        <div id={kind + i} key={kind + i} className={`reserve_transport_option${is_selected ? " reserve_option_selected" : ""}`}>
          <label htmlFor={"b_" + kind + i}>
            <span className="div_label">
              {name} / {price}$
            </span>
            <br />
            <span className="div_label2">starts at : {new Date(start_at).toUTCString()}</span>
          </label>
          <input
            type="radio"
            id={"b_" + kind + i}
            name="transport"
            checked={is_selected}
            onChange={() => handle_transport_change(kind, i, parseInt(price), name)}
          />
        </div>
      );
    }

    return items;
  }

  const transport_items = render_transport_options(transport_tab);

  function transport_summary_text() {
    if (selected_transport.kind === "none" || !selected_transport.name) return RESERVE_STRINGS.no_transport_selected;
    const kind_label = selected_transport.kind === "plane" ? "Plane" : "Bus";
    return `${kind_label} · ${selected_transport.name}`;
  }

  function hotel_summary_text() {
    if (!selected_hotel) return RESERVE_STRINGS.no_hotel_selected;
    return `Hotel · ${selected_hotel.name}, check-in ${hotel_reserve_date}`;
  }

  const modal_footer =
    features_status === "success" && features ? (
      <div id="reserve_footer_nav">
        <Button variant="ghost" size="sm" onClick={() => set_step((s) => Math.max(1, s - 1))} disabled={step === 1}>
          {RESERVE_STRINGS.back}
        </Button>
        <div id="reserve_footer_total">
          {RESERVE_STRINGS.total} <b>{payable_price}$</b>
        </div>
        {step < 3 ? (
          <Button variant="secondary" size="sm" onClick={() => set_step((s) => Math.min(3, s + 1))}>
            {RESERVE_STRINGS.next}
          </Button>
        ) : (
          <span id="reserve_footer_spacer" aria-hidden="true" />
        )}
      </div>
    ) : null;

  return (
    <Modal isOpen={tripName !== null} onClose={closeBooking} title={tripName} size="lg" footer={modal_footer}>
      {(features_status === "idle" || features_status === "loading") && (
        <div id="reserve_skeleton">
          <Skeleton height="220px" />
          <Skeleton height="24px" width="60%" />
          <Skeleton height="60px" />
        </div>
      )}

      {features_status === "error" && (
        <ErrorState
          message={RESERVE_STRINGS.features_error}
          onRetry={() => set_retry_key((k) => k + 1)}
        />
      )}

      {features_status === "success" && features && (
        <div id="reserve_root">
          <div id="reserve_steps">
            {steps().map((s, i) => (
              <Fragment key={s.id}>
                <button
                  type="button"
                  className={`reserve_step${step === s.id ? " is_active" : ""}${step > s.id ? " is_done" : ""}`}
                  onClick={() => set_step(s.id)}
                >
                  <span className="reserve_step_badge">
                    {step > s.id ? <i className="fa-solid fa-check" aria-hidden="true"></i> : s.id}
                  </span>
                  <span className="reserve_step_label">{s.label}</span>
                </button>
                {i < steps().length - 1 && (
                  <span className={`reserve_step_connector${step > s.id ? " is_done" : ""}`}></span>
                )}
              </Fragment>
            ))}
          </div>

          {step === 1 && (
            <div id="reserve_transport_grid">
              <div>
                <div className="reserve_section_header">{RESERVE_STRINGS.more_photos(tripName)}</div>
                <div id="photos_reserve_section" title="click to view image">
                  <div id="photo1" style={{ backgroundImage: `url('${features.img1}')` }} onClick={() => set_lightbox_image(features.img1)}></div>

                  <div id="container_3_photos">
                    <div id="top_2_photos">
                      <div id="top1" style={{ backgroundImage: `url('${features.img2}')` }} onClick={() => set_lightbox_image(features.img2)}></div>
                      <div id="top2" style={{ backgroundImage: `url('${features.img3}')` }} onClick={() => set_lightbox_image(features.img3)}></div>
                    </div>
                    <div id="lower_photo" style={{ backgroundImage: `url('${features.img4}')` }} onClick={() => set_lightbox_image(features.img4)}></div>
                  </div>
                </div>
              </div>

              <div>
                <div className="reserve_section_header">{RESERVE_STRINGS.starting_points}</div>

                <div className="reserve_option_tabs">
                  <button
                    type="button"
                    className={`reserve_option_tab${transport_tab === "plane" ? " is_active" : ""}`}
                    onClick={() => set_transport_tab("plane")}
                  >
                    {RESERVE_STRINGS.by_plane}
                  </button>
                  <button
                    type="button"
                    className={`reserve_option_tab${transport_tab === "bus" ? " is_active" : ""}`}
                    onClick={() => set_transport_tab("bus")}
                  >
                    {RESERVE_STRINGS.by_bus}
                  </button>
                </div>

                <div id="starting_points_options_box">
                  {transport_items.length > 0 ? (
                    transport_items
                  ) : (
                    <div className="reserve_empty_hint">No {transport_tab} options for this trip.</div>
                  )}
                </div>

                <div id="no_access_container" className={selected_transport.kind === "none" ? "reserve_option_selected" : ""}>
                  <label htmlFor="no_access_point">{RESERVE_STRINGS.no_transport_needed}</label>
                  <input
                    type="radio"
                    id="no_access_point"
                    name="transport"
                    checked={selected_transport.kind === "none"}
                    onChange={() => handle_transport_change("none", null, 0, null)}
                  />
                </div>
              </div>
            </div>
          )}

          {/* Step 1 doubles as the trip detail view — there is no separate
              trip page — so the trip's reviews live here. */}
          {step === 1 && <ReviewsSection targetType="trip" targetId={tripName} />}

          {step === 2 && (
            <div id="reserve_hotel_grid">
              <div id="hotel_view">
                <Hotels_reserve
                  name={selected_hotel ? selected_hotel.name : "no_name"}
                  trip_name={tripName}
                  onOpenImage={set_lightbox_image}
                />
              </div>

              <div>
                <div className="reserve_section_header">{RESERVE_STRINGS.book_hotel}</div>

                <div id="hotel_options">
                  <div
                    id="no_hotel_selected"
                    className={`reserve_hotel_option${selected_hotel === null ? " reserve_option_selected" : ""}`}
                    onClick={() => handle_hotel_change(null)}
                  >
                    <input id="no_hotel_button" type="radio" name="hotel" checked={selected_hotel === null} readOnly />
                    <div id="no_hotel_label">{RESERVE_STRINGS.no_hotel}</div>
                  </div>

                  {hotel_options_status === "error" && (
                    <ErrorState message={RESERVE_STRINGS.hotel_prices_error} />
                  )}

                  {hotel_options.map((h) => (
                    <div
                      className={`reserve_hotel_option${selected_hotel?.name === h.name ? " reserve_option_selected" : ""}`}
                      key={h.name}
                      onClick={() => handle_hotel_change(h)}
                    >
                      <input type="radio" name="hotel" checked={selected_hotel?.name === h.name} readOnly />
                      <div>
                        {h.name} — {h.price}$
                      </div>
                    </div>
                  ))}
                </div>

                {selected_hotel && (
                  <Input
                    type="date"
                    label={RESERVE_STRINGS.hotel_date}
                    name="hotel_reserve_date"
                    containerClassName="hotel_reservation_date"
                    value={hotel_reserve_date}
                    onChange={(e) => e.target.value.length > 0 && set_hotel_reserve_date(e.target.value)}
                  />
                )}
              </div>
            </div>
          )}

          {step === 3 && (
            <div id="reserve_payment_grid">
              <div id="reserve_summary_card">
                <div id="reserve_summary_line">
                  {transport_summary_text()} — {hotel_summary_text()}
                </div>
                <div id="reserve_summary_rows">
                  <div className="reserve_summary_row">
                    <span>{tripName}</span>
                    <b>{trip_price}$</b>
                  </div>
                  <div className="reserve_summary_row">
                    <span>{RESERVE_STRINGS.transport}</span>
                    <b>{selected_transport.price}$</b>
                  </div>
                  <div className="reserve_summary_row">
                    <span>Hotel{selected_hotel ? ` (${hotel_reserve_date})` : ""}</span>
                    <b>{selected_hotel ? selected_hotel.price : 0}$</b>
                  </div>
                </div>
                {applied_promo && (
                  <div className="reserve_summary_rows">
                    <div className="reserve_summary_row">
                      <span>{PROMO_STRINGS.summary_original}</span>
                      <b>{total_price}$</b>
                    </div>
                    <div className="reserve_summary_row reserve_summary_discount">
                      <span>{PROMO_STRINGS.summary_discount}</span>
                      <b>-{discount_amount}$</b>
                    </div>
                  </div>
                )}

                <div id="reserve_summary_total">
                  <span>{applied_promo ? PROMO_STRINGS.summary_final : "Total"}</span>
                  <span>{payable_price}$</span>
                </div>
              </div>

              <div id="reserve_seats_box">
                <Input
                  type="date"
                  label={RESERVE_STRINGS.trip_date}
                  name="trip_date"
                  containerClassName="reserve_date_field"
                  min={today_iso()}
                  value={trip_date}
                  onChange={(e) => e.target.value.length > 0 && set_trip_date(e.target.value)}
                />

                <label className="ui-field-label" htmlFor="reserve_seats">
                  {BOOKING_STRINGS.seats_label}
                </label>

                {availability === null ? (
                  <span className="reserve_seats_hint">{BOOKING_STRINGS.seats_loading}</span>
                ) : availability.is_sold_out ? (
                  <span className="reserve_seats_soldout">{BOOKING_STRINGS.seats_sold_out}</span>
                ) : (
                  <>
                    <select
                      id="reserve_seats"
                      className="reserve_seats_select"
                      value={seats}
                      onChange={(e) => set_seats(Number(e.target.value))}
                    >
                      {Array.from({ length: availability.remaining_seats }, (_, i) => i + 1).map((count) => (
                        <option key={count} value={count}>{count}</option>
                      ))}
                    </select>
                    <span className="reserve_seats_hint">
                      {BOOKING_STRINGS.seats_remaining(availability.remaining_seats)}
                    </span>
                  </>
                )}
              </div>

              <PromoCodeInput
                tripName={tripName}
                amount={total_price}
                applied={applied_promo}
                onApplied={set_applied_promo}
                onRemoved={() => set_applied_promo(null)}
              />

              {total_price > 0 && ready_to_pay ? (
                <Paypal total_price={total_price} />
              ) : (
                <div id="reserve_payment_actions">
                  <Button
                    variant="primary" fullWidth loading={submitting} disabled={submitting}
                    onClick={submit_booking}
                  >
                    {RESERVE_STRINGS.ready_to_pay}
                  </Button>

                  {process.env.REACT_APP_DEV_TOOLS === "true" && (
                    <Button variant="ghost" size="sm" fullWidth loading={submitting} onClick={submit_booking}>
                      {RESERVE_STRINGS.seed_booking}
                    </Button>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {lightbox_image && (
        <div id="reserve_lightbox" onClick={() => set_lightbox_image(null)}>
          <div id="reserve_lightbox_image" style={{ backgroundImage: `url('${lightbox_image}')` }}></div>
        </div>
      )}
    </Modal>
  );
}
