import "./Input.css";

export default function Input({
  label,
  id,
  error,
  icon,
  onIconClick,
  iconLabel,
  hint,
  className = "",
  containerClassName = "",
  ...rest
}) {
  const inputId = id || rest.name;

  return (
    <div className={`ui-field ${containerClassName}`}>
      {label && (
        <label htmlFor={inputId} className="ui-field-label">
          {label}
        </label>
      )}
      <div className={`ui-field-control ${error ? "ui-field-control-error" : ""}`}>
        {icon && onIconClick ? (
          <button
            type="button"
            className="ui-field-icon-button"
            onClick={onIconClick}
            aria-label={iconLabel || "Toggle"}
          >
            <i className={icon} aria-hidden="true"></i>
          </button>
        ) : (
          icon && <i className={`${icon} ui-field-icon`} aria-hidden="true"></i>
        )}
        <input id={inputId} className={`ui-input ${className}`} {...rest} />
      </div>
      {error && <p className="ui-field-error">{error}</p>}
      {!error && hint && <p className="ui-field-hint">{hint}</p>}
    </div>
  );
}

export function Textarea({
  label,
  id,
  error,
  hint,
  className = "",
  containerClassName = "",
  ...rest
}) {
  const inputId = id || rest.name;

  return (
    <div className={`ui-field ${containerClassName}`}>
      {label && (
        <label htmlFor={inputId} className="ui-field-label">
          {label}
        </label>
      )}
      <div className={`ui-field-control ${error ? "ui-field-control-error" : ""}`}>
        <textarea id={inputId} className={`ui-input ui-textarea ${className}`} {...rest} />
      </div>
      {error && <p className="ui-field-error">{error}</p>}
      {!error && hint && <p className="ui-field-hint">{hint}</p>}
    </div>
  );
}
