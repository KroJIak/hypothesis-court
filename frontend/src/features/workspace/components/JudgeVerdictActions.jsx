import { ChevronLeft, ChevronRight, Clipboard, Info, Pencil, RotateCcw } from "lucide-react";

function formatRunDate(value) {
  const date = value ? new Date(value) : null;

  if (!date || Number.isNaN(date.getTime())) {
    return "";
  }

  return new Intl.DateTimeFormat("ru-RU", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date).replace(",", " в");
}

export function JudgeVerdictActions({
  activeVersionIndex,
  versionCount,
  activeVersion,
  isLocked,
  infoRows,
  onPreviousVersion,
  onNextVersion,
  onEdit,
  onCopy,
  onRegenerate,
}) {
  if (!activeVersion || versionCount === 0) {
    return null;
  }

  const versionLabel = `${activeVersionIndex + 1} / ${versionCount}`;
  const runDate = formatRunDate(activeVersion.completedAt ?? activeVersion.createdAt);

  return (
    <div className="judge-actions" aria-label="Действия с вердиктом">
      <div className="judge-actions__version" aria-label={`Версия ${versionLabel}`}>
        <button
          type="button"
          className="judge-actions__icon-button"
          aria-label="Предыдущая версия"
          disabled={isLocked || activeVersionIndex <= 0}
          onClick={onPreviousVersion}
        >
          <ChevronLeft aria-hidden="true" strokeWidth={2.2} />
        </button>
        <span className="judge-actions__version-label">{versionLabel}</span>
        <button
          type="button"
          className="judge-actions__icon-button"
          aria-label="Следующая версия"
          disabled={isLocked || activeVersionIndex >= versionCount - 1}
          onClick={onNextVersion}
        >
          <ChevronRight aria-hidden="true" strokeWidth={2.2} />
        </button>
      </div>

      <button
        type="button"
        className="judge-actions__icon-button"
        aria-label="Редактировать параметры"
        disabled={isLocked}
        onClick={onEdit}
      >
        <Pencil aria-hidden="true" strokeWidth={2} />
      </button>
      <button
        type="button"
        className="judge-actions__icon-button"
        aria-label="Копировать вывод судьи"
        onClick={onCopy}
      >
        <Clipboard aria-hidden="true" strokeWidth={2} />
      </button>
      <span className="judge-actions__info-wrap">
        <button type="button" className="judge-actions__icon-button" aria-label="Информация о версии">
          <Info aria-hidden="true" strokeWidth={2} />
        </button>
        <span className="judge-actions__tooltip" role="tooltip">
          {infoRows.map((row) => (
            <span key={row}>{row}</span>
          ))}
        </span>
      </span>
      <button
        type="button"
        className="judge-actions__icon-button"
        aria-label="Перегенерировать"
        disabled={isLocked}
        onClick={onRegenerate}
      >
        <RotateCcw aria-hidden="true" strokeWidth={2} />
      </button>

      <span className="judge-actions__meta">{activeVersion.modelName}</span>
      {runDate ? <span className="judge-actions__meta">{runDate}</span> : null}
    </div>
  );
}
