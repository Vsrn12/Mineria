# Dota 2 Pro Matches — Análisis con KNN

Aplicación web interactiva para explorar **47 150 partidas profesionales de Dota 2**
disputadas entre 2019 y mediados de 2021. Permite visualizar el meta de héroes,
consultar estadísticas detalladas de cada partido, encontrar partidas similares
usando el algoritmo **K-Nearest Neighbors (KNN)** y explorar gráficos analíticos.

---

## Entendiendo el Dataset

> **Lee esta sección antes de explorar la aplicación.** La estructura del CSV
> es contraintuitiva y genera confusión si no se explica bien.

### ¿Qué es Dota 2?

Dota 2 es un videojuego de estrategia (MOBA) de **5 jugadores contra 5**.
Cada jugador elige **1 héroe** de un pool de ~120 disponibles.
Un equipo se llama **Radiant** (lado luminoso) y el otro **Dire** (lado oscuro).
La partida termina cuando un equipo destruye la base (Ancient) del otro.

Las métricas de rendimiento en Dota 2 son muy distintas a otros deportes:
no hay marcadores simples. El rendimiento se mide a través de decenas de
indicadores económicos, de combate, de mapa y de objetivos.

### ¿Qué hay en el CSV?

**Archivo:** `tb_pro_players_matches.csv`
**Tamaño:** ~50 MB | **Filas:** 47 150 | **Columnas:** 317
**Periodo:** 2019-01-01 -> 2021-06-18
**Fuente:** Torneos y ligas profesionales, procesado con la API de OpenDota.

Distribución temporal:

| Año  | Partidas |
|------|----------|
| 2019 | 17 578   |
| 2020 | 22 376   |
| 2021 |  7 196   |

Resultados globales: **Radiant gana 52.1 %** — Dire gana 47.9 %

La ligera ventaja de Radiant es un fenómeno conocido en Dota 2 relacionado
con la geometría del mapa y la posición de los objetivos secundarios.

---

### La pregunta clave: ¿qué representa cada fila?

**Cada fila = 1 match_id = 1 partida real.** No hay duplicados.

Pero el dato guardado **NO es lo que pasó durante esa partida**.
Es el **perfil histórico de cada equipo justo antes de jugar esa partida**.

```
+----------------------------------------------------------------------+
| FILA = "En este match, ¿cómo venían los dos equipos?"                |
|                                                                      |
|  match_id  | resultado | historial de Radiant | historial de Dire    |
|            |           | (últimas N partidas) | (últimas N partidas) |
+----------------------------------------------------------------------+
```

El objetivo del dataset es predecir `radiant_win` (¿quién ganó?)
a partir del rendimiento **histórico** de ambos equipos **antes** de esa partida.

---

### ¿Cómo se construyó el historial de cada equipo?

Para cada partida, se tomaron las **últimas N partidas** del equipo
("ventana de historial") y se calculó el **promedio** de cada estadística.

La columna `freq_r` indica cuántas partidas entran en la ventana de Radiant.
La columna `freq_d` hace lo mismo para Dire.

Esto explica todos los valores con decimales: son **promedios de N partidas**,
nunca conteos de una sola.

```
Ejemplo: kda_avg_r = 3.5
  → En las últimas ~63 partidas de Radiant, el ratio (Kills+Assists)/Deaths
    promedio fue 3.5. No significa que en esa partida hicieran 3.5 kills.
```

---

### ¿Por qué hay tantos héroes por equipo?

La columna `hero_<ID>_avg_r` almacena la **fracción de partidas** en que
ese héroe fue elegido dentro de la ventana histórica del equipo.

```
Regla general:
  Ventana grande (100+ partidas) → 50-118 héroes distintos con valor > 0
  Ventana pequeña (5-10 partidas) → 5-15 héroes distintos con valor > 0
  Ventana mínima (1 partida) → exactamente 5 héroes con valor = 1.0
```

---

### Tres tipos de columnas en el dataset

#### Grupo 1 — Identificadores de la partida (3 columnas)

| Columna       | Tipo    | Descripción                                       |
|---------------|---------|---------------------------------------------------|
| `match_id`    | entero  | ID único de la partida en los servidores de Valve |
| `dt_match`    | fecha   | Fecha y hora exacta (UTC) de la partida           |
| `radiant_win` | boolean | True = ganó Radiant / False = ganó Dire           |

