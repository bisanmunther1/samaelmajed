import "./Card.css";

export default function Card({
  children,
  className = "",
  padding = true,
  hoverable = false,
  onClick,
  ...rest
}) {
  const classes = [
    "ui-card",
    padding ? "ui-card-padded" : "",
    hoverable ? "ui-card-hoverable" : "",
    className,
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <div className={classes} onClick={onClick} {...rest}>
      {children}
    </div>
  );
}

export function CardMedia({ src, alt = "", className = "", children, ...rest }) {
  const style = src ? { backgroundImage: `url('${src}')` } : undefined;
  return (
    <div
      className={`ui-card-media ${className}`}
      style={style}
      role={alt ? "img" : undefined}
      aria-label={alt || undefined}
      {...rest}
    >
      {children}
    </div>
  );
}

export function CardBody({ children, className = "", ...rest }) {
  return (
    <div className={`ui-card-body ${className}`} {...rest}>
      {children}
    </div>
  );
}

export function CardFooter({ children, className = "", ...rest }) {
  return (
    <div className={`ui-card-footer ${className}`} {...rest}>
      {children}
    </div>
  );
}
