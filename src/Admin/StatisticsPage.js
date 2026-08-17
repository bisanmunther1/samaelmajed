import { useEffect, useState } from "react";
import api, { API_BASE } from "./api";
import Skeleton from "../Components/ui/Skeleton/Skeleton";
import ErrorState from "../Components/ui/ErrorState/ErrorState";

function StatTable({ title, rows, label_key, label_fallback }) {
  return (
    <div className="admin_stat_card">
      <h3>{title}</h3>
      <table className="admin_stat_table">
        <thead><tr><th>{label_fallback}</th><th>Bookings</th></tr></thead>
        <tbody>
          {rows.length === 0 && <tr><td colSpan={2}>No data</td></tr>}
          {rows.map((row, i) => (
            <tr key={i}>
              <td>{row[label_key] ?? "(none)"}</td>
              <td>{row.bookings_count}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default function StatisticsPage() {
  const [start_date, set_start_date] = useState("");
  const [end_date, set_end_date] = useState("");
  const [status, set_status] = useState("loading"); // loading | error | success
  const [stats, set_stats] = useState(null);

  function load(params) {
    set_status("loading");
    api.get("/statistics/", { params })
      .then((res) => {
        set_stats(res.data);
        set_status("success");
      })
      .catch((err) => {
        console.log("error loading statistics", err);
        set_status("error");
      });
  }

  useEffect(() => { load({}); }, []);

  function apply_filter() {
    const params = {};
    if (start_date) params.start_date = start_date;
    if (end_date) params.end_date = end_date;
    load(params);
  }

  const export_params = new URLSearchParams();
  if (start_date) export_params.set("start_date", start_date);
  if (end_date) export_params.set("end_date", end_date);
  const export_query = export_params.toString();

  return (
    <div className="admin_page">
      <div className="admin_page_header">
        <h1>Statistics</h1>
      </div>

      <div className="admin_stat_card admin_stat_filter_bar">
        <div className="ui-field">
          <label className="ui-field-label">Start date</label>
          <input type="date" className="admin_select" value={start_date} onChange={(e) => set_start_date(e.target.value)} />
        </div>
        <div className="ui-field">
          <label className="ui-field-label">End date</label>
          <input type="date" className="admin_select" value={end_date} onChange={(e) => set_end_date(e.target.value)} />
        </div>
        <button type="button" className="admin_stat_btn" onClick={apply_filter}>Apply filter</button>
        <a
          className="admin_stat_btn admin_stat_btn_primary"
          href={`${API_BASE}/statistics/export/${export_query ? "?" + export_query : ""}`}
          target="_blank"
          rel="noreferrer"
        >
          Export to Excel
        </a>
      </div>

      {status === "loading" && (
        <div className="admin_form_skeleton">
          <Skeleton height="60px" />
          <Skeleton height="200px" />
        </div>
      )}

      {status === "error" && <ErrorState message="We couldn't load statistics." onRetry={() => load({})} />}

      {status === "success" && stats && (
        <>
          <div className="admin_stat_metric_row">
            <div className="admin_stat_card admin_stat_metric_card">
              <div className="admin_stat_metric_icon is_primary">📋</div>
              <div>
                <div className="admin_stat_metric_label">Total bookings</div>
                <div className="admin_stat_metric_value">{stats.total_bookings}</div>
              </div>
            </div>
            <div className="admin_stat_card admin_stat_metric_card">
              <div className="admin_stat_metric_icon is_secondary">👤</div>
              <div>
                <div className="admin_stat_metric_label">New users</div>
                <div className="admin_stat_metric_value">{stats.new_users}</div>
              </div>
            </div>
          </div>

          <div className="admin_stat_panel_row">
            <StatTable title="Most booked trips" rows={stats.most_booked_trips} label_key="trip_name" label_fallback="Trip" />
            <StatTable title="Bookings by destination" rows={stats.bookings_by_destination} label_key="place" label_fallback="Destination" />
          </div>
          <div className="admin_stat_panel_row">
            <StatTable title="Bookings by hotel" rows={stats.bookings_by_hotel} label_key="hotel_name" label_fallback="Hotel" />
            <StatTable title="Bookings by transport" rows={stats.bookings_by_transport} label_key="transport_method" label_fallback="Method" />
          </div>
        </>
      )}
    </div>
  );
}
