# Clustering

## Qué hice

- Evalué el vector de características usado para la proyección del espacio latente.
- Añadí clustering funcional en la pestaña **Espacio Latente** usando:
  - `KMeans` (clusterización por número fijo de clusters)
  - `DBSCAN` (clusterización basada en densidad y ruido)
- Mejoré la interfaz con descripciones, leyendas y un control más explícito de parámetros.

## Vector de características

El espacio latente se construye a partir del mismo vector numérico usado para KNN:
- `knn_cols` son las columnas de estadísticas históricas de equipo para Radiant y Dire.
- Se excluyen columnas de héroes (`hero_<ID>_avg_r/d`) y metadatos no predictivos como fecha o año.
- Esto da un vector de aproximadamente **66 características** por partida: 33 métricas para Radiant y 33 para Dire.

### Por qué se usa este vector

- Captura el rendimiento histórico de cada equipo antes de la partida.
- Usa estadísticas agregadas como GPM, XPM, KDA, kills, muertes, visión y objetivos.
- Es coherente con la lógica de KNN ya existente en el proyecto.
- Se estandariza con `StandardScaler` antes de proyectar y clusterizar.

## Clustering en la proyección 2D

### Backend

- El endpoint `/api/espacio-latente` ahora acepta parámetros de clustering:
  - `cluster_method`: `kmeans` o `dbscan`
  - `cluster_k`: número de clusters para KMeans
  - `cluster_eps`: radio para DBSCAN
  - `cluster_min_samples`: puntos mínimos para DBSCAN
- El backend proyecta los datos a 2D con:
  - `PCA`
  - `UMAP` (si está disponible)
  - `t-SNE`
- Luego aplica clustering sobre los puntos proyectados en 2D.
- Cada punto devuelto incluye ahora la etiqueta `cluster`.

### Frontend

- La pestaña **Espacio Latente** ahora tiene controles para:
  - seleccionar método de proyección (`PCA`, `UMAP`, `t-SNE`)
  - elegir número de muestras
  - seleccionar método de clustering (`KMeans`, `DBSCAN`)
  - ajustar `K` para KMeans
  - ajustar `eps` y `minPts` para DBSCAN
  - elegir el atributo de color para el Panel 3
- Se agregó la opción de colorear Panel 3 por **Clusters 2D**.
- La leyenda del scatter muestra los clusters detectados o, en su defecto, los bandos `Radiant / Dire`.
- El texto de metadatos muestra la configuración activa de clustering y cuántos clusters se detectaron.

## Cómo se representa

### Panel 1

- Muestra la proyección del espacio latente coloreada por el ganador de la partida.
- Permite seleccionar puntos individuales y múltiples.
- Tiene soporte para selección rectangular con `Shift + arrastre`.

### Panel 3

- Muestra la misma proyección pero coloreada por el atributo seleccionado.
- Ahora incluye la opción `Clusters 2D` para visualizar el resultado de KMeans/DBSCAN.
- Para `KMeans`, cada cluster recibe un color distinto.
- Para `DBSCAN`, los puntos de ruido aparecen con color oscuro y los clusters con colores separados.

### Panel 2 y Panel 4

- Panel 2 muestra comparación de métricas `Radiant vs Dire` para el punto o la selección.
- Panel 4 muestra el vector completo de atributos del punto seleccionado o el promedio de la selección múltiple.

## Notas importantes

- El clustering se aplica sobre la proyección 2D resultante, no sobre el vector original de 66 dimensiones.
- Esto hace que los clusters reflejen la estructura visual en el plano, útil para explorar agrupamientos locales.
- El proyecto ya tenía KNN funcional en la pestaña de `Partidas Similares`; la novedad aquí es que ahora también hay una capa de clustering visual.

## Archivos modificados

- `app.py`
  - Añadí `KMeans` y `DBSCAN` a la API de espacio latente.
  - Incluí parámetros de clustering y etiquetas `cluster` para cada punto.
  - Añadí metadatos de features y configuración de clustering.
- `templates/index.html`
  - Añadí controles para elegir método de clustering y parámetros.
  - Añadí la opción de colorear por `Clusters 2D`.
- `static/js/app.js`
  - Añadí lectura de parámetros de clustering.
  - Añadí soporte para leyendas de clusters categóricos.
  - Mejoré la metainformación mostrada al usuario.

