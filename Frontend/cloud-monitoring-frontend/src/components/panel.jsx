
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

        {action && (
          <button
            type="button"
            className="cm-text-button"
            onClick={
              onAction || (() => alert(`${title} workspace selected`))
            }
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
