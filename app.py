"""
Sistema de Recomendación de Películas — KNN (Manhattan y Euclidiana)
Backend Flask: lógica de distancias implementada desde cero sin librerías externas.
VERSIÓN 2.0 - Con Influencer Match + Complejidad Computacional
"""
from __future__ import annotations

import os
import json
import math
import time
import sys
import pandas as pd
import psutil
import platform
from flask import Flask, jsonify, request, render_template

app = Flask(__name__)

# Rutas de archivos
BASE_DIR     = os.path.dirname(os.path.abspath(__file__))
RATINGS_PATH = os.path.join(BASE_DIR, "ratings.csv")
MOVIES_PATH  = os.path.join(BASE_DIR, "movies.csv")
CUSTOM_PATH  = os.path.join(BASE_DIR, "custom_ratings.csv")
NAMES_PATH   = os.path.join(BASE_DIR, "user_names.json")

# Estado global de la aplicación
ratings_dict  = {}   # {userId (int): {movieId (int): rating (float)}}
title_lookup  = {}   # {movieId (int): título (str)}
movies_list   = []   # lista de dicts para el endpoint /api/movies
user_names    = {}   # {str(userId): nombre}
next_user_id  = 1

# Métricas de rendimiento
load_times = {"ratings_ms": 0, "movies_ms": 0}


# ─── Carga de datos con medición de tiempo ────────────────────────────────────

def cargar_datos():
    """Carga los CSV de ratings y películas con medición de tiempo.
    Construye el diccionario de ratings para el cálculo de distancias."""
    global ratings_dict, title_lookup, movies_list, user_names, next_user_id, load_times

    start_total = time.perf_counter()

    # Intentar con Polars para carga rápida; caer en Pandas si no está instalado
    try:
        import polars as pl
        start_ratings = time.perf_counter()
        df_ratings = pl.read_csv(RATINGS_PATH, columns=["userId", "movieId", "rating"]).to_pandas()
        load_times["ratings_ms"] = (time.perf_counter() - start_ratings) * 1000

        start_movies = time.perf_counter()
        df_movies = pl.read_csv(MOVIES_PATH).to_pandas()
        load_times["movies_ms"] = (time.perf_counter() - start_movies) * 1000
    except ImportError:
        start_ratings = time.perf_counter()
        df_ratings = pd.read_csv(RATINGS_PATH, usecols=["userId", "movieId", "rating"])
        load_times["ratings_ms"] = (time.perf_counter() - start_ratings) * 1000

        start_movies = time.perf_counter()
        df_movies = pd.read_csv(MOVIES_PATH)
        load_times["movies_ms"] = (time.perf_counter() - start_movies) * 1000

    # Asegurar tipos numéricos correctos antes de procesar
    df_ratings["userId"]  = df_ratings["userId"].astype(int)
    df_ratings["movieId"] = df_ratings["movieId"].astype(int)
    df_ratings["rating"]  = df_ratings["rating"].astype(float)

    # Fusionar ratings personalizados (usuarios creados desde la app)
    if os.path.exists(CUSTOM_PATH):
        try:
            custom = pd.read_csv(CUSTOM_PATH)
            custom["userId"]  = custom["userId"].astype(int)
            custom["movieId"] = custom["movieId"].astype(int)
            custom["rating"]  = custom["rating"].astype(float)
            df_ratings = pd.concat([df_ratings, custom], ignore_index=True)
            # Si un usuario valoró la misma película dos veces, conservar la más reciente
            df_ratings.drop_duplicates(subset=["userId", "movieId"], keep="last", inplace=True)
        except Exception:
            pass

    # Construir diccionario de ratings: {userId -> {movieId -> rating}}
    nuevo_dict = {}
    for uid, mid, rat in zip(df_ratings["userId"], df_ratings["movieId"], df_ratings["rating"]):
        uid = int(uid)
        mid = int(mid)
        rat = float(rat)
        if uid not in nuevo_dict:
            nuevo_dict[uid] = {}
        nuevo_dict[uid][mid] = rat

    ratings_dict = nuevo_dict

    # Calcular el próximo ID disponible para usuarios nuevos
    next_user_id = max(ratings_dict.keys()) + 1 if ratings_dict else 1

    # Construir lookup de títulos de películas: {movieId -> título}
    nuevo_title = {}
    for mid, title in zip(df_movies["movieId"], df_movies["title"]):
        nuevo_title[int(mid)] = str(title)
    title_lookup = nuevo_title

    # Lista completa de películas para el endpoint de búsqueda en el front
    movies_list = df_movies[["movieId", "title", "genres"]].to_dict(orient="records")

    # Cargar nombres de usuarios personalizados
    if os.path.exists(NAMES_PATH):
        with open(NAMES_PATH, "r", encoding="utf-8") as f:
            user_names = json.load(f)
    else:
        user_names = {}


