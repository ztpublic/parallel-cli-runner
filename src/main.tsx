import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import { ErrorBoundary } from "./components/ErrorBoundary";
import { TooltipProvider } from "./components/Tooltip";

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    <ErrorBoundary>
      <TooltipProvider delayDuration={350}>
        <App />
      </TooltipProvider>
    </ErrorBoundary>
  </React.StrictMode>,
);
