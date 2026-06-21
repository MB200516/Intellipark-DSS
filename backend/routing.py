"""
Bidirectional A* router for Bengaluru road network.

On first call the road graph is built from a simplified Bengaluru
road network (node/edge list). In production you would load this
from OSMnx:  G = osmnx.graph_from_place("Bengaluru, India", network_type="drive")

For the hackathon we use a lightweight synthetic graph seeded from
the real junction coordinates, with edges weighted by Haversine distance.
This gives realistic relative distances and the A* search is genuine.
"""

import math
import heapq
import numpy as np
from typing import Optional, Tuple, Dict, List

# ── Haversine ──────────────────────────────────────────────────────────
def haversine(lat1, lng1, lat2, lng2) -> float:
    R = 6371.0
    p1, p2 = math.radians(lat1), math.radians(lat2)
    dp = math.radians(lat2 - lat1)
    dl = math.radians(lng2 - lng1)
    a = math.sin(dp/2)**2 + math.cos(p1)*math.cos(p2)*math.sin(dl/2)**2
    return 2 * R * math.asin(math.sqrt(a))


# ── Node registry: key junctions + officer spawn points ───────────────
# Each node: (lat, lng)
NODES: Dict[int, Tuple[float, float]] = {
    # Core junctions (matching hotspot data)
    0:  (12.9698, 77.5765),  # KR Market
    1:  (12.9176, 77.6233),  # Silk Board
    2:  (13.0351, 77.5953),  # Hebbal
    3:  (12.9591, 77.6974),  # Marathahalli
    4:  (12.9352, 77.6245),  # Koramangala
    5:  (12.9757, 77.6096),  # MG Road
    6:  (13.0213, 77.5530),  # Yeshwanthpur
    7:  (12.8456, 77.6603),  # Electronic City
    8:  (12.9250, 77.5938),  # Jayanagar
    9:  (12.9698, 77.7499),  # Whitefield
    10: (13.0130, 77.6350),  # Bellary Rd
    11: (12.9341, 77.5271),  # Mysore Rd
    12: (12.9591, 77.6497),  # Old Airport Rd
    13: (12.8830, 77.5982),  # Bannerghatta
    14: (13.0452, 77.5241),  # Tumkur Rd
    # Intermediate corridor nodes
    15: (12.9716, 77.5946),  # City Centre hub
    16: (12.9500, 77.6200),  # Central-South connector
    17: (13.0000, 77.6100),  # Central-North connector
    18: (12.9200, 77.6800),  # East corridor
    19: (12.9800, 77.6500),  # NE corridor
    20: (13.0000, 77.5700),  # NW hub
    21: (12.9100, 77.5700),  # SW hub
    22: (12.9400, 77.7100),  # Far east
    23: (12.9600, 77.5400),  # West
    24: (12.9900, 77.5900),  # North central
}

# Edges: (node_a, node_b) — bidirectional
RAW_EDGES = [
    (0, 15), (0, 8), (0, 11), (0, 23),
    (1, 4), (1, 16), (1, 7), (1, 13),
    (2, 17), (2, 10), (2, 6), (2, 14),
    (3, 9), (3, 12), (3, 19), (3, 22),
    (4, 16), (4, 5), (4, 8),
    (5, 15), (5, 19), (5, 17),
    (6, 20), (6, 24), (6, 14),
    (7, 13), (7, 18),
    (8, 21), (8, 16), (8, 13),
    (9, 22), (9, 19),
    (10, 17), (10, 19),
    (11, 21), (11, 23),
    (12, 19), (12, 16),
    (13, 21),
    (14, 20),
    (15, 17), (15, 16), (15, 24),
    (16, 18), (16, 19),
    (17, 24), (17, 20),
    (18, 22), (18, 19),
    (19, 12),
    (20, 24),
    (21, 23),
]

# Build adjacency with distances
ADJ: Dict[int, List[Tuple[int, float]]] = {n: [] for n in NODES}
for a, b in RAW_EDGES:
    d = haversine(*NODES[a], *NODES[b])
    # Add 25% to straight-line to approximate road detours
    d_road = d * 1.25
    ADJ[a].append((b, d_road))
    ADJ[b].append((a, d_road))


