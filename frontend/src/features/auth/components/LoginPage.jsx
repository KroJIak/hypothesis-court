import { useState } from "react";
import { ArrowRight, KeyRound, LoaderCircle, Scale, UserRound } from "lucide-react";

import "../auth.css";

export function LoginPage({ errorMessage, isSubmitting, onLogin }) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");

  async function handleSubmit(event) {
    event.preventDefault();
    await onLogin({
      username: username.trim(),
      password,
    });
  }

  const isSubmitDisabled = isSubmitting || !username.trim() || !password;

  return (
    <main className="auth-shell">
      <div className="auth-ambient auth-ambient--left" aria-hidden="true" />
      <div className="auth-ambient auth-ambient--right" aria-hidden="true" />

      <section className="auth-hero">
        <div className="auth-brand">
          <span className="auth-brand__mark">
            <Scale aria-hidden="true" strokeWidth={2.05} />
          </span>
          <div className="auth-brand__copy">
            <span>Hypothesis</span>
            <span>Court</span>
          </div>
        </div>

        <p className="auth-kicker">Research Workspace</p>
        <h1 className="auth-title">Вход в исследовательскую рабочую среду</h1>
        <p className="auth-summary">
          Авторизуйся, чтобы перейти к сцене обсуждения гипотез и подключить текущую
          сессию к реальному backend.
        </p>

        <div className="auth-notes">
          <div className="auth-note">
            <span className="auth-note__label">Что внутри</span>
            <span className="auth-note__value">реальный вход через API</span>
          </div>
          <div className="auth-note">
            <span className="auth-note__label">После входа</span>
            <span className="auth-note__value">текущий workspace откроется без перезагрузки</span>
          </div>
        </div>
      </section>

      <section className="auth-panel" aria-label="Форма входа">
        <div className="auth-panel__header">
          <h2 className="auth-panel__title">Sign in</h2>
          <p className="auth-panel__subtitle">Используй учётную запись, созданную администратором.</p>
        </div>

        <form className="auth-form" onSubmit={handleSubmit}>
          <label className="auth-field">
            <span className="auth-field__label">Username</span>
            <span className="auth-field__control">
              <span className="auth-field__icon">
                <UserRound aria-hidden="true" strokeWidth={1.95} />
              </span>
              <input
                className="auth-field__input"
                type="text"
                name="username"
                autoComplete="username"
                placeholder="superadmin"
                value={username}
                onChange={(event) => setUsername(event.target.value)}
                disabled={isSubmitting}
              />
            </span>
          </label>

          <label className="auth-field">
            <span className="auth-field__label">Password</span>
            <span className="auth-field__control">
              <span className="auth-field__icon">
                <KeyRound aria-hidden="true" strokeWidth={1.95} />
              </span>
              <input
                className="auth-field__input"
                type="password"
                name="password"
                autoComplete="current-password"
                placeholder="Enter password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                disabled={isSubmitting}
              />
            </span>
          </label>

          {errorMessage ? <div className="auth-form__error">{errorMessage}</div> : null}

          <button className="auth-submit" type="submit" disabled={isSubmitDisabled}>
            <span className="auth-submit__copy">
              {isSubmitting ? "Выполняется вход" : "Войти"}
            </span>
            <span className="auth-submit__icon">
              {isSubmitting ? (
                <LoaderCircle aria-hidden="true" strokeWidth={2} className="auth-spinner" />
              ) : (
                <ArrowRight aria-hidden="true" strokeWidth={2} />
              )}
            </span>
          </button>
        </form>
      </section>
    </main>
  );
}

export function AuthBootstrapScreen() {
  return (
    <main className="auth-shell auth-shell--loading">
      <div className="auth-bootstrap">
        <span className="auth-bootstrap__mark">
          <Scale aria-hidden="true" strokeWidth={2.05} />
        </span>
        <span className="auth-bootstrap__text">Проверяем активную сессию…</span>
      </div>
    </main>
  );
}
