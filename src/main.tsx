import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import { ErrorBoundary, NotifyProvider } from "./components/Notify";
import { reportError } from "./lib/errors";
import "./styles/app.css";

// Anything that slips past the app's own handling still gets logged.
window.addEventListener("error", e => reportError("window.error", e.error ?? e.message, { source: e.filename, line: e.lineno }));
window.addEventListener("unhandledrejection", e => reportError("unhandledrejection", e.reason));

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <ErrorBoundary>
      <NotifyProvider>
        <App />
      </NotifyProvider>
    </ErrorBoundary>
  </StrictMode>,
);
