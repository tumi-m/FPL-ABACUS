"use client";

import { create } from "zustand";

/**
 * Cross-screen context — UI doc §11.2. Team id, gameweek and cohort selection
 * live here and persist across navigation; team id stays in sync with the
 * `gaffer_team` cookie so server components keep working.
 */
interface AppState {
  teamId: number | null;
  cohort: string;
  setTeamId: (id: number | null) => void;
  setCohort: (cohort: string) => void;
}

export const useAppStore = create<AppState>((set) => ({
  teamId: null,
  cohort: "overall",
  setTeamId: (teamId) => set({ teamId }),
  setCohort: (cohort) => set({ cohort }),
}));
