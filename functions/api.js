// =====================================================================
//  AGRISERVICIOS · API (Cloudflare Pages Function)   ·   ruta: /api
//  Reemplaza progresivamente a Google Apps Script contra Supabase.
//
//  Acciones no portadas todavía → se REENVÍAN a Apps Script (LEGACY_URL),
//  así la app nunca se rompe. Se portan una por una.
//
//  Envs (Cloudflare Pages → Settings → Environment variables):
//    SUPABASE_URL, SUPABASE_SERVICE_KEY (secreta), LEGACY_URL
//  Ubicación: functions/api.js
// =====================================================================

const PORTADAS = new Set([
  'login', 'getDatos',
  // Módulo Coordinadores:
  'guardar', 'getRegistros', 'verificarDuplicado', 'editarReg', 'eliminarReg',
  // Módulo Administrativo:
  'coberturaSemanas', 'nuevoEmpleado', 'getUsuarios', 'getTrabajadores',
  // Módulo Facturación:
  'getFacturas', 'guardarFactura', 'actualizarFactura', 'eliminarFactura', 'actualizarEstadoFac',
  'getDetallado', 'guardarDetallado', 'editarDetallado', 'eliminarDetallado',
  'getCobrosHist', 'guardarCobrosHist',
]);

export async function onRequestPost({ request, env }) {
  let body = {};
  try { body = JSON.parse(await request.text()); }
  catch (_) { return json({ ok: false, error: 'Cuerpo inválido' }); }

  const accion = body.accion;
  try {
    if (!PORTADAS.has(accion)) return await reenviarLegacy(body, env);

    let r;
    if      (accion === 'login')              r = await accionLogin(body, env);
    else if (accion === 'getDatos')           r = await accionGetDatos(body, env);
    else if (accion === 'guardar')            r = await accionGuardar(body, env);
    else if (accion === 'getRegistros')       r = await accionGetRegistros(body, env);
    else if (accion === 'verificarDuplicado') r = await accionVerificarDuplicado(body, env);
    else if (accion === 'editarReg')          r = await accionEditarReg(body, env);
    else if (accion === 'eliminarReg')        r = await accionEliminarReg(body, env);
    else if (accion === 'coberturaSemanas')   r = await accionCoberturaSemanas(body, env);
    else if (accion === 'nuevoEmpleado')      r = await accionNuevoEmpleado(body, env);
    else if (accion === 'getUsuarios')        r = await accionGetUsuarios(body, env);
    else if (accion === 'getTrabajadores')    r = await accionGetTrabajadores(body, env);
    else if (accion === 'getFacturas')         r = await accionGetFacturas(body, env);
    else if (accion === 'guardarFactura')      r = await accionGuardarFactura(body, env);
    else if (accion === 'actualizarFactura')   r = await accionActualizarFactura(body, env);
    else if (accion === 'eliminarFactura')     r = await accionEliminarFactura(body, env);
    else if (accion === 'actualizarEstadoFac') r = await accionActualizarEstadoFac(body, env);
    else if (accion === 'getDetallado')        r = await accionGetDetallado(body, env);
    else if (accion === 'guardarDetallado')    r = await accionGuardarDetallado(body, env);
    else if (accion === 'editarDetallado')     r = await accionEditarDetallado(body, env);
    else if (accion === 'eliminarDetallado')   r = await accionEliminarDetallado(body, env);
    else if (accion === 'getCobrosHist')       r = await accionGetCobrosHist(body, env);
    else if (accion === 'guardarCobrosHist')   r = await accionGuardarCobrosHist(body, env);
    else r = { ok: false, error: 'Acción desconocida: ' + accion };

    return json(r);
  } catch (err) {
    return json({ ok: false, error: String((err && err.message) || err) });
  }
}

export async function onRequestGet() {
  return json({ ok: true, msg: 'Agriservicios API (Supabase) activa' });
}