# Carga inicial al arrancar el servidor
cargar_datos()


# ─── Fórmulas de distancia (Python puro, sin librerías) ───────────────────────

def distancia_manhattan(ratings_a, ratings_b):
    """Distancia Manhattan entre dos usuarios.

    Solo considera películas valoradas por AMBOS usuarios (intersección).

    Fórmula:
        d(A, B) = Σ |A[i] - B[i]|   para cada película i en común

    Retorna: (distancia, cantidad de películas en común)
    """
    total = 0.0
    peliculas_comunes = 0

    for pelicula, rating_a in ratings_a.items():
        if pelicula in ratings_b:
            total += abs(rating_a - ratings_b[pelicula])
            peliculas_comunes += 1

    return total, peliculas_comunes


def distancia_euclidiana(ratings_a, ratings_b):
    """Distancia Euclidiana entre dos usuarios.

    Solo considera películas valoradas por AMBOS usuarios (intersección).

    Fórmula:
        d(A, B) = sqrt( Σ (A[i] - B[i])^2 )   para cada película i en común

    Retorna: (distancia, cantidad de películas en común)
    """
    suma_cuadrados = 0.0
    peliculas_comunes = 0

    for pelicula, rating_a in ratings_a.items():
        if pelicula in ratings_b:
            diferencia = rating_a - ratings_b[pelicula]
            suma_cuadrados += diferencia * diferencia
            peliculas_comunes += 1

    return math.sqrt(suma_cuadrados), peliculas_comunes


# ─── KNN ───────────────────────────────────────────────────────────────────────

def calcular_distancias(user_id, metrica="manhattan"):
    """Calcula la distancia entre el usuario indicado y todos los demás.

    Parámetros:
        user_id: ID del usuario de referencia
        metrica: 'manhattan' o 'euclidean'

    Retorna:
        Lista de dicts ordenada de menor a mayor distancia, o None si el usuario
        no existe en el diccionario de ratings.
    """
    if user_id not in ratings_dict:
        return None

    ratings_usuario = ratings_dict[user_id]
    resultados = []

    for otro_id, ratings_vecino in ratings_dict.items():
        if otro_id == user_id:
            continue

        if metrica == "manhattan":
            distancia, comunes = distancia_manhattan(ratings_usuario, ratings_vecino)
        else:
            distancia, comunes = distancia_euclidiana(ratings_usuario, ratings_vecino)

        if comunes > 0:
            resultados.append({
                "userId":       otro_id,
                "name":         user_names.get(str(otro_id), f"User {otro_id}"),
                "distance":     round(distancia, 6),
                "commonMovies": comunes,
            })

    resultados.sort(key=lambda x: x["distance"])
    return resultados


# ─── Recomendaciones ───────────────────────────────────────────────────────────

