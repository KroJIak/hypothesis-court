import { useEffect, useState } from "react";
import { Trash2 } from "lucide-react";

import {
  createAdminUser,
  deleteAdminUser,
  listAdminUsers,
  resetAdminUserPassword,
  updateAdminUserRole,
} from "../api/adminUsers";

export function AdminUsersSection({ accessToken, currentUser }) {
  const [users, setUsers] = useState([]);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState("user");
  const [passwordDrafts, setPasswordDrafts] = useState({});
  const [errorMessage, setErrorMessage] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    let isActive = true;

    refreshUsers()
      .catch((error) => {
        if (isActive) {
          setErrorMessage(error instanceof Error ? error.message : "Не удалось загрузить пользователей.");
        }
      })
      .finally(() => {
        if (isActive) {
          setIsLoading(false);
        }
      });

    return () => {
      isActive = false;
    };
  }, [accessToken]);

  async function refreshUsers() {
    const payload = await listAdminUsers(accessToken);
    setUsers(payload.items ?? []);
  }

  async function handleCreateUser(event) {
    event.preventDefault();
    setIsSaving(true);
    setErrorMessage("");

    try {
      await createAdminUser({
        accessToken,
        username,
        password,
        isAdmin: role === "admin",
      });
      setUsername("");
      setPassword("");
      setRole("user");
      await refreshUsers();
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Не удалось создать пользователя.");
    } finally {
      setIsSaving(false);
    }
  }

  async function handleRoleChange(user, nextRole) {
    setErrorMessage("");
    try {
      const updatedUser = await updateAdminUserRole({
        accessToken,
        userId: user.id,
        isAdmin: nextRole === "admin",
      });
      setUsers((currentUsers) =>
        currentUsers.map((item) => (item.id === updatedUser.id ? updatedUser : item)),
      );
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Не удалось изменить роль пользователя.");
    }
  }

  async function handlePasswordReset(user) {
    const newPassword = passwordDrafts[user.id] ?? "";
    setErrorMessage("");

    try {
      await resetAdminUserPassword({
        accessToken,
        userId: user.id,
        newPassword,
      });
      setPasswordDrafts((currentDrafts) => ({
        ...currentDrafts,
        [user.id]: "",
      }));
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Не удалось сменить пароль.");
    }
  }

  async function handleDelete(user) {
    setErrorMessage("");
    try {
      await deleteAdminUser({
        accessToken,
        userId: user.id,
      });
      setUsers((currentUsers) => currentUsers.filter((item) => item.id !== user.id));
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Не удалось удалить пользователя.");
    }
  }

  return (
    <section className="account-admin-section">
      <div className="account-admin-section__header">
        <h3>Пользователи</h3>
      </div>

      <form className="account-admin-create-user" onSubmit={handleCreateUser}>
        <label className="account-admin-field">
          <span>Username</span>
          <input
            type="text"
            value={username}
            autoComplete="off"
            onChange={(event) => setUsername(event.target.value)}
            required
          />
        </label>

        <label className="account-admin-field">
          <span>Пароль</span>
          <input
            type="password"
            value={password}
            autoComplete="new-password"
            onChange={(event) => setPassword(event.target.value)}
            required
          />
        </label>

        <label className="account-admin-field">
          <span>Роль</span>
          <select value={role} onChange={(event) => setRole(event.target.value)}>
            <option value="user">Пользователь</option>
            <option value="admin">Админ</option>
          </select>
        </label>

        <button type="submit" className="account-admin-button" disabled={isSaving}>
          Создать
        </button>
      </form>

      {errorMessage ? <div className="account-admin-error">{errorMessage}</div> : null}

      <div className="account-admin-table-wrap">
        <table className="account-admin-table">
          <thead>
            <tr>
              <th>Username</th>
              <th>Роль</th>
              <th>Новый пароль</th>
              <th aria-label="Удаление" />
            </tr>
          </thead>
          <tbody>
            {users.map((user) => {
              const isCurrentUser = user.id === currentUser?.id;
              const passwordDraft = passwordDrafts[user.id] ?? "";

              return (
                <tr key={user.id}>
                  <td>{user.username}</td>
                  <td>
                    <select
                      value={user.is_admin ? "admin" : "user"}
                      disabled={user.is_superadmin}
                      onChange={(event) => handleRoleChange(user, event.target.value)}
                    >
                      <option value="user">Пользователь</option>
                      <option value="admin">Админ</option>
                    </select>
                  </td>
                  <td>
                    <div className="account-admin-password-cell">
                      <input
                        type="password"
                        value={passwordDraft}
                        autoComplete="new-password"
                        placeholder="Новый пароль"
                        onChange={(event) =>
                          setPasswordDrafts((currentDrafts) => ({
                            ...currentDrafts,
                            [user.id]: event.target.value,
                          }))
                        }
                      />
                      <button
                        type="button"
                        disabled={!passwordDraft}
                        onClick={() => handlePasswordReset(user)}
                      >
                        Сменить
                      </button>
                    </div>
                  </td>
                  <td>
                    <button
                      type="button"
                      className="account-admin-delete"
                      aria-label={`Удалить ${user.username}`}
                      disabled={user.is_superadmin || isCurrentUser}
                      onClick={() => handleDelete(user)}
                    >
                      <Trash2 strokeWidth={1.95} />
                    </button>
                  </td>
                </tr>
              );
            })}
            {!isLoading && users.length === 0 ? (
              <tr>
                <td colSpan="4">Пользователей нет.</td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </section>
  );
}
