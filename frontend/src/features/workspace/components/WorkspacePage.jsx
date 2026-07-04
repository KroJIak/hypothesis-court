import { useDeferredValue, useEffect, useLayoutEffect, useRef, useState } from "react";

import { AgentPalette } from "./AgentPalette";
import { AgentMessageHistoryModal } from "./AgentMessageHistoryModal";
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
  createAnswerFromRequests,
  createChatTitleFromRequests,
  createConsultationAnswer,
  createComposerRequest,
  createHypothesesFromRequests,
  applyChatSessionMetadata,
  createWorkspaceSessionFromChatSession,
  formatComposerRequest,
  getInitialAvailableAgents,
  insertEvaluationAgentAtEdge,
  sortAvailableAgents,
} from "../model/workspaceSessionModel";
import { readAgentDragPayload } from "../utils/dragPayload";
import { runLayoutTransition } from "../utils/layoutTransition";
import "../workspace.css";

const CUSTOM_AGENTS_STORAGE_KEY = "hypothesis-court.customAgents";

function readStoredCustomAgents() {
  if (typeof window === "undefined") {
    return [];
  }

  try {
    const rawValue = window.localStorage.getItem(CUSTOM_AGENTS_STORAGE_KEY);
    const parsedValue = rawValue ? JSON.parse(rawValue) : [];

    if (!Array.isArray(parsedValue)) {
      return [];
    }

    return parsedValue.map((agent) => ({
      ...agent,
      variant: agent.variant ?? "empty",
      isCustom: true,
      isEmpty: false,
      isPendingSetup: false,
    }));
  } catch {
    return [];
  }
}

function writeStoredCustomAgents(agents) {
  if (typeof window === "undefined") {
    return;
  }

  try {
    window.localStorage.setItem(CUSTOM_AGENTS_STORAGE_KEY, JSON.stringify(agents));
  } catch {
    // Storage is a convenience layer; UI state still works without it.
  }
}

function hasAgentInSession(session, agentId) {
  return [...(session.availableAgents ?? []), ...(session.evaluation?.agents ?? [])]
    .some((agent) => agent.id === agentId);
}

function syncCustomAgentsIntoSessions(sessions, customAgents) {
  if (customAgents.length === 0) {
    return sessions;
  }

  return sessions.map((session) => {
    const nextCustomAgents = customAgents.filter((agent) => !hasAgentInSession(session, agent.id));

    if (nextCustomAgents.length === 0) {
      return session;
    }

    return {
      ...session,
      availableAgents: sortAvailableAgents([...(session.availableAgents ?? []), ...nextCustomAgents]),
    };
  });
}

function removeAgentFromSessions(sessions, agentId) {
  return sessions.map((session) => ({
    ...session,
    availableAgents: (session.availableAgents ?? []).filter((agent) => agent.id !== agentId),
    evaluation: {
      ...session.evaluation,
      agents: (session.evaluation?.agents ?? []).filter((agent) => agent.id !== agentId),
    },
  }));
}

