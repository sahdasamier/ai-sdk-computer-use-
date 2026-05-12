"use client";

import { useEffect, useRef } from "react";
import type { Message } from "ai";
import type { AgentEvent } from "@/types/events";
import { useAgentStore } from "@/store/useAgentStore";

interface ToolInvocationLike {
  toolId?: string;
  toolCallId?: string;
  id?: string;
  toolName?: string;
  name?: string;
  state?: "call" | "result" | string;
  args?: unknown;
  result?: unknown;
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null;

const getString = (value: unknown): string | undefined =>
  typeof value === "string" ? value : undefined;

const getNumber = (value: unknown): number | undefined =>
  typeof value === "number" ? value : undefined;

const getInvocationId = (invocation: ToolInvocationLike): string | null =>
  invocation.toolCallId ?? invocation.toolId ?? invocation.id ?? null;

const getInvocationState = (
  invocation: ToolInvocationLike,
): "call" | "result" | null => {
  if (invocation.state === "call" || invocation.state === "result") {
    return invocation.state;
  }
  return null;
};

const getInvocationName = (invocation: ToolInvocationLike): string | null =>
  invocation.toolName ?? invocation.name ?? null;

const getMessageToolInvocations = (message: Message): ToolInvocationLike[] => {
  const invocations: ToolInvocationLike[] = [];

  // Only use parts to avoid duplicates — parts is the canonical source in AI SDK v4.
  for (const part of message.parts ?? []) {
    if (!isRecord(part) || part.type !== "tool-invocation") continue;
    if (!isRecord(part.toolInvocation)) continue;
    invocations.push(part.toolInvocation as ToolInvocationLike);
  }

  // Fall back to toolInvocations if parts produced nothing (older message shapes).
  if (invocations.length === 0) {
    for (const invocation of message.toolInvocations ?? []) {
      if (isRecord(invocation)) {
        invocations.push(invocation as ToolInvocationLike);
      }
    }
  }

  return invocations;
};

const isInvocationError = (result: unknown): boolean => {
  if (!result) return false;
  if (result === "User aborted") return true;
  if (!isRecord(result)) return false;
  if (result.isError === true) return true;
  if (typeof result.error === "string" && result.error.length > 0) return true;
  if (typeof result.stderr === "string" && result.stderr.length > 0) return true;
  return false;
};

const getEventStatus = (
  state: "call" | "result",
  result: unknown,
): "pending" | "complete" | "error" =>
  state === "call" ? "pending" : isInvocationError(result) ? "error" : "complete";

const mapInvocationToEvent = (
  invocation: ToolInvocationLike,
  id: string,
  messageId: string,
  state: "call" | "result",
  timestamp: number,
): AgentEvent | null => {
  const toolName = getInvocationName(invocation);
  if (!toolName) return null;

  const status = getEventStatus(state, invocation.result);

  if (toolName === "bash") {
    const args = isRecord(invocation.args) ? invocation.args : {};
    const result = isRecord(invocation.result) ? invocation.result : {};

    return {
      id,
      messageId,
      timestamp,
      type: "bash",
      status,
      command: getString(args.command) ?? "unknown",
      output: getString(result.stdout) ?? getString(result.output),
      exitCode: getNumber(result.exitCode) ?? getNumber(result.code),
      payload: { invocation },
    };
  }

  if (toolName !== "computer") return null;

  const args = isRecord(invocation.args) ? invocation.args : null;
  if (!args) return null;

  const action = getString(args.action);
  if (!action) return null;

  if (
    action === "click" ||
    action === "left_click" ||
    action === "right_click" ||
    action === "double_click" ||
    action === "mouse_move" ||
    action === "scroll" ||
    action === "left_click_drag"
  ) {
    const coordinate = Array.isArray(args.coordinate) ? args.coordinate : null;
    const x = coordinate ? getNumber(coordinate[0]) ?? 0 : 0;
    const y = coordinate ? getNumber(coordinate[1]) ?? 0 : 0;

    return {
      id,
      messageId,
      timestamp,
      type: "click",
      status,
      target: action,
      x,
      y,
      payload: { invocation },
    };
  }

  if (action === "type" || action === "key") {
    return {
      id,
      messageId,
      timestamp,
      type: "type",
      status,
      target: action === "key" ? "keyboard" : "active-element",
      value: getString(args.text) ?? "",
      payload: { invocation },
    };
  }

  if (action === "wait") {
    return {
      id,
      messageId,
      timestamp,
      type: "bash",
      status,
      command: `sleep ${getNumber(args.duration) ?? 1}`,
      payload: { invocation },
    };
  }

  if (action === "screenshot") {
    // Result from standard tool is an array: [{ type: "image", image: base64Data }]
    // OR redacted text string from prunedMessages.
    const result = invocation.result;
    let imageData: string | undefined;

    if (Array.isArray(result)) {
      const imagePart = result.find(
        (p) => isRecord(p) && p.type === "image",
      ) as Record<string, unknown> | undefined;
      // `image` field from standard tool() return, `data` from legacy provider tool
      imageData =
        getString(imagePart?.image) ??
        getString(imagePart?.data);
    } else if (isRecord(result)) {
      imageData = getString(result.data) ?? getString(result.image);
    }

    return {
      id,
      messageId,
      timestamp,
      type: "screenshot",
      status,
      imageUrl: imageData ? `data:image/png;base64,${imageData}` : "",
      width: 1024,
      height: 768,
      payload: { invocation },
    };
  }

  return null;
};

const getEventUpdates = (event: AgentEvent, duration: number): Partial<AgentEvent> => {
  // Always carry the latest payload (contains result invocation data).
  const base = { status: event.status, duration, payload: event.payload };

  if (event.type === "bash") {
    return { ...base, output: event.output, exitCode: event.exitCode };
  }
  if (event.type === "click") {
    return { ...base, target: event.target, x: event.x, y: event.y };
  }
  if (event.type === "type") {
    return { ...base, target: event.target, value: event.value };
  }
  if (event.type === "screenshot") {
    return { ...base, imageUrl: event.imageUrl, width: event.width, height: event.height };
  }
  return base;
};

export const useEventPipeline = (
  messages: Message[],
  activeSessionId: string | null,
) => {
  const processedIds = useRef<Set<string>>(new Set());

  useEffect(() => {
    processedIds.current.clear();
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
        const toolId = getInvocationId(invocation);
        const state = getInvocationState(invocation);
        if (!toolId || !state) continue;

        const key = `${activeSessionId}:${message.id}:${toolId}:${state}`;
        if (processedIds.current.has(key)) continue;

        const now = Date.now();
        const mappedEvent = mapInvocationToEvent(
          invocation,
          toolId,
          message.id,
          state,
          now,
        );
        if (!mappedEvent) continue;
        processedIds.current.add(key);

        const existingEvent = eventIndex.get(toolId);

        if (state === "call") {
          if (!existingEvent) {
            addEvent(activeSessionId, mappedEvent);
            eventIndex.set(mappedEvent.id, mappedEvent);
          }
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
        } else {
          const completedEvent = { ...mappedEvent, duration: 0 };
          addEvent(activeSessionId, completedEvent);
          eventIndex.set(completedEvent.id, completedEvent);
        }
      }
    }
  }, [messages, activeSessionId]);
};
