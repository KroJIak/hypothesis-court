import { LogOut, Settings, Shield } from "lucide-react";

import { AccountAvatar } from "./AccountAvatar";

export function AccountMenuView({
  canOpenAdminPanel,
  displayName,
  profile,
  onLogout,
  onOpenAdminPanel,
  onOpenSettings,
  user,
  username,
}) {
  return (
    <>
      <div className="account-popover__header">
        <AccountAvatar
          user={user}
          avatarUrl={profile?.avatarUrl ?? null}
          className="account-popover__avatar"
          fallbackClassName="account-avatar__fallback--menu"
        />
        <div className="account-popover__identity">
          <div className="account-popover__name">{displayName}</div>
          <div className="account-popover__username">@{username}</div>
        </div>
      </div>

      <div className="account-popover__actions">
        <button type="button" className="account-menu-item" onClick={onOpenSettings}>
          <span className="account-menu-item__icon"><Settings strokeWidth={1.95} /></span>
          <span className="account-menu-item__title">Настройки</span>
        </button>

        {canOpenAdminPanel ? (
          <button type="button" className="account-menu-item" onClick={onOpenAdminPanel}>
            <span className="account-menu-item__icon"><Shield strokeWidth={1.95} /></span>
            <span className="account-menu-item__title">Панель управления</span>
          </button>
        ) : null}

        <button type="button" className="account-menu-item" onClick={onLogout}>
          <span className="account-menu-item__icon"><LogOut strokeWidth={1.95} /></span>
          <span className="account-menu-item__title">Выйти</span>
        </button>
      </div>
    </>
  );
}
