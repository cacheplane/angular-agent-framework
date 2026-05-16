"""Aviation KPI tools for the c-generative-ui dashboard demo.

Four tools mirror the SaaS shape they replaced (query_mrr et al):
- query_airline_kpis      → 4 stat cards (snapshot dict)
- query_on_time_trend     → line chart data
- query_flights_by_airline→ bar chart data
- query_recent_disruptions→ data grid rows

Data comes from src.aviation_data; no external calls.
"""

from langchain_core.tools import tool

from src.aviation_data import (
    KPI_SNAPSHOT,
    ON_TIME_TREND,
    FLIGHTS_BY_AIRLINE,
    RECENT_DISRUPTIONS,
)


@tool
def query_airline_kpis() -> dict:
    """Snapshot of operational KPIs across the fleet: on-time %, flights today,
    average delay (minutes), and load factor."""
    snap = KPI_SNAPSHOT
    return {
        "on_time":       {"value": f"{snap['on_time_pct']}%",      "delta": snap["on_time_delta"]},
        "flights_today": {"value": snap["flights_today"],          "delta": snap["flights_today_delta"]},
        "avg_delay":     {"value": f"{snap['avg_delay_min']} min", "delta": snap["avg_delay_delta"]},
        "load_factor":   {"value": f"{snap['load_factor_pct']}%",  "delta": snap["load_factor_delta"]},
    }


@tool
def query_on_time_trend(months: int = 12) -> list[dict]:
    """On-time performance over time, as percentage by month.

    Args:
        months: Number of months to return (default 12). Valid: 3, 6, 12, 24.
    """
    months = min(months, len(ON_TIME_TREND))
    return ON_TIME_TREND[-months:]


@tool
def query_flights_by_airline(airlines: list[str] | None = None) -> list[dict]:
    """Daily flight counts per airline.

    Args:
        airlines: Optional filter list, e.g. ["American", "United"]. All four
                  returned if omitted.
    """
    if airlines:
        return [a for a in FLIGHTS_BY_AIRLINE if a["airline"] in airlines]
    return FLIGHTS_BY_AIRLINE


@tool
def query_recent_disruptions(limit: int = 5, type: str | None = None) -> list[dict]:
    """Recent flight delays or cancellations.

    Args:
        limit: Maximum entries to return (default 5).
        type: Optional filter, "delayed" or "cancelled".
    """
    filtered = RECENT_DISRUPTIONS
    if type:
        filtered = [d for d in filtered if d["type"] == type]
    return filtered[:limit]


ALL_TOOLS = [
    query_airline_kpis,
    query_on_time_trend,
    query_flights_by_airline,
    query_recent_disruptions,
]
