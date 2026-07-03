import { useEffect, useRef, useState } from "react";

import { AccountAdminPanelView } from "./AccountAdminPanelView";
import { AccountAvatar } from "./AccountAvatar";
import { AccountMenuView } from "./AccountMenuView";
import { AccountSettingsView } from "./AccountSettingsView";
import { getDisplayName } from "../utils/getDisplayName";
import "../account.css";

const SETTINGS_VIEW = "settings";
const ADMIN_VIEW = "admin";

export function SidebarAccountControl({
  accessToken,
  user,
  profile,
  isSidebarCollapsed,
  onLogout,
  onLogoutAll,
  onUpdateCurrentUserProfile,
  onUploadAvatar,
  onChangePassword,
}) {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [activeView, setActiveView] = useState(null);
  const [errorMessage, setErrorMessage] = useState("");
  const displayName = getDisplayName(user);
  const username = user?.username ?? "username";
  const menuRef = useRef(null);
  const triggerRef = useRef(null);

  useEffect(() => {
    function handleKeyDown(event) {
      if (event.key !== "Escape") {
        return;
      }

      setIsMenuOpen(false);
      setErrorMessage("");
    }

    if (!isMenuOpen || activeView) {
      return undefined;
    }

    window.addEventListener("keydown", handleKeyDown);

    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [activeView, isMenuOpen]);

  useEffect(() => {
    function handlePointerDown(event) {
      if (!isMenuOpen || activeView) {
        return;
      }

      const target = event.target;

      if (
        menuRef.current?.contains(target) ||
        triggerRef.current?.contains(target)
      ) {
        return;
      }

      setIsMenuOpen(false);
      setErrorMessage("");
    }

    if (!isMenuOpen || activeView) {
      return undefined;
    }

    window.addEventListener("mousedown", handlePointerDown);

    return () => window.removeEventListener("mousedown", handlePointerDown);
  }, [activeView, isMenuOpen]);

  function handleOpenMenu() {
    setIsMenuOpen((currentValue) => !currentValue);
    setActiveView(null);
    setErrorMessage("");
  }

  function handleOpenSettings() {
    setIsMenuOpen(false);
    setActiveView(SETTINGS_VIEW);
    setErrorMessage("");
  }

  function handleOpenAdminPanel() {
    setIsMenuOpen(false);
    setActiveView(ADMIN_VIEW);
    setErrorMessage("");
  }

  function handleCloseModal() {
    setActiveView(null);
    setErrorMessage("");
  }

  async function handleFileChange(event) {
    const file = event.target.files?.[0];

    if (!file) {
      return;
    }

    if (!file.type.startsWith("image/")) {
      setErrorMessage("Можно загрузить только изображение.");
      event.target.value = "";
      return;
    }

    try {
      await onUploadAvatar(file);
      setErrorMessage("");
      event.target.value = "";
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Не удалось загрузить изображение.");
      event.target.value = "";
    }
  }

  return (
    <>
      {isMenuOpen ? (
        <div
          ref={menuRef}
          className={`account-popover${isSidebarCollapsed ? " account-popover--collapsed" : ""}`}
          role="menu"
          aria-label="Меню профиля"
        >
          <AccountMenuView
            canOpenAdminPanel={Boolean(user?.is_admin)}
            displayName={displayName}
            profile={profile}
            onLogout={onLogout}
            onOpenAdminPanel={handleOpenAdminPanel}
            onOpenSettings={handleOpenSettings}
            user={user}
            username={username}
          />
        </div>
      ) : null}

      {activeView === SETTINGS_VIEW ? (
        <AccountSettingsView
          errorMessage={errorMessage}
          onClose={handleCloseModal}
          onLogout={onLogout}
          onLogoutAll={onLogoutAll}
          onFileChange={handleFileChange}
          onUpdateCurrentUserProfile={onUpdateCurrentUserProfile}
          onChangePassword={onChangePassword}
          profile={profile}
          user={user}
        />
      ) : null}

      {activeView === ADMIN_VIEW ? (
        <AccountAdminPanelView accessToken={accessToken} currentUser={user} onClose={handleCloseModal} />
      ) : null}

      <button
        ref={triggerRef}
        type="button"
        className="account-button account-button--profile"
        aria-label={`Профиль ${displayName}`}
        aria-expanded={isMenuOpen}
        onClick={handleOpenMenu}
      >
        <AccountAvatar
          user={user}
          avatarUrl={profile?.avatarUrl ?? null}
          className="account-button__avatar"
        />
        <span className="account-button__content">
          <span className="account-button__label">{displayName}</span>
          <span className="account-button__meta">@{username}</span>
        </span>
      </button>
    </>
  );
}
