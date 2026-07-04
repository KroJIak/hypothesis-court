import { useCallback, useDeferredValue, useEffect, useLayoutEffect, useRef, useState } from "react";

import { AgentPalette } from "./AgentPalette";
import { AgentMessageHistoryModal } from "./AgentMessageHistoryModal";
import { Composer } from "./Composer";
import { RequestSummaryRail } from "./RequestSummaryRail";
import { Sidebar } from "./Sidebar";
import { WorkspaceScene } from "./WorkspaceScene";
import { WorkspaceError, WorkspaceSkeleton } from "./WorkspaceStatus";
import { WorkspaceNotifications } from "./WorkspaceNotifications";
import {
  attachChatSessionAgent,
  createAgent as createUserAgent,
  deleteAgent as deleteUserAgent,
  detachChatSessionAgent,
  generateAgent as generateUserAgent,
  getAgentGenerationStatus,
  listAgents,
  listChatSessionAgents,
  updateAgent as updateUserAgent,
} from "../api/agents";
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

const WORKSPACE_NOTIFICATION_TTL_MS = 4200;
const WORKSPACE_NOTIFICATION_LIMIT = 5;

function getEmptyPaletteAgents(data) {
  return data.palette.agents.filter((agent) => agent.isEmpty);
}

function getPaletteAgents(userAgents, data) {
  return [...userAgents, ...getEmptyPaletteAgents(data)];
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

function applySelectedAgentsToSession(session, selectedAgents, userAgents, data) {
  const selectedAgentIds = new Set(selectedAgents.map((agent) => agent.id));

  return {
    ...session,
    availableAgents: sortAvailableAgents([
      ...userAgents.filter((agent) => !selectedAgentIds.has(agent.id)),
      ...getEmptyPaletteAgents(data),
    ]),
    evaluation: {
      ...session.evaluation,
      agents: selectedAgents.map(createEvaluationAgent),
    },
  };
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
  const [workspaceNotifications, setWorkspaceNotifications] = useState([]);
  const [isCreatingChat, setIsCreatingChat] = useState(false);
  const [isUploadingSessionFile, setIsUploadingSessionFile] = useState(false);
  const [removedAttachmentIdsBySession, setRemovedAttachmentIdsBySession] = useState({});
  const [userAgents, setUserAgents] = useState([]);
  const [isAgentGenerationAvailable, setIsAgentGenerationAvailable] = useState(false);
  const [activePendingAgentId, setActivePendingAgentId] = useState(null);
  const [activeAgentHistoryTarget, setActiveAgentHistoryTarget] = useState(null);
  const sceneScrollRef = useRef(null);
  const addAgentFrameRef = useRef(null);
  const notificationTimeoutsRef = useRef(new Map());
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
  const agentEditingLockedReason = selectedSession?.isVerdictComplete
    ? "Агентов нельзя менять в завершенном чате."
    : "Агентов можно менять только до старта процесса.";

  const showWorkspaceNotification = useCallback((message, type = "info") => {
    if (!message) {
      return;
    }

    const id = typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
      ? crypto.randomUUID()
      : `workspace-notification-${Date.now()}-${Math.random()}`;

    setWorkspaceNotifications((currentNotifications) => [
      ...currentNotifications,
      { id, message, type },
    ].slice(-WORKSPACE_NOTIFICATION_LIMIT));

    const timeoutId = window.setTimeout(() => {
      setWorkspaceNotifications((currentNotifications) =>
        currentNotifications.filter((notification) => notification.id !== id),
      );
      notificationTimeoutsRef.current.delete(id);
    }, WORKSPACE_NOTIFICATION_TTL_MS);

    notificationTimeoutsRef.current.set(id, timeoutId);
  }, []);

  const showWorkspaceError = useCallback((error, fallbackMessage) => {
    showWorkspaceNotification(error instanceof Error ? error.message : fallbackMessage, "error");
  }, [showWorkspaceNotification]);

  useEffect(() => () => {
    for (const timeoutId of notificationTimeoutsRef.current.values()) {
      window.clearTimeout(timeoutId);
    }
    notificationTimeoutsRef.current.clear();
  }, []);

  useEffect(() => {
    if (status !== "success" || !data) {
      return;
    }

    const controller = new AbortController();

    Promise.all([
      listChatSessions({
        accessToken,
        search: deferredChatSearchQuery,
        signal: controller.signal,
      }),
      listAgents({ accessToken, signal: controller.signal }),
      getAgentGenerationStatus({ accessToken, signal: controller.signal }),
    ])
      .then(([payload, agents, generationAvailable]) => {
        const paletteAgents = getPaletteAgents(agents, data);
        const nextSessions = payload.items.map((chatSession) =>
          createWorkspaceSessionFromChatSession(chatSession, data.sessions, paletteAgents),
        );

        setUserAgents(agents);
        setIsAgentGenerationAvailable(generationAvailable);
        setSessions((currentSessions) =>
          nextSessions.map((nextSession) => {
            const currentSession = currentSessions.find((session) => session.id === nextSession.id);

            return currentSession?.isStarted === nextSession.isStarted ? currentSession : nextSession;
          }),
        );
        setSelectedChatId((currentChatId) =>
          nextSessions.some((session) => session.id === currentChatId)
            ? currentChatId
            : nextSessions[0]?.id ?? null,
        );
      })
      .catch((error) => {
        if (error?.name === "AbortError") {
          return;
        }

        showWorkspaceError(error, "Не удалось загрузить историю чатов");
      });

    return () => controller.abort();
  }, [accessToken, data, deferredChatSearchQuery, showWorkspaceError, status]);

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
      })
      .catch((error) => {
        if (error?.name === "AbortError") {
          return;
        }

        showWorkspaceError(error, "Не удалось загрузить файлы чата");
      });

    return () => controller.abort();
  }, [accessToken, removedAttachmentIdsBySession, selectedChatId, showWorkspaceError, status]);

  useEffect(() => {
    if (status !== "success" || !selectedChatId || !data) {
      return undefined;
    }

    const controller = new AbortController();

    listChatSessionAgents({
      accessToken,
      chatSessionId: selectedChatId,
      signal: controller.signal,
    })
      .then((selectedAgents) => {
        setSessions((currentSessions) =>
          currentSessions.map((session) =>
            session.id === selectedChatId
              ? applySelectedAgentsToSession(session, selectedAgents, userAgents, data)
              : session,
          ),
        );
      })
      .catch((error) => {
        if (error?.name === "AbortError") {
          return;
        }

        showWorkspaceError(error, "Не удалось загрузить агентов чата");
      });

    return () => controller.abort();
  }, [accessToken, data, selectedChatId, showWorkspaceError, status, userAgents]);

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
    try {
      const chatSession = await createChatSession({
        accessToken,
        title: data.shell.navigation.newChatLabel,
      });
      const nextSession = createWorkspaceSessionFromChatSession(
        chatSession,
        data.sessions,
        getPaletteAgents(userAgents, data),
      );
      setChatSearchQuery("");
      setSessions((currentSessions) => [
        nextSession,
        ...currentSessions.filter((session) => session.id !== nextSession.id),
      ]);
      setSelectedChatId(nextSession.id);
      setDraftMessage("");
    } catch (error) {
      showWorkspaceError(error, "Не удалось создать чат");
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
      showWorkspaceError(error, "Не удалось переименовать чат");
    }
  }

  async function handleTogglePinChat(chatId) {
    const session = sessions.find((item) => item.id === chatId);

    if (!session) {
      return;
    }

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
      showWorkspaceError(error, "Не удалось изменить закрепление чата");
    }
  }

  async function handleDeleteChat(chatId) {
    try {
      await deleteChatSession({ accessToken, chatSessionId: chatId });
      const nextSessions = sessions.filter((session) => session.id !== chatId);

      setSessions(nextSessions);

      if (selectedChatId === chatId) {
        setSelectedChatId(nextSessions[0]?.id ?? null);
      }
    } catch (error) {
      showWorkspaceError(error, "Не удалось удалить чат");
    }
  }

  async function handleAttachFiles(fileList) {
    const files = Array.from(fileList ?? []).filter(Boolean);

    if (!selectedSession || isProcessRunning || files.length === 0) {
      return;
    }

    setIsUploadingSessionFile(true);
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
      showWorkspaceError(error, "Не удалось загрузить файл");
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

  async function handleAddAgent() {
    if (isAgentEditingLocked) {
      return;
    }

    if (addAgentFrameRef.current !== null) {
      return;
    }

    addAgentFrameRef.current = window.requestAnimationFrame(() => {
      addAgentFrameRef.current = null;
    });

    try {
      const createdAgent = await createUserAgent({ accessToken });
      setUserAgents((currentAgents) => sortAvailableAgents([...currentAgents, createdAgent]));
      setSessions((currentSessions) =>
        currentSessions.map((session) => ({
          ...session,
          availableAgents: sortAvailableAgents([
            ...((session.availableAgents ?? getInitialAvailableAgents(session, getPaletteAgents(userAgents, data)))
              .filter((agent) => !agent.isEmpty)),
            createdAgent,
            ...getEmptyPaletteAgents(data),
          ]),
        })),
      );
      setActivePendingAgentId(createdAgent.id);
    } catch (error) {
      showWorkspaceError(error, "Не удалось создать агента");
    }
  }

  function handleOpenPendingAgentSetup(agentId) {
    if (isAgentEditingLocked) {
      return;
    }

    const availableAgents = selectedSession.availableAgents ?? getInitialAvailableAgents(selectedSession, getPaletteAgents(userAgents, data));
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
      availableAgents: (session.availableAgents ?? getInitialAvailableAgents(session, getPaletteAgents(userAgents, data))).map((agent) =>
        agent.id === agentId && (agent.isPendingSetup || !agent.isEmpty)
          ? {
              ...agent,
              ...changes,
            }
          : agent,
      ),
    }));
  }

  async function handleGeneratePendingAgentPrompt(agentId) {
    if (isAgentEditingLocked) {
      return;
    }

    const availableAgents = selectedSession.availableAgents ?? getInitialAvailableAgents(selectedSession, getPaletteAgents(userAgents, data));
    const pendingAgent = availableAgents.find((agent) => agent.id === agentId && (agent.isPendingSetup || !agent.isEmpty));

    if (!pendingAgent) {
      return;
    }

    try {
      const generatedAgent = await generateUserAgent({
        accessToken,
        agentId,
        name: pendingAgent.name?.trim() || "Новый эксперт",
        systemPrompt: pendingAgent.systemPrompt ?? "",
      });
      setUserAgents((currentAgents) =>
        sortAvailableAgents(currentAgents.map((agent) => (agent.id === agentId ? generatedAgent : agent))),
      );
      setSessions((currentSessions) => updateAgentInSessions(currentSessions, generatedAgent));
    } catch (error) {
      showWorkspaceError(error, "Не удалось сгенерировать промпт агента");
    }
  }

  async function handleSavePendingAgentSetup(agentId) {
    if (isAgentEditingLocked) {
      return;
    }

    const availableAgents = selectedSession.availableAgents ?? getInitialAvailableAgents(selectedSession, getPaletteAgents(userAgents, data));
    const pendingAgent = availableAgents.find((agent) => (
      agent.id === agentId
        && (agent.isPendingSetup || !agent.isEmpty)
    ));
    const nextName = pendingAgent?.name?.trim() || "Новый эксперт";
    const nextSystemPrompt = pendingAgent?.systemPrompt?.trim() ?? "";

    if (!pendingAgent) {
      return;
    }

    try {
      const updatedAgent = await updateUserAgent({
        accessToken,
        agentId,
        name: nextName,
        variant: pendingAgent.variant ?? "empty",
        systemPrompt: nextSystemPrompt,
      });
      setUserAgents((currentAgents) =>
        sortAvailableAgents(currentAgents.map((agent) => (agent.id === agentId ? updatedAgent : agent))),
      );
      setSessions((currentSessions) => updateAgentInSessions(currentSessions, updatedAgent));
      setActivePendingAgentId(null);
    } catch (error) {
      showWorkspaceError(error, "Не удалось сохранить агента");
    }
  }

  async function handleDeletePendingAgentSetup(agentId) {
    if (isAgentEditingLocked) {
      return;
    }

    const availableAgents = selectedSession.availableAgents ?? getInitialAvailableAgents(selectedSession, getPaletteAgents(userAgents, data));
    const agent = availableAgents.find((availableAgent) => (
      availableAgent.id === agentId
        && (availableAgent.isPendingSetup || !availableAgent.isEmpty)
    ));

    if (!agent) {
      return;
    }

    try {
      await deleteUserAgent({ accessToken, agentId });
      setUserAgents((currentAgents) => currentAgents.filter((currentAgent) => currentAgent.id !== agentId));
      setSessions((currentSessions) => removeAgentFromSessions(currentSessions, agentId));
      setActivePendingAgentId(null);
      setDragSource(null);
    } catch (error) {
      showWorkspaceError(error, "Не удалось удалить агента");
    }
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
        const availableAgents = session.availableAgents ?? getInitialAvailableAgents(session, getPaletteAgents(userAgents, data));
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
    void attachChatSessionAgent({
      accessToken,
      chatSessionId: selectedSession.id,
      agentId,
      placement: edge,
      position: insertionIndex,
    })
      .then((selectedAgents) => {
        setSessions((currentSessions) =>
          currentSessions.map((session) =>
            session.id === selectedSession.id
              ? applySelectedAgentsToSession(session, selectedAgents, userAgents, data)
              : session,
          ),
        );
      })
      .catch((error) => {
        showWorkspaceError(error, "Не удалось добавить агента в чат");
      });
  }

  function handleMoveAgentToPalette(agentId) {
    runLayoutTransition(() => {
      updateSelectedSession((session) => {
        const movingAgent = session.evaluation.agents.find((agent) => agent.id === agentId);

        if (!movingAgent) {
          return session;
        }

        const availableAgents = session.availableAgents ?? getInitialAvailableAgents(session, getPaletteAgents(userAgents, data));
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
    void detachChatSessionAgent({
      accessToken,
      chatSessionId: selectedSession.id,
      agentId,
    })
      .then((selectedAgents) => {
        setSessions((currentSessions) =>
          currentSessions.map((session) =>
            session.id === selectedSession.id
              ? applySelectedAgentsToSession(session, selectedAgents, userAgents, data)
              : session,
          ),
        );
      })
      .catch((error) => {
        showWorkspaceError(error, "Не удалось убрать агента из чата");
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
        showWorkspaceError(error, "Не удалось запустить чат");
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
        <WorkspaceNotifications notifications={workspaceNotifications} />
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
        agents={selectedSession.availableAgents ?? getInitialAvailableAgents(selectedSession, getPaletteAgents(userAgents, data))}
        onAgentDragStart={handleAgentDragStart}
        onAgentDragEnd={handleAgentDragEnd}
        onDropAgentToPalette={handleDropAgentToPalette}
        isDropTargetVisible={dragSource === "evaluation"}
        isAddAgentDisabled={isAgentEditingLocked}
        isAgentEditingLocked={isAgentEditingLocked}
        lockedReason={agentEditingLockedReason}
        activePendingAgentId={activePendingAgentId}
        onOpenPendingAgentSetup={handleOpenPendingAgentSetup}
        onChangePendingAgentSetup={handleChangePendingAgentSetup}
        onGeneratePendingAgentPrompt={handleGeneratePendingAgentPrompt}
        isAgentGenerationDisabled={!isAgentGenerationAvailable}
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
      <WorkspaceNotifications notifications={workspaceNotifications} />
    </main>
  );
}
