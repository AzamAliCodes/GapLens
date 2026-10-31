import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { Analysis, AtomicClaim, ClaimFinding, Evidence, Fact, Passage, Source, Verdict } from './types';

export interface EvidenceDrawerState {
  isOpen: boolean;
  source?: Source;
  passage?: Passage;
  quote?: string;
  claim?: string;
  fact?: Fact;
  facetName?: string;
  reason?: string;
  trustLabel?: 'sourced' | 'rule' | 'ai' | 'uncertain';
  evidence?: Evidence;
  finding?: ClaimFinding;
  atomicClaim?: AtomicClaim;
  contentHash?: string;
  quoteOffset?: { start: number; end: number };
  verdict?: Verdict;
}

interface GapLensState {
  currentAnalysis: Analysis | null;
  history: Analysis[];
  isAnalyzing: boolean;
  activeDrawer: EvidenceDrawerState;
  
  setCurrentAnalysis: (analysis: Analysis | null) => void;
  addToHistory: (analysis: Analysis) => void;
  clearHistory: () => void;
  setIsAnalyzing: (val: boolean) => void;
  openDrawer: (data: Omit<EvidenceDrawerState, 'isOpen'>) => void;
  closeDrawer: () => void;
  toggleChecklistItem: (itemId: string) => void;
}

export const useGapLensStore = create<GapLensState>()(
  persist(
    (set, get) => ({
      currentAnalysis: null,
      history: [],
      isAnalyzing: false,
      activeDrawer: { isOpen: false },

      setCurrentAnalysis: (analysis) => {
        set({ currentAnalysis: analysis });
        if (analysis) {
          get().addToHistory(analysis);
        }
      },

      addToHistory: (analysis) => {
        set((state) => {
          const filtered = state.history.filter((h) => h.id !== analysis.id);
          return { history: [analysis, ...filtered].slice(0, 10) };
        });
      },

      clearHistory: () => set({ history: [] }),

      setIsAnalyzing: (val) => set({ isAnalyzing: val }),

      openDrawer: (data) => set({ activeDrawer: { ...data, isOpen: true } }),

      closeDrawer: () => set((state) => ({ activeDrawer: { ...state.activeDrawer, isOpen: false } })),

      toggleChecklistItem: (itemId) => {
        set((state) => {
          if (!state.currentAnalysis) return state;
          const updatedChecklist = state.currentAnalysis.checklist.map((item) =>
            item.id === itemId ? { ...item, done: !item.done } : item
          );
          return {
            currentAnalysis: {
              ...state.currentAnalysis,
              checklist: updatedChecklist,
            },
          };
        });
      },
    }),
    {
      name: 'gaplens-storage',
      partialize: (state) => ({ history: state.history, currentAnalysis: state.currentAnalysis }),
    }
  )
);
