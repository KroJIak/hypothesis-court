import { useMemo } from "react";

import { mapWorkspaceScene } from "../adapters/mapWorkspaceScene";
import { workspaceUiConfigDto } from "../data/workspaceUiConfig";

export function useWorkspaceScene() {
  return useMemo(() => ({
    status: "success",
    data: mapWorkspaceScene(workspaceUiConfigDto),
  }), []);
}