---

#### Grupo 2 — Estadísticas históricas del equipo (72 columnas: 36 × 2 equipos)

Todas con sufijo `_r` (Radiant) o `_d` (Dire). Son **promedios** sobre la ventana histórica.

---

**`recencia_r` / `recencia_d`**
*Tipo: float | Unidad: días | Rango típico: 0–30 (máx. 184)*

Días transcurridos desde la última partida del equipo hasta esta.
Un valor bajo indica actividad reciente; un valor alto puede indicar inactividad entre torneos.
No se usa en KNN (metadato temporal, no de rendimiento).

---

**`freq_r` / `freq_d`**
*Tipo: float | Unidad: número de partidas | Rango típico: 5–323 (mediana: ~63)*

Tamaño de la ventana histórica. Un `freq` alto (200+) implica que las estadísticas son
representativas y estables. Un `freq` bajo (5–10) implica alta variabilidad.
No se usa en KNN (metadato estructural).

---

**`win_pct_r` / `win_pct_d`**
*Tipo: float | Unidad: proporción (0.0–1.0) | Rango típico: 0.35–0.75*

Porcentaje de victorias del equipo en la ventana histórica. Es la métrica más directa
de "nivel" del equipo. La feature más intuitivamente correlacionada con `radiant_win`.

---

**`duration_avg_win_r` / `duration_avg_win_d`**
*Tipo: float | Unidad: minutos | Rango típico: 30–50 min*

Duración promedio de las partidas cuando el equipo **gana**. Valores bajos (~28 min)
indican estrategias agresivas de cierre rápido; valores altos (~48 min) indican
equipos que ganan en partidas largas de late-game.

---

**`duration_avg_lose_r` / `duration_avg_lose_d`**
*Tipo: float | Unidad: minutos | Rango típico: 32–55 min*

Duración promedio cuando el equipo **pierde**. Generalmente mayor que `duration_avg_win`
porque los equipos perdedores alargan la partida buscando remontadas.

---

**`gold_per_min_avg_r` / `gold_per_min_avg_d`**
*Tipo: float | Unidad: oro/minuto | Rango típico: 350–600 GPM*

GPM (Gold Per Minute): ritmo de generación de oro del equipo completo.
Es uno de los dos KPIs primarios de eficiencia. El oro permite comprar ítems
que determinan el poder de combate. Un GPM alto implica farm eficiente.

---

**`xp_per_min_avg_r` / `xp_per_min_avg_d`**
*Tipo: float | Unidad: XP/minuto | Rango típico: 350–700 XPM*

XPM (Experience Per Minute): ritmo de ganancia de experiencia. Determina el nivel
del héroe y sus habilidades. Es el equivalente al GPM en "progresión de poder".

---

**`gold_avg_r` / `gold_avg_d`**
*Tipo: float | Unidad: oro total | Rango típico: 10 000–40 000*

Oro neto total por partida. Directamente relacionado con duración; menos informativo
que GPM en aislamiento.

---

**`gold_spent_avg_r` / `gold_spent_avg_d`**
*Tipo: float | Unidad: oro gastado | Rango típico: 8 000–35 000*

Total de oro invertido en ítems. La diferencia con `gold_avg` refleja oro acumulado sin gastar.

---

**`total_gold_avg_r` / `total_gold_avg_d`**
*Tipo: float | Unidad: oro total (incl. gastado) | Rango típico: 15 000–50 000*

Flujo total de economía a lo largo de la partida, más completo que `gold_avg`.

---

**`total_xp_avg_r` / `total_xp_avg_d`**
*Tipo: float | Unidad: XP total | Rango típico: 20 000–80 000*

Experiencia total acumulada por partida. Fuertemente correlacionado con duración.

---

**`hero_kills_avg_r` / `hero_kills_avg_d`**
*Tipo: float | Unidad: kills totales | Rango típico: 10–35*

Total de héroes enemigos eliminados por el equipo. Cada kill otorga oro y XP al equipo.

---

**`deaths_avg_r` / `deaths_avg_d`**
*Tipo: float | Unidad: muertes del equipo | Rango típico: 8–30*

Muertes propias. Valor bajo es positivo: mantener héroes vivos preserva recursos
(una muerte en late-game implica hasta 90 seg de respawn perdido).

