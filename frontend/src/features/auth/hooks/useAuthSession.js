import { useEffect, useState } from "react";

import { changeOwnPassword } from "../../account/api/changeOwnPassword";
import { updateOwnProfile } from "../../account/api/updateOwnProfile";
import { uploadOwnAvatar } from "../../account/api/uploadOwnAvatar";
import { buildAccountProfile } from "../../account/utils/accountProfile";
import { login } from "../api/login";
import { logout } from "../api/logout";
import { logoutAll } from "../api/logoutAll";
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
        const profile = buildAccountProfile(user);

        writeStoredAuthSession({
          ...storedSession,
          user,
          profile,
        });

        setState({
          status: "authenticated",
          session: {
            ...storedSession,
            user,
            profile,
          },
          errorMessage: "",
          isSubmitting: false,
        });
      })
      .catch((error) => {
        if (error?.name === "AbortError") {
          return;
        }

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
        profile: buildAccountProfile(authResponse.user),
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

  async function signOutAll() {
    const accessToken = state.session?.accessToken;

    try {
      if (accessToken) {
        await logoutAll(accessToken);
      }
    } finally {
      clearStoredAuthSession();
      setState({
        status: "guest",
        session: null,
        errorMessage: "",
        isSubmitting: false,
      });
    }
  }

  async function updateCurrentUserProfile({ firstName, lastName }) {
    const accessToken = state.session?.accessToken;

    if (!accessToken) {
      throw new Error("Сессия истекла. Войдите заново.");
    }

    const user = await updateOwnProfile({
      accessToken,
      firstName,
      lastName,
    });

    setState((currentState) => {
      if (!currentState.session) {
        return currentState;
      }

      const nextSession = {
        ...currentState.session,
        user,
        profile: buildAccountProfile(user),
      };

      writeStoredAuthSession(nextSession);

      return {
        ...currentState,
        session: nextSession,
      };
    });

    return user;
  }

  async function changePassword(payload) {
    const accessToken = state.session?.accessToken;

    if (!accessToken) {
      throw new Error("Сессия истекла. Войдите заново.");
    }

    await changeOwnPassword({
      accessToken,
      oldPassword: payload.oldPassword,
      newPassword: payload.newPassword,
      newPasswordRepeat: payload.newPasswordRepeat,
    });

    clearStoredAuthSession();
    setState({
      status: "guest",
      session: null,
      errorMessage: "",
      isSubmitting: false,
    });
  }

  async function uploadAvatar(file) {
    const accessToken = state.session?.accessToken;

    if (!accessToken) {
      throw new Error("Сессия истекла. Войдите заново.");
    }

    const user = await uploadOwnAvatar({
      accessToken,
      file,
    });

    setState((currentState) => {
      if (!currentState.session) {
        return currentState;
      }

      const nextSession = {
        ...currentState.session,
        user,
        profile: buildAccountProfile(user),
      };

      writeStoredAuthSession(nextSession);

      return {
        ...currentState,
        session: nextSession,
      };
    });

    return user;
  }

  return {
    status: state.status,
    session: state.session,
    errorMessage: state.errorMessage,
    isSubmitting: state.isSubmitting,
    authenticate,
    signOut,
    signOutAll,
    updateCurrentUserProfile,
    changePassword,
    uploadAvatar,
  };
}
