"""Aviation mock dataset for c-* example demos.

Hardcoded data for the c-tool-calls and c-subagents demos (and future c-*
aviation-themed examples). Zero external API calls — everything is canned
for deterministic demos and offline-friendly development.

The dataset is small but cohesive: ~10 US airports, 4 major airlines,
~30 flights criss-crossing those airports. Each airport has a static
"current weather" entry that doesn't change between calls (for
repeatability in screencasts and snapshot tests).
"""

# ── Airports ────────────────────────────────────────────────────────────────

AIRPORTS = {
    "LAX": {"code": "LAX", "name": "Los Angeles International", "city": "Los Angeles", "country": "USA",
            "weather": {"temp_f": 72, "conditions": "Partly Cloudy"}, "terminals": 9, "runways": 4},
    "JFK": {"code": "JFK", "name": "John F. Kennedy International", "city": "New York", "country": "USA",
            "weather": {"temp_f": 58, "conditions": "Clear"}, "terminals": 6, "runways": 4},
    "SFO": {"code": "SFO", "name": "San Francisco International", "city": "San Francisco", "country": "USA",
            "weather": {"temp_f": 64, "conditions": "Foggy"}, "terminals": 4, "runways": 4},
    "ORD": {"code": "ORD", "name": "O'Hare International", "city": "Chicago", "country": "USA",
            "weather": {"temp_f": 48, "conditions": "Light Rain"}, "terminals": 4, "runways": 8},
    "BOS": {"code": "BOS", "name": "Logan International", "city": "Boston", "country": "USA",
            "weather": {"temp_f": 52, "conditions": "Overcast"}, "terminals": 4, "runways": 6},
    "ATL": {"code": "ATL", "name": "Hartsfield-Jackson Atlanta International", "city": "Atlanta", "country": "USA",
            "weather": {"temp_f": 68, "conditions": "Sunny"}, "terminals": 2, "runways": 5},
    "DFW": {"code": "DFW", "name": "Dallas/Fort Worth International", "city": "Dallas", "country": "USA",
            "weather": {"temp_f": 76, "conditions": "Sunny"}, "terminals": 5, "runways": 7},
    "SEA": {"code": "SEA", "name": "Seattle-Tacoma International", "city": "Seattle", "country": "USA",
            "weather": {"temp_f": 55, "conditions": "Drizzle"}, "terminals": 3, "runways": 3},
    "MIA": {"code": "MIA", "name": "Miami International", "city": "Miami", "country": "USA",
            "weather": {"temp_f": 82, "conditions": "Humid, Sunny"}, "terminals": 3, "runways": 4},
    "DEN": {"code": "DEN", "name": "Denver International", "city": "Denver", "country": "USA",
            "weather": {"temp_f": 60, "conditions": "Clear, Windy"}, "terminals": 1, "runways": 6},
}

# ── Airlines ────────────────────────────────────────────────────────────────

AIRLINES = {
    "AA": {"code": "AA", "name": "American Airlines", "hub": "DFW"},
    "UA": {"code": "UA", "name": "United Airlines", "hub": "ORD"},
    "DL": {"code": "DL", "name": "Delta Air Lines", "hub": "ATL"},
    "B6": {"code": "B6", "name": "JetBlue Airways", "hub": "JFK"},
}

# ── Flights ─────────────────────────────────────────────────────────────────

