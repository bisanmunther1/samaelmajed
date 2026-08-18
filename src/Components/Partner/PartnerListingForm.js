import { useEffect, useState } from "react";
import Button from "../ui/Button/Button";
import Input, { Textarea } from "../ui/Input/Input";
import Modal from "../ui/Modal/Modal";
import {
  create_partner_listing, partner_error_message, update_partner_listing,
} from "./partnerApi";
import { PARTNER_STRINGS } from "./strings";

const EMPTY = { name: "", place: "", price: "", capacity: "", desc: "", trip: "" };

/**
 * Create/edit one listing. Which fields show depends on what the partner
 * manages — a hotel needs the trip it hangs off, a trip needs a destination.
 */
export default function PartnerListingForm({ partner, listing, isOpen, onClose, onSaved }) {
  const is_hotel = partner.partner_type === "hotel_manager";
  const [values, set_values] = useState(EMPTY);
  const [submitting, set_submitting] = useState(false);
  const [error, set_error] = useState("");

  useEffect(() => {
    if (!isOpen) return;

    set_error("");
    set_values(
      listing
        ? {
            name: listing.name || "",
            place: listing.place || "",
            price: listing.price || "",
            capacity: listing.capacity || "",
            desc: listing.desc || "",
            trip: "",
          }
        : EMPTY
    );
  }, [isOpen, listing]);

  function update(field, value) {
    set_values((current) => ({ ...current, [field]: value }));
  }

  async function handle_submit(event) {
    event.preventDefault();
    set_error("");
    set_submitting(true);

    // Only what this partner type actually owns is sent; the server ignores
    // anything else and decides ownership itself.
    const payload = is_hotel
      ? { name: values.name, price: values.price, trip: values.trip }
      : {
          name: values.name, place: values.place, price: values.price,
          capacity: values.capacity || undefined, desc: values.desc,
          rate: 0, discount: 0, type: "Beach",
        };

    try {
      if (listing) {
        await update_partner_listing(listing.name, payload);
      } else {
        await create_partner_listing(payload);
      }
      onSaved();
    } catch (request_error) {
      set_error(partner_error_message(request_error));
    } finally {
      set_submitting(false);
    }
  }

  const footer = (
    <div className="partner_form_actions">
      <Button variant="ghost" size="sm" onClick={onClose} disabled={submitting}>
        {PARTNER_STRINGS.listing_cancel}
      </Button>
      <Button size="sm" loading={submitting} disabled={submitting} onClick={handle_submit}>
        {PARTNER_STRINGS.listing_save}
      </Button>
    </div>
  );

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={listing ? PARTNER_STRINGS.listing_edit_title : PARTNER_STRINGS.listing_new_title}
      footer={footer}
    >
      <form className="partner_form" onSubmit={handle_submit} noValidate>
        <Input
          label={PARTNER_STRINGS.field_name}
          name="name"
          value={values.name}
          disabled={Boolean(listing)}
          onChange={(event) => update("name", event.target.value)}
        />

        {is_hotel ? (
          <Input
            label={PARTNER_STRINGS.field_trip}
            name="trip"
            value={values.trip}
            onChange={(event) => update("trip", event.target.value)}
          />
        ) : (
          <Input
            label={PARTNER_STRINGS.field_place}
            name="place"
            value={values.place}
            onChange={(event) => update("place", event.target.value)}
          />
        )}

        <Input
          label={PARTNER_STRINGS.field_price}
          name="price"
          type="number"
          value={values.price}
          onChange={(event) => update("price", event.target.value)}
        />

        {!is_hotel && (
          <>
            <Input
              label={PARTNER_STRINGS.field_capacity}
              name="capacity"
              type="number"
              value={values.capacity}
              onChange={(event) => update("capacity", event.target.value)}
            />
            <Textarea
              label={PARTNER_STRINGS.field_description}
              name="desc"
              rows={3}
              value={values.desc}
              onChange={(event) => update("desc", event.target.value)}
            />
          </>
        )}

        {error && (
          <p className="partner_error" role="alert">
            {error}
          </p>
        )}
      </form>
    </Modal>
  );
}
