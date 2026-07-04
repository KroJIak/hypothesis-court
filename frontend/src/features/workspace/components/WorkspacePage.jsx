import { useCallback, useDeferredValue, useEffect, useLayoutEffect, useRef, useState } from "react";

import { AgentPalette } from "./AgentPalette";
import { AgentMessageHistoryModal } from "./AgentMessageHistoryModal";
import { Composer } from "./Composer";
import { KnowledgeGraphModal } from "./KnowledgeGraphModal";
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
  unpinChatSession,
} from "../api/chatSessions";
import {
  deleteSessionFile,
  listSessionFiles,
  uploadSessionFile,
} from "../api/sessionFiles";
import {
  cancelResearchRun,
  createResearchRun,
  editResearchRun,
  getResearchGraph,
  getResearchRun,
  listResearchRuns,
  regenerateResearchRun,
} from "../api/researchRuns";
import {
  AGENT_DRAG_MIME_TYPE,
  EVALUATION_SIDE_RIGHT,
  DOCUMENT_PROCESSING_STATUS_PROCESSING,
} from "../constants";
import { useWorkspaceScene } from "../hooks/useWorkspaceScene";
import { resetScenePlayback } from "../hooks/useScenePlayback";
import { resetJudgeVerdict } from "./JudgeVerdict";
import {
  createEvaluationAgent,
  createChatTitleFromRequests,
  createComposerRequest,
  applyChatSessionMetadata,
  applyResearchRunToSession,
  applyResearchRunsToSession,
  createWorkspaceSessionFromChatSession,
  formatComposerRequest,
  getInitialAvailableAgents,
  insertEvaluationAgentAtEdge,
  sortAvailableAgents,
} from "../model/workspaceSessionModel";
import { readAgentDragPayload } from "../utils/dragPayload";
import { runLayoutTransition } from "../utils/layoutTransition";
import { createAttachmentProcessingView } from "../utils/processingStatus";
import "../workspace.css";

const WORKSPACE_NOTIFICATION_TTL_MS = 4200;
const WORKSPACE_NOTIFICATION_LIMIT = 5;
const LOCAL_PENDING_AGENT_ID_PREFIX = "pending-agent-";

