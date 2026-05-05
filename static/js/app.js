// ═══════════════════════════════════════════════════════════════
//  Dota 2 Pro Matches — Lógica del frontend
//  Comentarios en español
// ═══════════════════════════════════════════════════════════════

// ─── Estado global ────────────────────────────────────────────────────────────
let paginaActual = 1;
const POR_PAGINA = 20;

// ─── Configuración de estadísticas ───────────────────────────────────────────
// Cada entrada define cómo mostrar una columna de estadística:
//   label:     nombre legible para el usuario
//   tooltip:   descripción detallada (aparece al hacer hover sobre la fila)
//   unit:      unidad que se agrega al valor
//   dec:       decimales a mostrar
//   transform: función opcional para convertir el valor antes de mostrar
//   large:     si true, valores >= 1000 se muestran como "X.Xk"
const STAT_CONFIG = {
  win_pct:                { label: 'Win Rate (%)',                tooltip: 'Porcentaje de victorias del equipo en la ventana de análisis',                 unit: '%',   dec: 1 },
  duration_avg_win:       { label: 'Duración victoria',           tooltip: 'Duración promedio (min) de las partidas ganadas — original en segundos',      unit: 'min', dec: 1, transform: v => v / 60 },
  duration_avg_lose:      { label: 'Duración derrota',            tooltip: 'Duración promedio (min) de las partidas perdidas — original en segundos',     unit: 'min', dec: 1, transform: v => v / 60 },
  actions_per_min_avg:    { label: 'APM (acciones/min)',          tooltip: 'Promedio de comandos de los jugadores por minuto (APM)',                       unit: '',    dec: 1 },
  ancient_kills_avg:      { label: 'Ancient kills (prom.)',       tooltip: 'Kills de creeps "ancient" por partida. Puede ser fraccionario (es un promedio)', unit: '', dec: 1 },
  assists_avg:            { label: 'Asistencias (prom.)',         tooltip: 'Asistencias en kills de héroes enemigos por partida. Es un promedio del equipo.', unit: '', dec: 1 },
  buyback_count_avg:      { label: 'Buybacks (prom.)',            tooltip: 'Usos de buyback (revivir con oro) por partida',                               unit: '',    dec: 2 },
  courier_kills_avg:      { label: 'Courier kills (prom.)',       tooltip: 'Veces que el equipo mató el courier enemigo por partida',                     unit: '',    dec: 2 },
  deaths_avg:             { label: 'Muertes (prom.)',             tooltip: 'Muertes promedio de héroes por partida. Es un promedio, no un conteo entero.', unit: '',   dec: 1 },
  denies_avg:             { label: 'Denies (prom.)',              tooltip: 'Creeps denegados al enemigo por partida (last hit de aliado)',                 unit: '',    dec: 1 },
  firstblood_claimed_avg: { label: 'First Blood (tasa)',          tooltip: 'Tasa con la que el equipo logra obtener el first blood (0 a 1)',              unit: '',    dec: 2 },
  gold_avg:               { label: 'Oro neto (prom.)',            tooltip: 'Oro neto promedio por partida',                                               unit: '',    dec: 0, large: true },
  gold_per_min_avg:       { label: 'GPM (oro/min)',               tooltip: 'Oro ganado por minuto — mide la eficiencia económica del equipo',             unit: '',    dec: 0 },
  gold_spent_avg:         { label: 'Oro gastado (prom.)',         tooltip: 'Oro total invertido en ítems por partida',                                    unit: '',    dec: 0, large: true },
  hero_damage_avg:        { label: 'Daño a héroes (prom.)',       tooltip: 'Daño total infligido a héroes enemigos por partida',                          unit: '',    dec: 0, large: true },
  hero_healing_avg:       { label: 'Curación (prom.)',            tooltip: 'HP total curado a aliados por partida (habilidades + ítems)',                 unit: '',    dec: 0, large: true },
  hero_kills_avg:         { label: 'Kills de héroes (prom.)',     tooltip: 'Kills de héroes enemigos por partida. Promedio del equipo.',                  unit: '',    dec: 1 },
  kda_avg:                { label: 'KDA — ratio K+A/D',           tooltip: 'Ratio: (Kills + Asistencias) ÷ Muertes. NO es un conteo individual; es un índice de rendimiento. Valor > 1 es favorable.', unit: '', dec: 2 },
  kills_per_min_avg:      { label: 'Kills/min',                   tooltip: 'Kills de héroes por minuto — mide el ritmo de eliminaciones',                unit: '',    dec: 3 },
  lane_kills_avg:         { label: 'Kills en carril (prom.)',     tooltip: 'Kills durante la fase de carril (aprox. primeros 10 min) por partida',       unit: '',    dec: 1 },
  last_hits_avg:          { label: 'Last Hits (prom.)',           tooltip: 'Last hits de creeps de línea por partida. Métrica clave de farm.',            unit: '',    dec: 1 },
  level_avg:              { label: 'Nivel promedio',              tooltip: 'Nivel promedio de los héroes al terminar la partida',                         unit: '',    dec: 1 },
  neutral_kills_avg:      { label: 'Neutral kills (prom.)',       tooltip: 'Kills de creeps neutros (jungle) por partida',                               unit: '',    dec: 1 },
  observer_kills_avg:     { label: 'Observer kills',              tooltip: 'Wards observer destruidos por partida. Refleja la visión negada al enemigo.', unit: '',   dec: 2 },
  observer_uses_avg:      { label: 'Observers usados',            tooltip: 'Wards observer colocadas por partida. Mide la inversión en visión del mapa.', unit: '',   dec: 2 },
  roshan_kills_avg:       { label: 'Roshan kills (prom.)',        tooltip: 'Frecuencia de matar a Roshan por partida. Valor < 1 significa que no siempre se mata en cada partida.', unit: '', dec: 2 },
  sentry_kills_avg:       { label: 'Sentry kills',                tooltip: 'Wards sentry destruidas por partida. Indica la desvision activa del equipo.', unit: '',  dec: 2 },
  sentry_uses_avg:        { label: 'Sentries usados',             tooltip: 'Wards sentry colocadas por partida. Refleja la inversión en desvision.',     unit: '',    dec: 2 },
  total_gold_avg:         { label: 'Oro total (prom.)',           tooltip: 'Oro total neto acumulado durante la partida',                                 unit: '',    dec: 0, large: true },
  total_xp_avg:           { label: 'XP total (prom.)',            tooltip: 'Experiencia total obtenida por el equipo durante la partida',                unit: '',    dec: 0, large: true },
  tower_damage_avg:       { label: 'Daño a torres (prom.)',       tooltip: 'Daño total infligido a torres por partida',                                  unit: '',    dec: 0, large: true },
  tower_kills_avg:        { label: 'Torres destruidas (prom.)',   tooltip: 'Torres destruidas por partida. Valor < 1 es normal en partidas cortas.',      unit: '',    dec: 2 },
  xp_per_min_avg:         { label: 'XPM (exp/min)',               tooltip: 'Experiencia por minuto — mide el ritmo de crecimiento del equipo',           unit: '',    dec: 0 },
};

