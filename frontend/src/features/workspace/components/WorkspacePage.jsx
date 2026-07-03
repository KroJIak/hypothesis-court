import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import {
  CircleUserRound,
  FileText,
  MessageSquare,
  Paperclip,
  PanelLeftClose,
  PanelLeftOpen,
  Play,
  Plus,
  Scale,
  Search,
  SendHorizontal,
} from "lucide-react";

import { AgentAvatar } from "./AgentAvatar";
import { useWorkspaceScene } from "../hooks/useWorkspaceScene";
import "../workspace.css";

const COLLAPSED_RECENT_CHAT_LIMIT = 5;
const AGENT_DRAG_MIME_TYPE = "application/x-hypothesis-court-agent";
const DEFAULT_EVALUATION_AGENT_STATUS = "оценивает";
const PENDING_AGENT_NAME = "Новый агент";
const ATTACHMENT_TOOLTIP_GAP = 10;
const ATTACHMENT_TOOLTIP_EDGE_OFFSET = 32;

function getInitialAvailableAgents(session, paletteAgents) {
  const selectedAgentIds = new Set(session.evaluation.agents.map((agent) => agent.id));

  return sortAvailableAgents(
    paletteAgents.filter((agent) => !agent.isEmpty && !selectedAgentIds.has(agent.id)),
  );
}

function sortAvailableAgents(agents) {
  return [...agents].sort((firstAgent, secondAgent) => {
    if (firstAgent.isPendingSetup !== secondAgent.isPendingSetup) {
      return firstAgent.isPendingSetup ? -1 : 1;
    }

    if (firstAgent.isEmpty === secondAgent.isEmpty) {
      return 0;
    }

    return firstAgent.isEmpty ? 1 : -1;
  });
}

function createWorkspaceSession(session, paletteAgents) {
  return {
    ...session,
    availableAgents: getInitialAvailableAgents(session, paletteAgents),
  };
}

function createEvaluationAgent(agent) {
  return {
    ...agent,
    status: agent.status ?? DEFAULT_EVALUATION_AGENT_STATUS,
  };
}

function createPendingAgent() {
  return {
    id: `pending-agent-${Date.now()}`,
    name: PENDING_AGENT_NAME,
    variant: "empty",
    isEmpty: true,
    isPendingSetup: true,
  };
}

function hasPendingAgent(session) {
  const availableAgents = session.availableAgents ?? [];

  return [...availableAgents, ...session.evaluation.agents].some((agent) => agent.isPendingSetup);
}

function matchesChatSearch(session, query) {
  const normalizedQuery = query.trim().toLocaleLowerCase();

  if (!normalizedQuery) {
    return true;
  }

  return [session.title, session.query]
    .filter(Boolean)
    .some((value) => value.toLocaleLowerCase().includes(normalizedQuery));
}

