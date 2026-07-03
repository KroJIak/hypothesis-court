export function WorkspaceSkeleton() {
  return <main className="workspace-status workspace-status--blank" aria-label="Загрузка рабочей области" />;
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
