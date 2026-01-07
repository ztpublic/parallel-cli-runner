// Message rendering utilities following KISS principle

import { MessageResponse } from "~/components/ai-elements/message";
import {
  Reasoning,
  ReasoningContent,
  ReasoningTrigger,
} from "~/components/ai-elements/reasoning";
import { UIMessagePart, UITool } from "ai";
import {
  ToolHeader,
  Tool,
  ToolContent,
  ToolInput,
  ToolOutput,
} from "~/components/ai-elements/tool";
import { CodeBlock } from "~/components/ai-elements/code-block";
import {
  Plan,
  PlanHeader,
  PlanContent,
  PlanTrigger,
} from "~/components/ai-elements/plan";
import { Image } from "~/components/ai-elements/image";
import { Audio } from "~/components/ai-elements/audio";
import {
  EmbeddedResource,
  ResourceLink,
} from "~/components/ai-elements/resource";
import { DiffViewer } from "~/components/ai-elements/diff-viewer";

// Stub type for ACP tool input (from @mcpc-tech/acp-ai-provider)
interface ProviderAgentDynamicToolInput {
  toolName: string;
  args: Record<string, unknown>;
}

function isToolPart(part: unknown): part is Record<string, unknown> & {
  type: string;
  state: string;
} {
  const p = part as Record<string, unknown>;
  return typeof p.type === "string" && p.type.startsWith("tool-") && "state" in p;
}

export function renderMessagePart(
  part: UIMessagePart<Record<string, unknown>, Record<string, UITool>>,
  messageId: string,
  index: number,
  isStreaming: boolean,
  metadata?: Record<string, unknown>
) {
  // Render plan from message metadata (check first so it appears at the top)
  const plan = metadata?.plan as Array<Record<string, unknown>> | undefined;
  if (plan && index === 0) {
    return (
      <>
        <div key={`${messageId}-plan`} className="w-full mb-4">
          <Plan defaultOpen isStreaming={isStreaming}>
            <PlanHeader className="flex flex-row items-center">
              <>
                <h1 className="text-base">Agent Plan</h1>
                <PlanTrigger className="mb-2" />
              </>
            </PlanHeader>
            <PlanContent>
              <ul className="space-y-2">
                {plan.map((item, i) => {
                  const content =
                    (item.content as string) || JSON.stringify(item);
                  const priority = item.priority as string | undefined;
                  const status = item.status as string | undefined;

                  return (
                    <li
                      key={`plan-${i}`}
                      className="flex items-start justify-between gap-3"
                    >
                      <div className="flex-1">
                        <div
                          className={`text-sm ${status === "done"
                            ? "line-through text-muted-foreground"
                            : "text-foreground"
                            }`}
                        >
                          {content}
                        </div>
                        {priority && (
                          <div className="mt-1 text-xs text-muted-foreground">
                            Priority: {priority}
                          </div>
                        )}
                      </div>
                      <div className="shrink-0 text-xs">
                        <span
                          className={`px-2 py-1 rounded-full font-medium text-[10px] uppercase tracking-wide ${status === "pending"
                            ? "bg-muted text-muted-foreground"
                            : "bg-primary/10 text-primary"
                            }`}
                        >
                          {status ?? "pending"}
                        </span>
                      </div>
                    </li>
                  );
                })}
              </ul>
            </PlanContent>
          </Plan>
        </div>
        {/* Also render the actual part (reasoning/text) */}
        {renderMessagePartContent(part, messageId, index, isStreaming)}
      </>
    );
  }

  return renderMessagePartContent(part, messageId, index, isStreaming, metadata);
}