// ---------------------------------------------------------------------
//  Helpers Supabase (PostgREST con la service_role key)
// ---------------------------------------------------------------------
function headers(env) {
  return {
    apikey: env.SUPABASE_SERVICE_KEY,
    Authorization: `Bearer ${env.SUPABASE_SERVICE_KEY}`,
  };
}
// Normaliza la URL de Supabase: quita barras finales y un /rest/v1 pegado
// (evita rutas dobles como /rest/v1/rest/v1 que dan PGRST125)
function baseUrl(env) {
  return String(env.SUPABASE_URL || '').replace(/\/+$/, '').replace(/\/rest\/v1$/, '');
}
async function sb(env, path) {
  const url = `${baseUrl(env)}/rest/v1/${path}`;
  const res = await fetch(url, { headers: headers(env) });
  if (!res.ok) throw new Error('Supabase ' + res.status + ' [' + url + ']: ' + (await res.text()));
  return res.json();
}
// GET paginado: devuelve {rows, total} usando Range + count exacto
async function sbPage(env, path, offset, limit) {
  const url = `${baseUrl(env)}/rest/v1/${path}`;
  const res = await fetch(url, {
    headers: { ...headers(env), 'Range-Unit': 'items', Range: `${offset}-${offset + limit - 1}`, Prefer: 'count=exact' },
  });
  if (!res.ok) throw new Error('Supabase ' + res.status + ' [' + url + ']: ' + (await res.text()));
  const cr = res.headers.get('content-range') || '';
  const total = parseInt((cr.split('/')[1] || '0'), 10) || 0;
  return { rows: await res.json(), total };
}
// Mutaciones (POST / PATCH / DELETE)
async function sbWrite(env, method, path, bodyObj) {
  const url = `${baseUrl(env)}/rest/v1/${path}`;
  const res = await fetch(url, {
    method,
    headers: { ...headers(env), 'Content-Type': 'application/json', Prefer: 'return=minimal' },
    body: bodyObj !== undefined ? JSON.stringify(bodyObj) : undefined,
  });
  if (!res.ok) throw new Error('Supabase ' + res.status + ' [' + url + ']: ' + (await res.text()));
  return true;
}
function json(data) {
  return new Response(JSON.stringify(data), { headers: { 'content-type': 'application/json' } });
}
async function reenviarLegacy(body, env) {
  const res = await fetch(env.LEGACY_URL, {
    method: 'POST', headers: { 'Content-Type': 'text/plain' }, body: JSON.stringify(body),
  });
  return new Response(await res.text(), { headers: { 'content-type': 'application/json' } });
}

// ---------------------------------------------------------------------
//  Mapas de apoyo (coordinador nombre→id, descripción de tarifas)
// ---------------------------------------------------------------------
async function mapaCoordPorNombre(env) {
  const filas = await sb(env, 'coordinadores?select=id,nombre');
  const m = new Map();
  for (const f of filas) m.set(String(f.nombre || '').trim().toUpperCase(), f.id);
  return m;
}
async function mapaTarifaDesc(env) {
  const filas = await sb(env, 'tarifas?select=codigo,descripcion');
  const m = new Map();
  for (const f of filas) if (!m.has(f.codigo)) m.set(f.codigo, String(f.descripcion || '').trim());
  return m;
}

// ---------------------------------------------------------------------
//  Fechas y festivos (misma lógica que Apps Script)
//  Semana 1 = lunes 29 dic 2025. Se trabaja en UTC para no desfasar días.
// ---------------------------------------------------------------------
const DIAS_OFFSET = { L: 0, M: 1, MI: 2, J: 3, V: 4, S: 5, D: 6 };
const FESTIVOS_2026 = new Set(['1/1','11/1','6/4','7/4','1/5','18/5','8/6','29/6','20/7','7/8','18/8','13/10','3/11','17/11','8/12','25/12']);
function fechaDeSemanaDia(sem, dia) {
  const s = parseInt(sem, 10) || 1;
  const off = DIAS_OFFSET[dia] !== undefined ? DIAS_OFFSET[dia] : 0;
  const base = Date.UTC(2025, 11, 29); // lunes 29 dic 2025
  return new Date(base + ((s - 1) * 7 + off) * 86400000);
}
function isoDate(d) {
  return d.toISOString().slice(0, 10); // YYYY-MM-DD para columnas date
}
function ddmmyyyy(iso) {
  if (!iso) return '';
  const p = String(iso).slice(0, 10).split('-');
  return p.length === 3 ? `${p[2]}/${p[1]}/${p[0]}` : String(iso);
}
function esDomFest(sem, dia) {
  const d = fechaDeSemanaDia(sem, dia);
  if (d.getUTCDay() === 0) return true; // domingo
  return FESTIVOS_2026.has(`${d.getUTCDate()}/${d.getUTCMonth() + 1}`);
}

// ---------------------------------------------------------------------
//  LOGIN
// ---------------------------------------------------------------------
async function accionLogin(body, env) {
  const usuario = String(body.usuario || '').trim().toUpperCase();
  const pass = String(body.pass || '').trim();
  const usuarios = await sb(env, 'usuarios?select=usuario,contrasena,rol,activo,sede');
  const u = usuarios.find(
    (r) => String(r.usuario || '').trim().toUpperCase() === usuario &&
           String(r.contrasena || '').trim() === pass && r.activo === true
  );
  if (!u) return { ok: false, error: 'Usuario o contraseña incorrectos' };
  const rol = String(u.rol || '').trim().toLowerCase();
  let adminCampo = '';
  if (rol === 'coord') {
    const filas = await sb(env, 'coordinadores?select=nombre,administrador');
    const c = filas.find((r) => String(r.nombre || '').trim().toUpperCase() === usuario);
    adminCampo = c ? String(c.administrador || '').trim() : '';
  }
  return { ok: true, usuario: u.usuario, rol, adminCampo, sede: String(u.sede || 'TODAS').trim().toUpperCase() };
}

