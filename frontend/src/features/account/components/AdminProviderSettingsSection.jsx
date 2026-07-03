import { useEffect, useMemo, useState } from "react";
import { Eye, EyeOff, PlugZap } from "lucide-react";

import {
  getProviderSettings,
  listProviderModels,
  testProviderConnection,
  updateProviderSettings,
} from "../api/adminModelProviderSettings";

function mergeModelOptions(...modelGroups) {
  return [...new Set(modelGroups.flat().filter(Boolean))];
}

export function AdminProviderSettingsSection({
  accessToken,
  provider,
  title,
  providerLabel,
}) {
  const [baseUrl, setBaseUrl] = useState("");
  const [apiToken, setApiToken] = useState("");
  const [model, setModel] = useState("");
  const [availableModels, setAvailableModels] = useState([]);
  const [hasApiToken, setHasApiToken] = useState(false);
  const [isApiTokenVisible, setIsApiTokenVisible] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [successMessage, setSuccessMessage] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isTesting, setIsTesting] = useState(false);
  const modelOptions = useMemo(
    () => mergeModelOptions([model], availableModels),
    [availableModels, model],
  );

  useEffect(() => {
    let isActive = true;

    setIsLoading(true);
    getProviderSettings({ accessToken, provider })
      .then((settings) => {
        if (!isActive) {
          return;
        }

        const nextModel = settings?.model ?? "";
        setBaseUrl(settings?.base_url ?? "");
        setModel(nextModel);
        setHasApiToken(Boolean(settings?.has_api_token));
        setAvailableModels(mergeModelOptions([nextModel]));
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
  }, [accessToken, provider]);

  async function refreshModels() {
    const payload = await listProviderModels({
      accessToken,
      provider,
      baseUrl,
      apiToken: apiToken.trim() || null,
    });

    const nextModels = payload.models ?? [];
    setAvailableModels(mergeModelOptions(nextModels, [model]));
    return nextModels;
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setIsSaving(true);
    setErrorMessage("");
    setSuccessMessage("");

    try {
      const settings = await updateProviderSettings({
        accessToken,
        provider,
        baseUrl,
        model,
        apiToken: apiToken.trim() || null,
      });
      setBaseUrl(settings.base_url);
      setModel(settings.model);
      setApiToken("");
      setHasApiToken(Boolean(settings.has_api_token));
      setSuccessMessage("Сохранено.");
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Не удалось сохранить настройки провайдера.");
    } finally {
      setIsSaving(false);
    }
  }

  async function handleTestConnection() {
    setIsTesting(true);
    setErrorMessage("");
    setSuccessMessage("");

    try {
      const payload = await testProviderConnection({
        accessToken,
        provider,
        baseUrl,
        model,
        apiToken: apiToken.trim() || null,
      });
      setAvailableModels(mergeModelOptions(payload.models ?? [], [model]));
      setSuccessMessage("Подключение работает.");
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Не удалось проверить подключение.");
    } finally {
      setIsTesting(false);
    }
  }

  async function handleModelSelectFocus() {
    if (isLoading || isTesting || !baseUrl.trim()) {
      return;
    }

    try {
      await refreshModels();
    } catch {
      // The explicit test button is responsible for showing connection errors.
    }
  }

  return (
    <section className="account-admin-section">
      <div className="account-admin-section__header">
        <h3>{title}</h3>
        <span>{providerLabel}</span>
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
          <span>Модель</span>
          <select
            value={model}
            disabled={isLoading}
            onFocus={handleModelSelectFocus}
            onChange={(event) => setModel(event.target.value)}
            required
          >
            {modelOptions.map((modelOption) => (
              <option key={modelOption} value={modelOption}>
                {modelOption}
              </option>
            ))}
          </select>
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
        {successMessage ? <div className="account-admin-success">{successMessage}</div> : null}

        <div className="account-admin-actions">
          <button
            type="button"
            className="account-admin-test-button"
            disabled={isLoading || isTesting || !baseUrl.trim() || !model.trim()}
            aria-label="Проверить подключение"
            onClick={handleTestConnection}
          >
            <PlugZap aria-hidden="true" strokeWidth={1.95} />
          </button>
          <button type="submit" className="account-admin-button" disabled={isLoading || isSaving}>
            {isSaving ? "Сохранение..." : "Сохранить"}
          </button>
        </div>
      </form>
    </section>
  );
}
