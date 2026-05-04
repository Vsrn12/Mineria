# Dota 2 Pro Matches — Análisis y KNN

Aplicación web interactiva para explorar estadísticas de partidas profesionales de Dota 2 (2019–2021) usando Flask y Bootstrap.

---

## Requisitos

- Python 3.10+
- El archivo `tb_pro_players_matches.csv` en la misma carpeta que `app.py`

## Instalación

```bash
pip install -r requirements.txt
```

## Arrancar

```bash
python app.py
```

Abre [http://localhost:5000](http://localhost:5000) en tu navegador.

---

## Dataset

- **Fuente:** [Kaggle — Dota2 Pro Players Matches 2019–2021](https://www.kaggle.com/datasets/teocalvo/dota2-pro-players-matches-2019-202106/data)
- **Formato:** Cada fila representa una partida profesional con estadísticas agregadas de los últimos 6 meses de cada equipo antes de esa partida.
- **Bloques de columnas:**
  - `_r` → equipo Radiant
  - `_d` → equipo Dire
  - `hero_<id>_avg_r/d` → frecuencia de uso de cada héroe por equipo

> **Nota:** El CSV no se sube al repositorio por su tamaño. Descárgalo desde Kaggle y colócalo en esta carpeta.

---

## Funcionalidades

| Pestaña | Descripción |
|---|---|
| Partidas | Tabla paginada de partidas con filtros por ganador y fecha |
| Héroes del Meta | Héroes más usados y con mayor winrate, con imágenes de la API de OpenDota |
| Detalle de Partida | Todos los atributos de ambos equipos para una partida seleccionada |
| KNN — Partidas Similares | Encuentra partidas con perfil de equipo similar usando KNN |

---

## API Endpoints

| Método | Ruta | Descripción |
|---|---|---|
| GET | `/` | Página principal |
| GET | `/api/stats` | Estadísticas generales del dataset |
| GET | `/api/partidas` | Lista paginada de partidas |
| GET | `/api/partida/<id>` | Detalle completo de una partida |
| GET | `/api/heroes/meta` | Héroes del meta ordenados por uso/winrate |
| POST | `/api/knn` | Partidas similares por KNN (scikit-learn) |
| GET | `/api/heroes/nombres` | Nombres e imágenes de héroes desde OpenDota |
