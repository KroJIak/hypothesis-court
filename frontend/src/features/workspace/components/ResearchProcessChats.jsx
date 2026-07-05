function getRoleName(role) {
  return {
    defender: "Защитник",
    attacker: "Атакующий",
    manufacturer: "Производственник",
  }[role] ?? role;
}

function getVisibleDebateMessages(session) {
  return (session.hypotheses ?? []).flatMap((hypothesis, hypothesisIndex) =>
    (hypothesis.debateMessages ?? []).map((message) => ({
      id: message.id,
      title: hypothesis.title || `Гипотеза ${hypothesisIndex + 1}`,
      author: getRoleName(message.role),
      text: message.content,
      roundNumber: message.roundNumber,
      createdAt: message.createdAt,
    })),
  ).sort((firstMessage, secondMessage) =>
    new Date(firstMessage.createdAt).getTime() - new Date(secondMessage.createdAt).getTime(),
  );
}

function getVisibleEvaluationGroups(session) {
  const groups = new Map();

  for (const hypothesis of session.hypotheses ?? []) {
    for (const evaluation of hypothesis.evaluations ?? []) {
      const groupKey = evaluation.userAgentId ?? evaluation.evaluatorKey;
      const group = groups.get(groupKey) ?? {
        id: groupKey,
        name: evaluation.evaluatorName,
        messages: [],
      };

      group.messages.push({
        id: evaluation.id,
        title: hypothesis.title,
        text: [
          evaluation.verdict,
          evaluation.rationale,
          evaluation.riskNotes ? `Риски: ${evaluation.riskNotes}` : "",
        ].filter(Boolean).join(" "),
        createdAt: evaluation.createdAt,
      });
      groups.set(groupKey, group);
    }
  }

  return [...groups.values()].map((group) => ({
    ...group,
    messages: group.messages.sort((firstMessage, secondMessage) =>
      new Date(firstMessage.createdAt).getTime() - new Date(secondMessage.createdAt).getTime(),
    ),
  }));
}

function getVisibleJudgeEvents(session) {
  return (session.researchProgress?.events ?? [])
    .filter((event) => event.stage === "judge")
    .map((event) => ({
      id: event.id,
      text: event.message,
      createdAt: event.createdAt,
    }));
}

function getJudgeText(session) {
  return session.answer || [
    session.verdict?.summary,
    session.verdict?.recommendation,
  ].filter(Boolean).join(" ");
}

export function ResearchProcessChats({ session, isVisible }) {
  if (!isVisible) {
    return null;
  }

  const debateMessages = getVisibleDebateMessages(session);
  const evaluationGroups = getVisibleEvaluationGroups(session);
  const judgeEvents = getVisibleJudgeEvents(session);
  const judgeText = getJudgeText(session);

  return (
    <section className="research-process-chats" aria-label="Живые чаты процесса">
      <article className="research-process-chat">
        <h3 className="research-process-chat__title">Общий чат троицы</h3>
        {debateMessages.length > 0 ? (
          <div className="research-process-chat__messages">
            {debateMessages.map((message) => (
              <div key={message.id} className="research-process-message">
                <span className="research-process-message__meta">
                  {message.title} · {message.roundNumber} цикл · {message.author}
                </span>
                <p>{message.text}</p>
              </div>
            ))}
          </div>
        ) : (
          <p className="research-process-chat__empty">Сообщения появятся, когда начнётся debate.</p>
        )}
      </article>

      <article className="research-process-chat">
        <h3 className="research-process-chat__title">Чаты доп агентов</h3>
        {evaluationGroups.length > 0 ? (
          <div className="research-process-chat__messages">
            {evaluationGroups.map((group) => (
              <div key={group.id} className="research-process-agent-group">
                <span className="research-process-message__meta">{group.name}</span>
                {group.messages.map((message) => (
                  <div key={message.id} className="research-process-message">
                    <span className="research-process-message__meta">{message.title}</span>
                    <p>{message.text}</p>
                  </div>
                ))}
              </div>
            ))}
          </div>
        ) : (
          <p className="research-process-chat__empty">Оценки появятся после обсуждения гипотез.</p>
        )}
      </article>

      <article className="research-process-chat">
        <h3 className="research-process-chat__title">Чат судьи</h3>
        {judgeText ? (
          <div className="research-process-chat__messages">
            <div className="research-process-message">
              <span className="research-process-message__meta">Судья</span>
              <p>{judgeText}</p>
            </div>
          </div>
        ) : judgeEvents.length > 0 ? (
          <div className="research-process-chat__messages">
            {judgeEvents.map((event) => (
              <div key={event.id} className="research-process-message">
                <span className="research-process-message__meta">Судья</span>
                <p>{event.text}</p>
              </div>
            ))}
          </div>
        ) : (
          <p className="research-process-chat__empty">Вердикт появится после оценок агентов.</p>
        )}
      </article>
    </section>
  );
}
