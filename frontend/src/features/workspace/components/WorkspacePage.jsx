import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import {
  CircleUserRound,
  FileText,
  Paperclip,
  Play,
  Plus,
  Scale,
  Search,
  SendHorizontal,
} from "lucide-react";

import { AgentAvatar } from "./AgentAvatar";
import { useWorkspaceScene } from "../hooks/useWorkspaceScene";
import "../workspace.css";

function capitalizeFirst(text) {
  if (!text) {
    return text;
  }

  return text.charAt(0).toUpperCase() + text.slice(1);
}

function Sidebar({ shell, sessions, selectedChatId, onSelectChat, onCreateChat }) {
  return (
    <aside className="workspace-sidebar">
      <div className="brand-lockup">
        <div className="brand-mark">
          <Scale aria-hidden="true" strokeWidth={2.1} />
        </div>
        <div className="brand-copy">
          <span>Hypothesis</span>
          <span>Court</span>
        </div>
      </div>

      <button type="button" className="nav-button nav-button--primary" onClick={onCreateChat}>
        <span className="nav-button__icon"><Plus aria-hidden="true" strokeWidth={2.1} /></span>
        <span>{shell.navigation.newChatLabel}</span>
      </button>

      <button type="button" className="nav-button nav-button--ghost">
        <span className="nav-button__icon"><Search aria-hidden="true" strokeWidth={2.1} /></span>
        <span>{shell.navigation.searchLabel}</span>
      </button>

      <div className="chat-list" role="list" aria-label="История чатов">
        {sessions.map((session) => (
          <button
            key={session.id}
            type="button"
            className={`chat-list__item${session.id === selectedChatId ? " chat-list__item--active" : ""}`}
            onClick={() => onSelectChat(session.id)}
          >
            {session.title}
          </button>
        ))}
      </div>

      <button type="button" className="account-button" aria-label={shell.user.name}>
        <CircleUserRound aria-hidden="true" strokeWidth={1.9} />
      </button>
    </aside>
  );
}

function AgentCard({ name, status, variant, compact = false, avatarRef = null }) {
  return (
    <div className={`scene-agent${compact ? " scene-agent--compact" : ""}`}>
      <span className="scene-agent__name">{name}</span>
      <span className="scene-agent__avatar-anchor" ref={avatarRef}>
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

function EvaluationStage({ evaluation, onAgentAvatarRef, judgeAvatarRef }) {
  return (
    <section className="evaluation-stage" aria-label="Оценка гипотезы">
      <div className="evaluation-stage__agents">
        {evaluation.agents.map((agent) => (
          <div key={agent.id} className={`evaluation-stage__slot evaluation-stage__slot--${agent.placement}`}>
            <AgentCard {...agent} compact avatarRef={(node) => onAgentAvatarRef(agent.id, node)} />
          </div>
        ))}
      </div>

      <div className="evaluation-stage__judge">
        <AgentCard {...evaluation.judge} compact avatarRef={judgeAvatarRef} />
      </div>
    </section>
  );
}

function getElementCenter(element, rootRect) {
  const elementRect = element.getBoundingClientRect();

  return {
    x: elementRect.left + elementRect.width / 2 - rootRect.left,
    y: elementRect.top + elementRect.height / 2 - rootRect.top,
  };
}

function WorkspaceScene({ session }) {
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
      const paths = session.evaluation.agents
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

    return () => {
      window.cancelAnimationFrame(animationFrame);
      resizeObserver.disconnect();
      window.removeEventListener("resize", updateConnections);
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
        onAgentAvatarRef={setEvaluationAvatarRef}
        judgeAvatarRef={judgeAvatarRef}
      />
    </div>
  );
}

function AgentPalette({ palette }) {
  return (
    <aside className="agent-palette">
      <button type="button" className="palette-add-button" aria-label={palette.addAgentLabel}>
        <Plus aria-hidden="true" strokeWidth={2.1} />
      </button>
      <span className="palette-add-label">{palette.addAgentLabel}</span>

      <div className="palette-list">
        {palette.agents.map((agent) => (
          <div key={agent.id} className="palette-list__item">
            <AgentAvatar variant={agent.variant} size="regular" />
            <span className="palette-list__label">{agent.name}</span>
          </div>
        ))}
      </div>
    </aside>
  );
}

function Composer({ composer, attachments, draftMessage, onDraftMessageChange, onSend }) {
  return (
    <div className="composer-shell">
      <div className="attachment-rail" aria-label="Вложения">
        {attachments.map((attachment) => (
          <button
            key={attachment.id}
            type="button"
            className="attachment-chip"
            title={attachment.tooltip}
            aria-label={attachment.tooltip}
          >
            <span className="attachment-chip__icon"><FileText aria-hidden="true" strokeWidth={1.9} /></span>
            <span className="attachment-chip__label">{attachment.shortLabel}</span>
          </button>
        ))}
      </div>

      <form className="composer-panel" onSubmit={onSend}>
        <label className="composer-panel__input-wrap">
          <span className="sr-only">Сообщение</span>
          <textarea
            className="composer-panel__input"
            value={draftMessage}
            onChange={(event) => onDraftMessageChange(event.target.value)}
            placeholder={composer.placeholder}
            rows={3}
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
  const [sessions, setSessions] = useState([]);

  useEffect(() => {
    if (status !== "success" || !data) {
      return;
    }

    setSessions(data.sessions);
    setSelectedChatId(data.shell.currentChatId);
  }, [data, status]);

  if (status === "loading") {
    return <WorkspaceSkeleton />;
  }

  if (status === "error" || !data) {
    return <WorkspaceError />;
  }

  const selectedSession = sessions.find((session) => session.id === selectedChatId) ?? sessions[0] ?? null;

  if (!selectedSession) {
    return <WorkspaceSkeleton />;
  }

  function handleSelectChat(chatId) {
    setSelectedChatId(chatId);
    setDraftMessage("");
  }

  function handleCreateChat() {
    const newChatId = `draft-${Date.now()}`;
    const newSession = {
      ...selectedSession,
      id: newChatId,
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
          title: nextQuery.slice(0, 46),
          query: nextQuery,
        };
      }),
    );

    setDraftMessage("");
  }

  return (
    <main className="workspace">
      <Sidebar
        shell={data.shell}
        sessions={sessions}
        selectedChatId={selectedSession.id}
        onSelectChat={handleSelectChat}
        onCreateChat={handleCreateChat}
      />

      <section className="workspace-main">
        <div className="workspace-main__question">{selectedSession.query}</div>

        <div className="workspace-main__scene">
          <WorkspaceScene session={selectedSession} />
        </div>

        <div className="workspace-main__answer">
          <p>{selectedSession.answer}</p>
        </div>

        <Composer
          composer={data.composer}
          attachments={selectedSession.attachments}
          draftMessage={draftMessage}
          onDraftMessageChange={setDraftMessage}
          onSend={handleSend}
        />
      </section>

      <AgentPalette palette={data.palette} />
    </main>
  );
}
