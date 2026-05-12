"use client";

import { useChat } from "@ai-sdk/react";
import { toast } from "sonner";
import { AISDKLogo } from "@/components/icons";
import { Input } from "@/components/input";
import { PreviewMessage } from "@/components/message";
import { DeployButton, ProjectInfo } from "@/components/project-info";
import { PromptSuggestions } from "@/components/prompt-suggestions";
import { useEventPipeline } from "@/hooks/useEventPipeline";
import { useScrollToBottom } from "@/lib/use-scroll-to-bottom";
import { ABORTED } from "@/lib/utils";
import { useAgentStore } from "@/store/useAgentStore";
import { useSandboxStore } from "@/store/useSandboxStore";

function ChatAreaInner() {
  const sandboxId = useSandboxStore((state) => state.sandboxId);
  const isInitializing = useSandboxStore((state) => state.isInitializing);
  const activeSessionId = useAgentStore((state) => state.activeSessionId);
  const setSelectedEventId = useAgentStore((state) => state.setSelectedEventId);
  const [containerRef, endRef] = useScrollToBottom();

  const {
    messages,
    input,
    handleInputChange,
    handleSubmit,
    status,
    stop: stopGeneration,
    append,
    setMessages,
  } = useChat({
    api: "/api/chat",
    id: activeSessionId ?? undefined,
    body: {
      sandboxId,
    },
    maxSteps: 30,
    onError: (error) => {
      console.error(error);
      toast.error("There was an error", {
        description: "Please try again later.",
        richColors: true,
        position: "top-center",
      });
    },
  });

  const stop = () => {
    stopGeneration();

    const lastMessage = messages.at(-1);
    const lastMessageLastPart = lastMessage?.parts.at(-1);
    if (
      lastMessage?.role === "assistant" &&
      lastMessageLastPart?.type === "tool-invocation"
    ) {
      setMessages((prev) => [
        ...prev.slice(0, -1),
        {
          ...lastMessage,
          parts: [
            ...lastMessage.parts.slice(0, -1),
            {
              ...lastMessageLastPart,
              toolInvocation: {
                ...lastMessageLastPart.toolInvocation,
                state: "result",
                result: ABORTED,
              },
            },
          ],
        },
      ]);
    }
  };

  const isLoading = status !== "ready";
  useEventPipeline(messages, activeSessionId);

  return (
    <div className="flex flex-col h-full w-full bg-white overflow-hidden">
      <div className="flex items-center justify-between border-b border-zinc-200 px-4 py-4">
        <AISDKLogo />
        <DeployButton />
      </div>

      <div className="flex-1 overflow-y-auto p-4" ref={containerRef}>
        {messages.length === 0 ? <ProjectInfo /> : null}
        {messages.map((message, index) => (
          <PreviewMessage
            key={message.id}
            message={message}
            status={status}
            isLatestMessage={index === messages.length - 1}
            onToolInvocationClick={setSelectedEventId}
          />
        ))}
        <div ref={endRef} className="pb-2" />
      </div>

      {messages.length === 0 ? (
        <PromptSuggestions
          disabled={isInitializing}
          submitPrompt={(prompt: string) => append({ role: "user", content: prompt })}
        />
      ) : null}

      <div className="bg-white">
        <form onSubmit={handleSubmit} className="p-4">
          <Input
            handleInputChange={handleInputChange}
            input={input}
            isInitializing={isInitializing}
            isLoading={isLoading}
            status={status}
            stop={stop}
          />
        </form>
      </div>
    </div>
  );
}

export function ChatArea() {
  const activeSessionId = useAgentStore((state) => state.activeSessionId);
  return <ChatAreaInner key={activeSessionId ?? "no-session"} />;
}