---

**`assists_avg_r` / `assists_avg_d`**
*Tipo: float | Unidad: asistencias | Rango típico: 20–60*

Asistencias en kills. Un ratio assists/kills alto indica combates colectivos (5v5).

---

**`kda_avg_r` / `kda_avg_d`**
*Tipo: float | Unidad: ratio adimensional | Rango típico: 1.5–6.0*

KDA = (Kills + Assists) / Deaths. Indicador sintético de rendimiento de combate.
KDA > 4 es excelente; KDA < 1.5 suele correlacionar con derrotas.
Es un ratio de equipo, no promedio de KDAs individuales.

---

**`kills_per_min_avg_r` / `kills_per_min_avg_d`**
*Tipo: float | Unidad: kills/minuto | Rango típico: 0.3–0.8*

Ritmo de generación de kills. Complementa `hero_kills_avg` normalizando por duración.

---

**`hero_damage_avg_r` / `hero_damage_avg_d`**
*Tipo: float | Unidad: puntos de daño | Rango típico: 8 000–30 000*

Daño total infligido a héroes enemigos por todo el equipo durante la partida.
Valores altos pueden indicar partidas largas, composiciones de alto DPS o muchos combates.
NOTA: pese al prefijo `hero_`, esta es una **estadística de equipo**, no un pick rate.

---

**`hero_healing_avg_r` / `hero_healing_avg_d`**
*Tipo: float | Unidad: puntos curados | Rango típico: 500–8 000*

Curación total otorgada a aliados (habilidades soporte + ítems). Un valor alto indica
composición con soportes curativos (Omniknight, Dazzle, etc.).
NOTA: estadística de equipo, no un pick rate de héroe.

---

**`last_hits_avg_r` / `last_hits_avg_d`**
*Tipo: float | Unidad: last hits | Rango típico: 300–900*

Total de last hits (último golpe a creeps para obtener oro). Métrica clave de farm en la
fase de carril (laning). Mayor número = mejor economía en la fase media.

---

**`denies_avg_r` / `denies_avg_d`**
*Tipo: float | Unidad: denies | Rango típico: 30–120*

Denies: negar el último golpe a los propios creeps. Mecánica exclusiva de Dota 2.
Un valor alto indica control técnico avanzado y priva al enemigo de ~25% de XP.

---

**`lane_kills_avg_r` / `lane_kills_avg_d`**
*Tipo: float | Unidad: kills en carril | Rango típico: 2–10*

Kills en los primeros ~10–12 minutos (fase de laning). Un valor alto indica
agresividad temprana para generar ventaja inicial.

---

**`firstblood_claimed_avg_r` / `firstblood_claimed_avg_d`**
*Tipo: float | Unidad: proporción 0–1 | Rango típico: 0.35–0.65*

Fracción de partidas en que el equipo consiguió el First Blood (primera kill del juego).
El First Blood otorga ~200 de oro extra. No garantiza victoria pero da ventaja inicial.

---

**`observer_uses_avg_r` / `observer_uses_avg_d`**
*Tipo: float | Unidad: wards colocadas | Rango típico: 5–20*

Wards observer propias colocadas por partida. Son items de visión que revelan áreas del mapa.
Un valor alto indica buena cultura de información del mapa.

---

**`observer_kills_avg_r` / `observer_kills_avg_d`**
*Tipo: float | Unidad: wards destruidas | Rango típico: 3–15*

Wards observer enemigas destruidas (deswarding). Cegar al enemigo es tan valioso
como tener visión propia.

---

**`sentry_uses_avg_r` / `sentry_uses_avg_d`**
*Tipo: float | Unidad: wards colocadas | Rango típico: 4–20*

Wards sentry propias colocadas. Las sentries detectan unidades invisibles y wards enemigas.
Miden la actividad en la "guerra de visión" del mapa.

---

**`sentry_kills_avg_r` / `sentry_kills_avg_d`**
*Tipo: float | Unidad: wards destruidas | Rango típico: 3–15*

Wards sentry enemigas destruidas. Un valor alto indica un equipo que activamente
destruye la capacidad de detección del rival.

---

**`roshan_kills_avg_r` / `roshan_kills_avg_d`**
*Tipo: float | Unidad: veces que mató a Roshan | Rango típico: 0.0–1.5*

