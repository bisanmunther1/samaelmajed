/* eslint-disable react/jsx-pascal-case */
import { useEffect, useState } from "react";
import "./Gallery.css";
import Photo_beach_city_nature from "./Photo_beach_city_nature/Photo_beach_city_nature";
import { Background_images } from "./Background_images/Background_images_array";
import FilterBar from "../Filters/FilterBar";
import useUrlFilters from "../Filters/useUrlFilters";

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

export default function Gallery() {
  const [type, set_type] = useState("Beach");
  const [number_of_images, set_number_of_images] = useState(8);

  // All filtering is the FilterBar's, held in the URL query string.
  const { filters, set_filter, reset_filters, has_active_filters } = useUrlFilters();
  const [result_count, set_result_count] = useState(0);

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
  }

  function toggleView() {
    set_number_of_images((current) => (current === 8 ? 1000000 : 8));
  }

  return (
    <>
      <div id="gallery_root" style={{ backgroundImage: `url("${TYPE_CONFIG[type].background}")` }}>
        <p className="gallery_choose_sentence">Book your Trip:</p>

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

        <FilterBar
          filters={filters}
          onChange={set_filter}
          onReset={reset_filters}
          hasActiveFilters={has_active_filters}
          resultCount={result_count}
        />

        <div id="gallery_box" key={type}>
          <Photo_beach_city_nature
            type={type}
            cnt={number_of_images}
            advancedFilters={filters}
            onResultCount={set_result_count}
          />
        </div>
      </div>
    </>
  );
}
