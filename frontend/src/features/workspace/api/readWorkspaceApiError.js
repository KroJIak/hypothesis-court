import { formatApiErrorMessage } from "../../../api/apiErrorMessage";

export async function readWorkspaceApiError(response, fallbackMessage) {
  try {
    const payload = await response.json();
    return formatApiErrorMessage(payload?.detail, fallbackMessage);
  } catch {
    return formatApiErrorMessage(null, fallbackMessage);
  }
}
