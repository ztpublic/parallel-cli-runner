import { cn } from '~/lib/utils';
import { CodeBlock } from '~/components/ai-elements/code-block';

// ACP protocol Embedded Resource format (from ContentBlock type: "resource")
export type EmbeddedResourceProps = {
  uri: string; // URI identifying the resource
  mimeType?: string; // Optional MIME type
  text?: string; // Text content (for text resources)
  blob?: string; // Base64-encoded binary data (for blob resources)
  className?: string;
};

export const EmbeddedResource = ({
  uri,
  mimeType,
  text,
  blob,
  className,
}: EmbeddedResourceProps) => {
  // Get the filename from the URI
  const filename = uri.split('/').pop() || uri;

  return (
    <div className={cn('rounded-md border bg-muted/50', className)}>
      <div className="flex items-center gap-2 border-b px-3 py-2">
        <div className="text-xs font-medium text-muted-foreground">
          {filename}
        </div>
        {mimeType && (
          <div className="rounded bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground">
            {mimeType}
          </div>
        )}
      </div>
      {(text || blob) && (
        <div className="p-3">
          {text && (
            <CodeBlock
              code={text}
              language={mimeType?.split('/')[1] || 'text'}
            />
          )}
          {blob && mimeType?.startsWith('image/') && (
            <img
              alt={filename}
              className="max-w-full rounded"
              src={`data:${mimeType};base64,${blob}`}
            />
          )}
          {blob && !mimeType?.startsWith('image/') && (
            <div className="text-xs text-muted-foreground">
              Binary data ({blob.length} bytes)
            </div>
          )}
        </div>
      )}
    </div>
  );
};

// ACP protocol Resource Link format (from ContentBlock type: "resource_link")
export type ResourceLinkProps = {
  uri: string; // URI of the resource
  name: string; // Human-readable name
  mimeType?: string; // Optional MIME type
  title?: string; // Optional display title
  description?: string; // Optional description
  size?: number; // Optional size in bytes
  className?: string;
};

export const ResourceLink = ({
  uri,
  name,
  mimeType,
  title,
  description,
  size,
  className,
}: ResourceLinkProps) => {
  const formatSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  return (
    <div
      className={cn(
        'flex items-center gap-3 rounded-md border bg-muted/30 px-3 py-2',
        className
      )}
    >
      <div className="flex-1">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium">{name}</span>
          {mimeType && (
            <span className="rounded bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground">
              {mimeType}
            </span>
          )}
        </div>
        {title && (
          <div className="text-xs text-muted-foreground">{title}</div>
        )}
        {description && (
          <div className="mt-1 text-xs text-muted-foreground">
            {description}
          </div>
        )}
        {size && (
          <div className="mt-1 text-[10px] text-muted-foreground">
            {formatSize(size)}
          </div>
        )}
        {uri && uri !== name && (
          <div className="mt-1 truncate text-[10px] text-muted-foreground">
            {uri}
          </div>
        )}
      </div>
    </div>
  );
};
