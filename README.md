# Dota 2 Pro Matches � An�lisis con KNN

Aplicaci�n web interactiva para explorar **47 150 partidas profesionales de Dota 2**
disputadas entre 2019 y mediados de 2021. Permite visualizar el meta de h�roes,
consultar estad�sticas detalladas de cada partido y encontrar partidas similares
usando el algoritmo **K-Nearest Neighbors (KNN)** con scikit-learn.

---

## Entendiendo el Dataset

> **Lee esta secci�n antes de explorar la aplicaci�n.** La estructura del CSV
> es contraintuitiva y genera confusi�n si no se explica bien.

### �Qu� es Dota 2?

Dota 2 es un videojuego de estrategia (MOBA) de **5 jugadores contra 5**.
Cada jugador elige **1 h�roe** de un pool de ~120 disponibles.
Un equipo se llama **Radiant** (lado luminoso) y el otro **Dire** (lado oscuro).
La partida termina cuando un equipo destruye la base (Ancient) del otro.

### �Qu� hay en el CSV?

**Archivo:** `tb_pro_players_matches.csv`
**Tama�o:** ~50 MB | **Filas:** 47 150 | **Columnas:** 317
**Periodo:** 2019-01-01 -> 2021-06-18
**Fuente:** Torneos y ligas profesionales, procesado con la API de OpenDota.

Distribuci�n temporal:

| A�o  | Partidas |
|------|----------|
| 2019 | 17 578   |
| 2020 | 22 376   |
| 2021 |  7 196   |

Resultados globales: **Radiant gana 52.1 %** � Dire gana 47.9 %

---

### La pregunta clave: �qu� representa cada fila?

**Cada fila = 1 match_id = 1 partida real.** No hay duplicados.

Pero el dato guardado **NO es lo que pas� durante esa partida**.
Es el **perfil hist�rico de cada equipo justo antes de jugar esa partida**.

```
+----------------------------------------------------------------------+
| FILA = "En este match, �c�mo ven�an los dos equipos?"                |
|                                                                      |
|  match_id  | resultado | historial de Radiant | historial de Dire    |
|            |           | (�ltimas N partidas) | (�ltimas N partidas) |
+----------------------------------------------------------------------+
```

El objetivo del dataset es predecir `radiant_win` (�qui�n gan�?)
a partir del rendimiento **hist�rico** de ambos equipos.

---

### �C�mo se construy� el historial de cada equipo?

Para cada partida, se tomaron las **�ltimas N partidas** del equipo
(llamadas "ventana de historial") y se calcul� el **promedio** de cada estad�stica.

La columna `freq_r` indica cu�ntas partidas entran en la ventana de Radiant.
La columna `freq_d` hace lo mismo para Dire.

```
Estad�sticas de la ventana hist�rica:
  freq_r = 74.9 partidas en promedio (mediana: 63, m�ximo: 323)
  recencia_r = 2 d�as en mediana desde la �ltima partida (m�ximo: 184)
```

Esto explica todos los valores con decimales: son **promedios de N partidas**,
nunca conteos de una sola.

```
Ejemplo: kda_avg_r = 3.5
  ? En las �ltimas 63 partidas de Radiant, el ratio (Kills+Assists)/Deaths
    promedio fue 3.5. No significa que en esa partida hicieran 3.5 kills.
```

---

### �Por qu� hay tantos h�roes por equipo?

Dota 2 tiene 5 h�roes por lado en **cada partida individual**.
Pero el historial del equipo abarca 1-323 partidas anteriores.
En esas partidas, el equipo eligi� muchos h�roes diferentes.

La columna `hero_<ID>_avg_r` almacena la **fracci�n de partidas**
(dentro de la ventana) en que ese h�roe fue elegido.

```
Ejemplo real (match 5796599901, equipo Radiant, ventana = ~30 partidas):

  hero_103_avg_r = 0.0724  -->  H�roe 103 elegido en 7.2% de sus partidas  (~2/30)
  hero_66_avg_r  = 0.0667  -->  H�roe 66  elegido en 6.7% de sus partidas  (1/15)
  hero_86_avg_r  = 0.0571  -->  H�roe 86  elegido en 5.7% de sus partidas  (~1-2/30)
  ...
  Total h�roes con valor > 0: 51 h�roes distintos en 30 partidas.
```

**Regla general:**
- Ventana grande (100+ partidas) -> muchos h�roes distintos (50-118 con valor > 0)
- Ventana peque�a (5-10 partidas) -> pocos h�roes distintos (5-15 con valor > 0)
- Ventana m�nima (1 partida) -> exactamente 5 h�roes con valor = 1.0

El CSV incluye **118 h�roes distintos** con columna propia.

---

### Tres tipos de columnas en el dataset

#### Grupo 1 � Identificadores de la partida (3 columnas)

