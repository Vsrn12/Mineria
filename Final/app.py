"""
Dota 2 Pro Matches — Backend Flask
Análisis de partidas profesionales 2019-2021 con KNN usando scikit-learn.
Comentarios en español.
"""

import os
import math
import json
import time
import requests
import numpy as np
import pandas as pd
from flask import Flask, jsonify, request, render_template
from sklearn.neighbors import NearestNeighbors
from sklearn.preprocessing import StandardScaler

app = Flask(__name__)

# ─── Rutas ───────────────────────────────────────────────────────────────────
BASE_DIR  = os.path.dirname(os.path.abspath(__file__))
CSV_PATH  = os.path.join(BASE_DIR, "tb_pro_players_matches.csv")

# ─── Estado global ────────────────────────────────────────────────────────────
df_raw        = None   # DataFrame completo
hero_nombres  = {}     # {hero_id (int): {name, icon}}
knn_model     = None   # modelo KNN ajustado
knn_matrix    = None   # matriz normalizada usada para KNN
knn_cols      = []     # columnas numéricas usadas en KNN
scaler        = None   # StandardScaler ajustado
load_time_ms  = 0

# Columnas de estadísticas de equipo (sin hero_*) usadas para KNN y detalle
STAT_COLS_BASE = [
    "recencia", "freq", "win_pct",
    "duration_avg_win", "duration_avg_lose",
    "actions_per_min_avg", "ancient_kills_avg", "assists_avg",
    "buyback_count_avg", "courier_kills_avg", "deaths_avg",
    "denies_avg", "firstblood_claimed_avg", "gold_avg",
    "gold_per_min_avg", "gold_spent_avg", "hero_damage_avg",
    "hero_healing_avg", "hero_kills_avg", "kda_avg",
    "kills_per_min_avg", "lane_efficiency_avg", "lane_kills_avg",
    "last_hits_avg", "level_avg", "neutral_kills_avg",
    "observer_kills_avg", "observer_uses_avg", "roshan_kills_avg",
    "sentry_kills_avg", "sentry_uses_avg", "total_gold_avg",
    "total_xp_avg", "tower_damage_avg", "tower_kills_avg",
    "xp_per_min_avg",
]

# ─── Carga de datos ──────────────────────────────────────────────────────────

def cargar_datos():
    """Carga el CSV, limpia columnas irrelevantes y prepara el modelo KNN."""
    global df_raw, knn_model, knn_matrix, knn_cols, scaler, load_time_ms

    t0 = time.perf_counter()
    df = pd.read_csv(CSV_PATH)

    # Columnas de estadísticas numéricas para Radiant y Dire
    cols_r = [f"{c}_r" for c in STAT_COLS_BASE if f"{c}_r" in df.columns]
    cols_d = [f"{c}_d" for c in STAT_COLS_BASE if f"{c}_d" in df.columns]
    knn_cols_local = cols_r + cols_d

    # Rellenar NaN con la media de cada columna
    df[knn_cols_local] = df[knn_cols_local].fillna(df[knn_cols_local].mean())

    # Escalar y construir modelo KNN
    sc = StandardScaler()
    matrix = sc.fit_transform(df[knn_cols_local].values)

    modelo = NearestNeighbors(n_neighbors=11, metric="euclidean", algorithm="ball_tree")
    modelo.fit(matrix)

    df_raw       = df
    knn_cols     = knn_cols_local
    knn_matrix   = matrix
    knn_model    = modelo
    scaler       = sc
    load_time_ms = round((time.perf_counter() - t0) * 1000, 1)
    print(f"[OK] Dataset cargado: {len(df)} partidas en {load_time_ms} ms")


