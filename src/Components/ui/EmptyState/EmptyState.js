import "./EmptyState.css";

export default function EmptyState({
  icon = "fa-solid fa-inbox",
  title = "Nothing here yet",
  message,
  action,
}) {
  return (
    <div className="ui-state ui-empty-state">
      <i className={`${icon} ui-state-icon`} aria-hidden="true"></i>
      <h3 className="ui-state-title">{title}</h3>
      {message && <p className="ui-state-message">{message}</p>}
      {action && <div className="ui-state-action">{action}</div>}
    </div>
  );
}
