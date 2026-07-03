const AUTH_SESSION_STORAGE_KEY = "hypothesis-court-auth-session";

export function readStoredAuthSession() {
  if (typeof window === "undefined") {
    return null;
  }

  try {
    const rawValue = window.localStorage.getItem(AUTH_SESSION_STORAGE_KEY);

    if (!rawValue) {
      return null;
    }

    const payload = JSON.parse(rawValue);

    if (
      typeof payload?.accessToken !== "string" ||
      typeof payload?.refreshToken !== "string" ||
      typeof payload?.user !== "object" ||
      payload.user === null
    ) {
      return null;
    }

    const profile = typeof payload?.profile === "object" && payload.profile !== null
      ? {
          avatarDataUrl:
            typeof payload.profile.avatarDataUrl === "string"
              ? payload.profile.avatarDataUrl
              : null,
        }
      : {
          avatarDataUrl: null,
        };

    return {
      ...payload,
      profile,
    };
  } catch {
    return null;
  }
}

export function writeStoredAuthSession(session) {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.setItem(AUTH_SESSION_STORAGE_KEY, JSON.stringify(session));
}

export function clearStoredAuthSession() {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.removeItem(AUTH_SESSION_STORAGE_KEY);
}
