import { AccountModalShell } from "./AccountModalShell";
import { AdminProviderSettingsSection } from "./AdminProviderSettingsSection";
import { AdminUsersSection } from "./AdminUsersSection";

export function AccountAdminPanelView({ accessToken, currentUser, onClose }) {
  return (
    <AccountModalShell
      ariaLabel="Панель управления"
      className="account-modal--admin"
      onClose={onClose}
    >
      <div className="account-modal__title">Панель управления</div>

      <div className="account-admin-panel">
        <AdminProviderSettingsSection
          accessToken={accessToken}
          provider="openai"
          title="Провайдер модели"
          providerLabel="OpenAI-compatible"
        />
        <AdminProviderSettingsSection
          accessToken={accessToken}
          provider="embedding"
          title="Embedding модель"
          providerLabel="OpenAI-compatible"
        />
        <AdminUsersSection accessToken={accessToken} currentUser={currentUser} />
      </div>
    </AccountModalShell>
  );
}
