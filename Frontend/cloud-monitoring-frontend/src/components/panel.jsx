
function Panel({
  title,
  action,
  onAction,
  children,
  className = "",
}) {
  return (
    <section className={`cm-panel ${className}`}>
      <div className="cm-panel-heading">
        <h3>{title}</h3>

        {action && onAction && (
          <button
            type="button"
            className="cm-text-button"
            onClick={onAction}
          >
            {action} →
          </button>
        )}
      </div>

      <div className="cm-panel-content">
        {children}
      </div>
    </section>
  );
}

export default Panel;
