"""
Sistema de Recomendación de Películas — KNN (Manhattan y Euclidiana)
Backend Flask: lógica de distancias implementada desde cero sin librerías externas.
"""
from __future__ import annotations

import os
import json
import math
import pandas as pd
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


# ─── Carga de datos ────────────────────────────────────────────────────────────

def cargar_datos():
    """Carga los CSV de ratings y películas (Polars si disponible, si no Pandas).
    Construye el diccionario de ratings para el cálculo de distancias."""
    global ratings_dict, title_lookup, movies_list, user_names, next_user_id

    # Intentar con Polars para carga rápida; caer en Pandas si no está instalado
    try:
        import polars as pl
        df_ratings = pl.read_csv(RATINGS_PATH, columns=["userId", "movieId", "rating"]).to_pandas()
        df_movies  = pl.read_csv(MOVIES_PATH).to_pandas()
    except ImportError:
        df_ratings = pd.read_csv(RATINGS_PATH, usecols=["userId", "movieId", "rating"])
        df_movies  = pd.read_csv(MOVIES_PATH)

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
    # Se itera fila a fila para no depender de operaciones de agregación de pandas
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
            # Diferencia absoluta entre los dos ratings para esta película
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
            # Elevar al cuadrado y acumular
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
            continue  # no comparar al usuario consigo mismo

        # Calcular distancia según la métrica seleccionada
        if metrica == "manhattan":
            distancia, comunes = distancia_manhattan(ratings_usuario, ratings_vecino)
        else:
            distancia, comunes = distancia_euclidiana(ratings_usuario, ratings_vecino)

        # Solo incluir vecinos que compartan al menos una película valorada
        if comunes > 0:
            resultados.append({
                "userId":       otro_id,
                "name":         user_names.get(str(otro_id), f"User {otro_id}"),
                "distance":     round(distancia, 4),
                "commonMovies": comunes,
            })

    # Ordenar de menor (más cercano) a mayor (más lejano)
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

    # Conjunto de películas que el usuario ya ha visto (se excluyen de la recomendación)
    peliculas_vistas = set(ratings_dict[user_id].keys())

    # Acumular ratings de vecinos para películas no vistas por el usuario principal
    # Estructura: {movieId: [(vecino_id, rating), ...]}
    acumulador = {}

    for vecino in vecinos:
        vid = vecino["userId"]
        if vid not in ratings_dict:
            continue

        for pelicula_id, rating in ratings_dict[vid].items():
            # Omitir si el usuario principal ya vio esta película
            if pelicula_id in peliculas_vistas:
                continue
            # Omitir si el rating del vecino no supera el umbral establecido
            if rating <= umbral:
                continue

            if pelicula_id not in acumulador:
                acumulador[pelicula_id] = []
            acumulador[pelicula_id].append((vid, rating))

    if not acumulador:
        return []

    # Construir lista final de recomendaciones con promedio y cantidad de votos
    recomendaciones = []
    for pelicula_id, votos in acumulador.items():
        ratings_validos = [r for _, r in votos]
        promedio = sum(ratings_validos) / len(ratings_validos)

        recomendaciones.append({
            "movieId":      int(pelicula_id),
            "title":        title_lookup.get(pelicula_id, f"Movie {pelicula_id}"),
            "avgRating":    round(promedio, 2),
            "numVotes":     len(ratings_validos),
            "recommenders": [int(uid) for uid, _ in votos],
        })

    # Ordenar por promedio descendente; en empate, por cantidad de votos descendente
    return sorted(recomendaciones, key=lambda x: (-x["avgRating"], -x["numVotes"]))


# ─── Rutas Flask ───────────────────────────────────────────────────────────────

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

    # Guardar el nombre del nuevo usuario en el archivo JSON
    user_names[str(nuevo_id)] = nombre
    with open(NAMES_PATH, "w", encoding="utf-8") as f:
        json.dump(user_names, f, ensure_ascii=False)

    # Validar y construir filas de ratings (solo ratings entre 1 y 5)
    filas = [
        {"userId": nuevo_id, "movieId": int(r["movieId"]), "rating": float(r["rating"])}
        for r in raw_ratings
        if 1 <= float(r.get("rating", 0)) <= 5
    ]

    if not filas:
        return jsonify({"error": "Valoraciones inválidas (rango 1-5)"}), 400

    # Persistir ratings en el CSV de usuarios personalizados
    nuevo_df = pd.DataFrame(filas)
    if os.path.exists(CUSTOM_PATH):
        existente = pd.read_csv(CUSTOM_PATH)
        nuevo_df  = pd.concat([existente, nuevo_df], ignore_index=True)
    nuevo_df.to_csv(CUSTOM_PATH, index=False)

    # Recargar todos los datos para que el usuario aparezca de inmediato
    cargar_datos()

    return jsonify({"userId": nuevo_id, "name": nombre, "ratingsAdded": len(filas)})


if __name__ == "__main__":
    app.run(debug=True, port=5000)
