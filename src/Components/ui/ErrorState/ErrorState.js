import Button from "../Button/Button";
import "./ErrorState.css";

export default function ErrorState({
  title = "Something went wrong",
  message = "We couldn't load this. Please try again.",
  onRetry,
}) {
  return (
    <div className="ui-state ui-error-state">
      <i className="fa-solid fa-triangle-exclamation ui-state-icon" aria-hidden="true"></i>
      <h3 className="ui-state-title">{title}</h3>
      <p className="ui-state-message">{message}</p>
      {onRetry && (
        <div className="ui-state-action">
          <Button variant="ghost" onClick={onRetry}>
            Retry
          </Button>
        </div>
      )}
    </div>
  );
}
