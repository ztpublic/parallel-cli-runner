import { Icon } from "../Icons";
import { CommitItem } from "../../types/git-ui";

type GitCommitsProps = {
  commits: CommitItem[];
};

export function GitCommits({ commits }: GitCommitsProps) {
  return (
    <div className="git-list">
      {commits.map((commit) => (
        <div key={commit.id} className="git-item">
          <Icon name="commit" size={14} />
          <div className="git-item-body">
            <div className="git-item-title">
              <span className="git-item-name">{commit.message}</span>
              <span className="git-hash">{commit.id}</span>
            </div>
            <div className="git-item-meta">
              <span>{commit.author}</span>
              <span className="git-dot" />
              <span>{commit.date}</span>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
