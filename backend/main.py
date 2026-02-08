from __future__ import annotations

from pathlib import Path
from typing import Optional, List, Dict, Any

import numpy as np
import pandas as pd
from fastapi import FastAPI, Query
from fastapi.middleware.cors import CORSMiddleware

# ----------------------------
# Paths
# ----------------------------
BASE_DIR = Path(__file__).resolve().parent.parent
DATA_PATH = BASE_DIR / "data" / "raw" / "players_data-2024_2025.csv"

# ----------------------------
# App
# ----------------------------
app = FastAPI(title="FutScout API", version="0.1")

# CORS: allow Angular dev server
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:4200",
        "http://127.0.0.1:4200",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ----------------------------
# Load data once
# ----------------------------
df = pd.read_csv(DATA_PATH)

# Ensure stable text columns
for col in ["Comp", "Player", "Squad", "Pos", "Nation"]:
    if col in df.columns:
        df[col] = df[col].astype(str)

# Make key numeric columns numeric
NUM_COLS = [
    "90s",
    "Min",
    "Age",
    "Gls",
    "Ast",
    "xG",
    "xAG",
    "PrgP",
    "PrgC",
    "KP",
    "SCA90",
    "Tkl+Int",
    "Touches",
    "Cmp%",
    "Def 3rd_stats_possession",
    "Mid 3rd_stats_possession",
    "Att 3rd_stats_possession",
    "Def 3rd",
    "Mid 3rd",
    "Att 3rd",
]
for c in NUM_COLS:
    if c in df.columns:
        df[c] = pd.to_numeric(df[c], errors="coerce")

# ----------------------------
# Radar + Heatmap Specs
# ----------------------------
# Radar spec: (column, label, mode)
# mode: per90 = divide by 90s, raw = use as is, pct = already percentage
RADAR_SPEC = [
    ("Gls", "Goals/90", "per90"),
    ("Ast", "Assists/90", "per90"),
    ("xG", "xG/90", "per90"),
    ("xAG", "xAG/90", "per90"),
    ("PrgP", "Prog Passes/90", "per90"),
    ("PrgC", "Prog Carries/90", "per90"),
    ("KP", "Key Passes/90", "per90"),
    ("SCA90", "SCA/90", "raw"),
    ("Tkl+Int", "Tkl+Int/90", "per90"),
    ("Touches", "Touches/90", "per90"),
    ("Cmp%", "Pass %", "pct"),
]

# Heatmap proxy: 3 rows (thirds) x 2 cols (touch share, tackle share)
TOUCH_THIRDS = [
    ("Def 3rd_stats_possession", "Def 3rd"),
    ("Mid 3rd_stats_possession", "Mid 3rd"),
    ("Att 3rd_stats_possession", "Att 3rd"),
]
TACKLE_THIRDS = [
    ("Def 3rd", "Def 3rd"),
    ("Mid 3rd", "Mid 3rd"),
    ("Att 3rd", "Att 3rd"),
]

# ----------------------------
# Helpers
# ----------------------------
def filter_pool(league: str, pos: Optional[str], min90s: float) -> pd.DataFrame:
    pool = df[df["Comp"] == league].copy()
    pool = pool[pool["90s"].fillna(0) >= min90s]
    if pos and pos != "ALL":
        pool = pool[pool["Pos"] == pos]
    return pool


def safe_per90(value: float, nineties: float) -> float:
    if pd.isna(value) or pd.isna(nineties) or nineties <= 0:
        return np.nan
    return float(value / nineties)


def percentile_of_value(pool: pd.Series, value: float) -> float:
    pool = pd.to_numeric(pool, errors="coerce").dropna()
    if pool.empty or pd.isna(value):
        return 0.0
    combined = pd.concat([pool, pd.Series([value])], ignore_index=True)
    return float(combined.rank(pct=True).iloc[-1] * 100)


def build_radar(pool: pd.DataFrame, row: pd.Series) -> Dict[str, Any]:
    labels: List[str] = []
    percentiles: List[float] = []
    values: List[float] = []

    for col, label, mode in RADAR_SPEC:
        labels.append(label)

        if mode == "pct":
            v = pd.to_numeric(row.get(col, np.nan), errors="coerce")
            pool_metric = pool[col]
            disp = float(v) if pd.notna(v) else 0.0
            pct = percentile_of_value(pool_metric, v)

        elif mode == "raw":
            v = pd.to_numeric(row.get(col, np.nan), errors="coerce")
            pool_metric = pd.to_numeric(pool[col], errors="coerce")
            disp = float(v) if pd.notna(v) else 0.0
            pct = percentile_of_value(pool_metric, v)

        else:  # per90
            v_raw = pd.to_numeric(row.get(col, np.nan), errors="coerce")
            v = safe_per90(v_raw, row.get("90s", np.nan))

            pool_metric = pd.to_numeric(pool[col], errors="coerce") / pool["90s"]
            disp = float(v) if pd.notna(v) else 0.0
            pct = percentile_of_value(pool_metric, v)

        values.append(disp)
        percentiles.append(pct)

    overall = int(round(float(np.nanmean(percentiles)) if percentiles else 0))
    return {"labels": labels, "percentiles": percentiles, "values": values, "overall": overall}


