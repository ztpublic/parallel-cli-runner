import { cn } from '~/lib/utils';

// ACP protocol Audio format (from ContentBlock type: "audio")
export type AudioProps = {
  data: string; // Base64-encoded audio data
  mimeType: string; // MIME type (e.g., "audio/wav", "audio/mp3")
  className?: string;
};

export const Audio = ({ data, mimeType, className }: AudioProps) => {
  const src = `data:${mimeType};base64,${data}`;

  return (
    <audio
      controls
      className={cn('h-auto max-w-full', className)}
      src={src}
    >
      Your browser does not support the audio element.
    </audio>
  );
};
