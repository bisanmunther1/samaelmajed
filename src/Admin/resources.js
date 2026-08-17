// Schema-driven config for the generic ResourceTable/ResourceForm engine.
// Each resource maps 1:1 to an admin_api DRF ViewSet.

const TRANSPORT_MODES = [
  { key: "plane", label: "Plane" },
  { key: "bus", label: "Bus" },
];

function transport_fields() {
  const fields = [];
  TRANSPORT_MODES.forEach(({ key, label }) => {
    for (let i = 1; i <= 5; i++) {
      const group = `${label} #${i}`;
      fields.push(
        { name: `access_${key}_${i}`, label: "Enabled", type: "boolean", group },
        { name: `access_${key}_name_${i}`, label: "Name", type: "text", group },
        { name: `access_${key}_price_${i}`, label: "Price", type: "number", step: "any", group },
        { name: `${key}_start_at_${i}`, label: "Starts at", type: "datetime", group },
      );
    }
  });
  return fields;
}

export const RESOURCES = {
  trips: {
    label: "Trips",
    endpoint: "/trips/",
    pk_field: "name",
    columns: ["name", "place", "price", "type", "available"],
    fields: [
      { name: "name", label: "Name", type: "text", required: true, pk: true, group: "Details" },
      { name: "img", label: "Photo", type: "image", required: true, group: "Details" },
      { name: "place", label: "Place", type: "text", required: true, group: "Details" },
      {
        name: "type", label: "Type", type: "select", group: "Details",
        options: [
          { value: "Beach", label: "Beach" },
          { value: "Nature", label: "Nature" },
          { value: "City", label: "City" },
        ],
      },
      { name: "price", label: "Price", type: "number", step: "any", group: "Pricing" },
      { name: "discount", label: "Discount", type: "number", step: "any", group: "Pricing" },
      { name: "rate", label: "Rate", type: "number", step: "0.1", group: "Pricing" },
      { name: "num", label: "Number of tourists", type: "number", step: "any", group: "Pricing" },
      { name: "available", label: "Available for booking", type: "boolean", group: "Details" },
      { name: "desc", label: "Description", type: "textarea", group: "Details" },
    ],
  },

  hotels: {
    label: "Hotels",
    endpoint: "/hotels/",
    pk_field: "name",
    columns: ["name", "trip_name", "price", "rate"],
    fields: [
      { name: "name", label: "Name", type: "text", required: true, pk: true, group: "Details" },
      {
        name: "trip_name", label: "Trip", type: "select", required: true, group: "Details",
        options_endpoint: "/trip-features/", option_value: "name", option_label: "name",
      },
      { name: "price", label: "Price per night", type: "number", step: "any", group: "Pricing" },
      { name: "rate", label: "Rate", type: "number", step: "0.1", group: "Pricing" },
      { name: "h_photo1", label: "Photo 1", type: "image", group: "Photos" },
      { name: "h_photo2", label: "Photo 2", type: "image", group: "Photos" },
      { name: "h_photo3", label: "Photo 3", type: "image", group: "Photos" },
      { name: "wifi", label: "Wifi", type: "boolean", group: "Amenities" },
      { name: "pool", label: "Swimming pool", type: "boolean", group: "Amenities" },
      { name: "restaurant", label: "Restaurant", type: "boolean", group: "Amenities" },
      { name: "car_parking", label: "Car parking", type: "boolean", group: "Amenities" },
      { name: "air_conditioning", label: "Air conditioning", type: "boolean", group: "Amenities" },
      { name: "room_services", label: "Room services", type: "boolean", group: "Amenities" },
      { name: "beachfront", label: "Beachfront", type: "boolean", group: "Amenities" },
      { name: "gym", label: "Gym", type: "boolean", group: "Amenities" },
      { name: "cinema", label: "Cinema", type: "boolean", group: "Amenities" },
    ],
  },

  "trip-features": {
    label: "Trip Features",
    endpoint: "/trip-features/",
    pk_field: "name",
    columns: ["name"],
    fields: [
      {
        name: "name", label: "Trip", type: "select", required: true, pk: true, group: "Details",
        options_endpoint: "/trips/", option_value: "name", option_label: "name",
      },
      { name: "img1", label: "Photo 1", type: "image", required: true, group: "Details" },
      { name: "img2", label: "Photo 2", type: "image", required: true, group: "Details" },
      { name: "img3", label: "Photo 3", type: "image", required: true, group: "Details" },
      { name: "img4", label: "Photo 4", type: "image", required: true, group: "Details" },
      ...transport_fields(),
    ],
  },

  bookings: {
    label: "Bookings",
    endpoint: "/bookings/",
    pk_field: "id",
    columns: ["id", "username", "trip_name", "trip_date", "hotel_name", "price", "is_paid"],
    // is_paid is the gate on whether a booking can be reviewed (FR-38), so an
    // operator needs to be able to pull up the unpaid ones.
    filters: [{ name: "is_paid", label: "Payment", type: "boolean", true_label: "Paid", false_label: "Unpaid" }],
    fields: [
      { name: "id", label: "ID", type: "readonly", group: "Details" },
      {
        name: "username", label: "Profile", type: "select", required: true, group: "Details",
        options_endpoint: "/profiles/", option_value: "username", option_label: "username",
      },
      { name: "trip_name", label: "Trip name", type: "text", group: "Details" },
      { name: "trip_date", label: "Trip date", type: "date", group: "Details" },
      { name: "hotel_name", label: "Hotel name", type: "text", group: "Details" },
      { name: "hotel_reserve_date", label: "Hotel reservation date", type: "date", group: "Details" },
      { name: "price", label: "Price", type: "number", step: "any", group: "Details" },
      { name: "is_paid", label: "Paid / completed (allows reviewing)", type: "boolean", group: "Details" },
    ],
  },

  profiles: {
    label: "Profiles",
    endpoint: "/profiles/",
    pk_field: "username",
    columns: ["username", "email", "first_name", "last_name", "country"],
    fields: [
      { name: "username", label: "Username", type: "readonly", pk: true, group: "Details" },
      { name: "email", label: "Email", type: "text", group: "Details" },
      { name: "photo", label: "Photo", type: "image", group: "Details" },
      { name: "first_name", label: "First name", type: "text", group: "Details" },
      { name: "last_name", label: "Last name", type: "text", group: "Details" },
      { name: "phone", label: "Phone", type: "text", group: "Details" },
      { name: "country", label: "Country", type: "text", group: "Details" },
      { name: "birth_date", label: "Birth date", type: "date", group: "Details" },
      { name: "bio", label: "Bio", type: "textarea", group: "Details" },
      { name: "joined_at", label: "Joined at", type: "readonly", group: "Details" },
    ],
  },

  users: {
    label: "Users",
    endpoint: "/users/",
    pk_field: "id",
    superuser_only: true,
    columns: ["username", "email", "is_staff", "is_superuser", "is_active"],
    fields: [
      { name: "id", label: "ID", type: "readonly", group: "Details" },
      { name: "username", label: "Username", type: "text", required: true, group: "Details" },
      { name: "email", label: "Email", type: "text", group: "Details" },
      { name: "first_name", label: "First name", type: "text", group: "Details" },
      { name: "last_name", label: "Last name", type: "text", group: "Details" },
      { name: "password", label: "Password", type: "password", hint: "Leave blank to keep the current password", group: "Details" },
      { name: "is_active", label: "Active", type: "boolean", group: "Permissions" },
      { name: "is_staff", label: "Staff (can access this admin)", type: "boolean", group: "Permissions" },
      { name: "is_superuser", label: "Superuser (full access)", type: "boolean", group: "Permissions" },
      {
        name: "groups", label: "Groups", type: "multiselect", group: "Permissions",
        options_endpoint: "/groups/", option_value: "id", option_label: "name",
      },
    ],
  },

  groups: {
    label: "Groups",
    endpoint: "/groups/",
    pk_field: "id",
    superuser_only: true,
    columns: ["id", "name"],
    fields: [
      { name: "id", label: "ID", type: "readonly", group: "Details" },
      { name: "name", label: "Name", type: "text", required: true, group: "Details" },
      {
        name: "permissions", label: "Permissions", type: "multiselect", group: "Details",
        options_endpoint: "/permissions/", option_value: "id",
        option_label: (p) => `${p.app_label}.${p.model} — ${p.name}`,
      },
    ],
  },
};