FLIGHTS = [
    # United transcontinental
    {"flight_number": "UA123", "airline": "UA", "from": "LAX", "to": "JFK",
     "depart_local": "08:00", "arrive_local": "16:30", "duration_min": 330,
     "status": "on_time", "gate": "B14", "aircraft": "Boeing 787"},
    {"flight_number": "UA456", "airline": "UA", "from": "JFK", "to": "LAX",
     "depart_local": "10:00", "arrive_local": "13:15", "duration_min": 375,
     "status": "delayed", "gate": "T7-12", "aircraft": "Boeing 757"},
    {"flight_number": "UA789", "airline": "UA", "from": "ORD", "to": "SFO",
     "depart_local": "09:30", "arrive_local": "12:00", "duration_min": 270,
     "status": "on_time", "gate": "C15", "aircraft": "Airbus A320"},

    # American out of DFW hub
    {"flight_number": "AA101", "airline": "AA", "from": "DFW", "to": "LAX",
     "depart_local": "07:15", "arrive_local": "08:45", "duration_min": 210,
     "status": "on_time", "gate": "A23", "aircraft": "Boeing 737"},
    {"flight_number": "AA202", "airline": "AA", "from": "DFW", "to": "JFK",
     "depart_local": "11:00", "arrive_local": "15:30", "duration_min": 210,
     "status": "on_time", "gate": "D8", "aircraft": "Boeing 737"},
    {"flight_number": "AA303", "airline": "AA", "from": "DFW", "to": "MIA",
     "depart_local": "13:45", "arrive_local": "17:30", "duration_min": 165,
     "status": "on_time", "gate": "C11", "aircraft": "Airbus A321"},
    {"flight_number": "AA404", "airline": "AA", "from": "BOS", "to": "DFW",
     "depart_local": "06:30", "arrive_local": "10:00", "duration_min": 270,
     "status": "cancelled", "gate": "B5", "aircraft": "Boeing 737"},

    # Delta hub-and-spoke from ATL
    {"flight_number": "DL501", "airline": "DL", "from": "ATL", "to": "LAX",
     "depart_local": "10:00", "arrive_local": "11:45", "duration_min": 285,
     "status": "on_time", "gate": "F20", "aircraft": "Boeing 757"},
    {"flight_number": "DL502", "airline": "DL", "from": "ATL", "to": "JFK",
     "depart_local": "14:20", "arrive_local": "16:50", "duration_min": 150,
     "status": "on_time", "gate": "B9", "aircraft": "Boeing 737"},
    {"flight_number": "DL503", "airline": "DL", "from": "ATL", "to": "SEA",
     "depart_local": "09:15", "arrive_local": "11:35", "duration_min": 320,
     "status": "delayed", "gate": "A17", "aircraft": "Airbus A330"},
    {"flight_number": "DL504", "airline": "DL", "from": "ATL", "to": "MIA",
     "depart_local": "16:00", "arrive_local": "17:50", "duration_min": 110,
     "status": "on_time", "gate": "T2", "aircraft": "Boeing 717"},

    # JetBlue from JFK
    {"flight_number": "B6601", "airline": "B6", "from": "JFK", "to": "LAX",
     "depart_local": "07:30", "arrive_local": "10:55", "duration_min": 385,
     "status": "on_time", "gate": "T5-12", "aircraft": "Airbus A321"},
    {"flight_number": "B6602", "airline": "B6", "from": "JFK", "to": "BOS",
     "depart_local": "12:15", "arrive_local": "13:30", "duration_min": 75,
     "status": "on_time", "gate": "T5-9", "aircraft": "Embraer 190"},
    {"flight_number": "B6603", "airline": "B6", "from": "JFK", "to": "MIA",
     "depart_local": "15:45", "arrive_local": "18:55", "duration_min": 190,
     "status": "on_time", "gate": "T5-15", "aircraft": "Airbus A320"},
    {"flight_number": "B6604", "airline": "B6", "from": "BOS", "to": "MIA",
     "depart_local": "09:00", "arrive_local": "12:35", "duration_min": 215,
     "status": "on_time", "gate": "C42", "aircraft": "Airbus A320"},

    # Denver hub (United secondary)
    {"flight_number": "UA850", "airline": "UA", "from": "DEN", "to": "LAX",
     "depart_local": "08:45", "arrive_local": "10:00", "duration_min": 135,
     "status": "on_time", "gate": "B33", "aircraft": "Boeing 737"},
    {"flight_number": "UA851", "airline": "UA", "from": "DEN", "to": "ORD",
     "depart_local": "11:30", "arrive_local": "14:55", "duration_min": 145,
     "status": "on_time", "gate": "B41", "aircraft": "Airbus A319"},
    {"flight_number": "UA852", "airline": "UA", "from": "SFO", "to": "DEN",
     "depart_local": "06:00", "arrive_local": "09:25", "duration_min": 145,
     "status": "on_time", "gate": "F8", "aircraft": "Boeing 737"},

    # Seattle (United + Delta)
    {"flight_number": "UA901", "airline": "UA", "from": "SEA", "to": "ORD",
     "depart_local": "07:00", "arrive_local": "12:55", "duration_min": 235,
     "status": "on_time", "gate": "S2", "aircraft": "Boeing 737"},
    {"flight_number": "DL902", "airline": "DL", "from": "SEA", "to": "ATL",
     "depart_local": "14:30", "arrive_local": "22:05", "duration_min": 275,
     "status": "on_time", "gate": "B12", "aircraft": "Boeing 757"},

    # SFO-LAX shuttle
    {"flight_number": "UA1001", "airline": "UA", "from": "SFO", "to": "LAX",
     "depart_local": "06:00", "arrive_local": "07:25", "duration_min": 85,
     "status": "on_time", "gate": "F3", "aircraft": "Airbus A320"},
    {"flight_number": "UA1002", "airline": "UA", "from": "SFO", "to": "LAX",
     "depart_local": "09:30", "arrive_local": "10:55", "duration_min": 85,
     "status": "on_time", "gate": "F5", "aircraft": "Airbus A320"},
    {"flight_number": "UA1003", "airline": "UA", "from": "LAX", "to": "SFO",
     "depart_local": "08:00", "arrive_local": "09:25", "duration_min": 85,
     "status": "on_time", "gate": "B22", "aircraft": "Airbus A320"},
    {"flight_number": "UA1004", "airline": "UA", "from": "LAX", "to": "SFO",
     "depart_local": "12:15", "arrive_local": "13:40", "duration_min": 85,
     "status": "delayed", "gate": "B26", "aircraft": "Airbus A320"},

    # Chicago hub (United + American)
    {"flight_number": "UA710", "airline": "UA", "from": "ORD", "to": "BOS",
     "depart_local": "06:30", "arrive_local": "09:45", "duration_min": 135,
     "status": "on_time", "gate": "C12", "aircraft": "Boeing 737"},
    {"flight_number": "AA711", "airline": "AA", "from": "ORD", "to": "DFW",
     "depart_local": "07:15", "arrive_local": "09:50", "duration_min": 155,
     "status": "on_time", "gate": "K8", "aircraft": "Boeing 737"},
    {"flight_number": "UA712", "airline": "UA", "from": "ORD", "to": "DEN",
     "depart_local": "10:00", "arrive_local": "11:30", "duration_min": 150,
     "status": "on_time", "gate": "C20", "aircraft": "Embraer 175"},

    # MIA southbound
    {"flight_number": "AA801", "airline": "AA", "from": "MIA", "to": "JFK",
     "depart_local": "08:00", "arrive_local": "11:00", "duration_min": 180,
     "status": "on_time", "gate": "D40", "aircraft": "Boeing 737"},
    {"flight_number": "DL802", "airline": "DL", "from": "MIA", "to": "ATL",
     "depart_local": "12:30", "arrive_local": "14:20", "duration_min": 110,
     "status": "on_time", "gate": "H5", "aircraft": "Boeing 717"},

    # BOS additional
    {"flight_number": "B6605", "airline": "B6", "from": "BOS", "to": "SFO",
     "depart_local": "07:45", "arrive_local": "11:30", "duration_min": 405,
     "status": "on_time", "gate": "C40", "aircraft": "Airbus A321"},
]

