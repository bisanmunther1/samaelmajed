/* eslint-disable react/jsx-pascal-case */
import { useEffect, useState } from "react";
import "./Gallery.css";
import Photo_beach_city_nature from "./Photo_beach_city_nature/Photo_beach_city_nature";
import { Available_places_array } from "./Available_places_array";
import { Background_images } from "./Background_images/Background_images_array";

const TYPE_CONFIG = {
  Beach: {
    background: Background_images[0].img,
    footerGradient: "linear-gradient(50deg ,  #133c59   ,#4a8a98     ,#3e98ca  ,  #93d8ec  )",
    footerLogoColor: "#4a8a98",
  },
  Nature: {
    background: Background_images[1].img,
    footerGradient: "linear-gradient(50deg ,  rgb(38, 81, 24)   ,#4a9852     ,#3eca48  ,  #93ec93  )",
    footerLogoColor: "#50984a",
  },
  City: {
    background: Background_images[2].img,
    footerGradient: "  linear-gradient(50deg ,  #1e2122   ,#535658     ,#6f8689  ,  #b2b5b8  )",
    footerLogoColor: "#5d5d5d",
  },
};

const PRICE_FILTERS = [100000, 200, 400, 600, 800, 1000];
const RATE_FILTERS = [0, 1, 2, 3, 4, 5];

