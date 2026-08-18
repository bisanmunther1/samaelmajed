import { useCallback, useEffect, useState } from "react";
import Button from "../ui/Button/Button";
import Card from "../ui/Card/Card";
import EmptyState from "../ui/EmptyState/EmptyState";
import ErrorState from "../ui/ErrorState/ErrorState";
import Skeleton from "../ui/Skeleton/Skeleton";
import { useToast } from "../ui/Toast/ToastContext";
import PartnerListingForm from "./PartnerListingForm";
import PartnerRegister from "./PartnerRegister";
import {
  delete_partner_listing, fetch_partner_bookings, fetch_partner_dashboard,
  fetch_partner_listings, fetch_partner_me, is_logged_in, partner_error_message,
} from "./partnerApi";
import { BOOKING_STATUS_LABELS, PARTNER_STRINGS } from "./strings";
import "./Partner.css";

// Built per render, not at module load: the labels have to come from the
// language that is active now.
function tabs() {
  return [
    { id: "dashboard", label: PARTNER_STRINGS.tab_dashboard },
    { id: "listings", label: PARTNER_STRINGS.tab_listings },
    { id: "bookings", label: PARTNER_STRINGS.tab_bookings },
  ];
}

/**
 * The partner area.
 *
 * What renders here is decided by the server's answer to /api/partner/me/, and
 * every panel below calls a scoped endpoint. Rendering this page without the
 * right role gets you empty panels and 403s, not data.
 */
export default function Partner() {
  const { showToast } = useToast();

  const [partner, set_partner] = useState(null);
  const [status, set_status] = useState("loading"); // loading | error | ready | not_partner
  const [tab, set_tab] = useState("dashboard");
  const [retry_key, set_retry_key] = useState(0);

  useEffect(() => {
    if (!is_logged_in()) {
      set_status("not_partner");
      return undefined;
    }

    let cancelled = false;
    set_status("loading");

    fetch_partner_me()
      .then((data) => {
        if (cancelled) return;
        set_partner(data);
        set_status(data === null ? "not_partner" : "ready");
      })
      .catch(() => {
        if (cancelled) return;
        set_status("error");
      });

    return () => {
      cancelled = true;
    };
  }, [retry_key]);

  if (status === "loading") {
    return (
      <div id="partner_page">
        <div id="partner_root">
          <div className="partner_skeleton">
            <Skeleton height="24px" width="40%" />
            <Skeleton height="18px" width="60%" />
            <Skeleton height="120px" />
          </div>
        </div>
      </div>
    );
  }

  if (status === "error") {
    return (
      <div id="partner_page">
        <div id="partner_root">
          <ErrorState
            message={PARTNER_STRINGS.load_error}
            onRetry={() => set_retry_key((key) => key + 1)}
          />
        </div>
      </div>
    );
  }

  // Not a partner at all — offer the application form.
  if (status === "not_partner") {
    return (
      <div id="partner_page">
        <div id="partner_root">
          <PartnerRegister
            onRegistered={(created) => {
              set_partner(created);
              set_status("ready");
              showToast(PARTNER_STRINGS.register_success, "success");
            }}
          />
        </div>
      </div>
    );
  }

  // A partner, but the admin has not approved them yet.
  if (!partner.is_approved) {
    return (
      <div id="partner_page">
        <div id="partner_root">
          <div id="partner_head">
            <span id="partner_business">{partner.business_name}</span>
          </div>

          <EmptyState
            icon="fa-regular fa-clock"
            title={PARTNER_STRINGS.pending_title}
            message={PARTNER_STRINGS.pending_message}
          />
        </div>
      </div>
    );
  }

  return (
    <div id="partner_page">
      <div id="partner_root">
        <div id="partner_head">
          <span id="partner_business">{partner.business_name}</span>
          <span id="partner_type">{PARTNER_STRINGS.page_title}</span>
        </div>

        <div className="partner_tabs" role="tablist">
          {tabs().map((entry) => (
            <button
              key={entry.id}
              type="button"
              role="tab"
              aria-selected={tab === entry.id}
              className={`partner_tab${tab === entry.id ? " partner_tab_active" : ""}`}
              onClick={() => set_tab(entry.id)}
            >
              {entry.label}
            </button>
          ))}
        </div>

        {tab === "dashboard" && <PartnerDashboard />}
        {tab === "listings" && <PartnerListings partner={partner} showToast={showToast} />}
        {tab === "bookings" && <PartnerBookings />}
      </div>
    </div>
  );
}

function PartnerDashboard() {
  const [counts, set_counts] = useState(null);
  const [status, set_status] = useState("loading");

  useEffect(() => {
    let cancelled = false;

    fetch_partner_dashboard()
      .then((data) => {
        if (cancelled) return;
        set_counts(data);
        set_status("ready");
      })
      .catch(() => {
        if (cancelled) return;
        set_status("error");
      });

    return () => {
      cancelled = true;
    };
  }, []);

  if (status === "loading") {
    return (
      <div className="partner_stat_grid">
        {Array.from({ length: 4 }).map((_, index) => (
          <Skeleton key={index} height="80px" />
        ))}
      </div>
    );
  }

  if (status === "error") return <ErrorState message={PARTNER_STRINGS.load_error} />;

  const tiles = [
    { label: PARTNER_STRINGS.stat_listings, value: counts.listings },
    { label: PARTNER_STRINGS.stat_upcoming, value: counts.upcoming_bookings },
    { label: PARTNER_STRINGS.stat_total, value: counts.total_bookings },
    { label: PARTNER_STRINGS.stat_rating, value: counts.average_rating },
  ];

  return (
    <div className="partner_stat_grid">
      {tiles.map((tile) => (
        <Card className="partner_stat" key={tile.label}>
          <span className="partner_stat_value">{tile.value}</span>
          <span className="partner_stat_label">{tile.label}</span>
        </Card>
      ))}
    </div>
  );
}

