import { flushSync } from "react-dom";

export function getAgentViewTransitionName(agentId) {
  return `agent-${String(agentId).replace(/[^a-zA-Z0-9_-]/g, "-")}`;
}

export function runLayoutTransition(updateState) {
  if (typeof document !== "undefined" && typeof document.startViewTransition === "function") {
    document.startViewTransition(() => {
      flushSync(updateState);
    });
    return;
  }

  updateState();
}
