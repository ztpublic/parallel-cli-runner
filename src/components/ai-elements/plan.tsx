import * as React from "react";
import { cn } from "~/lib/utils";

// Root Plan component
interface PlanProps extends React.HTMLAttributes<HTMLDivElement> {
  defaultOpen?: boolean;
  isStreaming?: boolean;
  children: React.ReactNode;
}

export function Plan({ defaultOpen = true, isStreaming = false, children, className, ...props }: PlanProps) {
  return (
    <div className={cn("border rounded-lg bg-muted/50", className)} {...props}>
      {children}
    </div>
  );
}

// PlanHeader component
interface PlanHeaderProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode;
}

export function PlanHeader({ children, className, ...props }: PlanHeaderProps) {
  return (
    <div className={cn("flex items-center justify-between p-3 border-b", className)} {...props}>
      {children}
    </div>
  );
}

// PlanContent component
interface PlanContentProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode;
}

export function PlanContent({ children, className, ...props }: PlanContentProps) {
  return (
    <div className={cn("p-3", className)} {...props}>
      {children}
    </div>
  );
}

// PlanTrigger component
interface PlanTriggerProps extends React.HTMLAttributes<HTMLButtonElement> {
  isOpen?: boolean;
  onToggle?: () => void;
}

export function PlanTrigger({ isOpen = true, onToggle, className, ...props }: PlanTriggerProps) {
  return (
    <button
      type="button"
      onClick={onToggle}
      className={cn(
        "p-1 rounded hover:bg-muted transition-colors",
        "text-muted-foreground hover:text-foreground",
        className
      )}
      {...props}
    >
      <svg
        width="16"
        height="16"
        viewBox="0 0 16 16"
        fill="currentColor"
        className={cn("transition-transform", isOpen && "rotate-180")}
      >
        <path d="M4 6l4 4 4-4H4z" />
      </svg>
    </button>
  );
}
