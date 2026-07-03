import { useEffect, useMemo, useRef, useState } from "react";
import {
  MessageSquare,
  MoreHorizontal,
  PanelLeftClose,
  PanelLeftOpen,
  Pencil,
  Pin,
  Plus,
  Scale,
  Search,
  Trash2,
} from "lucide-react";

import { SidebarAccountControl } from "../../account/components/SidebarAccountControl";
import { COLLAPSED_RECENT_CHAT_LIMIT } from "../constants";
import { matchesChatSearch } from "../model/workspaceSessionModel";

export function Sidebar({
  accessToken,
  shell,
  currentUser,
  accountProfile,
  sessions,
  selectedChatId,
  isCollapsed,
  isNewChatDisabled,
  onLogout,
  onLogoutAll,
  onUpdateCurrentUserProfile,
  onUploadAvatar,
  onChangePassword,
  onSelectChat,
  onCreateChat,
  onToggleSidebar,
  onRenameChat,
  onTogglePinChat,
  onDeleteChat,
}) {
  const [isCollapsedChatListOpen, setIsCollapsedChatListOpen] = useState(false);
  const [chatSearchQuery, setChatSearchQuery] = useState("");
  const [activeChatMenuId, setActiveChatMenuId] = useState(null);
  const [renamingChatId, setRenamingChatId] = useState(null);
  const [renameDraft, setRenameDraft] = useState("");
  const [deleteCandidate, setDeleteCandidate] = useState(null);
  const chatMenuRef = useRef(null);
  const sortedSessions = useMemo(
    () => [...sessions].sort((first, second) => Number(Boolean(second.isPinned)) - Number(Boolean(first.isPinned))),
    [sessions],
  );
  const filteredSessions = sortedSessions.filter((session) => matchesChatSearch(session, chatSearchQuery));
  const recentCollapsedSessions = filteredSessions.slice(0, COLLAPSED_RECENT_CHAT_LIMIT);

  useEffect(() => {
    function handleKeyDown(event) {
      if (event.key !== "Escape") {
        return;
      }

      setActiveChatMenuId(null);
      setRenamingChatId(null);
      setDeleteCandidate(null);
    }

    window.addEventListener("keydown", handleKeyDown);

    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  useEffect(() => {
    function handlePointerDown(event) {
      if (!activeChatMenuId) {
        return;
      }

      if (event.target.closest("[data-chat-actions-root]") || chatMenuRef.current?.contains(event.target)) {
        return;
      }

      setActiveChatMenuId(null);
    }

    window.addEventListener("mousedown", handlePointerDown);

    return () => window.removeEventListener("mousedown", handlePointerDown);
  }, [activeChatMenuId]);

  function handleCollapsedChatSelect(chatId) {
    onSelectChat(chatId);
    setIsCollapsedChatListOpen(false);
  }

  function handleStartRename(session) {
    setActiveChatMenuId(null);
    setRenamingChatId(session.id);
    setRenameDraft(session.title);
  }

  function handleFinishRename(chatId) {
    onRenameChat(chatId, renameDraft);
    setRenamingChatId(null);
    setRenameDraft("");
  }

  function handleRenameKeyDown(event, chatId) {
    if (event.key === "Enter") {
      event.preventDefault();
      handleFinishRename(chatId);
    }

    if (event.key === "Escape") {
      setRenamingChatId(null);
      setRenameDraft("");
    }
  }

  function handleTogglePin(session) {
    setActiveChatMenuId(null);
    onTogglePinChat(session.id);
  }

  function handleAskDelete(session) {
    setActiveChatMenuId(null);
    setDeleteCandidate(session);
  }

  function handleConfirmDelete() {
    if (!deleteCandidate) {
      return;
    }

    onDeleteChat(deleteCandidate.id);
    setDeleteCandidate(null);
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
            <div
              key={session.id}
              className={`chat-list__row${session.id === selectedChatId ? " chat-list__row--active" : ""}`}
              role="listitem"
              data-chat-actions-root
            >
              {renamingChatId === session.id ? (
                <input
                  className="chat-list__rename-input"
                  value={renameDraft}
                  autoFocus
                  onChange={(event) => setRenameDraft(event.target.value)}
                  onBlur={() => handleFinishRename(session.id)}
                  onKeyDown={(event) => handleRenameKeyDown(event, session.id)}
                />
              ) : (
                <button
                  type="button"
                  className="chat-list__item"
                  onClick={() => onSelectChat(session.id)}
                  title={session.title}
                >
                  <span className="chat-list__icon"><MessageSquare aria-hidden="true" strokeWidth={1.9} /></span>
                  <span className="sidebar-label">{session.title}</span>
                </button>
              )}

              <button
                type="button"
                className="chat-list__actions-trigger"
                aria-label={`Действия с чатом ${session.title}`}
                aria-expanded={activeChatMenuId === session.id}
                onClick={(event) => {
                  event.stopPropagation();
                  setActiveChatMenuId((currentId) => (currentId === session.id ? null : session.id));
                }}
              >
                <MoreHorizontal aria-hidden="true" strokeWidth={2} />
              </button>

              {activeChatMenuId === session.id ? (
                <div ref={chatMenuRef} className="chat-list-menu" role="menu">
                  <button type="button" role="menuitem" onClick={() => handleStartRename(session)}>
                    <Pencil aria-hidden="true" strokeWidth={1.9} />
                    <span>Переименовать</span>
                  </button>
                  <button type="button" role="menuitem" onClick={() => handleTogglePin(session)}>
                    <Pin aria-hidden="true" strokeWidth={1.9} />
                    <span>{session.isPinned ? "Открепить" : "Закрепить"}</span>
                  </button>
                  <button type="button" role="menuitem" onClick={() => handleAskDelete(session)}>
                    <Trash2 aria-hidden="true" strokeWidth={1.9} />
                    <span>Удалить</span>
                  </button>
                </div>
              ) : null}
            </div>
          ))}
          {filteredSessions.length === 0 ? (
            <span className="chat-list__empty">Ничего не найдено</span>
          ) : null}
        </div>
      )}

      {deleteCandidate ? (
        <div className="chat-delete-modal-backdrop" role="presentation" onClick={() => setDeleteCandidate(null)}>
          <div
            className="chat-delete-modal"
            role="dialog"
            aria-modal="true"
            aria-label="Удаление чата"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="chat-delete-modal__title">Удалить чат?</div>
            <div className="chat-delete-modal__text">{deleteCandidate.title}</div>
            <div className="chat-delete-modal__actions">
              <button type="button" onClick={() => setDeleteCandidate(null)}>
                Отмена
              </button>
              <button type="button" className="chat-delete-modal__confirm" onClick={handleConfirmDelete}>
                Удалить
              </button>
            </div>
          </div>
        </div>
      ) : null}

      <SidebarAccountControl
        accessToken={accessToken}
        user={currentUser}
        profile={accountProfile}
        isSidebarCollapsed={isCollapsed}
        onLogout={onLogout}
        onLogoutAll={onLogoutAll}
        onUpdateCurrentUserProfile={onUpdateCurrentUserProfile}
        onUploadAvatar={onUploadAvatar}
        onChangePassword={onChangePassword}
      />
    </aside>
  );
}