function createLocalPendingAgent() {
  const id =
    typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.random()}`;

  return {
    id: `${LOCAL_PENDING_AGENT_ID_PREFIX}${id}`,
    name: "Новый эксперт",
    variant: "empty",
    systemPrompt: "",
    isCustom: true,
    isEmpty: false,
    isPendingSetup: true,
  };
}

function isLocalPendingAgentId(agentId) {
  return typeof agentId === "string" && agentId.startsWith(LOCAL_PENDING_AGENT_ID_PREFIX);
}

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

function replaceAgentInSessions(sessions, previousAgentId, nextAgent) {
  return sessions.map((session) => ({
    ...session,
    availableAgents: (session.availableAgents ?? []).map((agent) =>
      agent.id === previousAgentId ? nextAgent : agent,
    ),
    evaluation: {
      ...session.evaluation,
      agents: (session.evaluation?.agents ?? []).map((agent) =>
        agent.id === previousAgentId
          ? createEvaluationAgent(nextAgent)
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

function refreshAvailableAgentsForSession(session, userAgents, data) {
  const selectedAgentIds = new Set((session.evaluation?.agents ?? []).map((agent) => agent.id));
  const localPendingAgents = (session.availableAgents ?? []).filter((agent) => isLocalPendingAgentId(agent.id));

  return {
    ...session,
    availableAgents: sortAvailableAgents([
      ...userAgents.filter((agent) => !selectedAgentIds.has(agent.id)),
      ...localPendingAgents,
      ...getEmptyPaletteAgents(data),
    ]),
  };
}

function markAttachmentsAsProcessing(attachments) {
  return (attachments ?? []).map((attachment) => ({
    ...attachment,
    ...createAttachmentProcessingView(DOCUMENT_PROCESSING_STATUS_PROCESSING),
  }));
}

function applyRunVersion(session, version, { isComplete = true } = {}) {
  return {
    ...session,
    title: version.title,
    query: version.query,
    answer: version.answer,
    launchedRequests: version.requests,
    hypotheses: version.hypotheses,
    consultationMessages: version.consultationMessages ?? [],
    evidence: version.evidence ?? session.evidence ?? [],
    verdict: version.verdict ?? session.verdict ?? null,
    knowledgeGraph: session.knowledgeGraphRunId === version.id ? session.knowledgeGraph : null,
    knowledgeGraphRunId: session.knowledgeGraphRunId === version.id ? session.knowledgeGraphRunId : null,
    composerRequests: [],
    isStarted: true,
    isPendingDraft: false,
    isEditingRunVersion: false,
    isVerdictComplete: isComplete,
    activeRunVersionId: version.id,
  };
}

function getRunVersionContext(session) {
  const runVersions = session.runVersions ?? [];
  const activeVersionIndex = Math.max(
    0,
    runVersions.findIndex((version) => version.id === session.activeRunVersionId),
  );

  return {
    runVersions,
    activeVersionIndex,
    activeVersion: runVersions[activeVersionIndex] ?? null,
  };
}

function areRunRequestsEqual(firstRequests, secondRequests) {
  if (firstRequests.length !== secondRequests.length) {
    return false;
  }

  return firstRequests.every((request, index) => {
    const comparedRequest = secondRequests[index];

    return request.context.value === comparedRequest?.context?.value
      && request.text.trim() === comparedRequest?.text?.trim();
  });
}

function normalizeAgentDraftValue(value) {
  return (value ?? "").trim();
}

function createAgentDraftSnapshot(agent) {
  return {
    name: normalizeAgentDraftValue(agent?.name),
    variant: agent?.variant ?? "empty",
    systemPrompt: normalizeAgentDraftValue(agent?.systemPrompt),
  };
}

function areAgentDraftSnapshotsEqual(firstSnapshot, secondSnapshot) {
  return firstSnapshot.name === secondSnapshot.name
    && firstSnapshot.variant === secondSnapshot.variant
    && firstSnapshot.systemPrompt === secondSnapshot.systemPrompt;
}

function findUnchangedNewAgent(agents, baselineByAgentId) {
  return (agents ?? []).find((agent) => {
    const baseline = baselineByAgentId.get(agent.id);

    return baseline
      ? areAgentDraftSnapshotsEqual(createAgentDraftSnapshot(agent), baseline)
      : false;
  }) ?? null;
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
  const [userAgents, setUserAgents] = useState([]);
  const [isAgentGenerationAvailable, setIsAgentGenerationAvailable] = useState(false);
  const [generatingAgentId, setGeneratingAgentId] = useState(null);
  const [activePendingAgentId, setActivePendingAgentId] = useState(null);
  const [activeAgentHistoryTarget, setActiveAgentHistoryTarget] = useState(null);
  const [activeKnowledgeGraphTarget, setActiveKnowledgeGraphTarget] = useState(null);
  const sceneScrollRef = useRef(null);
  const addAgentFrameRef = useRef(null);
  const notificationTimeoutsRef = useRef(new Map());
  const selectedAgentsByChatRef = useRef(new Map());
  const runDetailRequestsRef = useRef(new Map());
  const graphRequestsRef = useRef(new Map());
  const newAgentBaselineByIdRef = useRef(new Map());
  const deferredChatSearchQuery = useDeferredValue(chatSearchQuery);
  const selectedSession = sessions.find((session) => session.id === selectedChatId) ?? sessions[0] ?? null;
  const selectedSessionAvailableAgents = selectedSession?.availableAgents
    ?? (selectedSession && data ? getInitialAvailableAgents(selectedSession, getPaletteAgents(userAgents, data)) : []);
  const unchangedNewAgent = findUnchangedNewAgent(selectedSessionAvailableAgents, newAgentBaselineByIdRef.current);
  const isAgentEditingLocked = selectedSession
    ? selectedSession.isStarted || (selectedSession.hypotheses ?? []).length > 0
    : false;
  const isProcessRunning = selectedSession
    ? selectedSession.isStarted
      && (selectedSession.launchedRequests ?? []).length > 0
      && !selectedSession.isVerdictComplete
    : false;
  const agentEditingLockedReason = selectedSession?.isVerdictComplete
    ? "Агентов нельзя выставлять в завершенном чате."
    : "Агентов можно выставлять только до старта процесса.";
  const {
    runVersions,
    activeVersionIndex,
    activeVersion,
  } = selectedSession ? getRunVersionContext(selectedSession) : { runVersions: [], activeVersionIndex: 0, activeVersion: null };

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
      listAgents({ accessToken, signal: controller.signal }),
      getAgentGenerationStatus({ accessToken, signal: controller.signal }),
    ])
      .then(([agents, generationAvailable]) => {
        setUserAgents(agents);
        setIsAgentGenerationAvailable(generationAvailable);
      })
      .catch((error) => {
        if (error?.name === "AbortError") {
          return;
        }

        showWorkspaceError(error, "Не удалось загрузить агентов");
      });

    return () => controller.abort();
  }, [accessToken, data, showWorkspaceError, status]);

  useEffect(() => {
    if (status !== "success" || !data) {
      return;
    }

    setSessions((currentSessions) =>
      currentSessions.map((session) =>
        refreshAvailableAgentsForSession(session, userAgents, data),
      ),
    );
  }, [data, status, userAgents]);

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
        const paletteAgents = getPaletteAgents(userAgents, data);
        const nextSessions = payload.items.map((chatSession) =>
          createWorkspaceSessionFromChatSession(chatSession, paletteAgents),
        );

        setSessions((currentSessions) =>
          nextSessions.map((nextSession) => {
            const currentSession = currentSessions.find((session) => session.id === nextSession.id);

            if (!currentSession) {
              return nextSession;
            }

            return refreshAvailableAgentsForSession(
              applyChatSessionMetadata(currentSession, nextSession),
              userAgents,
              data,
            );
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
  }, [accessToken, data, deferredChatSearchQuery, showWorkspaceError, status, userAgents]);

  useEffect(() => {
    setActiveAgentHistoryTarget(null);
    setActiveKnowledgeGraphTarget(null);
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
        setSessions((currentSessions) =>
          currentSessions.map((session) =>
            session.id === selectedChatId
              ? {
                  ...session,
                  attachments: payload.items,
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
  }, [accessToken, selectedChatId, showWorkspaceError, status]);

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
        selectedAgentsByChatRef.current.set(selectedChatId, selectedAgents);
        setSessions((currentSessions) =>
          currentSessions.map((session) =>
            session.id === selectedChatId
              ? applySelectedAgentsToSession(session, selectedAgents, [], data)
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
  }, [accessToken, data, selectedChatId, showWorkspaceError, status]);

  useEffect(() => {
    if (status !== "success" || !selectedChatId) {
      return undefined;
    }

    const controller = new AbortController();

    listResearchRuns({
      accessToken,
      chatSessionId: selectedChatId,
      signal: controller.signal,
    })
      .then(async (payload) => {
        setSessions((currentSessions) =>
          currentSessions.map((session) =>
            session.id === selectedChatId
              ? applyResearchRunsToSession(session, payload.items, payload.activeRunId)
              : session,
          ),
        );

        const runToLoadId = payload.activeRunId ?? payload.items.at(-1)?.id ?? null;
        if (!runToLoadId) {
          return;
        }

        const loadedRun = await getResearchRun({
          accessToken,
          chatSessionId: selectedChatId,
          runId: runToLoadId,
          signal: controller.signal,
        });

        setSessions((currentSessions) =>
          currentSessions.map((session) =>
            session.id === selectedChatId
              ? applyResearchRunToSession(session, loadedRun)
              : session,
          ),
        );
      })
      .catch((error) => {
        if (error?.name === "AbortError") {
          return;
        }

        showWorkspaceError(error, "Не удалось загрузить версии запуска");
      });

    return () => controller.abort();
  }, [accessToken, selectedChatId, showWorkspaceError, status]);

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
  }, [selectedSession?.id]);

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

  async function refreshSessionFiles(chatSessionId) {
    const payload = await listSessionFiles({
      accessToken,
      chatSessionId,
    });

    setSessions((currentSessions) =>
      currentSessions.map((session) =>
        session.id === chatSessionId
          ? {
              ...session,
              attachments: payload.items,
              maxFiles: payload.maxFiles,
            }
          : session,
      ),
    );

    return payload;
  }

  async function loadResearchRunDetail(chatSessionId, runId) {
    const requestKey = `${chatSessionId}:${runId}`;
    const existingRequest = runDetailRequestsRef.current.get(requestKey);

    if (existingRequest) {
      return existingRequest;
    }

    const request = getResearchRun({
      accessToken,
      chatSessionId,
      runId,
    }).finally(() => {
      runDetailRequestsRef.current.delete(requestKey);
    });

    runDetailRequestsRef.current.set(requestKey, request);

    return request;
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
      const nextSession = createWorkspaceSessionFromChatSession(chatSession, getPaletteAgents(userAgents, data));
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

  async function handleRemoveAttachment(attachmentId) {
    if (isProcessRunning) {
      return;
    }

    try {
      await deleteSessionFile({
        accessToken,
        chatSessionId: selectedSession.id,
        sessionFileId: attachmentId,
      });
      updateSelectedSession((session) => ({
        ...session,
        attachments: (session.attachments ?? []).filter((attachment) => attachment.id !== attachmentId),
      }));
    } catch (error) {
      showWorkspaceError(error, "Не удалось удалить файл");
    }
  }

  async function handleAddAgent() {
    if (!selectedSession) {
      return;
    }

    if (unchangedNewAgent) {
      setActivePendingAgentId(unchangedNewAgent.id);
      return;
    }

    if (addAgentFrameRef.current !== null) {
      return;
    }

    addAgentFrameRef.current = window.requestAnimationFrame(() => {
      addAgentFrameRef.current = null;
    });

    const pendingAgent = createLocalPendingAgent();
    newAgentBaselineByIdRef.current.set(pendingAgent.id, createAgentDraftSnapshot(pendingAgent));

    updateSelectedSession((session) => ({
      ...session,
      availableAgents: sortAvailableAgents([
        ...(session.availableAgents ?? getInitialAvailableAgents(session, getPaletteAgents(userAgents, data)))
          .filter((agent) => !agent.isEmpty && agent.id !== pendingAgent.id),
        pendingAgent,
        ...getEmptyPaletteAgents(data),
      ]),
    }));
    setActivePendingAgentId(pendingAgent.id);
  }

  function handleOpenPendingAgentSetup(agentId) {
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
    const baseline = newAgentBaselineByIdRef.current.get(agentId);
    const currentAgent = selectedSessionAvailableAgents.find((agent) => agent.id === agentId);
    const nextAgent = currentAgent
      ? {
          ...currentAgent,
          ...changes,
        }
      : null;

    if (baseline && nextAgent && !areAgentDraftSnapshotsEqual(createAgentDraftSnapshot(nextAgent), baseline)) {
      newAgentBaselineByIdRef.current.delete(agentId);
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
    if (generatingAgentId) {
      return;
    }

    const availableAgents = selectedSession.availableAgents ?? getInitialAvailableAgents(selectedSession, getPaletteAgents(userAgents, data));
    const pendingAgent = availableAgents.find((agent) => agent.id === agentId && (agent.isPendingSetup || !agent.isEmpty));

    if (!pendingAgent) {
      return;
    }

    setGeneratingAgentId(agentId);

    try {
      let generationAgentId = agentId;

      if (isLocalPendingAgentId(agentId)) {
        const createdAgent = await createUserAgent({
          accessToken,
          name: pendingAgent.name?.trim() || "Новый эксперт",
          variant: pendingAgent.variant ?? "empty",
          systemPrompt: pendingAgent.systemPrompt ?? "",
        });

        generationAgentId = createdAgent.id;
        setGeneratingAgentId(createdAgent.id);
        newAgentBaselineByIdRef.current.delete(agentId);
        newAgentBaselineByIdRef.current.set(createdAgent.id, createAgentDraftSnapshot(createdAgent));
        setActivePendingAgentId(createdAgent.id);
        setUserAgents((currentAgents) => sortAvailableAgents([
          ...currentAgents.filter((agent) => agent.id !== createdAgent.id),
          createdAgent,
        ]));
        setSessions((currentSessions) => replaceAgentInSessions(currentSessions, agentId, createdAgent));
      }

      const generatedAgent = await generateUserAgent({
        accessToken,
        agentId: generationAgentId,
        name: pendingAgent.name?.trim() || "Новый эксперт",
        systemPrompt: pendingAgent.systemPrompt ?? "",
      });
      setUserAgents((currentAgents) =>
        sortAvailableAgents([
          ...currentAgents.filter((agent) => agent.id !== generationAgentId),
          generatedAgent,
        ]),
      );
      setSessions((currentSessions) => updateAgentInSessions(currentSessions, generatedAgent));
      newAgentBaselineByIdRef.current.delete(generationAgentId);
    } catch (error) {
      showWorkspaceError(error, "Не удалось сгенерировать промпт агента");
    } finally {
      setGeneratingAgentId(null);
    }
  }

  async function handleSavePendingAgentSetup(agentId) {
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
      const updatedAgent = isLocalPendingAgentId(agentId)
        ? await createUserAgent({
            accessToken,
            name: nextName,
            variant: pendingAgent.variant ?? "empty",
            systemPrompt: nextSystemPrompt,
          })
        : await updateUserAgent({
            accessToken,
            agentId,
            name: nextName,
            variant: pendingAgent.variant ?? "empty",
            systemPrompt: nextSystemPrompt,
          });
      setUserAgents((currentAgents) =>
        sortAvailableAgents([
          ...currentAgents.filter((agent) => agent.id !== agentId && agent.id !== updatedAgent.id),
          updatedAgent,
        ]),
      );
      setSessions((currentSessions) =>
        isLocalPendingAgentId(agentId)
          ? replaceAgentInSessions(currentSessions, agentId, updatedAgent)
          : updateAgentInSessions(currentSessions, updatedAgent),
      );
      newAgentBaselineByIdRef.current.delete(agentId);
      newAgentBaselineByIdRef.current.delete(updatedAgent.id);
      setActivePendingAgentId(null);
    } catch (error) {
      showWorkspaceError(error, "Не удалось сохранить агента");
    }
  }

  async function handleDeletePendingAgentSetup(agentId) {
    const availableAgents = selectedSession.availableAgents ?? getInitialAvailableAgents(selectedSession, getPaletteAgents(userAgents, data));
    const agent = availableAgents.find((availableAgent) => (
      availableAgent.id === agentId
        && (availableAgent.isPendingSetup || !availableAgent.isEmpty)
    ));

    if (!agent) {
      return;
    }

    if (isLocalPendingAgentId(agentId)) {
      updateSelectedSession((session) => ({
        ...session,
        availableAgents: (session.availableAgents ?? getInitialAvailableAgents(session, getPaletteAgents(userAgents, data)))
          .filter((availableAgent) => availableAgent.id !== agentId),
      }));
      newAgentBaselineByIdRef.current.delete(agentId);
      setActivePendingAgentId(null);
      return;
    }

    try {
      await deleteUserAgent({ accessToken, agentId });
      setUserAgents((currentAgents) => currentAgents.filter((currentAgent) => currentAgent.id !== agentId));
      setSessions((currentSessions) => removeAgentFromSessions(currentSessions, agentId));
      newAgentBaselineByIdRef.current.delete(agentId);
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

      showWorkspaceNotification("Чат завершён. Для нового варианта используйте редактирование или перегенерацию", "info");
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

    if (
      selectedSession.isEditingRunVersion
      && activeVersion
      && areRunRequestsEqual(composerRequests, activeVersion.requests)
    ) {
      updateSelectedSession((session) => applyRunVersion(session, activeVersion, { isComplete: true }));
      setDraftMessage("");
      showWorkspaceNotification("Параметры не изменились", "info");
      return;
    }

    const optimisticTitle = createChatTitleFromRequests(composerRequests);

    updateSelectedSession((session) => ({
      ...session,
      title: optimisticTitle,
      isStarted: true,
      isPendingDraft: false,
      isEditingRunVersion: false,
      query: composerRequests.map(formatComposerRequest).join("\n"),
      launchedRequests: composerRequests,
      hypotheses: [],
      answer: "",
      isVerdictComplete: false,
      consultationMessages: [],
      composerRequests: [],
      attachments: markAttachmentsAsProcessing(session.attachments),
    }));
    resetJudgeVerdict(selectedSession.id);
    setDraftMessage("");

    const runRequest = selectedSession.isEditingRunVersion && activeVersion
      ? editResearchRun({
          accessToken,
          chatSessionId: selectedSession.id,
          runId: activeVersion.id,
          requests: composerRequests,
        })
      : createResearchRun({
          accessToken,
          chatSessionId: selectedSession.id,
          requests: composerRequests,
        });

    runRequest
      .then((run) => {
        resetJudgeVerdict(selectedSession.id);
        setSessions((currentSessions) =>
          currentSessions.map((session) =>
            session.id === selectedSession.id
              ? applyResearchRunToSession(session, run)
              : session,
          ),
        );
        void refreshSessionFiles(selectedSession.id).catch((error) => {
          showWorkspaceError(error, "Не удалось обновить статусы файлов");
        });
      })
      .catch((error) => {
        showWorkspaceError(error, "Не удалось выполнить исследовательский запуск");
        void refreshSessionFiles(selectedSession.id).catch((refreshError) => {
          showWorkspaceError(refreshError, "Не удалось обновить статусы файлов");
        });
        setSessions((currentSessions) =>
          currentSessions.map((session) =>
            session.id === selectedSession.id
              ? {
                  ...session,
                  isStarted: false,
                  launchedRequests: [],
                  hypotheses: [],
                  answer: "",
                  isVerdictComplete: false,
                  composerRequests,
                }
              : session,
          ),
        );
      });
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

    if (selectedSession.activeResearchRunId) {
      void cancelResearchRun({
        accessToken,
        chatSessionId: selectedSession.id,
        runId: selectedSession.activeResearchRunId,
      }).catch((error) => {
        showWorkspaceError(error, "Не удалось остановить запуск");
      });
    }
  }

  function handleVerdictComplete() {
    updateSelectedSession((session) => (
      session.isVerdictComplete
        ? session
        : {
            ...session,
            isVerdictComplete: true,
            runVersions: (session.runVersions ?? []).map((version) =>
              version.id === session.activeRunVersionId
                ? {
                    ...version,
                    completedAt: version.completedAt ?? new Date().toISOString(),
                  }
                : version,
            ),
          }
    ));
  }

  function handleOpenAgentHistory(target) {
    setActiveAgentHistoryTarget(target);
  }

  function handleCloseAgentHistory() {
    setActiveAgentHistoryTarget(null);
  }

  async function handleOpenKnowledgeGraph(target = {}) {
    if (!selectedSession?.activeResearchRunId) {
      setActiveKnowledgeGraphTarget(target);
      return;
    }

    if (selectedSession.knowledgeGraphRunId === selectedSession.activeResearchRunId && selectedSession.knowledgeGraph) {
      setActiveKnowledgeGraphTarget(target);
      return;
    }

    const requestKey = `${selectedSession.id}:${selectedSession.activeResearchRunId}`;
    const existingRequest = graphRequestsRef.current.get(requestKey);
    const request = existingRequest ?? getResearchGraph({
      accessToken,
      chatSessionId: selectedSession.id,
      runId: selectedSession.activeResearchRunId,
    }).finally(() => {
      graphRequestsRef.current.delete(requestKey);
    });

    if (!existingRequest) {
      graphRequestsRef.current.set(requestKey, request);
    }

    try {
      const knowledgeGraph = await request;
      setSessions((currentSessions) =>
        currentSessions.map((session) =>
          session.id === selectedSession.id
            ? {
                ...session,
                knowledgeGraph,
                knowledgeGraphRunId: selectedSession.activeResearchRunId,
              }
            : session,
        ),
      );
      setActiveKnowledgeGraphTarget(target);
    } catch (error) {
      showWorkspaceError(error, "Не удалось загрузить граф знаний");
    }
  }

  function handleCloseKnowledgeGraph() {
    setActiveKnowledgeGraphTarget(null);
  }

  async function handleSwitchRunVersion(nextIndex) {
    if (!selectedSession || isProcessRunning || selectedSession.isEditingRunVersion) {
      return;
    }

    const nextVersion = runVersions[nextIndex];

    if (!nextVersion) {
      return;
    }

    resetScenePlayback(selectedSession.id);
    if (nextVersion.isDetailLoaded) {
      updateSelectedSession((session) => applyRunVersion(session, nextVersion, { isComplete: true }));
      return;
    }

    try {
      const loadedRun = await loadResearchRunDetail(selectedSession.id, nextVersion.id);
      setSessions((currentSessions) =>
        currentSessions.map((session) =>
          session.id === selectedSession.id
            ? applyResearchRunToSession(session, loadedRun)
            : session,
        ),
      );
    } catch (error) {
      showWorkspaceError(error, "Не удалось загрузить версию запуска");
    }
  }

  function handleEditRunVersion() {
    if (!selectedSession || isProcessRunning || !activeVersion) {
      return;
    }

    resetScenePlayback(selectedSession.id);
    resetJudgeVerdict(selectedSession.id);
    updateSelectedSession((session) => ({
      ...session,
      isStarted: false,
      isPendingDraft: true,
      isEditingRunVersion: true,
      composerRequests: activeVersion.requests,
      launchedRequests: [],
      hypotheses: [],
      answer: "",
      consultationMessages: [],
      isVerdictComplete: false,
    }));
    setDraftMessage("");
  }

  function handleCancelRunVersionEdit() {
    if (!selectedSession?.isEditingRunVersion || !activeVersion) {
      return;
    }

    updateSelectedSession((session) => applyRunVersion(session, activeVersion, { isComplete: true }));
    setDraftMessage("");
  }

  async function handleCopyJudgeVerdict() {
    if (!selectedSession?.answer) {
      return;
    }

    try {
      await navigator.clipboard.writeText(selectedSession.answer);
      showWorkspaceNotification("Вывод судьи скопирован", "success");
    } catch {
      showWorkspaceNotification("Не удалось скопировать вывод судьи", "error");
    }
  }

  function handleRegenerateRunVersion() {
    if (!selectedSession || isProcessRunning || !activeVersion) {
      return;
    }

    resetScenePlayback(selectedSession.id);
    resetJudgeVerdict(selectedSession.id);
    updateSelectedSession((session) => ({
      ...session,
      isStarted: true,
      isVerdictComplete: false,
      hypotheses: [],
      answer: "",
      launchedRequests: activeVersion.requests,
    }));

    regenerateResearchRun({
      accessToken,
      chatSessionId: selectedSession.id,
      runId: activeVersion.id,
    })
      .then((run) => {
        resetJudgeVerdict(selectedSession.id);
        setSessions((currentSessions) =>
          currentSessions.map((session) =>
            session.id === selectedSession.id
              ? applyResearchRunToSession(session, run)
              : session,
          ),
        );
      })
      .catch((error) => {
        showWorkspaceError(error, "Не удалось перегенерировать запуск");
      });
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

  const verdictActions = activeVersion
    ? {
        activeVersionIndex,
        versionCount: runVersions.length,
        activeVersion,
        isLocked: isProcessRunning,
        infoRows: [
          `Версия: ${activeVersionIndex + 1} из ${runVersions.length}`,
          `Параметров запуска: ${activeVersion.requests.length}`,
          `Гипотез: ${activeVersion.hypotheses.length}`,
          `Статус: ${selectedSession.isVerdictComplete ? "завершён" : "в процессе"}`,
        ],
        onPreviousVersion: () => handleSwitchRunVersion(activeVersionIndex - 1),
        onNextVersion: () => handleSwitchRunVersion(activeVersionIndex + 1),
        onEdit: handleEditRunVersion,
        onCopy: handleCopyJudgeVerdict,
        onRegenerate: handleRegenerateRunVersion,
      }
    : null;

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
            onOpenKnowledgeGraph={handleOpenKnowledgeGraph}
            verdictActions={verdictActions}
          />
        </div>

        <Composer
          composer={data.composer}
          attachments={selectedSession.attachments ?? []}
          composerRequests={selectedSession.composerRequests ?? []}
          draftMessage={draftMessage}
          isAttachmentUploading={isUploadingSessionFile}
          isProcessRunning={isProcessRunning}
          canEditAttachments={!selectedSession.isStarted}
          isBranchDraft={Boolean(selectedSession.isEditingRunVersion)}
          onDraftMessageChange={setDraftMessage}
          onAttachFiles={handleAttachFiles}
          onRemoveAttachment={handleRemoveAttachment}
          onRemoveComposerRequest={handleRemoveComposerRequest}
          onCancelBranchDraft={handleCancelRunVersionEdit}
          onStop={handleStopProcess}
          onSend={handleSend}
        />
      </section>

      <AgentPalette
        palette={data.palette}
        agents={selectedSessionAvailableAgents}
        onAgentDragStart={handleAgentDragStart}
        onAgentDragEnd={handleAgentDragEnd}
        onDropAgentToPalette={handleDropAgentToPalette}
        isDropTargetVisible={dragSource === "evaluation"}
        isAddAgentDisabled={Boolean(unchangedNewAgent) || Boolean(generatingAgentId)}
        isAgentEditingLocked={isAgentEditingLocked}
        lockedReason={agentEditingLockedReason}
        activePendingAgentId={activePendingAgentId}
        onOpenPendingAgentSetup={handleOpenPendingAgentSetup}
        onChangePendingAgentSetup={handleChangePendingAgentSetup}
        onGeneratePendingAgentPrompt={handleGeneratePendingAgentPrompt}
        isAgentGenerationDisabled={!isAgentGenerationAvailable}
        generatingAgentId={generatingAgentId}
        onDeletePendingAgentSetup={handleDeletePendingAgentSetup}
        onSavePendingAgentSetup={handleSavePendingAgentSetup}
        onAddAgent={handleAddAgent}
      />

      {activeAgentHistoryTarget ? (
        <AgentMessageHistoryModal
          session={selectedSession}
          target={activeAgentHistoryTarget}
          onClose={handleCloseAgentHistory}
          onOpenKnowledgeGraph={handleOpenKnowledgeGraph}
        />
      ) : null}
      {activeKnowledgeGraphTarget ? (
        <KnowledgeGraphModal
          session={selectedSession}
          focusNodeId={activeKnowledgeGraphTarget.focusNodeId}
          onClose={handleCloseKnowledgeGraph}
        />
      ) : null}
      <WorkspaceNotifications notifications={workspaceNotifications} />
    </main>
  );
}
