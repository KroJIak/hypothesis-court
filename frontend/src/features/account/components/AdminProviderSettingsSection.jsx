import { useEffect, useState } from "react";
import { Eye, EyeOff } from "lucide-react";

import {
  getOpenAIProviderSettings,
  updateOpenAIProviderSettings,
} from "../api/adminModelProviderSettings";

export function AdminProviderSettingsSection({ accessToken }) {
  const [baseUrl, setBaseUrl] = useState("");
  const [apiToken, setApiToken] = useState("");
  const [hasApiToken, setHasApiToken] = useState(false);
  const [isApiTokenVisible, setIsApiTokenVisible] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    let isActive = true;

    getOpenAIProviderSettings(accessToken)
      .then((settings) => {
        if (!isActive) {
          return;
        }

        setBaseUrl(settings?.base_url ?? "");
        setHasApiToken(Boolean(settings?.has_api_token));
        setErrorMessage("");
      })
      .catch((error) => {
        if (!isActive) {
          return;
        }

        setErrorMessage(error instanceof Error ? error.message : "Не удалось загрузить настройки провайдера.");
      })
      .finally(() => {
        if (isActive) {
          setIsLoading(false);
        }
      });

    return () => {
      isActive = false;
    };
  }, [accessToken]);

  async function handleSubmit(event) {
    event.preventDefault();
    setIsSaving(true);
    setErrorMessage("");

    try {
      const settings = await updateOpenAIProviderSettings({
        accessToken,
        baseUrl,
        apiToken: apiToken.trim() || null,
      });
      setBaseUrl(settings.base_url);
      setApiToken("");
      setHasApiToken(Boolean(settings.has_api_token));
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Не удалось сохранить настройки провайдера.");
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <section className="account-admin-section">
      <div className="account-admin-section__header">
        <h3>Провайдер модели</h3>
        <span>OpenAI</span>
      </div>

      <form className="account-admin-form" onSubmit={handleSubmit}>
        <label className="account-admin-field">
          <span>Base URL</span>
          <input
            type="url"
            value={baseUrl}
            placeholder="https://api.openai.com/v1"
            disabled={isLoading}
            onChange={(event) => setBaseUrl(event.target.value)}
            required
          />
        </label>

        <label className="account-admin-field">
          <span>API токен</span>
          <span className="account-admin-password-input">
            <input
              type={isApiTokenVisible ? "text" : "password"}
              value={apiToken}
              placeholder={hasApiToken ? "Токен уже сохранён" : "Введите API токен"}
              disabled={isLoading}
              onChange={(event) => setApiToken(event.target.value)}
            />
            <button
              type="button"
              aria-label={isApiTokenVisible ? "Скрыть токен" : "Показать токен"}
              disabled={isLoading}
              onClick={() => setIsApiTokenVisible((currentValue) => !currentValue)}
            >
              {isApiTokenVisible ? <EyeOff strokeWidth={1.9} /> : <Eye strokeWidth={1.9} />}
            </button>
          </span>
        </label>

        {errorMessage ? <div className="account-admin-error">{errorMessage}</div> : null}

        <button type="submit" className="account-admin-button" disabled={isLoading || isSaving}>
          {isSaving ? "Сохранение..." : "Сохранить провайдера"}
        </button>
      </form>
    </section>
  );
}
