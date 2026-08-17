
import { Link } from 'react-router-dom';
import './Profile.css';
import { useEffect, useState } from "react";
import axios from "axios";
import Skeleton from "../ui/Skeleton/Skeleton";
import EmptyState from "../ui/EmptyState/EmptyState";
import ErrorState from "../ui/ErrorState/ErrorState";
import Card from "../ui/Card/Card";
import Avatar from "../ui/Avatar/Avatar";
import PendingReviews from "../Reviews/PendingReviews";

const API_BASE = "http://127.0.0.1:8000";

export default function Profile() {

  let username = localStorage.getItem('username');

  const [profile_status, set_profile_status] = useState("loading"); // loading | error | success
  const [profile, set_profile] = useState(null);

  const [bookings_status, set_bookings_status] = useState("loading");
  const [bookings, set_bookings] = useState([]);

  const [retry_key, set_retry_key] = useState(0);

  useEffect(() => {
    let cancelled = false;
    set_profile_status("loading");

    axios.get(`${API_BASE}/profile/get/${username}/`)
      .then((res) => {
        if (cancelled) return;
        set_profile(res.data);
        set_profile_status("success");
      })
      .catch((err) => {
        if (cancelled) return;
        console.log("error loading profile", err);
        set_profile_status("error");
      });

    return () => { cancelled = true; };
  }, [username, retry_key]);

  useEffect(() => {
    let cancelled = false;
    set_bookings_status("loading");

    axios.get(`${API_BASE}/profile/get_profile_data/${username}/`)
      .then((res) => {
        if (cancelled) return;
        set_bookings(res.data);
        set_bookings_status("success");
      })
      .catch((err) => {
        if (cancelled) return;
        console.log("error loading bookings", err);
        set_bookings_status("error");
      });

    return () => { cancelled = true; };
  }, [username, retry_key]);

  const photo_src = profile && profile['photo'] ? `${API_BASE}/media/${profile['photo']}` : null;

  const info_rows = profile ? [
    { label: "First Name", value: profile['first_name'] },
    { label: "Last Name", value: profile['last_name'] },
    { label: "Email", value: profile['email'] },
    { label: "Country", value: profile['country'] },
    { label: "Birth date", value: profile['birth_date'] },
    { label: "Phone number", value: profile['phone'] },
  ] : [];

  if (profile_status === "error") {
    return (
      <div id="profile_page">
        <div id="profile_root">
          <ErrorState message="We couldn't load your profile." onRetry={() => set_retry_key((k) => k + 1)} />
        </div>
      </div>
    );
  }

  return (
    <div id="profile_page">
      <div id="profile_root">

        <div id="profile_head">
          <div id="profile_head_identity">
            <Avatar name={username} src={photo_src} size={40} />
            <span id="profile_username">{username}</span>
          </div>
          <Link id="edit_my_profile_button"
             to={"/Profile/Profile_edit_info/Profile_edit_info.js"} ><i className='fa-solid fa-pen-to-square'></i> Edit Profile</Link>
        </div>

        {profile_status === "loading" || !profile ? (
          <div id="profile_skeleton">
            <Skeleton height="160px" width="160px" radius="50%" />
            <Skeleton height="18px" width="60%" />
            <Skeleton height="18px" width="40%" />
          </div>
        ) : (
          <>
            <div id="profile_grid">
              <Card className="profile_avatar_card">
                <Avatar name={username} src={photo_src} size={140} />
                <div className="profile_member_since">Member since {profile['joined_at']}</div>
              </Card>

              <Card className="profile_info_card">
                <div className="profile_info_rows">
                  {info_rows.map((row) => (
                    <div className="profile_info_row" key={row.label}>
                      <span className="profile_info_label">{row.label}</span>
                      <span className="profile_info_value">{row.value || "—"}</span>
                    </div>
                  ))}
                </div>

                <div className="profile_bio_row">
                  <span className="profile_info_label">Bio</span>
                  {profile['bio'] ? (
                    <p className="profile_bio_value">{profile['bio']}</p>
                  ) : (
                    <p className="profile_bio_empty">Add a bio</p>
                  )}
                </div>
              </Card>
            </div>

            <div id="profile_trips_section">
              <div id="profile_my_trip_word">My Trips</div>

              <PendingReviews />

              <Card className="profile_trips_card" padding={false}>
                {bookings_status === "loading" && (
                  <div className="profile_bookings_skeleton">
                    <Skeleton height="18px" />
                    <Skeleton height="18px" />
                    <Skeleton height="18px" />
                  </div>
                )}

                {bookings_status === "error" && (
                  <ErrorState message="We couldn't load your bookings." onRetry={() => set_retry_key((k) => k + 1)} />
                )}

                {bookings_status === "success" && bookings.length === 0 && (
                  <EmptyState icon="fa-solid fa-suitcase-rolling" title="No trips booked yet" />
                )}

                {bookings_status === "success" && bookings.length > 0 && (
                  <table id="profile_bookings_table">
                    <thead>
                      <tr>
                        <th>Trip Name</th>
                        <th>Trip Date</th>
                        <th>Price</th>
                        <th>Hotel name</th>
                        <th>hotel reservation date</th>
                      </tr>
                    </thead>
                    <tbody>
                      {[...bookings].reverse().map((booking) => (
                        <tr key={booking['id']}>
                          <td>{booking['trip_name']}</td>
                          <td>{booking['trip_date']}</td>
                          <td>{booking['price']}</td>
                          <td>{booking['hotel_name'] === null ? "—" : booking['hotel_name']}</td>
                          <td>{booking['hotel_reserve_date'] === null ? "—" : booking['hotel_reserve_date']}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </Card>
            </div>
          </>
        )}

      </div>
    </div>
  );
}
