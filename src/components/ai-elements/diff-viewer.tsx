import { cn } from '~/lib/utils';

// ACP protocol Diff format (from ToolCallContent type: "diff")
export type DiffViewerProps = {
  path: string; // File path being modified
  oldText?: string; // Original content (null for new files)
  newText: string; // New content after modification
  className?: string;
};

export const DiffViewer = ({
  path,
  oldText,
  newText,
  className,
}: DiffViewerProps) => {
  const getFilename = (filePath: string) => {
    return filePath.split('/').pop() || filePath;
  };

  const filename = getFilename(path);

  return (
    <div className={cn('rounded-md border bg-muted/50', className)}>
      <div className="flex items-center gap-2 border-b px-3 py-2">
        <div className="text-xs font-medium text-muted-foreground">
          {filename}
        </div>
        <div className="rounded bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground">
          {oldText ? 'Modified' : 'New File'}
        </div>
      </div>
      <div className="p-3">
        {oldText && (
          <div className="mb-2">
            <div className="mb-1 text-xs font-medium text-muted-foreground">
              Before:
            </div>
            <pre className="overflow-x-auto rounded bg-destructive/10 p-2 text-xs text-destructive">
              <code>{oldText}</code>
            </pre>
          </div>
        )}
        <div>
          <div className="mb-1 text-xs font-medium text-muted-foreground">
            After:
          </div>
          <pre className="overflow-x-auto rounded bg-green-500/10 p-2 text-xs text-green-700 dark:text-green-400">
            <code>{newText}</code>
          </pre>
        </div>
      </div>
    </div>
  );
};