// ---------------------------------------------------------------------
//  GET DATOS
// ---------------------------------------------------------------------
async function accionGetDatos(body, env) {
  const sede = body && body.sede ? String(body.sede).trim().toUpperCase() : '';
  const [empleados, tarifas, coordinadores, quincenas] = await Promise.all([
    getEmpleados(sede, env), getTarifas(sede, env), getCoordinadores(env), getQuincenas(env),
  ]);
  return { ok: true, empleados, tarifas, coordinadores, quincenas };
}
async function getEmpleados(sede, env) {
  const filas = await sb(env, 'trabajadores?select=cedula,nombres,sede');
  const lista = [];
  for (const f of filas) {
    if (!f.cedula) continue;
    const empSede = String(f.sede || '').trim().toUpperCase();
    if (sede && sede !== 'TODAS' && empSede && empSede !== sede) continue;
    lista.push({ c: String(f.cedula).trim(), n: String(f.nombres || '').trim(), sede: empSede });
  }
  return lista;
}
async function getTarifas(sede, env) {
  const filas = await sb(env, 'tarifas?select=codigo,descripcion,unidad,tarifa_cobro,tarifa_colab,sede');
  const lista = [];
  for (const f of filas) {
    if (!f.codigo) continue;
    const tarSede = String(f.sede || '').trim().toUpperCase();
    if (sede && sede !== 'TODAS' && tarSede && tarSede !== sede) continue;
    lista.push({
      id: String(f.codigo).trim(), d: String(f.descripcion || '').trim(), u: String(f.unidad || '').trim(),
      c: parseFloat(f.tarifa_cobro) || 0, p: parseFloat(f.tarifa_colab) || 0,
      sede: tarSede, eficiencia: '', esVigilancia: String(f.codigo).trim() === 'LV1061183',
    });
  }
  return lista;
}
async function getCoordinadores(env) {
  const filas = await sb(env, 'coordinadores?select=nombre,administrador,sede&order=nombre');
  return filas.filter((f) => f.nombre).map((f) => ({
    coord: String(f.nombre).trim(), admin: String(f.administrador || '').trim(),
    sede: String(f.sede || '').trim().toUpperCase(),
  }));
}
async function getQuincenas(env) {
  const filas = await sb(env, 'quincenas?select=sem,periodo_semana,dias,quincena,periodo_quincena,fecha_pago&order=id');
  const q = {}; let qnaActual = '';
  for (const f of filas) {
    const sem = String(f.sem || '').trim(), dias = parseInt(f.dias) || 0;
    const qna = String(f.quincena || '').trim(), perQna = String(f.periodo_quincena || '').trim();
    const pago = String(f.fecha_pago || '').trim();
    if (qna) qnaActual = qna;
    if (sem && dias > 0 && qnaActual) {
      if (!q[qnaActual]) q[qnaActual] = { id: qnaActual, n: qnaActual + (pago ? ' (pago: ' + pago + ')' : ''), periodoQna: perQna, fechaPago: pago, sems: [] };
      const numSem = sem.replace('SEM ', '').replace('SEM', '').trim().padStart(2, '0');
      q[qnaActual].sems.push({ s: numSem, d: dias });
    }
  }
  return Object.values(q);
}

// ---------------------------------------------------------------------
//  MÓDULO COORDINADORES
// ---------------------------------------------------------------------

// GUARDAR — inserta el lote en detalle_dia (recalcula fecha y dom_fest)
async function accionGuardar(body, env) {
  const registros = body.registros || [];
  if (!registros.length) return { ok: false, error: 'No hay registros que guardar' };

  const coordMap = await mapaCoordPorNombre(env);
  const ahora = new Date().toISOString();
  const filas = registros.map((r) => ({
    id: crypto.randomUUID().slice(0, 8),
    coordinador_id: coordMap.get(String(r.coord || '').trim().toUpperCase()) || null,
    semana: parseInt(r.sem) || null,
    cedula: parseInt(String(r.ced || '').replace(/,/g, '')) || null,
    dia: r.dia || '',
    fecha: isoDate(fechaDeSemanaDia(r.sem, r.dia)),
    tipo: r.tipo || 'labor',
    id_labor: r.labId || '',
    unidad: r.u || '',
    cantidad: r.cant || 0,
    pago_trabajador: r.pago || 0,
    cobro_riopaila: r.cobro || 0,
    auxilio_alim: r.alim || 0,
    novedad: r.nov || '',
    observacion: r.obs || '',
    es_vigilancia: !!r.esVig,
    vig_hd: r.vigHd || 0,
    vig_hn: r.vigHn || 0,
    dom_fest: esDomFest(r.sem, r.dia),   // recalculado por fecha real
    cobro_vigilancia: r.cobroVig || 0,
    obs_tarea: r.obsTarea || '',
    fecha_registro: ahora,
  }));

  await sbWrite(env, 'POST', 'detalle_dia', filas);
  return { ok: true, guardados: filas.length };
}

