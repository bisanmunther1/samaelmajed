import "./EmptyState.css";
import { COMMON_STRINGS } from "../../../i18n/common";

export default function EmptyState({
  icon = "fa-solid fa-inbox",
  title,
  message,
  action,
}) {
  return (
    <div className="ui-state ui-empty-state">
      <i className={`${icon} ui-state-icon`} aria-hidden="true"></i>
      <h3 className="ui-state-title">{title || COMMON_STRINGS.empty_default}</h3>
      {message && <p className="ui-state-message">{message}</p>}
      {action && <div className="ui-state-action">{action}</div>}
    </div>
  );
}
