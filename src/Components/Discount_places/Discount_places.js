import './Discount_places.css';
import ScrollTrigger from "react-scroll-trigger";

import { useState } from 'react';
import axios from 'axios';
import TripCard from '../ui/TripCard/TripCard';
import Skeleton from '../ui/Skeleton/Skeleton';
import EmptyState from '../ui/EmptyState/EmptyState';
import ErrorState from '../ui/ErrorState/ErrorState';
import { useBooking } from '../Reserve_trip/BookingContext';


export default function Discount_places()
{

  const [status, set_status] = useState("idle"); // 'idle' | 'loading' | 'error' | 'success'
  const [content, set_content] = useState([]);
  const { openBooking } = useBooking();


  let a = "discounted Trips:";
  let b = "check out trips with discount!!!";
  let s = 0;
  let arr = []; // indexes of letters

  for (let i of a) {
     arr.push(i)
   }
  let first_line_discount =arr.map(e => {
    s += 75;
      return (<letter   style={{   animationDuration:`${s}ms`   }} >{e}</letter>);
  })

  arr = [];
  for (let i of b) {
    arr.push(i)
  }

  let second_line_discount = arr.map(e => {
    s += 75;
    return <letter  style={{ animationDuration:`${s}ms`   }} >{e}</letter>
  } )

  let discount_content;

  if (status === "loading") {
    discount_content = (
      <div id="discount_skeleton_row">
        {Array.from({ length: 3 }).map((_, index) => (
          <Skeleton key={index} width="280px" height="200px" radius="15px" />
        ))}
      </div>
    );
  } else if (status === "error") {
    discount_content = (
      <ErrorState message="We couldn't load discounted trips." onRetry={fetch_discounts} />
    );
  } else if (status === "success" && content.length === 0) {
    discount_content = <EmptyState icon="fa-regular fa-face-frown" title="No discounted trips right now" />;
  } else {
    discount_content = content.map((e) => (
      <TripCard
        key={e.name}
        name={e.name}
        image={e.img}
        price={e.price}
        rate={e.rate}
        visitors={e.num}
        discountPercent={e.discount}
        averageRating={e.average_rating}
        reviewsCount={e.reviews_count}
        onSelect={openBooking}
      />
    ));
  }

	  return (
      <>

	   <ScrollTrigger
	   onEnter={ show }
       onExit={hide}>

			<div id="discount_root_element">
	            <div id="discount_gallery"  >
				            {discount_content}</div>



            <div id="discount_text_section">
              <div id="not_important">{first_line_discount}
                <div id="discount_text">{second_line_discount}</div>
              </div>


            </div>
      </div>


	   </ScrollTrigger>
	  </>

	  );

	 function hide ()
	 {

	  document.getElementById('discount_gallery').style.transform="translateX(-500px)";
     document.getElementById('discount_gallery').style.opacity = ".2";

    document.querySelectorAll('letter').forEach(e => {
      e.style.animationName = 'none';

    })

	 }
	  function show ()
    {

      fetch_discounts();

      document.getElementById('discount_gallery').style.transform = "translateX(0)";
       document.getElementById('discount_gallery').style.opacity="1";

       document.querySelectorAll('letter').forEach(e => {
        e.style.animationName = 'appear_letter';

      })

  }

  function fetch_discounts()
  {
    if (status === "loading" || status === "success") return;

    set_status("loading");
    let url = `http://127.0.0.1:8000/trips/discount/`;
    axios.post(url)
      .then(res => {
        set_content(res.data);
        set_status("success");
      })
      .catch( err => {
        console.log('error in discount ', err)
        set_status("error");
      })
  }

}
