"use client";

import { memo, useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { getDesktopURL } from "@/lib/sandbox/utils";
import { toast } from "sonner";
import { useSandboxStore } from "@/store/useSandboxStore";

const VNCViewerComponent = () => {
  const sandboxId = useSandboxStore((state) => state.sandboxId);
  const setSandboxId = useSandboxStore((state) => state.setSandboxId);
  const isInitializing = useSandboxStore((state) => state.isInitializing);
  const setIsInitializing = useSandboxStore((state) => state.setIsInitializing);
  const [streamUrl, setStreamUrl] = useState<string | null>(null);
  const initialSandboxId = useRef(sandboxId);

  const initializeDesktop = async (id?: string) => {
    try {
      setIsInitializing(true);
      const desktop = await getDesktopURL(id);
      setStreamUrl(desktop.streamUrl);
      setSandboxId(desktop.id);
    } catch (error) {
      console.error("Failed to initialize desktop:", error);
      toast.error("Failed to initialize desktop");
    } finally {
      setIsInitializing(false);
    }
  };

  const refreshDesktop = async () => {
    await initializeDesktop(sandboxId ?? undefined);
  };

  useEffect(() => {
    void initializeDesktop(initialSandboxId.current ?? undefined);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!sandboxId) return;

    const killDesktop = () => {
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
      return () => {
        window.removeEventListener("pagehide", killDesktop);
        killDesktop();
      };
    }

    window.addEventListener("beforeunload", killDesktop);
    return () => {
      window.removeEventListener("beforeunload", killDesktop);
      killDesktop();
    };
  }, [sandboxId]);

  return (
    <div className="relative flex flex-col h-full w-full bg-zinc-900 overflow-hidden">
      {streamUrl ? (
        <>
          <iframe
            src={streamUrl}
            className="h-full w-full"
            style={{
              transformOrigin: "center",
              width: "100%",
              height: "100%",
            }}
            allow="autoplay"
          />
          <Button
            onClick={refreshDesktop}
            className="absolute right-3 top-3 z-10 bg-black/60 text-white hover:bg-black/80"
            disabled={isInitializing}
          >
            {isInitializing ? "Creating desktop..." : "New desktop"}
          </Button>
        </>
      ) : (
        <div className="flex h-full items-center justify-center text-white">
          {isInitializing ? "Initializing desktop..." : "Loading stream..."}
        </div>
      )}
    </div>
  );
};

export const VNCViewer = memo(VNCViewerComponent);