def obtener_hero_nombres():
    """Obtiene nombres e íconos de héroes desde la API de OpenDota (con caché en memoria)."""
    global hero_nombres
    if hero_nombres:
        return hero_nombres
    try:
        resp = requests.get("https://api.opendota.com/api/heroes", timeout=8)
        if resp.status_code == 200:
            for h in resp.json():
                hid = h.get("id")
                nombre = h.get("localized_name", f"Héroe {hid}")
                icono  = f"https://cdn.cloudflare.steamstatic.com/apps/dota2/images/dota_react/heroes/{h.get('name','').replace('npc_dota_hero_','')}_vert.jpg"
                hero_nombres[hid] = {"nombre": nombre, "icono": icono}
    except Exception as e:
        print(f"[WARN] No se pudo obtener héroes de OpenDota: {e}")
    return hero_nombres


# ─── Helpers ─────────────────────────────────────────────────────────────────

def extraer_heroes_equipo(row, sufijo):
    """
    Extrae los héroes usados por un equipo en esa partida.
    Columnas hero_<id>_avg_r/d contienen la frecuencia de uso (> 0 = usó ese héroe).
    Devuelve lista de {id, nombre, icono, frecuencia}.
    """
    nombres = obtener_hero_nombres()
    heroes = []
    for col in row.index:
        if col.startswith("hero_") and col.endswith(f"_avg_{sufijo}"):
            val = row[col]
            if pd.notna(val) and val > 0:
                try:
                    hid = int(col.split("_")[1])
                except (IndexError, ValueError):
                    continue
                info = nombres.get(hid, {"nombre": f"Héroe {hid}", "icono": ""})
                heroes.append({
                    "id":        hid,
                    "nombre":    info["nombre"],
                    "icono":     info["icono"],
                    "frecuencia": round(float(val), 4),
                })
    heroes.sort(key=lambda x: x["frecuencia"], reverse=True)
    return heroes


def row_a_dict(row):
    """Convierte una fila del DataFrame a dict serializable."""
    d = {}
    for k, v in row.items():
        if isinstance(v, float) and math.isnan(v):
            d[k] = None
        elif isinstance(v, (np.integer,)):
            d[k] = int(v)
        elif isinstance(v, (np.floating,)):
            d[k] = round(float(v), 4)
        else:
            d[k] = v
    return d


# ─── Rutas principales ───────────────────────────────────────────────────────

@app.route("/")
def index():
    return render_template("index.html")


# ─── API: estadísticas generales ─────────────────────────────────────────────

@app.route("/api/stats")
def api_stats():
    """Devuelve estadísticas de resumen del dataset."""
    total       = len(df_raw)
    radiant_win = int(df_raw["radiant_win"].sum())
    dire_win    = total - radiant_win
    primera     = str(df_raw["dt_match"].min())
    ultima      = str(df_raw["dt_match"].max())
    return jsonify({
        "total_partidas": total,
        "radiant_wins":   radiant_win,
        "dire_wins":      dire_win,
        "winrate_radiant": round(radiant_win / total * 100, 1),
        "winrate_dire":    round(dire_win    / total * 100, 1),
        "primera_partida": primera,
        "ultima_partida":  ultima,
        "carga_ms":        load_time_ms,
    })


# ─── API: lista de partidas paginada ─────────────────────────────────────────

@app.route("/api/partidas")
def api_partidas():
    """
    Lista paginada de partidas.
    Query params: page (int), per_page (int), ganador (radiant|dire|todos)
    """
    pagina   = int(request.args.get("page",     1))
    por_pag  = int(request.args.get("per_page", 20))
    ganador  = request.args.get("ganador", "todos")

    df = df_raw.copy()

    if ganador == "radiant":
        df = df[df["radiant_win"] == True]
    elif ganador == "dire":
        df = df[df["radiant_win"] == False]

    total  = len(df)
    inicio = (pagina - 1) * por_pag
    fin    = inicio + por_pag

    columnas_resumen = [
        "match_id", "dt_match", "radiant_win",
        "win_pct_r", "kda_avg_r", "gold_per_min_avg_r",
        "win_pct_d", "kda_avg_d", "gold_per_min_avg_d",
    ]
    cols_disponibles = [c for c in columnas_resumen if c in df.columns]
    sub = df[cols_disponibles].iloc[inicio:fin]

    partidas = []
    for _, row in sub.iterrows():
        p = row_a_dict(row)
        p["ganador"] = "Radiant" if row.get("radiant_win") else "Dire"
        partidas.append(p)

    return jsonify({
        "total":    total,
        "pagina":   pagina,
        "por_pag":  por_pag,
        "paginas":  math.ceil(total / por_pag),
        "partidas": partidas,
    })


