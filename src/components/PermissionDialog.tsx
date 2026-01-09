import React from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "~/components/ui/dialog";
import { Button } from "~/components/ui/button";
import type { AcpPermissionRequestEvent } from "~/platform/acp-transport";

interface PermissionDialogProps {
  open: boolean;
  request: AcpPermissionRequestEvent | null;
  onSelect: (optionId: string) => void;
  onCancel: () => void;
}

function getToolTitle(request: AcpPermissionRequestEvent | null): string {
  if (!request?.request.toolCall) {
    return "Permission required";
  }
  const title = request.request.toolCall.title;
  if (typeof title === "string" && title.trim()) {
    return title;
  }
  return "Permission required";
}

function getOptionVariant(kind?: string): "default" | "destructive" | "outline" {
  if (kind === "reject_once" || kind === "reject_always") {
    return "destructive";
  }
  if (kind === "allow_once" || kind === "allow_always") {
    return "default";
  }
  return "outline";
}

export const PermissionDialog: React.FC<PermissionDialogProps> = ({
  open,
  request,
  onSelect,
  onCancel,
}) => {
  const options = request?.request.options ?? [];
  const title = getToolTitle(request);

  return (
    <Dialog open={open} onOpenChange={(nextOpen) => (!nextOpen ? onCancel() : undefined)}>
      <DialogContent className="dark-theme sm:max-w-[520px]">
        <DialogHeader className="space-y-2">
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription className="text-sm text-muted-foreground">
            The agent requested permission to continue. Choose how to proceed.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-2 py-4">
          {options.map((option) => (
            <Button
              key={option.optionId}
              type="button"
              variant={getOptionVariant(option.kind)}
              className="justify-start"
              onClick={() => onSelect(option.optionId)}
            >
              {option.name}
            </Button>
          ))}
          {options.length === 0 && (
            <div className="text-sm text-muted-foreground">
              No options provided by agent.
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onCancel}>
            Cancel
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
