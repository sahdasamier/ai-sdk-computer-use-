"use client";

import type { ReactNode } from "react";
import { useState } from "react";
import { GripHorizontal, GripVertical, LayoutList, MessageSquare, Monitor } from "lucide-react";
import {
  Panel,
  PanelGroup,
  PanelResizeHandle,
} from "react-resizable-panels";
import { cn } from "@/lib/utils";

interface DashboardLayoutProps {
  sidebar: ReactNode;
  chat: ReactNode;
  debug: ReactNode;
  vnc: ReactNode;
}

interface ResizeHandleProps {
  orientation: "horizontal" | "vertical";
}

const ResizeHandle = ({ orientation }: ResizeHandleProps) => {
  const isVertical = orientation === "vertical";
  const GripIcon = isVertical ? GripVertical : GripHorizontal;

  return (
    <PanelResizeHandle
      aria-label={isVertical ? "Resize columns" : "Resize rows"}
      className={[
        "group relative flex items-center justify-center",
        "bg-zinc-200/70 dark:bg-zinc-800/70",
        "transition-colors duration-200",
        "hover:bg-zinc-400/80 dark:hover:bg-zinc-600/80",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/70",
        isVertical ? "w-px cursor-col-resize" : "h-px cursor-row-resize",
      ].join(" ")}
    >
      <div
        className={[
          "pointer-events-none rounded-md border border-zinc-300/70 bg-white/95 text-zinc-500 shadow-sm",
          "dark:border-zinc-700 dark:bg-zinc-900/95 dark:text-zinc-400",
          "opacity-0 transition-opacity duration-200 group-hover:opacity-100 group-focus-visible:opacity-100",
          isVertical ? "px-1 py-2" : "px-2 py-1",
        ].join(" ")}
      >
        <GripIcon className="h-3.5 w-3.5" />
      </div>
    </PanelResizeHandle>
  );
};

type MobileTab = "sessions" | "chat" | "desktop";

const MOBILE_TABS: { id: MobileTab; label: string; Icon: typeof MessageSquare }[] = [
  { id: "sessions", label: "Sessions", Icon: LayoutList },
  { id: "chat",     label: "Chat",     Icon: MessageSquare },
  { id: "desktop",  label: "Desktop",  Icon: Monitor },
];

export function DashboardLayout({ sidebar, chat, debug, vnc }: DashboardLayoutProps) {
  const [activeTab, setActiveTab] = useState<MobileTab>("chat");

  return (
    <>
      {/* ── Mobile layout (< lg) ─────────────────────────────────── */}
      <div className="flex flex-col h-full w-full lg:hidden">
        {/* Panel area */}
        <div className="flex-1 min-h-0 overflow-hidden">
          <div className={activeTab === "sessions" ? "h-full" : "hidden"}>{sidebar}</div>
          <div className={activeTab === "chat"     ? "h-full" : "hidden"}>{chat}</div>
          {activeTab === "desktop" && (
            <div className="flex flex-col h-full">
              <div className="flex-1 min-h-0">{vnc}</div>
              <div className="h-52 min-h-0 border-t border-zinc-800">{debug}</div>
            </div>
          )}
        </div>

        {/* Tab bar */}
        <nav className="flex shrink-0 border-t border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-950">
          {MOBILE_TABS.map(({ id, label, Icon }) => (
            <button
              key={id}
              type="button"
              onClick={() => setActiveTab(id)}
              className={cn(
                "flex flex-1 flex-col items-center justify-center gap-0.5 py-2 text-[10px] font-medium transition-colors",
                activeTab === id
                  ? "text-zinc-900 dark:text-zinc-100"
                  : "text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300",
              )}
            >
              <Icon className="h-5 w-5" />
              {label}
            </button>
          ))}
        </nav>
      </div>

      {/* ── Desktop layout (lg+) ──────────────────────────────────── */}
      <PanelGroup direction="horizontal" className="hidden h-full w-full lg:flex">
        <Panel
          id="sidebar-panel"
          order={1}
          defaultSize={18}
          minSize={14}
          maxSize={24}
          className="min-w-0"
        >
          {sidebar}
        </Panel>

        <ResizeHandle orientation="vertical" />

        <Panel id="workspace-panel" order={2} defaultSize={42} minSize={26}>
          <PanelGroup direction="vertical" className="h-full">
            <Panel id="chat-panel" order={1} defaultSize={74} minSize={40}>
              {chat}
            </Panel>

            <ResizeHandle orientation="horizontal" />

            <Panel
              id="debug-panel"
              order={2}
              defaultSize={26}
              minSize={14}
              collapsible
              collapsedSize={0}
            >
              {debug}
            </Panel>
          </PanelGroup>
        </Panel>

        <ResizeHandle orientation="vertical" />

        <Panel id="vnc-panel" order={3} defaultSize={40} minSize={26}>
          {vnc}
        </Panel>
      </PanelGroup>
    </>
  );
}
