import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import api from "./api";
import { RESOURCES } from "./resources";
import Button from "../Components/ui/Button/Button";
import Skeleton from "../Components/ui/Skeleton/Skeleton";
import ErrorState from "../Components/ui/ErrorState/ErrorState";
import EmptyState from "../Components/ui/EmptyState/EmptyState";
import { useToast } from "../Components/ui/Toast/ToastContext";

function format_cell(value) {
  if (value === null || value === undefined || value === "") return "—";
  if (typeof value === "boolean") return value ? "Yes" : "No";
  return String(value);
}

export default function ResourceListPage({ resource_key: resource_key_prop }) {
  const params = useParams();
  const resource_key = resource_key_prop || params.resource_key;
  const resource = RESOURCES[resource_key];
  const { showToast } = useToast();
  const navigate = useNavigate();

  const [status, set_status] = useState("loading"); // loading | error | success
  const [rows, set_rows] = useState([]);
  const [retry_key, set_retry_key] = useState(0);
  const [filter_values, set_filter_values] = useState({}); // { [field]: "" | "true" | "false" }

  const filters = resource.filters || [];

  // Resource lists come back unpaginated, so filtering is a local narrowing of
  // what is already on screen rather than another round trip.
  const visible_rows = rows.filter((row) =>
    filters.every((filter) => {
      const selected = filter_values[filter.name];
      if (!selected) return true;
      return String(Boolean(row[filter.name])) === selected;
    })
  );

  useEffect(() => {
    let cancelled = false;
    set_status("loading");
    set_filter_values({});

    api.get(resource.endpoint)
      .then((res) => {
        if (cancelled) return;
        set_rows(res.data);
        set_status("success");
      })
      .catch((err) => {
        if (cancelled) return;
        console.log("error loading " + resource_key, err);
        set_status("error");
      });

    return () => { cancelled = true; };
  }, [resource, resource_key, retry_key]);

  async function handle_delete(pk) {
    if (!window.confirm(`Delete this ${resource.label.replace(/s$/, "")}? This can't be undone.`)) return;

    try {
      await api.delete(`${resource.endpoint}${pk}/`);
      set_rows((current) => current.filter((row) => String(row[resource.pk_field]) !== String(pk)));
      showToast(`${resource.label.replace(/s$/, "")} deleted.`, "success");
    } catch (err) {
      console.log("error deleting " + resource_key, err);
      showToast("Couldn't delete — check it isn't referenced elsewhere.", "error");
    }
  }

  return (
    <div className="admin_page">
      <div className="admin_page_header">
        <h1>{resource.label}</h1>
        <Button onClick={() => navigate(`/admin/${resource_key}/new`)}>
          New {resource.label.replace(/s$/, "")}
        </Button>
      </div>

      {status === "loading" && (
        <div className="admin_table_skeleton">
          <Skeleton height="18px" />
          <Skeleton height="18px" />
          <Skeleton height="18px" />
        </div>
      )}

      {status === "error" && (
        <ErrorState message={`We couldn't load ${resource.label.toLowerCase()}.`} onRetry={() => set_retry_key((k) => k + 1)} />
      )}

      {status === "success" && rows.length > 0 && filters.length > 0 && (
        <div className="admin_filter_bar">
          {filters.map((filter) => (
            <label className="admin_filter" key={filter.name}>
              <span>{filter.label}</span>
              <select
                value={filter_values[filter.name] || ""}
                onChange={(e) =>
                  set_filter_values((current) => ({ ...current, [filter.name]: e.target.value }))
                }
              >
                <option value="">All</option>
                <option value="true">{filter.true_label || "Yes"}</option>
                <option value="false">{filter.false_label || "No"}</option>
              </select>
            </label>
          ))}
        </div>
      )}

      {status === "success" && rows.length === 0 && (
        <EmptyState icon="fa-solid fa-inbox" title={`No ${resource.label.toLowerCase()} yet`} />
      )}

      {status === "success" && rows.length > 0 && visible_rows.length === 0 && (
        <EmptyState
          icon="fa-solid fa-filter"
          title={`No ${resource.label.toLowerCase()} match this filter`}
        />
      )}

      {status === "success" && visible_rows.length > 0 && (
        <div className="admin_table_card">
          <table className="admin_table">
            <thead>
              <tr>
                {resource.columns.map((col) => <th key={col}>{col.replace(/_/g, " ")}</th>)}
                <th></th>
              </tr>
            </thead>
            <tbody>
              {visible_rows.map((row) => (
                <tr key={row[resource.pk_field]}>
                  {resource.columns.map((col) => (
                    <td key={col}>{format_cell(row[col])}</td>
                  ))}
                  <td className="admin_table_actions">
                    <Link to={`/admin/${resource_key}/${encodeURIComponent(row[resource.pk_field])}/edit`}>Edit</Link>
                    <button type="button" onClick={() => handle_delete(row[resource.pk_field])}>Delete</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
