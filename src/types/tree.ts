import type { ReactNode } from "react";
import type { IconName } from "../components/Icons";

export type TreeSelectionMode = "none" | "single" | "multiple";

export type TreeNodeAction = {
  id: string;
  icon: IconName;
  label?: string;
  disabled?: boolean;
  intent?: "default" | "danger";
};

export type TreeNodeContextMenuItem =
  | {
      id: string;
      label: string;
      icon?: IconName;
      disabled?: boolean;
      type?: "item";
    }
  | {
      id: string;
      label: string;
      type: "separator";
    }
  | {
      id: string;
      label: string;
      selected?: boolean;
      disabled?: boolean;
      type: "radio";
    };

export type TreeNode = {
  id: string;
  label: string;
  description?: string;
  icon?: IconName;
  iconClassName?: string;
  children?: TreeNode[];
  actions?: TreeNodeAction[];
  contextMenu?: TreeNodeContextMenuItem[];
  selectable?: boolean;
  checkable?: boolean;
  defaultExpanded?: boolean;
  rightSlot?: ReactNode;
  variant?: "default" | "load-more";
  isLoading?: boolean;
};
