"use client";

import {
  Camera,
  CheckCircle2,
  CircleDotDashed,
  MousePointerClick,
  TerminalSquare,
  Type,
  Waypoints,
  XCircle,
} from "lucide-react";
import type { AgentEvent } from "@/types/events";
import {
  getActiveSessionEvents,
  useActiveSessionEventCounts,
  useAgentStore,
} from "@/store/useAgentStore";

const statusStyles: Record<AgentEvent["status"], string> = {
  pending: "text-amber-300",
  complete: "text-emerald-300",
  error: "text-red-300",
};

const getStatusIcon = (status: AgentEvent["status"]) => {
  switch (status) {
    case "pending":
      return <CircleDotDashed className="h-4 w-4 text-amber-300" />;
    case "complete":
      return <CheckCircle2 className="h-4 w-4 text-emerald-300" />;
    case "error":
      return <XCircle className="h-4 w-4 text-red-300" />;
  }
};

const getEventIcon = (type: AgentEvent["type"]) => {
  switch (type) {
    case "click":
      return <MousePointerClick className="h-4 w-4 text-zinc-200" />;
    case "type":
      return <Type className="h-4 w-4 text-zinc-200" />;
    case "bash":
      return <TerminalSquare className="h-4 w-4 text-zinc-200" />;
    case "screenshot":
      return <Camera className="h-4 w-4 text-zinc-200" />;
    case "browser_action":
      return <Waypoints className="h-4 w-4 text-zinc-200" />;
  }
};

const getEventSummary = (event: AgentEvent): string => {
  switch (event.type) {
    case "click":
      return `${event.target} @ (${event.x}, ${event.y})`;
    case "type":
      return `${event.target} "${event.value.slice(0, 40)}"`;
    case "bash":
      return event.command;
    case "screenshot":
      return event.imageUrl ? "captured screenshot" : "awaiting screenshot data";
    case "browser_action":
      if (event.url) return `${event.action} ${event.url}`;
      if (event.detail) return `${event.action} ${event.detail}`;
      return event.action;
  }
};

const formatTime = (timestamp: number): string =>
  new Date(timestamp).toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });

export function DebugPanel() {
  const counts = useActiveSessionEventCounts();
  const activeEvents = useAgentStore(getActiveSessionEvents);
  const selectedEventId = useAgentStore((state) => state.selectedEventId);
  const setSelectedEventId = useAgentStore((state) => state.setSelectedEventId);
  const sortedEvents = [...activeEvents].sort((a, b) => a.timestamp - b.timestamp);

  return (
    <div className="flex flex-col h-full w-full bg-zinc-950 text-white overflow-hidden">
      <div className="border-b border-zinc-800 p-3">
        <div className="mb-2 text-xs uppercase tracking-wider text-zinc-400">
          Event Pipeline
        </div>
        <div className="flex flex-wrap gap-2 text-xs">
          <span className="rounded-md border border-zinc-700 bg-zinc-900 px-2 py-1">
            🖱️ Clicks: {counts.click}
          </span>
          <span className="rounded-md border border-zinc-700 bg-zinc-900 px-2 py-1">
            ⌨️ Types: {counts.type}
          </span>
          <span className="rounded-md border border-zinc-700 bg-zinc-900 px-2 py-1">
            📸 Screenshots: {counts.screenshot}
          </span>
          <span className="rounded-md border border-zinc-700 bg-zinc-900 px-2 py-1">
            🧪 Bash: {counts.bash}
          </span>
          <span className="rounded-md border border-zinc-700 bg-zinc-900 px-2 py-1">
            🌐 Browser: {counts.browser_action}
          </span>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4 font-mono text-xs space-y-2">
        {sortedEvents.length === 0 ? (
          <div className="rounded-md border border-dashed border-zinc-700 bg-zinc-900/60 p-3 text-zinc-400">
            Waiting for tool events...
          </div>
        ) : null}

        {sortedEvents.map((event) => (
          <div
            key={event.id}
            onClick={() => setSelectedEventId(event.id)}
            className={`cursor-pointer rounded-md border bg-zinc-900/70 p-2 ${
              selectedEventId === event.id
                ? "border-emerald-500"
                : "border-zinc-800 hover:border-zinc-600"
            }`}
          >
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                {getEventIcon(event.type)}
                <span className="text-zinc-300">{formatTime(event.timestamp)}</span>
              </div>
              <div className="flex items-center gap-2">
                {getStatusIcon(event.status)}
                <span className={statusStyles[event.status]}>{event.status}</span>
              </div>
            </div>
            <div className="mt-2 text-zinc-100">{getEventSummary(event)}</div>
            <div className="mt-1 text-zinc-500">
              id={event.id}
              {event.duration !== undefined ? ` | duration=${event.duration}ms` : ""}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
