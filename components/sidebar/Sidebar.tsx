"use client";

import { useEffect } from "react";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useAgentStore } from "@/store/useAgentStore";

export function Sidebar() {
  const sessions = useAgentStore((state) => state.sessions);
  const activeSessionId = useAgentStore((state) => state.activeSessionId);
  const createSession = useAgentStore((state) => state.createSession);
  const switchSession = useAgentStore((state) => state.switchSession);

  useEffect(() => {
    if (sessions.length === 0) {
      createSession("Session 1");
    }
  }, [createSession, sessions.length]);

  const handleCreateSession = () => {
    createSession(`Session ${sessions.length + 1}`);
  };

  return (
    <aside className="flex h-full min-w-0 flex-col border-r border-zinc-200 bg-zinc-50">
      <div className="border-b border-zinc-200 p-3">
        <Button onClick={handleCreateSession} className="w-full justify-start gap-2">
          <Plus className="h-4 w-4" />
          New Session
        </Button>
      </div>

      <div className="flex-1 space-y-1 overflow-y-auto p-2">
        {sessions.map((session) => (
          <button
            key={session.id}
            type="button"
            onClick={() => switchSession(session.id)}
            className={cn(
              "w-full rounded-md px-3 py-2 text-left text-sm transition-colors",
              "hover:bg-zinc-200",
              activeSessionId === session.id
                ? "bg-zinc-900 text-white hover:bg-zinc-800"
                : "bg-transparent text-zinc-800",
            )}
          >
            <div className="truncate font-medium">{session.title}</div>
          </button>
        ))}
      </div>
    </aside>
  );
}
