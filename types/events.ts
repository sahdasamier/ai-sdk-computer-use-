import type { Message } from "ai";

export type EventStatus = "pending" | "complete" | "error";

export interface BaseEvent {
  id: string;
  timestamp: number;
  status: EventStatus;
  duration?: number;
}

export interface ClickEvent extends BaseEvent {
  type: "click";
  target: string;
  x: number;
  y: number;
}

export interface TypeEvent extends BaseEvent {
  type: "type";
  target: string;
  value: string;
}

export interface BashEvent extends BaseEvent {
  type: "bash";
  command: string;
  output?: string;
  exitCode?: number;
}

export interface ScreenshotEvent extends BaseEvent {
  type: "screenshot";
  imageUrl: string;
  width: number;
  height: number;
}

export interface BrowserActionEvent extends BaseEvent {
  type: "browser_action";
  action: "navigate" | "back" | "forward" | "reload" | "scroll" | "other";
  url?: string;
  detail?: string;
}

export type AgentEvent =
  | ClickEvent
  | TypeEvent
  | BashEvent
  | ScreenshotEvent
  | BrowserActionEvent;

export type ChatMessage = Message;

export interface ChatSession {
  id: string;
  title: string;
  createdAt: number;
  events: AgentEvent[];
  messages: ChatMessage[];
}
