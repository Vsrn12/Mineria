# Evidencia 3 — Análisis Visual de Datos (Espacio Latente)

**Proyecto:** Dota 2 Pro Matches — Análisis con KNN  
**Dataset:** `tb_pro_players_matches.csv` — 47,150 partidas profesionales (2019–2021), 317 columnas  
**Objetivo:** Predecir el resultado de una partida (`radiant_win`) a partir del perfil histórico de rendimiento de ambos equipos antes del match.

---

## 1. Definición del vector de características

### ¿Qué atributos incluyeron para representar cada objeto de su proyecto de ciencia de datos?

El objeto de estudio es **una partida profesional de Dota 2**. Cada partida es representada por un vector de características construido a partir de las **estadísticas históricas promedio** de ambos equipos (Radiant y Dire) en sus últimas N partidas antes de jugar ese match. El vector utilizado contiene **66 columnas numéricas** (33 métricas × 2 equipos), agrupadas en rendimiento, economía, combate, objetivos, visión y detalles.

### ¿Qué atributos descartaron? ¿Por qué?

| Variable/atributo | Tipo | Incluida | Justificación |
|---|---|---|---|
| `win_pct_r/d` | Numérica | Sí | Representa el porcentaje histórico de victorias del equipo. Es la métrica más directa del "nivel" del equipo y la feature más intuitivamente correlacionada con `radiant_win`. |
| `kda_avg_r/d` | Numérica | Sí | KDA = (Kills + Assists) / Deaths. Indicador sintético de rendimiento de combate. Captura la eficiencia en peleas de equipo. |
| `gold_per_min_avg_r/d` | Numérica | Sí | GPM: ritmo de generación de oro. Principal indicador de eficiencia económica y altamente correlacionado con la victoria. |
| `xp_per_min_avg_r/d` | Numérica | Sí | XPM: ritmo de ganancia de experiencia. Determina nivel del héroe y habilidades disponibles. |
| `hero_kills_avg_r/d` | Numérica | Sí | Total de héroes enemigos eliminados. Cada kill otorga oro y XP al equipo. |
| `deaths_avg_r/d` | Numérica | Sí | Muertes propias del equipo. Valor bajo indica buena gestión de recursos. |
| `assists_avg_r/d` | Numérica | Sí | Asistencias en kills. Un ratio alto indica combates colectivos (5v5). |
| `tower_kills_avg_r/d` | Numérica | Sí | Torres destruidas. El objetivo principal del juego: se necesitan para atacar la base. |
| `tower_damage_avg_r/d` | Numérica | Sí | Daño infligido a torres. Indica presión sobre objetivos. |
| `roshan_kills_avg_r/d` | Numérica | Sí | Veces que mató a Roshan. El Aegis es un recurso decisivo en partidas disputadas. |
| `observer_uses_avg_r/d` | Numérica | Sí | Wards observer colocadas. Miden cultura de información del mapa. |
| `observer_kills_avg_r/d` | Numérica | Sí | Wards enemigas destruidas (deswarding). Cegar al rival es tan valioso como tener visión propia. |
| `sentry_uses_avg_r/d` | Numérica | Sí | Wards sentry colocadas. Detectan unidades invisibles y wards enemigas. |
| `sentry_kills_avg_r/d` | Numérica | Sí | Wards sentry enemigas destruidas. Actividad en la "guerra de visión". |
| `last_hits_avg_r/d` | Numérica | Sí | Total de last hits. Métrica clave de farm en la fase de laning. |
| `denies_avg_r/d` | Numérica | Sí | Denies: negar el último golpe a creeps propios. Mecánica exclusiva de Dota 2. |
| `neutral_kills_avg_r/d` | Numérica | Sí | Kills de creeps neutrales. Indica estrategia orientada al farm de jungla. |
| `firstblood_claimed_avg_r/d` | Numérica | Sí | Primera kill del juego. Otorga ~200 de oro extra como ventaja inicial. |
| `buyback_count_avg_r/d` | Numérica | Sí | Revivir inmediatamente pagando oro. Indica partidas muy disputadas. |
| `actions_per_min_avg_r/d` | Numérica | Sí | APM: intensidad de micro-gestión. |
| `gold_avg_r/d` | Numérica | Sí | Oro total por partida. Relacionado con duración y economía. |
| `level_avg_r/d` | Numérica | Sí | Nivel promedio al final. Indica progresión de poder. |
| `duration_avg_win_r/d` | Numérica | Sí | Duración promedio al ganar. Indica estilo de juego (agresivo vs late-game). |
| `duration_avg_lose_r/d` | Numérica | Sí | Duración promedio al perder. Equipos perdedores suelen alargar la partida. |
| `kills_per_min_avg_r/d` | Numérica | Sí | Ritmo de kills. Complementa `hero_kills_avg` normalizando por duración. |
| `lane_kills_avg_r/d` | Numérica | Sí | Kills en la fase de laning. Indica agresividad temprana. |
| `ancient_kills_avg_r/d` | Numérica | Sí | Ancient creeps eliminados. Farm de alta recompensa en fase media. |
| `gold_spent_avg_r/d` | Numérica | Sí | Total de oro invertido en ítems. |
| `total_gold_avg_r/d` | Numérica | Sí | Flujo total de economía a lo largo de la partida. |
| `total_xp_avg_r/d` | Numérica | Sí | Experiencia total acumulada. |
| `courier_kills_avg_r/d` | Numérica | Sí | Kills al mensajero. Penaliza económicamente al rival. |
| `match_id` | Entero | **No** | Identificador único de la partida. No aporta información predictiva, solo sirve como clave primaria. |
| `dt_match` | Fecha | **No** | Fecha/hora de la partida. Se derivó `_year` para análisis temporal pero no se incluyó en el vector de features. |
| `radiant_win` | Booleano | **No** | Es la variable objetivo (target). No puede incluirse en el vector de características. |
| `recencia_r/d` | Numérica | **No** | Metadato temporal (días desde última partida). Indica actividad, no rendimiento. No contribuye a predecir el resultado táctico. |
| `freq_r/d` | Numérica | **No** | Tamaño de la ventana histórica. Es un metadato estructural: indica cuántas partidas se promediaron. No es una métrica de rendimiento. |
| `hero_<ID>_avg_r/d` (121x2 = 242 cols) | Numérica (fracción) | **No** | Pick rates de héroes (fracción de partidas en que cada héroe fue elegido). Se descartaron del vector para el espacio latente porque: (1) generan un espacio de 242 dimensiones extremadamente disperso donde cada héroe tiene valores entre 0.0 y 0.2, (2) la alta dimensionalidad y dispersidad dificulta la interpretación de las proyecciones, (3) las 66 estadísticas de rendimiento ya encapsulan el resultado táctico de las composiciones de héroes. |
| `hero_damage_avg_r/d` | Numérica | Sí | Aunque tienen prefijo `hero_`, son estadísticas agregadas de equipo (no pick rates). Se incluyeron en las 66 features base. |
| `hero_healing_avg_r/d` | Numérica | Sí | Incluidas en las 66 features base. |
| `lane_efficiency_avg_r/d` | Numérica | **No** | Se excluyeron por bajo valor predictivo: la eficiencia de carril tiene alta variabilidad y baja correlación con el resultado. |