Roshan es el boss más poderoso del mapa. Matarlo otorga el Aegis (vida extra) y
gran recompensa de oro/XP. No ocurre en todas las partidas, de ahí valores < 1.

---

**`tower_kills_avg_r` / `tower_kills_avg_d`**
*Tipo: float | Unidad: torres destruidas | Rango típico: 2–8*

Torres enemigas destruidas. Es el objetivo principal del juego: se necesitan las
torres para poder atacar la base.

---

**`tower_damage_avg_r` / `tower_damage_avg_d`**
*Tipo: float | Unidad: puntos de daño | Rango típico: 5 000–25 000*

Daño infligido a torres. Un valor alto con pocas torres destruidas puede indicar
partidas donde el equipo presiona pero no logra cerrar objetivos.

---

**`ancient_kills_avg_r` / `ancient_kills_avg_d`**
*Tipo: float | Unidad: kills de creeps Ancient | Rango típico: 0–5*

Ancient creeps son neutrales de alta recompensa. Farmearlos es optimización
económica avanzada en la fase media del juego.

---

**`neutral_kills_avg_r` / `neutral_kills_avg_d`**
*Tipo: float | Unidad: kills de creeps neutrales | Rango típico: 50–300*

Kills de creeps en la jungla. Un valor alto indica estrategia orientada al farm
de jungla (neutral items, semicarriles, jungler dedicado).

---

**`actions_per_min_avg_r` / `actions_per_min_avg_d`**
*Tipo: float | Unidad: acciones/minuto | Rango típico: 150–350*

APM: número de comandos enviados al juego por minuto. Mide la intensidad de micro-gestión.
No es directamente sinónimo de habilidad (acciones redundantes inflan el APM).

---

**`buyback_count_avg_r` / `buyback_count_avg_d`**
*Tipo: float | Unidad: veces comprado | Rango típico: 0.3–2.0*

Buyback: revivir inmediatamente pagando oro en lugar de esperar el respawn.
Un valor alto indica partidas muy disputadas donde cada segundo es crítico.

---

**`courier_kills_avg_r` / `courier_kills_avg_d`**
*Tipo: float | Unidad: kills al mensajero | Rango típico: 0.0–0.5*

El mensajero lleva ítems desde la tienda. Matarlo penaliza económicamente al rival.
Valores bajos porque los couriers modernos tienen protección en los primeros minutos.

---

**`purchase_tpscroll_avg_r` / `purchase_tpscroll_avg_d`**
*Tipo: float | Unidad: pergaminos comprados | Rango típico: 5–20*

TP Scrolls (Teleport Scrolls) permiten teleportarse a cualquier torre aliada.
Un valor alto indica un equipo con presencia global activa y rotaciones frecuentes.

---

**`level_avg_r` / `level_avg_d`**
*Tipo: float | Unidad: nivel (1–30) | Rango típico: 18–28*

Nivel promedio del equipo al final de la partida. Un nivel alto puede indicar
partidas largas o eficiencia en la ganancia de XP.

---

**`necronomicon_kills_avg_r` / `necronomicon_kills_avg_d`**
*Tipo: float | Unidad: kills con unidades invocadas | Rango típico: 0–3*

El Necronomicon invoca unidades con alta capacidad de detección y daño.
Métrica nicho: solo relevante cuando el ítem es popular en el meta del parche.

---

#### Grupo 3 — Pick rate de héroes (242 columnas: 121 héroes × 2 equipos)

**Formato:** `hero_<ID>_avg_r` / `hero_<ID>_avg_d`

El valor es la **fracción de partidas** de la ventana histórica en que ese héroe fue elegido.

```
Rango: 0.0 (nunca elegido) → 1.0 (elegido en el 100% de las partidas)
Típico en equipos pro: 0.033 (1/30) a 0.20 (1/5 partidas)
```

IMPORTANTE: hay 3 columnas con prefijo `hero_` que NO son pick rates:
- `hero_damage_avg_r/d`  → daño total del equipo (valores ~8 000–30 000)
- `hero_healing_avg_r/d` → curación del equipo (stat agregado)
- `hero_kills_avg_r/d`   → kills de héroes del equipo (stat agregado)

Se distinguen porque en lugar de un número después de `hero_`, tienen una palabra descriptiva.

---

### Anomalías conocidas del dataset

