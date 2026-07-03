import { useEffect, useState } from "react";

import { login } from "../api/login";
import { logout } from "../api/logout";
import { readCurrentUser } from "../api/readCurrentUser";
import {
  clearStoredAuthSession,
  readStoredAuthSession,
  writeStoredAuthSession,
} from "../utils/sessionStorage";

const initialState = {
  status: "loading",
  session: null,
  errorMessage: "",
  isSubmitting: false,
};

function ensureProfile(profile) {
  return {
    avatarDataUrl:
      typeof profile?.avatarDataUrl === "string" ? profile.avatarDataUrl : null,
  };
}

export function useAuthSession() {
  const [state, setState] = useState(initialState);

  useEffect(() => {
    const controller = new AbortController();
    const storedSession = readStoredAuthSession();

    if (!storedSession) {
      setState({
        status: "guest",
        session: null,
        errorMessage: "",
        isSubmitting: false,
      });
      return () => controller.abort();
    }

    readCurrentUser(storedSession.accessToken, controller.signal)
      .then((user) => {
        writeStoredAuthSession({
          ...storedSession,
          profile: ensureProfile(storedSession.profile),
          user,
        });

        setState({
          status: "authenticated",
          session: {
            ...storedSession,
            profile: ensureProfile(storedSession.profile),
            user,
          },
          errorMessage: "",
          isSubmitting: false,
        });
      })
      .catch(() => {
        clearStoredAuthSession();
        setState({
          status: "guest",
          session: null,
          errorMessage: "",
          isSubmitting: false,
        });
      });

    return () => controller.abort();
  }, []);

  async function authenticate({ username, password }) {
    setState((currentState) => ({
      ...currentState,
      errorMessage: "",
      isSubmitting: true,
    }));

    try {
      const authResponse = await login({ username, password });
      const nextSession = {
        accessToken: authResponse.access_token,
        refreshToken: authResponse.refresh_token,
        user: authResponse.user,
        profile: ensureProfile(null),
      };

      writeStoredAuthSession(nextSession);
      setState({
        status: "authenticated",
        session: nextSession,
        errorMessage: "",
        isSubmitting: false,
      });
      return true;
    } catch (error) {
      setState({
        status: "guest",
        session: null,
        errorMessage: error instanceof Error ? error.message : "Не удалось выполнить вход.",
        isSubmitting: false,
      });
      return false;
    }
  }

  async function signOut() {
    const accessToken = state.session?.accessToken;

    try {
      if (accessToken) {
        await logout(accessToken);
      }
    } catch {
      // Local logout should still succeed even if the network call fails.
    }

    clearStoredAuthSession();
    setState({
      status: "guest",
      session: null,
      errorMessage: "",
      isSubmitting: false,
    });
  }

  function updateProfile(patch) {
    setState((currentState) => {
      if (!currentState.session) {
        return currentState;
      }

      const nextSession = {
        ...currentState.session,
        profile: {
          ...ensureProfile(currentState.session.profile),
          ...patch,
        },
      };

      writeStoredAuthSession(nextSession);

      return {
        ...currentState,
        session: nextSession,
      };
    });
  }

  return {
    status: state.status,
    session: state.session,
    errorMessage: state.errorMessage,
    isSubmitting: state.isSubmitting,
    authenticate,
    signOut,
    updateProfile,
  };
}
