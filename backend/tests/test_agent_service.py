import uuid
from types import SimpleNamespace

from app.models.chat_session_agent import ChatSessionAgent
from app.models.user import User
from app.models.user_agent import UserAgent
from app.services.agent_service import AgentService


class DummySession:
    def __init__(self) -> None:
        self.commits = 0
        self.rollbacks = 0

    def commit(self) -> None:
        self.commits += 1

    def rollback(self) -> None:
        self.rollbacks += 1


class FakeAgentRepository:
    def __init__(self, *, user_id, chat_session_id, agents, selected_agents=None) -> None:
        self.user_id = user_id
        self.chat_session_id = chat_session_id
        self.agents = {agent.id: agent for agent in agents}
        self.selected_agents = list(selected_agents or [])

    def get_active_chat_session_for_user(self, session, *, user_id, chat_session_id, for_update=False):
        del session, for_update
        if user_id == self.user_id and chat_session_id == self.chat_session_id:
            return SimpleNamespace(id=chat_session_id, user_id=user_id)
        return None

    def get_active_agent_for_user(self, session, *, user_id, agent_id, for_update=False):
        del session, for_update
        if user_id != self.user_id:
            return None
        agent = self.agents.get(agent_id)
        if agent is None or agent.deleted_at is not None:
            return None
        return agent

    def get_selected_agent(self, session, *, user_id, chat_session_id, agent_id):
        del session
        if user_id != self.user_id or chat_session_id != self.chat_session_id:
            return None
        return next((selected for selected in self.selected_agents if selected.agent_id == agent_id), None)

    def create_selected_agent(self, session, selected_agent):
        del session
        selected_agent.id = uuid.uuid4()
        self.selected_agents.append(selected_agent)
        return selected_agent

    def get_next_selected_position(self, session, *, chat_session_id):
        del session
        if chat_session_id != self.chat_session_id or not self.selected_agents:
            return 0
        return max(selected.position for selected in self.selected_agents) + 1

    def list_selected_agents(self, session, *, user_id, chat_session_id):
        del session
        if user_id != self.user_id or chat_session_id != self.chat_session_id:
            return []
        return [
            (selected, self.agents[selected.agent_id])
            for selected in sorted(self.selected_agents, key=lambda item: (item.position, item.created_at is None))
        ]


def make_agent(user_id, name):
    return UserAgent(
        id=uuid.uuid4(),
        user_id=user_id,
        name=name,
        icon_key=None,
        system_prompt="Оцени гипотезу по своей роли.",
    )


def make_selected(user_id, chat_session_id, agent_id, position, placement="right"):
    return ChatSessionAgent(
        id=uuid.uuid4(),
        user_id=user_id,
        chat_session_id=chat_session_id,
        agent_id=agent_id,
        placement=placement,
        position=position,
    )


def make_service(repository, session):
    return AgentService(
        session=session,
        agent_repository=repository,
        model_provider_settings_repository=SimpleNamespace(),
    )


def test_attach_agent_inserts_at_requested_position_and_compacts_positions():
    user = User(id=uuid.uuid4(), username="researcher", password_hash="hash", token_version=1)
    chat_session_id = uuid.uuid4()
    first_agent = make_agent(user.id, "Финансовый эксперт")
    second_agent = make_agent(user.id, "Риск-эксперт")
    third_agent = make_agent(user.id, "Эколог")
    repository = FakeAgentRepository(
        user_id=user.id,
        chat_session_id=chat_session_id,
        agents=[first_agent, second_agent, third_agent],
        selected_agents=[
            make_selected(user.id, chat_session_id, first_agent.id, 0, "left"),
            make_selected(user.id, chat_session_id, third_agent.id, 1, "right"),
        ],
    )
    session = DummySession()
    service = make_service(repository, session)

    service.attach_agent_to_chat(
        user=user,
        chat_session_id=chat_session_id,
        agent_id=second_agent.id,
        placement="left",
        position=1,
    )

    ordered_agent_ids = [selected.agent_id for selected in sorted(repository.selected_agents, key=lambda item: item.position)]
    assert ordered_agent_ids == [first_agent.id, second_agent.id, third_agent.id]
    assert [selected.position for selected in sorted(repository.selected_agents, key=lambda item: item.position)] == [0, 1, 2]
    assert repository.get_selected_agent(None, user_id=user.id, chat_session_id=chat_session_id, agent_id=second_agent.id).placement == "left"
    assert session.commits == 1
    assert session.rollbacks == 0


def test_attach_existing_agent_reorders_without_duplicate_selection():
    user = User(id=uuid.uuid4(), username="researcher", password_hash="hash", token_version=1)
    chat_session_id = uuid.uuid4()
    first_agent = make_agent(user.id, "Финансовый эксперт")
    second_agent = make_agent(user.id, "Риск-эксперт")
    third_agent = make_agent(user.id, "Эколог")
    repository = FakeAgentRepository(
        user_id=user.id,
        chat_session_id=chat_session_id,
        agents=[first_agent, second_agent, third_agent],
        selected_agents=[
            make_selected(user.id, chat_session_id, first_agent.id, 0, "left"),
            make_selected(user.id, chat_session_id, second_agent.id, 1, "left"),
            make_selected(user.id, chat_session_id, third_agent.id, 2, "right"),
        ],
    )
    session = DummySession()
    service = make_service(repository, session)

    service.attach_agent_to_chat(
        user=user,
        chat_session_id=chat_session_id,
        agent_id=third_agent.id,
        placement="left",
        position=0,
    )

    ordered_agent_ids = [selected.agent_id for selected in sorted(repository.selected_agents, key=lambda item: item.position)]
    assert ordered_agent_ids == [third_agent.id, first_agent.id, second_agent.id]
    assert len(repository.selected_agents) == 3
    assert [selected.position for selected in sorted(repository.selected_agents, key=lambda item: item.position)] == [0, 1, 2]
    assert repository.get_selected_agent(None, user_id=user.id, chat_session_id=chat_session_id, agent_id=third_agent.id).placement == "left"
    assert session.commits == 1
    assert session.rollbacks == 0


def test_deleted_agent_remains_in_existing_chat_selection():
    user = User(id=uuid.uuid4(), username="researcher", password_hash="hash", token_version=1)
    chat_session_id = uuid.uuid4()
    agent = make_agent(user.id, "Финансовый эксперт")
    repository = FakeAgentRepository(
        user_id=user.id,
        chat_session_id=chat_session_id,
        agents=[agent],
        selected_agents=[make_selected(user.id, chat_session_id, agent.id, 0, "right")],
    )
    session = DummySession()
    service = make_service(repository, session)

    service.delete_agent(user=user, agent_id=agent.id)
    selected_agents = service.list_selected_agents(user=user, chat_session_id=chat_session_id)

    assert agent.deleted_at is not None
    assert selected_agents == [(repository.selected_agents[0], agent)]
    assert session.commits == 1