def obtener_recomendaciones(user_id, vecinos, umbral=3.0):
    """Genera recomendaciones de películas basándose en los vecinos más cercanos.

    Reglas:
      - La película NO debe haber sido vista por el usuario principal.
      - El vecino debe haberla valorado con un rating ESTRICTAMENTE mayor al umbral.
      - Se calcula el promedio de ratings de los vecinos que cumplen la condición.

    Retorna:
        Lista de recomendaciones ordenada por promedio descendente.
    """
    if user_id not in ratings_dict:
        return []

    peliculas_vistas = set(ratings_dict[user_id].keys())
    acumulador = {}

    for vecino in vecinos:
        vid = vecino["userId"]
        if vid not in ratings_dict:
            continue

        for pelicula_id, rating in ratings_dict[vid].items():
            if pelicula_id in peliculas_vistas:
                continue
            if rating <= umbral:
                continue

            if pelicula_id not in acumulador:
                acumulador[pelicula_id] = []
            acumulador[pelicula_id].append((vid, rating))

    if not acumulador:
        return []

    recomendaciones = []
    for pelicula_id, votos in acumulador.items():
        ratings_validos = [r for _, r in votos]
        promedio = sum(ratings_validos) / len(ratings_validos)

        recomendaciones.append({
            "movieId":      int(pelicula_id),
            "title":        title_lookup.get(pelicula_id, f"Movie {pelicula_id}"),
            "avgRating":    round(promedio, 4),
            "numVotes":     len(ratings_validos),
            "recommenders": [int(uid) for uid, _ in votos],
        })

    return sorted(recomendaciones, key=lambda x: (-x["avgRating"], -x["numVotes"]))


# ─── NUEVO: Influencer + Match ─────────────────────────────────────────────────

@app.route("/api/influencer", methods=["POST"])
def influencer_recommend():
    """Modo influencer: un usuario influye a sus K vecinos más cercanos.
    Recomienda películas que el influencer valora > threshold y que los vecinos no han visto.
    """
    cuerpo = request.get_json(force=True)
    influencer_id = int(cuerpo.get("influencerId", 0))
    k = max(1, int(cuerpo.get("k", 5)))
    metrica = cuerpo.get("metric", "manhattan")
    umbral = float(cuerpo.get("threshold", 3.5))

    if influencer_id not in ratings_dict:
        return jsonify({"error": "Influencer no encontrado"}), 404

    # Obtener vecinos más cercanos al influencer
    distancias = calcular_distancias(influencer_id, metrica)
    if distancias is None:
        return jsonify({"error": "Error calculando distancias"}), 500

    vecinos = distancias[:k]

    # Películas que el influencer ha valorado alto (> umbral)
    ratings_influencer = ratings_dict[influencer_id]
    peliculas_influencer_alto = {mid for mid, rat in ratings_influencer.items() if rat > umbral}

    # Acumular recomendaciones
    acumulador = {}

    for vecino in vecinos:
        vid = vecino["userId"]
        if vid not in ratings_dict:
            continue
        peliculas_vistas_vecino = set(ratings_dict[vid].keys())
        candidatas = peliculas_influencer_alto - peliculas_vistas_vecino
        for mid in candidatas:
            if mid not in acumulador:
                acumulador[mid] = []
            acumulador[mid].append((vid, ratings_influencer[mid]))

    recomendaciones = []
    for mid, votos in acumulador.items():
        ratings_inf = [r for _, r in votos]
        promedio = sum(ratings_inf) / len(ratings_inf)
        recomendaciones.append({
            "movieId": int(mid),
            "title": title_lookup.get(mid, f"Movie {mid}"),
            "avgRating": round(promedio, 4),
            "numVotes": len(votos),
            "influencerRating": ratings_influencer[mid],
        })

    recomendaciones.sort(key=lambda x: (-x["avgRating"], -x["numVotes"]))

    return jsonify({
        "influencerId": influencer_id,
        "influencerName": user_names.get(str(influencer_id), f"User {influencer_id}"),
        "k": k,
        "metric": metrica,
        "neighbors": vecinos,
        "recommendations": recomendaciones[:50]
    })


