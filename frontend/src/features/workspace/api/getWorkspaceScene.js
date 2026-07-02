import { mapWorkspaceScene } from "../adapters/mapWorkspaceScene";
import { mockWorkspaceSceneDto } from "../data/mockWorkspaceScene";

export async function getWorkspaceScene() {
  return mapWorkspaceScene(mockWorkspaceSceneDto);
}
