import { cn } from '~/lib/utils';
import type { Experimental_GeneratedImage } from 'ai';

// AI SDK Image format (from Experimental_GeneratedImage)
export type AiSdkImageProps = Experimental_GeneratedImage & {
  className?: string;
  alt?: string;
};

// ACP protocol Image format (from ContentBlock type: "image")
export type AcpImageProps = {
  data: string; // Base64-encoded image data
  mimeType: string; // MIME type (e.g., "image/png", "image/jpeg")
  uri?: string; // Optional URI reference
  className?: string;
  alt?: string;
};

export type ImageProps = AiSdkImageProps | AcpImageProps;

// Helper function to determine if props are ACP format
function isAcpImageProps(props: ImageProps): props is AcpImageProps {
  return 'data' in props && 'mimeType' in props;
}

export const Image = (props: ImageProps) => {
  const { className, alt } = props;

  // Handle ACP format
  if (isAcpImageProps(props)) {
    const { data, mimeType, uri } = props;
    const src = uri || `data:${mimeType};base64,${data}`;
    return (
      <img
        alt={alt}
        className={cn('h-auto max-w-full overflow-hidden rounded-md', className)}
        src={src}
      />
    );
  }

  // Handle AI SDK format (Experimental_GeneratedImage)
  const { base64, mediaType, uint8Array } = props as AiSdkImageProps;
  let src: string;
  if (uint8Array) {
    const blob = new Blob([uint8Array], { type: mediaType });
    src = URL.createObjectURL(blob);
  } else {
    src = `data:${mediaType};base64,${base64}`;
  }

  return (
    <img
      alt={alt}
      className={cn('h-auto max-w-full overflow-hidden rounded-md', className)}
      src={src}
    />
  );
};
