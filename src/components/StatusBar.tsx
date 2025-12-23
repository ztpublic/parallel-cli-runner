type StatusBarProps = {
  branch: string;
  openedFolder: string | null;
  errors?: number;
  warnings?: number;
};

export function StatusBar({
  branch,
  openedFolder,
  errors = 0,
  warnings = 0,
}: StatusBarProps) {
  return (
    <footer className="status-bar">
      <div className="status-item">
        <span>Folder:</span>
        <span className="status-path">{openedFolder ?? "None"}</span>
      </div>
      <div className="status-item">
        <span>Branch:</span>
        <span>{branch}</span>
      </div>
      <div className="status-item">
        <span>Errors:</span>
        <span>{errors}</span>
      </div>
      <div className="status-item">
        <span>Warnings:</span>
        <span>{warnings}</span>
      </div>
      <div className="status-spacer" />
    </footer>
  );
}