@app.route("/api/match", methods=["POST"])
def match_users():
    """Modo match: compara dos usuarios específicos y recomienda películas
    que el primero (influencer) ha valorado alto y el segundo no ha visto.
    """
    cuerpo = request.get_json(force=True)
    user_a = int(cuerpo.get("userA", 0))
    user_b = int(cuerpo.get("userB", 0))
    metrica = cuerpo.get("metric", "manhattan")
    umbral = float(cuerpo.get("threshold", 3.5))

    if user_a not in ratings_dict or user_b not in ratings_dict:
        return jsonify({"error": "Uno o ambos usuarios no existen"}), 404

    ratings_a = ratings_dict[user_a]
    ratings_b = ratings_dict[user_b]

    if metrica == "manhattan":
        dist, comunes = distancia_manhattan(ratings_a, ratings_b)
    else:
        dist, comunes = distancia_euclidiana(ratings_a, ratings_b)

    peliculas_vistas_b = set(ratings_b.keys())
    peliculas_alto_a = {mid for mid, rat in ratings_a.items() if rat > umbral}
    candidatas = peliculas_alto_a - peliculas_vistas_b

    recomendaciones = []
    for mid in candidatas:
        recomendaciones.append({
            "movieId": int(mid),
            "title": title_lookup.get(mid, f"Movie {mid}"),
            "influencerRating": ratings_a[mid],
        })

    recomendaciones.sort(key=lambda x: -x["influencerRating"])

    return jsonify({
        "userA": user_a,
        "userAName": user_names.get(str(user_a), f"User {user_a}"),
        "userB": user_b,
        "userBName": user_names.get(str(user_b), f"User {user_b}"),
        "distance": round(dist, 6),
        "commonMovies": comunes,
        "metric": metrica,
        "recommendations": recomendaciones[:50]
    })


@app.route("/api/complexity", methods=["GET"])
def get_complexity():
    """Devuelve métricas de complejidad computacional."""
    global load_times

    # Tamaño en memoria estimado
    num_users = len(ratings_dict)
    total_ratings = sum(len(v) for v in ratings_dict.values())
    mem_estimate_bytes = total_ratings * 72 + num_users * 56
    mem_mb = mem_estimate_bytes / (1024 * 1024)

    # Medir tiempo de distancias en caliente
    sample_user = next(iter(ratings_dict.keys())) if ratings_dict else None
    time_mh = 0.0
    time_eu = 0.0
    time_rec = 0.0

    if sample_user:
        start = time.perf_counter()
        _ = calcular_distancias(sample_user, "manhattan")
        time_mh = (time.perf_counter() - start) * 1000

        start = time.perf_counter()
        _ = calcular_distancias(sample_user, "euclidean")
        time_eu = (time.perf_counter() - start) * 1000

        dists = calcular_distancias(sample_user, "manhattan")
        if dists:
            start = time.perf_counter()
            _ = obtener_recomendaciones(sample_user, dists[:5], 3.0)
            time_rec = (time.perf_counter() - start) * 1000

    # Hardware
    cpu_name = platform.processor()
    if not cpu_name:
        cpu_name = platform.machine()
    ram_gb = round(psutil.virtual_memory().total / (1024**3), 1)
    os_info = f"{platform.system()} {platform.release()}"

    return jsonify({
        "load_times": {
            "ratings_ms": round(load_times.get("ratings_ms", 0), 2),
            "movies_ms": round(load_times.get("movies_ms", 0), 2),
        },
        "memory_mb": round(mem_mb, 2),
        "total_users": num_users,
        "total_ratings": total_ratings,
        "distance_time_ms": {
            "manhattan": round(time_mh, 4),
            "euclidean": round(time_eu, 4),
        },
        "recommendation_time_ms": round(time_rec, 4),
        "precision_decimals": 4,
        "hardware": {
            "cpu": cpu_name or "Desconocido",
            "ram_gb": ram_gb,
            "os": os_info,
            "python_version": sys.version.split()[0],
        },
        "knn_parameters": {
            "param1_similarity": "K vecinos más similares (Manhattan/Euclidean)",
            "param2_influencer": "Influencer → K usuarios cercanos",
            "param3_match": "Match directo entre 2 usuarios",
        }
    })


