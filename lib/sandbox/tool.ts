import { tool } from "ai";
import { z } from "zod";
import { getDesktop } from "./utils";

const wait = async (seconds: number) => {
  await new Promise((resolve) => setTimeout(resolve, seconds * 1000));
};

export const resolution = { x: 1024, y: 768 };

const DISPLAY_ENV = { DISPLAY: ":99" };

const keyMap: Record<string, string> = {
  Return: "Return",
  enter: "Return",
  tab: "Tab",
  space: "space",
  backspace: "BackSpace",
  delete: "Delete",
  escape: "Escape",
  up: "Up",
  down: "Down",
  left: "Left",
  right: "Right",
  home: "Home",
  end: "End",
  pageup: "Prior",
  pagedown: "Next",
  f1: "F1", f2: "F2", f3: "F3", f4: "F4",
  f5: "F5", f6: "F6", f7: "F7", f8: "F8",
  f9: "F9", f10: "F10", f11: "F11", f12: "F12",
  shift: "Shift_L",
  control: "Control_L",
  ctrl: "Control_L",
  alt: "Alt_L",
  super: "Super_L",
  meta: "Super_L",
};

function mapKey(key: string): string {
  if (key.includes("+")) {
    return key.split("+").map((p) => keyMap[p.toLowerCase()] || p).join("+");
  }
  return keyMap[key.toLowerCase()] || keyMap[key] || key;
}

export const computerTool = (sandboxId: string | null) =>
  tool({
    description:
      "Use the computer to perform mouse and keyboard actions, and take screenshots. " +
      "Always take a screenshot first to see the current state of the screen before acting.",
    parameters: z.object({
      action: z.enum([
        "screenshot",
        "left_click",
        "right_click",
        "double_click",
        "mouse_move",
        "type",
        "key",
        "scroll",
        "wait",
        "left_click_drag",
      ]).describe("The action to perform"),
      coordinate: z
        .array(z.number())
        .length(2)
        .optional()
        .describe("The [x, y] pixel coordinate for mouse actions"),
      start_coordinate: z
        .array(z.number())
        .length(2)
        .optional()
        .describe("The [x, y] start coordinate for drag actions"),
      text: z.string().optional().describe("Text to type or key to press"),
      duration: z
        .number()
        .optional()
        .describe("Duration in seconds for the wait action"),
      scroll_direction: z
        .enum(["up", "down", "left", "right"])
        .optional()
        .describe("Direction to scroll"),
      scroll_amount: z
        .number()
        .optional()
        .describe("Number of scroll clicks"),
    }),
    execute: async ({
      action,
      coordinate,
      start_coordinate,
      text,
      duration,
      scroll_amount,
      scroll_direction,
    }) => {
      const sandbox = await getDesktop(sandboxId ?? undefined);

      switch (action) {
        case "screenshot": {
          await sandbox.runCommand({
            cmd: "import",
            args: ["-window", "root", "/tmp/screenshot.png"],
            env: DISPLAY_ENV,
          });
          const buffer = await sandbox.readFileToBuffer({
            path: "/tmp/screenshot.png",
          });
          if (!buffer) throw new Error("Failed to read screenshot");
          const base64Data = buffer.toString("base64");
          return [
            {
              type: "image" as const,
              image: base64Data,
              mimeType: "image/png" as const,
            },
          ];
        }
        case "wait": {
          const actualDuration = Math.min(duration ?? 1, 2);
          await wait(actualDuration);
          return `Waited for ${actualDuration} seconds`;
        }
        case "left_click": {
          if (!coordinate) throw new Error("Coordinate required");
          const [x, y] = coordinate;
          await sandbox.runCommand({
            cmd: "xdotool",
            args: ["mousemove", "--sync", String(x), String(y), "click", "1"],
            env: DISPLAY_ENV,
          });
          return `Left clicked at (${x}, ${y})`;
        }
        case "double_click": {
          if (!coordinate) throw new Error("Coordinate required");
          const [x, y] = coordinate;
          await sandbox.runCommand({
            cmd: "xdotool",
            args: ["mousemove", "--sync", String(x), String(y), "click", "--repeat", "2", "1"],
            env: DISPLAY_ENV,
          });
          return `Double clicked at (${x}, ${y})`;
        }
        case "right_click": {
          if (!coordinate) throw new Error("Coordinate required");
          const [x, y] = coordinate;
          await sandbox.runCommand({
            cmd: "xdotool",
            args: ["mousemove", "--sync", String(x), String(y), "click", "3"],
            env: DISPLAY_ENV,
          });
          return `Right clicked at (${x}, ${y})`;
        }
        case "mouse_move": {
          if (!coordinate) throw new Error("Coordinate required");
          const [x, y] = coordinate;
          await sandbox.runCommand({
            cmd: "xdotool",
            args: ["mousemove", "--sync", String(x), String(y)],
            env: DISPLAY_ENV,
          });
          return `Moved mouse to (${x}, ${y})`;
        }
        case "type": {
          if (!text) throw new Error("Text required");
          await sandbox.runCommand({
            cmd: "xdotool",
            args: ["type", "--clearmodifiers", text],
            env: DISPLAY_ENV,
          });
          return `Typed: ${text}`;
        }
        case "key": {
          if (!text) throw new Error("Key required");
          const mappedKey = mapKey(text);
          await sandbox.runCommand({
            cmd: "xdotool",
            args: ["key", mappedKey],
            env: DISPLAY_ENV,
          });
          return `Pressed key: ${text}`;
        }
        case "scroll": {
          if (!scroll_direction) throw new Error("Scroll direction required");
          if (!scroll_amount) throw new Error("Scroll amount required");
          const button = scroll_direction === "up" ? "4" : "5";
          await sandbox.runCommand({
            cmd: "xdotool",
            args: ["click", "--repeat", String(scroll_amount), button],
            env: DISPLAY_ENV,
          });
          return `Scrolled ${scroll_direction} by ${scroll_amount}`;
        }
        case "left_click_drag": {
          if (!start_coordinate || !coordinate) throw new Error("Coordinates required");
          const [startX, startY] = start_coordinate;
          const [endX, endY] = coordinate;
          await sandbox.runCommand({
            cmd: "xdotool",
            args: [
              "mousemove", String(startX), String(startY),
              "mousedown", "1",
              "mousemove", "--sync", String(endX), String(endY),
              "mouseup", "1",
            ],
            env: DISPLAY_ENV,
          });
          return `Dragged from (${startX}, ${startY}) to (${endX}, ${endY})`;
        }
        default:
          throw new Error(`Unsupported action: ${action}`);
      }
    },
  });

export const bashTool = (sandboxId?: string | null) =>
  tool({
    description:
      "Run a bash command in the terminal. Use for file operations, installing packages, " +
      "running scripts, or any task better suited for the command line. " +
      "Prefer this over the computer tool when possible.",
    parameters: z.object({
      command: z.string().describe("The bash command to execute"),
    }),
    execute: async ({ command }) => {
      const sandbox = await getDesktop(sandboxId ?? undefined);
      try {
        const result = await sandbox.runCommand({
          cmd: "bash",
          args: ["-c", command],
          env: DISPLAY_ENV,
        });
        const stdout = await result.stdout();
        return stdout || "(Command executed successfully with no output)";
      } catch (error) {
        console.error("Bash command failed:", error);
        if (error instanceof Error) {
          return `Error executing command: ${error.message}`;
        }
        return `Error executing command: ${String(error)}`;
      }
    },
  });
