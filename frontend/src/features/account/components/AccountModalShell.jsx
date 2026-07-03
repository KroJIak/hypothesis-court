import { X } from "lucide-react";

export function AccountModalShell({
  ariaLabel,
  children,
  className = "",
  onClose,
}) {
  return (
    <div className="account-modal-backdrop" role="presentation" onClick={onClose}>
      <div
        className={`account-modal ${className}`.trim()}
        role="dialog"
        aria-modal="true"
        aria-label={ariaLabel}
        onClick={(event) => event.stopPropagation()}
      >
        <button
          type="button"
          className="account-modal__close"
          aria-label="Закрыть"
          onClick={onClose}
        >
          <X strokeWidth={2} />
        </button>
        {children}
      </div>
    </div>
  );
}
