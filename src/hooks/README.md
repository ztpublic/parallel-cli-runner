# Hooks

React hooks that encapsulate stateful UI logic (effects, event handlers, async flows) so `src/App.tsx` can stay mostly composition.

- Layout and pane state: `useLayoutState`.
- Keyboard behavior: `useHotkeys`.
- Dismiss helpers: `useDismiss`.
- Git data and actions: `src/hooks/git/*` (repos, staging, tabs, command error dialog).
