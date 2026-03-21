from importlib.util import module_from_spec, spec_from_file_location
from pathlib import Path

import pytest


@pytest.mark.smoke
def test_config_importable():
    """Configuration TypedDict is importable and has the expected key."""
    from chat_agent.config import Configuration

    assert "system_prompt" in Configuration.__annotations__


@pytest.mark.smoke
def test_graph_loads_from_file_spec():
    """LangGraph Cloud loads graph files directly, so file-spec import must work."""
    agent_path = Path(__file__).resolve().parents[1] / "src" / "chat_agent" / "agent.py"
    spec = spec_from_file_location("deployed_agent", agent_path)
    assert spec is not None
    assert spec.loader is not None

    module = module_from_spec(spec)
    spec.loader.exec_module(module)

    assert hasattr(module, "graph")


@pytest.mark.smoke
def test_graph_import_does_not_construct_llm(monkeypatch):
    """Cold starts should not instantiate the OpenAI client during module import."""
    agent_path = Path(__file__).resolve().parents[1] / "src" / "chat_agent" / "agent.py"

    class ExplodingChatOpenAI:
        def __init__(self, *args, **kwargs):
            raise AssertionError("ChatOpenAI should not be constructed at import time")

    monkeypatch.setattr("langchain_openai.ChatOpenAI", ExplodingChatOpenAI)

    spec = spec_from_file_location("deployed_agent_lazy_import", agent_path)
    assert spec is not None
    assert spec.loader is not None

    module = module_from_spec(spec)
    spec.loader.exec_module(module)

    assert hasattr(module, "graph")


@pytest.mark.smoke
def test_graph_import_does_not_import_langchain_openai():
    """Cold starts should avoid importing the OpenAI integration until first use."""
    agent_path = Path(__file__).resolve().parents[1] / "src" / "chat_agent" / "agent.py"

    import sys

    for key in list(sys.modules):
        if key.startswith("langchain_openai"):
            del sys.modules[key]

    spec = spec_from_file_location("deployed_agent_no_openai_import", agent_path)
    assert spec is not None
    assert spec.loader is not None

    module = module_from_spec(spec)
    spec.loader.exec_module(module)

    assert "langchain_openai" not in sys.modules


@pytest.mark.smoke
def test_graph_does_not_define_a_custom_checkpointer():
    """LangGraph API manages persistence itself, so the exported graph should not set one."""
    agent_path = Path(__file__).resolve().parents[1] / "src" / "chat_agent" / "agent.py"

    import sys

    sys.path.insert(0, str(agent_path.parents[1] / "src"))

    spec = spec_from_file_location("deployed_agent_no_checkpointer", agent_path)
    assert spec is not None
    assert spec.loader is not None

    module = module_from_spec(spec)
    spec.loader.exec_module(module)

    assert getattr(module.graph, "checkpointer", None) is None
