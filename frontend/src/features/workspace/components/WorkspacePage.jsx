import { useEffect, useState } from "react";

import { AgentPalette } from "./AgentPalette";
import { Composer } from "./Composer";
import { RequestSummaryRail } from "./RequestSummaryRail";
import { Sidebar } from "./Sidebar";
import { WorkspaceScene } from "./WorkspaceScene";
import { WorkspaceError, WorkspaceSkeleton } from "./WorkspaceStatus";
import {
  AGENT_DRAG_MIME_TYPE,
  EVALUATION_SIDE_RIGHT,
} from "../constants";
import { useWorkspaceScene } from "../hooks/useWorkspaceScene";
import {
  createEvaluationAgent,
  createPendingAgent,
  createComposerRequest,
  createDraftWorkspaceSession,
  createHypothesesFromRequests,
  createWorkspaceSession,
  formatComposerRequest,
  getInitialAvailableAgents,
  hasPendingAgent,
  insertEvaluationAgentAtEdge,
  reorderAvailableAgents,
  sortAvailableAgents,
} from "../model/workspaceSessionModel";
import { readAgentDragPayload } from "../utils/dragPayload";
import { runLayoutTransition } from "../utils/layoutTransition";
import "../workspace.css";

export function WorkspacePage({
  accessToken,
  currentUser,
  accountProfile,
  onLogout,
  onLogoutAll,
  onUpdateCurrentUserProfile,
  onUploadAvatar,
  onChangePassword,
}) {
  const { status, data } = useWorkspaceScene();
  const [selectedChatId, setSelectedChatId] = useState(null);
  const [draftMessage, setDraftMessage] = useState("");
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [dragSource, setDragSource] = useState(null);
  const [sessions, setSessions] = useState([]);

  useEffect(() => {
    if (status !== "success" || !data) {
      return;
    }

    setSessions(data.sessions.map((session) => createWorkspaceSession(session, data.palette.agents)));
    setSelectedChatId(data.shell.currentChatId);
  }, [data, status]);

  if (status === "loading") {
    return <WorkspaceSkeleton />;
  }

  if (status === "error" || !data) {
    return <WorkspaceError />;
  }

  const selectedSession = sessions.find((session) => session.id === selectedChatId) ?? sessions[0] ?? null;
  const pendingDraftSession = sessions.find((session) => session.isPendingDraft) ?? null;

  if (!selectedSession) {
    return <WorkspaceSkeleton />;
  }

  function updateSelectedSession(mapSelectedSession) {
    setSessions((currentSessions) =>
      currentSessions.map((session) => {
        if (session.id !== selectedSession.id) {
          return session;
        }

        return mapSelectedSession(session);
      }),
    );
  }

  function handleSelectChat(chatId) {
    setSelectedChatId(chatId);
    setDraftMessage("");
  }

  function handleCreateChat() {
    if (pendingDraftSession) {
      setSelectedChatId(pendingDraftSession.id);
      setDraftMessage("");
      return;
    }

    const newChatId = `draft-${Date.now()}`;
    const newSession = createDraftWorkspaceSession(selectedSession, data.palette.agents, newChatId);

    setSessions((currentSessions) => [newSession, ...currentSessions]);
    setSelectedChatId(newChatId);
    setDraftMessage("");
  }

  function handleToggleSidebar() {
    setIsSidebarCollapsed((currentValue) => !currentValue);
  }

  function handleAddAgent() {
    if (hasPendingAgent(selectedSession)) {
      return;
    }

    updateSelectedSession((session) => {
      const availableAgents = session.availableAgents ?? getInitialAvailableAgents(session, data.palette.agents);

      return {
        ...session,
        availableAgents: sortAvailableAgents([...availableAgents, createPendingAgent()]),
      };
    });
  }

  function handleAgentDragStart(event, source, agentId) {
    setDragSource(source);
    event.dataTransfer.effectAllowed = "move";
    event.dataTransfer.setData(AGENT_DRAG_MIME_TYPE, JSON.stringify({ source, agentId }));
    event.dataTransfer.setData("text/plain", agentId);
  }

  function handleAgentDragEnd() {
    setDragSource(null);
  }

  function handleMoveAgentToEvaluation(agentId, edge) {
    runLayoutTransition(() => {
      updateSelectedSession((session) => {
        const availableAgents = session.availableAgents ?? getInitialAvailableAgents(session, data.palette.agents);
        const movingAgent = availableAgents.find((agent) => agent.id === agentId);

        if (!movingAgent || session.evaluation.agents.some((agent) => agent.id === agentId)) {
          return session;
        }

        return {
          ...session,
          availableAgents: availableAgents.filter((agent) => agent.id !== agentId),
          evaluation: {
            ...session.evaluation,
            layoutBias: edge,
            agents: insertEvaluationAgentAtEdge(session.evaluation.agents, createEvaluationAgent(movingAgent), edge),
          },
        };
      });
    });
  }

  function handleMoveAgentToPalette(agentId) {
    runLayoutTransition(() => {
      updateSelectedSession((session) => {
        const movingAgent = session.evaluation.agents.find((agent) => agent.id === agentId);

        if (!movingAgent) {
          return session;
        }

        const availableAgents = session.availableAgents ?? getInitialAvailableAgents(session, data.palette.agents);
        const nextAvailableAgents = availableAgents.some((agent) => agent.id === agentId)
          ? availableAgents
          : [movingAgent, ...availableAgents];

        return {
          ...session,
          availableAgents: nextAvailableAgents,
          evaluation: {
            ...session.evaluation,
            agents: session.evaluation.agents.filter((agent) => agent.id !== agentId),
          },
        };
      });
    });
  }

  function handleDropAgentToEvaluation(event, edge = EVALUATION_SIDE_RIGHT) {
    event.preventDefault();
    setDragSource(null);

    const payload = readAgentDragPayload(event);

    if (payload?.source !== "palette") {
      return;
    }

    handleMoveAgentToEvaluation(payload.agentId, edge);
  }

  function handleDropAgentToPalette(event) {
    event.preventDefault();
    setDragSource(null);

    const payload = readAgentDragPayload(event);

    if (payload?.source !== "evaluation") {
      return;
    }

    handleMoveAgentToPalette(payload.agentId);
  }

  function handleReorderPaletteAgent(agentId, targetAgentId, placement) {
    runLayoutTransition(() => {
      updateSelectedSession((session) => {
        const availableAgents = session.availableAgents ?? getInitialAvailableAgents(session, data.palette.agents);

        return {
          ...session,
          availableAgents: reorderAvailableAgents(availableAgents, agentId, targetAgentId, placement),
        };
      });
    });
  }

  function handleSend({ context, text }) {
    const nextText = text.trim();
    const composerRequests = selectedSession.composerRequests ?? [];

    if (!nextText && composerRequests.length === 0) {
      return;
    }

    if (nextText) {
      updateSelectedSession((session) => ({
        ...session,
        composerRequests: [...(session.composerRequests ?? []), createComposerRequest(context, nextText)],
      }));

      setDraftMessage("");
      return;
    }

    const nextQuery = composerRequests.map(formatComposerRequest).join("\n");
    const nextTitle = composerRequests.length === 1
      ? formatComposerRequest(composerRequests[0])
      : `${formatComposerRequest(composerRequests[0])} +${composerRequests.length - 1}`;

    updateSelectedSession((session) => ({
      ...session,
      isPendingDraft: false,
      title: nextTitle,
      query: nextQuery,
      launchedRequests: composerRequests,
      hypotheses: createHypothesesFromRequests(composerRequests),
      composerRequests: [],
    }));

    setDraftMessage("");
  }

  function handleRemoveComposerRequest(requestId) {
    updateSelectedSession((session) => ({
      ...session,
      composerRequests: (session.composerRequests ?? []).filter((request) => request.id !== requestId),
    }));
  }

  return (
    <main className={`workspace${isSidebarCollapsed ? " workspace--sidebar-collapsed" : ""}`}>
      <Sidebar
        accessToken={accessToken}
        shell={data.shell}
        currentUser={currentUser}
        accountProfile={accountProfile}
        sessions={sessions}
        selectedChatId={selectedSession.id}
        isCollapsed={isSidebarCollapsed}
        isNewChatDisabled={Boolean(pendingDraftSession)}
        onLogout={onLogout}
        onLogoutAll={onLogoutAll}
        onUpdateCurrentUserProfile={onUpdateCurrentUserProfile}
        onUploadAvatar={onUploadAvatar}
        onChangePassword={onChangePassword}
        onSelectChat={handleSelectChat}
        onCreateChat={handleCreateChat}
        onToggleSidebar={handleToggleSidebar}
      />

      <section className="workspace-main">
        <RequestSummaryRail requests={selectedSession.launchedRequests ?? []} />

        <div className="workspace-main__scene">
          <WorkspaceScene
            session={selectedSession}
            onAgentDragStart={handleAgentDragStart}
            onAgentDragEnd={handleAgentDragEnd}
            onDropAgentToEvaluation={handleDropAgentToEvaluation}
            dragSource={dragSource}
          />
        </div>

        <Composer
          composer={data.composer}
          attachments={selectedSession.attachments}
          composerRequests={selectedSession.composerRequests ?? []}
          draftMessage={draftMessage}
          onDraftMessageChange={setDraftMessage}
          onRemoveComposerRequest={handleRemoveComposerRequest}
          onSend={handleSend}
        />
      </section>

      <AgentPalette
        palette={data.palette}
        agents={selectedSession.availableAgents ?? getInitialAvailableAgents(selectedSession, data.palette.agents)}
        onAgentDragStart={handleAgentDragStart}
        onAgentDragEnd={handleAgentDragEnd}
        onDropAgentToPalette={handleDropAgentToPalette}
        onReorderPaletteAgent={handleReorderPaletteAgent}
        isDropTargetVisible={dragSource === "evaluation"}
        isAddAgentDisabled={hasPendingAgent(selectedSession)}
        onAddAgent={handleAddAgent}
      />
    </main>
  );
}