#### 1. Partidas sin historial de héroes (~6% del dataset, ~2 819 partidas)

Algunas partidas tienen `match_id`, `dt_match` y `radiant_win`, pero **cero columnas
de héroes con valor > 0** (ni Radiant ni Dire). Son partidas de equipos sin historial
previo registrado (debut en torneos, datos faltantes en la API de OpenDota).

**Decisión de diseño:** estas partidas se **excluyen automáticamente** del listado
de partidas porque no aportan información táctica utilizable. La pestaña de Gráficos
muestra su distribución por año como anomalía documentada.

#### 2. KNN devuelve partidas "casi idénticas"

Si el KNN agrupa varios resultados con fecha igual y héroes similares, es correcto:
un equipo jugó varias partidas el mismo día en un torneo. La ventana histórica
cambia poco entre partidas del mismo día → vectores casi iguales → KNN los agrupa.
No son duplicados: cada match_id es único.

#### 3. Equipos con 100+ héroes distintos

Un equipo con `freq_r = 200` puede haber rotado 80–100 héroes distintos a lo largo
del tiempo. Es normal y refleja la diversidad táctica de equipos profesionales.

---

## Hipótesis Iniciales

### H1 — La eficiencia económica es el principal predictor de victoria

**Planteamiento:** Los equipos con mayor `gold_per_min_avg` y `xp_per_min_avg`
tienen mayor probabilidad de ganar. El control económico del mapa es la principal
ventaja estructural en Dota 2 profesional.

**Variables clave:** `gold_per_min_avg_r/d`, `xp_per_min_avg_r/d`

**Validación:** Correlación de Pearson; regresión logística solo con GPM y XPM.

---

### H2 — Los equipos con mejor KDA histórico tienen mayor win rate

**Planteamiento:** El KDA captura el rendimiento de combate sintéticamente.
Equipos con KDA > 3.5 deberían tener `win_pct` significativamente mayor
que equipos con KDA < 2.0.

**Variables clave:** `kda_avg_r/d`, `win_pct_r/d`

**Validación:** Scatter plot KDA vs win_pct, segmentación en cuartiles.

---

### H3 — El control de visión diferencia a los equipos ganadores

**Planteamiento:** Los equipos que colocan más wards y destruyen más wards enemigas
tienen ventaja táctica de información que se traduce en victorias.

**Variables clave:** `observer_uses_avg_r/d`, `observer_kills_avg_r/d`, `sentry_uses_avg_r/d`, `sentry_kills_avg_r/d`

**Validación:** Comparar promedios en victorias vs derrotas. Crear índice "visión neta".

---

### H4 — Matar a Roshan aumenta la probabilidad de ganar

**Planteamiento:** El Aegis es un recurso decisivo en partidas disputadas.
Los equipos con `roshan_kills_avg` más alto deberían tener mayor win rate.

**Variables clave:** `roshan_kills_avg_r/d`, `duration_avg_win_r/d`

**Validación:** Win rate condicional al número de Roshans. Interacción con duración.

---

### H5 — El control de torres es más predictivo que el control de kills

**Planteamiento:** Ganar no requiere más kills, sino destruir el Ancient.
Los equipos con mayor `tower_kills_avg` deberían tener mayor win rate
que equipos con alto `hero_kills_avg` pero pocas torres.

**Variables clave:** `tower_kills_avg_r/d`, `hero_kills_avg_r/d`

**Validación:** Comparar R² de tower_kills_avg vs R² de hero_kills_avg en win rate.

---

### H6 — Equipos con mayor historial tienen estadísticas más estables

**Planteamiento:** Por la ley de los grandes números, equipos con `freq_r/d` alto
tienen promedios más representativos y estadísticas más predictivas.

**Validación:** Dividir por cuartiles de `freq`. Comparar precisión del clasificador.

---

### H7 — Las partidas largas nivelan las diferencias iniciales

**Planteamiento:** Una ventaja de laning puede disolverse en partidas > 45 min.
La diferencia en `last_hits_avg` entre ganadores y perdedores debería ser
menor en partidas largas que en partidas cortas.

**Validación:** Segmentar por duración y analizar separación entre ganadores/perdedores.

---

### H8 — Diversidad de héroes reduce la predictibilidad del KNN

