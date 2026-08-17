import "./Reserve_trip.css";
import "./Hotels_reserve.css";
import axios from "axios";
import { useEffect, useState } from "react";
import Skeleton from "../ui/Skeleton/Skeleton";
import ErrorState from "../ui/ErrorState/ErrorState";

export default function Hotels_reserve(props) {

  const [status, set_status] = useState("idle"); // idle | loading | error | success
  const [hotel, set_hotel] = useState(null);
  const [retry_key, set_retry_key] = useState(0);

  const sz = "14px"; // icons size, sized for the compact amenity pills

  useEffect(() => {
    if (props.name === "no_name" || props.name === null || props.name === undefined) {
      set_status("idle");
      set_hotel(null);
      return;
    }

    let cancelled = false;
    set_status("loading");

    let url = `http://127.0.0.1:8000/hotels/send_hotel/`;
    axios
      .post(url, { name: props.name, trip_name: props.trip_name })
      .then((res) => {
        if (cancelled) return;
        set_hotel(res.data[0] || null);
        set_status("success");
      })
      .catch((err) => {
        if (cancelled) return;
        console.log("error in hotel info", err);
        set_status("error");
      });

    return () => {
      cancelled = true;
    };
  }, [props.name, props.trip_name, retry_key]);

  if (props.name === "no_name" || props.name === null || props.name === undefined) return <></>;

  if (status === "idle" || status === "loading") {
    return (
      <div id="hotel_root">
        <Skeleton height="24px" width="40%" />
        <Skeleton height="200px" />
      </div>
    );
  }

  if (status === "error") {
    return (
      <ErrorState
        message="We couldn't load this hotel's details."
        onRetry={() => set_retry_key((k) => k + 1)}
      />
    );
  }

  const ele = hotel || {};

  return (
    <>
      <div id="hotel_root">
        <div id="hotel_name_text">{ele.name} </div>

        <div id="hotel_photos_container">
          <div
            id="upper_photo_hotel"
            style={{ backgroundImage: `url('${ele.h_photo1}')` }}
            onClick={() => props.onOpenImage && props.onOpenImage(ele.h_photo1)}>

          </div>

          <div id="lower_photos_hotel">
            <div
              id="lower_1_hotel"
              style={{ backgroundImage: `url('${ele.h_photo2}')` }}
              onClick={() => props.onOpenImage && props.onOpenImage(ele.h_photo2)}>

            </div>
            <div
              id="lower_2_hotel"
              style={{ backgroundImage: `url('${ele.h_photo3}')` }}
              onClick={() => props.onOpenImage && props.onOpenImage(ele.h_photo3)}>

            </div>
          </div>
        </div>

        <div id="hotel_info">
          <div id="hotel_info_header">
            <div id="hotel_price">

              Price per night : <b>{ele.price}</b>
              <i className="fa-solid fa-dollar-sign"> </i>
            </div>
            <div id="hotel_rate">

              Rate : {ele.rate} <i className="fa-solid  fa-star"></i>
            </div>
          </div>

          {  (
            <>
              <div id="feature_word" style={{ fontSize: "26px" }}>

                Features :
              </div>
              <div id="hotel_features">
                {ele.restaurant && (
                  <div>

                    <div>

                      Restaurant
                      <i
                        className="fa-solid fa-utensils"
                        style={{ fontSize: sz, marginLeft: "6px" }}>

                      </i>
                    </div>
                  </div>
                )}

                {ele.pool && (
                  <div>

                    <div>

                      Swimming Pool
                      <i
                        className="fa-solid fa-person-swimming"
                        style={{ fontSize: sz, marginLeft: "6px" }}>

                      </i>
                    </div>
                  </div>
                )}

                {ele.wifi && (
                  <div>

                    <div>

                      Free Wifi
                      <i
                        className="fa-solid fa-wifi"
                        style={{ fontSize: sz, marginLeft: "6px" }}>

                      </i>
                    </div>
                  </div>
                )}

                {ele.car_parking && (
                  <div>

                    <div>

                      Car Parking
                      <i
                        className="fa-solid fa-car-side"
                        style={{ fontSize: sz, marginLeft: "6px" }}>

                      </i>
                    </div>
                  </div>
                )}

                {ele.air_conditioning && (
                  <div style={{ display: "flex" }}>

                    <div> Air Conditioning </div>
                    <div
                      style={{
                        backgroundImage: `url('${require("./air_conditioning1.png")}')`,
                        width: sz,
                        height: sz,
                        backgroundSize: "cover",
                      }}>

                    </div>
                  </div>
                )}

                {ele.room_services && (
                  <div style={{ display: "flex" }}>

                    <div> Room Services </div>
                    <div
                      style={{
                        backgroundImage: `url('${require("./1.png")}')`,
                        width: sz,
                        height: sz,
                        backgroundSize: "cover",
                      }}>

                    </div>
                  </div>
                )}

                {ele.beachfront && (
                  <div style={{ display: "flex" }}>

                    <div> Beachfront </div>
                    <div
                      style={{
                        backgroundImage: `url('${require("./beachfront.png")}')`,
                        width: sz,
                        height: sz,
                        backgroundSize: "cover",
                      }}>

                    </div>
                  </div>
                )}

                {ele.gym && (
                  <div>

                    <div>

                      Gym
                      <i
                        className="fa-solid fa-dumbbell"
                        style={{ fontSize: sz, marginLeft: "6px" }}>

                      </i>
                    </div>
                  </div>
                )}

                {ele.cinema && (
                  <div style={{ display: "flex" }}>

                    <div> Cinema </div>
                    <div
                      style={{
                        backgroundImage: `url('${require("./cinema.png")}')`,
                        width: sz,
                        height: sz,
                        backgroundSize: "cover",
                      }}>

                    </div>
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </>
  );
}
