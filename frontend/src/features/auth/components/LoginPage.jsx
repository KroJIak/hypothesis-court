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
          Войди в систему, чтобы открыть рабочее пространство и продолжить работу.
        </p>
      </section>

      <section className="auth-panel" aria-label="Форма входа">
        <div className="auth-panel__header">
          <h2 className="auth-panel__title">Вход</h2>
        </div>

        <form className="auth-form" onSubmit={handleSubmit}>
          <label className="auth-field">
            <span className="auth-field__label">Логин</span>
            <span className="auth-field__control">
              <span className="auth-field__icon">
                <UserRound aria-hidden="true" strokeWidth={1.95} />
              </span>
              <input
                className="auth-field__input"
                type="text"
                name="username"
                autoComplete="username"
                placeholder="Введите логин"
                value={username}
                onChange={(event) => setUsername(event.target.value)}
                disabled={isSubmitting}
              />
            </span>
          </label>

          <label className="auth-field">
            <span className="auth-field__label">Пароль</span>
            <span className="auth-field__control">
              <span className="auth-field__icon">
                <KeyRound aria-hidden="true" strokeWidth={1.95} />
              </span>
              <input
                className="auth-field__input"
                type="password"
                name="password"
                autoComplete="current-password"
                placeholder="Введите пароль"
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
  return <main className="auth-shell auth-shell--loading" aria-label="Проверка сессии" />;
}