# ─── API: detalle de una partida ─────────────────────────────────────────────

@app.route("/api/partida/<int:match_id>")
def api_partida(match_id):
    """Devuelve todos los atributos y héroes de una partida específica."""
    filas = df_raw[df_raw["match_id"] == match_id]
    if filas.empty:
        return jsonify({"error": "Partida no encontrada"}), 404

    row = filas.iloc[0]

    # Estadísticas de ambos equipos
    stats_r = {}
    stats_d = {}
    for base in STAT_COLS_BASE:
        col_r = f"{base}_r"
        col_d = f"{base}_d"
        if col_r in row.index:
            v = row[col_r]
            stats_r[base] = None if (isinstance(v, float) and math.isnan(v)) else round(float(v), 4)
        if col_d in row.index:
            v = row[col_d]
            stats_d[base] = None if (isinstance(v, float) and math.isnan(v)) else round(float(v), 4)

    heroes_r = extraer_heroes_equipo(row, "r")[:10]
    heroes_d = extraer_heroes_equipo(row, "d")[:10]

    return jsonify({
        "match_id":    match_id,
        "dt_match":    str(row.get("dt_match", "")),
        "radiant_win": bool(row.get("radiant_win", False)),
        "ganador":     "Radiant" if row.get("radiant_win") else "Dire",
        "radiant":     {"stats": stats_r, "heroes": heroes_r},
        "dire":        {"stats": stats_d, "heroes": heroes_d},
    })


# ─── API: héroes del meta ─────────────────────────────────────────────────────

@app.route("/api/heroes/meta")
def api_heroes_meta():
    """
    Devuelve los héroes más usados en el meta (frecuencia promedio acumulada
    entre Radiant y Dire) y una estimación de su win_rate en las partidas
    donde ese héroe fue usado frecuentemente.
    Query param: top (int, default 30)
    """
    top     = int(request.args.get("top", 30))
    nombres = obtener_hero_nombres()

    # Columnas hero de Radiant y Dire
    hero_cols_r = [c for c in df_raw.columns if c.startswith("hero_") and c.endswith("_avg_r")]
    hero_cols_d = [c for c in df_raw.columns if c.startswith("hero_") and c.endswith("_avg_d")]

    resultados = {}

    for col in hero_cols_r:
        try:
            hid = int(col.split("_")[1])
        except (IndexError, ValueError):
            continue
        freq_total = float(df_raw[col].fillna(0).sum())
        # Estimar winrate: filas donde radiant usó ese héroe (freq > 0) y ganó
        mask_uso = df_raw[col].fillna(0) > 0
        partidas_uso = df_raw[mask_uso]
        wins = int(partidas_uso["radiant_win"].sum()) if len(partidas_uso) > 0 else 0
        total_uso = len(partidas_uso)
        if hid not in resultados:
            resultados[hid] = {"freq": 0, "wins": 0, "total": 0}
        resultados[hid]["freq"]  += freq_total
        resultados[hid]["wins"]  += wins
        resultados[hid]["total"] += total_uso

    for col in hero_cols_d:
        try:
            hid = int(col.split("_")[1])
        except (IndexError, ValueError):
            continue
        freq_total = float(df_raw[col].fillna(0).sum())
        mask_uso = df_raw[col].fillna(0) > 0
        partidas_uso = df_raw[mask_uso]
        wins = int((~partidas_uso["radiant_win"]).sum()) if len(partidas_uso) > 0 else 0
        total_uso = len(partidas_uso)
        if hid not in resultados:
            resultados[hid] = {"freq": 0, "wins": 0, "total": 0}
        resultados[hid]["freq"]  += freq_total
        resultados[hid]["wins"]  += wins
        resultados[hid]["total"] += total_uso

    lista = []
    for hid, datos in resultados.items():
        if datos["total"] == 0:
            continue
        info = nombres.get(hid, {"nombre": f"Héroe {hid}", "icono": ""})
        lista.append({
            "id":       hid,
            "nombre":   info["nombre"],
            "icono":    info["icono"],
            "freq":     round(datos["freq"], 2),
            "winrate":  round(datos["wins"] / datos["total"] * 100, 1),
            "partidas": datos["total"],
        })

    lista.sort(key=lambda x: x["freq"], reverse=True)
    return jsonify(lista[:top])


