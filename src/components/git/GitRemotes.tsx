import { Icon } from "../Icons";
import { RemoteItem } from "../../types/git-ui";

type GitRemotesProps = {
  remotes: RemoteItem[];
};

export function GitRemotes({ remotes }: GitRemotesProps) {
  return (
    <div className="git-list">
      {remotes.map((remote) => (
        <div key={remote.name} className="git-item">
          <Icon name="cloud" size={14} />
          <div className="git-item-body">
            <div className="git-item-title">
              <span className="git-item-name">{remote.name}</span>
            </div>
            <div className="git-item-meta">Fetch: {remote.fetch}</div>
            <div className="git-item-meta">Push: {remote.push}</div>
          </div>
        </div>
      ))}
    </div>
  );
}
