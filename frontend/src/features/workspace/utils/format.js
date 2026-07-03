export function capitalizeFirst(text) {
  if (!text) {
    return text;
  }

  return text.charAt(0).toUpperCase() + text.slice(1);
}

export function clampNumber(value, min, max) {
  return Math.min(Math.max(value, min), max);
}
