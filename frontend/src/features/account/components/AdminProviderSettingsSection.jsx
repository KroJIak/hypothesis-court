import { useEffect, useMemo, useState } from "react";
import { Eye, EyeOff, PlugZap } from "lucide-react";

import {
  getProviderSettings,
  listProviderModels,
  testProviderConnection,
  updateProviderSettings,
} from "../api/adminModelProviderSettings";

const PROVIDER_TYPE_OPTIONS = [
  { value: "openai", label: "OpenAI" },
  { value: "yandex_ai_studio", label: "Yandex AI Studio" },
];

function mergeModelOptions(...modelGroups) {
  return [...new Set(modelGroups.flat().filter(Boolean))];
}

export function AdminProviderSettingsSection({
  accessToken,
  provider,
  title,
  providerLabel,
}) {
  const [providerType, setProviderType] = useState("openai");
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
        setProviderType(settings?.provider_type ?? "openai");
        setBaseUrl(settings?.base_url ?? "");
        setModel(nextModel);
        setApiToken(settings?.api_token ?? "");
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
      providerType,
      baseUrl,
      apiToken: apiToken?.trim() || null,
    });

    const nextModels = payload.models ?? [];
    setAvailableModels(mergeModelOptions(nextModels, [model?.trim() || ""]));
    return nextModels;
  }

  async function handleSubmit(event) {
    event.preventDefault();
    const nextModel = model?.trim() || "";
    const nextApiToken = apiToken?.trim() || null;
    setIsSaving(true);
    setErrorMessage("");
    setSuccessMessage("");

    try {
      const settings = await updateProviderSettings({
        accessToken,
        provider,
        providerType,
        baseUrl,
        model: nextModel,
        apiToken: nextApiToken,
      });
      setBaseUrl(settings.base_url);
      setModel(settings.model ?? "");
      setApiToken(settings.api_token ?? nextApiToken ?? "");
      setHasApiToken(Boolean(settings.has_api_token));
      setSuccessMessage("Сохранено.");
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Не удалось сохранить настройки провайдера.");
    } finally {
      setIsSaving(false);
    }
  }

  async function handleTestConnection() {
    const nextModel = model?.trim() || "";
    setIsTesting(true);
    setErrorMessage("");
    setSuccessMessage("");

    try {
      const nextModels = nextModel
        ? (await testProviderConnection({
            accessToken,
            provider,
            providerType,
            baseUrl,
            model: nextModel,
            apiToken: apiToken?.trim() || null,
          })).models ?? []
        : await refreshModels();

      setAvailableModels(mergeModelOptions(nextModels, [nextModel]));
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

  function handleProviderTypeChange(event) {
    setProviderType(event.target.value);
    setModel("");
    setAvailableModels([]);
    setErrorMessage("");
    setSuccessMessage("");
  }

  return (
    <section className="account-admin-section">
      <div className="account-admin-section__header">
        <h3>{title}</h3>
        <span>{providerLabel}</span>
      </div>

      <form className="account-admin-form" onSubmit={handleSubmit}>
        <div className="account-admin-provider-row">
          <label className="account-admin-field account-admin-field--provider-type">
            <span>Провайдер</span>
            <select value={providerType} disabled={isLoading} onChange={handleProviderTypeChange}>
              {PROVIDER_TYPE_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>

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
        </div>

        <label className="account-admin-field">
          <span>Модель</span>
          <select
            value={model ?? ""}
            disabled={isLoading}
            onFocus={handleModelSelectFocus}
            onChange={(event) => setModel(event.target.value)}
          >
            <option value="">
              {modelOptions.length === 0 ? "Сначала проверьте подключение" : "Не выбрана"}
            </option>
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
              value={apiToken ?? ""}
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

        <div className="account-admin-actions">
          <button
            type="button"
            className="account-admin-test-button"
            disabled={isLoading || isTesting || !baseUrl.trim()}
            aria-label="Проверить подключение"
            onClick={handleTestConnection}
          >
            <PlugZap aria-hidden="true" strokeWidth={1.95} />
          </button>
          <button type="submit" className="account-admin-button" disabled={isLoading || isSaving}>
            {isSaving ? "Сохранение..." : "Сохранить"}
          </button>
          {errorMessage ? <div className="account-admin-inline-message account-admin-inline-message--error">{errorMessage}</div> : null}
          {successMessage ? <div className="account-admin-inline-message account-admin-inline-message--success">{successMessage}</div> : null}
        </div>
      </form>
    </section>
  );
}