// GET REGISTROS — lee detalle_dia con filtros y paginación; reconstruye nombres por join
async function accionGetRegistros(body, env) {
  const filtroSem = String(body.sem || '').trim();
  const filtroCoord = String(body.coord || '').trim();
  const filtroCed = String(body.ced || '').trim();
  const desde = parseInt(body.desde) || 2;
  const lote = filtroSem ? 5000 : 3000;
  const offset = Math.max(0, desde - 2);

  const cols = 'id,coordinador_id,semana,cedula,dia,fecha,tipo,id_labor,unidad,cantidad,pago_trabajador,cobro_riopaila,auxilio_alim,novedad,observacion,es_vigilancia,vig_hd,vig_hn,dom_fest,cobro_vigilancia,obs_tarea,fecha_registro,coordinadores(nombre,administrador),trabajadores(nombres)';
  let path = `detalle_dia?select=${cols}&order=fecha_registro`;
  if (filtroSem) path += `&semana=eq.${parseInt(filtroSem)}`;
  if (filtroCed) path += `&cedula=eq.${parseInt(filtroCed.replace(/,/g, ''))}`;
  if (filtroCoord) {
    const coordMap = await mapaCoordPorNombre(env);
    const cid = coordMap.get(filtroCoord.toUpperCase());
    if (!cid) return { ok: true, registros: [], total: 0, hayMas: false };
    path += `&coordinador_id=eq.${cid}`;
  }

  const [{ rows, total }, tarDesc] = await Promise.all([sbPage(env, path, offset, lote), mapaTarifaDesc(env)]);
  const registros = rows.map((f, i) => ({
    id: String(f.id || '').trim(),
    coord: f.coordinadores ? String(f.coordinadores.nombre || '').trim() : '',
    adm: f.coordinadores ? String(f.coordinadores.administrador || '').trim() : '',
    sem: String(f.semana == null ? '' : f.semana).trim(),
    ced: String(f.cedula == null ? '' : f.cedula).trim(),
    emp: f.trabajadores ? String(f.trabajadores.nombres || '').trim() : '',
    dia: String(f.dia || '').trim(),
    fecha: ddmmyyyy(f.fecha),
    tipo: String(f.tipo || '').trim(),
    labId: String(f.id_labor || '').trim(),
    lab: tarDesc.get(f.id_labor) || '',
    u: String(f.unidad || '').trim(),
    cant: parseFloat(f.cantidad) || 0,
    pago: parseFloat(f.pago_trabajador) || 0,
    cobro: parseFloat(f.cobro_riopaila) || 0,
    alim: parseFloat(f.auxilio_alim) || 0,
    nov: String(f.novedad || '').trim(),
    obs: String(f.observacion || '').trim(),
    esVig: f.es_vigilancia === true,
    vigHd: parseFloat(f.vig_hd) || 0,
    vigHn: parseFloat(f.vig_hn) || 0,
    domFest: f.dom_fest === true,
    fReg: f.fecha_registro ? String(f.fecha_registro) : '',
    cobroVig: parseFloat(f.cobro_vigilancia) || 0,
    obsTarea: String(f.obs_tarea || '').trim(),
    fila: offset + i + 2,
  }));
  const hayMas = offset + rows.length < total;
  return { ok: true, registros, total, hayMas, siguienteFila: desde + rows.length };
}

