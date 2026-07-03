import { useDeferredValue, useEffect, useLayoutEffect, useRef, useState } from "react";

import { AgentPalette } from "./AgentPalette";
import { Composer } from "./Composer";
import { RequestSummaryRail } from "./RequestSummaryRail";
import { Sidebar } from "./Sidebar";
import { WorkspaceScene } from "./WorkspaceScene";
import { WorkspaceError, WorkspaceSkeleton } from "./WorkspaceStatus";
import {
  createChatSession,
  deleteChatSession,
  listChatSessions,
  pinChatSession,
  renameChatSession,
  startChatSession,
  unpinChatSession,
} from "../api/chatSessions";
import {
  listSessionFiles,
  uploadSessionFile,
} from "../api/sessionFiles";
import {
  AGENT_DRAG_MIME_TYPE,
  EVALUATION_SIDE_RIGHT,
} from "../constants";
import { useWorkspaceScene } from "../hooks/useWorkspaceScene";
import { resetScenePlayback } from "../hooks/useScenePlayback";
import { resetJudgeVerdict } from "./JudgeVerdict";
import {
  createEvaluationAgent,
  createPendingAgent,
  createComposerRequest,
  createHypothesesFromRequests,
  applyChatSessionMetadata,
  createWorkspaceSessionFromChatSession,
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
  const [chatSearchQuery, setChatSearchQuery] = useState("");
  const [chatHistoryError, setChatHistoryError] = useState("");
  const [isCreatingChat, setIsCreatingChat] = useState(false);
  const [isUploadingSessionFile, setIsUploadingSessionFile] = useState(false);
  const [removedAttachmentIdsBySession, setRemovedAttachmentIdsBySession] = useState({});
  const sceneScrollRef = useRef(null);
  const deferredChatSearchQuery = useDeferredValue(chatSearchQuery);
  const selectedSession = sessions.find((session) => session.id === selectedChatId) ?? sessions[0] ?? null;
  const isAgentEditingLocked = selectedSession
    ? selectedSession.isStarted || (selectedSession.hypotheses ?? []).length > 0
    : false;
  const isProcessRunning = selectedSession
    ? selectedSession.isStarted && (selectedSession.launchedRequests ?? []).length > 0
    : false;

  useEffect(() => {
    if (status !== "success" || !data) {
      return;
    }

    const controller = new AbortController();

    listChatSessions({
      accessToken,
      search: deferredChatSearchQuery,
      signal: controller.signal,
    })
      .then((payload) => {
        const nextSessions = payload.items.map((chatSession) =>
          createWorkspaceSessionFromChatSession(chatSession, data.sessions, data.palette.agents),
        );

        setSessions(nextSessions);
        setSelectedChatId((currentChatId) =>
          nextSessions.some((session) => session.id === currentChatId)
            ? currentChatId
            : nextSessions[0]?.id ?? null,
        );
        setChatHistoryError("");
      })
      .catch((error) => {
        if (error?.name === "AbortError") {
          return;
        }

        setChatHistoryError(error instanceof Error ? error.message : "Не удалось загрузить историю чатов.");
      });

    return () => controller.abort();
  }, [accessToken, data, deferredChatSearchQuery, status]);

  useEffect(() => {
    if (status !== "success" || !selectedChatId) {
      return undefined;
    }

    const controller = new AbortController();

    listSessionFiles({
      accessToken,
      chatSessionId: selectedChatId,
      signal: controller.signal,
    })
      .then((payload) => {
        const removedAttachmentIds = removedAttachmentIdsBySession[selectedChatId] ?? [];

        setSessions((currentSessions) =>
          currentSessions.map((session) =>
            session.id === selectedChatId
              ? {
                  ...session,
                  attachments: payload.items.filter((attachment) => !removedAttachmentIds.includes(attachment.id)),
                  maxFiles: payload.maxFiles,
                }
              : session,
          ),
        );
        setChatHistoryError("");
      })
      .catch((error) => {
        if (error?.name === "AbortError") {
          return;
        }

        setChatHistoryError(error instanceof Error ? error.message : "Не удалось загрузить файлы чата.");
      });

    return () => controller.abort();
  }, [accessToken, removedAttachmentIdsBySession, selectedChatId, status]);

  useLayoutEffect(() => {
    const sceneElement = sceneScrollRef.current;

    if (!sceneElement) {
      return undefined;
    }

    const resetSceneScroll = () => {
      sceneElement.scrollTop = 0;
      sceneElement.scrollLeft = 0;
    };

    resetSceneScroll();

    const animationFrameId = window.requestAnimationFrame(resetSceneScroll);
    const timeoutId = window.setTimeout(resetSceneScroll, 0);
    const lateTimeoutId = window.setTimeout(resetSceneScroll, 80);

    return () => {
      window.cancelAnimationFrame(animationFrameId);
      window.clearTimeout(timeoutId);
      window.clearTimeout(lateTimeoutId);
    };
  }, [selectedSession?.id]);

  useEffect(() => {
    document.title = selectedSession?.title
      ? `Hypothesis Court | ${selectedSession.title}`
      : "Hypothesis Court";

    return () => {
      document.title = "Hypothesis Court";
    };
  }, [selectedSession?.title]);

  if (status === "loading") {
    return <WorkspaceSkeleton />;
  }

  if (status === "error" || !data) {
    return <WorkspaceError />;
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

  async function handleCreateChat() {
    const unstartedSession = sessions.find((session) => !session.isStarted);
    if (unstartedSession) {
      setChatSearchQuery("");
      setSelectedChatId(unstartedSession.id);
      setDraftMessage("");
      return;
    }

    setIsCreatingChat(true);
    setChatHistoryError("");

    try {
      const chatSession = await createChatSession({
        accessToken,
        title: data.shell.navigation.newChatLabel,
      });
      const nextSession = createWorkspaceSessionFromChatSession(chatSession, data.sessions, data.palette.agents);
      setChatSearchQuery("");
      setSessions((currentSessions) => [
        nextSession,
        ...currentSessions.filter((session) => session.id !== nextSession.id),
      ]);
      setSelectedChatId(nextSession.id);
      setDraftMessage("");
    } catch (error) {
      setChatHistoryError(error instanceof Error ? error.message : "Не удалось создать чат.");
    } finally {
      setIsCreatingChat(false);
    }
  }

  function handleToggleSidebar() {
    setIsSidebarCollapsed((currentValue) => !currentValue);
  }

  async function handleRenameChat(chatId, nextTitle) {
    const normalizedTitle = nextTitle.trim();

    if (!normalizedTitle) {
      return;
    }

    setChatHistoryError("");

    try {
      const chatSession = await renameChatSession({
        accessToken,
        chatSessionId: chatId,
        title: normalizedTitle,
      });
      setSessions((currentSessions) =>
        currentSessions.map((session) =>
          session.id === chatId ? applyChatSessionMetadata(session, chatSession) : session,
        ),
      );
    } catch (error) {
      setChatHistoryError(error instanceof Error ? error.message : "Не удалось переименовать чат.");
    }
  }

  async function handleTogglePinChat(chatId) {
    const session = sessions.find((item) => item.id === chatId);

    if (!session) {
      return;
    }

    setChatHistoryError("");

    try {
      const chatSession = session.isPinned
        ? await unpinChatSession({ accessToken, chatSessionId: chatId })
        : await pinChatSession({ accessToken, chatSessionId: chatId });

      setSessions((currentSessions) =>
        currentSessions.map((item) =>
          item.id === chatId ? applyChatSessionMetadata(item, chatSession) : item,
        ),
      );
    } catch (error) {
      setChatHistoryError(error instanceof Error ? error.message : "Не удалось изменить закрепление чата.");
    }
  }

  async function handleDeleteChat(chatId) {
    setChatHistoryError("");

    try {
      await deleteChatSession({ accessToken, chatSessionId: chatId });
      const nextSessions = sessions.filter((session) => session.id !== chatId);

      setSessions(nextSessions);

      if (selectedChatId === chatId) {
        setSelectedChatId(nextSessions[0]?.id ?? null);
      }
    } catch (error) {
      setChatHistoryError(error instanceof Error ? error.message : "Не удалось удалить чат.");
    }
  }

  async function handleAttachFiles(fileList) {
    const files = Array.from(fileList ?? []).filter(Boolean);

    if (!selectedSession || isProcessRunning || files.length === 0) {
      return;
    }

    setIsUploadingSessionFile(true);
    setChatHistoryError("");

    try {
      for (const file of files) {
        const uploadedFile = await uploadSessionFile({
          accessToken,
          chatSessionId: selectedSession.id,
          file,
        });

        setSessions((currentSessions) =>
          currentSessions.map((session) =>
            session.id === selectedSession.id
              ? {
                  ...session,
                  attachments: [
                    ...(session.attachments ?? []).filter((attachment) => attachment.id !== uploadedFile.id),
                    uploadedFile,
                  ],
                }
              : session,
          ),
        );
      }
    } catch (error) {
      setChatHistoryError(error instanceof Error ? error.message : "Не удалось загрузить файл.");
    } finally {
      setIsUploadingSessionFile(false);
    }
  }

  function handleRemoveAttachment(attachmentId) {
    if (isProcessRunning) {
      return;
    }

    setRemovedAttachmentIdsBySession((currentValue) => ({
      ...currentValue,
      [selectedSession.id]: [...(currentValue[selectedSession.id] ?? []), attachmentId],
    }));
    updateSelectedSession((session) => ({
      ...session,
      attachments: (session.attachments ?? []).filter((attachment) => attachment.id !== attachmentId),
    }));
  }

  function handleAddAgent() {
    if (isAgentEditingLocked) {
      return;
    }

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
    if (isAgentEditingLocked) {
      event.preventDefault();
      return;
    }

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

    if (isAgentEditingLocked) {
      return;
    }

    const payload = readAgentDragPayload(event);

    if (payload?.source !== "palette") {
      return;
    }

    handleMoveAgentToEvaluation(payload.agentId, edge);
  }

  function handleDropAgentToPalette(event) {
    event.preventDefault();
    setDragSource(null);

    if (isAgentEditingLocked) {
      return;
    }

    const payload = readAgentDragPayload(event);

    if (payload?.source !== "evaluation") {
      return;
    }

    handleMoveAgentToPalette(payload.agentId);
  }

  function handleReorderPaletteAgent(agentId, targetAgentId, placement) {
    if (isAgentEditingLocked) {
      return;
    }

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
      isStarted: true,
      isPendingDraft: false,
      title: nextTitle,
      query: nextQuery,
      launchedRequests: composerRequests,
      hypotheses: createHypothesesFromRequests(composerRequests),
      composerRequests: [],
    }));
    void handleRenameChat(selectedSession.id, nextTitle);
    void startChatSession({ accessToken, chatSessionId: selectedSession.id })
      .then((chatSession) => {
        setSessions((currentSessions) =>
          currentSessions.map((session) =>
            session.id === selectedSession.id && (session.launchedRequests ?? []).length > 0
              ? applyChatSessionMetadata(session, chatSession)
              : session,
          ),
        );
      })
      .catch((error) => {
        setChatHistoryError(error instanceof Error ? error.message : "Не удалось запустить чат.");
      });

    setDraftMessage("");
  }

  function handleStopProcess() {
    const restoredRequests = selectedSession.launchedRequests ?? [];

    resetScenePlayback(selectedSession.id);
    resetJudgeVerdict(selectedSession.id);
    setDraftMessage("");

    updateSelectedSession((session) => ({
      ...session,
      isStarted: false,
      isPendingDraft: true,
      launchedRequests: [],
      composerRequests: restoredRequests,
      hypotheses: [],
      answer: "",
    }));
  }

  function handleRemoveComposerRequest(requestId) {
    updateSelectedSession((session) => ({
      ...session,
      composerRequests: (session.composerRequests ?? []).filter((request) => request.id !== requestId),
    }));
  }

  const sidebar = (
    <Sidebar
      accessToken={accessToken}
      shell={data.shell}
      currentUser={currentUser}
      accountProfile={accountProfile}
      sessions={sessions}
      selectedChatId={selectedSession?.id ?? null}
      isCollapsed={isSidebarCollapsed}
      isNewChatDisabled={isCreatingChat}
      chatSearchQuery={chatSearchQuery}
      chatHistoryError={chatHistoryError}
      onLogout={onLogout}
      onLogoutAll={onLogoutAll}
      onUpdateCurrentUserProfile={onUpdateCurrentUserProfile}
      onUploadAvatar={onUploadAvatar}
      onChangePassword={onChangePassword}
      onSelectChat={handleSelectChat}
      onCreateChat={handleCreateChat}
      onToggleSidebar={handleToggleSidebar}
      onChatSearchQueryChange={setChatSearchQuery}
      onRenameChat={handleRenameChat}
      onTogglePinChat={handleTogglePinChat}
      onDeleteChat={handleDeleteChat}
    />
  );

  if (!selectedSession) {
    return (
      <main className={`workspace${isSidebarCollapsed ? " workspace--sidebar-collapsed" : ""}`}>
        {sidebar}
        <section className="workspace-main workspace-main--empty" />
        <aside className="agent-palette" aria-hidden="true" />
      </main>
    );
  }

  return (
    <main className={`workspace${isSidebarCollapsed ? " workspace--sidebar-collapsed" : ""}`}>
      {sidebar}

      <section className="workspace-main">
        <RequestSummaryRail requests={selectedSession.launchedRequests ?? []} />

        <div className="workspace-main__scene" ref={sceneScrollRef}>
          <WorkspaceScene
            session={selectedSession}
            onAgentDragStart={handleAgentDragStart}
            onAgentDragEnd={handleAgentDragEnd}
            onDropAgentToEvaluation={handleDropAgentToEvaluation}
            dragSource={dragSource}
            isAgentEditingLocked={isAgentEditingLocked}
          />
        </div>

        <Composer
          composer={data.composer}
          sessionId={selectedSession.id}
          attachments={selectedSession.attachments ?? []}
          composerRequests={selectedSession.composerRequests ?? []}
          draftMessage={draftMessage}
          isAttachmentUploading={isUploadingSessionFile}
          isProcessRunning={isProcessRunning}
          canEditAttachments={!isProcessRunning}
          onDraftMessageChange={setDraftMessage}
          onAttachFiles={handleAttachFiles}
          onRemoveAttachment={handleRemoveAttachment}
          onRemoveComposerRequest={handleRemoveComposerRequest}
          onStop={handleStopProcess}
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
        isAddAgentDisabled={isAgentEditingLocked || hasPendingAgent(selectedSession)}
        isAgentEditingLocked={isAgentEditingLocked}
        lockedReason="Агентов можно менять только до старта процесса."
        onAddAgent={handleAddAgent}
      />
    </main>
  );
}
