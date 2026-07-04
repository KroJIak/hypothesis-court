import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import {
  FileArchive,
  FileBox,
  FileCode,
  FileImage,
  FileSpreadsheet,
  FileText,
  FileType,
  Paperclip,
  SendHorizontal,
  ChevronDown,
  Trash2,
  X,
} from "lucide-react";

import {
  ATTACHMENT_TOOLTIP_EDGE_OFFSET,
  ATTACHMENT_TOOLTIP_GAP,
  COMPOSER_CONTEXT_OPTIONS,
  PROCESSING_STATUS_PROCESSING,
  PROCESSING_STATUS_PROCESSED,
} from "../constants";
import { clampNumber } from "../utils/format";
import { ProcessingStatusBadge } from "./ProcessingStatusBadge";

const ATTACHMENT_STAGE_TICK_MS = 240;
const ATTACHMENT_STAGE_MS = 900;
const ATTACHMENT_STAGE_STAGGER_MS = 420;
const attachmentProcessingTimelines = new Map();

const ATTACHMENT_PROCESSING_STAGES = [
  { value: "parsing", label: "Разбор файла", status: PROCESSING_STATUS_PROCESSING },
  { value: "chunked", label: "Фрагментация", status: PROCESSING_STATUS_PROCESSING },
  { value: "indexed", label: "Индексация", status: PROCESSING_STATUS_PROCESSING },
  { value: "done", label: "Готово", status: PROCESSING_STATUS_PROCESSED },
];

const attachmentIconByKind = {
  csv: FileSpreadsheet,
  doc: FileType,
  docx: FileType,
  image: FileImage,
  jpg: FileImage,
  jpeg: FileImage,
  json: FileCode,
  pdf: FileText,
  png: FileImage,
  txt: FileText,
  xls: FileSpreadsheet,
  xlsx: FileSpreadsheet,
  zip: FileArchive,
};

function getAttachmentIcon(kind) {
  return attachmentIconByKind[kind?.toLocaleLowerCase()] ?? FileBox;
}

function getAttachmentTypeLabel(attachment) {
  return (attachment.shortLabel ?? attachment.kind ?? "file").toLocaleUpperCase();
}

function createAttachmentProcessingSignature(attachments) {
  return attachments.map((attachment) => attachment.id).join(",");
}

function getOrCreateAttachmentProcessingTimeline(sessionId, attachments) {
  if (!sessionId) {
    return null;
  }

  const signature = createAttachmentProcessingSignature(attachments);
  const existingTimeline = attachmentProcessingTimelines.get(sessionId);

  if (existingTimeline?.signature === signature) {
    return existingTimeline;
  }

  const nextTimeline = {
    signature,
    startedAt: Date.now(),
  };

  attachmentProcessingTimelines.set(sessionId, nextTimeline);

  return nextTimeline;
}

function getAttachmentSizeRank(attachment, index) {
  return Number.isFinite(attachment.sizeKb) ? attachment.sizeKb : index;
}

function getAttachmentProcessingOrder(attachments) {
  return new Map(
    attachments
      .map((attachment, index) => ({
        id: attachment.id,
        originalIndex: index,
        sizeRank: getAttachmentSizeRank(attachment, index),
      }))
      .sort((firstAttachment, secondAttachment) => {
        if (secondAttachment.sizeRank !== firstAttachment.sizeRank) {
          return secondAttachment.sizeRank - firstAttachment.sizeRank;
        }

        return firstAttachment.originalIndex - secondAttachment.originalIndex;
      })
      .map((attachment, processingIndex) => [attachment.id, processingIndex]),
  );
}

function getAttachmentProcessingStage(processingIndex, elapsedMs) {
  const attachmentElapsedMs = Math.max(0, elapsedMs - (processingIndex * ATTACHMENT_STAGE_STAGGER_MS));
  const stageIndex = Math.min(
    ATTACHMENT_PROCESSING_STAGES.length - 1,
    Math.floor(attachmentElapsedMs / ATTACHMENT_STAGE_MS),
  );

  return ATTACHMENT_PROCESSING_STAGES[stageIndex] ?? ATTACHMENT_PROCESSING_STAGES[0];
}

