"""LangChain @tool wrappers around the aviation mock dataset.

Each tool's docstring is what the LLM sees for tool-selection — keep them
informative and example-laden.
"""

from langchain_core.tools import tool
from src.aviation_data import AIRPORTS, AIRLINES, FLIGHTS


@tool
async def lookup_flight(flight_number: str) -> dict:
    """Look up the status, route, and gate for a specific flight number.

    Use this when the user asks about a specific flight (e.g., "what's the
    status of UA123?", "is AA404 on time?", "what gate is DL501 leaving from?").

    Args:
        flight_number: Flight number like 'UA123' or 'AA456'. Case-insensitive.

    Returns:
        dict with keys: flight_number, airline, from, to, depart_local,
        arrive_local, status (on_time/delayed/cancelled), gate, aircraft,
        duration_min.

    Returns {"error": "Flight not found"} if the flight number is not in
    the dataset.
    """
    fn = flight_number.upper().strip()
    for f in FLIGHTS:
        if f["flight_number"] == fn:
            return f
    return {"error": f"Flight {fn} not found in dataset"}


@tool
async def get_airport_info(airport_code: str) -> dict:
    """Get details about an airport: name, city, current weather, terminals, runways.

    Use this when the user asks about an airport (e.g., "what's the weather
    at LAX?", "tell me about JFK", "how many runways does ORD have?").

    Args:
        airport_code: 3-letter IATA code like 'LAX' or 'JFK'. Case-insensitive.

    Returns:
        dict with keys: code, name, city, country, weather (with temp_f and
        conditions), terminals, runways.

    Returns {"error": "Airport not found"} if the code is not in the dataset.
    """
    code = airport_code.upper().strip()
    if code in AIRPORTS:
        return AIRPORTS[code]
    return {"error": f"Airport {code} not in dataset. Available: {sorted(AIRPORTS.keys())}"}


@tool
async def find_routes(from_code: str, to_code: str, date_offset_days: int = 0) -> dict:
    """Find available flights between two airports.

    Use this when the user asks about flight options (e.g., "what flights
    are there from LAX to JFK?", "find me a flight from Boston to Miami
    tomorrow").

    Args:
        from_code: 3-letter IATA code for departure airport.
        to_code: 3-letter IATA code for arrival airport.
        date_offset_days: 0 = today, 1 = tomorrow, etc. Note: mock data is
            the same regardless of date; the LLM can still reason about
            the date in its response.

    Returns:
        dict with keys:
          - "flights": list of flight dicts (same shape as lookup_flight)
            sorted by depart_local, OR empty list if no routes.
          - "from": echoed from_code
          - "to": echoed to_code
          - "date_offset_days": echoed
    """
    fc = from_code.upper().strip()
    tc = to_code.upper().strip()
    flights = sorted(
        [f for f in FLIGHTS if f["from"] == fc and f["to"] == tc],
        key=lambda f: f["depart_local"],
    )
    return {"from": fc, "to": tc, "date_offset_days": date_offset_days, "flights": flights}


ALL_TOOLS = [lookup_flight, get_airport_info, find_routes]
