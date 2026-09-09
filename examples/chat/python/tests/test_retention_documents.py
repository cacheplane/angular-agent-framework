import json

from src.graph import search_documents


def test_retention_search_returns_demo_policy_and_holds():
    docs = json.loads(search_documents.invoke({"query": "backup retention policy"}))
    assert {d["id"] for d in docs} == {"demo-backup-retention", "demo-backup-holds"}
    assert all("demo" in d["title"].lower() for d in docs)
    text = " ".join(d["snippet"] for d in docs)
    assert "90" in text and "120" in text and "retain" in text
    assert all(d["url"].startswith("https://demo.threadplane.ai/retention-policy.md#") for d in docs)


def test_angular_search_keeps_its_existing_corpus():
    docs = json.loads(search_documents.invoke({"query": "signals"}))
    assert docs and all(d["id"].startswith("ng-") for d in docs)
