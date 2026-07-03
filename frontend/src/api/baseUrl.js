const fallbackBaseUrl = "/api";

export function normalizeBaseUrl(baseUrl) {
  return baseUrl.replace(/\/+$/, "");
}

export function getApiBaseUrl() {
  const configuredBaseUrl = import.meta.env.VITE_API_BASE_URL;
  return normalizeBaseUrl(configuredBaseUrl || fallbackBaseUrl);
}
