export async function readApiError(response, fallbackMessage) {
  try {
    const payload = await response.json();
    return typeof payload?.detail === "string" ? payload.detail : fallbackMessage;
  } catch {
    return fallbackMessage;
  }
}
