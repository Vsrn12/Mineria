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
let graficosInit = false;  // charts solo se crean una vez

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
  // Auto-cargar gráficos la primera vez
  if (btn.dataset.tab === 'tab-graficos' && !graficosInit) cargarGraficos();
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

// Grupos de estadísticas para el detalle de partida
const STAT_GROUPS = [
  { nombre: 'Rendimiento',    icono: 'bi-trophy',        keys: ['win_pct','kda_avg','hero_kills_avg','deaths_avg','assists_avg','kills_per_min_avg'] },
  { nombre: 'Economía',       icono: 'bi-coin',          keys: ['gold_per_min_avg','xp_per_min_avg','total_gold_avg','gold_spent_avg','last_hits_avg','gold_avg'] },
  { nombre: 'Combate',        icono: 'bi-lightning-fill',keys: ['hero_damage_avg','hero_healing_avg','firstblood_claimed_avg','buyback_count_avg','courier_kills_avg'] },
  { nombre: 'Objetivos',      icono: 'bi-flag-fill',     keys: ['tower_kills_avg','tower_damage_avg','roshan_kills_avg','ancient_kills_avg','neutral_kills_avg'] },
  { nombre: 'Visión de mapa', icono: 'bi-eye',           keys: ['observer_uses_avg','observer_kills_avg','sentry_uses_avg','sentry_kills_avg'] },
  { nombre: 'Detalles',       icono: 'bi-three-dots',    keys: ['duration_avg_win','duration_avg_lose','actions_per_min_avg','level_avg','purchase_tpscroll_avg','lane_kills_avg','denies_avg','necronomicon_kills_avg'] },
];

// Genera una fila de stat comparativa (Radiant | label+bar | Dire)
function statRow(key, cfg, vr, vd) {
  const nr   = fmtStat(key, vr);
  const nd   = fmtStat(key, vd);
  const rawR = vr != null ? (cfg.transform ? cfg.transform(+vr) : +vr) : 0;
  const rawD = vd != null ? (cfg.transform ? cfg.transform(+vd) : +vd) : 0;
  const sumv = rawR + rawD;
  const pctR = sumv > 0 ? Math.round((rawR / sumv) * 100) : 50;
  const pctD = 100 - pctR;
  return `
    <div class="stat-row" title="${escAttr(cfg.tooltip)}">
      <span class="stat-val-r">${nr}</span>
      <div class="stat-mid">
        <div class="stat-label">${cfg.label}</div>
        <div class="stat-bar">
          <div style="width:${pctR}%;background:var(--dota-radiant)"></div>
          <div style="width:${pctD}%;background:var(--dota-dire)"></div>
        </div>
      </div>
      <span class="stat-val-d">${nd}</span>
    </div>`;
}

