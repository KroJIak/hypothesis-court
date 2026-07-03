export function WorkspaceSkeleton() {
  return (
    <main className="workspace-status">
      <div className="workspace-status__card">
        <span className="workspace-status__title">Hypothesis Court</span>
        <p className="workspace-status__text">Собираем сцену из mock-данных...</p>
      </div>
    </main>
  );
}

export function WorkspaceError() {
  return (
    <main className="workspace-status">
      <div className="workspace-status__card">
        <span className="workspace-status__title">Hypothesis Court</span>
        <p className="workspace-status__text">Не удалось загрузить рабочее пространство.</p>
      </div>
    </main>
  );
}
