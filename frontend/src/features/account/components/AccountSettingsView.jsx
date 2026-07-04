import { useId, useRef, useState } from "react";
import { LogOut, Pencil, ShieldX } from "lucide-react";

import { AccountModalShell } from "./AccountModalShell";
import { AccountAvatar } from "./AccountAvatar";
import { getDisplayName } from "../utils/getDisplayName";

export function AccountSettingsView({
  errorMessage,
  onChangePassword,
  onClose,
  onFileChange,
  onLogout,
  onLogoutAll,
  onUpdateCurrentUserProfile,
  profile,
  user,
}) {
  const inputId = useId();
  const [firstName, setFirstName] = useState(user?.first_name ?? "");
  const [lastName, setLastName] = useState(user?.last_name ?? "");
  const [oldPassword, setOldPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [newPasswordRepeat, setNewPasswordRepeat] = useState("");
  const [profileError, setProfileError] = useState("");
  const [passwordError, setPasswordError] = useState("");
  const [isPasswordSubmitting, setIsPasswordSubmitting] = useState(false);
  const profileSavePromiseRef = useRef(null);
  const displayName = getDisplayName(user);

  async function saveProfile() {
    if (profileSavePromiseRef.current) {
      return profileSavePromiseRef.current;
    }

    const nextFirstName = firstName.trim();
    const nextLastName = lastName.trim();

    if (
      nextFirstName === (user?.first_name ?? "") &&
      nextLastName === (user?.last_name ?? "")
    ) {
      return true;
    }

    setProfileError("");

    const savePromise = onUpdateCurrentUserProfile({
      firstName: nextFirstName,
      lastName: nextLastName,
    })
      .then(() => true)
      .catch((error) => {
        setProfileError(error instanceof Error ? error.message : "Не удалось сохранить профиль");
        return false;
      })
      .finally(() => {
        profileSavePromiseRef.current = null;
      });

    profileSavePromiseRef.current = savePromise;

    return savePromise;
  }

  async function handleClose() {
    const isSaved = await saveProfile();

    if (isSaved) {
      onClose();
    }
  }

  async function handleLogout() {
    const isSaved = await saveProfile();

    if (isSaved) {
      onLogout();
    }
  }

  async function handleLogoutAll() {
    const isSaved = await saveProfile();

    if (isSaved) {
      onLogoutAll();
    }
  }

  async function handlePasswordSubmit(event) {
    event.preventDefault();
    setPasswordError("");

    if (newPassword !== newPasswordRepeat) {
      setPasswordError("Новый пароль и повтор не совпадают.");
      return;
    }

    setIsPasswordSubmitting(true);

    try {
      await onChangePassword({
        oldPassword,
        newPassword,
        newPasswordRepeat,
      });
    } catch (error) {
      setPasswordError(error instanceof Error ? error.message : "Не удалось сменить пароль");
      setIsPasswordSubmitting(false);
    }
  }

  return (
    <AccountModalShell
      ariaLabel="Настройки"
      className="account-modal--settings"
      onClose={handleClose}
    >
      <div className="account-modal__title">Настройки</div>

      <div className="account-settings">
        {errorMessage ? (
          <div className="account-settings__error">{errorMessage}</div>
        ) : null}

        <section className="account-settings__section">
          <div className="account-settings__section-title">Профиль</div>

          <div className="account-settings__profile-layout">
            <div className="account-settings__avatar-column">
              <label htmlFor={inputId} className="account-settings__avatar-action">
                <AccountAvatar
                  user={user}
                  avatarUrl={profile?.avatarUrl ?? null}
                  className="account-settings__avatar"
                  imageClassName="account-avatar__image--large"
                  fallbackClassName="account-avatar__fallback--large"
                />
                <span className="account-settings__avatar-overlay" aria-hidden="true">
                  <span className="account-settings__avatar-edit">
                    <Pencil strokeWidth={2} />
                  </span>
                </span>
              </label>

              <input
                id={inputId}
                className="sr-only"
                type="file"
                accept="image/*"
                onChange={onFileChange}
              />

              <div className="account-settings__identity">
                <div className="account-settings__name">{displayName}</div>
                <div className="account-settings__username">@{user.username}</div>
              </div>
            </div>

            <div className="account-settings__field-stack">
              <label className="account-settings__field">
                <span>Имя</span>
                <input
                  type="text"
                  value={firstName}
                  maxLength={100}
                  onChange={(event) => setFirstName(event.target.value)}
                />
              </label>

              <label className="account-settings__field">
                <span>Фамилия</span>
                <input
                  type="text"
                  value={lastName}
                  maxLength={100}
                  onChange={(event) => setLastName(event.target.value)}
                />
              </label>
            </div>
          </div>

          {profileError ? <div className="account-settings__error">{profileError}</div> : null}
        </section>

        <form className="account-settings__section" onSubmit={handlePasswordSubmit}>
          <div className="account-settings__section-title">Смена пароля</div>

          <label className="account-settings__field">
            <span>Старый пароль</span>
            <input
              type="password"
              autoComplete="current-password"
              value={oldPassword}
              onChange={(event) => setOldPassword(event.target.value)}
            />
          </label>

          <label className="account-settings__field">
            <span>Новый пароль</span>
            <input
              type="password"
              autoComplete="new-password"
              value={newPassword}
              onChange={(event) => setNewPassword(event.target.value)}
            />
          </label>

          <label className="account-settings__field">
            <span>Повторите новый пароль</span>
            <input
              type="password"
              autoComplete="new-password"
              value={newPasswordRepeat}
              onChange={(event) => setNewPasswordRepeat(event.target.value)}
            />
          </label>

          {passwordError ? <div className="account-settings__error">{passwordError}</div> : null}

          <button
            type="submit"
            className="account-settings__button account-settings__button--primary"
            disabled={isPasswordSubmitting}
          >
            {isPasswordSubmitting ? "Смена..." : "Сменить пароль"}
          </button>

          <div className="account-settings__session-actions">
            <button type="button" className="account-settings__button" onClick={handleLogoutAll}>
              <ShieldX strokeWidth={1.95} />
              <span>Выйти из всех сессий</span>
            </button>

            <button type="button" className="account-settings__button" onClick={handleLogout}>
              <LogOut strokeWidth={1.95} />
              <span>Выйти</span>
            </button>
          </div>
        </form>
      </div>
    </AccountModalShell>
  );
}