def _nearest_node(lat: float, lng: float) -> int:
    """Find the node in our graph closest to a given coordinate."""
    return min(NODES.keys(), key=lambda n: haversine(lat, lng, *NODES[n]))


def bidirectional_astar(
    src_lat: float, src_lng: float,
    dst_lat: float, dst_lng: float,
) -> Tuple[float, float]:
    """
    Bidirectional A* between two lat/lng points.
    Returns (road_distance_km, eta_minutes).
    Assumes average urban speed 18 km/h (accounts for signals/traffic).
    """
    src = _nearest_node(src_lat, src_lng)
    dst = _nearest_node(dst_lat, dst_lng)

    # Add source/dest offset distances
    src_offset = haversine(src_lat, src_lng, *NODES[src]) * 1.25
    dst_offset = haversine(dst_lat, dst_lng, *NODES[dst]) * 1.25

    if src == dst:
        total = src_offset + dst_offset
        return round(total, 2), max(1, round(total / 18 * 60))

    def h(n: int) -> float:
        return haversine(*NODES[n], *NODES[dst])

    # Forward search (src → dst)
    fwd_dist = {src: 0.0}
    fwd_heap = [(h(src), 0.0, src)]
    fwd_prev: Dict[int, Optional[int]] = {src: None}

    # Backward search (dst → src)
    bwd_dist = {dst: 0.0}
    bwd_heap = [(h(dst), 0.0, dst)]

    fwd_visited: set = set()
    bwd_visited: set = set()

    best = float('inf')
    mu   = float('inf')

    MAX_ITER = 2000
    iters = 0

    while (fwd_heap or bwd_heap) and iters < MAX_ITER:
        iters += 1

        # Expand forward
        if fwd_heap:
            _, fc, fn = heapq.heappop(fwd_heap)
            if fn in fwd_visited:
                continue
            fwd_visited.add(fn)

            if fn in bwd_visited:
                candidate = fwd_dist[fn] + bwd_dist[fn]
                if candidate < mu:
                    mu = candidate
                    best = candidate

            for nb, w in ADJ[fn]:
                nd = fwd_dist[fn] + w
                if nd < fwd_dist.get(nb, float('inf')):
                    fwd_dist[nb] = nd
                    heapq.heappush(fwd_heap, (nd + h(nb), nd, nb))

        # Expand backward
        if bwd_heap:
            _, bc, bn = heapq.heappop(bwd_heap)
            if bn in bwd_visited:
                continue
            bwd_visited.add(bn)

            if bn in fwd_visited:
                candidate = fwd_dist[bn] + bwd_dist[bn]
                if candidate < mu:
                    mu = candidate

            for nb, w in ADJ[bn]:
                nd = bwd_dist[bn] + w
                if nd < bwd_dist.get(nb, float('inf')):
                    bwd_dist[nb] = nd
                    h_bwd = haversine(*NODES[nb], *NODES[src])
                    heapq.heappush(bwd_heap, (nd + h_bwd, nd, nb))

    road_dist = (mu if mu < float('inf') else
                 haversine(src_lat, src_lng, dst_lat, dst_lng) * 1.4)
    road_dist += src_offset + dst_offset

    avg_speed_kmh = 18.0
    eta_minutes = max(1, round(road_dist / avg_speed_kmh * 60))

    return round(road_dist, 2), eta_minutes


def find_best_unit(
    hotspot_lat: float,
    hotspot_lng: float,
    officers: list,         # list of dicts with lat, lng, id, status
    deployed_ids: set,      # officer ids already on assignment
) -> Optional[dict]:
    """
    Run Bidirectional A* from every available officer to the hotspot.
    Return the officer dict of the closest available one, augmented
    with road_distance_km and eta_minutes.
    """
    best_dist = float('inf')
    best_officer = None

    for officer in officers:
        if officer["id"] in deployed_ids:
            continue
        if officer.get("status") not in ("available", "off_duty"):
            continue
        if not officer.get("lat") or not officer.get("lng"):
            continue

        dist, eta = bidirectional_astar(
            officer["lat"], officer["lng"],
            hotspot_lat, hotspot_lng,
        )
        if dist < best_dist:
            best_dist = dist
            best_officer = {**officer, "road_distance_km": dist, "eta_minutes": eta}

    return best_officer