export default function Gallery() {
  const [type, set_type] = useState("Beach");
  const [place, set_place] = useState("Any");
  const [order, set_order] = useState("name");
  const [reverse_order, set_reverse_order] = useState(false);
  const [max_price, set_max_price] = useState(100000);
  const [min_rate, set_min_rate] = useState(0);
  const [number_of_images, set_number_of_images] = useState(8);

  const [filters_open, set_filters_open] = useState(false);
  const [filters_mounted, set_filters_mounted] = useState(false);

  // recolor the footer to match the selected trip type
  useEffect(() => {
    const config = TYPE_CONFIG[type];

    const footer = document.getElementById("Footer_root_element");
    if (footer) footer.style.backgroundImage = config.footerGradient;

    const footerLogo = document.getElementById("footer_site-photo");
    if (footerLogo) footerLogo.style.backgroundColor = config.footerLogoColor;
  }, [type]);

  function selectType(next_type) {
    set_type(next_type);
    set_number_of_images(8);
    set_reverse_order(false);
  }

  function toggleView() {
    set_number_of_images((current) => (current === 8 ? 1000000 : 8));
  }

  function toggleFilters() {
    if (filters_open) {
      set_filters_open(false);
      setTimeout(() => set_filters_mounted(false), 500);
    } else {
      set_filters_mounted(true);
      set_filters_open(true);
    }
  }

  let place_options_content = Available_places_array.map((e) => (
    <option title={e} value={e} className="place_options" key={e} />
  ));

  return (
    <>
      <div id="gallery_root" style={{ backgroundImage: `url("${TYPE_CONFIG[type].background}")` }}>
        <p className="gallery_choose_sentence">Book your Trip:</p>

        <div id="gallery_container_for_filter_button">
          <div id="gallery_add_filter_button" onClick={toggleFilters}>
            <span>{filters_open ? "Hide Filters" : "Show Filters"}</span>
            <i className="fa-solid fa-filter"></i>
          </div>
        </div>

        <div id="gallery_button_section">
          <button
            id="gallery_beach_button"
            className={type === "Beach" ? "gallery_type_active" : ""}
            onClick={() => selectType("Beach")}
          >
            Beach
            <i className="fa-solid fa-water" style={{ paddingLeft: "5px", fontSize: "20px" }}></i>
          </button>

          <button
            id="gallery_nature_button"
            className={type === "Nature" ? "gallery_type_active" : ""}
            onClick={() => selectType("Nature")}
          >
            Nature
            <i className="fa-solid fa-leaf" style={{ paddingLeft: "5px", fontSize: "20px" }}></i>
          </button>

          <button
            id="gallery_city_button"
            className={type === "City" ? "gallery_type_active" : ""}
            onClick={() => selectType("City")}
          >
            Cities
            <i className="fa-solid fa-city" style={{ paddingLeft: "5px", fontSize: "20px" }}></i>
          </button>

          <button id="gallery_view_button" onClick={toggleView}>
            <span id="gallery_view_text_content">
              {number_of_images === 8 ? "View All" : "View Less"}
            </span>
            <i className="fa-solid fa-bars" style={{ paddingLeft: "5px", fontSize: "20px" }}></i>
          </button>
        </div>

        {filters_mounted && (
          <div id="gallery_filter_section" className={filters_open ? "" : "gallery_filters_closing"}>
            <div id="gallery_place_filter_section">
              <span>
                Choose a country
                <i className="fa-solid fa-earth-asia" style={{ paddingLeft: "5px" }}></i> :
                <input
                  name="places_options"
                  list="gallery_PLACES"
                  id="gallery_places_menu"
                  placeholder="Any"
                  onChange={(e) => set_place(e.target.value === "" ? "Any" : e.target.value)}
                />
                <datalist id="gallery_PLACES">{place_options_content}</datalist>
              </span>
              <p
                id="gallery_asc_desc_order"
                className={reverse_order ? "gallery_active_toggle" : ""}
                onClick={() => set_reverse_order((current) => !current)}
              >
                Reverse Order
              </p>
            </div>

            <div id="gallery_price_filter_bar">
              <p className="gallery_filter_word_and_icon">
                price <i className="fa-solid fa-coins"></i> :
              </p>

              {PRICE_FILTERS.map((price_value, index) => (
                <span
                  key={price_value}
                  id={index === 0 ? "gallery_any_price" : "less" + price_value}
                  onClick={() => set_max_price(price_value)}
                >
                  {index === 0 ? "any" : `less than ${price_value}`}
                  {max_price === price_value && (
                    <i className="fa-solid fa-check" style={{ color: "#222", paddingLeft: "5px", fontSize: "20px" }}></i>
                  )}
                </span>
              ))}
            </div>

            <div id="gallery_rate_filter_bar">
              <p className="gallery_filter_word_and_icon">
                rate <i className="fa-solid fa-star"></i> :
              </p>

              {RATE_FILTERS.map((rate_value, index) => (
                <span
                  key={rate_value}
                  id={index === 0 ? "gallery_any_rate" : "star" + rate_value}
                  onClick={() => set_min_rate(rate_value)}
                >
                  {index === 0 ? "any" : `${rate_value} star`}
                  {min_rate === rate_value && (
                    <i className="fa-solid fa-check" style={{ color: "#222", paddingLeft: "5px", fontSize: "20px" }}></i>
                  )}
                </span>
              ))}
            </div>

            <div id="gallery_sort_bar">
              <div id="gallery_sort_word">
                sort by <i className="fa-solid fa-sort"> </i> :
              </div>

              <span id="gallery_name" onClick={() => set_order("name")}>
                Name
                {order === "name" && (
                  <i className="fa-solid fa-check" style={{ color: "#222", paddingLeft: "5px", fontSize: "20px" }}></i>
                )}
              </span>

              <span id="gallery_num_of_visitors" onClick={() => set_order("num")}>
                number of visitors
                {order === "num" && (
                  <i className="fa-solid fa-check" style={{ color: "#222", paddingLeft: "5px", fontSize: "20px" }}></i>
                )}
              </span>

              <span id="gallery_sort_price" onClick={() => set_order("price")}>
                Price
                {order === "price" && (
                  <i className="fa-solid fa-check" style={{ color: "#222", paddingLeft: "5px", fontSize: "20px" }}></i>
                )}
              </span>

              <span id="gallery_sort_rate" onClick={() => set_order("rate")}>
                Rate
                {order === "rate" && (
                  <i className="fa-solid fa-check" style={{ color: "#222", paddingLeft: "5px", fontSize: "20px" }}></i>
                )}
              </span>
            </div>
          </div>
        )}

        <div id="gallery_box" key={type}>
          <Photo_beach_city_nature
            type={type}
            cnt={number_of_images}
            place={place}
            rate={min_rate}
            price={max_price}
            order={order}
            reverse={reverse_order}
          />
        </div>
      </div>
    </>
  );
}
