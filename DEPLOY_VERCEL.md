# Deploy en Vercel (Flask)

## 1) Estado del proyecto
- Backend Flask en `app.py`
- Entry serverless en `api/index.py`
- Config Vercel en `vercel.json`
- Frontend en `templates/` y `static/`

## 2) Punto crítico antes de subir
Tu dataset local `tb_pro_players_matches.csv` pesa aprox. **189 MB**.

Eso implica:
- No es recomendable subirlo directo al repo (GitHub tiene límites por archivo).
- En Vercel puede impactar tiempos de arranque y tamaño del despliegue.

## 3) Recomendación para exposición
- Mantén el CSV fuera de GitHub.
- Para demo rápida, usa una versión reducida del CSV (muestra) o hospeda el CSV en almacenamiento externo y descárgalo en build/start.
- Si no hay CSV, la API responderá error claro con la ruta esperada.

## 4) Comandos locales de verificación
```powershell
pip install -r requirements.txt
python app.py
```

## 5) Flujo de despliegue
1. Sube el proyecto a GitHub (sin el CSV grande).
2. Importa el repo en Vercel.
3. Deploy (Framework preset: Other).
4. Verifica `/` y luego endpoints `/api/*`.

## 6) Checklist de orden
- `api/index.py` existe
- `vercel.json` existe
- `requirements.txt` actualizado
- `templates/` y `static/` presentes
- Dataset definido para entorno de despliegue
