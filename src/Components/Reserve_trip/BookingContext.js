import { createContext, useCallback, useContext, useState } from "react";

const BookingContext = createContext(null);

export function BookingProvider({ children }) {
  const [tripName, setTripName] = useState(null);

  const openBooking = useCallback((name) => setTripName(name), []);
  const closeBooking = useCallback(() => setTripName(null), []);

  return (
    <BookingContext.Provider value={{ tripName, openBooking, closeBooking }}>
      {children}
    </BookingContext.Provider>
  );
}

export function useBooking() {
  const ctx = useContext(BookingContext);
  if (!ctx) throw new Error("useBooking must be used within a BookingProvider");
  return ctx;
}
