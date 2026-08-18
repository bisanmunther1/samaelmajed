/* eslint-disable react/jsx-pascal-case */
import { useEffect, useState } from "react";
import "./Trending_places.css";

import ScrollTrigger from "react-scroll-trigger";
import axios from "axios";
import TripCard from "../ui/TripCard/TripCard";
import Skeleton from "../ui/Skeleton/Skeleton";
import EmptyState from "../ui/EmptyState/EmptyState";
import ErrorState from "../ui/ErrorState/ErrorState";
import { useBooking } from "../Reserve_trip/BookingContext";
import { GALLERY_STRINGS } from "../../i18n/strings";

export default function Trending_places() {

  const [type, set_type] = useState("Beach");
  const [status, set_status] = useState("loading"); // 'loading' | 'error' | 'success'
  const [trips, set_trips] = useState([]);
  const [retry_key, set_retry_key] = useState(0);
  const { openBooking } = useBooking();

  useEffect(() => {
    let cancelled = false;
    set_status("loading");

    let url = `http://127.0.0.1:8000/trips/trending/${type}/`;
    axios
      .get(url)
      .then((res) => {
        if (cancelled) return;
        set_trips(res.data);
        set_status("success");
      })
      .catch((err) => {
        if (cancelled) return;
        console.log("there was an error in trending ", err);
        set_status("error");
      });

    return () => {
      cancelled = true;
    };
  }, [type, retry_key]);

  let trending_content;

  if (status === "loading") {
    trending_content = (
      <div id="trending_skeleton_row">
        {Array.from({ length: 4 }).map((_, index) => (
          <Skeleton key={index} width="250px" height="200px" radius="15px" />
        ))}
      </div>
    );
  } else if (status === "error") {
    trending_content = (
      <ErrorState
        message="We couldn't load trending places."
        onRetry={() => set_retry_key((k) => k + 1)}
      />
    );
  } else if (trips.length === 0) {
    trending_content = <EmptyState icon="fa-regular fa-face-frown" title="No trending places yet" />;
  } else {
    trending_content = trips.map((e) => (
      <TripCard
        key={e.name}
        name={e.name}
        image={e.img}
        price={e.price}
        rate={e.rate}
        visitors={e.num}
        averageRating={e.average_rating}
        reviewsCount={e.reviews_count}
        onSelect={openBooking}
      />
    ));
  }

  return (
    <>
    <ScrollTrigger onEnter={show } onExit={hide }>
      <div id="trending_root_element"  >

      <div id="trending_some_text">
        <div id="trending_text">Trending places

		  <i className="fa-solid fa-arrow-trend-up"
          style={{ paddingLeft: "15px", paddingRight: "10px" }}></i>:

		</div>
          <p>
          <p id="trending_text_first_line">check out the</p>
          <p id="trending_text_second_line">most visited places</p>
          </p>

        </div>

		<div id="container_for_button_and_gallery">

          <div id="trending_button_section">

            <div id="beach_trending" className={type === "Beach" ? "trending_type_active" : ""} onClick={() => set_type("Beach")}> {GALLERY_STRINGS.beach} </div>
            <div id="nature_trending" className={type === "Nature" ? "trending_type_active" : ""} onClick={() => set_type("Nature")}>{GALLERY_STRINGS.nature} </div>
            <div id="city_trending" className={type === "City" ? "trending_type_active" : ""} onClick={() => set_type("City")}> {GALLERY_STRINGS.cities} </div>

          </div> {/*end of button section */ }

          <div id="trending_gallery">{trending_content}</div>

        </div> {/*end of container of gallery and button section*/}


      </div>

   </ScrollTrigger>
    </>
  );
  // this function changes the style of buttons 'beach' , 'nature' and 'city' we clicked.

  function show ()
  {

	 document.getElementById('container_for_button_and_gallery')
      .style.transform = 'translateX(-40px)';
	  document.getElementById('trending_text_first_line').style.animationName='second_line';
	  document.getElementById('trending_text').style.animationName='first_line';

	   document.getElementById('trending_text_second_line').style.animationName='second_line';

  }
  function hide()
  {
	  document.getElementById('container_for_button_and_gallery')
      .style.transform = 'translateX(1000px)';

	  	  document.getElementById('trending_text_first_line').style.animationName='none';
	     document.getElementById('trending_text').style.animationName='none';
	   document.getElementById('trending_text_second_line').style.animationName='none';


  }
}