function PartnerListings({ partner, showToast }) {
  const [listings, set_listings] = useState([]);
  const [status, set_status] = useState("loading");
  const [editing, set_editing] = useState(null); // listing | "new" | null

  const load = useCallback(() => {
    set_status("loading");
    fetch_partner_listings()
      .then((data) => {
        set_listings(data);
        set_status("ready");
      })
      .catch(() => set_status("error"));
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function handle_delete(listing) {
    if (!window.confirm(PARTNER_STRINGS.listing_delete_confirm)) return;

    try {
      await delete_partner_listing(listing.name);
      showToast(PARTNER_STRINGS.deleted, "success");
      load();
    } catch (error) {
      showToast(partner_error_message(error), "error");
    }
  }

  if (status === "loading") {
    return (
      <div className="partner_skeleton">
        <Skeleton height="18px" />
        <Skeleton height="18px" />
      </div>
    );
  }

  if (status === "error") return <ErrorState message={PARTNER_STRINGS.load_error} onRetry={load} />;

  return (
    <>
      <div className="partner_section_head">
        <h3 className="partner_section_title">{PARTNER_STRINGS.listings_title}</h3>
        <Button size="sm" onClick={() => set_editing("new")}>
          {PARTNER_STRINGS.listing_add}
        </Button>
      </div>

      {listings.length === 0 ? (
        <EmptyState
          icon="fa-solid fa-suitcase-rolling"
          title={PARTNER_STRINGS.listings_empty}
          message={PARTNER_STRINGS.listings_empty_hint}
        />
      ) : (
        <table className="partner_table">
          <thead>
            <tr>
              <th>{PARTNER_STRINGS.field_name}</th>
              <th>{PARTNER_STRINGS.field_price}</th>
              <th>{PARTNER_STRINGS.stat_rating}</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {listings.map((listing) => (
              <tr key={listing.name}>
                <td>{listing.name}</td>
                <td>{listing.price}</td>
                <td>{listing.average_rating}</td>
                <td className="partner_row_actions">
                  <Button variant="ghost" size="sm" onClick={() => set_editing(listing)}>
                    {PARTNER_STRINGS.listing_edit}
                  </Button>
                  <Button variant="ghost" size="sm" onClick={() => handle_delete(listing)}>
                    {PARTNER_STRINGS.listing_delete}
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      <PartnerListingForm
        partner={partner}
        listing={editing === "new" ? null : editing}
        isOpen={editing !== null}
        onClose={() => set_editing(null)}
        onSaved={() => {
          set_editing(null);
          showToast(PARTNER_STRINGS.saved, "success");
          load();
        }}
      />
    </>
  );
}

function PartnerBookings() {
  const [bookings, set_bookings] = useState([]);
  const [status, set_status] = useState("loading");

  useEffect(() => {
    let cancelled = false;

    fetch_partner_bookings()
      .then((data) => {
        if (cancelled) return;
        set_bookings(data);
        set_status("ready");
      })
      .catch(() => {
        if (cancelled) return;
        set_status("error");
      });

    return () => {
      cancelled = true;
    };
  }, []);

  if (status === "loading") {
    return (
      <div className="partner_skeleton">
        <Skeleton height="18px" />
        <Skeleton height="18px" />
      </div>
    );
  }

  if (status === "error") return <ErrorState message={PARTNER_STRINGS.load_error} />;

  if (bookings.length === 0) {
    return <EmptyState icon="fa-solid fa-calendar-xmark" title={PARTNER_STRINGS.bookings_empty} />;
  }

  return (
    <>
      <div className="partner_section_head">
        <h3 className="partner_section_title">{PARTNER_STRINGS.bookings_title}</h3>
      </div>

      <table className="partner_table">
        <thead>
          <tr>
            <th>{PARTNER_STRINGS.col_customer}</th>
            <th>{PARTNER_STRINGS.col_listing}</th>
            <th>{PARTNER_STRINGS.col_date}</th>
            <th>{PARTNER_STRINGS.col_seats}</th>
            <th>{PARTNER_STRINGS.col_price}</th>
            <th>{PARTNER_STRINGS.col_status}</th>
          </tr>
        </thead>
        <tbody>
          {bookings.map((booking) => (
            <tr key={booking.id}>
              <td>{booking.customer}</td>
              <td>{booking.trip || booking.hotel || "—"}</td>
              <td>{booking.trip_date || booking.hotel_reserve_date || "—"}</td>
              <td>{booking.seats}</td>
              <td>{booking.price}</td>
              <td>{BOOKING_STATUS_LABELS[booking.status] || booking.status}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </>
  );
}
