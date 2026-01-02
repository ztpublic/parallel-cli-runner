import type { SVGProps, ReactNode } from "react";

export type IconName =
  | "alert"
  | "archive"
  | "bell"
  | "bolt"
  | "branch"
  | "check"
  | "chevronDown"
  | "chevronRight"
  | "close"
  | "cloud"
  | "commit"
  | "ellipsis"
  | "externalLink"
  | "fileAdd"
  | "fileEdit"
  | "fileRemove"
  | "folder"
  | "menu"
  | "merge"
  | "minus"
  | "play"
  | "plus"
  | "pull"
  | "refresh"
  | "settings"
  | "sparkle"
  | "split"
  | "terminal"
  | "trash"
  | "undo";

type IconProps = SVGProps<SVGSVGElement> & {
  name: IconName;
  size?: number;
};

const iconPaths: Record<IconName, ReactNode> = {
  alert: (
    <>
      <path d="M10.3 4.9 3.3 17a1.5 1.5 0 0 0 1.3 2.3h14.8a1.5 1.5 0 0 0 1.3-2.3l-7-12.1a1.5 1.5 0 0 0-2.6 0z" />
      <line x1="12" y1="9" x2="12" y2="13" />
      <circle cx="12" cy="17" r="1" />
    </>
  ),
  archive: (
    <>
      <rect x="3" y="4" width="18" height="7" rx="1" />
      <path d="M5 11v8a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-8" />
      <line x1="10" y1="15" x2="14" y2="15" />
    </>
  ),
  bell: (
    <>
      <path d="M18 8a6 6 0 1 0-12 0c0 7-3 8-3 8h18s-3-1-3-8" />
      <path d="M13.7 21a2 2 0 0 1-3.4 0" />
    </>
  ),
  bolt: (
    <polyline points="13 2 3 14 11 14 11 22 21 10 13 10 13 2" />
  ),
  branch: (
    <>
      <circle cx="6" cy="6" r="3" />
      <circle cx="6" cy="18" r="3" />
      <circle cx="18" cy="6" r="3" />
      <path d="M6 9v6" />
      <path d="M9 6h6" />
    </>
  ),
  check: <polyline points="5 13 9 17 19 7" />,
  chevronDown: <polyline points="6 9 12 15 18 9" />,
  chevronRight: <polyline points="9 6 15 12 9 18" />,
  close: (
    <>
      <line x1="5" y1="5" x2="19" y2="19" />
      <line x1="19" y1="5" x2="5" y2="19" />
    </>
  ),
  cloud: (
    <path d="M20 17.5a4.5 4.5 0 0 0-1.5-8.7A6 6 0 0 0 6 9.5a4 4 0 0 0 0 8h14z" />
  ),
  commit: (
    <>
      <line x1="3" y1="12" x2="21" y2="12" />
      <circle cx="12" cy="12" r="3" />
    </>
  ),
  ellipsis: (
    <>
      <circle cx="6" cy="12" r="1.5" />
      <circle cx="12" cy="12" r="1.5" />
      <circle cx="18" cy="12" r="1.5" />
    </>
  ),
  externalLink: (
    <>
      <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
      <polyline points="15 3 21 3 21 9" />
      <line x1="10" y1="14" x2="21" y2="3" />
    </>
  ),
  fileAdd: (
    <>
      <path d="M14 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z" />
      <polyline points="14 3 14 9 20 9" />
      <line x1="12" y1="13" x2="12" y2="17" />
      <line x1="10" y1="15" x2="14" y2="15" />
    </>
  ),
  fileEdit: (
    <>
      <path d="M14 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z" />
      <polyline points="14 3 14 9 20 9" />
      <path d="M10 14l4-4 2 2-4 4H10z" />
    </>
  ),
  fileRemove: (
    <>
      <path d="M14 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z" />
      <polyline points="14 3 14 9 20 9" />
      <line x1="10" y1="15" x2="14" y2="15" />
    </>
  ),
  folder: (
    <path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
  ),
  menu: (
    <>
      <line x1="3" y1="6" x2="21" y2="6" />
      <line x1="3" y1="12" x2="21" y2="12" />
      <line x1="3" y1="18" x2="21" y2="18" />
    </>
  ),
  merge: (
    <>
      <circle cx="6" cy="6" r="3" />
      <circle cx="6" cy="18" r="3" />
      <path d="M6 9v6" />
      <path d="M9 6h6a3 3 0 0 1 3 3v3" />
      <circle cx="18" cy="12" r="3" />
    </>
  ),
  minus: <line x1="5" y1="12" x2="19" y2="12" />,
  play: <polygon points="7 5 19 12 7 19 7 5" fill="currentColor" stroke="none" />,
  plus: (
    <>
      <line x1="12" y1="5" x2="12" y2="19" />
      <line x1="5" y1="12" x2="19" y2="12" />
    </>
  ),
  pull: (
    <>
      <line x1="5" y1="12" x2="19" y2="12" />
      <polyline points="13 6 19 12 13 18" />
    </>
  ),
  refresh: (
    <>
      <path d="M21 12a9 9 0 0 1-15.5 6.5" />
      <polyline points="3 17 5.5 17 5.5 14.5" />
      <path d="M3 12a9 9 0 0 1 15.5-6.5" />
      <polyline points="21 7 18.5 7 18.5 9.5" />
    </>
  ),
  settings: (
    <>
      <circle cx="12" cy="12" r="3" />
      <line x1="12" y1="2" x2="12" y2="5" />
      <line x1="12" y1="19" x2="12" y2="22" />
      <line x1="2" y1="12" x2="5" y2="12" />
      <line x1="19" y1="12" x2="22" y2="12" />
      <line x1="4.6" y1="4.6" x2="6.8" y2="6.8" />
      <line x1="17.2" y1="17.2" x2="19.4" y2="19.4" />
      <line x1="17.2" y1="6.8" x2="19.4" y2="4.6" />
      <line x1="4.6" y1="19.4" x2="6.8" y2="17.2" />
    </>
  ),
  sparkle: (
    <>
      <path d="M12 3l1.6 4.4L18 9l-4.4 1.6L12 15l-1.6-4.4L6 9l4.4-1.6L12 3z" />
      <path d="M5 15l0.8 2.2L8 18l-2.2 0.8L5 21l-0.8-2.2L2 18l2.2-0.8L5 15z" />
    </>
  ),
  split: (
    <>
      <rect x="3" y="5" width="18" height="14" rx="2" />
      <line x1="3" y1="12" x2="21" y2="12" />
    </>
  ),
  terminal: (
    <>
      <rect x="3" y="5" width="18" height="14" rx="2" />
      <polyline points="7 10 10 12 7 14" />
      <line x1="12" y1="14" x2="17" y2="14" />
    </>
  ),
  trash: (
    <>
      <polyline points="3 6 5 6 21 6" />
      <path d="M8 6v12a2 2 0 0 0 2 2h4a2 2 0 0 0 2-2V6" />
      <path d="M10 11v6" />
      <path d="M14 11v6" />
      <path d="M9 6l1-3h4l1 3" />
    </>
  ),
  undo: (
    <>
      <path d="M9 7H5v4" />
      <path d="M5 11l4-4" />
      <path d="M5 11h9a5 5 0 0 1 0 10h-3" />
    </>
  ),
};

export function Icon({ name, size = 16, className, ...props }: IconProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      width={size}
      height={size}
      className={className}
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
      {...props}
    >
      {iconPaths[name]}
    </svg>
  );
}
