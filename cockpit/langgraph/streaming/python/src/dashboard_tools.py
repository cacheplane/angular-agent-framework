"""Mock SaaS metrics data tools for the generative-ui dashboard example."""

from langchain_core.tools import tool

# ── Hardcoded SaaS dataset ──────────────────────────────────────────────────

_MRR_TREND = [
    {"month": "2025-05", "mrr": 28000},
    {"month": "2025-06", "mrr": 29500},
    {"month": "2025-07", "mrr": 30200},
    {"month": "2025-08", "mrr": 31800},
    {"month": "2025-09", "mrr": 32500},
    {"month": "2025-10", "mrr": 33000},
    {"month": "2025-11", "mrr": 34200},
    {"month": "2025-12", "mrr": 35800},
    {"month": "2026-01", "mrr": 37000},
    {"month": "2026-02", "mrr": 38500},
    {"month": "2026-03", "mrr": 40200},
    {"month": "2026-04", "mrr": 42000},
]

_SUBSCRIBERS_BY_PLAN = [
    {"plan": "free", "count": 1200},
    {"plan": "starter", "count": 850},
    {"plan": "pro", "count": 420},
    {"plan": "enterprise", "count": 95},
]

_CHURNED_ACCOUNTS = [
    {"name": "Acme Corp", "plan": "pro", "mrr_lost": 450, "date": "2026-04-01"},
    {"name": "Widgetly", "plan": "starter", "mrr_lost": 120, "date": "2026-03-28"},
    {"name": "DataPipe Inc", "plan": "enterprise", "mrr_lost": 2400, "date": "2026-03-25"},
    {"name": "NovaTech", "plan": "pro", "mrr_lost": 450, "date": "2026-03-20"},
    {"name": "CloudSync", "plan": "starter", "mrr_lost": 120, "date": "2026-03-15"},
    {"name": "ByteForge", "plan": "pro", "mrr_lost": 450, "date": "2026-03-10"},
    {"name": "Quantum Labs", "plan": "enterprise", "mrr_lost": 2400, "date": "2026-03-05"},
    {"name": "FlowState", "plan": "starter", "mrr_lost": 120, "date": "2026-02-28"},
    {"name": "CipherNet", "plan": "pro", "mrr_lost": 450, "date": "2026-02-20"},
    {"name": "Luminary AI", "plan": "starter", "mrr_lost": 120, "date": "2026-02-15"},
]


@tool
def query_mrr() -> dict:
    """Get current Monthly Recurring Revenue (MRR) with month-over-month delta."""
    current = _MRR_TREND[-1]["mrr"]
    previous = _MRR_TREND[-2]["mrr"]
    delta_pct = ((current - previous) / previous) * 100
    total_subs = sum(p["count"] for p in _SUBSCRIBERS_BY_PLAN)
    arpu = round(current / total_subs, 2)
    return {
        "mrr": {"value": current, "delta": f"+{delta_pct:.1f}%", "period": "month"},
        "subscribers": {"total": total_subs, "delta": "+42"},
        "churn": {"rate": "3.2%", "delta": "-0.4%"},
        "arpu": {"value": f"${arpu:.2f}", "delta": "+$1.20"},
    }


@tool
def query_subscribers_by_plan(plans: list[str] | None = None) -> list[dict]:
    """Get subscriber counts broken down by plan tier.

    Args:
        plans: Optional list of plan names to filter by (e.g., ["pro", "enterprise"]).
               Returns all plans if not specified.
    """
    if plans:
        return [p for p in _SUBSCRIBERS_BY_PLAN if p["plan"] in plans]
    return _SUBSCRIBERS_BY_PLAN


@tool
def query_mrr_trend(months: int = 12) -> list[dict]:
    """Get MRR trend over time.

    Args:
        months: Number of months to return (default 12). Valid values: 3, 6, 12, 24.
    """
    months = min(months, len(_MRR_TREND))
    return _MRR_TREND[-months:]


@tool
def query_churned_accounts(limit: int = 5, plan: str | None = None) -> list[dict]:
    """Get recently churned accounts.

    Args:
        limit: Maximum number of accounts to return (default 5).
        plan: Optional plan name to filter by (e.g., "enterprise").
    """
    filtered = _CHURNED_ACCOUNTS
    if plan:
        filtered = [a for a in filtered if a["plan"] == plan]
    return filtered[:limit]


ALL_TOOLS = [query_mrr, query_subscribers_by_plan, query_mrr_trend, query_churned_accounts]
