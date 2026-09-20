import { create } from "zustand";
import { getChapterFrame } from "@/lib/journey-motion.mjs";

type JourneyState = {
  progress: number;
  chapter: number;
  setProgress: (progress: number) => void;
};

export const useJourneyStore = create<JourneyState>((set) => ({
  progress: 0,
  chapter: 0,
  setProgress: (progress) => {
    const frame = getChapterFrame(progress);
    set({ progress: frame.progress, chapter: frame.chapter });
  },
}));

