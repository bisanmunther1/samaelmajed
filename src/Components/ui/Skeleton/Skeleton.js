import "./Skeleton.css";

export default function Skeleton({
  width = "100%",
  height = "16px",
  radius = "var(--radius-sm)",
  className = "",
  style = {},
}) {
  return (
    <span
      className={`ui-skeleton ${className}`}
      style={{ width, height, borderRadius: radius, ...style }}
      aria-hidden="true"
    ></span>
  );
}
