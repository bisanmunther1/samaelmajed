import { useState } from "react";
import Button from "../ui/Button/Button";
import Input from "../ui/Input/Input";
import { partner_error_message, register_partner } from "./partnerApi";
import { PARTNER_STRINGS, partner_type_options } from "./strings";

/** Application form for a customer who wants to list on the platform. */
export default function PartnerRegister({ onRegistered }) {
  const [business_name, set_business_name] = useState("");
  const [contact_phone, set_contact_phone] = useState("");
  const [contact_email, set_contact_email] = useState("");
  const [partner_type, set_partner_type] = useState(partner_type_options()[0].value);

  const [submitting, set_submitting] = useState(false);
  const [error, set_error] = useState("");

  async function handle_submit(event) {
    event.preventDefault();
    set_error("");

    if (!business_name.trim()) {
      set_error(PARTNER_STRINGS.register_business_name);
      return;
    }

    set_submitting(true);
    try {
      const created = await register_partner({
        business_name: business_name.trim(),
        contact_phone,
        contact_email,
        partner_type,
      });
      onRegistered(created);
    } catch (request_error) {
      set_error(partner_error_message(request_error));
    } finally {
      set_submitting(false);
    }
  }

  return (
    <form className="partner_register" onSubmit={handle_submit} noValidate>
      <div id="partner_head">
        <span id="partner_business">{PARTNER_STRINGS.register_title}</span>
      </div>

      <p className="partner_register_intro">{PARTNER_STRINGS.register_intro}</p>

      <Input
        label={PARTNER_STRINGS.register_business_name}
        name="business_name"
        value={business_name}
        onChange={(event) => set_business_name(event.target.value)}
      />

      <div className="ui-field">
        <label className="ui-field-label" htmlFor="partner_type">
          {PARTNER_STRINGS.register_type}
        </label>
        <select
          id="partner_type"
          className="partner_select"
          value={partner_type}
          onChange={(event) => set_partner_type(event.target.value)}
        >
          {partner_type_options().map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </div>

      <Input
        label={PARTNER_STRINGS.register_phone}
        name="contact_phone"
        value={contact_phone}
        onChange={(event) => set_contact_phone(event.target.value)}
      />

      <Input
        label={PARTNER_STRINGS.register_email}
        name="contact_email"
        type="email"
        value={contact_email}
        onChange={(event) => set_contact_email(event.target.value)}
      />

      {error && (
        <p className="partner_error" role="alert">
          {error}
        </p>
      )}

      <Button type="submit" loading={submitting} disabled={submitting}>
        {PARTNER_STRINGS.register_submit}
      </Button>
    </form>
  );
}
