"use client";

import { memo, useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { getDesktopURL } from "@/lib/sandbox/utils";
import { getSelectedEvent, useAgentStore } from "@/store/useAgentStore";
import { toast } from "sonner";
import { useSandboxStore } from "@/store/useSandboxStore";
import type { AgentEvent, BashEvent, ClickEvent, ScreenshotEvent, TypeEvent, BrowserActionEvent } from "@/types/events";
import {
  ArrowLeft,
  Camera,
  CheckCircle2,
  CircleDotDashed,
  Clock,
  Code2,
  ExternalLink,
  Hash,
  MousePointerClick,
  RefreshCw,
  TerminalSquare,
  Type,
  Waypoints,
  XCircle,
} from "lucide-react";

// ─── Detail View ─────────────────────────────────────────────────────────────

const statusConfig = {
  pending: { icon: CircleDotDashed, label: "Pending", className: "text-amber-400 bg-amber-400/10 border-amber-400/30" },
  complete: { icon: CheckCircle2, label: "Complete", className: "text-emerald-400 bg-emerald-400/10 border-emerald-400/30" },
  error: { icon: XCircle, label: "Error", className: "text-red-400 bg-red-400/10 border-red-400/30" },
} as const;

const typeConfig = {
  click: { icon: MousePointerClick, label: "Mouse Click", color: "text-blue-400" },
  type: { icon: Type, label: "Keyboard Input", color: "text-purple-400" },
  bash: { icon: TerminalSquare, label: "Bash Command", color: "text-green-400" },
  screenshot: { icon: Camera, label: "Screenshot", color: "text-orange-400" },
  browser_action: { icon: Waypoints, label: "Browser Action", color: "text-cyan-400" },
} as const;

function MetaRow({ icon: Icon, label, value }: { icon: React.ElementType; label: string; value: string }) {
  return (
    <div className="flex items-center gap-2 text-xs">
      <Icon className="h-3 w-3 text-zinc-500 shrink-0" />
      <span className="text-zinc-500 w-16 shrink-0">{label}</span>
      <span className="text-zinc-300 font-mono truncate">{value}</span>
    </div>
  );
}

function JsonBlock({ label, data }: { label: string; data: unknown }) {
  return (
    <div>
      <div className="flex items-center gap-1.5 mb-1.5">
        <Code2 className="h-3 w-3 text-zinc-500" />
        <span className="text-xs text-zinc-400 font-medium uppercase tracking-wider">{label}</span>
      </div>
      <pre className="rounded-md bg-zinc-900 border border-zinc-800 p-3 text-xs text-zinc-300 overflow-auto max-h-48 leading-relaxed">
        {JSON.stringify(data, null, 2)}
      </pre>
    </div>
  );
}

function BashDetail({ event }: { event: BashEvent }) {
  return (
    <div className="space-y-3">
      <div>
        <div className="flex items-center gap-1.5 mb-1.5">
          <TerminalSquare className="h-3 w-3 text-zinc-500" />
          <span className="text-xs text-zinc-400 font-medium uppercase tracking-wider">Command</span>
        </div>
        <pre className="rounded-md bg-zinc-900 border border-zinc-800 px-3 py-2 text-xs text-emerald-300 font-mono overflow-x-auto">
          $ {event.command}
        </pre>
      </div>
      {event.output !== undefined && (
        <div>
          <div className="flex items-center gap-1.5 mb-1.5">
            <Code2 className="h-3 w-3 text-zinc-500" />
            <span className="text-xs text-zinc-400 font-medium uppercase tracking-wider">Output</span>
            {event.exitCode !== undefined && (
              <span className={`ml-auto text-xs px-1.5 py-0.5 rounded font-mono ${event.exitCode === 0 ? "bg-emerald-900/60 text-emerald-300" : "bg-red-900/60 text-red-300"}`}>
                exit {event.exitCode}
              </span>
            )}
          </div>
          <pre className="rounded-md bg-zinc-900 border border-zinc-800 px-3 py-2 text-xs text-zinc-300 font-mono overflow-auto max-h-48 whitespace-pre-wrap">
            {event.output || "(no output)"}
          </pre>
        </div>
      )}
    </div>
  );
}

function ScreenshotDetail({ event }: { event: ScreenshotEvent }) {
  return (
    <div className="space-y-3">
      {event.imageUrl ? (
        <div>
          <div className="flex items-center gap-1.5 mb-1.5">
            <Camera className="h-3 w-3 text-zinc-500" />
            <span className="text-xs text-zinc-400 font-medium uppercase tracking-wider">Screenshot</span>
            <span className="ml-auto text-xs text-zinc-500">{event.width}×{event.height}</span>
          </div>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={event.imageUrl}
            alt="Screenshot"
            className="w-full rounded-md border border-zinc-800 object-contain"
          />
        </div>
      ) : (
        <div className="rounded-md border border-dashed border-zinc-700 bg-zinc-900/50 p-6 text-center text-xs text-zinc-500">
          {event.status === "pending" ? "Awaiting screenshot…" : "No screenshot data"}
        </div>
      )}
    </div>
  );
}

function ClickDetail({ event }: { event: ClickEvent }) {
  return (
    <JsonBlock
      label="Action"
      data={{ action: event.target, coordinate: [event.x, event.y] }}
    />
  );
}

function TypeDetail({ event }: { event: TypeEvent }) {
  return (
    <div>
      <div className="flex items-center gap-1.5 mb-1.5">
        <Type className="h-3 w-3 text-zinc-500" />
        <span className="text-xs text-zinc-400 font-medium uppercase tracking-wider">Text Typed</span>
      </div>
      <div className="rounded-md bg-zinc-900 border border-zinc-800 px-3 py-2 text-xs text-zinc-300 font-mono break-words">
        {event.value || <span className="text-zinc-600 italic">(empty)</span>}
      </div>
    </div>
  );
}

function BrowserDetail({ event }: { event: BrowserActionEvent }) {
  return (
    <div className="space-y-3">
      <JsonBlock label="Action" data={{ action: event.action, url: event.url, detail: event.detail }} />
      {event.url && (
        <a
          href={event.url}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-1.5 text-xs text-blue-400 hover:text-blue-300 transition-colors"
        >
          <ExternalLink className="h-3 w-3" />
          {event.url}
        </a>
      )}
    </div>
  );
}

function EventPayload({ event }: { event: AgentEvent }) {
  const payload = (event as { payload?: unknown }).payload;
  if (!payload) return null;
  return <JsonBlock label="Raw Payload" data={payload} />;
}

function EventDetail({ event, onBack }: { event: AgentEvent; onBack: () => void }) {
  const { icon: TypeIcon, label: typeLabel, color: typeColor } = typeConfig[event.type];
  const { icon: StatusIcon, label: statusLabel, className: statusClass } = statusConfig[event.status];

  const formatTime = (ts: number) =>
    new Date(ts).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" });

  return (
    <div className="flex flex-col h-full bg-zinc-950 text-zinc-100">
      {/* Header */}
      <div className="flex items-center gap-3 border-b border-zinc-800 px-3 py-2.5 shrink-0">
        <button
          onClick={onBack}
          className="flex items-center gap-1.5 text-xs text-zinc-400 hover:text-zinc-200 transition-colors"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Live
        </button>
        <div className="h-4 w-px bg-zinc-700" />
        <TypeIcon className={`h-4 w-4 ${typeColor}`} />
        <span className="text-sm font-medium text-zinc-200">{typeLabel}</span>
        <div className={`ml-auto flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-medium ${statusClass}`}>
          <StatusIcon className="h-3 w-3" />
          {statusLabel}
        </div>
      </div>

      {/* Scrollable content */}
      <div className="flex-1 overflow-y-auto p-3 space-y-4">
        {/* Metadata */}
        <div className="rounded-md bg-zinc-900 border border-zinc-800 p-3 space-y-1.5">
          <MetaRow icon={Hash} label="ID" value={event.id} />
          <MetaRow icon={Clock} label="Time" value={formatTime(event.timestamp)} />
          {event.duration !== undefined && (
            <MetaRow icon={Clock} label="Duration" value={`${event.duration}ms`} />
          )}
          {event.messageId && (
            <MetaRow icon={Hash} label="Message" value={event.messageId} />
          )}
        </div>

        {/* Type-specific detail */}
        {event.type === "bash" && <BashDetail event={event} />}
        {event.type === "screenshot" && <ScreenshotDetail event={event} />}
        {event.type === "click" && <ClickDetail event={event} />}
        {event.type === "type" && <TypeDetail event={event} />}
        {event.type === "browser_action" && <BrowserDetail event={event} />}

        {/* Raw payload at the bottom */}
        <EventPayload event={event} />
      </div>
    </div>
  );
}

// ─── VNC Viewer ──────────────────────────────────────────────────────────────

const VNCViewerComponent = () => {
  const sandboxId = useSandboxStore((state) => state.sandboxId);
  const setSandboxId = useSandboxStore((state) => state.setSandboxId);
  const isInitializing = useSandboxStore((state) => state.isInitializing);
  const setIsInitializing = useSandboxStore((state) => state.setIsInitializing);
  const selectedEvent = useAgentStore(getSelectedEvent);
  const setSelectedEventId = useAgentStore((state) => state.setSelectedEventId);
  const [streamUrl, setStreamUrl] = useState<string | null>(null);
  const [initError, setInitError] = useState<string | null>(null);
  const initialSandboxId = useRef(sandboxId);
  const hasInitialized = useRef(false);
  const unloadBeaconSentFor = useRef<string | null>(null);

  const initializeDesktop = async (id?: string) => {
    try {
      setIsInitializing(true);
      setInitError(null);
      const desktop = await getDesktopURL(id);
      setStreamUrl(desktop.streamUrl);
      setSandboxId(desktop.id);
    } catch (error) {
      const msg = error instanceof Error ? error.message : "Unknown error";
      console.error("Failed to initialize desktop:", error);
      setInitError(msg);
      toast.error("Failed to initialize desktop", { description: msg });
    } finally {
      setIsInitializing(false);
    }
  };

  useEffect(() => {
    if (hasInitialized.current) return;
    hasInitialized.current = true;
    void initializeDesktop(initialSandboxId.current ?? undefined);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!sandboxId) return;
    unloadBeaconSentFor.current = null;

    const killDesktop = () => {
      if (unloadBeaconSentFor.current === sandboxId) return;
      unloadBeaconSentFor.current = sandboxId;
      navigator.sendBeacon(
        `/api/kill-desktop?sandboxId=${encodeURIComponent(sandboxId)}`,
      );
    };

    const isIOS =
      /iPad|iPhone|iPod/.test(navigator.userAgent) ||
      (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
    const isSafari = /^((?!chrome|android).)*safari/i.test(navigator.userAgent);

    if (isIOS || isSafari) {
      window.addEventListener("pagehide", killDesktop);
      return () => window.removeEventListener("pagehide", killDesktop);
    }

    window.addEventListener("beforeunload", killDesktop);
    return () => window.removeEventListener("beforeunload", killDesktop);
  }, [sandboxId]);

  if (selectedEvent) {
    return <EventDetail event={selectedEvent} onBack={() => setSelectedEventId(null)} />;
  }

  return (
    <div className="relative flex flex-col h-full w-full bg-zinc-900 overflow-hidden">
      {streamUrl ? (
        <>
          <iframe
            src={streamUrl}
            className="h-full w-full border-0"
            allow="autoplay"
            title="VNC Desktop Stream"
          />
          <Button
            onClick={() => initializeDesktop(sandboxId ?? undefined)}
            className="absolute right-3 top-3 z-10 bg-black/60 text-white hover:bg-black/80 gap-2"
            disabled={isInitializing}
          >
            <RefreshCw className={`h-3.5 w-3.5 ${isInitializing ? "animate-spin" : ""}`} />
            {isInitializing ? "Creating desktop…" : "New desktop"}
          </Button>
        </>
      ) : (
        <div className="flex h-full flex-col items-center justify-center gap-4 text-white px-6">
          {isInitializing ? (
            <>
              <RefreshCw className="h-8 w-8 animate-spin text-zinc-400" />
              <p className="text-sm text-zinc-400">Initializing desktop environment…</p>
            </>
          ) : initError ? (
            <>
              <XCircle className="h-8 w-8 text-red-400" />
              <p className="text-sm text-zinc-400 text-center max-w-xs">{initError}</p>
              <Button
                onClick={() => initializeDesktop(sandboxId ?? undefined)}
                variant="outline"
                className="border-zinc-700 text-zinc-300 hover:bg-zinc-800"
              >
                Retry
              </Button>
            </>
          ) : (
            <p className="text-sm text-zinc-400">Loading stream…</p>
          )}
        </div>
      )}
    </div>
  );
};

export const VNCViewer = memo(VNCViewerComponent);
