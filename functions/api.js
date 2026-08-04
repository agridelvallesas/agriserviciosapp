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
    'Content-Type': 'application/json',
  };
}
async function sb(env, path) {
  const res = await fetch(`${env.SUPABASE_URL}/rest/v1/${path}`, { headers: headers(env) });
  if (!res.ok) throw new Error('Supabase ' + res.status + ': ' + (await res.text()));
  return res.json();
}
// GET paginado: devuelve {rows, total} usando Range + count exacto
async function sbPage(env, path, offset, limit) {
  const res = await fetch(`${env.SUPABASE_URL}/rest/v1/${path}`, {
    headers: { ...headers(env), 'Range-Unit': 'items', Range: `${offset}-${offset + limit - 1}`, Prefer: 'count=exact' },
  });
  if (!res.ok) throw new Error('Supabase ' + res.status + ': ' + (await res.text()));
  const cr = res.headers.get('content-range') || '';
  const total = parseInt((cr.split('/')[1] || '0'), 10) || 0;
  return { rows: await res.json(), total };
}
// Mutaciones (POST / PATCH / DELETE)
async function sbWrite(env, method, path, bodyObj) {
  const res = await fetch(`${env.SUPABASE_URL}/rest/v1/${path}`, {
    method,
    headers: { ...headers(env), Prefer: 'return=minimal' },
    body: bodyObj !== undefined ? JSON.stringify(bodyObj) : undefined,
  });
  if (!res.ok) throw new Error('Supabase ' + res.status + ': ' + (await res.text()));
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