function getAttachmentViewModels(attachments, isProcessRunning, timeline, now) {
  if (!isProcessRunning || !timeline || attachments.length === 0) {
    return attachments;
  }

  const elapsedMs = Math.max(0, now - timeline.startedAt);
  const processingOrder = getAttachmentProcessingOrder(attachments);

  return attachments.map((attachment, index) => {
    const processingIndex = processingOrder.get(attachment.id) ?? index;
    const stage = getAttachmentProcessingStage(processingIndex, elapsedMs);

    return {
      ...attachment,
      processingStatus: stage.status,
      processingStage: stage.value,
      processingStageLabel: stage.label,
      tooltip: `${attachment.tooltip} · ${stage.label}`,
    };
  });
}

function AttachmentChip({
  attachment,
  canRemoveAttachment,
  setAttachmentButtonRef,
  showAttachmentTooltip,
  hideAttachmentTooltip,
  onRemoveAttachment,
}) {
  const AttachmentIcon = getAttachmentIcon(attachment.kind);
  const attachmentTypeLabel = getAttachmentTypeLabel(attachment);

  return (
    <div
      ref={(node) => setAttachmentButtonRef(attachment.id, node)}
      className="attachment-chip"
      onMouseEnter={(event) => showAttachmentTooltip(attachment.id, event.currentTarget)}
      onMouseLeave={hideAttachmentTooltip}
      onFocus={(event) => showAttachmentTooltip(attachment.id, event.currentTarget)}
      onBlur={hideAttachmentTooltip}
    >
      <ProcessingStatusBadge status={attachment.processingStatus} />
      <button type="button" className="attachment-chip__preview" aria-label={attachment.tooltip}>
        <span className="attachment-chip__icon">
          <AttachmentIcon aria-hidden="true" strokeWidth={1.9} />
        </span>
        <span className="attachment-chip__type" aria-hidden="true">
          {attachmentTypeLabel}
        </span>
      </button>
      {canRemoveAttachment ? (
        <button
          type="button"
          className="attachment-chip__remove"
          aria-label={`Удалить вложение ${attachment.tooltip}`}
          onClick={() => {
            hideAttachmentTooltip();
            onRemoveAttachment?.(attachment.id);
          }}
        >
          <X aria-hidden="true" strokeWidth={2.1} />
        </button>
      ) : null}
    </div>
  );
}

