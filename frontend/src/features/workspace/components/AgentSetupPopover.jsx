import { Sparkles, Trash2, X } from "lucide-react";

import { AgentVariantIcon, agentAvatarVariantOptions } from "./AgentAvatar";

export function AgentSetupPopover({
  agent,
  isIconPickerOpen,
  onToggleIconPicker,
  onChange,
  onGeneratePrompt,
  onDelete,
  onSave,
  style,
}) {
  const agentName = agent.name ?? "";
  const popoverTitle = agentName.trim() || "Новый эксперт";
  const selectedVariant = agent.variant ?? "empty";
  const systemPrompt = agent.systemPrompt ?? "";

  function handleClose() {
    onSave(agent.id);
  }

  return (
    <div
      className="agent-setup-popover"
      role="dialog"
      aria-label={popoverTitle ? `Настройка агента ${popoverTitle}` : "Настройка агента"}
      style={style}
    >
      <div className="agent-setup-popover__header">
        <span className="agent-setup-popover__title">{popoverTitle}</span>
        <div className="agent-setup-popover__actions">
          <button
            type="button"
            className="agent-setup-popover__delete"
            aria-label="Удалить агента"
            onClick={() => onDelete(agent.id)}
          >
            <Trash2 aria-hidden="true" strokeWidth={1.9} />
          </button>
          <button
            type="button"
            className="agent-setup-popover__close"
            aria-label="Закрыть настройку агента"
            onClick={handleClose}
          >
            <X aria-hidden="true" strokeWidth={1.9} />
          </button>
        </div>
      </div>

      <div className="agent-setup-popover__identity">
        <div className="agent-setup-popover__icon-wrap">
          <button
            type="button"
            className="agent-setup-popover__icon-button"
            aria-label="Выбрать иконку агента"
            aria-expanded={isIconPickerOpen}
            onClick={onToggleIconPicker}
          >
            <AgentVariantIcon variant={selectedVariant} className="agent-setup-popover__selected-icon" strokeWidth={1.9} />
          </button>
          {isIconPickerOpen ? (
            <div className="agent-setup-popover__icon-picker" aria-label="Иконки агента">
              {agentAvatarVariantOptions.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  className={
                    option.value === selectedVariant
                      ? "agent-setup-popover__icon-option agent-setup-popover__icon-option--active"
                      : "agent-setup-popover__icon-option"
                  }
                  aria-label={option.label}
                  title={option.label}
                  onClick={() => {
                    onChange(agent.id, { variant: option.value });
                    onToggleIconPicker(false);
                  }}
                >
                  <AgentVariantIcon variant={option.value} className="agent-setup-popover__option-icon" strokeWidth={1.9} />
                </button>
              ))}
            </div>
          ) : null}
        </div>

        <label className="agent-setup-popover__name-field">
          <span className="sr-only">Название агента</span>
          <input
            value={agentName}
            onChange={(event) => onChange(agent.id, { name: event.target.value })}
            placeholder="Название агента"
          />
        </label>
      </div>

      <button
        type="button"
        className="agent-setup-popover__generate"
        onClick={() => onGeneratePrompt(agent.id)}
      >
        <Sparkles aria-hidden="true" strokeWidth={1.8} />
        Сгенерировать
      </button>

      <label className="agent-setup-popover__prompt-field">
        <span>Системный промт</span>
        <textarea
          value={systemPrompt}
          onChange={(event) => onChange(agent.id, { systemPrompt: event.target.value })}
          placeholder="Опишите роль, стиль рассуждений и критерии оценки агента."
        />
      </label>
    </div>
  );
}