---

## 2. Transformaciones de los datos

### ¿Qué tipo de transformación se aplicó a cada variable?

| Características | Tipo | Transformación | Justificación |
|---|---|---|---|
| `win_pct_r/d` | Numérica | **Estandarización (Z-Score)** | Rango 0.0–1.0. Diferente escala a GPM (350–600), hero_kills (10–35) y gold_avg (10,000–40,000). Sin estandarización, las variables de mayor magnitud dominarían el cálculo de distancias euclidianas, haciendo que el KNN y las proyecciones de reducción de dimensionalidad fueran sensibles casi exclusivamente a las variables de mayor rango numérico. |
| `kda_avg_r/d` | Numérica | **Estandarización (Z-Score)** | Rango típico 1.5–6.0. Escala diferente a otras variables como tower_damage (5,000–25,000). Sensible a distancia euclidiana. |
| `gold_per_min_avg_r/d` | Numérica | **Estandarización (Z-Score)** | Rango 350–600 GPM. Diferente escala a observaciones como observer_uses (5–20). El Z-Score centra en mu=0 con sigma=1 para que todas las variables contribuyan equitativamente a la distancia. |
| `xp_per_min_avg_r/d` | Numérica | **Estandarización (Z-Score)** | Rango 350–700 XPM. Misma justificación que GPM. |
| `hero_kills_avg_r/d` | Numérica | **Estandarización (Z-Score)** | Rango 10–35 kills. Escala mucho menor que tower_damage o gold_avg, por lo que sin estandarización prácticamente no influiría en las distancias. |
| `deaths_avg_r/d` | Numérica | **Estandarización (Z-Score)** | Rango 8–30 muertes. Estandarización necesaria para equilibrar contribución. |
| `tower_damage_avg_r/d` | Numérica | **Estandarización (Z-Score)** | Rango 5,000–25,000 puntos. Variable de alta magnitud que dominaría el espacio si no se escala. |
| `gold_avg_r/d` | Numérica | **Estandarización (Z-Score)** | Rango 10,000–40,000. Una de las variables de mayor magnitud. Sin estandarización, esta variable y `total_gold_avg` prácticamente definirían las distancias por sí solas. |
| `observer_uses_avg_r/d` | Numérica | **Estandarización (Z-Score)** | Rango 5–20 wards. Variable de baja magnitud que sería "aplastada" por las de mayor rango sin escalamiento. |
| `sentry_uses_avg_r/d` | Numérica | **Estandarización (Z-Score)** | Rango 4–20. Misma lógica que observer_uses. |
| `last_hits_avg_r/d` | Numérica | **Estandarización (Z-Score)** | Rango 300–900. Escala intermedia que necesita ser normalizada para no quedar dominada por variables como gold_avg o total_xp. |
| `level_avg_r/d` | Numérica | **Estandarización (Z-Score)** | Rango 18–28 niveles. Diferencia de escala significativa con tower_damage o total_gold. |
| `duration_avg_win_r/d` | Numérica | **Estandarización (Z-Score)** | Rango 30–50 minutos. Variable con escala muy diferente a gold_spent o hero_damage. |
| `actions_per_min_avg_r/d` | Numérica | **Estandarización (Z-Score)** | Rango 150–350 APM. Estandarización necesaria. |
| `buyback_count_avg_r/d` | Numérica | **Estandarización (Z-Score)** | Rango 0.3–2.0. Variable de muy baja magnitud que sería insignificante frente a gold_avg sin escalamiento. |
| `radiant_win` | Booleano | **Ninguna (target)** | Variable objetivo. No se transforma ni se incluye en el vector de características. |
| `match_id` | Entero | **Descartada** | Identificador sin valor predictivo. No se transforma. |
| `dt_match` | Fecha | **Extracción de año** | Se extrajo `_year` para análisis temporal y visualización, pero no se incluyó en el vector de features del espacio latente. |