function readAgentDragPayload(event) {
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

function capitalizeFirst(text) {
  if (!text) {
    return text;
  }

  return text.charAt(0).toUpperCase() + text.slice(1);
}

function clampNumber(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

function Sidebar({
  shell,
  sessions,
  selectedChatId,
  isCollapsed,
  isNewChatDisabled,
  onSelectChat,
  onCreateChat,
  onToggleSidebar,
}) {
  const [isCollapsedChatListOpen, setIsCollapsedChatListOpen] = useState(false);
  const [chatSearchQuery, setChatSearchQuery] = useState("");
  const filteredSessions = sessions.filter((session) => matchesChatSearch(session, chatSearchQuery));
  const recentCollapsedSessions = filteredSessions.slice(0, COLLAPSED_RECENT_CHAT_LIMIT);

  function handleCollapsedChatSelect(chatId) {
    onSelectChat(chatId);
    setIsCollapsedChatListOpen(false);
  }

  return (
    <aside className={`workspace-sidebar${isCollapsed ? " workspace-sidebar--collapsed" : ""}`}>
      <div className="sidebar-topbar">
        <button type="button" className="brand-lockup" onClick={onCreateChat} aria-label="Hypothesis Court">
          <span className="brand-mark">
            <Scale aria-hidden="true" strokeWidth={2.1} />
          </span>
          <span className="brand-copy">
            <span>Hypothesis</span>
            <span>Court</span>
          </span>
        </button>

        <button
          type="button"
          className="sidebar-toggle"
          onClick={onToggleSidebar}
          aria-label={isCollapsed ? "Показать меню" : "Скрыть меню"}
          title={isCollapsed ? "Показать меню" : "Скрыть меню"}
        >
          {isCollapsed ? (
            <PanelLeftOpen aria-hidden="true" strokeWidth={2.1} />
          ) : (
            <PanelLeftClose aria-hidden="true" strokeWidth={2.1} />
          )}
        </button>
      </div>

      <button
        type="button"
        className="nav-button nav-button--primary"
        disabled={isNewChatDisabled}
        onClick={onCreateChat}
      >
        <span className="nav-button__icon"><Plus aria-hidden="true" strokeWidth={2.1} /></span>
        <span className="sidebar-label">{shell.navigation.newChatLabel}</span>
      </button>

      <label className="chat-search">
        <span className="nav-button__icon"><Search aria-hidden="true" strokeWidth={2.1} /></span>
        <span className="sr-only">{shell.navigation.searchLabel}</span>
        <input
          className="chat-search__input"
          type="search"
          value={chatSearchQuery}
          onChange={(event) => setChatSearchQuery(event.target.value)}
          placeholder={shell.navigation.searchLabel}
        />
      </label>

      {isCollapsed ? (
        <div className="collapsed-chat-history">
          <button
            type="button"
            className="collapsed-chat-history__trigger"
            onClick={() => setIsCollapsedChatListOpen((currentValue) => !currentValue)}
            aria-label="Показать недавние чаты"
            aria-expanded={isCollapsedChatListOpen}
          >
            <MessageSquare aria-hidden="true" strokeWidth={1.9} />
          </button>
          {isCollapsedChatListOpen ? (
            <div className="collapsed-chat-history__popover" role="list" aria-label="Недавние чаты">
              {recentCollapsedSessions.map((session) => (
                <button
                  key={session.id}
                  type="button"
                  className={`collapsed-chat-history__item${session.id === selectedChatId ? " collapsed-chat-history__item--active" : ""}`}
                  onClick={() => handleCollapsedChatSelect(session.id)}
                  title={session.title}
                >
                  {session.title}
                </button>
              ))}
              {recentCollapsedSessions.length === 0 ? (
                <span className="collapsed-chat-history__empty">Ничего не найдено</span>
              ) : null}
            </div>
          ) : null}
        </div>
      ) : (
        <div className="chat-list" role="list" aria-label="История чатов">
          {filteredSessions.map((session) => (
            <button
              key={session.id}
              type="button"
              className={`chat-list__item${session.id === selectedChatId ? " chat-list__item--active" : ""}`}
              onClick={() => onSelectChat(session.id)}
              title={session.title}
            >
              <span className="chat-list__icon"><MessageSquare aria-hidden="true" strokeWidth={1.9} /></span>
              <span className="sidebar-label">{session.title}</span>
            </button>
          ))}
          {filteredSessions.length === 0 ? (
            <span className="chat-list__empty">Ничего не найдено</span>
          ) : null}
        </div>
      )}

      <button type="button" className="account-button" aria-label={shell.user.name}>
        <CircleUserRound aria-hidden="true" strokeWidth={1.9} />
      </button>
    </aside>
  );
}

function AgentCard({
  name,
  status,
  variant,
  compact = false,
  avatarRef = null,
  draggable = false,
  onDragStart,
  onDragEnd,
}) {
  return (
    <div
      className={`scene-agent${compact ? " scene-agent--compact" : ""}${draggable ? " scene-agent--draggable" : ""}`}
      draggable={draggable}
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
    >
      <span className="scene-agent__avatar-anchor" ref={avatarRef}>
        <span className="scene-agent__name">{name}</span>
        <AgentAvatar variant={variant} size={compact ? "compact" : "regular"} />
      </span>
      {status ? (
        <span className="scene-agent__status">
          {capitalizeFirst(status)}
          <span className="scene-agent__status-tail" aria-hidden="true">...</span>
        </span>
      ) : null}
    </div>
  );
}

function DebateStage({ debate, manufacturerAvatarRef }) {
  const stageRef = useRef(null);
  const topLeftAvatarRef = useRef(null);
  const topRightAvatarRef = useRef(null);
  const bottomAvatarRef = useRef(null);
  const [connectionLayer, setConnectionLayer] = useState({ width: 0, height: 0, paths: [] });
  const rolesByPlacement = useMemo(() => {
    return debate.roles.reduce((accumulator, role) => {
      accumulator[role.placement] = role;
      return accumulator;
    }, {});
  }, [debate.roles]);

  const setBottomAvatarRef = useCallback((node) => {
    bottomAvatarRef.current = node;

    if (manufacturerAvatarRef) {
      manufacturerAvatarRef.current = node;
    }
  }, [manufacturerAvatarRef]);

  useLayoutEffect(() => {
    const updateConnections = () => {
      const stageElement = stageRef.current;
      const topLeftAvatar = topLeftAvatarRef.current;
      const topRightAvatar = topRightAvatarRef.current;
      const bottomAvatar = bottomAvatarRef.current;

      if (!stageElement || !topLeftAvatar || !topRightAvatar || !bottomAvatar) {
        setConnectionLayer({ width: 0, height: 0, paths: [] });
        return;
      }

      const stageRect = stageElement.getBoundingClientRect();
      const topLeft = getElementCenter(topLeftAvatar, stageRect);
      const topRight = getElementCenter(topRightAvatar, stageRect);
      const bottom = getElementCenter(bottomAvatar, stageRect);

      setConnectionLayer({
        width: stageRect.width,
        height: stageElement.scrollHeight,
        paths: [
          { id: "top-left-top-right", d: `M${topLeft.x.toFixed(1)} ${topLeft.y.toFixed(1)}L${topRight.x.toFixed(1)} ${topRight.y.toFixed(1)}` },
          { id: "top-left-bottom", d: `M${topLeft.x.toFixed(1)} ${topLeft.y.toFixed(1)}L${bottom.x.toFixed(1)} ${bottom.y.toFixed(1)}` },
          { id: "top-right-bottom", d: `M${topRight.x.toFixed(1)} ${topRight.y.toFixed(1)}L${bottom.x.toFixed(1)} ${bottom.y.toFixed(1)}` },
        ],
      });
    };

    updateConnections();

    const animationFrame = window.requestAnimationFrame(updateConnections);
    const resizeObserver = new ResizeObserver(updateConnections);
    const observedElements = [
      stageRef.current,
      topLeftAvatarRef.current,
      topRightAvatarRef.current,
      bottomAvatarRef.current,
    ].filter(Boolean);

    observedElements.forEach((element) => resizeObserver.observe(element));
    window.addEventListener("resize", updateConnections);

    return () => {
      window.cancelAnimationFrame(animationFrame);
      resizeObserver.disconnect();
      window.removeEventListener("resize", updateConnections);
    };
  }, []);

  return (
    <section className="debate-stage" ref={stageRef} aria-label="Дискуссия агентов">
      {connectionLayer.paths.length > 0 ? (
        <svg
          className="debate-stage__links"
          style={{ width: `${connectionLayer.width}px`, height: `${connectionLayer.height}px` }}
          viewBox={`0 0 ${connectionLayer.width} ${connectionLayer.height}`}
          aria-hidden="true"
        >
          {connectionLayer.paths.map((path) => (
            <path key={path.id} d={path.d} />
          ))}
        </svg>
      ) : null}
      <div className="debate-stage__triangle debate-stage__triangle--left">
        <AgentCard {...rolesByPlacement["top-left"]} avatarRef={topLeftAvatarRef} />
      </div>
      <div className="debate-stage__triangle debate-stage__triangle--center">
        <button type="button" className="play-button" aria-label={debate.playLabel}>
          <span className="play-button__icon"><Play aria-hidden="true" strokeWidth={2.1} /></span>
        </button>
      </div>
      <div className="debate-stage__triangle debate-stage__triangle--right">
        <AgentCard {...rolesByPlacement["top-right"]} avatarRef={topRightAvatarRef} />
      </div>
      <div className="debate-stage__triangle debate-stage__triangle--bottom">
        <AgentCard {...rolesByPlacement["bottom-center"]} avatarRef={setBottomAvatarRef} />
      </div>
    </section>
  );
}

function EvaluationStage({
  evaluation,
  answer,
  onAgentAvatarRef,
  judgeAvatarRef,
  onAgentDragStart,
  onAgentDragEnd,
  onDropAgent,
  isDropTargetVisible,
}) {
  function handleDragOver(event) {
    event.preventDefault();
    event.dataTransfer.dropEffect = "move";
  }

  return (
    <section className="evaluation-stage" aria-label="Оценка гипотезы">
      <div
        className="evaluation-stage__agents"
        onDragOver={handleDragOver}
        onDrop={onDropAgent}
        aria-label="Перетащите сюда оценочного агента"
      >
        <div className="evaluation-stage__rail">
          {evaluation.agents.map((agent) => (
            <div key={agent.id} className="evaluation-stage__slot">
              <AgentCard
                {...agent}
                compact
                draggable
                avatarRef={(node) => onAgentAvatarRef(agent.id, node)}
                onDragStart={(event) => onAgentDragStart(event, "evaluation", agent.id)}
                onDragEnd={onAgentDragEnd}
              />
            </div>
          ))}
          {isDropTargetVisible ? (
            <div className="agent-drop-slot" aria-hidden="true" />
          ) : null}
          {evaluation.agents.length === 0 && !isDropTargetVisible ? (
            <div className="evaluation-stage__empty">Перетащите агента для оценки</div>
          ) : null}
        </div>
      </div>

      <div className="evaluation-stage__judge">
        <AgentCard {...evaluation.judge} compact avatarRef={judgeAvatarRef} />
        {answer ? (
          <div className="judge-verdict">
            <p>{answer}</p>
          </div>
        ) : null}
      </div>
    </section>
  );
}

function getElementCenter(element, rootRect) {
  const targetElement = element.querySelector?.(".agent-avatar__plate") ?? element;
  const elementRect = targetElement.getBoundingClientRect();

  return {
    x: elementRect.left + elementRect.width / 2 - rootRect.left,
    y: elementRect.top + elementRect.height / 2 - rootRect.top,
  };
}

function WorkspaceScene({ session, onAgentDragStart, onAgentDragEnd, onDropAgentToEvaluation, dragSource }) {
  const sceneRef = useRef(null);
  const manufacturerAvatarRef = useRef(null);
  const judgeAvatarRef = useRef(null);
  const evaluationAvatarRefs = useRef(new Map());
  const [connectionLayer, setConnectionLayer] = useState({ width: 0, height: 0, paths: [] });

  const setEvaluationAvatarRef = useCallback((agentId, node) => {
    if (node) {
      evaluationAvatarRefs.current.set(agentId, node);
      return;
    }

    evaluationAvatarRefs.current.delete(agentId);
  }, []);

  useLayoutEffect(() => {
    const updateConnections = () => {
      const sceneElement = sceneRef.current;
      const manufacturerAvatar = manufacturerAvatarRef.current;

      if (!sceneElement || !manufacturerAvatar) {
        setConnectionLayer({ width: 0, height: 0, paths: [] });
        return;
      }

      const sceneRect = sceneElement.getBoundingClientRect();
      const manufacturerSource = getElementCenter(manufacturerAvatar, sceneRect);
      const judgeAvatar = judgeAvatarRef.current;
      const judgeTarget = judgeAvatar ? getElementCenter(judgeAvatar, sceneRect) : null;
      const agentPaths = session.evaluation.agents
        .flatMap((agent) => {
          const targetElement = evaluationAvatarRefs.current.get(agent.id);

          if (!targetElement) {
            return [];
          }

          const agentCenter = getElementCenter(targetElement, sceneRect);
          const agentConnections = [
            {
              id: `manufacturer-${agent.id}`,
              d: `M${manufacturerSource.x.toFixed(1)} ${manufacturerSource.y.toFixed(1)}L${agentCenter.x.toFixed(1)} ${agentCenter.y.toFixed(1)}`,
            },
          ];

          if (judgeTarget) {
            agentConnections.push({
              id: `${agent.id}-judge`,
              d: `M${agentCenter.x.toFixed(1)} ${agentCenter.y.toFixed(1)}L${judgeTarget.x.toFixed(1)} ${judgeTarget.y.toFixed(1)}`,
            });
          }

          return agentConnections;
        });
      const paths = session.evaluation.agents.length === 0 && judgeTarget
        ? [
            {
              id: "manufacturer-judge",
              d: `M${manufacturerSource.x.toFixed(1)} ${manufacturerSource.y.toFixed(1)}L${judgeTarget.x.toFixed(1)} ${judgeTarget.y.toFixed(1)}`,
            },
          ]
        : agentPaths;

      setConnectionLayer({
        width: sceneRect.width,
        height: sceneElement.scrollHeight,
        paths,
      });
    };

    updateConnections();

    const animationFrame = window.requestAnimationFrame(updateConnections);
    const resizeObserver = new ResizeObserver(updateConnections);
    const observedElements = [
      sceneRef.current,
      manufacturerAvatarRef.current,
      judgeAvatarRef.current,
      ...session.evaluation.agents.map((agent) => evaluationAvatarRefs.current.get(agent.id)),
    ].filter(Boolean);

    observedElements.forEach((element) => resizeObserver.observe(element));
    window.addEventListener("resize", updateConnections);
    sceneRef.current?.addEventListener("scroll", updateConnections, true);

    return () => {
      window.cancelAnimationFrame(animationFrame);
      resizeObserver.disconnect();
      window.removeEventListener("resize", updateConnections);
      sceneRef.current?.removeEventListener("scroll", updateConnections, true);
    };
  }, [session.evaluation.agents]);

  return (
    <div className="workspace-scene" ref={sceneRef}>
      {connectionLayer.paths.length > 0 ? (
        <svg
          className="workspace-scene__connection-layer"
          style={{ width: `${connectionLayer.width}px`, height: `${connectionLayer.height}px` }}
          viewBox={`0 0 ${connectionLayer.width} ${connectionLayer.height}`}
          aria-hidden="true"
        >
          {connectionLayer.paths.map((path) => (
            <path key={path.id} d={path.d} />
          ))}
        </svg>
      ) : null}

      <DebateStage debate={session.debate} manufacturerAvatarRef={manufacturerAvatarRef} />
      <EvaluationStage
        evaluation={session.evaluation}
        answer={session.answer}
        onAgentAvatarRef={setEvaluationAvatarRef}
        judgeAvatarRef={judgeAvatarRef}
        onAgentDragStart={onAgentDragStart}
        onAgentDragEnd={onAgentDragEnd}
        onDropAgent={onDropAgentToEvaluation}
        isDropTargetVisible={dragSource === "palette"}
      />
    </div>
  );
}

function AgentPalette({
  palette,
  agents,
  onAgentDragStart,
  onAgentDragEnd,
  onDropAgentToPalette,
  isDropTargetVisible,
  isAddAgentDisabled,
  onAddAgent,
}) {
  const sortedAgents = sortAvailableAgents(agents);

  function handleDragOver(event) {
    event.preventDefault();
    event.dataTransfer.dropEffect = "move";
  }

  return (
    <aside
      className="agent-palette"
      onDragOver={handleDragOver}
      onDrop={onDropAgentToPalette}
      aria-label="Доступные агенты"
    >
      <button
        type="button"
        className="palette-add-button"
        disabled={isAddAgentDisabled}
        onClick={onAddAgent}
        aria-label={palette.addAgentLabel}
      >
        <Plus aria-hidden="true" strokeWidth={2.1} />
      </button>
      <span className="palette-add-label">{palette.addAgentLabel}</span>

      <div className="palette-list">
        {isDropTargetVisible ? (
          <div className="agent-drop-slot" aria-hidden="true" />
        ) : null}
        {sortedAgents.map((agent) => (
          <div
            key={agent.id}
            className="palette-list__item palette-list__item--draggable"
            draggable
            onDragStart={(event) => onAgentDragStart(event, "palette", agent.id)}
            onDragEnd={onAgentDragEnd}
          >
            <AgentAvatar variant={agent.variant} size="regular" />
            <span className="palette-list__label">{agent.name}</span>
          </div>
        ))}
        {sortedAgents.length === 0 && !isDropTargetVisible ? (
          <span className="palette-list__empty">Все агенты на сцене</span>
        ) : null}
      </div>
    </aside>
  );
}

function Composer({ composer, attachments, draftMessage, onDraftMessageChange, onSend }) {
  const attachmentButtonRefs = useRef(new Map());
  const [activeAttachmentId, setActiveAttachmentId] = useState(null);
  const [attachmentTooltipStyle, setAttachmentTooltipStyle] = useState({ left: "0px", top: "0px" });
  const activeAttachment = attachments.find((attachment) => attachment.id === activeAttachmentId) ?? null;

  const setAttachmentButtonRef = useCallback((attachmentId, node) => {
    if (node) {
      attachmentButtonRefs.current.set(attachmentId, node);
      return;
    }

    attachmentButtonRefs.current.delete(attachmentId);
  }, []);

  const updateAttachmentTooltip = useCallback((attachmentId) => {
    const buttonElement = attachmentButtonRefs.current.get(attachmentId);

    if (!buttonElement) {
      return;
    }

    const buttonRect = buttonElement.getBoundingClientRect();
    const viewportHeight = window.innerHeight;
    const tooltipTop = clampNumber(
      buttonRect.top + buttonRect.height / 2,
      ATTACHMENT_TOOLTIP_EDGE_OFFSET,
      viewportHeight - ATTACHMENT_TOOLTIP_EDGE_OFFSET,
    );

    setAttachmentTooltipStyle({
      left: `${buttonRect.right + ATTACHMENT_TOOLTIP_GAP}px`,
      top: `${tooltipTop}px`,
    });
  }, []);

  const showAttachmentTooltip = useCallback((attachmentId) => {
    setActiveAttachmentId(attachmentId);
    window.requestAnimationFrame(() => updateAttachmentTooltip(attachmentId));
  }, [updateAttachmentTooltip]);

  const hideAttachmentTooltip = useCallback(() => {
    setActiveAttachmentId(null);
  }, []);

  const handleAttachmentRailScroll = useCallback(() => {
    if (!activeAttachmentId) {
      return;
    }

    updateAttachmentTooltip(activeAttachmentId);
  }, [activeAttachmentId, updateAttachmentTooltip]);

  return (
    <div className="composer-shell">
      <div className="attachment-rail" aria-label="Вложения" onScroll={handleAttachmentRailScroll}>
        {attachments.map((attachment) => (
          <button
            key={attachment.id}
            ref={(node) => setAttachmentButtonRef(attachment.id, node)}
            type="button"
            className="attachment-chip"
            aria-label={attachment.tooltip}
            onMouseEnter={() => showAttachmentTooltip(attachment.id)}
            onMouseLeave={hideAttachmentTooltip}
            onFocus={() => showAttachmentTooltip(attachment.id)}
            onBlur={hideAttachmentTooltip}
          >
            <span className="attachment-chip__icon"><FileText aria-hidden="true" strokeWidth={1.9} /></span>
            <span className="attachment-chip__label">{attachment.shortLabel}</span>
          </button>
        ))}
      </div>
      {activeAttachment ? (
        <span className="attachment-tooltip" style={attachmentTooltipStyle}>
          {activeAttachment.tooltip}
        </span>
      ) : null}

      <form className="composer-panel" onSubmit={onSend}>
        <label className="composer-panel__input-wrap">
          <span className="sr-only">Сообщение</span>
          <textarea
            className="composer-panel__input"
            value={draftMessage}
            onChange={(event) => onDraftMessageChange(event.target.value)}
            placeholder={composer.placeholder}
            rows={1}
          />
        </label>

        <div className="composer-panel__actions">
          <button type="button" className="composer-action composer-action--ghost" aria-label={composer.attachLabel}>
            <Paperclip aria-hidden="true" strokeWidth={1.9} />
          </button>
          <button type="submit" className="composer-action composer-action--primary" aria-label={composer.sendLabel}>
            <SendHorizontal aria-hidden="true" strokeWidth={2} />
          </button>
        </div>
      </form>
    </div>
  );
}

function WorkspaceSkeleton() {
  return (
    <main className="workspace-status">
      <div className="workspace-status__card">
        <span className="workspace-status__title">Hypothesis Court</span>
        <p className="workspace-status__text">Собираем сцену из mock-данных...</p>
      </div>
    </main>
  );
}

function WorkspaceError() {
  return (
    <main className="workspace-status">
      <div className="workspace-status__card">
        <span className="workspace-status__title">Hypothesis Court</span>
        <p className="workspace-status__text">Не удалось загрузить рабочее пространство.</p>
      </div>
    </main>
  );
}

export function WorkspacePage() {
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
    const newSession = {
      ...selectedSession,
      id: newChatId,
      isPendingDraft: true,
      title: "Новый чат",
      query: "Новая гипотеза появится здесь после отправки запроса.",
      answer:
        "После подключения API здесь появится вердикт судьи и итоговая рекомендация по собранной сцене.",
      attachments: [],
    };

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

    setSessions((currentSessions) =>
      currentSessions.map((session) => {
        if (session.id !== selectedSession.id) {
          return session;
        }

        const availableAgents = session.availableAgents ?? getInitialAvailableAgents(session, data.palette.agents);

        return {
          ...session,
          availableAgents: sortAvailableAgents([...availableAgents, createPendingAgent()]),
        };
      }),
    );
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

  function handleMoveAgentToEvaluation(agentId) {
    setSessions((currentSessions) =>
      currentSessions.map((session) => {
        if (session.id !== selectedSession.id) {
          return session;
        }

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
            agents: [...session.evaluation.agents, createEvaluationAgent(movingAgent)],
          },
        };
      }),
    );
  }

  function handleMoveAgentToPalette(agentId) {
    setSessions((currentSessions) =>
      currentSessions.map((session) => {
        if (session.id !== selectedSession.id) {
          return session;
        }

        const movingAgent = session.evaluation.agents.find((agent) => agent.id === agentId);

        if (!movingAgent) {
          return session;
        }

        const availableAgents = session.availableAgents ?? getInitialAvailableAgents(session, data.palette.agents);
        const nextAvailableAgents = availableAgents.some((agent) => agent.id === agentId)
          ? availableAgents
          : sortAvailableAgents([...availableAgents, movingAgent]);

        return {
          ...session,
          availableAgents: nextAvailableAgents,
          evaluation: {
            ...session.evaluation,
            agents: session.evaluation.agents.filter((agent) => agent.id !== agentId),
          },
        };
      }),
    );
  }

  function handleDropAgentToEvaluation(event) {
    event.preventDefault();
    setDragSource(null);

    const payload = readAgentDragPayload(event);

    if (payload?.source !== "palette") {
      return;
    }

    handleMoveAgentToEvaluation(payload.agentId);
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

  function handleSend(event) {
    event.preventDefault();

    const nextQuery = draftMessage.trim();

    if (!nextQuery) {
      return;
    }

    setSessions((currentSessions) =>
      currentSessions.map((session) => {
        if (session.id !== selectedSession.id) {
          return session;
        }

        return {
          ...session,
          isPendingDraft: false,
          title: nextQuery,
          query: nextQuery,
        };
      }),
    );

    setDraftMessage("");
  }

  return (
    <main className={`workspace${isSidebarCollapsed ? " workspace--sidebar-collapsed" : ""}`}>
      <Sidebar
        shell={data.shell}
        sessions={sessions}
        selectedChatId={selectedSession.id}
        isCollapsed={isSidebarCollapsed}
        isNewChatDisabled={Boolean(pendingDraftSession)}
        onSelectChat={handleSelectChat}
        onCreateChat={handleCreateChat}
        onToggleSidebar={handleToggleSidebar}
      />

      <section className="workspace-main">
        <div className="workspace-main__question">{selectedSession.query}</div>

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
          draftMessage={draftMessage}
          onDraftMessageChange={setDraftMessage}
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
        isAddAgentDisabled={hasPendingAgent(selectedSession)}
        onAddAgent={handleAddAgent}
      />
    </main>
  );
}
