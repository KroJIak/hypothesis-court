import { useState } from "react";
import {
  MessageSquare,
  PanelLeftClose,
  PanelLeftOpen,
  Plus,
  Scale,
  Search,
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
