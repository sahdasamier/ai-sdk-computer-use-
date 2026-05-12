"use client";

import { useEffect, useRef } from "react";
import type { Message } from "ai";
import type { AgentEvent } from "@/types/events";
import { useAgentStore } from "@/store/useAgentStore";

interface ToolInvocationLike {
  toolCallId: string;
  toolName: string;
  state: "call" | "result";
  args: unknown;
  result?: unknown;
}

interface ToolInvocationPartLike {
  type: "tool-invocation";
  toolInvocation: ToolInvocationLike;
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null;

const getString = (value: unknown): string | undefined =>
  typeof value === "string" ? value : undefined;

const getNumber = (value: unknown): number | undefined =>
  typeof value === "number" ? value : undefined;

const getCoordinate = (value: unknown): [number, number] | undefined => {
  if (!Array.isArray(value) || value.length < 2) return undefined;
  const x = getNumber(value[0]);
  const y = getNumber(value[1]);
  if (x === undefined || y === undefined) return undefined;
  return [x, y];
};

const isToolInvocationPartLike = (
  part: unknown,
): part is ToolInvocationPartLike => {
  if (!isRecord(part) || part.type !== "tool-invocation") return false;
  if (!isRecord(part.toolInvocation)) return false;

  const invocation = part.toolInvocation;
  return (
    typeof invocation.toolCallId === "string" &&
    typeof invocation.toolName === "string" &&
    (invocation.state === "call" || invocation.state === "result")
  );
};

const isToolInvocationLike = (
  invocation: unknown,
): invocation is ToolInvocationLike => {
  if (!isRecord(invocation)) return false;
  return (
    typeof invocation.toolCallId === "string" &&
    typeof invocation.toolName === "string" &&
    (invocation.state === "call" || invocation.state === "result")
  );
};

const getMessageToolInvocations = (message: Message): ToolInvocationLike[] => {
  const invocations: ToolInvocationLike[] = [];

  for (const invocation of message.toolInvocations ?? []) {
    if (!isToolInvocationLike(invocation)) continue;
    invocations.push(invocation);
  }

  if (invocations.length > 0) return invocations;

  // Fallback for older message shapes where tool invocations are only in parts.
  for (const part of message.parts ?? []) {
    if (!isToolInvocationPartLike(part)) continue;
    invocations.push(part.toolInvocation);
  }

  return invocations;
};

const isInvocationError = (result: unknown): boolean => {
  if (result === "User aborted") return true;
  if (!isRecord(result)) return false;

  if (result.isError === true) return true;
  if (typeof result.error === "string" && result.error.length > 0) return true;
  if (typeof result.stderr === "string" && result.stderr.length > 0) return true;

  return false;
};

const mapInvocationToEvent = (
  invocation: ToolInvocationLike,
  timestamp: number,
): AgentEvent | null => {
  const status = invocation.state === "call"
    ? "pending"
    : isInvocationError(invocation.result)
      ? "error"
      : "complete";

  if (invocation.toolName === "bash") {
    const args = isRecord(invocation.args) ? invocation.args : {};
    const command = getString(args.command) ?? "unknown";
    const result = isRecord(invocation.result) ? invocation.result : {};

    return {
      id: invocation.toolCallId,
      timestamp,
      type: "bash",
      status,
      command,
      output: getString(result.stdout) ?? getString(result.output),
      exitCode: getNumber(result.exitCode) ?? getNumber(result.code),
    };
  }

  if (invocation.toolName !== "computer") {
    if (invocation.toolName === "str_replace_editor") {
      return {
        id: invocation.toolCallId,
        timestamp,
        type: "browser_action",
        status,
        action: "other",
        detail: "str_replace_editor",
      };
    }
    return null;
  }

  const args = isRecord(invocation.args) ? invocation.args : null;
  const action = args ? getString(args.action) : undefined;
  if (!args || !action) return null;

  const coordinate = getCoordinate(args.coordinate);
  const text = getString(args.text) ?? "";
  const result = isRecord(invocation.result) ? invocation.result : {};

  switch (action) {
    case "screenshot": {
      const imageData = getString(result.data);
      return {
        id: invocation.toolCallId,
        timestamp,
        type: "screenshot",
        status,
        imageUrl: imageData ? `data:image/png;base64,${imageData}` : "",
        width: 1024,
        height: 768,
      };
    }
    case "click":
    case "left_click":
    case "right_click":
    case "double_click":
      return {
        id: invocation.toolCallId,
        timestamp,
        type: "click",
        status,
        target: action,
        x: coordinate?.[0] ?? 0,
        y: coordinate?.[1] ?? 0,
      };
    case "type":
      return {
        id: invocation.toolCallId,
        timestamp,
        type: "type",
        status,
        target: "active-element",
        value: text,
      };
    case "scroll":
      return {
        id: invocation.toolCallId,
        timestamp,
        type: "browser_action",
        status,
        action: "scroll",
        detail: "computer:scroll",
      };
    case "navigate":
      return {
        id: invocation.toolCallId,
        timestamp,
        type: "browser_action",
        status,
        action: "navigate",
        url: getString(args.url),
      };
    case "back":
      return {
        id: invocation.toolCallId,
        timestamp,
        type: "browser_action",
        status,
        action: "back",
      };
    case "forward":
      return {
        id: invocation.toolCallId,
        timestamp,
        type: "browser_action",
        status,
        action: "forward",
      };
    case "reload":
      return {
        id: invocation.toolCallId,
        timestamp,
        type: "browser_action",
        status,
        action: "reload",
      };
    default:
      return {
        id: invocation.toolCallId,
        timestamp,
        type: "browser_action",
        status,
        action: "other",
        detail: `computer:${action}`,
      };
  }
};

const getEventUpdates = (event: AgentEvent, duration: number): Partial<AgentEvent> => {
  switch (event.type) {
    case "bash":
      return {
        status: event.status,
        duration,
        output: event.output,
        exitCode: event.exitCode,
      };
    case "screenshot":
      return {
        status: event.status,
        duration,
        imageUrl: event.imageUrl,
        width: event.width,
        height: event.height,
      };
    case "click":
      return {
        status: event.status,
        duration,
        target: event.target,
        x: event.x,
        y: event.y,
      };
    case "type":
      return {
        status: event.status,
        duration,
        target: event.target,
        value: event.value,
      };
    case "browser_action":
      return {
        status: event.status,
        duration,
        action: event.action,
        url: event.url,
        detail: event.detail,
      };
  }

  return { duration };
};

export const useEventPipeline = (
  messages: Message[],
  activeSessionId: string | null,
) => {
  const processedToolCalls = useRef<Set<string>>(new Set());

  useEffect(() => {
    processedToolCalls.current.clear();
  }, [activeSessionId]);

  useEffect(() => {
    if (!activeSessionId) return;

    const { sessions, addEvent, updateEvent } = useAgentStore.getState();
    const session = sessions.find((item) => item.id === activeSessionId);
    if (!session) return;
    const eventIndex = new Map(session.events.map((event) => [event.id, event]));

    for (const message of messages) {
      const invocations = getMessageToolInvocations(message);
      for (const invocation of invocations) {
        const processedKey = `${activeSessionId}_${invocation.toolCallId}_${invocation.state}`;
        if (processedToolCalls.current.has(processedKey)) continue;

        const existingEvent = eventIndex.get(invocation.toolCallId);
        const now = Date.now();
        const mappedEvent = mapInvocationToEvent(invocation, now);
        if (!mappedEvent) continue;

        if (invocation.state === "call") {
          if (!existingEvent) {
            addEvent(activeSessionId, mappedEvent);
            eventIndex.set(mappedEvent.id, mappedEvent);
          }
          processedToolCalls.current.add(processedKey);
          continue;
        }

        if (existingEvent) {
          const duration = Math.max(now - existingEvent.timestamp, 0);
          const nextEvent = { ...existingEvent, ...mappedEvent, duration };
          updateEvent(
            activeSessionId,
            existingEvent.id,
            getEventUpdates(nextEvent, duration),
          );
          eventIndex.set(nextEvent.id, nextEvent);
          processedToolCalls.current.add(processedKey);
        } else {
          const completedEvent = { ...mappedEvent, duration: 0 };
          addEvent(activeSessionId, completedEvent);
          eventIndex.set(completedEvent.id, completedEvent);
          processedToolCalls.current.add(processedKey);
        }
      }
    }
  }, [activeSessionId, messages]);
};