| Columna       | Tipo    | Descripci�n                                      |
|---------------|---------|--------------------------------------------------|
| `match_id`    | entero  | ID �nico de la partida en los servidores de Valve|
| `dt_match`    | fecha   | Fecha y hora exacta (UTC) de la partida          |
| `radiant_win` | boolean | True = gan� Radiant � False = gan� Dire          |

#### Grupo 2 � Estad�sticas hist�ricas del equipo (72 columnas: 36 � 2 equipos)

Todas con sufijo `_r` (Radiant) o `_d` (Dire). Son **promedios** sobre la ventana hist�rica.

| Columna                      | Descripci�n                                                        |
|------------------------------|--------------------------------------------------------------------|
| `recencia_r/d`               | D�as desde la �ltima partida del equipo                            |
| `freq_r/d`                   | N�mero de partidas en la ventana (tama�o de muestra)               |
| `win_pct_r/d`                | % de victorias hist�ricas (0.0 � 1.0)                              |
| `duration_avg_win_r/d`       | Duraci�n promedio en minutos cuando ganan                          |
| `duration_avg_lose_r/d`      | Duraci�n promedio en minutos cuando pierden                        |
| `actions_per_min_avg_r/d`    | APM � acciones por minuto (micro-gesti�n del jugador)              |
| `ancient_kills_avg_r/d`      | Kills a creeps Ancient (objetivo secundario)                       |
| `assists_avg_r/d`            | Asistencias promedio por partida                                   |
| `buyback_count_avg_r/d`      | Veces que compraron de vuelta la vida (mec�nica estrat�gica)       |
| `courier_kills_avg_r/d`      | Kills al mensajero enemigo (acci�n ofensiva temprana)              |
| `deaths_avg_r/d`             | Muertes de h�roes propios promedio                                 |
| `denies_avg_r/d`             | Denies (negar el �ltimo golpe a creeps propios) promedio           |
| `firstblood_claimed_avg_r/d` | % de partidas en que consiguieron el First Blood                   |
| `gold_avg_r/d`               | Oro promedio por partida                                           |
| `gold_per_min_avg_r/d`       | GPM � oro por minuto (eficiencia econ�mica)                        |
| `gold_spent_avg_r/d`         | Total de oro gastado en �tems promedio                             |
| `hero_damage_avg_r/d`        | Da�o infligido a h�roes enemigos promedio                          |
| `hero_healing_avg_r/d`       | Curaci�n otorgada a aliados promedio                               |
| `hero_kills_avg_r/d`         | Kills de h�roes enemigos promedio                                  |
| `kda_avg_r/d`                | **Ratio KDA = (Kills + Asistencias) / Muertes** � �ndice, no conteo |
| `kills_per_min_avg_r/d`      | Ritmo de kills por minuto                                          |
| `lane_efficiency_avg_r/d`    | Eficiencia en la fase de carril (laning, 0�1)                      |
| `lane_kills_avg_r/d`         | Kills totales en la fase de carril                                 |
| `last_hits_avg_r/d`          | Last hits (�ltimo golpe a creeps para obtener oro) promedio        |
| `level_avg_r/d`              | Nivel promedio del equipo al terminar la partida                   |
| `necronomicon_kills_avg_r/d` | Kills con unidades del �tem Necronomicon                           |
| `neutral_kills_avg_r/d`      | Kills de creeps neutrales (jungla) promedio                        |
| `observer_kills_avg_r/d`     | Wards observer del enemigo destruidas (anti-visi�n)                |
| `observer_uses_avg_r/d`      | Wards observer propias colocadas promedio                          |
| `purchase_tpscroll_avg_r/d`  | Pergaminos de Town Portal comprados (movilidad t�ctica)            |
| `roshan_kills_avg_r/d`       | Muertes de Roshan (< 1 porque no ocurre en cada partida)           |
| `sentry_kills_avg_r/d`       | Wards sentry del enemigo destruidas (contra-visi�n)                |
| `sentry_uses_avg_r/d`        | Wards sentry propias colocadas promedio                            |
| `total_gold_avg_r/d`         | Oro total acumulado a lo largo de la partida promedio              |
| `total_xp_avg_r/d`           | Experiencia total acumulada promedio                               |
| `tower_damage_avg_r/d`       | Da�o total infligido a torres enemigas promedio                    |
| `tower_kills_avg_r/d`        | Torres destruidas promedio                                         |
| `xp_per_min_avg_r/d`         | XPM � experiencia por minuto (velocidad de leveling)               |

#### Grupo 3 � Pick rate de h�roes (242 columnas: 121 h�roes � 2 equipos)

Formato: `hero_<ID>_avg_r` / `hero_<ID>_avg_d`

`<ID>` es el ID num�rico del h�roe en la base de datos de OpenDota.
El valor es la **fracci�n de partidas** en la ventana donde ese h�roe fue elegido.

```
Rango de valores: 0.0 (nunca elegido) --> 1.0 (elegido en el 100% de las partidas)
T�pico en equipos pro: 0.033 (1/30) a 0.20 (1/5 partidas)
```

