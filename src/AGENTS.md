# AGENTS.md

- Frontend is React + Vite + TypeScript, with Storybook stories under `src/stories`.
- Entry points: `src/main.tsx` and `src/App.tsx`.
- UI building blocks live in `src/components`, hooks in `src/hooks` (git-specific hooks in `src/hooks/git`), services in `src/services`, types in `src/types`, and mocks in `src/mocks` for TAURI_MOCK browser mode.
- AI Elements/ACP reference components live in `ai-elements-fork/`; stories in `src/stories/ai-elements` import from there.
- When UI behavior changes, update or add stories under `src/stories` if applicable.
