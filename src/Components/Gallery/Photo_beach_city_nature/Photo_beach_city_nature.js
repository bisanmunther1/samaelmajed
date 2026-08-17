import "./Photo_beach_city_nature.css";

import { useEffect, useState } from "react";
import axios from "axios";
import TripCard from "../../ui/TripCard/TripCard";
import Skeleton from "../../ui/Skeleton/Skeleton";
import EmptyState from "../../ui/EmptyState/EmptyState";
import ErrorState from "../../ui/ErrorState/ErrorState";
import { useBooking } from "../../Reserve_trip/BookingContext";
import { FILTER_ERROR_MESSAGES, FILTER_STRINGS } from "../../Filters/strings";

// The listing endpoint predates FR-39 and still reads these six keys straight
// off the POST body (it KeyErrors without them). The retired Gallery filter
// panel used to populate them; they are now fixed neutral values — "any place,
// any price, any rate, name order, not reversed" — and every real filter
// travels on the query string instead.
const LEGACY_BODY = {
  place: "Any",
  price: 100000,
  rate: 0,
  order_by: "name",
  reverse: false,
};

function build_query(advanced_filters) {
  const params = new URLSearchParams();
  Object.entries(advanced_filters || {}).forEach(([key, value]) => {
    if (value !== "" && value !== null && value !== undefined) params.set(key, value);
  });
  return params.toString();
}

// A rejected filter comes back as a coded 400 from common/filtering.py; a
// dropped connection does not. They deserve different messages.
function filter_error_message(error) {
  const data = error && error.response ? error.response.data : null;
  if (!data || !data.code) return null;
  return FILTER_ERROR_MESSAGES[data.code] || data.detail || FILTER_STRINGS.invalid_filters;
}

export default function Photo_beach_city_nature(props) {
  /*
     this component is responsible to show the cards about beach | nature | city places.
     each card consists of :
     image , price , name and rate ( with icon ).
     we use props to know the number of cards returned.
    */

  const [status, set_status] = useState("loading"); // 'loading' | 'error' | 'success'
  const [trips, set_trips] = useState([]);
  const [error_message, set_error_message] = useState(null);
  const [retry_key, set_retry_key] = useState(0);
  const { openBooking } = useBooking();

  const query = build_query(props.advancedFilters);
  const { onResultCount } = props;

  useEffect(() => {
    let cancelled = false;
    set_status("loading");

    let url = `http://127.0.0.1:8000/trips/send_trip_cards/${props.type}/`;
    if (query) url = `${url}?${query}`;

    let body = { ...LEGACY_BODY, number_of_images: props.cnt };

    axios
      .post(url, body)
      .then((res) => {
        if (cancelled) return;
        set_trips(res.data);
        set_error_message(null);
        set_status("success");
      })
      .catch((err) => {
        if (cancelled) return;
        set_error_message(filter_error_message(err));
        set_status("error");
      });

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [props.type, props.cnt, query, retry_key]);

  // Filtering is the server's job now; all that is left client-side is the
  // "View All / View Less" cap.
  const visible_trips =
    status === "success" ? trips.filter((e, index) => props.cnt > index) : [];

  // Reported upward so the filter bar can show "عدد النتائج: N".
  useEffect(() => {
    if (onResultCount) onResultCount(visible_trips.length);
  }, [visible_trips.length, onResultCount]);

  if (status === "loading") {
    return (
      <div className="photo_skeleton_grid">
        {Array.from({ length: 6 }).map((_, index) => (
          <div className="photo_skeleton_card" key={index}>
            <Skeleton height="220px" radius="var(--radius-lg) var(--radius-lg) 0 0" />
            <div className="photo_skeleton_lines">
              <Skeleton height="18px" width="70%" />
              <Skeleton height="14px" width="40%" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (status === "error") {
    return (
      <ErrorState
        message={error_message || "We couldn't load these trips. Please try again."}
        onRetry={() => set_retry_key((k) => k + 1)}
      />
    );
  }

  if (visible_trips.length === 0) {
    const filtered = Boolean(query);
    return (
      <EmptyState
        icon="fa-regular fa-face-frown"
        title={filtered ? FILTER_STRINGS.empty_title : "No trips match your filters"}
        message={filtered ? FILTER_STRINGS.empty_message : undefined}
      />
    );
  }

  return (
    <>
      {visible_trips.map((e) => (
        <TripCard
          key={e.name}
          name={e.name}
          image={e.img}
          price={e.price}
          rate={e.rate}
          visitors={e.num}
          description={e.desc}
          averageRating={e.average_rating}
          reviewsCount={e.reviews_count}
          onSelect={openBooking}
        />
      ))}
    </>
  );
}
