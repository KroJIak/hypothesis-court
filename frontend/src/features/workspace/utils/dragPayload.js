import { AGENT_DRAG_MIME_TYPE } from "../constants";

export function readAgentDragPayload(event) {
  const rawPayload = event.dataTransfer.getData(AGENT_DRAG_MIME_TYPE);

  if (!rawPayload) {
    return null;
  }

  try {
    return JSON.parse(rawPayload);
  } catch {
    return null;
  }
}
