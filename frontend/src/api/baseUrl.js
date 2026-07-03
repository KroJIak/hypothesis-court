const fallbackBaseUrl = "/api";

export function normalizeBaseUrl(baseUrl) {
  return baseUrl.replace(/\/+$/, "");
}

export function getApiBaseUrl() {
  const configuredBaseUrl = import.meta.env.VITE_API_BASE_URL;
  return normalizeBaseUrl(configuredBaseUrl || fallbackBaseUrl);
}

export function getApiAssetUrl(assetPath) {
  if (!assetPath) {
    return null;
  }

  if (/^(https?:|data:|blob:)/.test(assetPath)) {
    return assetPath;
  }

  const normalizedPath = assetPath.startsWith("/") ? assetPath : `/${assetPath}`;
  return `${getApiBaseUrl()}${normalizedPath}`;
}