# ── Dashboard analytics (PR 3: c-generative-ui aviation KPIs) ───────────────

KPI_SNAPSHOT = {
    "on_time_pct": 84.2,
    "on_time_delta": "+1.4%",
    "flights_today": 312,
    "flights_today_delta": "+8",
    "avg_delay_min": 12,
    "avg_delay_delta": "-2 min",
    "load_factor_pct": 78.5,
    "load_factor_delta": "+0.6%",
}

ON_TIME_TREND = [
    {"month": "2025-05", "on_time_pct": 82.4},
    {"month": "2025-06", "on_time_pct": 81.1},
    {"month": "2025-07", "on_time_pct": 79.8},
    {"month": "2025-08", "on_time_pct": 80.5},
    {"month": "2025-09", "on_time_pct": 83.2},
    {"month": "2025-10", "on_time_pct": 84.0},
    {"month": "2025-11", "on_time_pct": 82.6},
    {"month": "2025-12", "on_time_pct": 78.9},
    {"month": "2026-01", "on_time_pct": 80.2},
    {"month": "2026-02", "on_time_pct": 81.7},
    {"month": "2026-03", "on_time_pct": 82.8},
    {"month": "2026-04", "on_time_pct": 84.2},
]

FLIGHTS_BY_AIRLINE = [
    {"airline": "American", "count": 87},
    {"airline": "United",   "count": 92},
    {"airline": "Delta",    "count": 78},
    {"airline": "JetBlue",  "count": 55},
]

RECENT_DISRUPTIONS = [
    {"flight_number": "UA123", "type": "delayed",   "minutes": 45, "route": "LAX→JFK", "date": "2026-05-14"},
    {"flight_number": "AA456", "type": "cancelled", "minutes": 0,  "route": "JFK→LAX", "date": "2026-05-14"},
    {"flight_number": "DL789", "type": "delayed",   "minutes": 22, "route": "ATL→ORD", "date": "2026-05-13"},
    {"flight_number": "B6101", "type": "delayed",   "minutes": 68, "route": "BOS→MIA", "date": "2026-05-13"},
    {"flight_number": "UA204", "type": "cancelled", "minutes": 0,  "route": "SFO→SEA", "date": "2026-05-12"},
    {"flight_number": "AA318", "type": "delayed",   "minutes": 15, "route": "DFW→DEN", "date": "2026-05-12"},
    {"flight_number": "DL552", "type": "delayed",   "minutes": 35, "route": "ATL→MIA", "date": "2026-05-11"},
    {"flight_number": "B6217", "type": "delayed",   "minutes": 80, "route": "JFK→BOS", "date": "2026-05-11"},
    {"flight_number": "UA640", "type": "cancelled", "minutes": 0,  "route": "ORD→DEN", "date": "2026-05-10"},
    {"flight_number": "AA871", "type": "delayed",   "minutes": 25, "route": "LAX→DFW", "date": "2026-05-10"},
]
