import { useEffect, useMemo, useState } from "react";

import { AgentAvatar } from "./AgentAvatar";
import { useWorkspaceScene } from "../hooks/useWorkspaceScene";
import "../workspace.css";

function BrandIcon() {
  return (
    <svg viewBox="0 0 64 64" aria-hidden="true">
      <path
        d="M18 44H8c-1 0-2-.8-2-2V14c0-1.1.9-2 2-2h34c1.1 0 2 .9 2 2v16"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M18 44l-8 8v-8"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path d="M16 20h20M20 20v-4h12v4M22 20v10M30 20v10M18 30h16" fill="none" stroke="currentColor" strokeWidth="2.8" strokeLinecap="round" />
      <path d="M38 36l10 10" stroke="currentColor" strokeWidth="3.2" strokeLinecap="round" />
      <path d="M33 38l8-8 6 6-8 8z" fill="currentColor" />
      <path d="M46 46l5-5 7 7-5 5z" fill="currentColor" />
    </svg>
  );
}

function PlusIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M12 5v14M5 12h14" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" />
    </svg>
  );
}

function SearchIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <circle cx="11" cy="11" r="6.5" fill="none" stroke="currentColor" strokeWidth="2.1" />
      <path d="M16 16l4.5 4.5" fill="none" stroke="currentColor" strokeWidth="2.1" strokeLinecap="round" />
    </svg>
  );
}

function UserIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <circle cx="12" cy="8" r="4.3" fill="currentColor" />
      <path d="M4.5 20c0-4.1 3.4-7 7.5-7s7.5 2.9 7.5 7" fill="currentColor" />
    </svg>
  );
}

function FileIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M7 3h7l5 5v13H7z" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
      <path d="M14 3v5h5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
      <path d="M10 13h6M10 17h5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}

function PaperclipIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path
        d="M8 12.5V7.7c0-2.7 1.8-4.7 4.3-4.7s4.2 1.9 4.2 4.7v7.7c0 3.6-2.2 5.8-5.1 5.8S6.3 19 6.3 15.7V8.9"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.9"
        strokeLinecap="round"
      />
    </svg>
  );
}

function SendIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M4 11.5L20 4l-5.7 16-2.9-5.5z" fill="currentColor" />
      <path d="M20 4l-8.6 10.5" fill="none" stroke="#111" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  );
}

function PlayIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M8 5l11 7-11 7z" fill="currentColor" />
    </svg>
  );
}

function StatusDots() {
  return <div className="status-dots" aria-hidden="true">•••</div>;
}

function Sidebar({ shell, sessions, selectedChatId, onSelectChat, onCreateChat }) {
  return (
    <aside className="workspace-sidebar">
      <div className="brand-lockup">
        <div className="brand-mark">
          <BrandIcon />
        </div>
        <div className="brand-copy">
          <span>Hypothesis</span>
          <span>Court</span>
        </div>
      </div>

      <button type="button" className="nav-button nav-button--primary" onClick={onCreateChat}>
        <span className="nav-button__icon"><PlusIcon /></span>
        <span>{shell.navigation.newChatLabel}</span>
      </button>

      <button type="button" className="nav-button nav-button--ghost">
        <span className="nav-button__icon"><SearchIcon /></span>
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
        <UserIcon />
      </button>
    </aside>
  );
}

function AgentCard({ name, status, variant, compact = false }) {
  return (
    <div className={`scene-agent${compact ? " scene-agent--compact" : ""}`}>
      <span className="scene-agent__name">{name}</span>
      <AgentAvatar variant={variant} size={compact ? "compact" : "regular"} />
      {status ? <span className="scene-agent__status">{status}</span> : null}
      {status ? <StatusDots /> : null}
    </div>
  );
}

function DebateStage({ debate }) {
  const rolesByPlacement = useMemo(() => {
    return debate.roles.reduce((accumulator, role) => {
      accumulator[role.placement] = role;
      return accumulator;
    }, {});
  }, [debate.roles]);

  return (
    <section className="debate-stage" aria-label="Дискуссия агентов">
      <div className="debate-stage__triangle debate-stage__triangle--left">
        <AgentCard {...rolesByPlacement["top-left"]} />
      </div>
      <div className="debate-stage__triangle debate-stage__triangle--center">
        <button type="button" className="play-button" aria-label={debate.playLabel}>
          <span className="play-button__icon"><PlayIcon /></span>
          <span className="play-button__label">{debate.playLabel}</span>
        </button>
      </div>
      <div className="debate-stage__triangle debate-stage__triangle--right">
        <AgentCard {...rolesByPlacement["top-right"]} />
      </div>
      <div className="debate-stage__triangle debate-stage__triangle--bottom">
        <AgentCard {...rolesByPlacement["bottom-center"]} />
      </div>
    </section>
  );
}

function EvaluationStage({ evaluation }) {
  return (
    <section className="evaluation-stage" aria-label="Оценка гипотезы">
      <svg className="evaluation-stage__lines" viewBox="0 0 1000 390" preserveAspectRatio="none" aria-hidden="true">
        <path d="M70 58H930" />
        <path d="M500 58L150 180" />
        <path d="M500 58L385 180" />
        <path d="M500 58L615 180" />
        <path d="M500 58L850 180" />
        <path d="M150 235L500 350" />
        <path d="M385 235L500 350" />
        <path d="M615 235L500 350" />
        <path d="M850 235L500 350" />
      </svg>

      <div className="evaluation-stage__agents">
        {evaluation.agents.map((agent) => (
          <div key={agent.id} className={`evaluation-stage__slot evaluation-stage__slot--${agent.placement}`}>
            <AgentCard {...agent} compact />
          </div>
        ))}
      </div>

      <div className="evaluation-stage__judge">
        <AgentCard {...evaluation.judge} compact />
      </div>
    </section>
  );
}

function AgentPalette({ palette }) {
  return (
    <aside className="agent-palette">
      <button type="button" className="palette-add-button" aria-label={palette.addAgentLabel}>
        <PlusIcon />
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
            <span className="attachment-chip__icon"><FileIcon /></span>
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
            <PaperclipIcon />
          </button>
          <button type="submit" className="composer-action composer-action--primary" aria-label={composer.sendLabel}>
            <SendIcon />
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

  const selectedSession = sessions.find((session) => session.id === selectedChatId) ?? sessions[0];

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
          <DebateStage debate={selectedSession.debate} />
          <EvaluationStage evaluation={selectedSession.evaluation} />
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
