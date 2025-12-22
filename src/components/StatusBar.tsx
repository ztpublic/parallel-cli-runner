import { Icon } from "./Icons";

type StatusBarProps = {
  branch: string;
  errors?: number;
  warnings?: number;
};

export function StatusBar({ branch, errors = 0, warnings = 0 }: StatusBarProps) {
  return (
    <footer className="status-bar">
      <div className="status-item">
        <Icon name="branch" size={14} />
        <span>{branch}</span>
      </div>
      {errors > 0 ? (
        <div className="status-item">
          <Icon name="alert" size={14} />
          <span>{errors}</span>
        </div>
      ) : null}
      {warnings > 0 ? (
        <div className="status-item">
          <Icon name="alert" size={14} />
          <span>{warnings}</span>
        </div>
      ) : null}
      <div className="status-spacer" />
      <button type="button" className="status-icon" title="Notifications">
        <Icon name="bell" size={14} />
      </button>
      <button type="button" className="status-icon" title="Quick actions">
        <Icon name="bolt" size={14} />
      </button>
    </footer>
  );
}
