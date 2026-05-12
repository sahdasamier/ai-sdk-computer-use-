import { UIMessage } from "ai";
import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export const ABORTED = "User aborted";

export const prunedMessages = (messages: UIMessage[]): UIMessage[] => {
  if (messages.at(-1)?.role === "assistant") {
    return messages;
  }

  // Return a new array with non-mutating map to avoid React state issues.
  return messages.map((message) => ({
    ...message,
    parts: message.parts.map((part) => {
      if (
        part.type === "tool-invocation" &&
        part.toolInvocation.toolName === "computer" &&
        (part.toolInvocation.args as Record<string, unknown>).action === "screenshot" &&
        part.toolInvocation.state === "result"
      ) {
        // Redact screenshot image data from conversation history to save tokens.
        return {
          ...part,
          toolInvocation: {
            ...part.toolInvocation,
            result: "Screenshot captured (image redacted to save tokens)",
          },
        };
      }
      return part;
    }),
  }));
};
