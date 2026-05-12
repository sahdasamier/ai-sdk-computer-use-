import { createAnthropic } from '@ai-sdk/anthropic';

const packyAnthropic = createAnthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
  baseURL: 'https://www.packyapi.com/v1',
});
import { streamText, UIMessage } from "ai";
import { killDesktop } from "@/lib/sandbox/utils";
import { bashTool, computerTool } from "@/lib/sandbox/tool";
import { prunedMessages } from "@/lib/utils";

// Allow streaming responses up to 30 seconds
export const maxDuration = 300;

export async function POST(req: Request) {
  const { messages, sandboxId }: { messages: UIMessage[]; sandboxId: string } =
    await req.json();
  try {
    const result = streamText({
      model: packyAnthropic("claude-sonnet-4-6"),
      system:
        "You are a helpful assistant with full access to a Linux virtual machine. " +
        "\n\nENVIRONMENT:" +
        "\n- Display: X11 display :99 (1024×768). ALL computer-tool actions already target this display — do NOT manually set DISPLAY in commands." +
        "\n- Browser: Google Chrome is running on display :99, maximised to about:blank." +
        "\n- Shell: bash. User is root." +
        "\n\nTOOLS:" +
        "\n- Use the `computer` tool for GUI interaction (screenshot, click, type, scroll, key, mouse_move, drag)." +
        "\n- Use the `bash` tool for terminal commands, file operations, package installs, or anything not requiring GUI." +
        "\n- Always prefer `bash` when it can accomplish the task without the GUI." +
        "\n\nGUIDELINES:" +
        "\n- Start every new task by taking a screenshot to see the current state of the screen." +
        "\n- A screenshot showing only a dark/grey desktop means Chrome is still loading — wait 1–2 seconds and try again." +
        "\n- If Chrome shows a setup wizard or 'unsupported flag' warning bar, DISMISS IT and proceed." +
        "\n- After clicking or typing, take a screenshot to confirm the result before continuing." +
        "\n- If a step fails, diagnose with bash before retrying.",
      messages: prunedMessages(messages),
      tools: { computer: computerTool(sandboxId), bash: bashTool(sandboxId) },
      maxSteps: 30,
    });

    // Create response stream
    const response = result.toDataStreamResponse({
      getErrorMessage(error) {
        console.error(error);
        return error instanceof Error ? error.message : String(error);
      },
    });

    return response;
  } catch (error) {
    console.error("Chat API error:", error);
    await killDesktop(sandboxId);
    return new Response(JSON.stringify({ error: "Internal Server Error" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
}
