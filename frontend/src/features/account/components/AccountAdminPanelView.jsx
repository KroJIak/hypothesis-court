import { Users, UserCog } from "lucide-react";

import { AccountModalShell } from "./AccountModalShell";

export function AccountAdminPanelView({ onClose }) {
  return (
    <AccountModalShell
      ariaLabel="Панель управления"
      className="account-modal--admin"
      onClose={onClose}
    >
      <div className="account-modal__title">Панель управления</div>

      <div className="account-admin-panel">
        <button type="button" className="account-admin-panel__item">
          <span className="account-admin-panel__icon">
            <Users strokeWidth={1.95} />
          </span>
          <span>Пользователи</span>
        </button>

        <button type="button" className="account-admin-panel__item">
          <span className="account-admin-panel__icon">
            <UserCog strokeWidth={1.95} />
          </span>
          <span>Администраторы</span>
        </button>
      </div>
    </AccountModalShell>
  );
}
