import { useState } from "react";
import "./Avatar.css";

export default function Avatar({ name, src, size = 40, className = "" }) {
  const [broken, set_broken] = useState(false);

  const initial = name && name.length > 0 ? name.charAt(0).toUpperCase() : "?";
  const show_photo = Boolean(src) && !broken;
  const style = { width: size, height: size, fontSize: Math.round(size * 0.42) };

  return (
    <div className={`ui-avatar ${className}`} style={style}>
      {show_photo ? (
        <img src={src} alt={name || "avatar"} onError={() => set_broken(true)} />
      ) : (
        <span>{initial}</span>
      )}
    </div>
  );
}