// Helper function to render the actual message part content
function renderMessagePartContent(
  part: UIMessagePart<Record<string, unknown>, Record<string, UITool>>,
  messageId: string,
  index: number,
  isStreaming: boolean,
  metadata?: Record<string, unknown>
) {
  // Handle rich content from ACP protocol (passed via metadata)
  const richContent = metadata?.richContent as Record<string, unknown> | undefined;
  if (richContent && index === 0) {
    const contentType = richContent.type as string;

    // Render image content (ACP protocol)
    if (contentType === "image") {
      return (
        <div key={`${messageId}-rich`} className="my-2">
          <Image
            data={richContent.data as string}
            mimeType={richContent.mimeType as string}
            uri={richContent.uri as string | undefined}
          />
        </div>
      );
    }

    // Render audio content (ACP protocol)
    if (contentType === "audio") {
      return (
        <div key={`${messageId}-rich`} className="my-2">
          <Audio
            data={richContent.data as string}
            mimeType={richContent.mimeType as string}
          />
        </div>
      );
    }

    // Render embedded resource (ACP protocol)
    if (contentType === "resource") {
      const resource = richContent.resource as Record<string, unknown>;
      return (
        <div key={`${messageId}-rich`} className="my-2">
          <EmbeddedResource
            uri={resource.uri as string}
            mimeType={resource.mimeType as string | undefined}
            text={resource.text as string | undefined}
            blob={resource.blob as string | undefined}
          />
        </div>
      );
    }

    // Render resource link (ACP protocol)
    if (contentType === "resource_link") {
      return (
        <div key={`${messageId}-rich`} className="my-2">
          <ResourceLink
            uri={richContent.uri as string}
            name={richContent.name as string}
            mimeType={richContent.mimeType as string | undefined}
            title={richContent.title as string | undefined}
            description={richContent.description as string | undefined}
            size={richContent.size as number | undefined}
          />
        </div>
      );
    }
  }

  // Render text content
  if (part.type === "text" && part.text) {
    return (
      <MessageResponse key={`${messageId}-${index}`} className="whitespace-pre-wrap">
        {part.text as string}
      </MessageResponse>
    );
  }

  // Render reasoning/thinking process
  if (part.type === "reasoning") {
    return (
      <Reasoning
        key={`${messageId}-${index}`}
        className="w-full"
        isStreaming={isStreaming}
      >
        <ReasoningTrigger />
        <ReasoningContent>{part.text}</ReasoningContent>
      </Reasoning>
    );
  }

  // Handle tool calls with type starting with "tool-"
  if (isToolPart(part)) {
    const normalizeToolName = (rawName: string) => {
      let name = rawName;

      // Some providers include prefixes/namespaces that we don't want to show in UI.
      name = name.replace(/^tool-/, "");
      name = name.replace(/^mcp__/, "");

      // Strip ACP AI SDK tools branding across common separators.
      // Examples:
      // - mcp__acp_ai_sdk_tools__show_alert
      // - acp-ai-sdk-tools/show_alert
      name = name.replace(/(^|__|\/)(acp[-_]?ai[-_]?sdk[-_]?tools)(?=__|\/|$)/g, "$1");

      // Normalize repeated separators.
      name = name.replace(/^__+/, "").replace(/__+$/, "");
      name = name.replace(/__{3,}/g, "__");

      return name || rawName;
    };

    // Extract enriched tool data (with _kind, _locations, _content from ACP transport)
    const toolInput = part.input as ProviderAgentDynamicToolInput | undefined;

    // Guard clause: skip rendering if input or toolName is missing
    if (!toolInput || !toolInput.toolName) {
      return null;
    }

    const normalizedToolName = normalizeToolName(toolInput.toolName);
    const toolType = `tool-${normalizedToolName}` as `tool-${string}`;
    const toolState = part.state as
      | "input-streaming"
      | "input-available"
      | "output-available"
      | "output-error";
    const hasOutput = toolState === "output-available" || toolState === "output-error";

    // Extract ACP-specific metadata from enriched input
    const args = toolInput.args as Record<string, unknown> | undefined;
    const toolKind = args?._kind as string | undefined;
    const toolLocations = args?._locations as Array<{ path: string; line?: number }> | undefined;
    const toolContent = args?._content as Array<Record<string, unknown>> | undefined;

    // Extract output data and check for enriched format
    let outputData = part.output;
    let outputContent = toolContent;
    let outputLocations = toolLocations;

    // Handle enriched output format from ACP transport
    if (outputData && typeof outputData === "object" && "_rawOutput" in outputData) {
      const enriched = outputData as Record<string, unknown>;
      outputData = enriched._rawOutput;
      outputContent = Array.isArray(enriched._content)
        ? (enriched._content as Array<Record<string, unknown>>)
        : undefined;
      outputLocations = Array.isArray(enriched._locations)
        ? (enriched._locations as Array<{ path: string; line?: number }>)
        : undefined;
    }

    // Truncate tool title if too long
    const maxTitleLength = 20;
    const displayTitle =
      normalizedToolName.length > maxTitleLength
        ? `${normalizedToolName.slice(0, maxTitleLength)}...`
        : normalizedToolName;

    // Render tool output content (handle structured content types)
    const renderToolOutput = () => {
      // If we have structured content, render it
      if (outputContent && outputContent.length > 0) {
        return (
          <div className="space-y-2">
            {outputContent.map((contentItem, i) => {
              const contentType = contentItem.type as string;

              // Handle diff content
              if (contentType === "diff") {
                return (
                  <DiffViewer
                    key={`diff-${i}`}
                    path={contentItem.path as string}
                    oldText={contentItem.oldText as string | undefined}
                    newText={contentItem.newText as string}
                  />
                );
              }

              // Handle terminal content
              if (contentType === "terminal") {
                return (
                  <div key={`terminal-${i}`} className="rounded-md border bg-muted/50 p-3">
                    <div className="text-xs text-muted-foreground">
                      Terminal: {contentItem.terminalId as string}
                    </div>
                  </div>
                );
              }

              // Handle regular content blocks
              if (contentType === "content") {
                const nestedContent = contentItem.content as Record<string, unknown>;
                const nestedType = nestedContent.type as string;

                if (nestedType === "text") {
                  return (
                    <div key={`content-${i}`} className="text-sm">
                      {nestedContent.text as string}
                    </div>
                  );
                }
              }

              // Default: render as JSON
              return (
                <CodeBlock
                  key={`content-${i}`}
                  code={JSON.stringify(contentItem, null, 2)}
                  language="json"
                />
              );
            })}
          </div>
        );
      }

      // Fall back to rendering raw output as JSON
      if (outputData) {
        return <CodeBlock code={JSON.stringify(outputData, null, 2)} language="json" />;
      }

      return null;
    };

    return (
      <Tool key={`${messageId}-${index}`} defaultOpen={hasOutput}>
        <ToolHeader
          title={displayTitle}
          type={toolType}
          state={toolState}
          kind={toolKind}
        />
        <ToolContent>
          {part.input !== undefined && (
            <ToolInput input={toolInput.args} />
          )}
          {hasOutput && (
            <ToolOutput
              output={renderToolOutput()}
              errorText={part.errorText as string | undefined}
            />
          )}
          {/* Display locations if available */}
          {outputLocations && outputLocations.length > 0 && (
            <div className="px-4 pb-2">
              <div className="text-xs text-muted-foreground">
                {outputLocations.map((loc, i) => (
                  <span key={i} className="mr-2">
                    {loc.path}
                    {loc.line !== undefined && `:${loc.line}`}
                  </span>
                ))}
              </div>
            </div>
          )}
        </ToolContent>
      </Tool>
    );
  }

  return null;
}
