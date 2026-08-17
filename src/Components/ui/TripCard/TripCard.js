import { useState } from "react";
import Card, { CardBody, CardMedia } from "../Card/Card";
import StarRating from "../../Reviews/StarRating";
import "./TripCard.css";

export default function TripCard({
  name,
  image,
  price,
  rate,
  visitors,
  discountPercent,
  description,
  averageRating = 0,
  reviewsCount = 0,
  onSelect,
}) {
  const [showInfo, setShowInfo] = useState(false);

  return (
    <Card className="trip-card" padding={false} hoverable>
      <CardMedia
        src={image}
        alt={name}
        className="trip-card-media"
        onClick={() => onSelect && onSelect(name)}
        title="Travel now!"
      >
        {discountPercent > 0 && (
          <span className="trip-card-badge">-{discountPercent}%</span>
        )}
      </CardMedia>

      <CardBody className="trip-card-body">
        <div className="trip-card-name">
          <i className="fa-solid fa-location-dot" aria-hidden="true"></i>
          {name}
        </div>

        <div className="trip-card-meta">
          <span className="trip-card-meta-item">
            {price}
            <i className="fa-solid fa-dollar-sign" aria-hidden="true"></i>
          </span>
          <span className="trip-card-meta-item">
            {rate}
            <i className="fa-solid fa-star" aria-hidden="true"></i>
          </span>
          <span className="trip-card-meta-item">
            {visitors}
            <i className="fa-solid fa-person-walking-luggage" aria-hidden="true"></i>
          </span>
        </div>

        {reviewsCount > 0 && (
          <div className="trip-card-reviews">
            <StarRating value={averageRating} size="sm" />
            <span className="trip-card-reviews-count">({reviewsCount})</span>
          </div>
        )}

        {description && (
          <>
            <button
              type="button"
              className="trip-card-info-toggle"
              onClick={(e) => {
                e.stopPropagation();
                setShowInfo((open) => !open);
              }}
            >
              {showInfo ? "less info" : "more info"}
              <i className="fa-solid fa-circle-info" aria-hidden="true"></i>
            </button>

            {showInfo && <p className="trip-card-description">{description}</p>}
          </>
        )}
      </CardBody>
    </Card>
  );
}
