import Button from "../Button/Button";
import "./ErrorState.css";
import { COMMON_STRINGS } from "../../../i18n/common";

export default function ErrorState({
  title,
  message,
  onRetry,
}) {
  return (
    <div className="ui-state ui-error-state">
      <i className="fa-solid fa-triangle-exclamation ui-state-icon" aria-hidden="true"></i>
      <h3 className="ui-state-title">{title || COMMON_STRINGS.error_default}</h3>
      <p className="ui-state-message">{message || COMMON_STRINGS.error_message_default}</p>
      {onRetry && (
        <div className="ui-state-action">
          <Button variant="ghost" onClick={onRetry}>
            {COMMON_STRINGS.retry}
          </Button>
        </div>
      )}
    </div>
  );
}