// Lista de héroes (5 máximo)
function heroesHtml(heroes, color) {
  if (!heroes || heroes.length === 0) {
    return `<div style="padding:.75rem;font-size:.75rem;color:var(--dota-muted);font-style:italic;text-align:center">
      <i class="bi bi-exclamation-triangle me-1"></i>Sin datos de héroes</div>`;
  }
  return heroes.map(h => {
    const pr    = h.frecuencia;
    const prPct = Math.min(100, Math.round(pr * 100));
    return `
    <div class="hero-list-row">
      ${h.icono
        ? `<img src="${h.icono}" loading="lazy" decoding="async" class="hero-detail-img" alt="${h.nombre}" onerror="this.replaceWith(heroFallback(40))">`
        : `<div class="hero-detail-fallback"><i class="bi bi-shield-fill"></i></div>`}
      <div style="flex:1;min-width:0">
        <div style="font-size:.8rem;font-weight:600;color:${color};white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${h.nombre}</div>
        <div style="display:flex;align-items:center;gap:.35rem;margin-top:2px">
          <div style="flex:1;height:3px;background:var(--dota-border);border-radius:2px;overflow:hidden">
            <div style="width:${prPct}%;height:100%;background:${color};opacity:.7;border-radius:2px"></div>
          </div>
          <span style="font-size:.6rem;color:var(--dota-muted);white-space:nowrap">${prPct}% picks</span>
        </div>
      </div>
    </div>`;
  }).join('');
}

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

  // ── Key stats destacados (6 métricas principales en tarjetas grandes) ──────
  const KEY_STATS = ['win_pct','kda_avg','gold_per_min_avg','xp_per_min_avg','hero_kills_avg','tower_kills_avg'];
  const keyStatsHtml = KEY_STATS.map(key => {
    const cfg = STAT_CONFIG[key];
    if (!cfg) return '';
    const vr = d.radiant?.stats?.[key];
    const vd = d.dire?.stats?.[key];
    const nr = fmtStat(key, vr);
    const nd = fmtStat(key, vd);
    const rawR = vr != null ? (cfg.transform ? cfg.transform(+vr) : +vr) : 0;
    const rawD = vd != null ? (cfg.transform ? cfg.transform(+vd) : +vd) : 0;
    const sumv = rawR + rawD;
    const pctR = sumv > 0 ? Math.round((rawR / sumv) * 100) : 50;
    return `
      <div class="key-stat-card" title="${escAttr(cfg.tooltip)}">
        <div class="ks-label">${cfg.label}</div>
        <div class="ks-values">
          <span class="ks-r">${nr}</span>
          <span class="ks-sep">vs</span>
          <span class="ks-d">${nd}</span>
        </div>
        <div class="ks-bar">
          <div style="width:${pctR}%;background:var(--dota-radiant)"></div>
          <div style="width:${100-pctR}%;background:var(--dota-dire)"></div>
        </div>
      </div>`;
  }).join('');

  // ── Grupos de estadísticas ────────────────────────────────────────────────
  const gruposHtml = STAT_GROUPS.map((g, gi) => {
    const filas = g.keys.map(key => {
      const cfg = STAT_CONFIG[key];
      if (!cfg) return '';
      return statRow(key, cfg, d.radiant?.stats?.[key], d.dire?.stats?.[key]);
    }).join('');
    const expanded = gi < 2 ? 'show' : '';
    return `
      <div class="stat-group">
        <button class="stat-group-header" onclick="toggleGroup(this)" aria-expanded="${gi < 2}">
          <i class="bi ${g.icono}"></i>
          ${g.nombre}
          <i class="bi bi-chevron-down ms-auto stat-group-arrow"></i>
        </button>
        <div class="stat-group-body ${expanded}">${filas}</div>
      </div>`;
  }).join('');

  const ventanaInfo = (v, color) => v
    ? `<span class="ventana-badge" style="color:${color}">${v} partidas en ventana</span>`
    : '';

  cont.innerHTML = `
    <div class="detalle-header">
      <span class="detalle-match-id">Match #${d.match_id}</span>
      <span class="detalle-date">${d.dt_match?.slice(0, 10) ?? ''}</span>
      ${badgeGanador(d.ganador)}
      <button class="btn-dota-outline ms-auto" onclick="lanzarKNNDesdeDetalle(${d.match_id})">
        <i class="bi bi-diagram-3"></i> Partidas similares
      </button>
    </div>

    <div class="key-stats-strip">${keyStatsHtml}</div>

    <div class="row g-3 mt-0">
      <div class="col-12 col-lg-7">
        <div class="card-dota">
          <div class="card-header-dota" style="display:flex;justify-content:space-between">
            <span style="color:var(--dota-radiant)">● Radiant</span>
            <span style="color:var(--dota-muted);font-size:.75rem">Estadísticas históricas del equipo</span>
            <span style="color:var(--dota-dire)">Dire ●</span>
          </div>
          <div style="padding:.5rem .75rem">${gruposHtml}</div>
        </div>
      </div>
      <div class="col-12 col-lg-5">
        <div class="row g-3">
          <div class="col-6">
            <div class="card-dota h-100">
              <div class="card-header-dota" style="color:var(--dota-radiant);display:flex;justify-content:space-between;align-items:center">
                <span><i class="bi bi-person-fill me-1"></i>Radiant</span>
                ${ventanaInfo(d.radiant?.ventana, 'var(--dota-radiant)')}
              </div>
              <div style="padding:.5rem .75rem">
                ${heroesHtml(d.radiant?.heroes ?? [], 'var(--dota-radiant)')}
              </div>
            </div>
          </div>
          <div class="col-6">
            <div class="card-dota h-100">
              <div class="card-header-dota" style="color:var(--dota-dire);display:flex;justify-content:space-between;align-items:center">
                <span><i class="bi bi-person-fill me-1"></i>Dire</span>
                ${ventanaInfo(d.dire?.ventana, 'var(--dota-dire)')}
              </div>
              <div style="padding:.5rem .75rem">
                ${heroesHtml(d.dire?.heroes ?? [], 'var(--dota-dire)')}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>`;
}

