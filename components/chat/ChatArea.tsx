"use client";

import { useChat } from "@ai-sdk/react";
import { toast } from "sonner";
import { AISDKLogo } from "@/components/icons";
import { Input } from "@/components/input";
import { PreviewMessage } from "@/components/message";
import { DeployButton, ProjectInfo } from "@/components/project-info";
import { PromptSuggestions } from "@/components/prompt-suggestions";
import { useScrollToBottom } from "@/lib/use-scroll-to-bottom";
import { ABORTED } from "@/lib/utils";
import { useSandboxStore } from "@/store/useSandboxStore";

export function ChatArea() {
  const sandboxId = useSandboxStore((state) => state.sandboxId);
  const isInitializing = useSandboxStore((state) => state.isInitializing);
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
    id: sandboxId ?? undefined,
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

  return (
    <div className="flex h-full min-w-0 flex-col border-r border-zinc-200 bg-white">
      <div className="flex items-center justify-between border-b border-zinc-200 px-4 py-4">
        <AISDKLogo />
        <DeployButton />
      </div>

      <div className="flex-1 space-y-6 overflow-y-auto px-4 py-4" ref={containerRef}>
        {messages.length === 0 ? <ProjectInfo /> : null}
        {messages.map((message, index) => (
          <PreviewMessage
            message={message}
            key={message.id}
            isLoading={isLoading}
            status={status}
            isLatestMessage={index === messages.length - 1}
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
