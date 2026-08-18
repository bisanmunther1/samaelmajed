import { createContext, useCallback, useContext, useRef, useState } from "react";
import "./Toast.css";
import { COMMON_STRINGS } from "../../../i18n/common";

const ToastContext = createContext(null);

let idCounter = 0;

function toastIcon(type) {
  if (type === "success") return "fa-solid fa-circle-check";
  if (type === "error") return "fa-solid fa-circle-exclamation";
  return "fa-solid fa-circle-info";
}

export function ToastProvider({ children }) {
  const [toasts, set_toasts] = useState([]);
  const timers = useRef({});

  const dismissToast = useCallback((id) => {
    set_toasts((current) => current.filter((toast) => toast.id !== id));
    clearTimeout(timers.current[id]);
    delete timers.current[id];
  }, []);

  const showToast = useCallback(
    (message, type = "info", duration = 4000) => {
      const id = ++idCounter;
      set_toasts((current) => [...current, { id, message, type }]);
      timers.current[id] = setTimeout(() => dismissToast(id), duration);
      return id;
    },
    [dismissToast]
  );

  return (
    <ToastContext.Provider value={{ showToast, dismissToast }}>
      {children}
      <div className="ui-toast-container">
        {toasts.map((toast) => (
          <div key={toast.id} className={`ui-toast ui-toast-${toast.type}`} role="status">
            <i className={`${toastIcon(toast.type)} ui-toast-icon`} aria-hidden="true"></i>
            <span className="ui-toast-message">{toast.message}</span>
            <button
              type="button"
              className="ui-toast-close"
              aria-label={COMMON_STRINGS.dismiss}
              onClick={() => dismissToast(toast.id)}
            >
              <i className="fa-solid fa-xmark" aria-hidden="true"></i>
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast must be used within a ToastProvider");
  return ctx;
}