**Planteamiento:** Un equipo con 80+ héroes distintos en su historial es tácticamemte
menos predecible. El KNN debería tener peor rendimiento en estas filas porque el
vector de pick rates es muy disperso.

**Validación:** Calcular entropía del vector de picks. Correlacionar con error de predicción.

---

## Estructura del Proyecto

```
Final/
├── app.py                       # Backend Flask: carga CSV, endpoints REST, modelo KNN
├── requirements.txt             # Dependencias Python
├── README.md                    # Este archivo
├── tb_pro_players_matches.csv   # Dataset (~50 MB, no incluido en git)
├── static/
│   ├── css/
│   │   └── style.css            # Tema oscuro inspirado en Dota 2
│   └── js/
│       └── app.js               # Lógica frontend (fetch, Chart.js, popovers, KNN)
└── templates/
    └── index.html               # Esqueleto HTML (Single Page Application)
```

---

## Funcionalidades

### Pestaña: Partidas
- Lista paginada de partidas con filtro por ganador y búsqueda por match_id
- Muestra Win Rate, KDA y GPM de cada equipo
- **Solo muestra partidas con datos de héroes** (excluye las ~2 819 filas sin historial)
- Click en cualquier fila para ir al detalle

### Pestaña: Héroes del Meta
- Grid visual de los top 20/30/50 héroes más usados en el dataset
- Win rate destacado con colores (verde > 55%, rojo < 45%, oro = neutral)
- Popovers con estadísticas detalladas al hacer hover

### Pestaña: Detalle de Partida
- Tira de 6 métricas clave en tarjetas destacadas (Win Rate, KDA, GPM, XPM, Kills, Torres)
- Estadísticas agrupadas en 6 secciones colapsables: Rendimiento, Economía, Combate, Objetivos, Visión, Detalles
- Top 5 héroes por equipo (los más frecuentes en la ventana histórica)
- Botón para lanzar KNN desde el mismo detalle

### Pestaña: KNN — Partidas Similares
- Búsqueda de las K partidas más similares usando vector de 66 estadísticas
- Cada resultado muestra: distancia KNN, Win%, KDA, ganador
- **Top 5 héroes por equipo por partida similar** (Radiant + Dire)
  - Si K=5 similares → se muestran 5 sets de 5 héroes = 25 por lado en total
  - Si K=10 → 10 sets de 5 = 50 por lado en total

### Pestaña: Gráficos
1. **Win Rate de Top 50 Héroes** — barras verticales, color según win rate
2. **GPM y XPM: Radiant vs Dire** — barras agrupadas comparativas
3. **Victorias Radiant vs Dire** — gráfico donut con porcentajes globales
4. **Anomalías por año** — barras apiladas (válidas vs sin héroes) por año

---

## Metodología KNN

El algoritmo usa **66 columnas de estadísticas** (33 métricas × sufijos `_r` y `_d`)
como vector de características. Se excluyen `recencia`, `freq` y `lane_efficiency_avg`
(metadatos / bajo valor predictivo).

**Proceso:**
1. Carga del CSV y cómputo de flags `_has_heroes_r/d/_has_heroes`
2. Los NaN en las 66 columnas se rellenan con la media de cada columna
3. Normalización con **StandardScaler** (μ=0, σ=1) para igualar escalas
4. Índice **BallTree** con métrica **euclidiana**
5. Por consulta: se aplica el mismo scaler y se buscan los K vecinos más cercanos

---

## Instalación

```bash
# 1. Instalar dependencias
pip install -r requirements.txt

# 2. Colocar tb_pro_players_matches.csv en la carpeta Final/

# 3. Iniciar el servidor
python app.py
```

Output esperado:
```
[OK] Dataset cargado: 47150 partidas | válidas: XXXXX | sin héroes: 2819 | XXXX ms
 * Running on http://127.0.0.1:5000
```

Abrir en el navegador: **http://localhost:5000**

---

## API Endpoints