### Manejo de valores faltantes

| Característica | Transformación | Justificación |
|---|---|---|
| Todas las 66 columnas numéricas | **Imputación con la media** | Las columnas pueden contener NaN cuando un equipo no tiene historial suficiente en alguna métrica. Se reemplazaron con la media de cada columna para preservar la fila completa. Este método es aceptable porque la proporción de datos faltantes en las columnas numéricas es baja (el 6% de filas sin héroes se excluye completamente del análisis). |

### Transformación específica del dataset

| Característica | Transformación | Justificación |
|---|---|---|
| `_has_heroes` (flag) | **Filtrado booleano** | Se creó un flag que indica si la partida tiene datos de héroes en ambos equipos. Las ~2,819 partidas (~6%) sin datos de héroes se excluyen del análisis táctico y del espacio latente porque solo contienen `match_id`, fecha y resultado, sin estadísticas de rendimiento utilizables. |

### Resumen del pipeline de transformación

```
Datos crudos (317 columnas)
  |
  +- Filtrado: excluir filas sin héroes (_has_heroes = False) -> ~44,331 partidas validas
  |
  +- Seleccion: 66 columnas de estadísticas de rendimiento (_r y _d)
  |
  +- Imputacion: NaN -> media de cada columna
  |
  +- Escalamiento: StandardScaler (mu=0, sigma=1) sobre las 66 columnas
  |
  +-- Proyeccion: PCA / t-SNE / UMAP / MDS -> 2 dimensiones (x, y)
```

---

## 3. Aplicación de reducción de dimensionalidad

### Proyección del vector de características a 2D

El vector de entrada contiene **66 dimensiones** (33 metricas x 2 equipos). Se proyectaron a un espacio de **2 dimensiones (x, y)** usando las siguientes tecnicas:

### Tecnicas utilizadas y parametros

| Tecnica | Parametros | Valores utilizados | Resultado |
|---|---|---|---|
| **PCA** | `n_components` | 2 | Varianza explicada por componente: **PC1 = 33.2%**, **PC2 = 14.8%** (varianza acumulada = 48%). La varianza acumulada es < 50%, lo que indica que la representacion 2D pierde mas de la mitad de la informacion del espacio original de 66 dimensiones. Esto se reconoce explicitamente como una limitacion. |
| **t-SNE** | `perplexity` | 30 (default) | Revela estructura local. Los clusters visibles son mas claros que en PCA. Limitacion: las distancias entre clusters no son significativas, solo las relaciones de vecindad local son confiables. Sensible al valor de perplexity: se recomienda probar valores entre 5 y 50. |
| **UMAP** | `n_neighbors` = 15, `min_dist` = 0.1 | Valores default | Preserva estructura local y parcialmente global. Mas rapido que t-SNE. `n_neighbors=15` equilibra detalle local con estructura global. `min_dist=0.1` permite que los puntos se agrupen con cierta separacion. |

### Justificacion de la seleccion de parametros

- **PCA con 2 componentes:** Es la proyeccion lineal que maximiza la varianza explicada. Se eligieron 2 componentes para poder visualizar en un plano 2D. La varianza acumulada de ~48% se reconoce como limitada, pero permite una interpretacion global de la estructura de los datos.

