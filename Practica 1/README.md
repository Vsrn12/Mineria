# KNN Movie Recommender

Sistema de recomendación de películas en local usando el algoritmo K-Nearest Neighbors con distancias Manhattan y Euclidiana.

---

## Requisitos

- Python 3.10+
- `ratings.csv` y `movies.csv` en la misma carpeta que `app.py`

## Instalación

```bash
pip install -r requirements.txt
```

## Arrancar

```bash
python app.py
```

Abre http://localhost:5000 en tu navegador.

---

## Archivos

| Archivo | Descripción |
|---|---|
| `app.py` | Backend Flask — lógica KNN, recomendaciones y API REST |
| `templates/index.html` | Frontend single-page (Bootstrap 5 + Vanilla JS) |
| `ratings.csv` | Dataset de valoraciones (userId, movieId, rating, timestamp) |
| `movies.csv` | Catálogo de películas (movieId, title, genres) |
| `custom_ratings.csv` | Generado automáticamente al crear usuarios nuevos |
| `user_names.json` | Generado automáticamente — mapeo userId → nombre |

---

## Funciones principales

### `load_data()`
Carga `ratings.csv` y `movies.csv` (con Polars si está instalado, si no con Pandas), fusiona los ratings personalizados y construye la **matriz pivote** usuario × película.

### `compute_distances(user_id, metric)`
Calcula la distancia entre `user_id` y **todos los demás usuarios** de forma **vectorizada** con Pandas.
- Sólo cuenta las películas valoradas por **ambos** usuarios (películas comunes).
- `metric='manhattan'` → Σ |a − b|
- `metric='euclidean'` → √( Σ (a−b)² )
- Devuelve lista ordenada de menor a mayor distancia.

### `get_recommendations(user_id, neighbors, threshold=3.0)`
A partir de la lista de `neighbors` (resultado de KNN):
1. Extrae las películas que `user_id` **no ha visto**.
2. Filtra las valoraciones de los vecinos sobre esas películas.
3. Descarta las valoraciones ≤ `threshold` (por defecto 3.0).
4. Calcula la media y el número de votos por película.
5. Devuelve lista ordenada por valoración media descendente.

---

## API Endpoints

| Método | Ruta | Descripción |
|---|---|---|
| GET | `/` | Sirve la página web |
| GET | `/api/users` | Lista todos los usuarios |
| GET | `/api/movies` | Lista todas las películas |
| POST | `/api/knn` | Calcula los K vecinos más cercanos (Manhattan y Euclidean) |
| POST | `/api/recommend` | Calcula películas recomendadas por Influencer |
| POST | `/api/users` | Crea un nuevo usuario con sus valoraciones |

### POST `/api/knn`
```json
{ "userId": 1, "k": 8 }
```
Respuesta:
```json
{
  "manhattan": [{ "userId": 42, "name": "User 42", "distance": 12.5, "commonMovies": 30 }, ...],
  "euclidean": [...]
}
```

### POST `/api/recommend`
```json
{ "userId": 1, "k": 8, "metric": "manhattan", "threshold": 3.0 }
```
Respuesta:
```json
{
  "neighbors": [...],
  "recommendations": [{ "movieId": 318, "title": "Shawshank Redemption", "avgRating": 4.8, "numVotes": 5, "recommenders": [42, 77, ...] }, ...]
}
```

### POST `/api/users`
```json
{ "name": "Ana Torres", "ratings": [{ "movieId": 1, "rating": 5 }, { "movieId": 318, "rating": 4 }] }
```

---

## Flujo de uso

1. **KNN & Recomendaciones** — selecciona un usuario, pon el número K de vecinos y la métrica principal. Pulsa **Buscar Vecinos** para ver las dos tablas (Manhattan & Euclidean) ordenadas de más cercano a más lejano. Luego pulsa **Influencer** para ver las películas recomendadas.

2. **Crear Usuario** — escribe un nombre, busca películas, asigna estrellas (1-5) y pulsa **Crear Usuario**. El nuevo usuario queda disponible inmediatamente en el selector KNN.

---

## Rendimiento

- La carga inicial usa **Polars** para parsear los CSV (~100k filas en < 200 ms).
- El cálculo de distancias es completamente **vectorizado** con Pandas/NumPy — sin bucles Python por usuario.
- La matriz pivote se construye una sola vez al arrancar y se reconstruye sólo cuando se crea un nuevo usuario.
