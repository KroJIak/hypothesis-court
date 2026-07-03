import { useEffect, useState } from "react";

import { login } from "../api/login";
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
          user,
        });

        setState({
          status: "authenticated",
          session: {
            ...storedSession,
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

  return {
    status: state.status,
    session: state.session,
    errorMessage: state.errorMessage,
    isSubmitting: state.isSubmitting,
    authenticate,
  };
}