IMPORTANTE: hay 3 columnas con nombre `hero_*` que NO son picks de h�roe:
- `hero_damage_avg_r/d`  --> da�o total del equipo (valores ~10 000�25 000)
- `hero_healing_avg_r/d` --> curaci�n del equipo (stat agregado)
- `hero_kills_avg_r/d`   --> kills de h�roes del equipo (stat agregado)

Estas se tratan como estad�sticas de equipo, no como picks de h�roe.

---

### Anomal�as conocidas del dataset

#### 1. Filas sin historial (~6 % del dataset, 2 819 partidas)

Algunas partidas tienen `match_id`, `dt_match` y `radiant_win`, pero todas las
columnas de stats y h�roes son NaN. Son partidas de equipos que no ten�an
historial previo registrado (debut en torneos, datos faltantes en la API, etc.).
La aplicaci�n las detecta y muestra un aviso de "Datos incompletos".

#### 2. KNN devuelve partidas "casi id�nticas"

Si el KNN agrupa 3-4 resultados con fecha igual y h�roes similares, es correcto.
Significa que un equipo jug� varias partidas el mismo d�a en un torneo.
La ventana hist�rica cambia poco entre partidas del mismo d�a ? vectores casi iguales
? KNN los agrupa. No son duplicados: cada match_id es �nico.

#### 3. Equipos con 100+ h�roes distintos

Un equipo con `freq_r = 200` puede haber rotado 80-100 h�roes distintos.
Es normal y refleja la diversidad t�ctica de equipos profesionales que
experimentan con muchas composiciones a lo largo del tiempo.

---

## Estructura del Proyecto

```
Final/
+-- app.py                       # Backend Flask: carga CSV, endpoints REST, modelo KNN
+-- requirements.txt             # Dependencias Python
+-- README.md                    # Este archivo
+-- tb_pro_players_matches.csv   # Dataset (no incluido en git por tama�o ~50 MB)
+-- static/
�   +-- css/
�   �   +-- style.css            # Tema oscuro inspirado en Dota 2
�   +-- js/
�       +-- app.js               # L�gica frontend (fetch, render, STAT_CONFIG, popovers)
+-- templates/
    +-- index.html               # Esqueleto HTML (Single Page Application)
```

---

## Metodolog�a KNN

El algoritmo usa **66 columnas de estad�sticas** (33 m�tricas � sufijos `_r` y `_d`)
como vector de caracter�sticas. Se excluyen `recencia`, `freq` y `lane_efficiency_avg`
(metadatos / bajo valor predictivo para la similitud entre partidas).

**Proceso:**
1. Al iniciar, se leen las 66 columnas num�ricas
2. Los NaN se rellenan con la media de cada columna
3. Se normalizan con **StandardScaler** (�=0, s=1) para igualar escalas
   (GPM ~400 vs. roshan_kills ~0.3 tendr�an pesos disparatados sin escalar)
4. Se construye un �ndice **BallTree** con m�trica **euclidiana**
5. Ante una consulta, se aplica el mismo scaler y se buscan los K vecinos m�s cercanos

---

## Instalaci�n

```bash
# 1. Instalar dependencias
pip install -r requirements.txt

# 2. Colocar tb_pro_players_matches.csv en la carpeta Final/

# 3. Iniciar el servidor
cd Final
python app.py
```

Output esperado:
```
[OK] Dataset cargado: 47150 partidas en XXXX ms
 * Running on http://127.0.0.1:5000
```

Abrir en el navegador: **http://localhost:5000**

---

## API Endpoints

| M�todo | Ruta                      | Descripci�n                                    |
|--------|---------------------------|------------------------------------------------|
| GET    | /                         | Interfaz web (Single Page Application)         |
| GET    | /api/stats                | Estad�sticas globales del dataset              |
| GET    | /api/partidas             | Lista paginada (page, per_page, ganador)       |
| GET    | /api/partida/<match_id>   | Detalle completo + flag datos_completos        |
| GET    | /api/heroes/meta          | Top N h�roes por frecuencia y winrate          |
| GET    | /api/heroes/nombres       | Mapeo completo id -> nombre + URL imagen       |
| POST   | /api/knn                  | Body: {"match_id": N, "k": K}                  |

---

## Stack Tecnol�gico

| Componente       | Tecnolog�a                          | Versi�n |
|------------------|-------------------------------------|---------|
| Backend          | Python / Flask                      | >= 3.0  |
| Datos            | pandas                              | >= 2.2  |
| Machine Learning | scikit-learn (KNN + StandardScaler) | >= 1.4  |
| �lgebra lineal   | numpy                               | >= 1.26 |
| HTTP heroes API  | requests                            | >= 2.31 |
| CSS Framework    | Bootstrap                           | 5.3.2   |
| Iconograf�a      | Bootstrap Icons                     | 1.11.3  |
| Im�genes         | CDN oficial Steam (OpenDota)        | �       |