# ─── Rutas Flask existentes ───────────────────────────────────────────────────

@app.route("/")
def index():
    """Página principal — sirve el frontend."""
    return render_template("index.html")


@app.route("/api/users", methods=["GET"])
def get_users():
    """Devuelve la lista de todos los usuarios disponibles."""
    usuarios = [
        {"userId": uid, "name": user_names.get(str(uid), f"User {uid}")}
        for uid in sorted(ratings_dict.keys())
    ]
    return jsonify(usuarios)


@app.route("/api/movies", methods=["GET"])
def get_movies():
    """Devuelve el catálogo completo de películas."""
    return jsonify(movies_list)


@app.route("/api/knn", methods=["POST"])
def knn():
    """Calcula los K vecinos más cercanos para un usuario usando ambas métricas."""
    cuerpo  = request.get_json(force=True)
    user_id = int(cuerpo.get("userId", 0))
    k       = max(1, int(cuerpo.get("k", 5)))

    distancias_mh = calcular_distancias(user_id, "manhattan")
    distancias_eu = calcular_distancias(user_id, "euclidean")

    if distancias_mh is None:
        return jsonify({"error": "Usuario no encontrado"}), 404

    return jsonify({
        "manhattan": distancias_mh[:k],
        "euclidean": distancias_eu[:k],
    })


@app.route("/api/recommend", methods=["POST"])
def recommend():
    """Calcula películas recomendadas a partir de los K vecinos más cercanos."""
    cuerpo  = request.get_json(force=True)
    user_id = int(cuerpo.get("userId", 0))
    k       = max(1, int(cuerpo.get("k", 5)))
    metrica = cuerpo.get("metric", "manhattan")
    umbral  = float(cuerpo.get("threshold", 3.0))

    distancias = calcular_distancias(user_id, metrica)
    if distancias is None:
        return jsonify({"error": "Usuario no encontrado"}), 404

    vecinos         = distancias[:k]
    recomendaciones = obtener_recomendaciones(user_id, vecinos, umbral)

    return jsonify({"neighbors": vecinos, "recommendations": recomendaciones})


@app.route("/api/users", methods=["POST"])
def create_user():
    """Crea un nuevo usuario con sus valoraciones de películas."""
    global next_user_id

    cuerpo      = request.get_json(force=True)
    nombre      = cuerpo.get("name", "").strip()
    raw_ratings = cuerpo.get("ratings", [])

    if not nombre:
        return jsonify({"error": "El nombre es requerido"}), 400
    if not raw_ratings:
        return jsonify({"error": "Debe agregar al menos una valoración"}), 400

    nuevo_id = next_user_id
    next_user_id += 1

    user_names[str(nuevo_id)] = nombre
    with open(NAMES_PATH, "w", encoding="utf-8") as f:
        json.dump(user_names, f, ensure_ascii=False)

    filas = [
        {"userId": nuevo_id, "movieId": int(r["movieId"]), "rating": float(r["rating"])}
        for r in raw_ratings
        if 1 <= float(r.get("rating", 0)) <= 5
    ]

    if not filas:
        return jsonify({"error": "Valoraciones inválidas (rango 1-5)"}), 400

    nuevo_df = pd.DataFrame(filas)
    if os.path.exists(CUSTOM_PATH):
        existente = pd.read_csv(CUSTOM_PATH)
        nuevo_df  = pd.concat([existente, nuevo_df], ignore_index=True)
    nuevo_df.to_csv(CUSTOM_PATH, index=False)

    cargar_datos()

    return jsonify({"userId": nuevo_id, "name": nombre, "ratingsAdded": len(filas)})


if __name__ == "__main__":
    app.run(debug=True, port=5000)