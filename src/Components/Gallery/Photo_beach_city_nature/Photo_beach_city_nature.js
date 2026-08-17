import "./Photo_beach_city_nature.css";

import { useEffect, useState } from "react";
import axios from "axios";
import TripCard from "../../ui/TripCard/TripCard";
import Skeleton from "../../ui/Skeleton/Skeleton";
import EmptyState from "../../ui/EmptyState/EmptyState";
import ErrorState from "../../ui/ErrorState/ErrorState";
import { useBooking } from "../../Reserve_trip/BookingContext";

export default function Photo_beach_city_nature(props) {
  /*
     this component is responsible to show the cards about beach | nature | city places.
     each card consists of :
     image , price , name and rate ( with icon ).
     we use props to know the number of cards returned.
    */

  const [status, set_status] = useState("loading"); // 'loading' | 'error' | 'success'
  const [trips, set_trips] = useState([]);
  const [retry_key, set_retry_key] = useState(0);
  const { openBooking } = useBooking();

  const order_by = props.order.toLowerCase();

  useEffect(() => {
    let cancelled = false;
    set_status("loading");

    let url = `http://127.0.0.1:8000/trips/send_trip_cards/${props.type}/`;
    let body = {
      number_of_images: props.cnt,
      place: props.place,
      rate: props.rate,
      price: props.price,
      order_by: order_by,
      reverse: props.reverse,
    };

    axios
      .post(url, body)
      .then((res) => {
        if (cancelled) return;
        set_trips(res.data);
        set_status("success");
      })
      .catch((err) => {
        if (cancelled) return;
        console.log("there was an error from trip cards", err);
        set_status("error");
      });

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [props.type, props.cnt, props.place, props.rate, props.price, order_by, props.reverse, retry_key]);

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
        message="We couldn't load these trips. Please try again."
        onRetry={() => set_retry_key((k) => k + 1)}
      />
    );
  }

  const visible_trips = trips.filter(
    (e, index) =>
      props.cnt > index &&
      e.price <= props.price &&
      (e.place === props.place || props.place === "Any") &&
      e.rate >= props.rate
  );

  if (visible_trips.length === 0) {
    return <EmptyState icon="fa-regular fa-face-frown" title="No trips match your filters" />;
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
          onSelect={openBooking}
        />
      ))}
    </>
  );
}