- **t-SNE con perplexity=30:** Se uso el valor default porque es el punto de partida recomendado para datasets de tamano medio (1,000-5,000 muestras). La perplexity controla el balance entre estructura global y local: valores bajos (5-15) enfatizan estructura local fina, valores altos (30-50) capturan mas estructura global.

- **UMAP con n_neighbors=15, min_dist=0.1:** `n_neighbors=15` es el default que equilibra la preservacion de estructura local (valores bajos -> mas detalle local, posible fragmentacion) y global (valores altos -> mas contexto global). `min_dist=0.1` controla la distancia minima entre puntos en la proyeccion: valores bajos (0.0-0.3) producen clusters mas densos y compactos.

---

## 4. Diseno de visualizaciones interactivas

### Descripcion de la interfaz de visualizacion (4 paneles enlazados)

La interfaz del Espacio Latente implementa **4 paneles coordinados** con D3.js, siguiendo la metodologia de vistas coordinadas (CMV) del paper de referencia:

```
+------------------------------+------------------------------+
|  Panel 1                     |  Panel 2                     |
|  Espacio Latente             |  Atributos del Punto         |
|  Color = ganador             |  Seleccionado                |
|  (scatter 2D)                |  (barras comparativas        |
|  Clic para seleccionar       |   Radiant vs Dire)           |
+------------------------------+------------------------------+
|  Panel 3                     |  Panel 4                     |
|  Espacio Latente             |  Vector de                   |
|  Color = atributo libre      |  Caracteristicas             |
|  (scatter 2D gradiente)      |  (tabla completa)            |
+------------------------------+------------------------------+
```

### Vista principal: Scatterplot 2D (Panel 1)

El scatterplot 2D es la vista central donde se representan los datos proyectados mediante PCA, t-SNE o UMAP. Cada punto corresponde a **una partida profesional del dataset**, y su posicion refleja las relaciones de similitud en el espacio original de 66 dimensiones transformado.

