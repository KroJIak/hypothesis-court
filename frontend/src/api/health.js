import { getApiBaseUrl } from "./baseUrl";

export async function fetchHealth(signal) {
  const baseUrl = getApiBaseUrl();
  const response = await fetch(`${baseUrl}/health`, {
    headers: {
      Accept: "application/json",
    },
    signal,
  });

  if (!response.ok) {
    throw new Error("Health check failed");
  }

  return response.json();
}
