// AI Elements - Exports for ACP protocol components

// Audio component
export { Audio } from './audio';

// Image component
export { Image, type AiSdkImageProps, type AcpImageProps, type ImageProps } from './image';

// Resource components
export {
  EmbeddedResource,
  ResourceLink,
  type EmbeddedResourceProps,
  type ResourceLinkProps,
} from './resource';

// Diff viewer component
export { DiffViewer, type DiffViewerProps } from './diff-viewer';

// Tool component with kind support
export {
  Tool,
  ToolHeader,
  ToolContent,
  ToolInput,
  ToolOutput,
  type ToolProps,
  type ToolHeaderProps,
  type ToolContentProps,
  type ToolInputProps,
  type ToolOutputProps,
  type ToolKind,
} from './tool';
