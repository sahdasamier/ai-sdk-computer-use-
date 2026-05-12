"use client";

import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

import type { AgentEvent, ChatSession } from "@/types/events";

export type AgentStatus = "idle" | "thinking" | "executing";
export type EventType = AgentEvent["type"];

export type EventCounts = Record<EventType, number>;

const EMPTY_EVENT_COUNTS: EventCounts = {
  click: 0,
  type: 0,
  bash: 0,
  screenshot: 0,
  browser_action: 0,
};
const EMPTY_EVENTS: AgentEvent[] = [];
const eventCountsCache = new WeakMap<AgentEvent[], EventCounts>();

interface AgentStoreState {
  sessions: ChatSession[];
  activeSessionId: string | null;
  selectedEventId: string | null;
  agentStatus: AgentStatus;
}

interface AgentStoreActions {
  createSession: (title: string) => string;
  switchSession: (id: string) => void;
  deleteSession: (id: string) => void;
  addEvent: (sessionId: string, event: AgentEvent) => void;
  updateEvent: (
    sessionId: string,
    eventId: string,
    updates: Partial<AgentEvent>,
  ) => void;
  setSelectedEventId: (eventId: string | null) => void;
  setAgentStatus: (status: AgentStatus) => void;
}

export type AgentStore = AgentStoreState & AgentStoreActions;

const createSessionId = (): string => crypto.randomUUID();

export const useAgentStore = create<AgentStore>()(
  persist(
    (set, get) => ({
      sessions: [],
      activeSessionId: null,
      selectedEventId: null,
      agentStatus: "idle",
      createSession: (title) => {
        let id = createSessionId();
        while (get().sessions.some((session) => session.id === id)) {
          id = createSessionId();
        }

        const newSession: ChatSession = {
          id,
          title,
          createdAt: Date.now(),
          events: [],
          messages: [],
        };

        set((state) => {
          if (state.sessions.some((session) => session.id === id)) {
            return state;
          }

          return {
            sessions: [...state.sessions, newSession],
            activeSessionId: id,
            selectedEventId: null,
          };
        });

        return id;
      },
      switchSession: (id) => {
        const sessionExists = get().sessions.some((session) => session.id === id);
        if (!sessionExists) return;

        set({ activeSessionId: id, selectedEventId: null });
      },
      deleteSession: (id) => {
        set((state) => {
          const sessions = state.sessions.filter((session) => session.id !== id);
          const activeSessionId =
            state.activeSessionId === id ? (sessions[0]?.id ?? null) : state.activeSessionId;
          const selectedEventId = sessions
            .flatMap((session) => session.events)
            .some((event) => event.id === state.selectedEventId)
            ? state.selectedEventId
            : null;

          return {
            sessions,
            activeSessionId,
            selectedEventId,
          };
        });
      },
      addEvent: (sessionId, event) => {
        set((state) => ({
          sessions: state.sessions.map((session) =>
            session.id === sessionId
              ? { ...session, events: [...session.events, event] }
              : session,
          ),
        }));
      },
      updateEvent: (sessionId, eventId, updates) => {
        set((state) => ({
          sessions: state.sessions.map((session) => {
            if (session.id !== sessionId) return session;

            return {
              ...session,
              events: session.events.map((event) =>
                event.id === eventId ? ({ ...event, ...updates } as AgentEvent) : event,
              ),
            };
          }),
        }));
      },
      setSelectedEventId: (eventId) => set({ selectedEventId: eventId }),
      setAgentStatus: (status) => set({ agentStatus: status }),
    }),
    {
      name: "agent-dashboard-sessions",
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({
        sessions: state.sessions,
        activeSessionId: state.activeSessionId,
        selectedEventId: state.selectedEventId,
      }),
    },
  ),
);

export const getActiveSessionEventCounts = (state: AgentStoreState): EventCounts => {
  const activeSession = state.sessions.find(
    (session) => session.id === state.activeSessionId,
  );
  if (!activeSession) return EMPTY_EVENT_COUNTS;

  const cachedCounts = eventCountsCache.get(activeSession.events);
  if (cachedCounts) return cachedCounts;

  const counts = activeSession.events.reduce<EventCounts>((acc, event) => {
    acc[event.type] += 1;
    return acc;
  }, { ...EMPTY_EVENT_COUNTS });
  eventCountsCache.set(activeSession.events, counts);
  return counts;
};

export const getActiveSessionEvents = (state: AgentStoreState): AgentEvent[] => {
  const activeSession = state.sessions.find(
    (session) => session.id === state.activeSessionId,
  );
  return activeSession?.events ?? EMPTY_EVENTS;
};

export const getSelectedEvent = (state: AgentStoreState): AgentEvent | null => {
  if (!state.activeSessionId || !state.selectedEventId) return null;
  const activeSession = state.sessions.find(
    (session) => session.id === state.activeSessionId,
  );
  if (!activeSession) return null;
  return activeSession.events.find((event) => event.id === state.selectedEventId) ?? null;
};

export const useActiveSessionEventCounts = (): EventCounts =>
  useAgentStore(getActiveSessionEventCounts);
