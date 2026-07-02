export function mapWorkspaceScene(dto) {
  return {
    shell: {
      brand: dto.shell.brand,
      navigation: dto.shell.navigation,
      currentChatId: dto.shell.currentChatId,
      user: dto.shell.user,
    },
    sessions: dto.sessions.map((session) => ({
      id: session.id,
      title: session.title,
      query: session.query,
      answer: session.answer,
      attachments: session.attachments.map((attachment) => ({
        id: attachment.id,
        kind: attachment.kind,
        shortLabel: attachment.kind.toUpperCase(),
        tooltip: `${attachment.fileName} · ${attachment.summary}`,
      })),
      debate: {
        playLabel: session.debate.playLabel,
        roles: session.debate.roles.map((role) => ({
          id: role.id,
          name: role.name,
          status: role.status,
          variant: role.variant,
          placement: role.placement,
        })),
      },
      evaluation: {
        agents: session.evaluation.agents.map((agent) => ({
          id: agent.id,
          name: agent.name,
          status: agent.status,
          variant: agent.variant,
          placement: agent.placement,
        })),
        judge: {
          id: session.evaluation.judge.id,
          name: session.evaluation.judge.name,
          status: session.evaluation.judge.status,
          variant: session.evaluation.judge.variant,
        },
      },
    })),
    palette: {
      addAgentLabel: dto.palette.addAgentLabel,
      agents: dto.palette.agents.map((agent) => ({
        id: agent.id,
        name: agent.name,
        variant: agent.variant,
        isEmpty: agent.isEmpty,
      })),
    },
    composer: dto.composer,
  };
}
