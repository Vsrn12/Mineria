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
from sklearn.decomposition import PCA
from sklearn.manifold import TSNE
import inspect as _inspect
try:
    import umap as umap_lib
    UMAP_AVAILABLE = True
except ImportError:
    UMAP_AVAILABLE = False

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
anomaly_stats = {}     # Estadísticas de filas sin datos de héroes

# ─── Helper columnas héroe ────────────────────────────────────────────────────
def es_col_heroe(col):
    """
    Devuelve True si la columna es un pick rate de héroe (hero_<NUMBER>_avg_r/d).
    Excluye hero_damage_avg, hero_healing_avg, hero_kills_avg (son stats, no heroes).
    """
    partes = col.split("_")
    if len(partes) < 4:
        return False
    try:
        int(partes[1])
        return True
    except ValueError:
        return False

# Columnas de estadísticas de equipo (sin hero_*) usadas para KNN y detalle
STAT_COLS_BASE = [
    # Columnas de rendimiento del equipo (se usan para KNN y detalle)
    # Se excluyeron: recencia (meta), freq (meta), lane_efficiency_avg (poco significativo)
    "win_pct",
    "duration_avg_win", "duration_avg_lose",
    "actions_per_min_avg", "ancient_kills_avg", "assists_avg",
    "buyback_count_avg", "courier_kills_avg", "deaths_avg",
    "denies_avg", "firstblood_claimed_avg", "gold_avg",
    "gold_per_min_avg", "gold_spent_avg", "hero_damage_avg",
    "hero_healing_avg", "hero_kills_avg", "kda_avg",
    "kills_per_min_avg", "lane_kills_avg",
    "last_hits_avg", "level_avg", "neutral_kills_avg",
    "observer_kills_avg", "observer_uses_avg", "roshan_kills_avg",
    "sentry_kills_avg", "sentry_uses_avg", "total_gold_avg",
    "total_xp_avg", "tower_damage_avg", "tower_kills_avg",
    "xp_per_min_avg",
]

# ─── Carga de datos ──────────────────────────────────────────────────────────

def cargar_datos():
    """Carga el CSV, limpia columnas irrelevantes y prepara el modelo KNN."""
    global df_raw, knn_model, knn_matrix, knn_cols, scaler, load_time_ms, anomaly_stats

    t0 = time.perf_counter()
    df = pd.read_csv(CSV_PATH)

    # ── Flags de presencia de héroes (calculados una sola vez) ──────────────
    hero_cols_r_ids = [c for c in df.columns if c.startswith("hero_") and c.endswith("_avg_r") and es_col_heroe(c)]
    hero_cols_d_ids = [c for c in df.columns if c.startswith("hero_") and c.endswith("_avg_d") and es_col_heroe(c)]
    df["_has_heroes_r"] = (df[hero_cols_r_ids].fillna(0) > 0).any(axis=1)
    df["_has_heroes_d"] = (df[hero_cols_d_ids].fillna(0) > 0).any(axis=1)
    df["_has_heroes"]   = df["_has_heroes_r"] & df["_has_heroes_d"]

    # ── Estadísticas de anomalías (partidas sin datos de héroes) ────────────
    n_valid            = int(df["_has_heroes"].sum())
    n_both_missing     = int((~df["_has_heroes_r"] & ~df["_has_heroes_d"]).sum())
    n_r_only_missing   = int((~df["_has_heroes_r"] &  df["_has_heroes_d"]).sum())
    n_d_only_missing   = int(( df["_has_heroes_r"] & ~df["_has_heroes_d"]).sum())
    df["_year"] = pd.to_datetime(df["dt_match"], errors="coerce").dt.year
    by_year = (
        df.groupby("_year")["_has_heroes"]
        .agg(total="count", valid="sum")
        .reset_index()
    )
    by_year["invalid"] = by_year["total"] - by_year["valid"]
    anomaly_stats = {
        "total":           len(df),
        "valid":           n_valid,
        "no_heroes_both":  n_both_missing,
        "no_heroes_r":     n_r_only_missing,
        "no_heroes_d":     n_d_only_missing,
        "total_invalid":   n_both_missing + n_r_only_missing + n_d_only_missing,
        "by_year":         by_year.to_dict("records"),
    }

    # ── Columnas de estadísticas numéricas para Radiant y Dire ──────────────
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
    print(f"[OK] Dataset cargado: {len(df)} partidas | válidas: {n_valid} | sin héroes: {anomaly_stats['total_invalid']} | {load_time_ms} ms")