// VERIFICAR DUPLICADO — por cedula + semana + dia + id_labor (solo tipo 'labor')
async function accionVerificarDuplicado(body, env) {
  const ced = String(body.ced || '').trim();
  const sem = String(body.sem || '').trim();
  const dia = String(body.dia || '').trim();
  const labId = String(body.labId || '').trim();
  if (!ced || !sem || !dia || !labId) return { ok: true, existe: false };

  const cols = 'id,semana,cedula,dia,fecha,tipo,id_labor,unidad,cantidad,pago_trabajador,cobro_riopaila,auxilio_alim,novedad,observacion,obs_tarea,coordinadores(nombre,administrador),trabajadores(nombres)';
  const path = `detalle_dia?select=${cols}&tipo=eq.labor&semana=eq.${parseInt(sem)}&cedula=eq.${parseInt(ced.replace(/,/g, ''))}&dia=eq.${encodeURIComponent(dia)}&id_labor=eq.${encodeURIComponent(labId)}&limit=1`;
  const rows = await sb(env, path);
  if (!rows.length) return { ok: true, existe: false };

  const f = rows[0];
  const tarDesc = await mapaTarifaDesc(env);
  return {
    ok: true, existe: true, registro: {
      id: String(f.id || '').trim(),
      coord: f.coordinadores ? String(f.coordinadores.nombre || '').trim() : '',
      adm: f.coordinadores ? String(f.coordinadores.administrador || '').trim() : '',
      sem: String(f.semana == null ? '' : f.semana).trim(), ced: String(f.cedula == null ? '' : f.cedula).trim(),
      emp: f.trabajadores ? String(f.trabajadores.nombres || '').trim() : '',
      dia: String(f.dia || '').trim(), fecha: ddmmyyyy(f.fecha), tipo: String(f.tipo || '').trim(),
      labId: String(f.id_labor || '').trim(), lab: tarDesc.get(f.id_labor) || '', u: String(f.unidad || '').trim(),
      cant: parseFloat(f.cantidad) || 0, pago: parseFloat(f.pago_trabajador) || 0,
      cobro: parseFloat(f.cobro_riopaila) || 0, alim: parseFloat(f.auxilio_alim) || 0,
      nov: String(f.novedad || '').trim(), obs: String(f.observacion || '').trim(),
      obsTarea: String(f.obs_tarea || '').trim(),
    },
  };
}

// EDITAR REGISTRO — actualiza por id
async function accionEditarReg(body, env) {
  const id = String(body.id || '').trim();
  if (!id) return { ok: false, error: 'Registro no encontrado' };
  const coordMap = await mapaCoordPorNombre(env);
  const cambios = {
    coordinador_id: coordMap.get(String(body.coord || '').trim().toUpperCase()) || null,
    semana: parseInt(body.sem) || null,
    cedula: parseInt(String(body.ced || '').replace(/,/g, '')) || null,
    dia: body.dia || '',
    fecha: isoDate(fechaDeSemanaDia(body.sem, body.dia)),
    tipo: body.tipo || 'labor',
    id_labor: body.labId || '',
    unidad: body.u || '',
    cantidad: body.cant || 0,
    pago_trabajador: body.pago || 0,
    cobro_riopaila: body.cobro || 0,
    auxilio_alim: body.alim || 0,
    novedad: body.nov || '',
    observacion: body.obs || '',
    es_vigilancia: !!body.esVig,
    vig_hd: body.vigHd || 0,
    vig_hn: body.vigHn || 0,
    dom_fest: !!body.domFest,
    cobro_vigilancia: body.cobroVig || 0,
    obs_tarea: body.obsTarea || '',
    fecha_registro: new Date().toISOString(),
  };
  await sbWrite(env, 'PATCH', `detalle_dia?id=eq.${encodeURIComponent(id)}`, cambios);
  return { ok: true };
}

// ELIMINAR REGISTRO — borra por id
async function accionEliminarReg(body, env) {
  const id = String(body.id || '').trim();
  if (!id) return { ok: false, error: 'No se pudo identificar el registro' };
  await sbWrite(env, 'DELETE', `detalle_dia?id=eq.${encodeURIComponent(id)}`, undefined);
  return { ok: true, metodo: 'id' };
}

// ---------------------------------------------------------------------
//  MÓDULO ADMINISTRATIVO
// ---------------------------------------------------------------------

// Trae TODAS las filas de una consulta, paginando (robusto ante el tope de filas)
async function sbAll(env, path, pageSize = 1000) {
  let offset = 0, all = [], total = Infinity;
  while (offset < total) {
    const { rows, total: t } = await sbPage(env, path, offset, pageSize);
    total = t;
    if (!rows.length) break;
    all = all.concat(rows);
    offset += rows.length;
    if (rows.length < pageSize) break;
  }
  return all;
}