export function Composer({
  composer,
  sessionId,
  attachments,
  composerRequests,
  draftMessage,
  isAttachmentUploading = false,
  isProcessRunning = false,
  canEditAttachments = true,
  onAttachFiles,
  onDraftMessageChange,
  onRemoveAttachment,
  onRemoveComposerRequest,
  onStop,
  onSend,
}) {
  const attachmentButtonRefs = useRef(new Map());
  const attachmentInputRef = useRef(null);
  const requestStackRef = useRef(null);
  const [activeAttachmentId, setActiveAttachmentId] = useState(null);
  const [attachmentTooltipStyle, setAttachmentTooltipStyle] = useState({ left: "0px", top: "0px" });
  const [composerContext, setComposerContext] = useState(COMPOSER_CONTEXT_OPTIONS[0].value);
  const [isContextMenuOpen, setIsContextMenuOpen] = useState(false);
  const [attachmentNow, setAttachmentNow] = useState(() => Date.now());
  const attachmentTimeline = useMemo(() => {
    if (!isProcessRunning) {
      if (sessionId) {
        attachmentProcessingTimelines.delete(sessionId);
      }

      return null;
    }

    return getOrCreateAttachmentProcessingTimeline(sessionId, attachments);
  }, [attachments, isProcessRunning, sessionId]);
  const attachmentViewModels = useMemo(
    () => getAttachmentViewModels(attachments, isProcessRunning, attachmentTimeline, attachmentNow),
    [attachmentNow, attachmentTimeline, attachments, isProcessRunning],
  );
  const activeAttachment = attachmentViewModels.find((attachment) => attachment.id === activeAttachmentId) ?? null;
  const selectedContext =
    COMPOSER_CONTEXT_OPTIONS.find((option) => option.value === composerContext) ?? COMPOSER_CONTEXT_OPTIONS[0];
  const hasDraftMessage = draftMessage.trim().length > 0;
  const isStartMode = !hasDraftMessage && composerRequests.length > 0;

  useEffect(() => {
    if (!requestStackRef.current) {
      return;
    }

    requestStackRef.current.scrollTop = requestStackRef.current.scrollHeight;
  }, [composerRequests.length]);

  useEffect(() => {
    setAttachmentNow(Date.now());

    if (!isProcessRunning || attachments.length === 0) {
      return undefined;
    }

    const intervalId = window.setInterval(() => {
      setAttachmentNow(Date.now());
    }, ATTACHMENT_STAGE_TICK_MS);

    return () => window.clearInterval(intervalId);
  }, [attachments.length, isProcessRunning]);

  const setAttachmentButtonRef = useCallback((attachmentId, node) => {
    if (node) {
      attachmentButtonRefs.current.set(attachmentId, node);
      return;
    }

    attachmentButtonRefs.current.delete(attachmentId);
  }, []);

  const updateAttachmentTooltip = useCallback((attachmentId, sourceElement = null) => {
    const buttonElement = sourceElement ?? attachmentButtonRefs.current.get(attachmentId);

    if (!buttonElement) {
      return;
    }

    const buttonRect = buttonElement.getBoundingClientRect();
    const tooltipLeft = clampNumber(
      buttonRect.left + buttonRect.width / 2,
      ATTACHMENT_TOOLTIP_EDGE_OFFSET,
      window.innerWidth - ATTACHMENT_TOOLTIP_EDGE_OFFSET,
    );
    const tooltipTop = clampNumber(
      buttonRect.top - ATTACHMENT_TOOLTIP_GAP,
      ATTACHMENT_TOOLTIP_EDGE_OFFSET,
      window.innerHeight - ATTACHMENT_TOOLTIP_EDGE_OFFSET,
    );

    setAttachmentTooltipStyle({
      left: `${tooltipLeft}px`,
      top: `${tooltipTop}px`,
    });
  }, []);

  const showAttachmentTooltip = useCallback((attachmentId, sourceElement) => {
    setActiveAttachmentId(attachmentId);
    updateAttachmentTooltip(attachmentId, sourceElement);
  }, [updateAttachmentTooltip]);

  const hideAttachmentTooltip = useCallback(() => {
    setActiveAttachmentId(null);
  }, []);

  const handleAttachmentRailScroll = useCallback(() => {
    hideAttachmentTooltip();
  }, [hideAttachmentTooltip]);

  useEffect(() => {
    if (!activeAttachmentId) {
      return undefined;
    }

    window.addEventListener("scroll", hideAttachmentTooltip, true);
    window.addEventListener("resize", hideAttachmentTooltip);

    return () => {
      window.removeEventListener("scroll", hideAttachmentTooltip, true);
      window.removeEventListener("resize", hideAttachmentTooltip);
    };
  }, [activeAttachmentId, hideAttachmentTooltip]);

  const handleContextBlur = useCallback((event) => {
    if (event.currentTarget.contains(event.relatedTarget)) {
      return;
    }

    setIsContextMenuOpen(false);
  }, []);

  const handleContextKeyDown = useCallback((event) => {
    if (event.key === "Escape") {
      setIsContextMenuOpen(false);
    }
  }, []);

  const handleSelectContext = useCallback((value) => {
    setComposerContext(value);
    setIsContextMenuOpen(false);
  }, []);

  const handleOpenAttachmentPicker = useCallback(() => {
    if (isAttachmentUploading || !canEditAttachments) {
      return;
    }

    attachmentInputRef.current?.click();
  }, [canEditAttachments, isAttachmentUploading]);

  const handleAttachmentInputChange = useCallback((event) => {
    const files = Array.from(event.target.files ?? []);
    event.target.value = "";

    if (files.length === 0) {
      return;
    }

    onAttachFiles?.(files);
  }, [onAttachFiles]);

  const handleSubmit = useCallback((event) => {
    event.preventDefault();
    onSend({
      context: selectedContext,
      text: draftMessage,
    });
  }, [draftMessage, onSend, selectedContext]);

  const handleInputKeyDown = useCallback((event) => {
    if (event.key !== "Enter" || event.shiftKey) {
      return;
    }

    event.preventDefault();
    event.currentTarget.form?.requestSubmit();
  }, []);

  return (
    <div className={isProcessRunning ? "composer-shell composer-shell--running" : "composer-shell"}>
      <div className="attachment-dock">
        <div className="attachment-rail" aria-label="Вложения" onScroll={handleAttachmentRailScroll}>
          {attachmentViewModels.map((attachment) => (
            <AttachmentChip
              key={attachment.id}
              attachment={attachment}
              canRemoveAttachment={canEditAttachments}
              setAttachmentButtonRef={setAttachmentButtonRef}
              showAttachmentTooltip={showAttachmentTooltip}
              hideAttachmentTooltip={hideAttachmentTooltip}
              onRemoveAttachment={onRemoveAttachment}
            />
          ))}
        </div>
        <input
          ref={attachmentInputRef}
          type="file"
          className="sr-only"
          multiple
          onChange={handleAttachmentInputChange}
        />
        {canEditAttachments ? (
          <button
            type="button"
            className="attachment-attach-button"
            aria-label={composer.attachLabel}
            disabled={isAttachmentUploading}
            onClick={handleOpenAttachmentPicker}
          >
            <Paperclip aria-hidden="true" strokeWidth={1.9} />
          </button>
        ) : null}
      </div>
      {activeAttachment && typeof document !== "undefined"
        ? createPortal(
            <span className="attachment-tooltip" style={attachmentTooltipStyle}>
              {activeAttachment.tooltip}
            </span>,
            document.body,
          )
        : null}

      {composerRequests.length > 0 ? (
        <div ref={requestStackRef} className="composer-request-stack" aria-label="Подготовленные параметры запуска">
          {composerRequests.map((request) => (
            <div key={request.id} className="composer-request-row">
              <span className="composer-request-row__context">{request.context.label}</span>
              <span className="composer-request-row__text">{request.text}</span>
              <button
                type="button"
                className="composer-request-row__delete"
                aria-label={`Удалить ${request.context.label}`}
                onClick={() => onRemoveComposerRequest(request.id)}
              >
                <Trash2 aria-hidden="true" strokeWidth={1.7} />
              </button>
            </div>
          ))}
        </div>
      ) : null}

      {isProcessRunning ? (
        <button
          type="button"
          className="composer-stop-button"
          aria-label="Остановить процесс"
          onClick={onStop}
        >
          Стоп
        </button>
      ) : (
        <form className="composer-panel" onSubmit={handleSubmit}>
          <div className="composer-context" onBlur={handleContextBlur} onKeyDown={handleContextKeyDown}>
            <span className="sr-only">Тип сообщения</span>
            <button
              type="button"
              className="composer-context__trigger"
              aria-haspopup="listbox"
              aria-expanded={isContextMenuOpen}
              onClick={() => setIsContextMenuOpen((isOpen) => !isOpen)}
            >
              <span className="composer-context__label">{selectedContext.label}</span>
              <ChevronDown className="composer-context__chevron" aria-hidden="true" strokeWidth={1.8} />
            </button>
            {isContextMenuOpen ? (
              <div className="composer-context__menu" role="listbox" aria-label="Тип сообщения">
                {COMPOSER_CONTEXT_OPTIONS.map((option) => (
                  <button
                    key={option.value}
                    type="button"
                    className={
                      option.value === composerContext
                        ? "composer-context__option composer-context__option--active"
                        : "composer-context__option"
                    }
                    role="option"
                    aria-selected={option.value === composerContext}
                    onClick={() => handleSelectContext(option.value)}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
            ) : null}
          </div>

          <label className="composer-panel__input-wrap">
            <span className="sr-only">Сообщение</span>
            <textarea
              className="composer-panel__input"
              value={draftMessage}
              onChange={(event) => onDraftMessageChange(event.target.value)}
              onKeyDown={handleInputKeyDown}
              placeholder={composer.placeholder}
              rows={1}
            />
          </label>

          <div className="composer-panel__actions">
            <button
              type="submit"
              className={
                isStartMode
                  ? "composer-action composer-action--primary composer-action--start"
                  : "composer-action composer-action--primary"
              }
              aria-label={isStartMode ? "Старт" : composer.sendLabel}
            >
              {isStartMode ? (
                <span className="composer-action__start-label">Старт</span>
              ) : (
                <SendHorizontal aria-hidden="true" strokeWidth={2} />
              )}
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