def obtener_hero_nombres():
    """Obtiene nombres e íconos de héroes desde la API de OpenDota (con caché en memoria)."""
    global hero_nombres
    if hero_nombres:
        return hero_nombres
    try:
        resp = requests.get("https://api.opendota.com/api/heroes", timeout=8)
        if resp.status_code == 200:
            for h in resp.json():
                hid    = h.get("id")
                nombre = h.get("localized_name", f"Héroe {hid}")
                # URL confiable: strip de npc_dota_hero_ + _full.png del CDN de Steam
                name_clean = h.get("name", "").replace("npc_dota_hero_", "")
                icono = f"https://cdn.cloudflare.steamstatic.com/apps/dota2/images/heroes/{name_clean}_full.png"
                hero_nombres[hid] = {"nombre": nombre, "icono": icono}
    except Exception as e:
        print(f"[WARN] No se pudo obtener héroes de OpenDota: {e}")
    return hero_nombres


# ─── Helpers ─────────────────────────────────────────────────────────────────

def extraer_heroes_equipo(row, sufijo):
    """
    Extrae los héroes usados por un equipo en base a su historial reciente.

    ESTRUCTURA DEL DATASET:
    Las columnas hero_*_avg_r/d son de DOS tipos distintos:
      - hero_<NUMBER>_avg_r : fracción de partidas en que ese héroe fue elegido
                              en la ventana histórica del equipo (ej. 0.067 = 1/15)
      - hero_damage_avg_r   : daño total promedio del equipo (stat agregado, NO un héroe)
      - hero_healing_avg_r  : curación promedio del equipo (stat agregado, NO un héroe)
      - hero_kills_avg_r    : kills de héroe promedio del equipo (stat agregado, NO un héroe)

    Esta función solo extrae las columnas con ID numérico (hero_<NUMBER>_avg_r/d).
    Un equipo puede tener 0 a 118 héroes con valor > 0 dependiendo del tamaño
    de su ventana histórica (columna freq_r/d en el CSV).
    """
    nombres = obtener_hero_nombres()
    heroes = []
    for col in row.index:
        if not (col.startswith("hero_") and col.endswith(f"_avg_{sufijo}")):
            continue
        # Solo columnas con ID numérico: hero_<NUMBER>_avg_r/d
        # Excluye hero_damage_avg_r, hero_healing_avg_r, hero_kills_avg_r
        partes = col.split("_")
        if len(partes) < 4:
            continue
        try:
            hid = int(partes[1])   # hero_<ID>_avg_r → partes[1] = ID
        except ValueError:
            continue              # descarta damage, healing, kills
        val = row[col]
        if pd.notna(val) and val > 0:
            info = nombres.get(hid, {"nombre": f"Héroe {hid}", "icono": ""})
            heroes.append({
                "id":         hid,
                "nombre":     info["nombre"],
                "icono":      info["icono"],
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

    # Filtrar partidas sin datos de héroes (usuario no puede verlas útilmente)
    df = df_raw[df_raw["_has_heroes"] == True].copy()

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

    # Detectar fila incompleta: si win_pct_r es NaN el equipo no tenía historial previo
    # (~6% del dataset). Solo existe match_id + fecha + resultado; sin stats ni heroes.
    val_wpr = row.get("win_pct_r")
    val_wpd = row.get("win_pct_d")
    datos_completos = (
        (val_wpr is not None and not (isinstance(val_wpr, float) and math.isnan(val_wpr))) or
        (val_wpd is not None and not (isinstance(val_wpd, float) and math.isnan(val_wpd)))
    )

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

    heroes_r = extraer_heroes_equipo(row, "r")[:5]
    heroes_d = extraer_heroes_equipo(row, "d")[:5]

    # Tamaño de la ventana histórica de cada equipo (freq = número de partidas promediadas)
    freq_r = row.get("freq_r")
    freq_d = row.get("freq_d")

    return jsonify({
        "match_id":        match_id,
        "dt_match":        str(row.get("dt_match", "")),
        "radiant_win":     bool(row.get("radiant_win", False)),
        "ganador":         "Radiant" if row.get("radiant_win") else "Dire",
        "datos_completos": datos_completos,
        "radiant": {
            "stats":   stats_r,
            "heroes":  heroes_r,
            "ventana": round(float(freq_r), 0) if (freq_r is not None and not (isinstance(freq_r, float) and math.isnan(freq_r))) else None,
        },
        "dire": {
            "stats":   stats_d,
            "heroes":  heroes_d,
            "ventana": round(float(freq_d), 0) if (freq_d is not None and not (isinstance(freq_d, float) and math.isnan(freq_d))) else None,
        },
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

    # Solo columnas con ID numérico: hero_<NUMBER>_avg_r/d
    # Excluye hero_damage_avg_r, hero_healing_avg_r, hero_kills_avg_r (son stats, no heroes)
    hero_cols_r = [c for c in df_raw.columns if c.startswith("hero_") and c.endswith("_avg_r") and es_col_heroe(c)]
    hero_cols_d = [c for c in df_raw.columns if c.startswith("hero_") and c.endswith("_avg_d") and es_col_heroe(c)]

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
        heroes_r = extraer_heroes_equipo(fila, "r")[:5]
        heroes_d = extraer_heroes_equipo(fila, "d")[:5]
        similares.append({
            "match_id":    mid,
            "dt_match":    str(fila.get("dt_match", "")),
            "ganador":     "Radiant" if fila.get("radiant_win") else "Dire",
            "distancia":   round(float(dist), 4),
            "win_pct_r":   round(float(fila.get("win_pct_r", 0) or 0), 3),
            "win_pct_d":   round(float(fila.get("win_pct_d", 0) or 0), 3),
            "kda_avg_r":   round(float(fila.get("kda_avg_r", 0) or 0), 3),
            "kda_avg_d":   round(float(fila.get("kda_avg_d", 0) or 0), 3),
            "heroes_r":    heroes_r,
            "heroes_d":    heroes_d,
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


# ─── API: gráficos ───────────────────────────────────────────────────────────

@app.route("/api/graficos")
def api_graficos():
    """
    Devuelve los datos para los 11 gráficos de la pestaña Gráficos:
      1. Top 50 héroes por frecuencia + winrate        (Meta / H1)
      2. GPM y XPM promedio (Radiant vs Dire)           (H1)
      3. Winrate global Radiant vs Dire                 (balance)
      4. Anomalías del dataset por año                  (calidad)
      5. KDA ganadores vs perdedores                    (H2)
      6. Control de visión (wards)                      (H3)
      7. Diferencia en objetivos (torres, kills, etc.)  (H4, H5)
      8. Duración promedio ganando vs perdiendo          (H4, H7)
      9. GPM por año (ganadores vs perdedores)           (H1 temporal)
     10. Ventana histórica y win rate                   (H6)
     11. Correlaciones Pearson con radiant_win          (H1-H5)
    """
    nombres = obtener_hero_nombres()

    # ── 1. Top 50 héroes ─────────────────────────────────────────────────────
    hero_cols_r = [c for c in df_raw.columns if c.startswith("hero_") and c.endswith("_avg_r") and es_col_heroe(c)]
    hero_cols_d = [c for c in df_raw.columns if c.startswith("hero_") and c.endswith("_avg_d") and es_col_heroe(c)]
    resultados = {}

    for col in hero_cols_r:
        hid = int(col.split("_")[1])
        freq_total = float(df_raw[col].fillna(0).sum())
        mask = df_raw[col].fillna(0) > 0
        part = df_raw[mask]
        wins = int(part["radiant_win"].sum()) if len(part) > 0 else 0
        if hid not in resultados:
            resultados[hid] = {"freq": 0, "wins": 0, "total": 0}
        resultados[hid]["freq"]  += freq_total
        resultados[hid]["wins"]  += wins
        resultados[hid]["total"] += len(part)

    for col in hero_cols_d:
        hid = int(col.split("_")[1])
        freq_total = float(df_raw[col].fillna(0).sum())
        mask = df_raw[col].fillna(0) > 0
        part = df_raw[mask]
        wins = int((~part["radiant_win"]).sum()) if len(part) > 0 else 0
        if hid not in resultados:
            resultados[hid] = {"freq": 0, "wins": 0, "total": 0}
        resultados[hid]["freq"]  += freq_total
        resultados[hid]["wins"]  += wins
        resultados[hid]["total"] += len(part)

    top50 = []
    for hid, datos in resultados.items():
        if datos["total"] == 0:
            continue
        info = nombres.get(hid, {"nombre": f"Héroe {hid}", "icono": ""})
        top50.append({
            "id":      hid,
            "nombre":  info["nombre"],
            "winrate": round(datos["wins"] / datos["total"] * 100, 1),
            "freq":    round(datos["freq"], 1),
            "partidas": datos["total"],
        })
    top50.sort(key=lambda x: x["freq"], reverse=True)
    top50 = top50[:50]

    # ── 2. GPM / XPM ganadores vs perdedores ─────────────────────────────────
    df_v   = df_raw[df_raw["_has_heroes"] == True]
    r_wins = df_v[df_v["radiant_win"] == True]
    r_lose = df_v[df_v["radiant_win"] == False]

    def safe_mean(series):
        v = series.dropna().mean()
        return round(float(v), 1) if not math.isnan(v) else 0.0

    gpm_xpm = {
        "winner_gpm":  safe_mean(pd.concat([r_wins["gold_per_min_avg_r"], r_lose["gold_per_min_avg_d"]])),
        "loser_gpm":   safe_mean(pd.concat([r_wins["gold_per_min_avg_d"], r_lose["gold_per_min_avg_r"]])),
        "winner_xpm":  safe_mean(pd.concat([r_wins["xp_per_min_avg_r"],   r_lose["xp_per_min_avg_d"]])),
        "loser_xpm":   safe_mean(pd.concat([r_wins["xp_per_min_avg_r"],   r_lose["xp_per_min_avg_r"]])),
        "radiant_gpm": safe_mean(df_v["gold_per_min_avg_r"]),
        "dire_gpm":    safe_mean(df_v["gold_per_min_avg_d"]),
        "radiant_xpm": safe_mean(df_v["xp_per_min_avg_r"]),
        "dire_xpm":    safe_mean(df_v["xp_per_min_avg_d"]),
    }

    # ── 3. Winrate Radiant vs Dire ────────────────────────────────────────────
    total_all   = len(df_raw)
    rad_wins    = int(df_raw["radiant_win"].sum())
    win_rates   = {
        "radiant_wins": rad_wins,
        "dire_wins":    total_all - rad_wins,
        "radiant_pct":  round(rad_wins / total_all * 100, 1),
        "dire_pct":     round((total_all - rad_wins) / total_all * 100, 1),
    }

    # ── Helper: medias de ganadores y perdedores para col_r / col_d ─────────
    def win_lose_means(col_r, col_d):
        win  = pd.concat([
            df_v.loc[df_v["radiant_win"] == True,  col_r],
            df_v.loc[df_v["radiant_win"] == False, col_d],
        ]).dropna()
        lose = pd.concat([
            df_v.loc[df_v["radiant_win"] == False, col_r],
            df_v.loc[df_v["radiant_win"] == True,  col_d],
        ]).dropna()
        return (
            round(float(win.mean()),  4) if len(win)  else 0.0,
            round(float(lose.mean()), 4) if len(lose) else 0.0,
        )

    # ── 5. KDA ganadores vs perdedores (con histograma de densidad) ───────────
    kda_winners = pd.concat([
        df_v.loc[df_v["radiant_win"] == True,  "kda_avg_r"],
        df_v.loc[df_v["radiant_win"] == False, "kda_avg_d"],
    ]).dropna()
    kda_losers = pd.concat([
        df_v.loc[df_v["radiant_win"] == False, "kda_avg_r"],
        df_v.loc[df_v["radiant_win"] == True,  "kda_avg_d"],
    ]).dropna()
    bins_kda   = np.linspace(0.5, 8, 61)
    hist_kw, _ = np.histogram(kda_winners.clip(0.5, 8), bins=bins_kda, density=True)
    hist_kl, _ = np.histogram(kda_losers.clip(0.5, 8),  bins=bins_kda, density=True)
    bin_c_kda  = [(bins_kda[i] + bins_kda[i + 1]) / 2 for i in range(len(bins_kda) - 1)]
    kda = {
        "winner":      round(float(kda_winners.mean()), 3),
        "loser":       round(float(kda_losers.mean()),  3),
        "bin_centers": [round(float(v), 3) for v in bin_c_kda],
        "hist_win":    [round(float(v), 4) for v in hist_kw],
        "hist_lose":   [round(float(v), 4) for v in hist_kl],
    }

    # ── 6. Control de visión ──────────────────────────────────────────────────
    vision_items = [
        ("Observer colocadas", "observer_uses_avg_r",  "observer_uses_avg_d"),
        ("Observer destruidas","observer_kills_avg_r", "observer_kills_avg_d"),
        ("Sentry colocadas",   "sentry_uses_avg_r",    "sentry_uses_avg_d"),
        ("Sentry destruidas",  "sentry_kills_avg_r",   "sentry_kills_avg_d"),
    ]
    vision = [
        {"label": lbl, "winner": w, "loser": l}
        for lbl, cr, cd in vision_items
        for w, l in [win_lose_means(cr, cd)]
    ]

    # ── 7. Diferencia en objetivos ────────────────────────────────────────────
    obj_items = [
        ("Torres destruidas",  "tower_kills_avg_r",    "tower_kills_avg_d"),
        ("Kills de héroes",    "hero_kills_avg_r",     "hero_kills_avg_d"),
        ("Daño a torres",      "tower_damage_avg_r",   "tower_damage_avg_d"),
        ("Muertes de Roshan",  "roshan_kills_avg_r",   "roshan_kills_avg_d"),
        ("Kills neutrales",    "neutral_kills_avg_r",  "neutral_kills_avg_d"),
    ]
    objetivos = []
    for lbl, cr, cd in obj_items:
        w, l = win_lose_means(cr, cd)
        diff = round((w - l) / l * 100, 1) if l > 0 else 0.0
        objetivos.append({"label": lbl, "winner": w, "loser": l, "diff_pct": diff})

    # ── 8. Duración ganando vs perdiendo (histograma de densidad) ─────────────
    # Columnas ya en minutos (igual que el notebook: bins 20-70 min)
    dur_w = df_v["duration_avg_win_r"].dropna()
    dur_l = df_v["duration_avg_lose_r"].dropna()
    bins_dur   = np.linspace(20, 70, 51)
    hist_dw, _ = np.histogram(dur_w.clip(20, 70), bins=bins_dur, density=True)
    hist_dl, _ = np.histogram(dur_l.clip(20, 70), bins=bins_dur, density=True)
    bin_c_dur  = [(bins_dur[i] + bins_dur[i + 1]) / 2 for i in range(len(bins_dur) - 1)]
    duracion = {
        "mean_win":    round(float(dur_w.mean()),   1),
        "mean_lose":   round(float(dur_l.mean()),   1),
        "bin_centers": [round(float(v), 2) for v in bin_c_dur],
        "hist_win":    [round(float(v), 4) for v in hist_dw],
        "hist_lose":   [round(float(v), 4) for v in hist_dl],
    }

    # ── 9. GPM por año ────────────────────────────────────────────────────────
    years = sorted([int(y) for y in df_v["_year"].dropna().unique()])
    gpm_anio = []
    for yr in years:
        sub = df_v[df_v["_year"] == yr]
        gw = pd.concat([
            sub.loc[sub["radiant_win"] == True,  "gold_per_min_avg_r"],
            sub.loc[sub["radiant_win"] == False, "gold_per_min_avg_d"],
        ]).dropna().mean()
        gl = pd.concat([
            sub.loc[sub["radiant_win"] == False, "gold_per_min_avg_r"],
            sub.loc[sub["radiant_win"] == True,  "gold_per_min_avg_d"],
        ]).dropna().mean()
        gpm_anio.append({
            "year":   yr,
            "winner": round(float(gw), 1) if not math.isnan(gw) else 0.0,
            "loser":  round(float(gl), 1) if not math.isnan(gl) else 0.0,
        })

    # ── 10. Ventana histórica y win rate ──────────────────────────────────────
    bins   = [0, 10, 30, 60, 100, 200, 1000]
    labels = ["1-10", "11-30", "31-60", "61-100", "101-200", "201+"]
    df_v2  = df_v.copy()
    df_v2["_freq_bucket"] = pd.cut(
        df_v2["freq_r"].fillna(0), bins=bins, labels=labels, right=True
    )
    bucket_agg = (
        df_v2.groupby("_freq_bucket", observed=True)["win_pct_r"]
        .agg(mean="mean", std="std", count="count")
        .reset_index()
    )
    ventana_hist = []
    for _, brow in bucket_agg.iterrows():
        ventana_hist.append({
            "bucket":   str(brow["_freq_bucket"]),
            "mean_pct": round(float(brow["mean"]) * 100, 2) if not math.isnan(brow["mean"]) else 0.0,
            "std_pct":  round(float(brow["std"])  * 100, 2) if not math.isnan(brow["std"])  else 0.0,
            "count":    int(brow["count"]),
        })

    # ── 11. Correlaciones con radiant_win ─────────────────────────────────────
    corr_cols = [
        "win_pct_r", "kda_avg_r", "gold_per_min_avg_r", "xp_per_min_avg_r",
        "hero_kills_avg_r", "deaths_avg_r", "assists_avg_r",
        "tower_kills_avg_r", "tower_damage_avg_r", "roshan_kills_avg_r",
        "observer_uses_avg_r", "sentry_uses_avg_r",
        "last_hits_avg_r", "denies_avg_r", "neutral_kills_avg_r",
        "firstblood_claimed_avg_r", "buyback_count_avg_r",
    ]
    corr_cols_ok = [c for c in corr_cols if c in df_v.columns]
    corr_series  = df_v[corr_cols_ok + ["radiant_win"]].corr()["radiant_win"].drop("radiant_win")
    corr_series  = corr_series.sort_values(ascending=False)
    # Labels legibles
    label_map = {
        "win_pct_r":              "Win Rate histórico (R)",
        "kda_avg_r":              "KDA",
        "gold_per_min_avg_r":     "GPM (oro/min)",
        "xp_per_min_avg_r":       "XPM (exp/min)",
        "hero_kills_avg_r":       "Kills de héroes",
        "deaths_avg_r":           "Muertes",
        "assists_avg_r":          "Asistencias",
        "tower_kills_avg_r":      "Torres destruidas",
        "tower_damage_avg_r":     "Daño a torres",
        "roshan_kills_avg_r":     "Muertes de Roshan",
        "observer_uses_avg_r":    "Observer wards",
        "sentry_uses_avg_r":      "Sentry wards",
        "last_hits_avg_r":        "Last hits",
        "denies_avg_r":           "Denies",
        "neutral_kills_avg_r":    "Kills neutrales",
        "firstblood_claimed_avg_r":"First blood",
        "buyback_count_avg_r":    "Buybacks",
    }
    correlaciones = [
        {"feature": label_map.get(k, k), "value": round(float(v), 4)}
        for k, v in corr_series.items()
    ]

    return jsonify({
        "top50_heroes": top50,
        "gpm_xpm":      gpm_xpm,
        "win_rates":    win_rates,
        "anomaly":      anomaly_stats,
        "kda":          kda,
        "vision":       vision,
        "objetivos":    objetivos,
        "duracion":     duracion,
        "gpm_anio":     gpm_anio,
        "ventana_hist": ventana_hist,
        "correlaciones":correlaciones,
    })


# ─── API: espacio latente (PCA / UMAP / t-SNE) ─────────────────────────────────

@app.route("/api/espacio-latente")
def api_espacio_latente():
    """
    Proyecta el vector de características de cada partida a 2 dimensiones
    usando reducción de dimensionalidad (PCA, UMAP o t-SNE).
    Query params:
        method : 'pca' | 'umap' | 'tsne'  (default: 'pca')
        n      : número de muestras        (default: 1000, máx: 3000)
    """
    method    = request.args.get("method", "pca").lower()
    n_samples = min(int(request.args.get("n", 1000)), 3000)

    df_v = df_raw[df_raw["_has_heroes"] == True].copy()
    if len(df_v) > n_samples:
        df_v = df_v.sample(n=n_samples, random_state=42)

    # Matriz de características (knn_cols ya tienen NaN rellenos desde cargar_datos)
    X        = df_v[knn_cols].values
    X_scaled = scaler.transform(X)

    method_used = method
    extra       = {}

    if method == "tsne":
        perp = min(30, len(df_v) - 1)
        # Compatibilidad sklearn 1.4 (n_iter) vs 1.5+ (max_iter)
        tsne_sig   = _inspect.signature(TSNE.__init__).parameters
        iter_kwarg = "max_iter" if "max_iter" in tsne_sig else "n_iter"
        reducer = TSNE(n_components=2, random_state=42, perplexity=perp,
                       **{iter_kwarg: 300})
        X2 = reducer.fit_transform(X_scaled)

    elif method == "umap" and UMAP_AVAILABLE:
        reducer = umap_lib.UMAP(n_components=2, random_state=42,
                                n_neighbors=15, min_dist=0.1)
        X2 = reducer.fit_transform(X_scaled)

    else:
        if method == "umap":
            method_used = "pca"
        pca = PCA(n_components=2, random_state=42)
        X2  = pca.fit_transform(X_scaled)
        extra["explained_variance"] = [
            round(float(v), 4) for v in pca.explained_variance_ratio_
        ]

    # Columnas adicionales a incluir en cada punto para el frontend
    DETAIL_COLS = [
        "win_pct_r", "kda_avg_r", "gold_per_min_avg_r", "xp_per_min_avg_r",
        "hero_kills_avg_r", "deaths_avg_r", "tower_kills_avg_r",
        "win_pct_d", "kda_avg_d", "gold_per_min_avg_d", "xp_per_min_avg_d",
        "hero_kills_avg_d", "deaths_avg_d", "tower_kills_avg_d",
    ]
    detail_cols_ok = [c for c in DETAIL_COLS if c in df_v.columns]

    puntos = []
    for i, (_, row) in enumerate(df_v.iterrows()):
        p = {
            "match_id":    int(row["match_id"]),
            "x":           round(float(X2[i, 0]), 4),
            "y":           round(float(X2[i, 1]), 4),
            "radiant_win": bool(row["radiant_win"]),
        }
        for col in detail_cols_ok:
            v = row[col]
            p[col] = round(float(v), 4) if pd.notna(v) else None
        puntos.append(p)

    return jsonify({
        "puntos": puntos,
        "meta": {
            "method":           method_used,
            "method_requested": method,
            "umap_available":   UMAP_AVAILABLE,
            "n_used":           len(puntos),
            **extra,
        },
    })


# ─── Arranque ─────────────────────────────────────────────────────────────────

cargar_datos()

if __name__ == "__main__":
    app.run(debug=True, port=5000)