// COBERTURA DE SEMANAS — qué días subió cada coordinador vs los esperados
// (usa la lista de festivos CORRECTA de Colombia 2026)
const FESTIVOS_COBERTURA = new Set(['1/1','12/1','23/3','2/4','3/4','1/5','18/5','8/6','15/6','29/6','20/7','7/8','17/8','12/10','2/11','16/11','8/12','25/12']);
async function accionCoberturaSemanas(body, env) {
  const desde = parseInt(body && body.semDesde) || 17;
  const SEM1 = Date.UTC(2025, 11, 29);
  let semActual = Math.floor((Date.now() - SEM1) / (7 * 86400000)) + 1;
  if (semActual < desde) semActual = desde;

  // 1) Todos los coordinadores del maestro
  const coords = await sb(env, 'coordinadores?select=id,nombre,administrador');
  const idInfo = new Map();
  const base = {};
  for (const c of coords) {
    const nombre = String(c.nombre || '').trim();
    if (!nombre) continue;
    const adm = String(c.administrador || '').trim();
    idInfo.set(c.id, { nombre, adm });
    base[nombre.toUpperCase()] = { coord: nombre, adm, sems: {} };
  }

  // 2) Días subidos desde detalle_dia (semana >= desde)
  const filasDD = await sbAll(env, `detalle_dia?select=coordinador_id,semana,dia&semana=gte.${desde}`);
  for (const r of filasDD) {
    const info = idInfo.get(r.coordinador_id);
    if (!info) continue;
    const sem = parseInt(r.semana) || 0;
    if (sem < desde) continue;
    const dia = String(r.dia || '').trim().toUpperCase();
    if (!dia) continue;
    const key = info.nombre.toUpperCase();
    if (!base[key]) base[key] = { coord: info.nombre, adm: info.adm, sems: {} };
    if (!base[key].sems[sem]) base[key].sems[sem] = {};
    base[key].sems[sem][dia] = true;
  }

  // 3) Días esperados por semana (L–S, quitando festivos)
  const codigos = ['L', 'M', 'MI', 'J', 'V', 'S'];
  const offset = { L: 0, M: 1, MI: 2, J: 3, V: 4, S: 5 };
  const semanas = [];
  for (let sn = desde; sn <= semActual; sn++) {
    const lunes = SEM1 + (sn - 1) * 7 * 86400000;
    const exp = [], fest = [];
    for (const cod of codigos) {
      const f = new Date(lunes + offset[cod] * 86400000);
      const etq = f.getUTCDate() + '/' + (f.getUTCMonth() + 1);
      if (FESTIVOS_COBERTURA.has(etq)) fest.push(cod); else exp.push(cod);
    }
    semanas.push({ n: sn, exp, fest });
  }

  // 4) Filas ordenadas por administrador y luego coordinador
  const filas = Object.keys(base).map((k) => {
    const m = base[k]; const sems = {};
    Object.keys(m.sems).forEach((sn) => { sems[sn] = Object.keys(m.sems[sn]); });
    return { coord: m.coord, adm: m.adm, sems };
  });
  filas.sort((a, b) => {
    const x = (a.adm || '').localeCompare(b.adm || '');
    return x !== 0 ? x : (a.coord || '').localeCompare(b.coord || '');
  });

  return { ok: true, desde, semActual, semanas, filas };
}

// NUEVO EMPLEADO — alta rápida (cédula, nombre, sede) en trabajadores
async function accionNuevoEmpleado(body, env) {
  const ced = String(body.ced || '').trim();
  const nom = String(body.nom || '').trim().toUpperCase();
  const sede = String(body.sede || 'NORTE').trim().toUpperCase();
  if (!ced || !nom) return { ok: false, error: 'Cédula y nombre son requeridos' };
  const cedNum = parseInt(ced.replace(/,/g, ''));
  const existe = await sb(env, `trabajadores?select=cedula&cedula=eq.${cedNum}&limit=1`);
  if (existe.length) return { ok: false, error: 'Ya existe un empleado con esa cédula' };
  await sbWrite(env, 'POST', 'trabajadores', { cedula: cedNum, nombres: nom, sede });
  return { ok: true, ced, nom, sede };
}

// GET USUARIOS — lista por rol para el selector del login
async function accionGetUsuarios(body, env) {
  const rol = body && body.rol ? String(body.rol).trim().toLowerCase() : '';
  const filas = await sb(env, 'usuarios?select=usuario,rol,activo,sede');
  const lista = [];
  for (const f of filas) {
    if (!f.usuario) continue;
    // Tolerante: activo puede venir como booleano true o como texto 'SI'
    const activo = f.activo === true || ['SI', 'SÍ', 'TRUE', '1'].includes(String(f.activo).trim().toUpperCase());
    if (!activo) continue;
    const fRol = String(f.rol || '').trim().toLowerCase();
    if (rol && fRol !== rol) continue;
    lista.push({ usuario: String(f.usuario).trim(), rol: fRol, sede: String(f.sede || 'TODAS').trim().toUpperCase() });
  }
  return {
    ok: true,
    usuarios: lista,
    _debug: {
      totalFilas: filas.length,
      rolPedido: rol,
      rolesEnBase: [...new Set(filas.map((f) => String(f.rol || '').trim().toLowerCase()))],
      activoMuestra: filas.slice(0, 3).map((f) => ({ rol: f.rol, activo: f.activo, tipo: typeof f.activo })),
    },
  };
}

