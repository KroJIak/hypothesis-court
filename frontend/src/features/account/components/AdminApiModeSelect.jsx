import { useEffect, useRef, useState } from "react";

export function AdminApiModeSelect({ disabled, options, value, onChange }) {
  const [isOpen, setIsOpen] = useState(false);
  const [hoveredValue, setHoveredValue] = useState(null);
  const rootRef = useRef(null);
  const selectedOption = options.find((option) => option.value === value) ?? options[0];
  const hoveredOption = options.find((option) => option.value === hoveredValue);

  useEffect(() => {
    if (!isOpen) {
      return undefined;
    }

    function handlePointerDown(event) {
      if (!rootRef.current?.contains(event.target)) {
        setIsOpen(false);
      }
    }

    function handleKeyDown(event) {
      if (event.key === "Escape") {
        setIsOpen(false);
      }
    }

    document.addEventListener("pointerdown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen]);

  function handleSelect(nextValue) {
    onChange(nextValue);
    setIsOpen(false);
    setHoveredValue(null);
  }

  return (
    <span className="account-admin-api-mode-select" ref={rootRef}>
      <button
        type="button"
        className="account-admin-api-mode-select__trigger"
        disabled={disabled}
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        onClick={() => setIsOpen((currentValue) => !currentValue)}
      >
        {selectedOption?.label ?? "Не выбрано"}
      </button>

      {isOpen ? (
        <span className="account-admin-api-mode-select__menu" role="listbox">
          {options.map((option) => (
            <button
              key={option.value}
              type="button"
              className="account-admin-api-mode-select__option"
              role="option"
              aria-selected={option.value === value}
              onMouseEnter={() => setHoveredValue(option.value)}
              onFocus={() => setHoveredValue(option.value)}
              onClick={() => handleSelect(option.value)}
            >
              {option.label}
            </button>
          ))}
          {hoveredOption ? (
            <span className="account-admin-api-mode-select__hint">{hoveredOption.hint}</span>
          ) : null}
        </span>
      ) : null}
    </span>
  );
}