function toggleGroup(btn) {
  const body = btn.nextElementSibling;
  const open = body.classList.toggle('show');
  btn.setAttribute('aria-expanded', open);
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

// Renderiza lista de héroes pequeños para tarjetas KNN
function heroesKnnHtml(heroes, color) {
  if (!heroes || heroes.length === 0) return '<span style="font-size:.68rem;color:var(--dota-muted)">Sin datos</span>';
  return `<div style="display:flex;flex-wrap:wrap;gap:4px;margin-top:4px">` +
    heroes.map(h => h.icono
      ? `<img src="${h.icono}" loading="lazy" decoding="async"
              title="${escAttr(h.nombre)} (${Math.round(h.frecuencia*100)}% picks)"
              style="width:32px;height:32px;border-radius:50%;object-fit:cover;object-position:center 15%;border:1px solid ${color};background:var(--dota-surface)"
              onerror="this.style.display='none'">`
      : `<div style="width:32px;height:32px;border-radius:50%;background:var(--dota-surface);border:1px solid var(--dota-border);display:flex;align-items:center;justify-content:center;font-size:.6rem;color:var(--dota-muted)"><i class="bi bi-shield-fill"></i></div>`
    ).join('') + `</div>`;
}

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
        <div style="display:flex;gap:1.2rem;margin-top:.6rem;padding-top:.5rem;border-top:1px solid var(--dota-border)">
          <div style="flex:1">
            <div style="font-size:.65rem;color:var(--dota-radiant);text-transform:uppercase;letter-spacing:.05em;margin-bottom:3px">
              <i class="bi bi-person-fill"></i> Radiant — Top ${(s.heroes_r||[]).length} héroes
            </div>
            ${heroesKnnHtml(s.heroes_r, 'var(--dota-radiant)')}
          </div>
          <div style="flex:1">
            <div style="font-size:.65rem;color:var(--dota-dire);text-transform:uppercase;letter-spacing:.05em;margin-bottom:3px">
              <i class="bi bi-person-fill"></i> Dire — Top ${(s.heroes_d||[]).length} héroes
            </div>
            ${heroesKnnHtml(s.heroes_d, 'var(--dota-dire)')}
          </div>
        </div>
      </div>`;
  }).join('');

  cont.innerHTML = refHtml +
    `<div style="font-size:.8rem;color:var(--dota-muted);margin-bottom:.75rem;text-transform:uppercase;letter-spacing:.05em">
      <i class="bi bi-diagram-3"></i> ${d.k} partidas más similares · algoritmo KNN euclidiano con normalización StandardScaler
    </div>` + similHtml;
}

// ─── TAB 5: Gráficos ─────────────────────────────────────────────────────────
async function cargarGraficos() {
  graficosInit = true;
  const r = await fetch('/api/graficos');
  if (!r.ok) return;
  const d = await r.json();
  // Ordenar por winrate desc para que las barras fluyan de mayor a menor (no "chueco")
  const topHeroes = [...d.top50_heroes].sort((a, b) => b.winrate - a.winrate);
  const gpmXpm   = d.gpm_xpm;
  const winRates = d.win_rates;
  const anomaly  = d.anomaly;

  const gridColor  = 'rgba(255,255,255,0.06)';
  const fontColor  = '#6a7a90';
  const chartDefaults = {
    color: fontColor,
    font: { family: "'Segoe UI', system-ui, sans-serif", size: 11 },
  };
  Chart.defaults.color       = chartDefaults.color;
  Chart.defaults.font.family = chartDefaults.font.family;
  Chart.defaults.font.size   = chartDefaults.font.size;

  // ── GRÁFICO 1: Win Rate de Top 50 Héroes ──────────────────────────────────
  const ctx1   = document.getElementById('chartHeroes').getContext('2d');
  const labels = topHeroes.map(h => h.nombre);
  const values = topHeroes.map(h => h.winrate);
  const colors = values.map(v =>
    v >= 55 ? 'rgba(92,191,138,0.82)' :
    v <= 45 ? 'rgba(191,92,92,0.82)' :
              'rgba(200,151,58,0.82)'
  );
  new Chart(ctx1, {
    type: 'bar',
    data: {
      labels,
      datasets: [{
        label: 'Win Rate (%)',
        data: values,
        backgroundColor: colors,
        borderColor: colors.map(c => c.replace('0.82', '1')),
        borderWidth: 1,
        borderRadius: 3,
      }],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: {
          callbacks: {
            label: ctx => {
              const h = topHeroes[ctx.dataIndex];
              return [
                ` Win Rate: ${ctx.parsed.y}%`,
                ` Partidas: ${h.partidas.toLocaleString()}`,
                ` Pick freq: ${h.freq.toFixed(1)}`,
              ];
            },
          },
        },
      },
      scales: {
        x: {
          ticks: { maxRotation: 55, minRotation: 45, font: { size: 9 } },
          grid: { color: gridColor },
        },
        y: {
          min: 40,
          max: 65,
          ticks: { callback: v => v + '%' },
          grid: { color: gridColor },
        },
      },
    },
  });

  // ── GRÁFICO 2: GPM y XPM ─────────────────────────────────────────────────
  const ctx2 = document.getElementById('chartGpmXpm').getContext('2d');
  new Chart(ctx2, {
    type: 'bar',
    data: {
      labels: ['Radiant', 'Dire'],
      datasets: [
        {
          label: 'GPM (Oro/min)',
          data: [gpmXpm.radiant_gpm, gpmXpm.dire_gpm],
          backgroundColor: ['rgba(92,191,138,0.75)', 'rgba(191,92,92,0.75)'],
          borderColor:     ['rgba(92,191,138,1)',     'rgba(191,92,92,1)'],
          borderWidth: 1, borderRadius: 4, yAxisID: 'y',
        },
        {
          label: 'XPM (Exp/min)',
          data: [gpmXpm.radiant_xpm, gpmXpm.dire_xpm],
          backgroundColor: ['rgba(92,191,138,0.35)', 'rgba(191,92,92,0.35)'],
          borderColor:     ['rgba(92,191,138,.7)',    'rgba(191,92,92,.7)'],
          borderWidth: 1, borderRadius: 4, yAxisID: 'y',
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { position: 'top' } },
      scales: {
        y: { grid: { color: gridColor }, ticks: { callback: v => v.toLocaleString() } },
        x: { grid: { color: gridColor } },
      },
    },
  });

  // ── GRÁFICO 3: Winrate Donut ───────────────────────────────────────────────
  const ctx3 = document.getElementById('chartWinrate').getContext('2d');
  new Chart(ctx3, {
    type: 'doughnut',
    data: {
      labels: [`Radiant ${winRates.radiant_pct}%`, `Dire ${winRates.dire_pct}%`],
      datasets: [{
        data: [winRates.radiant_wins, winRates.dire_wins],
        backgroundColor: ['rgba(92,191,138,0.80)', 'rgba(191,92,92,0.80)'],
        borderColor:     ['rgba(92,191,138,1)',     'rgba(191,92,92,1)'],
        borderWidth: 2,
        hoverOffset: 8,
      }],
    },
    options: {
      responsive: true,
      maintainAspectRatio: true,
      cutout: '65%',
      plugins: {
        legend: { position: 'bottom' },
        tooltip: {
          callbacks: {
            label: ctx => ` ${ctx.label}: ${ctx.parsed.toLocaleString()} partidas`,
          },
        },
      },
    },
  });

  // ── GRÁFICO 4: Anomalías por año ──────────────────────────────────────────
  // Stats summary de anomalías
  const anomBox = document.getElementById('anomalyStats');
  anomBox.innerHTML = `
    <div style="display:flex;gap:1.5rem;flex-wrap:wrap;font-size:.82rem">
      <div style="background:rgba(191,92,92,.1);border:1px solid rgba(191,92,92,.3);border-radius:6px;padding:.6rem 1rem">
        <div style="color:var(--dota-muted);font-size:.7rem">Total partidas</div>
        <div style="font-weight:800;font-size:1.1rem;color:var(--dota-gold)">${anomaly.total.toLocaleString()}</div>
      </div>
      <div style="background:rgba(92,191,138,.1);border:1px solid rgba(92,191,138,.3);border-radius:6px;padding:.6rem 1rem">
        <div style="color:var(--dota-muted);font-size:.7rem">Partidas válidas</div>
        <div style="font-weight:800;font-size:1.1rem;color:var(--dota-radiant)">${anomaly.valid.toLocaleString()}</div>
      </div>
      <div style="background:rgba(191,92,92,.1);border:1px solid rgba(191,92,92,.3);border-radius:6px;padding:.6rem 1rem">
        <div style="color:var(--dota-muted);font-size:.7rem">Sin héroes (ambos equipos)</div>
        <div style="font-weight:800;font-size:1.1rem;color:var(--dota-dire)">${anomaly.no_heroes_both.toLocaleString()}</div>
      </div>
      <div style="background:rgba(200,151,58,.1);border:1px solid rgba(200,151,58,.3);border-radius:6px;padding:.6rem 1rem">
        <div style="color:var(--dota-muted);font-size:.7rem">Sin héroes solo Radiant</div>
        <div style="font-weight:800;font-size:1.1rem;color:var(--dota-gold)">${anomaly.no_heroes_r.toLocaleString()}</div>
      </div>
      <div style="background:rgba(200,151,58,.1);border:1px solid rgba(200,151,58,.3);border-radius:6px;padding:.6rem 1rem">
        <div style="color:var(--dota-muted);font-size:.7rem">Sin héroes solo Dire</div>
        <div style="font-weight:800;font-size:1.1rem;color:var(--dota-gold)">${anomaly.no_heroes_d.toLocaleString()}</div>
      </div>
      <div style="background:rgba(191,92,92,.15);border:1px solid rgba(191,92,92,.4);border-radius:6px;padding:.6rem 1rem">
        <div style="color:var(--dota-muted);font-size:.7rem">Total anomalías (excluidas)</div>
        <div style="font-weight:800;font-size:1.1rem;color:var(--dota-dire)">${anomaly.total_invalid.toLocaleString()} <span style="font-size:.75rem;font-weight:400">(${((anomaly.total_invalid/anomaly.total)*100).toFixed(1)}%)</span></div>
      </div>
    </div>
    <p style="margin:.8rem 0 0;font-size:.75rem;color:var(--dota-muted)">
      <i class="bi bi-info-circle"></i>
      Estas partidas tienen <code>match_id</code>, fecha y resultado pero <strong>cero columnas de héroes con valor &gt; 0</strong>.
      Son equipos sin historial previo en la ventana de análisis (debut en torneo, datos faltantes en OpenDota API).
      <strong>Se excluyen automáticamente</strong> del listado de partidas.
    </p>`;

  const ctx4   = document.getElementById('chartAnomaly').getContext('2d');
  const byYear = anomaly.by_year || [];
  new Chart(ctx4, {
    type: 'bar',
    data: {
      labels: byYear.map(y => String(y._year)),
      datasets: [
        {
          label: 'Partidas válidas',
          data: byYear.map(y => y.valid),
          backgroundColor: 'rgba(92,191,138,0.70)',
          borderColor: 'rgba(92,191,138,1)',
          borderWidth: 1, borderRadius: 4,
        },
        {
          label: 'Sin héroes (anomalía)',
          data: byYear.map(y => y.invalid),
          backgroundColor: 'rgba(191,92,92,0.80)',
          borderColor: 'rgba(191,92,92,1)',
          borderWidth: 1, borderRadius: 4,
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { position: 'top' } },
      scales: {
        x: { stacked: true, grid: { color: gridColor } },
        y: { stacked: true, grid: { color: gridColor }, ticks: { callback: v => v.toLocaleString() } },
      },
    },
  });

  // ── GRÁFICO 5: KDA Ganadores vs Perdedores ────────────────────────────────
  const kda = d.kda;
  const ctx5 = document.getElementById('chartKda').getContext('2d');
  // Plugin para líneas verticales de media (imita axvline del notebook)
  const kdaMeanLinePlugin = {
    id: 'kdaMeanLines',
    afterDatasetsDraw(chart) {
      const {ctx, scales: {x, y}} = chart;
      const drawVLine = (meanVal, color) => {
        let idx = 0, minD = Infinity;
        kda.bin_centers.forEach((bc, i) => { const d = Math.abs(bc - meanVal); if (d < minD) { minD = d; idx = i; } });
        const xp = x.getPixelForTick(idx);
        ctx.save();
        ctx.strokeStyle = color; ctx.lineWidth = 1.5; ctx.setLineDash([4, 4]);
        ctx.beginPath(); ctx.moveTo(xp, y.top); ctx.lineTo(xp, y.bottom); ctx.stroke();
        ctx.restore();
      };
      drawVLine(kda.winner, 'rgba(60,181,106,1)');
      drawVLine(kda.loser,  'rgba(224,92,92,1)');
    }
  };
  new Chart(ctx5, {
    type: 'bar',
    data: {
      labels: kda.bin_centers.map(v => v.toFixed(1)),
      datasets: [
        {
          label: `Ganador (media=${kda.winner.toFixed(2)})`,
          data: kda.hist_win,
          backgroundColor: 'rgba(60,181,106,0.55)',
          borderColor:     'rgba(60,181,106,0.0)',
          borderWidth: 0,
          categoryPercentage: 1.0, barPercentage: 1.0,
          order: 2,
        },
        {
          label: `Perdedor (media=${kda.loser.toFixed(2)})`,
          data: kda.hist_lose,
          backgroundColor: 'rgba(224,92,92,0.55)',
          borderColor:     'rgba(224,92,92,0.0)',
          borderWidth: 0,
          categoryPercentage: 1.0, barPercentage: 1.0,
          order: 3,
        },
      ],
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      plugins: {
        legend: { position: 'top' },
        tooltip: { enabled: false },
      },
      scales: {
        x: {
          grid: { color: gridColor },
          ticks: { maxTicksLimit: 10, callback: (_, i) => i % 6 === 0 ? kda.bin_centers[i].toFixed(1) : '' },
          title: { display: true, text: 'KDA histórico del equipo', color: fontColor },
        },
        y: {
          grid: { color: gridColor },
          title: { display: true, text: 'Densidad', color: fontColor },
        },
      },
    },
    plugins: [kdaMeanLinePlugin],
  });
  const kdaDiff = (((kda.winner - kda.loser) / kda.loser) * 100).toFixed(1);
  document.getElementById('kdaHallazgo').innerHTML =
    `<i class="bi bi-check-circle-fill" style="color:#5cbf8a"></i>
     <strong style="color:var(--dota-gold)">Hallazgo H2:</strong>
     Los ganadores tienen un KDA de <strong>${kda.winner.toFixed(2)}</strong> vs
     <strong>${kda.loser.toFixed(2)}</strong> de los perdedores —
     una diferencia del <strong>${kdaDiff}%</strong>.
     Un KDA alto refleja sobrevivir y participar en los fights, correlacionado con la victoria.`;

  // ── GRÁFICO 6: Control de Visión ──────────────────────────────────────────
  const vision = d.vision;
  const ctx6 = document.getElementById('chartVision').getContext('2d');
  new Chart(ctx6, {
    type: 'bar',
    data: {
      labels: vision.map(v => v.label),
      datasets: [
        {
          label: 'Ganadores',
          data: vision.map(v => v.winner),
          backgroundColor: 'rgba(92,191,138,0.75)',
          borderColor: 'rgba(92,191,138,1)',
          borderWidth: 1, borderRadius: 4,
        },
        {
          label: 'Perdedores',
          data: vision.map(v => v.loser),
          backgroundColor: 'rgba(191,92,92,0.70)',
          borderColor: 'rgba(191,92,92,1)',
          borderWidth: 1, borderRadius: 4,
        },
      ],
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      plugins: { legend: { position: 'top' } },
      scales: {
        y: { grid: { color: gridColor }, title: { display: true, text: 'Promedio por partida', color: fontColor } },
        x: { grid: { color: gridColor } },
      },
    },
  });
  const obsW = vision.find(v => v.label === 'Observer colocadas');
  if (obsW) {
    const pct = (((obsW.winner - obsW.loser) / obsW.loser) * 100).toFixed(1);
    document.getElementById('visionHallazgo').innerHTML =
      `<i class="bi bi-check-circle-fill" style="color:#64a0dc"></i>
       <strong style="color:var(--dota-gold)">Hallazgo H3:</strong>
       Los ganadores colocan un <strong>${pct}% más</strong> de observer wards que los perdedores.
       La visión del mapa es una ventaja operacional clave en partidas profesionales.`;
  }

  // ── GRÁFICO 7: Objetivos (diferencia %) ───────────────────────────────────
  const objetivos = d.objetivos;
  const ctx7 = document.getElementById('chartObjetivos').getContext('2d');
  const objDiffs  = objetivos.map(o => o.diff_pct);
  const objColors = objDiffs.map(v => v >= 0 ? 'rgba(92,191,138,0.82)' : 'rgba(191,92,92,0.82)');
  new Chart(ctx7, {
    type: 'bar',
    data: {
      labels: objetivos.map(o => o.label),
      datasets: [{
        label: 'Diferencia ganador vs perdedor (%)',
        data: objDiffs,
        backgroundColor: objColors,
        borderColor: objColors.map(c => c.replace('0.82', '1')),
        borderWidth: 1, borderRadius: 4,
      }],
    },
    options: {
      indexAxis: 'y',
      responsive: true, maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: { callbacks: { label: c => ` +${c.parsed.x.toFixed(1)}% más que perdedor` } },
      },
      scales: {
        x: {
          grid: { color: gridColor },
          ticks: { callback: v => v + '%' },
          title: { display: true, text: 'Diferencia porcentual (ganador vs perdedor)', color: fontColor },
        },
        y: { grid: { color: gridColor } },
      },
    },
  });
  const torres = objetivos.find(o => o.label === 'Torres destruidas');
  const kills  = objetivos.find(o => o.label === 'Kills de héroes');
  if (torres && kills) {
    document.getElementById('objetivosHallazgo').innerHTML =
      `<i class="bi bi-check-circle-fill" style="color:#dc8c3c"></i>
       <strong style="color:var(--dota-gold)">Hallazgo H4/H5:</strong>
       Torres destruidas tienen una diferencia del <strong>+${torres.diff_pct}%</strong> entre ganadores y perdedores,
       vs <strong>+${kills.diff_pct}%</strong> en kills de héroes.
       ${torres.diff_pct > kills.diff_pct
         ? 'Las <strong>torres</strong> diferencian más que los kills — confirmando H5.'
         : 'Los kills diferencian más que las torres en este dataset.'}`;
  }

  // ── GRÁFICO 8: Duración ganando vs perdiendo ──────────────────────────────
  const dur = d.duracion;
  const ctx8 = document.getElementById('chartDuracion').getContext('2d');
  // Las columnas ya están en minutos (igual que el notebook: bins 20-70 min)
  const durMeanLinePlugin = {
    id: 'durMeanLines',
    afterDatasetsDraw(chart) {
      const {ctx: c8ctx, scales: {x, y}} = chart;
      const drawVLine = (meanVal, color) => {
        let idx = 0, minD = Infinity;
        dur.bin_centers.forEach((bc, i) => { const d = Math.abs(bc - meanVal); if (d < minD) { minD = d; idx = i; } });
        const xp = x.getPixelForTick(idx);
        c8ctx.save();
        c8ctx.strokeStyle = color; c8ctx.lineWidth = 1.5; c8ctx.setLineDash([4, 4]);
        c8ctx.beginPath(); c8ctx.moveTo(xp, y.top); c8ctx.lineTo(xp, y.bottom); c8ctx.stroke();
        c8ctx.restore();
      };
      drawVLine(dur.mean_win,  'rgba(60,181,106,1)');
      drawVLine(dur.mean_lose, 'rgba(224,92,92,1)');
    }
  };
  new Chart(ctx8, {
    type: 'bar',
    data: {
      labels: dur.bin_centers.map(v => v.toFixed(1)),
      datasets: [
        {
          label: `Ganando (μ=${dur.mean_win.toFixed(1)} min)`,
          data: dur.hist_win,
          backgroundColor: 'rgba(60,181,106,0.55)',
          borderColor:     'rgba(60,181,106,0.0)',
          borderWidth: 0,
          categoryPercentage: 1.0, barPercentage: 1.0,
          order: 2,
        },
        {
          label: `Perdiendo (μ=${dur.mean_lose.toFixed(1)} min)`,
          data: dur.hist_lose,
          backgroundColor: 'rgba(224,92,92,0.55)',
          borderColor:     'rgba(224,92,92,0.0)',
          borderWidth: 0,
          categoryPercentage: 1.0, barPercentage: 1.0,
          order: 3,
        },
      ],
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      plugins: {
        legend: { position: 'top' },
        tooltip: { enabled: false },
      },
      scales: {
        x: {
          grid: { color: gridColor },
          ticks: { maxTicksLimit: 10, callback: (_, i) => i % 5 === 0 ? dur.bin_centers[i].toFixed(0) + ' min' : '' },
          title: { display: true, text: 'Duración promedio (minutos)', color: fontColor },
        },
        y: {
          grid: { color: gridColor },
          title: { display: true, text: 'Densidad', color: fontColor },
        },
      },
    },
    plugins: [durMeanLinePlugin],
  });
  const diffDur = (dur.mean_lose - dur.mean_win).toFixed(1);
  document.getElementById('duracionHallazgo').innerHTML =
    `<i class="bi bi-clock" style="color:#b464dc"></i>
     <strong style="color:var(--dota-gold)">Hallazgo H7:</strong>
     Las partidas ganadas duran en promedio <strong>${dur.mean_win.toFixed(1)} min</strong> vs
     <strong>${dur.mean_lose.toFixed(1)} min</strong> cuando se pierde (diferencia: ${diffDur} min).
     ${parseFloat(diffDur) > 0
       ? 'Las partidas que se pierden tienden a ser más largas, consistente con H7: el late-game favorece a Dire.'
       : 'Las partidas ganadas son más largas — sugiere que H7 requiere análisis adicional.'}`;

  // ── GRÁFICO 9: GPM por Año ────────────────────────────────────────────────
  const gpmAnio = d.gpm_anio;
  const ctx9 = document.getElementById('chartGpmAnio').getContext('2d');
  new Chart(ctx9, {
    type: 'bar',
    data: {
      labels: gpmAnio.map(g => String(g.year)),
      datasets: [
        {
          label: 'GPM Ganadores',
          data: gpmAnio.map(g => g.winner),
          backgroundColor: 'rgba(92,191,138,0.75)',
          borderColor: 'rgba(92,191,138,1)',
          borderWidth: 1, borderRadius: 4,
        },
        {
          label: 'GPM Perdedores',
          data: gpmAnio.map(g => g.loser),
          backgroundColor: 'rgba(191,92,92,0.70)',
          borderColor: 'rgba(191,92,92,1)',
          borderWidth: 1, borderRadius: 4,
        },
      ],
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      plugins: { legend: { position: 'top' } },
      scales: {
        y: {
          grid: { color: gridColor },
          ticks: { callback: v => v.toLocaleString() },
          title: { display: true, text: 'GPM (Oro por minuto)', color: fontColor },
        },
        x: { grid: { color: gridColor } },
      },
    },
  });

  // ── GRÁFICO 10: Ventana histórica y Win Rate ──────────────────────────────
  const ventana = d.ventana_hist;
  const ctx10 = document.getElementById('chartVentana').getContext('2d');
  const ventanaErrPlugin = {
    id: 'ventanaErrBars',
    afterDatasetsDraw(chart) {
      const {ctx: c10ctx, scales: {x, y}} = chart;
      c10ctx.save();
      c10ctx.strokeStyle = 'rgba(255,255,255,0.75)';
      c10ctx.lineWidth = 1.5;
      ventana.forEach((item, i) => {
        const mean = item.mean_pct, std = item.std_pct;
        if (!std) return;
        const xp = x.getPixelForTick(i);
        const yU = y.getPixelForValue(mean + std);
        const yD = y.getPixelForValue(mean - std);
        c10ctx.beginPath(); c10ctx.moveTo(xp, yU); c10ctx.lineTo(xp, yD); c10ctx.stroke();
        c10ctx.beginPath(); c10ctx.moveTo(xp - 5, yU); c10ctx.lineTo(xp + 5, yU); c10ctx.stroke();
        c10ctx.beginPath(); c10ctx.moveTo(xp - 5, yD); c10ctx.lineTo(xp + 5, yD); c10ctx.stroke();
      });
      c10ctx.restore();
    }
  };
  new Chart(ctx10, {
    type: 'bar',
    data: {
      labels: ventana.map(v => v.bucket + ' partidas'),
      datasets: [
        {
          label: 'Win Rate promedio (%)',
          data: ventana.map(v => v.mean_pct),
          backgroundColor: 'rgba(26,188,156,0.80)',
          borderColor: 'rgba(26,188,156,1)',
          borderWidth: 1, borderRadius: 3, yAxisID: 'y',
        },
        {
          label: 'Nº partidas',
          data: ventana.map(v => v.count),
          type: 'line',
          borderColor: 'rgba(200,151,58,0.9)',
          backgroundColor: 'rgba(200,151,58,0.0)',
          borderWidth: 2, pointRadius: 5,
          pointBackgroundColor: 'rgba(200,151,58,1)',
          fill: false, tension: 0.3, yAxisID: 'y2',
        },
      ],
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      plugins: { legend: { position: 'top' } },
      scales: {
        y: {
          grid: { color: gridColor },
          min: 45, max: 56,
          ticks: { callback: v => v.toFixed(1) + '%' },
          title: { display: true, text: 'Win rate promedio (%)', color: fontColor },
          position: 'left',
        },
        y2: {
          grid: { display: false },
          ticks: { callback: v => v.toLocaleString() },
          title: { display: true, text: 'Nº de partidas', color: 'rgba(200,151,58,0.9)' },
          position: 'right',
        },
        x: { grid: { color: gridColor } },
      },
    },
    plugins: [ventanaErrPlugin],
  });

  // ── GRÁFICO 11: Correlaciones con radiant_win ─────────────────────────────
  const corrs = d.correlaciones;
  const ctx11 = document.getElementById('chartCorr').getContext('2d');
  const corrColors = corrs.map(c =>
    c.value > 0.05  ? 'rgba(92,191,138,0.82)'  :
    c.value < -0.05 ? 'rgba(191,92,92,0.82)'   :
                      'rgba(150,150,170,0.60)'
  );
  new Chart(ctx11, {
    type: 'bar',
    data: {
      labels: corrs.map(c => c.feature),
      datasets: [{
        label: 'Correlación de Pearson con radiant_win',
        data: corrs.map(c => c.value),
        backgroundColor: corrColors,
        borderColor: corrColors.map(c => c.replace('0.82', '1').replace('0.60', '0.9')),
        borderWidth: 1, borderRadius: 3,
      }],
    },
    options: {
      indexAxis: 'y',
      responsive: true, maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: { callbacks: { label: c => ` r = ${c.parsed.x.toFixed(4)}` } },
      },
      scales: {
        x: {
          grid: { color: gridColor },
          title: { display: true, text: 'Coeficiente de correlación de Pearson (r)', color: fontColor },
          min: -0.5, max: 0.5,
          ticks: { callback: v => v.toFixed(2) },
        },
        y: { grid: { color: gridColor }, ticks: { font: { size: 10 } } },
      },
    },
  });
  const topCorr = corrs[0];
  const botCorr = corrs[corrs.length - 1];
  document.getElementById('corrHallazgo').innerHTML =
    `<i class="bi bi-bar-chart-steps" style="color:#5cbf8a"></i>
     <strong style="color:var(--dota-gold)">Hallazgo global:</strong>
     La variable con mayor correlación positiva es <strong>${topCorr.feature}</strong>
     (r = ${topCorr.value.toFixed(4)}), y la mayor correlación negativa es <strong>${botCorr.feature}</strong>
     (r = ${botCorr.value.toFixed(4)}).
     Verde = más de esa métrica → más victorias Radiant. Rojo = más de esa métrica → más victorias Dire.`;
}

// ─── Inicio de la aplicación ─────────────────────────────────────────────────
cargarStats();
cargarPartidas(1);
