"use client";

import type { ReactNode } from "react";
import { GripHorizontal, GripVertical } from "lucide-react";
import {
  Panel,
  PanelGroup,
  PanelResizeHandle,
} from "react-resizable-panels";

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

export function DashboardLayout({
  sidebar,
  chat,
  debug,
  vnc,
}: DashboardLayoutProps) {
  return (
    <PanelGroup direction="horizontal" className="h-dvh w-full bg-background">
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
  );
}
