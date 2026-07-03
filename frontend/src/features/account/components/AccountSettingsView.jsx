import { useId } from "react";
import { Camera } from "lucide-react";

import { AccountModalShell } from "./AccountModalShell";
import { AccountAvatar } from "./AccountAvatar";

export function AccountSettingsView({
  errorMessage,
  onClose,
  onFileChange,
  profile,
  user,
}) {
  const inputId = useId();

  return (
    <AccountModalShell
      ariaLabel="Настройки"
      className="account-modal--settings"
      onClose={onClose}
    >
      <div className="account-modal__title">Настройки</div>

      <div className="account-settings-panel">
        <AccountAvatar
          user={user}
          avatarDataUrl={profile?.avatarDataUrl ?? null}
          className="account-settings-panel__avatar"
          imageClassName="account-avatar__image--large"
          fallbackClassName="account-avatar__fallback--large"
        />

        <div className="account-settings-panel__label">Фото профиля</div>

        <label htmlFor={inputId} className="account-settings-panel__upload">
          <span className="account-settings-panel__upload-icon">
            <Camera strokeWidth={1.95} />
          </span>
          <span>Изменить фото</span>
        </label>

        <input
          id={inputId}
          className="sr-only"
          type="file"
          accept="image/*"
          onChange={onFileChange}
        />

        {errorMessage ? (
          <div className="account-settings-panel__error">{errorMessage}</div>
        ) : null}
      </div>
    </AccountModalShell>
  );
}
