"use client";

import type { Message } from "ai";
import { AnimatePresence, motion } from "motion/react";
import { memo } from "react";
import equal from "fast-deep-equal";
import { Streamdown } from "streamdown";

import { ABORTED, cn } from "@/lib/utils";
import {
  Camera,
  CheckCircle,
  CircleSlash,
  Clock,
  Keyboard,
  KeyRound,
  Loader2,
  MousePointer,
  MousePointerClick,
  ScrollText,
  StopCircle,
} from "lucide-react";

/** Extract the base64 image string from a computer-tool screenshot result.
 *  Handles both the array format `[{ type:"image", image:"…" }]`
 *  and the legacy object format `{ type:"image", data:"…" }`.
 */
function extractScreenshotBase64(result: unknown): string | null {
  if (Array.isArray(result)) {
    const part = result.find(
      (p): p is Record<string, unknown> =>
        typeof p === "object" && p !== null && (p as Record<string, unknown>).type === "image",
    );
    if (!part) return null;
    const b64 = part.image ?? part.data;
    return typeof b64 === "string" ? b64 : null;
  }
  if (typeof result === "object" && result !== null) {
    const r = result as Record<string, unknown>;
    if (r.type === "image") {
      const b64 = r.image ?? r.data;
      return typeof b64 === "string" ? b64 : null;
    }
  }
  return null;
}

