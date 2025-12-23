type StatusBarProps = {
  branch: string;
  errors?: number;
  warnings?: number;
};

export function StatusBar({ branch, errors = 0, warnings = 0 }: StatusBarProps) {
  return (
    <footer className="status-bar">
      <div className="status-item">
        <span>{branch}</span>
      </div>
      {errors > 0 ? (
        <div className="status-item">
          <span>{errors}</span>
        </div>
      ) : null}
      {warnings > 0 ? (
        <div className="status-item">
          <span>{warnings}</span>
        </div>
      ) : null}
      <div className="status-spacer" />
    </footer>
  );
}