def build_heatmap(row: pd.Series) -> Dict[str, Any]:
    touch = np.array([pd.to_numeric(row.get(c, np.nan), errors="coerce") for c, _ in TOUCH_THIRDS], dtype=float)
    tkl = np.array([pd.to_numeric(row.get(c, np.nan), errors="coerce") for c, _ in TACKLE_THIRDS], dtype=float)

    if np.nansum(touch) > 0:
        touch = touch / np.nansum(touch)
    if np.nansum(tkl) > 0:
        tkl = tkl / np.nansum(tkl)

    matrix = np.column_stack([touch, tkl]).tolist()
    return {
        "matrix": matrix,
        "xLabels": ["Touches share", "Tackles share"],
        "yLabels": [lbl for _, lbl in TOUCH_THIRDS],
    }


# --- JSON sanitization (fix numpy.int64 / numpy.float64 serialization) ---
def to_builtin(x):
    if isinstance(x, (np.integer,)):
        return int(x)
    if isinstance(x, (np.floating,)):
        return float(x)
    if isinstance(x, (np.ndarray,)):
        return x.tolist()
    return x


def sanitize(obj):
    if isinstance(obj, dict):
        return {k: sanitize(v) for k, v in obj.items()}
    if isinstance(obj, list):
        return [sanitize(v) for v in obj]
    return to_builtin(obj)


def maybe_int(v):
    v = pd.to_numeric(v, errors="coerce")
    return None if pd.isna(v) else int(v)


def maybe_float(v):
    v = pd.to_numeric(v, errors="coerce")
    return None if pd.isna(v) else float(v)


# ----------------------------
# Endpoints
# ----------------------------
@app.get("/health")
def health() -> Dict[str, Any]:
    return {"ok": True, "rows": int(df.shape[0]), "cols": int(df.shape[1])}


@app.get("/meta/leagues")
def leagues() -> Dict[str, Any]:
    comps = sorted(df["Comp"].dropna().unique().tolist())
    return {"leagues": comps}


@app.get("/meta/positions")
def positions() -> Dict[str, Any]:
    positions = sorted(df["Pos"].dropna().unique().tolist())
    return {"positions": positions}


@app.get("/players")
def players(
    league: str = Query(...),
    pos: str = Query("ALL"),
    min90s: float = Query(5.0),
    squad: Optional[str] = Query(None),
) -> Dict[str, Any]:
    pool = filter_pool(league, pos, min90s)
    if squad:
        pool = pool[pool["Squad"] == squad]

    out = pool[["Player", "Squad", "Pos", "Age", "Min", "90s"]].copy()
    out = out.sort_values(["Squad", "Player"])

    # Convert to built-in types for safe JSON
    records = []
    for r in out.to_dict(orient="records"):
        records.append(
            {
                "Player": str(r.get("Player", "")),
                "Squad": str(r.get("Squad", "")),
                "Pos": str(r.get("Pos", "")),
                "Age": maybe_int(r.get("Age")),
                "Min": maybe_int(r.get("Min")),
                "90s": maybe_float(r.get("90s")),
            }
        )

    return {"players": records}


@app.get("/compare")
def compare(
    league: str = Query(...),
    player_a: str = Query(...),
    player_b: str = Query(...),
    pos: str = Query("ALL"),
    min90s: float = Query(5.0),
) -> Dict[str, Any]:
    pool = filter_pool(league, pos, min90s)
    if pool.empty:
        return {"error": "No players match the filters."}

    a_rows = pool[pool["Player"] == player_a]
    b_rows = pool[pool["Player"] == player_b]
    if a_rows.empty or b_rows.empty:
        return {"error": "Player not found in the filtered pool."}

    a = a_rows.iloc[0]
    b = b_rows.iloc[0]

    result = {
        "league": league,
        "filters": {"pos": pos, "min90s": min90s},
        "playerA": {
            "name": a["Player"],
            "squad": a["Squad"],
            "pos": a["Pos"],
            "age": maybe_int(a.get("Age")),
            "minutes": maybe_int(a.get("Min")),
            "nineties": maybe_float(a.get("90s")),
            "radar": build_radar(pool, a),
            "heatmap": build_heatmap(a),
        },
        "playerB": {
            "name": b["Player"],
            "squad": b["Squad"],
            "pos": b["Pos"],
            "age": maybe_int(b.get("Age")),
            "minutes": maybe_int(b.get("Min")),
            "nineties": maybe_float(b.get("90s")),
            "radar": build_radar(pool, b),
            "heatmap": build_heatmap(b),
        },
    }

    # Ensure everything is JSON-serializable (no numpy scalars)
    return sanitize(result)