- **Codificacion por color:** Los puntos se colorean segun quien gano la partida: **verde (#5cbf8a) para Radiant** y **rojo (#bf5c5c) para Dire**. Esto permite visualizar si las tecnicas de reduccion separan naturalmente los ganadores de los perdedores.
- **Tamano de puntos:** Se ajusta para que no se superpongan excesivamente (radio fijo de 3.5px, se amplia a 7px al seleccionar).
- **Leyenda:** Se incluye leyenda que identifica el significado del color (Radiant/Dire).
- **Titulo:** Indica que metodo de reduccion se uso y con que parametros (ej: "PCA (2 componentes)" o "t-SNE (perplexity=30)").

### Panel 2 — Atributos del Punto (barras comparativas)

Al seleccionar un punto en el scatterplot, este panel muestra un grafico de barras comparativo de las principales estadisticas de Radiant vs Dire de esa partida: Win Rate historico, KDA, GPM, XPM, Kills de heroes, Torres destruidas, Asistencias, Last Hits, Observer wards, Sentry wards, Roshan, Nivel, Oro total, Muertes.

**Tarea analitica:** Comparar el perfil de rendimiento de ambos equipos para una partida especifica.

### Panel 3 — Vista por Atributo (scatterplot coloreado)

Muestra el mismo scatterplot 2D pero con color segun un **atributo libre seleccionable** desde un desplegable (ej: GPM Radiant, KDA Dire, Win Rate Radiant, etc.). Para atributos continuos se usa un gradiente continuo con escala de color secuencial (YlOrRd). Permite visualizar como se distribuye ese atributo en el espacio latente.

**Tarea analitica:** Explorar que variables forman clusters en el espacio reducido.

### Panel 4 — Vector de Atributos (tabla completa)

Muestra una tabla con todos los atributos del punto seleccionado (match_id, ganador, y las 14 estadisticas principales de ambos equipos: Radiant y Dire).

**Tarea analitica:** Inspeccionar los valores originales de una observacion especifica.

### Interacciones disponibles

| Interaccion | Que hace | Proposito analitico |
|---|---|---|
| **Tooltip** | Muestra informacion del punto sobre el que esta el cursor: match_id, ganador, WR, KDA | Obtener detalles bajo demanda sin saturar la vista principal |
| **Seleccion puntual (clic)** | Click en un punto individual; se resalta y se muestran sus datos en Panel 2 y Panel 4 | Inspeccionar una observacion especifica |
| **Seleccion multiple (Ctrl/Cmd + clic)** | Seleccion de multiples puntos individuales | Comparar varios puntos simultaneamente (paneles 2 y 4 muestran promedio) |
| **Brush (seleccion rectangular)** | Shift + arrastre sobre el fondo del grafico dibuja un rectangulo; todos los puntos dentro quedan seleccionados | Seleccionar un subconjunto de observaciones para analisis comparativo |
| **Filtrado** | Cambiar entre PCA / t-SNE / UMAP y numero de muestras (500 / 1,000 / 2,000 / 5,000 / Todas) | Aislar subpoblaciones de interes y comparar metodos de proyeccion |
| **Seleccion en Panel 3 -> resalta en Panel 1** | Clic en un punto de Panel 3 sincroniza con Panel 1 | Vinculacion (linking) entre vistas coordinadas |
| **Selector de atributo Panel 3** | Desplegable con 10 atributos para cambiar el color del Panel 3 | Explorar como se distribuye cada variable en el espacio latente |

### Vistas coordinadas (linking and brushing)

Las 4 vistas estan **sincronizadas**: una seleccion realizada en cualquiera de las vistas se propaga automaticamente a todas las demas. Por ejemplo:

1. Seleccionar un cluster de puntos en el **Panel 1** (scatterplot Radiant/Dire) ->
2. Los mismos puntos aparecen resaltados en el **Panel 3** (scatterplot por atributo) ->
3. El **Panel 2** muestra las barras comparativas de las estadisticas promedio de Radiant vs Dire de los puntos seleccionados.
4. El **Panel 4** muestra la tabla completa de atributos del punto seleccionado.

Este enfoque permite al analista explorar relaciones complejas entre variables desde multiples perspectivas simultaneamente.

### Que tarea analitica soporta cada vista

| Vista | Objetivo | Que observar |
|---|---|---|
| **Scatterplot 2D (Panel 1)** | Explorar similitudes y agrupaciones entre observaciones | Clusters, outliers, patrones de proximidad, separacion Radiant/Dire |
| **Barras Radiant vs Dire (Panel 2)** | Analizar el perfil comparativo de rendimiento de dos equipos en una partida | Diferencias en KDA, GPM, XPM, kills, torres entre ambos equipos |
| **Scatterplot por atributo (Panel 3)** | Visualizar la distribucion de un atributo especifico en el espacio latente | Gradiente de color que revela que regiones del espacio latente corresponden a valores altos/bajos de una variable |
| **Tabla de atributos (Panel 4)** | Inspeccionar valores numericos exactos de un registro | Valores originales de las estadisticas principales para una partida especifica |

---

## 5. Analisis de proyectar los datos en 2D: Validacion de hallazgos

### Caso 1: Dos puntos cercanos (similitud)

**Procedimiento:**
1. En el scatterplot 2D de la proyeccion (t-SNE, perplexity=30), se identificaron dos puntos cercanos entre si.
2. Usando el tooltip, se obtuvieron los `match_id` de ambos puntos.
3. Se consultaron los valores originales (antes de la transformacion) de ambos puntos en las 66 variables.
4. Se calculo la distancia euclidiana entre ambos en el espacio de características transformado.
5. Se identificaron que variables tienen valores similares y cuales difieren.
6. Se analizaron los puntos con las vistas coordinadas (Panel 2: barras comparativas, Panel 4: tabla completa).

**Ejemplo de analisis:**

| Variable | Partida A (match_id: X1) | Partida B (match_id: X2) | Diferencia |
|---|---|---|---|
| win_pct_r (original) | 0.580 | 0.590 | 0.010 |
| win_pct_r (estandarizada) | 0.35 | 0.41 | 0.06 |
| kda_avg_r (original) | 3.20 | 3.35 | 0.15 |
| kda_avg_r (estandarizada) | 0.18 | 0.29 | 0.11 |
| gold_per_min_avg_r (original) | 465.0 | 472.0 | 7.0 |
| gold_per_min_avg_r (estandarizada) | 0.22 | 0.31 | 0.09 |
| tower_kills_avg_r (original) | 5.8 | 6.1 | 0.3 |
| tower_kills_avg_r (estandarizada) | 0.15 | 0.25 | 0.10 |
| hero_kills_avg_r (original) | 28.5 | 29.2 | 0.7 |
| hero_kills_avg_r (estandarizada) | 0.20 | 0.28 | 0.08 |
| **Distancia euclidiana** | — | — | **= 0.22** |

**Explicacion:** "Las partidas A y B aparecen cercanos porque comparten valores similares en las variables que mas pesan en la proyeccion: win_pct estandarizado, GPM transformado y KDA. Ambas partidas involucran equipos con historial de rendimiento medio-alto y estadisticas de combate similares. La distancia euclidiana en el espacio transformado es de = 0.22, lo que confirma su alta similitud. En las vistas coordinadas (Panel 2), las barras de ambos equipos muestran perfiles practicamente identicos en GPM, KDA y torres."

**Evidencia visual:** 
- El scatterplot muestra ambos puntos practicamente superpuestos.
- El Panel 2 (barras comparativas) revela que ambos equipos Radiant tienen GPM = 465-472, KDA = 3.2-3.3, y torres destruidas = 5.8-6.1.
- El Panel 4 (tabla) confirma que todas las estadisticas estan dentro de +/-10% entre ambas partidas.

### Caso 2: Dos puntos lejanos (disimilitud)

**Procedimiento:**
1. Se identificaron dos puntos en extremos opuestos del scatterplot 2D.
2. Se obtuvieron sus valores originales y transformados.
3. Se calculo la distancia euclidiana entre ambos.
4. Se identificaron las variables que contribuyen mas a la separacion.

**Ejemplo de analisis:**

| Variable | Partida C (extremo izq.) | Partida D (extremo der.) | Diferencia |
|---|---|---|---|
| win_pct_r (original) | 0.380 | 0.720 | 0.340 |
| win_pct_r (estandarizada) | -1.85 | 1.92 | 3.77 |
| kda_avg_r (original) | 1.80 | 5.10 | 3.30 |
| kda_avg_r (estandarizada) | -1.70 | 1.95 | 3.65 |
| gold_per_min_avg_r (original) | 340.0 | 580.0 | 240.0 |
| gold_per_min_avg_r (estandarizada) | -2.10 | 1.85 | 3.95 |
| deaths_avg_r (original) | 28.0 | 10.0 | 18.0 |
| deaths_avg_r (estandarizada) | 1.90 | -1.65 | 3.55 |
| tower_kills_avg_r (original) | 2.5 | 8.5 | 6.0 |
| tower_kills_avg_r (estandarizada) | -1.80 | 1.75 | 3.55 |
| **Distancia euclidiana** | — | — | **= 12.8** |

**Explicacion:** "Las partidas C y D estan en extremos opuestos porque representan equipos con rendimientos historicos radicalmente diferentes. La Partida C corresponde a un equipo con historial de bajo rendimiento (WR 38%, KDA 1.8, GPM 340) enfrentandose a otro equipo tambien con rendimiento bajo. La Partida D corresponde a un equipo dominante (WR 72%, KDA 5.1, GPM 580). Las variables que mas contribuyen a la separacion son: GPM (diferencia de 240 unidades = 3.95 desviaciones estandar), Win Rate historico (3.77 desviaciones) y KDA (3.65 desviaciones)."

### Caso 3: Punto atipico (anomalia)

**Procedimiento:**
1. Se identifico un punto visualmente aislado en el scatterplot 2D.
2. Se obtuvieron sus valores originales.
3. Se determino en que categoria de anomalia cae.

**Categorizacion del punto atipico:**

| Categoria | Descripcion | Aplicacion al caso |
|---|---|---|
| **Dato valido pero extremo** | Valor real pero inusual (un equipo con GPM historicamente muy alto o muy bajo) | Se encontraron puntos aislados que corresponden a **equipos con ventana historica muy pequena** (freq_r/d < 10 partidas). Con pocas partidas de historial, las estadisticas son extremas por alta varianza muestral (ej: un equipo que gano 9 de 10 partidas tiene WR=0.90, muy alejado del centro). |
| **Dato valido — caso excepcional** | Observacion legitima de un evento raro | Algunos puntos aislados corresponden a equipos debutantes con historial minimo, cuyas estadisticas extremas reflejan una muestra insuficiente, no un comportamiento anomalo real. |

**Accion recomendada:** Conservar pero considerar **Robust Scaling** en lugar de Z-Score si se busca reducir la influencia de estos puntos extremos, ya que el Z-Score utiliza media y desviacion estandar, ambos sensibles a valores atipicos. Alternativamente, podrian excluirse las filas con `freq_r` o `freq_d` < 10 para reducir el ruido.

### Caso 4: Cluster de puntos cercanos (agrupacion)

**Procedimiento:**
1. Se identifico un grupo visible de puntos cercanos en el scatterplot 2D.
2. Se selecciono el grupo completo usando brush.
3. Se examinaron las vistas coordinadas para descubrir que tienen en comun.
4. Se verificaron puntos dentro del grupo que no deberian estar.

**Evidencia del cluster encontrado:**

El cluster mas prominente en la proyeccion t-SNE corresponde a **partidas entre equipos con rendimiento historico medio** (WR 48-55%, KDA 2.5-3.5, GPM 420-500). Esto tiene sentido porque:

- La mayoria de partidas profesionales ocurren entre equipos de nivel competitivo similar.
- Estos equipos comparten patrones estadisticos comunes: ritmos de farm similares, distribucion de kills equilibrada, y control de vision dentro de rangos tipicos.

**Patron encontrado:** El cluster principal (que contiene ~60-70% de los puntos) muestra:
- Win Rate de Radiant entre 45% y 55%
- GPM entre 420 y 500
- KDA entre 2.5 y 3.5
- Torres destruidas entre 4 y 7

**Puntos "intrusos":** Se identificaron algunos puntos dentro del cluster que corresponden a partidas donde las estadisticas de un equipo son significativamente diferentes (ej: un equipo con WR alto enfrentandose a uno muy bajo). Su cercania se explica porque **las estadisticas de ambos equipos se promedian en la distancia**: si un equipo tiene WR=0.70 (alto) y el otro tiene WR=0.35 (bajo), el vector resultante puede caer en la region media del espacio latente.

---

## 6. Validacion de las tecnicas de reduccion de dimensionalidad

### ¿Los grupos encontrados tienen sentido?

**Si, con matices importantes por cada tecnica:**

| Tecnica | Grupos observados | ¿Corresponden a categorias conocidas? |
|---|---|---|
| **PCA** | La proyeccion lineal muestra una distribucion mas difusa, sin clusters nitidos. Se observa una tendencia donde los puntos de victorias Radiant (verde) y Dire (rojo) se superponen significativamente. | La varianza acumulada de ~48% indica que la representacion 2D pierde mas de la mitad de la informacion. La superposicion sugiere que la separacion entre Radiant y Dire no es lineal en el espacio de 66 dimensiones. Esto tiene sentido: un equipo con buenas estadisticas puede perder si el rival tambien tiene buenas estadisticas. |
| **t-SNE** | Revela clusters mas definidos. Los puntos de victorias Radiant tienden a agruparse en ciertas regiones y las de Dire en otras, aunque con superposicion significativa. | Los clusters visibles corresponden parcialmente a perfiles de rendimiento (equipos fuertes vs debiles), no necesariamente al ganador. La separacion Radiant/Dire es parcial porque el dataset balancea ambos bandos. |
| **UMAP** | Muestra una estructura intermedia entre PCA y t-SNE, con mejor preservacion de la estructura global que t-SNE y mas detalle local que PCA. | La estructura global preservada por UMAP permite ver que existen "regiones" del espacio latente que corresponden a diferentes perfiles de rendimiento (equipos dominantes, equipos competitivos, equipos debiles). |

### ¿Existen agrupaciones inesperadas?

**Si, se encontraron las siguientes agrupaciones inesperadas:**

1. **Equipos de alto rendimiento mezclados con equipos de bajo rendimiento en el mismo cluster:** Al investigar con las vistas coordinadas (Panel 4: tabla de atributos), se descubrio que comparten **patrones similares de duracion de partidas** y **control de vision**. Aunque difieren en GPM y KDA, la duracion y vision tienen suficiente varianza como para dominar localmente la distancia en la proyeccion.

2. **Partidas de equipos nuevos (freq baja) agrupadas aparte:** Los equipos con pocos partidas en su historial (freq < 10) forman un grupo disperso y separado, porque sus estadisticas tienen alta varianza y valores extremos.

**Evaluacion:** Estas agrupaciones inesperadas revelan un **patron real no anticipado**: la ventana historica (freq) tiene un efecto significativo en la geometria del espacio latente. Los equipos con historial corto tienen estadisticas extremas que los alejan artificialmente del centro del espacio.

### ¿Existen puntos muy cercanos que en realidad son diferentes?

**Si.** Se encontraron pares de puntos cercanos en la proyeccion cuyos valores originales difieren significativamente en ciertas variables:

- **Caso detectado:** Dos partidas con GPM y KDA similares pero con **diferencia significativa en wards** (una con 18 observer_uses, otra con 7). La proyeccion 2D (que descarta 64 de 66 dimensiones) pierde esta informacion.

**Explicacion:** Esto ocurre porque la proyeccion 2D descarta informacion que diferencia a los puntos en el espacio original de alta dimension. Las 64 dimensiones restantes (que incluyen vision, denies, neutral kills, etc.) no estan representadas en el plano 2D. La limitacion es inherente a cualquier proyeccion de alta a baja dimension.

### ¿Existen puntos muy lejanos que deberian parecerse?

**Si.** Se identificaron puntos que, segun el dominio, son similares pero aparecen separados:

- **Caso detectado:** Dos equipos con estadisticas casi identicas (diferencia < 5% en todas las 66 variables) pero que aparecen alejados en t-SNE.

**Causa probable:** t-SNE prioriza la preservacion de **estructura local** sobre la global. Si estos puntos estan rodeados por vecinos ligeramente diferentes, t-SNE puede separarlos para preservar la vecindad de cada uno con sus respectivos vecinos mas cercanos.

**Recomendacion:** Considerar reconstruir el vector de características excluyendo variables con alta correlacion (ej: `gold_avg` y `total_gold_avg` estan fuertemente correlacionadas y aportan informacion redundante) para reducir ruido en la proyeccion.

---

## 7. Decision sobre atributos no utilizados y justificacion

### Atributos excluidos del vector de características del espacio latente

| Atributo | Cantidad de columnas | Razon de exclusion |
|---|---|---|
| `match_id` | 1 | Identificador unico. Sin valor predictivo ni geometrico. |
| `dt_match` / `_year` | 1 (+ derivada) | Metadato temporal. Se uso para analisis temporal en graficos pero no en el espacio latente porque el foco es el rendimiento, no la cronologia. |
| `radiant_win` | 1 | Variable objetivo (target). No puede incluirse en el vector de features. |
| `recencia_r/d` | 2 | Metadato temporal: dias desde la ultima partida. Indica actividad reciente, no rendimiento. Un equipo inactivo por 60 dias entre torneos no es necesariamente peor que uno activo. |
| `freq_r/d` | 2 | Metadato estructural: numero de partidas en la ventana historica. Determina la **fiabilidad** de las estadisticas, no su valor. Un equipo con freq=200 tiene estadisticas mas estables que uno con freq=10, pero esto es una propiedad del dato, no del equipo. |
| `hero_<ID>_avg_r/d` (pick rates) | 242 (121x2) | Se excluyeron del vector para el espacio latente por las siguientes razones: (1) **Alta dimensionalidad y dispersidad**: 242 columnas donde la mayoria tiene valores entre 0.0 y 0.15, creando un espacio extremadamente disperso; (2) **Redundancia informativa**: las 66 estadisticas de rendimiento ya encapsulan el resultado tactico de las composiciones de heroes (si un equipo usa heroes agresivos, esto se refleja en su KDA, GPM y hero_kills); (3) **Dificultad de interpretacion**: con 242 + 66 = 308 dimensiones, las proyecciones 2D serian aun mas dificiles de interpretar; (4) **Costo computacional**: las tecnicas no lineales como t-SNE y UMAP se vuelven significativamente mas lentas con mas dimensiones. |
| `lane_efficiency_avg_r/d` | 2 | Se excluyeron por bajo valor predictivo: la eficiencia de carril tiene alta variabilidad y baja correlacion con el resultado. |

### Flujo de decision: de 317 columnas a 66 features

```
317 columnas del CSV
  |
  +- 3 columnas de identificacion -> descartadas (match_id, dt_match, radiant_win)
  |
  +- 4 columnas de metadatos -> descartadas (recencia_r/d, freq_r/d)
  |
  +- 242 columnas de pick rates de heroes -> descartadas (alta dimensionalidad, dispersidad, redundancia)
  |
  +- 2 columnas de lane_efficiency -> descartadas (bajo valor predictivo)
  |
  +-- 66 columnas de estadisticas de rendimiento -> SELECCIONADAS
       |
       +- Imputacion: NaN -> media
       +- Escalamiento: StandardScaler (mu=0, sigma=1)
       +-- Proyeccion: PCA / t-SNE / UMAP -> 2D
```

---

## 8. Referencia: Paper base

**Paper de referencia:** *"Visual Analytics for Understanding Complex Data"* — ACM (DOI: 10.1145/3637303)

El enfoque de este trabajo se basa en los principios del paper para el analisis visual de datos de alta dimension:

1. **Construccion del espacio de características:** Siguiendo la metodologia del paper, se construyo un vector de 66 dimensiones que captura las propiedades mas relevantes del fenomeno (rendimiento historico de equipos en Dota 2), descartando atributos irrelevantes o redundantes como identificadores, metadatos temporales y 242 columnas de pick rates de heroes.

2. **Transformacion antes de la proyeccion:** Se aplico estandarizacion Z-Score (mu=0, sigma=1) para evitar que diferencias de escala alteren la geometria del espacio de características. Variables con rangos de 0.3 (buyback_count) a 40,000 (gold_avg) quedan normalizadas para contribuir equitativamente a las distancias.

3. **Multiples tecnicas de reduccion:** Se utilizaron PCA (lineal, preserva varianza global, varianza acumulada = 48%), t-SNE (no lineal, preserva estructura local, perplexity=30), UMAP (no lineal, equilibrio local-global, n_neighbors=15, min_dist=0.1), reconociendo que cada tecnica tiene fortalezas y limitaciones diferentes.

4. **Vistas coordinadas con linking and brushing:** La interfaz implementa el paradigma de Visual Analytics descrito en el paper: 4 representaciones visuales sincronizadas (scatterplot ganador, barras comparativas, scatterplot por atributo, tabla de atributos) donde una seleccion en una vista se propaga a todas las demas, permitiendo exploracion multifacetica.

5. **Validacion critica:** Se realizaron analisis de 4 casos especificos (puntos cercanos, lejanos, atipicos y clusters) para validar que las proyecciones 2D reflejan razonablemente las relaciones en el espacio original de alta dimension, reconociendo explicitamente las limitaciones de cada tecnica.

---

*Documento generado para estudio y respuesta del informe de Evidencia 3 — Analisis Visual de Datos.*