const PurePreviewMessage = ({
  message,
  isLatestMessage,
  status,
  onToolInvocationClick,
}: {
  message: Message;
  status: "error" | "submitted" | "streaming" | "ready";
  isLatestMessage: boolean;
  onToolInvocationClick?: (id: string) => void;
}) => {
  return (
    <AnimatePresence key={message.id}>
      <motion.div
        className="w-full mx-auto px-4 group/message"
        initial={{ y: 5, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        key={`message-${message.id}`}
        data-role={message.role}
      >
        <div
          className={cn(
            "flex gap-4 w-full group-data-[role=user]/message:ml-auto group-data-[role=user]/message:max-w-2xl",
            "group-data-[role=user]/message:w-fit",
          )}
        >
          <div className="flex flex-col w-full min-w-0">
            {message.parts?.map((part, i) => {
              switch (part.type) {
                case "text":
                  return (
                    <motion.div
                      initial={{ y: 5, opacity: 0 }}
                      animate={{ y: 0, opacity: 1 }}
                      key={`message-${message.id}-part-${i}`}
                      className="flex flex-row gap-2 items-start w-full pb-4"
                    >
                      <div
                        className={cn("flex flex-col gap-4 min-w-0", {
                          "bg-secondary text-secondary-foreground px-3 py-2 rounded-xl":
                            message.role === "user",
                        })}
                      >
                        <Streamdown>{part.text}</Streamdown>
                      </div>
                    </motion.div>
                  );

                case "tool-invocation": {
                  const { toolName, toolCallId, state, args } = part.toolInvocation;
                  const toolEventId = toolCallId;
                  const clickable = !!(toolEventId && onToolInvocationClick);

                  if (toolName === "computer") {
                    const { action, coordinate, text, duration, scroll_amount, scroll_direction } = args;

                    let actionLabel = "";
                    let actionDetail = "";
                    let ActionIcon: typeof Camera | null = null;

                    switch (action) {
                      case "screenshot":
                        actionLabel = "Taking screenshot";
                        ActionIcon = Camera;
                        break;
                      case "left_click":
                        actionLabel = "Left clicking";
                        actionDetail = coordinate ? `at (${coordinate[0]}, ${coordinate[1]})` : "";
                        ActionIcon = MousePointer;
                        break;
                      case "right_click":
                        actionLabel = "Right clicking";
                        actionDetail = coordinate ? `at (${coordinate[0]}, ${coordinate[1]})` : "";
                        ActionIcon = MousePointerClick;
                        break;
                      case "double_click":
                        actionLabel = "Double clicking";
                        actionDetail = coordinate ? `at (${coordinate[0]}, ${coordinate[1]})` : "";
                        ActionIcon = MousePointerClick;
                        break;
                      case "mouse_move":
                        actionLabel = "Moving mouse";
                        actionDetail = coordinate ? `to (${coordinate[0]}, ${coordinate[1]})` : "";
                        ActionIcon = MousePointer;
                        break;
                      case "type":
                        actionLabel = "Typing";
                        actionDetail = text ? `"${text}"` : "";
                        ActionIcon = Keyboard;
                        break;
                      case "key":
                        actionLabel = "Pressing key";
                        actionDetail = text ? `"${text}"` : "";
                        ActionIcon = KeyRound;
                        break;
                      case "wait":
                        actionLabel = "Waiting";
                        actionDetail = duration ? `${duration} seconds` : "";
                        ActionIcon = Clock;
                        break;
                      case "scroll":
                        actionLabel = "Scrolling";
                        actionDetail =
                          scroll_direction && scroll_amount
                            ? `${scroll_direction} by ${scroll_amount}`
                            : "";
                        ActionIcon = ScrollText;
                        break;
                      default:
                        actionLabel = action;
                        ActionIcon = MousePointer;
                    }

                    const screenshotB64 =
                      state === "result"
                        ? extractScreenshotBase64(part.toolInvocation.result)
                        : null;

                    return (
                      <motion.div
                        initial={{ y: 5, opacity: 0 }}
                        animate={{ y: 0, opacity: 1 }}
                        key={`message-${message.id}-part-${i}`}
                        className={cn(
                          "flex flex-col gap-2 p-2 mb-3 text-sm bg-zinc-50 dark:bg-zinc-900 rounded-md border border-zinc-200 dark:border-zinc-800",
                          clickable && "cursor-pointer hover:border-zinc-400 dark:hover:border-zinc-600",
                        )}
                        onClick={() => {
                          if (clickable) onToolInvocationClick(toolEventId);
                        }}
                      >
                        <div className="flex-1 flex items-center justify-center">
                          <div className="flex items-center justify-center w-8 h-8 bg-zinc-50 dark:bg-zinc-800 rounded-full shrink-0">
                            {ActionIcon && <ActionIcon className="w-4 h-4" />}
                          </div>
                          <div className="flex-1 min-w-0 px-2">
                            <div className="font-medium font-mono flex items-baseline gap-2 flex-wrap">
                              {actionLabel}
                              {actionDetail && (
                                <span className="text-xs text-zinc-500 dark:text-zinc-400 font-normal truncate">
                                  {actionDetail}
                                </span>
                              )}
                            </div>
                          </div>
                          <div className="w-5 h-5 flex items-center justify-center shrink-0">
                            {state === "call" ? (
                              isLatestMessage && status !== "ready" ? (
                                <Loader2 className="animate-spin h-4 w-4 text-zinc-500" />
                              ) : (
                                <StopCircle className="h-4 w-4 text-red-500" />
                              )
                            ) : state === "result" ? (
                              part.toolInvocation.result === ABORTED ? (
                                <CircleSlash className="h-3.5 w-3.5 text-amber-600" />
                              ) : (
                                <CheckCircle className="h-3.5 w-3.5 text-green-600" />
                              )
                            ) : null}
                          </div>
                        </div>

                        {screenshotB64 ? (
                          <div className="p-2">
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img
                              src={`data:image/png;base64,${screenshotB64}`}
                              alt="Screenshot"
                              className="w-full aspect-[1024/768] rounded-sm"
                            />
                          </div>
                        ) : action === "screenshot" && state !== "result" ? (
                          <div className="w-full aspect-[1024/768] rounded-sm bg-zinc-200 dark:bg-zinc-800 animate-pulse" />
                        ) : null}
                      </motion.div>
                    );
                  }

                  if (toolName === "bash") {
                    const { command } = args;
                    return (
                      <motion.div
                        initial={{ y: 5, opacity: 0 }}
                        animate={{ y: 0, opacity: 1 }}
                        key={`message-${message.id}-part-${i}`}
                        className={cn(
                          "flex items-center gap-2 p-2 mb-3 text-sm bg-zinc-50 dark:bg-zinc-900 rounded-md border border-zinc-200 dark:border-zinc-800",
                          clickable && "cursor-pointer hover:border-zinc-400 dark:hover:border-zinc-600",
                        )}
                        onClick={() => {
                          if (clickable) onToolInvocationClick(toolEventId);
                        }}
                      >
                        <div className="flex items-center justify-center w-8 h-8 bg-zinc-50 dark:bg-zinc-800 rounded-full shrink-0">
                          <ScrollText className="w-4 h-4" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="font-medium flex items-baseline gap-2 flex-wrap">
                            Running command
                            <span className="text-xs text-zinc-500 dark:text-zinc-400 font-normal truncate">
                              {command.slice(0, 40)}{command.length > 40 ? "…" : ""}
                            </span>
                          </div>
                        </div>
                        <div className="w-5 h-5 flex items-center justify-center shrink-0">
                          {state === "call" ? (
                            isLatestMessage && status !== "ready" ? (
                              <Loader2 className="animate-spin h-4 w-4 text-zinc-500" />
                            ) : (
                              <StopCircle className="h-4 w-4 text-red-500" />
                            )
                          ) : state === "result" ? (
                            <CheckCircle className="h-3.5 w-3.5 text-green-600" />
                          ) : null}
                        </div>
                      </motion.div>
                    );
                  }

                  // Unknown tool — safe fallback
                  return (
                    <div
                      key={toolCallId}
                      className="mb-3 rounded-md border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900 p-2 text-xs"
                    >
                      <p className="font-mono font-medium text-zinc-600 dark:text-zinc-400 mb-1">
                        {toolName}: {state}
                      </p>
                      <pre className="overflow-x-auto text-zinc-500 dark:text-zinc-500 whitespace-pre-wrap break-words">
                        {JSON.stringify(args, null, 2)}
                      </pre>
                    </div>
                  );
                }

                default:
                  return null;
              }
            })}
          </div>
        </div>
      </motion.div>
    </AnimatePresence>
  );
};

export const PreviewMessage = memo(
  PurePreviewMessage,
  (prevProps, nextProps) => {
    if (prevProps.status !== nextProps.status) return false;
    if (prevProps.message.annotations !== nextProps.message.annotations) return false;
    if (!equal(prevProps.message.parts, nextProps.message.parts)) return false;
    return true;
  },
);