// GET TRABAJADORES — lista completa (Ver empleados). Mapea columnas de la base
// a las llaves que espera el frontend (CEDULA, NOMBRES, ...).
const TRAB_MAP = [
  ['CEDULA','cedula'],['P_NOMBRE','p_nombre'],['S_NOMBRE','s_nombre'],['P_APELLIDO','p_apellido'],['S_APELLIDO','s_apellido'],['NOMBRES','nombres'],
  ['FECHA_EXP','fecha_exp'],['LUGAR_EXP','lugar_exp'],['FECHA_NAC','fecha_nac'],
  ['TELEFONO','telefono'],['DIRECCION','direccion'],['CIUDAD','ciudad'],['DEPARTAMENTO','departamento'],['EMAIL','email'],['CONTACTO_EMERG','contacto_emer'],
  ['SEDE','sede'],['ESTADO','estado'],['FECHA_INGRESO','fecha_ingreso'],['FECHA_RETIRO','fecha_ret'],['CARGO','cargo'],['SALARIO_MENSUAL','salario'],
  ['BANCO','banco'],['CUENTA','num_cuenta'],
  ['EPS','eps'],['PENSION','pension'],['CAJA','caja'],['ARL','arl'],['CESANTIAS','cesantias'],
  ['TALLA_CAMISA','talla_camisa'],['TALLA_PANTALON','talla_pant'],['TALLA_GUAYO','talla_guayo'],['TALLA_BOTA','talla_bota'],['TALLA_ZAPATO','talla_zap'],['TALLA_IMPERMEABLE','talla_impermeable'],
  ['OBSERVACIONES','observacion'],['FECHA_CREACION','fecha_registro'],['ACTUALIZADO_POR','actualizado_por'],
];
async function accionGetTrabajadores(body, env) {
  const cols = TRAB_MAP.map((p) => p[1]).join(',');
  const rows = await sbAll(env, `trabajadores?select=${cols}&order=nombres`);
  const data = rows.map((f) => {
    const o = {};
    for (const [key, col] of TRAB_MAP) {
      let v = f[col];
      if (v === null || v === undefined) v = '';
      else if (col.indexOf('fecha') === 0) v = String(v).slice(0, 10);
      else v = String(v);
      o[key] = v;
    }
    return o;
  });
  return { ok: true, data };
}

// ---------------------------------------------------------------------
//  MÓDULO FACTURACIÓN
// ---------------------------------------------------------------------
function fechaONull(v) { v = String(v || '').trim(); return v || null; }

// FACTURAS
async function accionGuardarFactura(body, env) {
  const f = body.factura;
  if (!f || !f.nfac) return { ok: false, error: 'Datos de factura incompletos' };
  const fila = {
    id: f.id || crypto.randomUUID().slice(0, 8),
    fecha_fac: fechaONull(f.ffac),
    fecha_ven: fechaONull(f.fven),
    num_factura: f.nfac || '',
    num_acta: f.nacta || '',
    valor_factura: f.val || 0,
    retencion: f.ret || 0,
    valor_pagar: f.vpag || 0,
    semanas: f.sems || '',
    contrato: f.contrato || '',
    responsable: f.resp || '',
    nota: f.nota || '',
    estado: f.estado || 'PENDIENTE',
    no_detallable: false,
    fecha_registro: isoDate(new Date()),
    fecha_pago: null,
  };
  await sbWrite(env, 'POST', 'facturas', fila);
  return { ok: true };
}

async function accionGetFacturas(body, env) {
  const rows = await sbAll(env, 'facturas?select=id,fecha_fac,fecha_ven,num_factura,num_acta,valor_factura,retencion,valor_pagar,semanas,contrato,responsable,nota,estado,no_detallable,fecha_pago');
  const facturas = rows.map((f, i) => ({
    id: String(f.id || '').trim(),
    ffac: f.fecha_fac ? String(f.fecha_fac).slice(0, 10) : '',
    fven: f.fecha_ven ? String(f.fecha_ven).slice(0, 10) : '',
    nfac: String(f.num_factura || '').trim(),
    nacta: String(f.num_acta || '').trim(),
    val: parseFloat(f.valor_factura) || 0,
    ret: parseFloat(f.retencion) || 0,
    vpag: parseFloat(f.valor_pagar) || 0,
    sems: String(f.semanas || '').trim(),
    contrato: String(f.contrato || '').trim(),
    resp: String(f.responsable || '').trim(),
    nota: String(f.nota || '').trim(),
    estado: String(f.estado || '').trim(),
    fpago: f.fecha_pago ? String(f.fecha_pago).slice(0, 10) : '',
    noDetallable: f.no_detallable === true,
    fila: i + 2,
  }));
  return { ok: true, facturas };
}

async function accionActualizarFactura(body, env) {
  const id = body.id, campo = body.campo, valor = body.valor;
  if (!id || !campo) return { ok: false, error: 'ID y campo requeridos' };
  if (campo === 'noDetallable') {
    const b = valor === true || valor === 1 || ['SI', '1', 'X', 'TRUE', 'YES'].includes(String(valor).trim().toUpperCase());
    await sbWrite(env, 'PATCH', `facturas?id=eq.${encodeURIComponent(id)}`, { no_detallable: b });
    return { ok: true };
  }
  return { ok: false, error: 'Campo no soportado: ' + campo };
}