| Método | Ruta                      | Descripción                                            |
|--------|---------------------------|--------------------------------------------------------|
| GET    | /                         | Interfaz web (Single Page Application)                 |
| GET    | /api/stats                | Estadísticas globales del dataset                      |
| GET    | /api/partidas             | Lista paginada (filtra partidas sin héroes)            |
| GET    | /api/partida/<match_id>   | Detalle completo + top 5 héroes por equipo             |
| GET    | /api/heroes/meta          | Top N héroes por frecuencia y winrate                  |
| GET    | /api/heroes/nombres       | Mapeo completo id → nombre + URL imagen                |
| POST   | /api/knn                  | Similares + top 5 héroes por cada partida similar      |
| GET    | /api/graficos             | Datos para los 4 gráficos (héroes, GPM/XPM, etc.)     |
| GET    | /api/espacio-latente      | Proyección 2D del vector de características (PCA/UMAP/t-SNE) |

---

## Pestaña: Espacio Latente

La pestaña **Espacio Latente** aplica técnicas de reducción de dimensionalidad
para proyectar el vector de ~60 características de cada partida a un espacio 2D
navegable con D3.js.

### ¿Qué hace?

El vector de características de cada partida contiene ~60 columnas numéricas
(estadísticas de Radiant y Dire: GPM, XPM, KDA, torres, visión, etc.).
Este módulo reduce ese vector a exactamente **2 dimensiones (x, y)**
para poder representar cada partida como un punto en un plano interactivo.

### Métodos de reducción de dimensionalidad

| Método | Descripción | Ventaja |
|--------|-------------|---------|
| **PCA** | Proyección lineal que maximiza la varianza explicada | Rápido, reproducible, muestra % varianza |
| **UMAP** | Proyección no lineal basada en geometría topológica | Preserva estructura local y global |
| **t-SNE** | Proyección estocástica por divergencia KL | Revela clústeres locales con claridad |

> **Nota UMAP:** Requiere `umap-learn` instalado (`pip install umap-learn`).
> Si no está disponible el backend usa PCA como fallback automático.

### Cuatro paneles enlazados (D3.js)

```
┌─────────────────────────┬─────────────────────────┐
│  Panel 1                │  Panel 2                │
│  Espacio Latente        │  Atributos del Punto    │
│  Color = Radiant/Dire   │  Barras Radiant vs Dire │
│  (clic para seleccionar)│  (aparece al seleccionar)│
├─────────────────────────┼─────────────────────────┤
│  Panel 3                │  Panel 4                │
│  Espacio Latente        │  Vector de Atributos    │
│  Color = atributo libre │  Tabla completa del     │
│  (selector desplegable) │  registro seleccionado  │
└─────────────────────────┴─────────────────────────┘
```

**Interacción enlazada:**
- Clic en un punto de **Panel 1** → resalta ese punto en **Panel 3** y muestra
  sus atributos en **Panel 2** (barras) y **Panel 4** (tabla completa).
- Clic en un punto de **Panel 3** → misma lógica, sincroniza con **Panel 1**.
- Hover muestra un tooltip flotante con match_id, ganador, WR y KDA.
- Clic en el punto ya seleccionado lo deselecciona y limpia los paneles de detalle.

**Panel 3 — Vista por Atributo:**
Permite elegir **un solo atributo** del vector de características (ej. GPM Radiant)
y aplicarlo como gradiente de color a los puntos. Así se puede visualizar
cómo ese atributo se distribuye en el espacio latente y si forma clústeres.

### Parámetros de carga

| Parámetro | Opciones | Descripción |
|-----------|----------|-------------|
| Método | PCA / UMAP / t-SNE | Algoritmo de reducción |
| Muestras | 500 / 1 000 / 2 000 | Número de partidas a proyectar (muestra aleatoria) |
| Color Panel 3 | 10 atributos | Atributo cuyo valor colorea los puntos del Panel 3 |

---

## Stack Tecnológico

| Componente       | Tecnología                          | Versión |
|------------------|-------------------------------------|---------|
| Backend          | Python / Flask                      | >= 3.0  |
| Datos            | pandas                              | >= 2.2  |
| Machine Learning | scikit-learn (KNN + StandardScaler) | >= 1.4  |
| Álgebra lineal   | numpy                               | >= 1.26 |
| HTTP heroes API  | requests                            | >= 2.31 |
| CSS Framework    | Bootstrap                           | 5.3.2   |
| Iconografía      | Bootstrap Icons                     | 1.11.3  |
| Gráficos         | Chart.js                            | 4.4.3   |
| Visualización D3 | D3.js (Espacio Latente)             | 7.9.0   |
| Imágenes         | CDN oficial Steam (OpenDota)        | —       |
