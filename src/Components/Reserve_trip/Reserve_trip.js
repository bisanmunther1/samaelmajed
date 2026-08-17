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

const STEPS = [
  { id: 1, label: "Transport" },
  { id: 2, label: "Hotel" },
  { id: 3, label: "Payment" },
];

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
  const [ready_to_pay, set_ready_to_pay] = useState(false);
  const [submitting, set_submitting] = useState(false);
  const submitting_lock_ref = useRef(false);
  const [lightbox_image, set_lightbox_image] = useState(null);
  const [retry_key, set_retry_key] = useState(0);

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

  const total_price = selected_transport.price + (selected_hotel ? selected_hotel.price : 0);

  function handle_transport_change(kind, index, price, name) {
    set_selected_transport({ kind, index, price, name: name || null });
    if (ready_to_pay) set_ready_to_pay(false);
  }

  function handle_hotel_change(hotel) {
    set_selected_hotel(hotel);
    if (ready_to_pay) set_ready_to_pay(false);
  }

  function account_check() {
    const username = localStorage.getItem("username");

    if (username === null || username === undefined) {
      showToast("You don't have an account. Please log in to book.", "error");
      return false;
    }
    if (total_price <= 0) {
      showToast("You need to select an access point and(or) a hotel.", "error");
      return false;
    }
    showToast("Reservation complete successfully, have a good time!", "success");
    return true;
  }

  function ready_to_pay_click() {
    account_check();
    // Real payment is not wired up yet, so ready_to_pay intentionally never
    // flips true here; the Paypal button stays behind that flag until then.
  }

  async function pay_testing_click() {
    if (submitting_lock_ref.current) return;
    submitting_lock_ref.current = true;

    const ok = account_check();
    if (!ok) {
      submitting_lock_ref.current = false;
      return;
    }

    set_submitting(true);
    const username = localStorage.getItem("username");
    const payload = {
      username: username,
      price: total_price,
      trip_date: today_iso(),
      trip_name: tripName,
      hotel_name: selected_hotel ? selected_hotel.name : "no_name",
      hotel_reserve_date: selected_hotel ? hotel_reserve_date : "",
    };

    try {
      await axios.post("http://127.0.0.1:8000/profile/update_profile/", payload);
    } catch (e) {
      console.log("error from trip log", e);
      showToast("Something went wrong saving your booking. Please try again.", "error");
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
    if (selected_transport.kind === "none" || !selected_transport.name) return "no transport selected";
    const kind_label = selected_transport.kind === "plane" ? "Plane" : "Bus";
    return `${kind_label} · ${selected_transport.name}`;
  }

  function hotel_summary_text() {
    if (!selected_hotel) return "no hotel selected";
    return `Hotel · ${selected_hotel.name}, check-in ${hotel_reserve_date}`;
  }

  const modal_footer =
    features_status === "success" && features ? (
      <div id="reserve_footer_nav">
        <Button variant="ghost" size="sm" onClick={() => set_step((s) => Math.max(1, s - 1))} disabled={step === 1}>
          Back
        </Button>
        <div id="reserve_footer_total">
          Total <b>{total_price}$</b>
        </div>
        {step < 3 ? (
          <Button variant="secondary" size="sm" onClick={() => set_step((s) => Math.min(3, s + 1))}>
            Next
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
          message="We couldn't load this trip's details."
          onRetry={() => set_retry_key((k) => k + 1)}
        />
      )}

      {features_status === "success" && features && (
        <div id="reserve_root">
          <div id="reserve_steps">
            {STEPS.map((s, i) => (
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
                {i < STEPS.length - 1 && (
                  <span className={`reserve_step_connector${step > s.id ? " is_done" : ""}`}></span>
                )}
              </Fragment>
            ))}
          </div>

          {step === 1 && (
            <div id="reserve_transport_grid">
              <div>
                <div className="reserve_section_header">more photos for {tripName}</div>
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
                <div className="reserve_section_header">starting points</div>

                <div className="reserve_option_tabs">
                  <button
                    type="button"
                    className={`reserve_option_tab${transport_tab === "plane" ? " is_active" : ""}`}
                    onClick={() => set_transport_tab("plane")}
                  >
                    By plane
                  </button>
                  <button
                    type="button"
                    className={`reserve_option_tab${transport_tab === "bus" ? " is_active" : ""}`}
                    onClick={() => set_transport_tab("bus")}
                  >
                    By bus
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
                  <label htmlFor="no_access_point">i don't need transportation</label>
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
                <div className="reserve_section_header">book a hotel</div>

                <div id="hotel_options">
                  <div
                    id="no_hotel_selected"
                    className={`reserve_hotel_option${selected_hotel === null ? " reserve_option_selected" : ""}`}
                    onClick={() => handle_hotel_change(null)}
                  >
                    <input id="no_hotel_button" type="radio" name="hotel" checked={selected_hotel === null} readOnly />
                    <div id="no_hotel_label">No Hotel</div>
                  </div>

                  {hotel_options_status === "error" && (
                    <ErrorState message="Couldn't load hotel prices for this trip." />
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
                    label="hotel reservation date:"
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
                    <span>Transport</span>
                    <b>{selected_transport.price}$</b>
                  </div>
                  <div className="reserve_summary_row">
                    <span>Hotel{selected_hotel ? ` (${hotel_reserve_date})` : ""}</span>
                    <b>{selected_hotel ? selected_hotel.price : 0}$</b>
                  </div>
                </div>
                <div id="reserve_summary_total">
                  <span>Total</span>
                  <span>{total_price}$</span>
                </div>
              </div>

              {total_price > 0 && ready_to_pay ? (
                <Paypal total_price={total_price} />
              ) : (
                <div id="reserve_payment_actions">
                  <Button variant="primary" fullWidth onClick={ready_to_pay_click}>
                    ready to pay
                  </Button>

                  {process.env.REACT_APP_DEV_TOOLS === "true" && (
                    <Button variant="ghost" size="sm" fullWidth loading={submitting} onClick={pay_testing_click}>
                      seed booking (dev only)
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