async function accionEliminarFactura(body, env) {
  const id = body.id;
  if (!id) return { ok: false, error: 'ID requerido' };
  await sbWrite(env, 'DELETE', `facturas?id=eq.${encodeURIComponent(id)}`);
  return { ok: true };
}

async function accionActualizarEstadoFac(body, env) {
  const id = body.id, estado = body.estado, fpago = body.fpago || '';
  if (!id || !estado) return { ok: false, error: 'Faltan datos' };
  const cambios = { estado };
  if (fpago) cambios.fecha_pago = fpago;
  await sbWrite(env, 'PATCH', `facturas?id=eq.${encodeURIComponent(id)}`, cambios);
  return { ok: true };
}

// DETALLADO DE FACTURA
async function accionGuardarDetallado(body, env) {
  const detalles = body.detalles || [];
  if (!detalles.length) return { ok: false, error: 'Sin detalles' };
  const coordMap = await mapaCoordPorNombre(env);
  const ahora = isoDate(new Date());
  const filas = detalles.map((d) => ({
    id: crypto.randomUUID().slice(0, 8),
    id_factura: d.idFac || '',
    num_acta: d.nacta || '',
    coordinador_id: coordMap.get(String(d.coord || '').trim().toUpperCase()) || null,
    semana: parseInt(d.sem) || null,
    valor_cobro: d.val || 0,
    fecha_registro: ahora,
    resp: d.resp || '',
  }));
  await sbWrite(env, 'POST', 'detallado_factura', filas);
  return { ok: true, guardados: filas.length };
}

async function accionGetDetallado(body, env) {
  const idFac = String(body.idFac || '').trim();
  let path = 'detallado_factura?select=id,id_factura,num_acta,coordinador_id,semana,valor_cobro,fecha_registro,resp,coordinadores(nombre,administrador)';
  if (idFac) path += `&id_factura=eq.${encodeURIComponent(idFac)}`;
  const rows = await sbAll(env, path);
  const detalles = rows.map((d) => ({
    id: String(d.id || '').trim(),
    idFac: String(d.id_factura || '').trim(),
    nacta: String(d.num_acta || '').trim(),
    coord: d.coordinadores ? String(d.coordinadores.nombre || '').trim() : '',
    admin: d.coordinadores ? String(d.coordinadores.administrador || '').trim() : '',
    sem: String(d.semana == null ? '' : d.semana).trim(),
    val: parseFloat(d.valor_cobro) || 0,
    fReg: d.fecha_registro ? String(d.fecha_registro).slice(0, 10) : '',
    resp: String(d.resp || '').trim(),
  }));
  return { ok: true, detalles };
}

async function accionEditarDetallado(body, env) {
  const id = String(body.id || '').trim();
  const val = parseFloat(body.val) || 0;
  if (!id) return { ok: false, error: 'ID requerido' };
  await sbWrite(env, 'PATCH', `detallado_factura?id=eq.${encodeURIComponent(id)}`, { valor_cobro: val });
  return { ok: true };
}

async function accionEliminarDetallado(body, env) {
  const id = body.id;
  if (!id) return { ok: false, error: 'ID requerido' };
  await sbWrite(env, 'DELETE', `detallado_factura?id=eq.${encodeURIComponent(id)}`);
  return { ok: true };
}

// COBROS HISTÓRICOS
async function accionGetCobrosHist(body, env) {
  const [rows, coords] = await Promise.all([
    sbAll(env, 'cobros_historicos?select=id,coordinador,semana,valor_cobro,fecha_registro'),
    sb(env, 'coordinadores?select=nombre,administrador'),
  ]);
  const adminMap = new Map();
  for (const c of coords) adminMap.set(String(c.nombre || '').trim().toUpperCase(), String(c.administrador || '').trim());
  const cobros = rows.map((r) => ({
    id: String(r.id == null ? '' : r.id).trim(),
    coord: String(r.coordinador || '').trim(),
    admin: adminMap.get(String(r.coordinador || '').trim().toUpperCase()) || '',
    sem: String(r.semana == null ? '' : r.semana).trim(),
    val: parseFloat(r.valor_cobro) || 0,
    fReg: r.fecha_registro ? String(r.fecha_registro).slice(0, 10) : '',
  }));
  return { ok: true, cobros };
}

async function accionGuardarCobrosHist(body, env) {
  const filas = body.filas || [];
  if (!filas.length) return { ok: false, error: 'Sin datos' };
  const ahora = isoDate(new Date());
  const rows = filas.map((f) => ({
    coordinador: f.coord || '',
    semana: parseInt(f.sem) || null,
    valor_cobro: f.val || 0,
    fecha_registro: ahora,
  }));
  await sbWrite(env, 'POST', 'cobros_historicos', rows);
  return { ok: true, guardados: rows.length };
}
