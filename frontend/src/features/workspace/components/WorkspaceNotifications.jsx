const NOTIFICATION_LABELS = {
  error: "Ошибка",
  info: "Информация",
  success: "Готово",
};

export function WorkspaceNotifications({ notifications }) {
  if (notifications.length === 0) {
    return null;
  }

  return (
    <div className="workspace-notifications" aria-live="polite" aria-atomic="false">
      {notifications.map((notification) => (
        <div
          key={notification.id}
          className={`workspace-notification workspace-notification--${notification.type}`}
          role={notification.type === "error" ? "alert" : "status"}
        >
          <span className="workspace-notification__label">
            {NOTIFICATION_LABELS[notification.type] ?? NOTIFICATION_LABELS.info}
          </span>
          <span className="workspace-notification__message">{notification.message}</span>
        </div>
      ))}
    </div>
  );
}