# ─── API: nombres de héroes ───────────────────────────────────────────────────

@app.route("/api/heroes/nombres")
def api_heroes_nombres():
    """Devuelve el mapeo completo id → nombre e ícono desde OpenDota."""
    nombres = obtener_hero_nombres()
    return jsonify(nombres)


# ─── API: KNN — partidas similares ───────────────────────────────────────────

@app.route("/api/knn", methods=["POST"])
def api_knn():
    """
    Encuentra las K partidas más similares a la indicada.
    Body JSON: { "match_id": 12345, "k": 10 }
    La similitud se calcula con los vectores de estadísticas de ambos equipos
    normalizados con StandardScaler + KNN Euclidiana.
    """
    body     = request.get_json(force=True)
    match_id = int(body.get("match_id", 0))
    k        = min(int(body.get("k", 10)), 50)

    idx_filas = df_raw.index[df_raw["match_id"] == match_id].tolist()
    if not idx_filas:
        return jsonify({"error": "Partida no encontrada"}), 404

    idx = idx_filas[0]
    # Posición en la matriz KNN (puede diferir del índice si el df fue filtrado)
    pos = df_raw.index.get_loc(idx)

    vector = knn_matrix[pos].reshape(1, -1)
    distancias, indices = knn_model.kneighbors(vector, n_neighbors=k + 1)

    similares = []
    for dist, i in zip(distancias[0], indices[0]):
        fila = df_raw.iloc[i]
        mid  = int(fila["match_id"])
        if mid == match_id:
            continue
        similares.append({
            "match_id":    mid,
            "dt_match":    str(fila.get("dt_match", "")),
            "ganador":     "Radiant" if fila.get("radiant_win") else "Dire",
            "distancia":   round(float(dist), 4),
            "win_pct_r":   round(float(fila.get("win_pct_r", 0) or 0), 3),
            "win_pct_d":   round(float(fila.get("win_pct_d", 0) or 0), 3),
            "kda_avg_r":   round(float(fila.get("kda_avg_r", 0) or 0), 3),
            "kda_avg_d":   round(float(fila.get("kda_avg_d", 0) or 0), 3),
        })
        if len(similares) >= k:
            break

    # También devolver los datos de la partida consultada para el front
    fila_ref = df_raw.iloc[pos]
    return jsonify({
        "partida_referencia": {
            "match_id":  match_id,
            "dt_match":  str(fila_ref.get("dt_match", "")),
            "ganador":   "Radiant" if fila_ref.get("radiant_win") else "Dire",
            "win_pct_r": round(float(fila_ref.get("win_pct_r", 0) or 0), 3),
            "win_pct_d": round(float(fila_ref.get("win_pct_d", 0) or 0), 3),
        },
        "similares": similares,
        "k": k,
    })


# ─── Arranque ─────────────────────────────────────────────────────────────────

cargar_datos()

if __name__ == "__main__":
    app.run(debug=True, port=5000)