// ─── Formateador de estadísticas ─────────────────────────────────────────────
function fmtStat(key, value) {
  if (value == null) return '—';
  const cfg = STAT_CONFIG[key];
  if (!cfg) return (+value).toFixed(2);

  let v = cfg.transform ? cfg.transform(+value) : +value;
  let str;

  if (cfg.large && Math.abs(v) >= 1000) {
    str = (v / 1000).toFixed(1) + 'k';
  } else {
    str = v.toFixed(cfg.dec);
  }
  if (cfg.unit) str += '\u202f' + cfg.unit; // espacio fino antes de la unidad
  return str;
}

// Formato genérico para valores sueltos (tabla, KNN)
const fmt = (v, dec = 2) => (v == null ? '—' : (+v).toFixed(dec));

// Crea los badges de ganador
function badgeGanador(ganador) {
  return ganador === 'Radiant'
    ? '<span class="badge-radiant"><i class="bi bi-circle-fill" style="font-size:.45rem;vertical-align:middle"></i> Radiant</span>'
    : '<span class="badge-dire"><i class="bi bi-circle-fill" style="font-size:.45rem;vertical-align:middle"></i> Dire</span>';
}

// Escapa caracteres HTML para atributos (usado en popovers)
function escAttr(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

// Fallback DOM para imágenes rotas
function heroFallback(size = 84) {
  const d = document.createElement('div');
  d.className = 'hero-circle-fallback';
  d.style.width = size + 'px';
  d.style.height = size + 'px';
  d.style.fontSize = (size * 0.38) + 'px';
  d.innerHTML = '<i class="bi bi-shield-fill"></i>';
  return d;
}

// ─── Héroes del meta — almacén global ────────────────────────────────────────
// Necesario para que los popovers Bootstrap accedan a los datos dinámicamente
// sin pasar HTML en atributos data-* (eso rompe los estilos al escapar < >).
let metaHeroes  = [];
let metaCargada = false;

// Construye el HTML del popover rico de un héroe (se llama via content() de Bootstrap)
function buildHeroPopover(h, rank) {
  const wr    = h.winrate;
  const wrClr = wr >= 55 ? 'var(--dota-radiant)' : wr <= 45 ? 'var(--dota-dire)' : 'var(--dota-gold)';
  const wins  = Math.round(h.partidas * wr / 100);
  const loses = h.partidas - wins;
  return `
    <div style="min-width:210px">
      <div style="margin-bottom:10px">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:5px">
          <span style="color:var(--dota-muted);font-size:.72rem">Win Rate</span>
          <strong style="color:${wrClr};font-size:.95rem">${wr}%</strong>
        </div>
        <div style="display:flex;height:10px;border-radius:5px;overflow:hidden">
          <div style="width:${wr}%;background:var(--dota-radiant)"></div>
          <div style="width:${100 - wr}%;background:var(--dota-dire)"></div>
        </div>
        <div style="display:flex;justify-content:space-between;margin-top:3px">
          <span style="font-size:.65rem;color:var(--dota-radiant)">✓ ${wins.toLocaleString()} victorias</span>
          <span style="font-size:.65rem;color:var(--dota-dire)">✗ ${loses.toLocaleString()} derrotas</span>
        </div>
      </div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:6px;margin-bottom:8px">
        <div style="background:rgba(255,255,255,.04);border-radius:4px;padding:6px 8px">
          <div style="font-size:.63rem;color:var(--dota-muted);margin-bottom:2px">Partidas jugadas</div>
          <div style="font-size:.88rem;font-weight:700">${h.partidas.toLocaleString()}</div>
        </div>
        <div style="background:rgba(255,255,255,.04);border-radius:4px;padding:6px 8px">
          <div style="font-size:.63rem;color:var(--dota-muted);margin-bottom:2px">Rank por uso</div>
          <div style="font-size:.88rem;font-weight:700;color:var(--dota-gold)">#${rank + 1}</div>
        </div>
      </div>
      <div style="height:1px;background:rgba(255,255,255,.07);margin-bottom:7px"></div>
      <div style="font-size:.69rem;color:var(--dota-muted);line-height:1.5">
        <span style="color:var(--dota-gold);font-weight:600">Pick rate acumulado: ${h.freq.toFixed(1)}</span><br>
        Suma de tasas de pick de todos los equipos que usaron este héroe.<br>
        Ej: 15.0 = 15 equipos distintos lo eligieron en promedio 1 vez.
      </div>
    </div>`;
}

// ─── Navegación de pestañas ───────────────────────────────────────────────────
document.getElementById('mainNav').addEventListener('click', e => {
  const btn = e.target.closest('button');
  if (!btn) return;
  document.querySelectorAll('.nav-dota button').forEach(b => b.classList.remove('active'));
  document.querySelectorAll('.tab-panel').forEach(p => p.classList.remove('active'));
  btn.classList.add('active');
  document.getElementById(btn.dataset.tab).classList.add('active');
  // Auto-cargar la primera vez que se abre la pestaña de héroes
  if (btn.dataset.tab === 'tab-meta' && !metaCargada) cargarMeta();
});

// ─── Stats bar ────────────────────────────────────────────────────────────────
async function cargarStats() {
  try {
    const r = await fetch('/api/stats');
    const d = await r.json();
    document.getElementById('sTotal').textContent   = d.total_partidas.toLocaleString();
    document.getElementById('sRadiant').textContent = d.radiant_wins.toLocaleString();
    document.getElementById('sDire').textContent    = d.dire_wins.toLocaleString();
    document.getElementById('sWrR').textContent     = d.winrate_radiant + '%';
    document.getElementById('sWrD').textContent     = d.winrate_dire + '%';
    document.getElementById('sPrimera').textContent = d.primera_partida?.slice(0, 10) ?? '—';
    document.getElementById('sUltima').textContent  = d.ultima_partida?.slice(0, 10) ?? '—';
  } catch (e) { console.error('Error stats:', e); }
}

// ─── TAB 1: Partidas ─────────────────────────────────────────────────────────
async function cargarPartidas(pag = 1) {
  paginaActual = pag;
  const ganador = document.getElementById('filtroGanador').value;
  const buscar  = document.getElementById('filtroBuscar').value.trim();

  document.getElementById('tablaPartidas').innerHTML = '<div class="spinner-dota"></div>';

  const url = `/api/partidas?page=${pag}&per_page=${POR_PAGINA}&ganador=${ganador}`;
  const r   = await fetch(url);
  const d   = await r.json();

  let partidas = d.partidas;
  if (buscar) {
    partidas = partidas.filter(p => String(p.match_id).includes(buscar));
  }

  document.getElementById('countPartidas').textContent =
    `${d.total.toLocaleString()} partidas · pág ${d.pagina}/${d.paginas}`;

  const html = `
    <table class="table-dota">
      <thead>
        <tr>
          <th>Match ID</th>
          <th>Fecha</th>
          <th>Ganador</th>
          <th title="Win Rate histórico del equipo Radiant">WR Radiant</th>
          <th title="KDA = (Kills + Asistencias) ÷ Muertes — ratio, no conteo">KDA Radiant</th>
          <th title="Oro por minuto promedio — Radiant">GPM Radiant</th>
          <th title="Win Rate histórico del equipo Dire">WR Dire</th>
          <th title="KDA = (Kills + Asistencias) ÷ Muertes — ratio, no conteo">KDA Dire</th>
          <th title="Oro por minuto promedio — Dire">GPM Dire</th>
          <th></th>
        </tr>
      </thead>
      <tbody>
        ${partidas.map(p => `
          <tr onclick="irDetalle(${p.match_id})">
            <td style="font-weight:700;color:var(--dota-gold)">${p.match_id}</td>
            <td style="color:var(--dota-muted)">${p.dt_match?.slice(0, 10) ?? '—'}</td>
            <td>${badgeGanador(p.ganador)}</td>
            <td style="color:var(--dota-radiant)">${fmt(p.win_pct_r, 1)}%</td>
            <td style="color:var(--dota-radiant)">${fmt(p.kda_avg_r, 2)}</td>
            <td style="color:var(--dota-radiant)">${fmt(p.gold_per_min_avg_r, 0)}</td>
            <td style="color:var(--dota-dire)">${fmt(p.win_pct_d, 1)}%</td>
            <td style="color:var(--dota-dire)">${fmt(p.kda_avg_d, 2)}</td>
            <td style="color:var(--dota-dire)">${fmt(p.gold_per_min_avg_d, 0)}</td>
            <td style="color:var(--dota-muted);font-size:.75rem"><i class="bi bi-chevron-right"></i></td>
          </tr>`).join('')}
      </tbody>
    </table>`;

  document.getElementById('tablaPartidas').innerHTML = html;
  renderPaginacion(d.paginas, pag);
}

function renderPaginacion(totalPags, actual) {
  const cont    = document.getElementById('paginacion');
  const maxBtns = 7;
  let inicio = Math.max(1, actual - 3);
  let fin    = Math.min(totalPags, inicio + maxBtns - 1);
  if (fin - inicio < maxBtns - 1) inicio = Math.max(1, fin - maxBtns + 1);

  let html = `<button class="pag-btn" onclick="cargarPartidas(${actual - 1})" ${actual === 1 ? 'disabled' : ''}><i class="bi bi-chevron-left"></i></button>`;
  for (let i = inicio; i <= fin; i++) {
    html += `<button class="pag-btn ${i === actual ? 'active' : ''}" onclick="cargarPartidas(${i})">${i}</button>`;
  }
  html += `<button class="pag-btn" onclick="cargarPartidas(${actual + 1})" ${actual === totalPags ? 'disabled' : ''}><i class="bi bi-chevron-right"></i></button>`;
  cont.innerHTML = html;
}

function irDetalle(matchId) {
  document.getElementById('inputMatchDetalle').value = matchId;
  document.querySelectorAll('.nav-dota button').forEach(b => b.classList.remove('active'));
  document.querySelectorAll('.tab-panel').forEach(p => p.classList.remove('active'));
  document.querySelector('[data-tab="tab-detalle"]').classList.add('active');
  document.getElementById('tab-detalle').classList.add('active');
  cargarDetalle(matchId);
}

// ─── TAB 2: Héroes del Meta ───────────────────────────────────────────────────
async function cargarMeta() {
  metaCargada = true;
  const top   = document.getElementById('topHeroes').value;
  const orden = document.getElementById('ordenHeroes').value;
  const grid  = document.getElementById('heroGrid');
  grid.innerHTML = '<div class="spinner-dota" style="grid-column:1/-1"></div>';

  // Destruir popovers anteriores para evitar fugas de memoria
  document.querySelectorAll('.hero-meta-card').forEach(el => {
    const inst = bootstrap.Popover.getInstance(el);
    if (inst) inst.dispose();
  });

  const r = await fetch(`/api/heroes/meta?top=${top}`);
  let heroes = await r.json();

  if (orden === 'winrate') heroes.sort((a, b) => b.winrate - a.winrate);
  metaHeroes = heroes; // almacenar globalmente para content() de popovers

  if (!heroes.length) {
    grid.innerHTML = '<div class="empty-state" style="grid-column:1/-1"><i class="bi bi-emoji-frown"></i>Sin datos de héroes disponibles</div>';
    return;
  }

  grid.innerHTML = heroes.map((h, i) => {
    const wr    = h.winrate;
    const wrCls = wr >= 55 ? 'wr-high' : wr <= 45 ? 'wr-low' : 'wr-mid';
    const imgTag = h.icono
      ? `<img class="hero-circle-img" src="${h.icono}" alt="${h.nombre}" loading="lazy"
              onerror="this.replaceWith(heroFallback(84))">`
      : `<div class="hero-circle-fallback"><i class="bi bi-shield-fill"></i></div>`;

    return `
      <div class="hero-meta-card" data-hero-idx="${i}">
        <div class="hero-circle-wrapper">
          ${imgTag}
          <div class="hero-wr-badge ${wrCls}">${wr}%</div>
        </div>
        <div class="hero-meta-name">${h.nombre}</div>
        <div style="font-size:.6rem;color:var(--dota-muted);text-align:center;margin-top:-2px">${h.partidas.toLocaleString()} partidas</div>
      </div>`;
  }).join('');

  // Inicializar Bootstrap Popovers con content() funcional
  // ⚠ NO usar data-bs-content con HTML porque Bootstrap lo sanitiza y escapa los estilos
  document.querySelectorAll('.hero-meta-card[data-hero-idx]').forEach(el => {
    const idx = parseInt(el.dataset.heroIdx);
    const h   = metaHeroes[idx];
    new bootstrap.Popover(el, {
      container: 'body',
      html:      true,
      trigger:   'hover focus',
      placement: 'top',
      sanitize:  false,
      title:     h.nombre,
      content:   () => buildHeroPopover(h, idx),
    });
  });
}

// ─── TAB 3: Detalle de Partida ────────────────────────────────────────────────
async function cargarDetalle(matchId) {
  const id   = matchId ?? document.getElementById('inputMatchDetalle').value.trim();
  const cont = document.getElementById('detalleContenido');
  if (!id) return;

  cont.innerHTML = '<div class="spinner-dota"></div>';

  const r = await fetch(`/api/partida/${id}`);
  if (!r.ok) {
    cont.innerHTML = `<div class="empty-state"><i class="bi bi-exclamation-triangle"></i>Partida ${id} no encontrada</div>`;
    return;
  }
  const d = await r.json();

  // Filas de estadísticas comparativas usando STAT_CONFIG
  const filaStats = Object.entries(STAT_CONFIG).map(([key, cfg]) => {
    const vr = d.radiant?.stats?.[key];
    const vd = d.dire?.stats?.[key];
    const nr = fmtStat(key, vr);
    const nd = fmtStat(key, vd);

    // Calcular proporción para la barra comparativa (valores transformados)
    const rawR = vr != null ? (cfg.transform ? cfg.transform(+vr) : +vr) : 0;
    const rawD = vd != null ? (cfg.transform ? cfg.transform(+vd) : +vd) : 0;
    const sumv = rawR + rawD;
    const pctR = sumv > 0 ? Math.round((rawR / sumv) * 100) : 50;
    const pctD = 100 - pctR;

    return `
      <div class="stat-row" title="${escAttr(cfg.tooltip)}">
        <span class="stat-val-r" style="width:100px;text-align:right">${nr}</span>
        <div style="flex:1;padding:0 1rem">
          <div class="stat-label" style="text-align:center;margin-bottom:3px">${cfg.label}</div>
          <div style="display:flex;height:5px;border-radius:3px;overflow:hidden">
            <div style="width:${pctR}%;background:var(--dota-radiant)"></div>
            <div style="width:${pctD}%;background:var(--dota-dire)"></div>
          </div>
        </div>
        <span class="stat-val-d" style="width:100px;text-align:left">${nd}</span>
      </div>`;
  }).join('');

  // Lista de héroes con imagen circular y pick rate visual
  // El número 0.067 = héroe elegido en el 6.7% de las partidas del equipo
  // (ej: 1 partido de cada 15 en la ventana de historial)
  const heroesHtml = (heroes, color) => {
    if (!heroes || heroes.length === 0) {
      return `<div style="padding:.75rem;font-size:.75rem;color:var(--dota-muted);font-style:italic;text-align:center">
        <i class="bi bi-exclamation-triangle me-1"></i>Sin datos de héroes para este equipo<br>
        <span style="font-size:.65rem">(~6% de partidas en el dataset no tienen historial de picks)</span>
      </div>`;
    }
    return heroes.map(h => {
    const pr    = h.frecuencia;
    const prPct = Math.min(100, Math.round(pr * 100));
    return `
    <div style="display:flex;align-items:center;gap:.55rem;padding:.4rem 0;border-bottom:1px solid var(--dota-border)">
      ${h.icono
        ? `<img src="${h.icono}" class="hero-detail-img" alt="${h.nombre}"
                onerror="this.replaceWith(heroFallback(44))">`
        : `<div class="hero-detail-fallback"><i class="bi bi-shield-fill"></i></div>`}
      <div style="flex:1;min-width:0">
        <div style="font-size:.8rem;font-weight:600;color:${color};white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${h.nombre}</div>
        <div style="display:flex;align-items:center;gap:.35rem;margin-top:3px">
          <div style="flex:1;height:4px;background:var(--dota-border);border-radius:2px;overflow:hidden">
            <div style="width:${prPct}%;height:100%;background:${color};opacity:.75;border-radius:2px"></div>
          </div>
          <span style="font-size:.63rem;color:var(--dota-muted);white-space:nowrap;flex-shrink:0"
                title="Pick rate: este héroe fue elegido en el ${prPct}% de las partidas del equipo (${pr.toFixed(3)} en escala 0-1). En Dota 2 hay 5 héroes por partida, pero en el historial del equipo se usan muchos más — aquí ves qué tan frecuente fue cada uno.">${prPct}% picks</span>
        </div>
      </div>
    </div>`;
  }).join('');
  };

  // ── Aviso si la fila es incompleta (sin historial de equipo) ───────────────
  const avisoIncompleto = !d.datos_completos
    ? `<div style="background:rgba(200,151,58,.12);border:1px solid rgba(200,151,58,.35);border-radius:6px;padding:.7rem 1rem;margin-bottom:.75rem;font-size:.8rem;color:var(--dota-gold)">
        <i class="bi bi-exclamation-triangle me-1"></i>
        <strong>Datos incompletos</strong> — Esta partida no tiene historial de equipo registrado.
        Solo existe el resultado (quién ganó). El ~6% del dataset tiene este problema:
        los equipos no tenían partidas previas en la ventana de análisis cuando se construyó el dataset.
      </div>`
    : '';

  const ventanaInfo = (v, color) => v
    ? `<span style="font-size:.65rem;color:${color};opacity:.7" title="El equipo tiene estadísticas promediadas sobre ${v} partidas previas a este match. Más partidas = más héroes distintos con valores > 0.">${v} partidas en ventana</span>`
    : '';

  cont.innerHTML = `
    <div class="d-flex align-items-center gap-3 flex-wrap mb-2">
      <span style="font-size:1.2rem;font-weight:800;color:var(--dota-gold)">Match #${d.match_id}</span>
      <span style="color:var(--dota-muted);font-size:.85rem">${d.dt_match?.slice(0, 10) ?? ''}</span>
      ${badgeGanador(d.ganador)}
      <button class="btn-dota-outline ms-auto" onclick="lanzarKNNDesdeDetalle(${d.match_id})">
        <i class="bi bi-diagram-3"></i> Ver partidas similares (KNN)
      </button>
    </div>

    <div class="row g-3">
      <div class="col-12 col-lg-7">
        <div class="card-dota">
          <div class="card-header-dota d-flex justify-content-between align-items-center">
            <span style="color:var(--dota-radiant)">● Radiant</span>
            <span>Estadísticas por equipo</span>
            <span style="color:var(--dota-dire)">● Dire</span>
          </div>
          <div style="padding:.75rem 1rem;max-height:530px;overflow-y:auto">
            ${filaStats}
          </div>
        </div>
      </div>

      <div class="col-12 col-lg-5">
        <div class="row g-3">
          <div class="col-6">
            <div class="card-dota">
              <div class="card-header-dota" style="color:var(--dota-radiant);display:flex;justify-content:space-between;align-items:center">
                <span>Radiant — Héroes</span>
                ${ventanaInfo(d.radiant?.ventana, 'var(--dota-radiant)')}
              </div>
              <div style="padding:.5rem .75rem;max-height:420px;overflow-y:auto">
                ${heroesHtml(d.radiant?.heroes ?? [], 'var(--dota-radiant)')}
              </div>
            </div>
          </div>
          <div class="col-6">
            <div class="card-dota">
              <div class="card-header-dota" style="color:var(--dota-dire);display:flex;justify-content:space-between;align-items:center">
                <span>Dire — Héroes</span>
                ${ventanaInfo(d.dire?.ventana, 'var(--dota-dire)')}
              </div>
              <div style="padding:.5rem .75rem;max-height:420px;overflow-y:auto">
                ${heroesHtml(d.dire?.heroes ?? [], 'var(--dota-dire)')}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>`;
}

function lanzarKNNDesdeDetalle(matchId) {
  document.getElementById('inputMatchKnn').value = matchId;
  document.querySelectorAll('.nav-dota button').forEach(b => b.classList.remove('active'));
  document.querySelectorAll('.tab-panel').forEach(p => p.classList.remove('active'));
  document.querySelector('[data-tab="tab-knn"]').classList.add('active');
  document.getElementById('tab-knn').classList.add('active');
  ejecutarKNN();
}

// ─── TAB 4: KNN — Partidas Similares ─────────────────────────────────────────
async function ejecutarKNN() {
  const matchId = document.getElementById('inputMatchKnn').value.trim();
  const k       = parseInt(document.getElementById('inputK').value);
  const cont    = document.getElementById('knnContenido');

  if (!matchId) return;
  cont.innerHTML = '<div class="spinner-dota"></div>';

  const r = await fetch('/api/knn', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ match_id: parseInt(matchId), k }),
  });

  if (!r.ok) {
    cont.innerHTML = `<div class="empty-state"><i class="bi bi-exclamation-triangle"></i>Partida ${matchId} no encontrada</div>`;
    return;
  }
  const d = await r.json();
  const maxDist = d.similares[d.similares.length - 1]?.distancia || 1;

  const refHtml = `
    <div class="card-dota mb-3" style="border-color:var(--dota-gold)">
      <div class="card-header-dota" style="color:var(--dota-gold)">
        <i class="bi bi-bookmark-star"></i> Partida de referencia
      </div>
      <div style="padding:.75rem 1rem;display:flex;gap:2rem;flex-wrap:wrap;align-items:center">
        <div><div style="color:var(--dota-muted);font-size:.72rem">Match ID</div><div style="font-weight:800;color:var(--dota-gold)">${d.partida_referencia.match_id}</div></div>
        <div><div style="color:var(--dota-muted);font-size:.72rem">Fecha</div><div>${d.partida_referencia.dt_match?.slice(0, 10) ?? '—'}</div></div>
        <div><div style="color:var(--dota-muted);font-size:.72rem">Ganador</div>${badgeGanador(d.partida_referencia.ganador)}</div>
        <div><div style="color:var(--dota-muted);font-size:.72rem">Win% Radiant</div><div style="color:var(--dota-radiant)">${fmt(d.partida_referencia.win_pct_r, 1)}%</div></div>
        <div><div style="color:var(--dota-muted);font-size:.72rem">Win% Dire</div><div style="color:var(--dota-dire)">${fmt(d.partida_referencia.win_pct_d, 1)}%</div></div>
      </div>
    </div>`;

  const similHtml = d.similares.map((s, i) => {
    const similPct = Math.max(4, Math.round((1 - s.distancia / maxDist) * 100));
    return `
      <div class="knn-card mb-2" onclick="irDetalle(${s.match_id})" style="cursor:pointer" title="Haz clic para ver el detalle completo">
        <div style="display:flex;align-items:center;gap:1rem;flex-wrap:wrap">
          <div style="width:28px;height:28px;border-radius:50%;background:var(--dota-surface);display:flex;align-items:center;justify-content:center;font-weight:800;font-size:.75rem;color:var(--dota-muted);flex-shrink:0">${i + 1}</div>
          <div><div style="font-size:.72rem;color:var(--dota-muted)">Match ID</div><div style="font-weight:800;color:var(--dota-gold)">${s.match_id}</div></div>
          <div><div style="font-size:.72rem;color:var(--dota-muted)">Fecha</div><div style="font-size:.82rem">${s.dt_match?.slice(0, 10) ?? '—'}</div></div>
          <div><div style="font-size:.72rem;color:var(--dota-muted)">Ganador</div>${badgeGanador(s.ganador)}</div>
          <div>
            <div style="font-size:.72rem;color:var(--dota-muted)">Win% R / D</div>
            <div style="font-size:.82rem">
              <span style="color:var(--dota-radiant)">${fmt(s.win_pct_r, 1)}%</span>
              <span style="color:var(--dota-muted)"> / </span>
              <span style="color:var(--dota-dire)">${fmt(s.win_pct_d, 1)}%</span>
            </div>
          </div>
          <div>
            <div style="font-size:.72rem;color:var(--dota-muted)" title="KDA = (Kills + Asistencias) / Muertes">KDA R / D</div>
            <div style="font-size:.82rem">
              <span style="color:var(--dota-radiant)">${fmt(s.kda_avg_r, 2)}</span>
              <span style="color:var(--dota-muted)"> / </span>
              <span style="color:var(--dota-dire)">${fmt(s.kda_avg_d, 2)}</span>
            </div>
          </div>
          <div class="ms-auto text-end">
            <div style="font-size:.72rem;color:var(--dota-muted)">Distancia KNN</div>
            <div class="knn-dist">${s.distancia.toFixed(3)}</div>
          </div>
        </div>
        <div class="compare-bar mt-2" title="Similaridad relativa — barra más larga = más parecida">
          <div class="compare-fill" style="width:${similPct}%;background:var(--dota-gold)"></div>
        </div>
      </div>`;
  }).join('');

  cont.innerHTML = refHtml +
    `<div style="font-size:.8rem;color:var(--dota-muted);margin-bottom:.75rem;text-transform:uppercase;letter-spacing:.05em">
      <i class="bi bi-diagram-3"></i> ${d.k} partidas más similares · algoritmo KNN euclidiano con normalización StandardScaler
    </div>` + similHtml;
}

// ─── Inicio de la aplicación ─────────────────────────────────────────────────
cargarStats();
cargarPartidas(1);
