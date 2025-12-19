import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";

export type LLMProvider = "openai" | "anthropic" | "google";

export interface LLMSettings {
  provider: LLMProvider;
  apiKey: string;
  model?: string;
}

export interface SettingsState {
  // Selected repositories to track
  selectedRepos: string[];

  // GitHub Personal Access Token (for accessing restricted org repos)
  githubPat: string;
  useGithubPat: boolean;

  // LLM settings
  llmProvider: LLMProvider;
  apiKeys: Record<LLMProvider, string>;

  // Jira settings
  jiraBaseUrl: string;

  // UI preferences
  theme: "light" | "dark" | "system";

  // Actions
  setSelectedRepos: (repos: string[]) => void;
  addRepo: (repo: string) => void;
  removeRepo: (repo: string) => void;
  setGithubPat: (pat: string) => void;
  setUseGithubPat: (use: boolean) => void;
  setLLMProvider: (provider: LLMProvider) => void;
  setApiKey: (provider: LLMProvider, key: string) => void;
  getApiKey: () => string;
  setJiraBaseUrl: (url: string) => void;
  setTheme: (theme: "light" | "dark" | "system") => void;
  clearSettings: () => void;
}

const initialState = {
  selectedRepos: [] as string[],
  githubPat: "",
  useGithubPat: false,
  llmProvider: "openai" as LLMProvider,
  apiKeys: {
    openai: "",
    anthropic: "",
    google: "",
  },
  jiraBaseUrl: "https://jira.atlassian.net/browse",
  theme: "dark" as const,
};

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set, get) => ({
      ...initialState,

      setSelectedRepos: (repos) => set({ selectedRepos: repos }),

      addRepo: (repo) =>
        set((state) => ({
          selectedRepos: state.selectedRepos.includes(repo)
            ? state.selectedRepos
            : [...state.selectedRepos, repo],
        })),

      removeRepo: (repo) =>
        set((state) => ({
          selectedRepos: state.selectedRepos.filter((r) => r !== repo),
        })),

      setGithubPat: (pat) => set({ githubPat: pat }),

      setUseGithubPat: (use) => set({ useGithubPat: use }),

      setLLMProvider: (provider) => set({ llmProvider: provider }),

      setApiKey: (provider, key) =>
        set((state) => ({
          apiKeys: { ...state.apiKeys, [provider]: key },
        })),

      getApiKey: () => {
        const state = get();
        return state.apiKeys[state.llmProvider];
      },

      setJiraBaseUrl: (url) => set({ jiraBaseUrl: url }),

      setTheme: (theme) => set({ theme }),

      clearSettings: () => set(initialState),
    }),
    {
      name: "standup-settings",
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({
        selectedRepos: state.selectedRepos,
        githubPat: state.githubPat,
        useGithubPat: state.useGithubPat,
        llmProvider: state.llmProvider,
        apiKeys: state.apiKeys,
        jiraBaseUrl: state.jiraBaseUrl,
        theme: state.theme,
      }),
    }
  )
);