function updateAgentInSessions(sessions, updatedAgent) {
  return sessions.map((session) => ({
    ...session,
    availableAgents: (session.availableAgents ?? []).map((agent) =>
      agent.id === updatedAgent.id ? updatedAgent : agent,
    ),
    evaluation: {
      ...session.evaluation,
      agents: (session.evaluation?.agents ?? []).map((agent) =>
        agent.id === updatedAgent.id
          ? createEvaluationAgent(updatedAgent)
          : agent,
      ),
    },
  }));
}

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
  const [customAgents, setCustomAgents] = useState(() => readStoredCustomAgents());
  const [activePendingAgentId, setActivePendingAgentId] = useState(null);
  const [activeAgentHistoryTarget, setActiveAgentHistoryTarget] = useState(null);
  const sceneScrollRef = useRef(null);
  const addAgentFrameRef = useRef(null);
  const deferredChatSearchQuery = useDeferredValue(chatSearchQuery);
  const selectedSession = sessions.find((session) => session.id === selectedChatId) ?? sessions[0] ?? null;
  const isAgentEditingLocked = selectedSession
    ? selectedSession.isStarted || (selectedSession.hypotheses ?? []).length > 0
    : false;
  const isProcessRunning = selectedSession
    ? selectedSession.isStarted
      && (selectedSession.launchedRequests ?? []).length > 0
      && !selectedSession.isVerdictComplete
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
        const paletteAgents = [...data.palette.agents, ...customAgents];
        const nextSessions = syncCustomAgentsIntoSessions(payload.items.map((chatSession) =>
          createWorkspaceSessionFromChatSession(chatSession, data.sessions, paletteAgents),
        ), customAgents);

        setSessions((currentSessions) =>
          syncCustomAgentsIntoSessions(nextSessions, customAgents).map((nextSession) => {
            const currentSession = currentSessions.find((session) => session.id === nextSession.id);

            return currentSession?.isStarted === nextSession.isStarted ? currentSession : nextSession;
          }),
        );
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
    setSessions((currentSessions) => syncCustomAgentsIntoSessions(currentSessions, customAgents));
  }, [customAgents]);

  useEffect(() => {
    setActiveAgentHistoryTarget(null);
  }, [selectedChatId]);

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

  useEffect(() => {
    setActivePendingAgentId(null);
  }, [selectedSession?.id, isAgentEditingLocked]);

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
      const nextSession = createWorkspaceSessionFromChatSession(
        chatSession,
        data.sessions,
        [...data.palette.agents, ...customAgents],
      );
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

    if (addAgentFrameRef.current !== null) {
      return;
    }

    addAgentFrameRef.current = window.requestAnimationFrame(() => {
      addAgentFrameRef.current = null;
    });

    updateSelectedSession((session) => {
      const availableAgents = session.availableAgents ?? getInitialAvailableAgents(session, data.palette.agents);

      return {
        ...session,
        availableAgents: sortAvailableAgents([...availableAgents, createPendingAgent()]),
      };
    });
  }

  function handleOpenPendingAgentSetup(agentId) {
    if (isAgentEditingLocked) {
      return;
    }

    const availableAgents = selectedSession.availableAgents ?? getInitialAvailableAgents(selectedSession, data.palette.agents);
    const editableAgent = availableAgents.find((agent) => (
      agent.id === agentId
        && (agent.isPendingSetup || !agent.isEmpty)
    ));

    if (!editableAgent) {
      return;
    }

    setActivePendingAgentId(agentId);
  }

  function handleChangePendingAgentSetup(agentId, changes) {
    if (isAgentEditingLocked) {
      return;
    }

    updateSelectedSession((session) => ({
      ...session,
      availableAgents: (session.availableAgents ?? getInitialAvailableAgents(session, data.palette.agents)).map((agent) =>
        agent.id === agentId && (agent.isPendingSetup || !agent.isEmpty)
          ? {
              ...agent,
              ...changes,
            }
          : agent,
      ),
    }));
  }

  function handleGeneratePendingAgentPrompt(agentId) {
    if (isAgentEditingLocked) {
      return;
    }

    const availableAgents = selectedSession.availableAgents ?? getInitialAvailableAgents(selectedSession, data.palette.agents);
    const pendingAgent = availableAgents.find((agent) => agent.id === agentId && (agent.isPendingSetup || !agent.isEmpty));

    if (!pendingAgent) {
      return;
    }

    const nextName = pendingAgent.name?.trim() || "Новый эксперт";
    const prompt = [
      `Ты агент "${nextName}" в проверке гипотез.`,
      "Сфокусируйся на своей зоне ответственности, формулируй выводы коротко и проверяемо.",
      "Отмечай риски, недостающие данные и условия, при которых гипотеза становится сильнее или слабее.",
      "Не повторяй выводы других агентов без добавления новой оценки.",
    ].join("\n\n");

    handleChangePendingAgentSetup(agentId, {
      name: nextName,
      variant: pendingAgent.variant ?? "empty",
      systemPrompt: prompt,
    });
  }

  function handleSavePendingAgentSetup(agentId) {
    if (isAgentEditingLocked) {
      return;
    }

    const availableAgents = selectedSession.availableAgents ?? getInitialAvailableAgents(selectedSession, data.palette.agents);
    const pendingAgent = availableAgents.find((agent) => (
      agent.id === agentId
        && (agent.isPendingSetup || !agent.isEmpty)
    ));
    const nextName = pendingAgent?.name?.trim() || "Новый эксперт";
    const nextSystemPrompt = pendingAgent?.systemPrompt?.trim() ?? "";

    if (!pendingAgent) {
      return;
    }

    const isCustomAgent = Boolean(pendingAgent.isCustom || pendingAgent.isPendingSetup);
    const configuredAgent = {
      ...pendingAgent,
      name: nextName,
      variant: pendingAgent.variant ?? "empty",
      systemPrompt: nextSystemPrompt,
      isCustom: isCustomAgent,
      isEmpty: false,
      isPendingSetup: false,
    };

    setSessions((currentSessions) => {
      const nextSessions = currentSessions.map((session) => {
        if (session.id !== selectedSession.id) {
          return session;
        }

        return {
          ...session,
          availableAgents: sortAvailableAgents(
            (session.availableAgents ?? getInitialAvailableAgents(session, data.palette.agents)).map((agent) =>
              agent.id === agentId && (agent.isPendingSetup || !agent.isEmpty) ? configuredAgent : agent,
            ),
          ),
        };
      });

      return configuredAgent.isCustom
        ? updateAgentInSessions(nextSessions, configuredAgent)
        : nextSessions;
    });

    if (configuredAgent.isCustom) {
      setCustomAgents((currentAgents) => {
        const nextAgents = sortAvailableAgents([
          ...currentAgents.filter((agent) => agent.id !== configuredAgent.id),
          configuredAgent,
        ]);

        writeStoredCustomAgents(nextAgents);
        return nextAgents;
      });
    }

    setActivePendingAgentId(null);
  }

  function handleDeletePendingAgentSetup(agentId) {
    if (isAgentEditingLocked) {
      return;
    }

    const availableAgents = selectedSession.availableAgents ?? getInitialAvailableAgents(selectedSession, data.palette.agents);
    const agent = availableAgents.find((availableAgent) => (
      availableAgent.id === agentId
        && (availableAgent.isPendingSetup || !availableAgent.isEmpty)
    ));

    if (!agent) {
      return;
    }

    if (agent.isCustom) {
      handleDeleteCustomAgent(agentId);
      return;
    }

    updateSelectedSession((session) => ({
      ...session,
      availableAgents: (session.availableAgents ?? getInitialAvailableAgents(session, data.palette.agents)).filter(
        (availableAgent) => availableAgent.id !== agentId,
      ),
    }));
    setActivePendingAgentId(null);
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

  function handleMoveAgentToEvaluation(agentId, edge, insertionIndex) {
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
            agents: insertEvaluationAgentAtEdge(
              session.evaluation.agents,
              createEvaluationAgent(movingAgent),
              edge,
              insertionIndex,
            ),
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

  function handleDropAgentToEvaluation(event, dropTarget = EVALUATION_SIDE_RIGHT) {
    event.preventDefault();
    setDragSource(null);

    if (isAgentEditingLocked) {
      return;
    }

    const payload = readAgentDragPayload(event);

    if (payload?.source !== "palette") {
      return;
    }

    const edge = typeof dropTarget === "string" ? dropTarget : dropTarget.side;
    const insertionIndex = typeof dropTarget === "string" ? undefined : dropTarget.index;

    handleMoveAgentToEvaluation(payload.agentId, edge, insertionIndex);
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

  function handleDeleteCustomAgent(agentId) {
    if (isAgentEditingLocked || !customAgents.some((agent) => agent.id === agentId)) {
      return;
    }

    runLayoutTransition(() => {
      setCustomAgents((currentAgents) => {
        const nextAgents = currentAgents.filter((agent) => agent.id !== agentId);

        writeStoredCustomAgents(nextAgents);
        return nextAgents;
      });
      setSessions((currentSessions) => removeAgentFromSessions(currentSessions, agentId));
      setActivePendingAgentId((currentAgentId) => (currentAgentId === agentId ? null : currentAgentId));
      setDragSource(null);
    });
  }

  function handleSend({ context, text }) {
    const nextText = text.trim();
    const composerRequests = selectedSession.composerRequests ?? [];

    if (selectedSession.isVerdictComplete) {
      if (!nextText) {
        return;
      }

      updateSelectedSession((session) => ({
        ...session,
        consultationMessages: [
          ...(session.consultationMessages ?? []),
          {
            id: `consultation-${Date.now()}`,
            question: nextText,
            answer: createConsultationAnswer(nextText, session),
          },
        ],
      }));
      setDraftMessage("");
      return;
    }

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
    const nextTitle = createChatTitleFromRequests(composerRequests);

    updateSelectedSession((session) => ({
      ...session,
      isStarted: true,
      isPendingDraft: false,
      title: nextTitle,
      query: nextQuery,
      launchedRequests: composerRequests,
      hypotheses: createHypothesesFromRequests(composerRequests),
      answer: createAnswerFromRequests(composerRequests),
      isVerdictComplete: false,
      consultationMessages: [],
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
      isVerdictComplete: false,
      consultationMessages: [],
    }));
  }

  function handleVerdictComplete() {
    updateSelectedSession((session) => (
      session.isVerdictComplete
        ? session
        : {
            ...session,
            isVerdictComplete: true,
          }
    ));
  }

  function handleOpenAgentHistory(target) {
    setActiveAgentHistoryTarget(target);
  }

  function handleCloseAgentHistory() {
    setActiveAgentHistoryTarget(null);
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
        <RequestSummaryRail requests={selectedSession.launchedRequests ?? []} title={selectedSession.title} />

        <div className="workspace-main__scene" ref={sceneScrollRef}>
          <WorkspaceScene
            session={selectedSession}
            onAgentDragStart={handleAgentDragStart}
            onAgentDragEnd={handleAgentDragEnd}
            onDropAgentToEvaluation={handleDropAgentToEvaluation}
            dragSource={dragSource}
            isAgentEditingLocked={isAgentEditingLocked}
            onVerdictComplete={handleVerdictComplete}
            onOpenAgentHistory={handleOpenAgentHistory}
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
          canEditAttachments={!selectedSession.isStarted}
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
        isDropTargetVisible={dragSource === "evaluation"}
        isAddAgentDisabled={isAgentEditingLocked}
        isAgentEditingLocked={isAgentEditingLocked}
        lockedReason="Агентов можно менять только до старта процесса."
        activePendingAgentId={activePendingAgentId}
        onOpenPendingAgentSetup={handleOpenPendingAgentSetup}
        onChangePendingAgentSetup={handleChangePendingAgentSetup}
        onGeneratePendingAgentPrompt={handleGeneratePendingAgentPrompt}
        onDeletePendingAgentSetup={handleDeletePendingAgentSetup}
        onSavePendingAgentSetup={handleSavePendingAgentSetup}
        onAddAgent={handleAddAgent}
      />

      {activeAgentHistoryTarget ? (
        <AgentMessageHistoryModal
          session={selectedSession}
          target={activeAgentHistoryTarget}
          onClose={handleCloseAgentHistory}
        />
      ) : null}
    </main>
  );
}
