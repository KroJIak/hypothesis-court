import { useCallback, useRef, useState } from "react";
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
} from "lucide-react";

import {
  ATTACHMENT_TOOLTIP_EDGE_OFFSET,
  ATTACHMENT_TOOLTIP_GAP,
  COMPOSER_CONTEXT_OPTIONS,
} from "../constants";
import { clampNumber } from "../utils/format";

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

function AttachmentChip({
  attachment,
  setAttachmentButtonRef,
  showAttachmentTooltip,
  hideAttachmentTooltip,
}) {
  const AttachmentIcon = getAttachmentIcon(attachment.kind);
  const attachmentTypeLabel = getAttachmentTypeLabel(attachment);

  return (
    <button
      ref={(node) => setAttachmentButtonRef(attachment.id, node)}
      type="button"
      className="attachment-chip"
      aria-label={attachment.tooltip}
      onMouseEnter={(event) => showAttachmentTooltip(attachment.id, event.currentTarget)}
      onMouseLeave={hideAttachmentTooltip}
      onFocus={(event) => showAttachmentTooltip(attachment.id, event.currentTarget)}
      onBlur={hideAttachmentTooltip}
    >
      <span className="attachment-chip__icon">
        <AttachmentIcon aria-hidden="true" strokeWidth={1.9} />
      </span>
      <span className="attachment-chip__type" aria-hidden="true">
        {attachmentTypeLabel}
      </span>
    </button>
  );
}

export function Composer({ composer, attachments, draftMessage, onDraftMessageChange, onSend }) {
  const attachmentButtonRefs = useRef(new Map());
  const [activeAttachmentId, setActiveAttachmentId] = useState(null);
  const [attachmentTooltipStyle, setAttachmentTooltipStyle] = useState({ left: "0px", top: "0px" });
  const [composerContext, setComposerContext] = useState(COMPOSER_CONTEXT_OPTIONS[0].value);
  const [isContextMenuOpen, setIsContextMenuOpen] = useState(false);
  const activeAttachment = attachments.find((attachment) => attachment.id === activeAttachmentId) ?? null;
  const selectedContext =
    COMPOSER_CONTEXT_OPTIONS.find((option) => option.value === composerContext) ?? COMPOSER_CONTEXT_OPTIONS[0];

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
    if (!activeAttachmentId) {
      return;
    }

    updateAttachmentTooltip(activeAttachmentId);
  }, [activeAttachmentId, updateAttachmentTooltip]);

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

  return (
    <div className="composer-shell">
      <div className="attachment-dock">
        <div className="attachment-rail" aria-label="Вложения" onScroll={handleAttachmentRailScroll}>
          {attachments.map((attachment) => (
            <AttachmentChip
              key={attachment.id}
              attachment={attachment}
              setAttachmentButtonRef={setAttachmentButtonRef}
              showAttachmentTooltip={showAttachmentTooltip}
              hideAttachmentTooltip={hideAttachmentTooltip}
            />
          ))}
        </div>
        <button type="button" className="attachment-attach-button" aria-label={composer.attachLabel}>
          <Paperclip aria-hidden="true" strokeWidth={1.9} />
        </button>
      </div>
      {activeAttachment && typeof document !== "undefined"
        ? createPortal(
            <span className="attachment-tooltip" style={attachmentTooltipStyle}>
              {activeAttachment.tooltip}
            </span>,
            document.body,
          )
        : null}

      <form className="composer-panel" onSubmit={onSend}>
        <label className="composer-panel__input-wrap">
          <span className="sr-only">Сообщение</span>
          <textarea
            className="composer-panel__input"
            value={draftMessage}
            onChange={(event) => onDraftMessageChange(event.target.value)}
            placeholder={composer.placeholder}
            rows={1}
          />
        </label>

        <div className="composer-panel__actions">
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
          <button type="submit" className="composer-action composer-action--primary" aria-label={composer.sendLabel}>
            <SendHorizontal aria-hidden="true" strokeWidth={2} />
          </button>
        </div>
      </form>
    </div>
  );
}
