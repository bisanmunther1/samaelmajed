import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import api from "./api";
import { RESOURCES } from "./resources";
import Input, { Textarea } from "../Components/ui/Input/Input";
import Button from "../Components/ui/Button/Button";
import Skeleton from "../Components/ui/Skeleton/Skeleton";
import ErrorState from "../Components/ui/ErrorState/ErrorState";
import { useToast } from "../Components/ui/Toast/ToastContext";

function default_value(field) {
  if (field.type === "boolean") return false;
  if (field.type === "multiselect") return [];
  return "";
}

function group_fields(fields) {
  const groups = [];
  const by_name = new Map();
  fields.forEach((field) => {
    const group_name = field.group || "Details";
    if (!by_name.has(group_name)) {
      by_name.set(group_name, { name: group_name, fields: [] });
      groups.push(by_name.get(group_name));
    }
    by_name.get(group_name).fields.push(field);
  });
  return groups;
}

function option_label_for(field, option) {
  if (typeof field.option_label === "function") return field.option_label(option);
  return option[field.option_label];
}

export default function ResourceFormPage({ resource_key: resource_key_prop, mode }) {
  const params = useParams();
  const resource_key = resource_key_prop || params.resource_key;
  const resource = RESOURCES[resource_key];
  const navigate = useNavigate();
  const { showToast } = useToast();
  const is_edit = mode === "edit";

  const [status, set_status] = useState(is_edit ? "loading" : "ready"); // loading | ready | error
  const [submitting, set_submitting] = useState(false);
  const [form_data, set_form_data] = useState(() => {
    const initial = {};
    resource.fields.forEach((field) => { initial[field.name] = default_value(field); });
    return initial;
  });
  const [existing_images, set_existing_images] = useState({});
  const [option_lists, set_option_lists] = useState({});

  useEffect(() => {
    const select_fields = resource.fields.filter((f) => f.options_endpoint);
    select_fields.forEach((field) => {
      api.get(field.options_endpoint)
        .then((res) => {
          set_option_lists((prev) => ({ ...prev, [field.name]: res.data }));
        })
        .catch((err) => console.log("error loading options for " + field.name, err));
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resource_key]);

  useEffect(() => {
    if (!is_edit) return;
    let cancelled = false;

    api.get(`${resource.endpoint}${encodeURIComponent(params.pk)}/`)
      .then((res) => {
        if (cancelled) return;
        const data = { ...res.data };
        const images = {};
        resource.fields.forEach((field) => {
          if (field.type === "image" && typeof data[field.name] === "string") {
            images[field.name] = data[field.name];
            data[field.name] = null;
          }
        });
        set_existing_images(images);
        set_form_data((prev) => ({ ...prev, ...data }));
        set_status("ready");
      })
      .catch((err) => {
        if (cancelled) return;
        console.log("error loading " + resource_key, err);
        set_status("error");
      });

    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resource_key, params.pk, is_edit]);

  function update_field(name, value) {
    set_form_data((prev) => ({ ...prev, [name]: value }));
  }

  function toggle_multiselect(name, value) {
    set_form_data((prev) => {
      const current = prev[name] || [];
      const exists = current.some((v) => String(v) === String(value));
      const next = exists ? current.filter((v) => String(v) !== String(value)) : [...current, value];
      return { ...prev, [name]: next };
    });
  }

  async function handle_submit(e) {
    e.preventDefault();
    set_submitting(true);

    const body = new FormData();
    resource.fields.forEach((field) => {
      if (field.type === "readonly") return;
      if (is_edit && field.pk) return; // pk immutable after creation
      if (field.type === "image") {
        if (form_data[field.name] instanceof File) body.append(field.name, form_data[field.name]);
        return;
      }
      if (field.type === "password" && !form_data[field.name]) return; // leave password unchanged
      if (field.type === "multiselect") {
        (form_data[field.name] || []).forEach((v) => body.append(field.name, v));
        return;
      }
      const value = form_data[field.name];
      body.append(field.name, value === null || value === undefined ? "" : value);
    });

    try {
      if (is_edit) {
        await api.patch(`${resource.endpoint}${encodeURIComponent(params.pk)}/`, body);
      } else {
        await api.post(resource.endpoint, body);
      }
      showToast(`${resource.label.replace(/s$/, "")} saved.`, "success");
      navigate(`/admin/${resource_key}`);
    } catch (err) {
      console.log("error saving " + resource_key, err);
      const detail = err.response?.data;
      showToast(
        detail && typeof detail === "object"
          ? Object.entries(detail).map(([k, v]) => `${k}: ${Array.isArray(v) ? v.join(" ") : v}`).join(" · ")
          : "Couldn't save — check the fields and try again.",
        "error"
      );
    } finally {
      set_submitting(false);
    }
  }

  if (status === "loading") {
    return (
      <div className="admin_page">
        <Skeleton height="24px" width="30%" />
        <div className="admin_form_skeleton">
          <Skeleton height="40px" />
          <Skeleton height="40px" />
          <Skeleton height="40px" />
        </div>
      </div>
    );
  }

  if (status === "error") {
    return (
      <div className="admin_page">
        <ErrorState message={`We couldn't load this ${resource.label.toLowerCase().replace(/s$/, "")}.`} />
      </div>
    );
  }

  return (
    <div className="admin_page">
      <div className="admin_page_header">
        <h1>{is_edit ? `Edit ${resource.label.replace(/s$/, "")}` : `New ${resource.label.replace(/s$/, "")}`}</h1>
      </div>

      <form onSubmit={handle_submit} className="admin_form">
        {group_fields(resource.fields).map((group) => (
          <fieldset className="admin_form_group" key={group.name}>
            <legend>{group.name}</legend>
            <div className="admin_form_grid">
              {group.fields.map((field) => {
                if (field.type === "readonly") {
                  return (
                    <div className="admin_readonly_field" key={field.name}>
                      <span className="admin_readonly_label">{field.label}</span>
                      <span className="admin_readonly_value">{form_data[field.name] ?? "—"}</span>
                    </div>
                  );
                }

                if (field.type === "boolean") {
                  return (
                    <label className="admin_checkbox_field" key={field.name}>
                      <input
                        type="checkbox"
                        checked={Boolean(form_data[field.name])}
                        onChange={(e) => update_field(field.name, e.target.checked)}
                      />
                      {field.label}
                    </label>
                  );
                }

                if (field.type === "textarea") {
                  return (
                    <Textarea
                      key={field.name}
                      label={field.label}
                      value={form_data[field.name] || ""}
                      onChange={(e) => update_field(field.name, e.target.value)}
                    />
                  );
                }

                if (field.type === "select") {
                  const options = field.options || option_lists[field.name] || [];
                  const disabled = is_edit && field.pk;
                  return (
                    <div className="ui-field" key={field.name}>
                      <label className="ui-field-label">{field.label}</label>
                      <select
                        className="admin_select"
                        value={form_data[field.name] ?? ""}
                        disabled={disabled}
                        required={field.required}
                        onChange={(e) => update_field(field.name, e.target.value)}
                      >
                        <option value="">Select…</option>
                        {options.map((opt) => {
                          const value = field.option_value ? opt[field.option_value] : opt.value;
                          const label = field.option_label ? option_label_for(field, opt) : opt.label;
                          return <option key={value} value={value}>{label}</option>;
                        })}
                      </select>
                    </div>
                  );
                }

                if (field.type === "multiselect") {
                  const options = option_lists[field.name] || [];
                  const selected = form_data[field.name] || [];
                  return (
                    <div className="admin_multiselect_field" key={field.name}>
                      <span className="ui-field-label">{field.label}</span>
                      <div className="admin_multiselect_list">
                        {options.map((opt) => {
                          const value = field.option_value ? opt[field.option_value] : opt.value;
                          const label = field.option_label ? option_label_for(field, opt) : opt.label;
                          return (
                            <label key={value} className="admin_multiselect_option">
                              <input
                                type="checkbox"
                                checked={selected.some((v) => String(v) === String(value))}
                                onChange={() => toggle_multiselect(field.name, value)}
                              />
                              {label}
                            </label>
                          );
                        })}
                      </div>
                    </div>
                  );
                }

                if (field.type === "image") {
                  return (
                    <div className="admin_image_field" key={field.name}>
                      <span className="ui-field-label">{field.label}</span>
                      {existing_images[field.name] && !form_data[field.name] && (
                        <img src={existing_images[field.name]} alt={field.label} className="admin_image_preview" />
                      )}
                      <input
                        type="file"
                        accept="image/*"
                        onChange={(e) => update_field(field.name, e.target.files[0] || null)}
                      />
                    </div>
                  );
                }

                return (
                  <Input
                    key={field.name}
                    label={field.label}
                    hint={field.hint}
                    type={field.type === "password" ? "password" : field.type === "number" ? "number" : field.type === "date" ? "date" : field.type === "datetime" ? "datetime-local" : "text"}
                    step={field.step}
                    required={field.required && !(is_edit && field.pk)}
                    disabled={is_edit && field.pk}
                    value={form_data[field.name] ?? ""}
                    onChange={(e) => update_field(field.name, e.target.value)}
                  />
                );
              })}
            </div>
          </fieldset>
        ))}

        <div className="admin_form_actions">
          <Button type="submit" loading={submitting}>Save</Button>
          <Button type="button" variant="ghost" onClick={() => navigate(`/admin/${resource_key}`)}>Cancel</Button>
        </div>
      </form>
    </div>
  );
}
