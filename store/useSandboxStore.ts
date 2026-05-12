"use client";

import { create } from "zustand";

interface SandboxStore {
  sandboxId: string | null;
  isInitializing: boolean;
  setSandboxId: (sandboxId: string | null) => void;
  setIsInitializing: (isInitializing: boolean) => void;
}

export const useSandboxStore = create<SandboxStore>((set) => ({
  sandboxId: null,
  isInitializing: true,
  setSandboxId: (sandboxId) => set({ sandboxId }),
  setIsInitializing: (isInitializing) => set({ isInitializing }),
}));
