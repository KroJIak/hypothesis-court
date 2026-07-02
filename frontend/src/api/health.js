const fallbackBaseUrl = "/api";

function normalizeBaseUrl(baseUrl) {
  return baseUrl.replace(/\/+$/, "");
}

export async function fetchHealth(signal) {
  const configuredBaseUrl = import.meta.env.VITE_API_BASE_URL;
  const baseUrl = normalizeBaseUrl(configuredBaseUrl || fallbackBaseUrl);
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
