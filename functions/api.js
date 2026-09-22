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
  'eliminarRegistros',
  // Módulo Administrativo:
  'coberturaSemanas', 'nuevoEmpleado', 'getUsuarios', 'getTrabajadores',
  // Módulo Facturación:
  'getFacturas', 'guardarFactura', 'actualizarFactura', 'eliminarFactura', 'actualizarEstadoFac',
  'getDetallado', 'guardarDetallado', 'editarDetallado', 'eliminarDetallado',
  'getCobrosHist', 'guardarCobrosHist', 'editarCobroHist',
  'cruzarSaldos',
  // Módulo Nómina:
  'getAcumulados', 'getQuincenasAcum', 'importarAcumulados', 'eliminarAcumuladoQna', 'vaciarAcumulados',
  // Permisos de subida:
  'getPermisosSubida', 'guardarPermisoSubida', 'revocarPermisoSubida',
  // Módulo RH:
  'guardarTrabajador', 'editarTrabajador', 'eliminarTrabajador', 'importarTrabajadores',
  'getVacaciones', 'eliminarVacacion', 'importarVacaciones', 'guardarVacacion', 'editarVacacion',
  'getPlantillas', 'guardarPlantilla', 'eliminarPlantilla',
  // Gestión de accesos (Administrativo):
  'getUsuariosAdmin', 'guardarUsuario', 'editarUsuario', 'eliminarUsuario',
  'getCoordinadoresAdmin', 'guardarCoordinador', 'editarCoordinador', 'eliminarCoordinador',
  // Conceptos del importador de acumulados:
  'getConceptosAcum', 'guardarConceptoAcum', 'eliminarConceptoAcum',
  // Cruce de saldos entre coordinadores:
  'getCruces', 'guardarCruce', 'eliminarCruce',
  // Módulo SST — Inventario de almacén:
  'getInventario', 'invGuardarProducto', 'invEliminarProducto',
  'invAjustarStock', 'invActivarProducto',
  'invGetMovimientos', 'invRegistrarEntrada', 'invRegistrarSalida',
  'invGetActas', 'invEliminarActa', 'invEditarActa',
  'invEntregasResumen', 'invItemsActas',
  'getInvConfig', 'guardarInvConfig', 'eliminarInvConfig',
  'invGetFirma',
  'getConfigEmpresa', 'guardarConfigEmpresa',
  'getNomConfig', 'guardarNomConfig',
  'getVigHorasSemana',
  'getConsolidadoCoord',
  'getIndiceDup', 'verificarDuplicadosLote',
  'guardarTarifa',
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
    else if (accion === 'eliminarRegistros')  r = await accionEliminarRegistros(body, env);
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
    else if (accion === 'editarCobroHist')     r = await accionEditarCobroHist(body, env);
    else if (accion === 'cruzarSaldos')       r = await accionCruzarSaldos(body, env);
    else if (accion === 'getAcumulados')        r = await accionGetAcumulados(body, env);
    else if (accion === 'getQuincenasAcum')     r = await accionGetQuincenasAcum(body, env);
    else if (accion === 'importarAcumulados')   r = await accionImportarAcumulados(body, env);
    else if (accion === 'eliminarAcumuladoQna') r = await accionEliminarAcumuladoQna(body, env);
    else if (accion === 'vaciarAcumulados')     r = await accionVaciarAcumulados(body, env);
    else if (accion === 'getPermisosSubida')    r = await accionGetPermisosSubida(body, env);
    else if (accion === 'guardarPermisoSubida') r = await accionGuardarPermisoSubida(body, env);
    else if (accion === 'revocarPermisoSubida') r = await accionRevocarPermisoSubida(body, env);
    else if (accion === 'guardarTrabajador')    r = await accionGuardarTrabajador(body, env);
    else if (accion === 'editarTrabajador')     r = await accionEditarTrabajador(body, env);
    else if (accion === 'eliminarTrabajador')   r = await accionEliminarTrabajador(body, env);
    else if (accion === 'importarTrabajadores') r = await accionImportarTrabajadores(body, env);
    else if (accion === 'getVacaciones')        r = await accionGetVacaciones(body, env);
    else if (accion === 'eliminarVacacion')     r = await accionEliminarVacacion(body, env);
    else if (accion === 'importarVacaciones')   r = await accionImportarVacaciones(body, env);
    else if (accion === 'guardarVacacion')      r = await accionGuardarVacacion(body, env);
    else if (accion === 'editarVacacion')       r = await accionEditarVacacion(body, env);
    else if (accion === 'getPlantillas')        r = await accionGetPlantillas(body, env);
    else if (accion === 'guardarPlantilla')     r = await accionGuardarPlantilla(body, env);
    else if (accion === 'eliminarPlantilla')    r = await accionEliminarPlantilla(body, env);
    else if (accion === 'getUsuariosAdmin')      r = await accionGetUsuariosAdmin(body, env);
    else if (accion === 'guardarUsuario')        r = await accionGuardarUsuario(body, env);
    else if (accion === 'editarUsuario')         r = await accionEditarUsuario(body, env);
    else if (accion === 'eliminarUsuario')       r = await accionEliminarUsuario(body, env);
    else if (accion === 'getCoordinadoresAdmin') r = await accionGetCoordinadoresAdmin(body, env);
    else if (accion === 'guardarCoordinador')    r = await accionGuardarCoordinador(body, env);
    else if (accion === 'editarCoordinador')     r = await accionEditarCoordinador(body, env);
    else if (accion === 'eliminarCoordinador')   r = await accionEliminarCoordinador(body, env);
    else if (accion === 'getConceptosAcum')      r = await accionGetConceptosAcum(body, env);
    else if (accion === 'guardarConceptoAcum')   r = await accionGuardarConceptoAcum(body, env);
    else if (accion === 'eliminarConceptoAcum')  r = await accionEliminarConceptoAcum(body, env);
    else if (accion === 'getCruces')            r = await accionGetCruces(body, env);
    else if (accion === 'guardarCruce')         r = await accionGuardarCruce(body, env);
    else if (accion === 'eliminarCruce')        r = await accionEliminarCruce(body, env);
    else if (accion === 'getInventario')        r = await accionGetInventario(body, env);
    else if (accion === 'invGuardarProducto')   r = await accionInvGuardarProducto(body, env);
    else if (accion === 'invEliminarProducto')  r = await accionInvEliminarProducto(body, env);
    else if (accion === 'invAjustarStock')      r = await accionInvAjustarStock(body, env);
    else if (accion === 'invActivarProducto')   r = await accionInvActivarProducto(body, env);
    else if (accion === 'invGetMovimientos')    r = await accionInvGetMovimientos(body, env);
    else if (accion === 'invRegistrarEntrada')  r = await accionInvRegistrarEntrada(body, env);
    else if (accion === 'invRegistrarSalida')   r = await accionInvRegistrarSalida(body, env);
    else if (accion === 'invGetActas')          r = await accionInvGetActas(body, env);
    else if (accion === 'invEliminarActa')      r = await accionInvEliminarActa(body, env);
    else if (accion === 'invEditarActa')        r = await accionInvEditarActa(body, env);
    else if (accion === 'invEntregasResumen')   r = await accionInvEntregasResumen(body, env);
    else if (accion === 'invItemsActas')        r = await accionInvItemsActas(body, env);
    else if (accion === 'getInvConfig')         r = await accionGetInvConfig(body, env);
    else if (accion === 'guardarInvConfig')     r = await accionGuardarInvConfig(body, env);
    else if (accion === 'eliminarInvConfig')    r = await accionEliminarInvConfig(body, env);
    else if (accion === 'invGetFirma')          r = await accionInvGetFirma(body, env);
    else if (accion === 'getConfigEmpresa')     r = await accionGetConfigEmpresa(body, env);
    else if (accion === 'guardarConfigEmpresa') r = await accionGuardarConfigEmpresa(body, env);
    else if (accion === 'getNomConfig')         r = await accionGetNomConfig(body, env);
    else if (accion === 'guardarNomConfig')     r = await accionGuardarNomConfig(body, env);
    else if (accion === 'getVigHorasSemana')    r = await accionGetVigHorasSemana(body, env);
    else if (accion === 'getConsolidadoCoord')  r = await accionGetConsolidadoCoord(body, env);
    else if (accion === 'getIndiceDup')         r = await accionGetIndiceDup(body, env);
    else if (accion === 'verificarDuplicadosLote') r = await accionVerificarDuplicadosLote(body, env);
    else if (accion === 'guardarTarifa')        r = await accionGuardarTarifa(body, env);
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
const FESTIVOS_2026 = new Set(['1/1','12/1','23/3','2/4','3/4','1/5','18/5','8/6','15/6','29/6','20/7','7/8','17/8','12/10','2/11','16/11','8/12','25/12']);
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
  const filtroTipo = String(body.tipo || '').trim();
  const desde = parseInt(body.desde) || 2;
  const lote = filtroSem ? 5000 : 3000;
  const offset = Math.max(0, desde - 2);

  const cols = 'id,coordinador_id,semana,cedula,dia,fecha,tipo,id_labor,unidad,cantidad,pago_trabajador,cobro_riopaila,auxilio_alim,novedad,observacion,es_vigilancia,vig_hd,vig_hn,dom_fest,cobro_vigilancia,obs_tarea,fecha_registro,coordinadores(nombre,administrador),trabajadores(nombres)';
  let path = `detalle_dia?select=${cols}&order=fecha_registro`;
  if (filtroSem) path += `&semana=eq.${parseInt(filtroSem)}`;
  if (filtroCed) path += `&cedula=eq.${parseInt(filtroCed.replace(/,/g, ''))}`;
  if (filtroTipo) path += `&tipo=eq.${encodeURIComponent(filtroTipo)}`;
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
  const hayMas = rows.length > 0 && (offset + rows.length < total);
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
  // Releer lo que quedó realmente guardado (para confirmar en pantalla y detectar si no se aplicó)
  let guardado = null;
  try {
    const ver = await sb(env, `detalle_dia?select=id,cantidad,pago_trabajador,cobro_riopaila,cobro_vigilancia,id_labor,semana,dia&id=eq.${encodeURIComponent(id)}&limit=1`);
    if (ver.length) {
      const g = ver[0];
      guardado = {
        cant: parseFloat(g.cantidad) || 0,
        pago: parseFloat(g.pago_trabajador) || 0,
        cobro: parseFloat(g.cobro_riopaila) || 0,
        cobroVig: parseFloat(g.cobro_vigilancia) || 0,
        labId: String(g.id_labor || ''), sem: String(g.semana == null ? '' : g.semana), dia: String(g.dia || ''),
      };
    }
  } catch (e) { /* si falla la relectura, el PATCH igual se hizo */ }
  if (!guardado) return { ok: false, error: 'El registro no se encontró después de guardar (id ' + id + ')' };
  return { ok: true, guardado };
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

  // 2) Días subidos (combinaciones únicas coord+semana+día vía vista cobertura_dias,
  //    para no traer decenas de miles de filas y pasar el límite de subrequests)
  const filasDD = await sbAll(env, `cobertura_dias?select=coordinador_id,semana,dia&semana=gte.${desde}`);
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
    if (rol && fRol !== rol) {
      // El ADMIN (super usuario) aparece también en Recursos Humanos y SST
      if (!((rol === 'rrhh' || rol === 'sst') && String(f.usuario).trim().toUpperCase() === 'ADMIN')) continue;
    }
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
function fechaONull(v) {
  v = String(v || '').trim();
  if (!v) return null;
  if (/^\d{4}-\d{2}-\d{2}/.test(v)) return v.slice(0, 10);              // ya ISO (yyyy-mm-dd)
  var m = v.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})/);            // dd/mm/yyyy o d/m/yyyy
  if (m) return m[3] + '-' + ('0' + m[2]).slice(-2) + '-' + ('0' + m[1]).slice(-2);
  return null;                                                          // formato desconocido → null (no rompe la BD)
}

// FACTURAS
async function accionGuardarFactura(body, env) {
  const f = body.factura;
  if (!f || !f.nfac) return { ok: false, error: 'Datos de factura incompletos' };
  const id = f.id || crypto.randomUUID().slice(0, 8);
  const fila = {
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
  };
  // ¿Ya existe esa factura? → actualizar (no pisa no_detallable / fecha_registro / fecha_pago).
  // Si no existe → insertar como nueva.
  const ex = f.id ? await sb(env, `facturas?select=id&id=eq.${encodeURIComponent(id)}&limit=1`) : [];
  if (ex.length) {
    await sbWrite(env, 'PATCH', `facturas?id=eq.${encodeURIComponent(id)}`, fila);
  } else {
    fila.id = id;
    fila.no_detallable = false;
    fila.fecha_registro = isoDate(new Date());
    fila.fecha_pago = null;
    // upsert por id: si el id ya existía (edición o condición de carrera) actualiza en vez de fallar
    await sbUpsert(env, 'facturas', fila, 'id');
  }
  return { ok: true, id };
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
  if (fpago) { const iso = fechaONull(fpago); if (iso) cambios.fecha_pago = iso; }
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
    sbAll(env, 'cobros_historicos?select=id,coordinador,administrador,semana,valor_cobro,fecha_registro,nota'),
    sb(env, 'coordinadores?select=nombre,administrador'),
  ]);
  const adminMap = new Map();
  for (const c of coords) adminMap.set(String(c.nombre || '').trim().toUpperCase(), String(c.administrador || '').trim());
  const cobros = rows.map((r) => ({
    id: String(r.id == null ? '' : r.id).trim(),
    coord: String(r.coordinador || '').trim(),
    admin: String(r.administrador || '').trim() || adminMap.get(String(r.coordinador || '').trim().toUpperCase()) || '',
    sem: String(r.semana == null ? '' : r.semana).trim(),
    val: parseFloat(r.valor_cobro) || 0,
    nota: String(r.nota || '').trim(),
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
    administrador: f.admin || '',
    semana: parseInt(f.sem) || null,
    valor_cobro: f.val || 0,
    fecha_registro: ahora,
  }));
  await sbWrite(env, 'POST', 'cobros_historicos', rows);
  return { ok: true, guardados: rows.length };
}

// ---------------------------------------------------------------------
//  MÓDULO NÓMINA (acumulados)
// ---------------------------------------------------------------------

// GET ACUMULADOS — el ledger, paginado, con filtros; reconstruye NOMBRES por join
async function accionGetAcumulados(body, env) {
  const filtroCed = String(body.ced || '').trim();
  const filtroQna = String(body.qna || '').trim();
  const filtroTipo = String(body.tipo || '').trim();
  const desde = parseInt(body.desde) || 2;
  const pageSize = parseInt(body.pageSize) || 5000;
  const offset = Math.max(0, desde - 2);

  let path = 'acumulados?select=id_origen,cedula,fecha_quincena,qna_label,mes,tipo,categoria,concepto,valor,obs,fecha_carga,cargado_por,trabajadores(nombres)&order=id';
  if (filtroCed) path += `&cedula=eq.${parseInt(filtroCed.replace(/,/g, ''))}`;
  if (filtroQna) path += `&qna_label=eq.${encodeURIComponent(filtroQna)}`;
  if (filtroTipo) path += `&tipo=eq.${encodeURIComponent(filtroTipo)}`;

  const { rows, total } = await sbPage(env, path, offset, pageSize);
  const acumulados = rows.map((f) => ({
    ID: String(f.id_origen || '').trim(),
    CEDULA: String(f.cedula == null ? '' : f.cedula).trim(),
    NOMBRES: f.trabajadores ? String(f.trabajadores.nombres || '').trim() : '',
    FECHA_QUINCENA: f.fecha_quincena ? String(f.fecha_quincena).slice(0, 10) : '',
    QNA_LABEL: String(f.qna_label || '').trim(),
    MES: String(f.mes || '').trim(),
    TIPO: String(f.tipo || '').trim(),
    CATEGORIA: String(f.categoria || '').trim(),
    CONCEPTO: String(f.concepto || '').trim(),
    VALOR: parseFloat(f.valor) || 0,
    OBS: String(f.obs || '').trim(),
    FECHA_CARGA: f.fecha_carga ? String(f.fecha_carga).slice(0, 16).replace('T', ' ') : '',
    CARGADO_POR: String(f.cargado_por || '').trim(),
  }));
  const hayMas = rows.length > 0 && (offset + rows.length < total);
  return { ok: true, acumulados, total, hayMas, siguienteFila: desde + rows.length };
}

// GET QUINCENAS ACUM — quincenas distintas cargadas (usa la vista quincenas_acum)
async function accionGetQuincenasAcum(body, env) {
  const rows = await sbAll(env, 'quincenas_acum?select=qna_label,fecha_quincena,mes');
  const seen = new Set();
  const lista = [];
  for (const r of rows) {
    const label = String(r.qna_label || '').trim();
    if (!label || seen.has(label)) continue;
    seen.add(label);
    lista.push({
      QNA_LABEL: label,
      FECHA: r.fecha_quincena ? String(r.fecha_quincena).slice(0, 10) : '',
      MES: String(r.mes || '').trim(),
    });
  }
  lista.sort((a, b) => (a.FECHA || '').localeCompare(b.FECHA || ''));
  return { ok: true, quincenas: lista };
}

// Cuenta filas de acumulados que matchean un filtro (para reportar cuántas se borran)
async function contarAcum(env, filtro) {
  const { total } = await sbPage(env, `acumulados?select=id${filtro ? '&' + filtro : ''}`, 0, 1);
  return total;
}

// IMPORTAR ACUMULADOS — inserta en lote; opción de reemplazar una quincena
async function accionImportarAcumulados(body, env) {
  const lista = body.acumulados || [];
  if (!Array.isArray(lista) || !lista.length) return { ok: false, error: 'Lista vacía' };
  const usuario = String(body.usuario || 'imp');
  const reemplazar = !!body.reemplazar;
  const qna = String(body.qna || '').trim();

  let reemplazados = 0;
  if (reemplazar && qna) {
    reemplazados = await contarAcum(env, `qna_label=eq.${encodeURIComponent(qna)}`);
    await sbWrite(env, 'DELETE', `acumulados?qna_label=eq.${encodeURIComponent(qna)}`);
  }

  const ahora = new Date().toISOString();
  const filas = lista.map((a) => ({
    id_origen: a.ID || ('AC' + Date.now() + Math.floor(Math.random() * 100000)),
    cedula: parseInt(String(a.CEDULA || '').replace(/,/g, '')) || null,
    fecha_quincena: fechaONull(a.FECHA_QUINCENA),
    qna_label: a.QNA_LABEL || '',
    mes: a.MES || '',
    tipo: a.TIPO || '',
    categoria: a.CATEGORIA || '',
    concepto: a.CONCEPTO || '',
    valor: a.VALOR || 0,
    obs: a.OBS || '',
    fecha_carga: ahora,
    cargado_por: usuario,
  }));
  await sbWrite(env, 'POST', 'acumulados', filas);
  return { ok: true, nuevos: filas.length, reemplazados };
}

// ELIMINAR ACUMULADOS DE UNA QUINCENA
async function accionEliminarAcumuladoQna(body, env) {
  const qna = String(body.qna || '').trim();
  if (!qna) return { ok: false, error: 'Falta etiqueta de quincena' };
  const eliminados = await contarAcum(env, `qna_label=eq.${encodeURIComponent(qna)}`);
  await sbWrite(env, 'DELETE', `acumulados?qna_label=eq.${encodeURIComponent(qna)}`);
  return { ok: true, eliminados };
}

// VACIAR TODOS LOS ACUMULADOS (peligroso; requiere confirmación)
async function accionVaciarAcumulados(body, env) {
  if (body.confirmar !== 'SI_BORRAR_TODO') return { ok: false, error: 'Confirmación requerida' };
  const eliminados = await contarAcum(env, '');
  await sbWrite(env, 'DELETE', 'acumulados?id=gt.0');
  return { ok: true, eliminados };
}

// ---------------------------------------------------------------------
//  PERMISOS DE SUBIDA TARDÍA
//  Permite habilitar a un coordinador, a varios, o a TODOS, para subir
//  una semana ya vencida. 'TODOS' se expande a un permiso por coordinador.
// ---------------------------------------------------------------------
async function accionGetPermisosSubida(body, env) {
  const rows = await sbAll(env, 'permisos_subida?select=id,coordinador,semana,vence,obs&order=id.desc');
  const permisos = rows.map((p) => ({
    ID: String(p.id),
    COORDINADOR: String(p.coordinador || '').trim(),
    SEMANA: String(p.semana == null ? '' : p.semana),
    VENCE: String(p.vence || '').trim(),
    OBS: String(p.obs || '').trim(),
  }));
  return { ok: true, permisos };
}

async function accionGuardarPermisoSubida(body, env) {
  const semana = parseInt(body.semana);
  if (!semana) return { ok: false, error: 'Falta la semana' };
  const vence = body.vence ? String(body.vence).trim() : null;
  const obs = body.obs || '';
  const usuario = body.usuario || '';

  let coords = [];
  if (Array.isArray(body.coordinadores) && body.coordinadores.length) {
    coords = body.coordinadores.map((c) => String(c).trim()).filter(Boolean);
  } else if (body.coordinador) {
    coords = [String(body.coordinador).trim()];
  }
  // 'TODOS' → expandir a un permiso por cada coordinador del maestro
  if (coords.some((c) => c.toUpperCase() === 'TODOS' || c === '__TODOS__')) {
    const todos = await sb(env, 'coordinadores?select=nombre&order=nombre');
    coords = todos.map((c) => String(c.nombre || '').trim()).filter(Boolean);
  }
  coords = [...new Set(coords.map((c) => c.toUpperCase()))];
  if (!coords.length) return { ok: false, error: 'Selecciona al menos un coordinador' };

  const filas = coords.map((c) => ({ coordinador: c, semana, vence, obs, otorgado_por: usuario }));
  await sbWrite(env, 'POST', 'permisos_subida', filas);
  return { ok: true, otorgados: filas.length };
}

async function accionRevocarPermisoSubida(body, env) {
  const id = body.id;
  if (id === undefined || id === null || id === '') return { ok: false, error: 'Falta id' };
  await sbWrite(env, 'DELETE', `permisos_subida?id=eq.${encodeURIComponent(id)}`);
  return { ok: true };
}

// ---------------------------------------------------------------------
//  MÓDULO RH (trabajadores, vacaciones, plantillas)
// ---------------------------------------------------------------------

// Upsert PostgREST (inserta o actualiza según columna de conflicto)
async function sbUpsert(env, tabla, filas, onConflict) {
  const url = `${baseUrl(env)}/rest/v1/${tabla}?on_conflict=${onConflict}`;
  const res = await fetch(url, {
    method: 'POST',
    headers: { ...headers(env), 'Content-Type': 'application/json', Prefer: 'resolution=merge-duplicates,return=minimal' },
    body: JSON.stringify(filas),
  });
  if (!res.ok) throw new Error('Supabase ' + res.status + ' [' + url + ']: ' + (await res.text()));
  return true;
}

// TRABAJADORES ---------------------------------------------------------
function nombresConcat(t) {
  return [t.P_NOMBRE, t.S_NOMBRE, t.P_APELLIDO, t.S_APELLIDO]
    .map((x) => String(x || '').trim()).filter(Boolean).join(' ').toUpperCase();
}
function trabAObjDB(t) {
  const row = {};
  for (const [key, col] of TRAB_MAP) {
    let v = t[key];
    if (v === undefined || v === '') v = null;
    row[col] = v;
  }
  row.cedula = parseInt(String(t.CEDULA || '').replace(/,/g, '')) || null;
  row.nombres = nombresConcat(t);
  return row;
}

async function accionGuardarTrabajador(body, env) {
  const t = body.trabajador || {};
  const cedNum = parseInt(String(t.CEDULA || '').replace(/,/g, ''));
  if (!cedNum) return { ok: false, error: 'Falta cédula' };
  const dup = await sb(env, `trabajadores?select=cedula&cedula=eq.${cedNum}&limit=1`);
  if (dup.length) return { ok: false, error: 'Ya existe un trabajador con esa cédula' };
  const row = trabAObjDB(t);
  row.fecha_registro = new Date().toISOString();
  row.actualizado_por = String(body.usuario || '');
  await sbWrite(env, 'POST', 'trabajadores', row);
  return { ok: true };
}

async function accionEditarTrabajador(body, env) {
  const t = body.trabajador || {};
  const cedNum = parseInt(String(t.CEDULA || '').replace(/,/g, ''));
  if (!cedNum) return { ok: false, error: 'Falta cédula' };
  const ex = await sb(env, `trabajadores?select=cedula&cedula=eq.${cedNum}&limit=1`);
  if (!ex.length) return { ok: false, error: 'Trabajador no encontrado' };
  const row = trabAObjDB(t);
  delete row.cedula;          // no cambiar la PK
  delete row.fecha_registro;  // conservar la fecha de creación original
  row.actualizado_por = String(body.usuario || '') + ' · ' + new Date().toISOString().slice(0, 16).replace('T', ' ');
  await sbWrite(env, 'PATCH', `trabajadores?cedula=eq.${cedNum}`, row);
  return { ok: true };
}

async function accionEliminarTrabajador(body, env) {
  const cedNum = parseInt(String(body.cedula || '').replace(/,/g, ''));
  if (!cedNum) return { ok: false, error: 'Falta cédula' };
  await sbWrite(env, 'DELETE', `trabajadores?cedula=eq.${cedNum}`);
  return { ok: true };
}

async function accionImportarTrabajadores(body, env) {
  const lista = body.trabajadores || [];
  if (!Array.isArray(lista) || !lista.length) return { ok: false, error: 'Sin trabajadores para importar' };
  const ahora = new Date().toISOString();
  const usuario = String(body.usuario || '');
  const filas = [];
  for (const t of lista) {
    const cedNum = parseInt(String(t.CEDULA || '').replace(/,/g, ''));
    if (!cedNum) continue;
    const row = trabAObjDB(t);
    row.fecha_registro = ahora;
    row.actualizado_por = usuario;
    filas.push(row);
  }
  if (!filas.length) return { ok: false, error: 'Sin cédulas válidas' };
  await sbUpsert(env, 'trabajadores', filas, 'cedula');
  return { ok: true, nuevos: filas.length };
}

// VACACIONES -----------------------------------------------------------
async function accionGetVacaciones(body, env) {
  const rows = await sbAll(env, 'vacaciones?select=id,cedula,periodo_causado,fecha_inicio,fecha_fin,dias,pago_quincenas,valor,observaciones,fecha_creacion,actualizado_por,trabajadores(nombres)');
  const vacaciones = rows.map((v) => ({
    ID: String(v.id || ''),
    CEDULA: String(v.cedula == null ? '' : v.cedula),
    NOMBRES: v.trabajadores ? String(v.trabajadores.nombres || '') : '',
    PERIODO_CAUSADO: String(v.periodo_causado || ''),
    FECHA_INICIO: v.fecha_inicio ? String(v.fecha_inicio).slice(0, 10) : '',
    FECHA_FIN: v.fecha_fin ? String(v.fecha_fin).slice(0, 10) : '',
    DIAS: parseFloat(v.dias) || 0,
    PAGO_QUINCENAS: String(v.pago_quincenas || ''),
    VALOR: parseFloat(v.valor) || 0,
    OBSERVACIONES: String(v.observaciones || ''),
    FECHA_CREACION: v.fecha_creacion ? String(v.fecha_creacion).slice(0, 16).replace('T', ' ') : '',
    ACTUALIZADO_POR: String(v.actualizado_por || ''),
  }));
  return { ok: true, vacaciones };
}

async function accionEliminarVacacion(body, env) {
  const id = String(body.id || '').trim();
  if (!id) return { ok: false, error: 'Falta ID' };
  await sbWrite(env, 'DELETE', `vacaciones?id=eq.${encodeURIComponent(id)}`);
  return { ok: true };
}

async function accionImportarVacaciones(body, env) {
  const lista = body.vacaciones || [];
  if (!Array.isArray(lista) || !lista.length) return { ok: false, error: 'Lista vacía' };
  const ahora = new Date().toISOString();
  const usuario = String(body.usuario || 'imp');
  const filas = lista.map((v) => ({
    id: v.ID || ('V' + Date.now() + Math.floor(Math.random() * 100000)),
    cedula: parseInt(String(v.CEDULA || '').replace(/,/g, '')) || null,
    periodo_causado: v.PERIODO_CAUSADO || '',
    fecha_inicio: fechaONull(v.FECHA_INICIO),
    fecha_fin: fechaONull(v.FECHA_FIN),
    dias: v.DIAS || 0,
    pago_quincenas: v.PAGO_QUINCENAS || '',
    valor: v.VALOR || 0,
    observaciones: v.OBSERVACIONES || '',
    fecha_creacion: ahora,
    actualizado_por: usuario + ' · imp',
  }));
  await sbWrite(env, 'POST', 'vacaciones', filas);
  return { ok: true, nuevos: filas.length };
}

// PLANTILLAS -----------------------------------------------------------
async function accionGetPlantillas(body, env) {
  const rows = await sbAll(env, 'plantillas?select=clave,nombre,tipo,contenido_html,variables_disponibles,fecha_mod,modificado_por');
  const plantillas = rows.map((p) => ({
    CLAVE: String(p.clave || ''),
    NOMBRE: String(p.nombre || ''),
    TIPO: String(p.tipo || ''),
    CONTENIDO_HTML: String(p.contenido_html || ''),
    VARIABLES_DISPONIBLES: String(p.variables_disponibles || ''),
    FECHA_MOD: p.fecha_mod ? String(p.fecha_mod).slice(0, 16).replace('T', ' ') : '',
    MODIFICADO_POR: String(p.modificado_por || ''),
  }));
  return { ok: true, plantillas };
}

async function accionGuardarPlantilla(body, env) {
  const p = body.plantilla || {};
  const clave = String(p.CLAVE || '').trim();
  if (!clave) return { ok: false, error: 'Falta clave' };
  if (!p.CONTENIDO_HTML) return { ok: false, error: 'Falta contenido' };
  const row = {
    clave,
    nombre: p.NOMBRE || '',
    tipo: p.TIPO || '',
    contenido_html: p.CONTENIDO_HTML || '',
    variables_disponibles: p.VARIABLES_DISPONIBLES || '',
    fecha_mod: new Date().toISOString(),
    modificado_por: String(body.usuario || ''),
  };
  await sbUpsert(env, 'plantillas', [row], 'clave');
  return { ok: true };
}

async function accionEliminarPlantilla(body, env) {
  const clave = String(body.clave || '').trim();
  if (!clave) return { ok: false, error: 'Falta clave' };
  await sbWrite(env, 'DELETE', `plantillas?clave=eq.${encodeURIComponent(clave)}`);
  return { ok: true };
}

// EDITAR un cobro histórico (para cruzar saldos 2025/2026)
async function accionEditarCobroHist(body, env) {
  const id = body.id;
  if (id === undefined || id === null || id === '') return { ok: false, error: 'Falta id' };
  const cambios = {};
  if (body.coordinador !== undefined) cambios.coordinador = String(body.coordinador || '').trim().toUpperCase();
  if (body.semana !== undefined) cambios.semana = parseInt(body.semana) || 0;
  if (body.valor !== undefined) cambios.valor_cobro = parseFloat(body.valor) || 0;
  if (body.administrador !== undefined) cambios.administrador = String(body.administrador || '').trim().toUpperCase();
  if (!Object.keys(cambios).length) return { ok: false, error: 'Nada que actualizar' };
  await sbWrite(env, 'PATCH', `cobros_historicos?id=eq.${encodeURIComponent(id)}`, cambios);
  return { ok: true };
}

// ===== GESTIÓN DE USUARIOS Y COORDINADORES (Administrativo) =====
async function accionGetUsuariosAdmin(body, env) {
  const filas = await sbAll(env, 'usuarios?select=id,usuario,rol,activo,sede&order=usuario');
  return { ok: true, usuarios: filas.map((u) => ({
    id: String(u.id), usuario: String(u.usuario || ''), rol: String(u.rol || ''),
    activo: u.activo === true, sede: String(u.sede || 'TODAS'),
  })) };
}
async function accionGuardarUsuario(body, env) {
  const usuario = String(body.usuario || '').trim().toUpperCase();
  const contrasena = String(body.contrasena || '').trim();
  if (!usuario || !contrasena) return { ok: false, error: 'Usuario y contraseña son requeridos' };
  const dup = await sb(env, `usuarios?select=id&usuario=ilike.${encodeURIComponent(usuario)}&limit=1`);
  if (dup.length) return { ok: false, error: 'Ya existe un usuario con ese nombre' };
  await sbWrite(env, 'POST', 'usuarios', {
    usuario, contrasena, rol: String(body.rol || 'coord').trim().toLowerCase(),
    activo: body.activo !== false, sede: String(body.sede || 'TODAS').trim().toUpperCase(),
  });
  return { ok: true };
}
async function accionEditarUsuario(body, env) {
  const id = body.id;
  if (!id) return { ok: false, error: 'Falta id' };
  const cambios = {};
  if (body.usuario !== undefined) cambios.usuario = String(body.usuario || '').trim().toUpperCase();
  if (body.rol !== undefined) cambios.rol = String(body.rol || '').trim().toLowerCase();
  if (body.activo !== undefined) cambios.activo = body.activo === true || body.activo === 'true' || body.activo === 'SI';
  if (body.sede !== undefined) cambios.sede = String(body.sede || 'TODAS').trim().toUpperCase();
  if (body.contrasena) cambios.contrasena = String(body.contrasena).trim();
  await sbWrite(env, 'PATCH', `usuarios?id=eq.${encodeURIComponent(id)}`, cambios);
  return { ok: true };
}
async function accionEliminarUsuario(body, env) {
  const id = body.id;
  if (!id) return { ok: false, error: 'Falta id' };
  await sbWrite(env, 'DELETE', `usuarios?id=eq.${encodeURIComponent(id)}`);
  return { ok: true };
}
async function accionGetCoordinadoresAdmin(body, env) {
  const filas = await sbAll(env, 'coordinadores?select=id,nombre,administrador,sede&order=nombre');
  return { ok: true, coordinadores: filas.map((c) => ({
    id: String(c.id), nombre: String(c.nombre || ''), administrador: String(c.administrador || ''), sede: String(c.sede || ''),
  })) };
}
async function accionGuardarCoordinador(body, env) {
  const nombre = String(body.nombre || '').trim().toUpperCase();
  if (!nombre) return { ok: false, error: 'El nombre es requerido' };
  const dup = await sb(env, `coordinadores?select=id&nombre=ilike.${encodeURIComponent(nombre)}&limit=1`);
  if (dup.length) return { ok: false, error: 'Ya existe un coordinador con ese nombre' };
  await sbWrite(env, 'POST', 'coordinadores', {
    nombre, administrador: String(body.administrador || '').trim().toUpperCase(), sede: String(body.sede || '').trim().toUpperCase(),
  });
  return { ok: true };
}
async function accionEditarCoordinador(body, env) {
  const id = body.id;
  if (!id) return { ok: false, error: 'Falta id' };
  const cambios = {};
  if (body.nombre !== undefined) cambios.nombre = String(body.nombre || '').trim().toUpperCase();
  if (body.administrador !== undefined) cambios.administrador = String(body.administrador || '').trim().toUpperCase();
  if (body.sede !== undefined) cambios.sede = String(body.sede || '').trim().toUpperCase();
  await sbWrite(env, 'PATCH', `coordinadores?id=eq.${encodeURIComponent(id)}`, cambios);
  return { ok: true };
}
async function accionEliminarCoordinador(body, env) {
  const id = body.id;
  if (!id) return { ok: false, error: 'Falta id' };
  try {
    await sbWrite(env, 'DELETE', `coordinadores?id=eq.${encodeURIComponent(id)}`);
  } catch (e) {
    const m = String((e && e.message) || e).toLowerCase();
    if (m.includes('23503') || m.includes('foreign')) return { ok: false, error: 'No se puede eliminar: el coordinador tiene registros asociados' };
    throw e;
  }
  return { ok: true };
}

// ===== CONCEPTOS DEL IMPORTADOR DE ACUMULADOS (concepto -> tipo/categoria) =====
async function accionGetConceptosAcum(body, env) {
  const rows = await sbAll(env, 'conceptos_acumulados?select=concepto,tipo,categoria&order=concepto');
  return { ok: true, data: rows.map((r) => ({ concepto: String(r.concepto || ''), tipo: String(r.tipo || ''), categoria: String(r.categoria || '') })) };
}
async function accionGuardarConceptoAcum(body, env) {
  const concepto = String(body.concepto || '').trim().toUpperCase();
  if (!concepto) return { ok: false, error: 'Falta el concepto' };
  const tipo = String(body.tipo || 'OTRO').trim().toUpperCase();
  const categoria = String(body.categoria || 'Otro').trim();
  const ex = await sb(env, `conceptos_acumulados?select=concepto&concepto=eq.${encodeURIComponent(concepto)}&limit=1`);
  if (ex.length) await sbWrite(env, 'PATCH', `conceptos_acumulados?concepto=eq.${encodeURIComponent(concepto)}`, { tipo, categoria });
  else await sbWrite(env, 'POST', 'conceptos_acumulados', { concepto, tipo, categoria });
  return { ok: true };
}
async function accionEliminarConceptoAcum(body, env) {
  const concepto = String(body.concepto || '').trim().toUpperCase();
  if (!concepto) return { ok: false, error: 'Falta el concepto' };
  await sbWrite(env, 'DELETE', `conceptos_acumulados?concepto=eq.${encodeURIComponent(concepto)}`);
  return { ok: true };
}

// Borrado MASIVO de registros (varios ids a la vez, por lotes)
async function accionEliminarRegistros(body, env) {
  const ids = (body.ids || []).map((x) => String(x).trim()).filter(Boolean);
  if (!ids.length) return { ok: false, error: 'Sin registros seleccionados' };
  let borrados = 0;
  for (let i = 0; i < ids.length; i += 100) {
    const lote = ids.slice(i, i + 100).map((x) => encodeURIComponent(x)).join(',');
    await sbWrite(env, 'DELETE', `detalle_dia?id=in.(${lote})`, undefined);
    borrados += Math.min(100, ids.length - i);
  }
  return { ok: true, borrados };
}

// ===== CRUCE DE SALDOS ENTRE COORDINADORES =====
async function accionGetCruces(body, env) {
  const rows = await sbAll(env, 'cruces_saldos?select=id,coord_origen,coord_destino,monto,fecha,motivo,usuario&order=fecha.desc');
  return { ok: true, cruces: rows.map((r) => ({
    id: String(r.id), origen: String(r.coord_origen || ''), destino: String(r.coord_destino || ''),
    monto: parseFloat(r.monto) || 0, fecha: String(r.fecha || '').slice(0, 10),
    motivo: String(r.motivo || ''), usuario: String(r.usuario || ''),
  })) };
}
async function accionGuardarCruce(body, env) {
  const origen = String(body.origen || '').trim();
  const destino = String(body.destino || '').trim();
  const monto = parseFloat(body.monto) || 0;
  if (!origen || !destino) return { ok: false, error: 'Faltan los coordinadores' };
  if (origen === destino) return { ok: false, error: 'El origen y el destino no pueden ser el mismo coordinador' };
  if (monto <= 0) return { ok: false, error: 'El monto debe ser mayor a cero' };
  await sbWrite(env, 'POST', 'cruces_saldos', {
    coord_origen: origen, coord_destino: destino, monto,
    motivo: String(body.motivo || '').trim(), usuario: String(body.usuario || '').trim(),
  });
  return { ok: true };
}
async function accionEliminarCruce(body, env) {
  const id = body.id;
  if (!id) return { ok: false, error: 'Falta id' };
  await sbWrite(env, 'DELETE', `cruces_saldos?id=eq.${encodeURIComponent(id)}`);
  return { ok: true };
}

// CRUZAR SALDOS entre dos coordinadores (traslada saldo; registra 2 movimientos sem 0 en cobros_historicos)
async function accionCruzarSaldos(body, env) {
  const origen = String(body.origen || '').trim();
  const destino = String(body.destino || '').trim();
  const admOrigen = String(body.admOrigen || '').trim().toUpperCase();
  const admDestino = String(body.admDestino || '').trim().toUpperCase();
  const valor = Math.abs(parseFloat(body.valor) || 0);
  if (!origen || !destino) return { ok: false, error: 'Falta origen o destino' };
  if (origen.toUpperCase() === destino.toUpperCase() && admOrigen === admDestino) return { ok: false, error: 'Origen y destino no pueden ser el mismo' };
  if (!valor) return { ok: false, error: 'El monto debe ser mayor a 0' };
  const semana = parseInt(body.semana) || 0;
  const vOrigen = semana === 0 ? -valor : valor;   // sem0: saldo += val; semana normal (rep): saldo -= val
  const vDestino = semana === 0 ? valor : -valor;
  const hoy = isoDate(new Date());
  await sbWrite(env, 'POST', 'cobros_historicos', [
    { coordinador: origen, administrador: admOrigen, semana, valor_cobro: vOrigen, fecha_registro: hoy, nota: 'CRUCE \u2192 ' + destino },
    { coordinador: destino, administrador: admDestino, semana, valor_cobro: vDestino, fecha_registro: hoy, nota: 'CRUCE \u2190 ' + origen }
  ]);
  return { ok: true };
}

// GUARDAR una sola vacación (agregar un periodo)
async function accionGuardarVacacion(body, env) {
  const v = body.vacacion || {};
  const cedula = parseInt(String(v.CEDULA || '').replace(/,/g, '')) || null;
  if (!cedula) return { ok: false, error: 'Falta la cédula del trabajador' };
  const fila = {
    id: v.ID || ('V' + Date.now() + Math.floor(Math.random() * 100000)),
    cedula,
    periodo_causado: v.PERIODO_CAUSADO || '',
    fecha_inicio: fechaONull(v.FECHA_INICIO),
    fecha_fin: fechaONull(v.FECHA_FIN),
    dias: v.DIAS || 0,
    pago_quincenas: v.PAGO_QUINCENAS || '',
    valor: v.VALOR || 0,
    observaciones: v.OBSERVACIONES || '',
    fecha_creacion: new Date().toISOString(),
    actualizado_por: String(body.usuario || '') + ' · nuevo',
  };
  await sbWrite(env, 'POST', 'vacaciones', fila);
  return { ok: true };
}

// EDITAR una vacación existente (por id)
async function accionEditarVacacion(body, env) {
  const v = body.vacacion || {};
  const id = String(v.ID || '').trim();
  if (!id) return { ok: false, error: 'Falta el id de la vacación' };
  const cambios = {
    cedula: parseInt(String(v.CEDULA || '').replace(/,/g, '')) || null,
    periodo_causado: v.PERIODO_CAUSADO || '',
    fecha_inicio: fechaONull(v.FECHA_INICIO),
    fecha_fin: fechaONull(v.FECHA_FIN),
    dias: v.DIAS || 0,
    pago_quincenas: v.PAGO_QUINCENAS || '',
    valor: v.VALOR || 0,
    observaciones: v.OBSERVACIONES || '',
    actualizado_por: String(body.usuario || '') + ' · edit',
  };
  await sbWrite(env, 'PATCH', `vacaciones?id=eq.${encodeURIComponent(id)}`, cambios);
  return { ok: true };
}


// ═══════════════════════════════════════════════════════════════════════════
//  MÓDULO SST — INVENTARIO DE ALMACÉN
// ═══════════════════════════════════════════════════════════════════════════

// Listado del inventario con stock (lee la vista inventario_v)
async function accionGetInventario(body, env) {
  const rows = await sbAll(env, 'inventario_v?select=item,producto,categoria,precio,stock,valor_stock,activo&order=categoria,producto');
  const cat = String(body.categoria || '').trim().toUpperCase();
  let data = rows.map((r) => ({
    item: String(r.item || ''),
    producto: String(r.producto || ''),
    categoria: String(r.categoria || ''),
    precio: Number(r.precio || 0),
    stock: Number(r.stock || 0),
    valor_stock: Number(r.valor_stock || 0),
    activo: r.activo !== false,
  }));
  if (cat) data = data.filter((d) => d.categoria === cat);
  return { ok: true, data };
}

// Crear / editar producto del catálogo
async function accionInvGuardarProducto(body, env) {
  let item = String(body.item || '').trim();
  const producto = String(body.producto || '').trim();
  if (!producto) return { ok: false, error: 'Falta el nombre del producto' };
  const categoria = String(body.categoria || 'EPP').trim().toUpperCase();
  const precio = parseFloat(body.precio) || 0;
  if (item) {
    // editar (o insertar con código dado)
    const ex = await sb(env, `inventario?select=item&item=eq.${encodeURIComponent(item)}&limit=1`);
    if (ex.length) await sbWrite(env, 'PATCH', `inventario?item=eq.${encodeURIComponent(item)}`, { producto, categoria, precio });
    else await sbWrite(env, 'POST', 'inventario', { item, producto, categoria, precio });
    return { ok: true, item };
  }
  // generar código nuevo por categoría: prefijo + consecutivo
  const pref = categoria.startsWith('IND') ? 'INDU' : categoria.startsWith('HERR') ? 'HE' : 'EPP';
  const rows = await sbAll(env, `inventario?select=item&item=like.${pref}*`);
  let max = 0;
  rows.forEach((r) => { const m = String(r.item).match(/(\d+)$/); if (m) max = Math.max(max, parseInt(m[1])); });
  item = pref + String(max + 1).padStart(3, '0');
  await sbWrite(env, 'POST', 'inventario', { item, producto, categoria, precio });
  return { ok: true, item };
}
async function accionInvEliminarProducto(body, env) {
  const item = String(body.item || '').trim();
  if (!item) return { ok: false, error: 'Falta item' };
  const mv = await sb(env, `inv_movimientos?select=id_movimiento&item=eq.${encodeURIComponent(item)}&limit=1`);
  if (mv.length) return { ok: false, error: 'Ese producto tiene movimientos registrados; no se puede borrar (puedes dejarlo sin stock).' };
  await sbWrite(env, 'DELETE', `inventario?item=eq.${encodeURIComponent(item)}`);
  return { ok: true };
}

// Kardex / movimientos (con filtros item, fecha)
async function accionInvGetMovimientos(body, env) {
  const item = String(body.item || '').trim();
  const desde = String(body.desde || '').trim();
  const hasta = String(body.hasta || '').trim();
  let path = 'inv_movimientos?select=id_movimiento,id_regn,item,categoria,fecha,factura_id,producto,entradas,salidas,precio_un,novedad,empleado&order=fecha.desc&limit=1000';
  if (item) path += `&item=eq.${encodeURIComponent(item)}`;
  if (desde) path += `&fecha=gte.${encodeURIComponent(desde)}`;
  if (hasta) path += `&fecha=lte.${encodeURIComponent(hasta + ' 23:59:59')}`;
  const rows = await sbAll(env, path);
  return { ok: true, data: rows };
}

// Registrar ENTRADA (compra/ingreso): crea productos nuevos con código
// automático por categoría, o suma stock a los existentes.
async function accionInvRegistrarEntrada(body, env) {
  const items = Array.isArray(body.items) ? body.items : [];
  const fecha = String(body.fecha || '').trim() || isoDate(new Date());
  if (!items.length) return { ok: false, error: 'Agrega al menos un producto' };

  // Cargar inventario para: verificar existentes por nombre+categoría y calcular próximos códigos
  const inv = await sbAll(env, 'inventario?select=item,producto,categoria,precio');
  const maxPref = { EPP: 0, HE: 0, INDU: 0 };
  const porNombreCat = {}; // "CAT|NOMBRE" -> item
  const porItem = {};
  inv.forEach((p) => {
    const m = String(p.item).match(/^([A-Z]+)(\d+)$/);
    if (m && maxPref[m[1]] !== undefined) maxPref[m[1]] = Math.max(maxPref[m[1]], parseInt(m[2]));
    porNombreCat[String(p.categoria).toUpperCase() + '|' + String(p.producto).toUpperCase().trim()] = p.item;
    porItem[p.item] = p;
  });
  const prefDe = (cat) => (cat.indexOf('IND') === 0 ? 'INDU' : cat.indexOf('HE') === 0 || cat.indexOf('HERR') === 0 ? 'HE' : 'EPP');

  const nuevosProd = [];
  const movimientos = [];
  let nid = Date.now();
  for (const it of items) {
    let item = String(it.item || '').trim();
    let producto = String(it.producto || '').trim();
    let categoria = String(it.categoria || '').trim().toUpperCase();
    const cantidad = parseFloat(it.cantidad) || 0;
    const precio = parseFloat(it.precio) || 0;
    if (!cantidad) continue;

    if (!item) {
      // sin código: es nuevo o existente-por-nombre
      if (!producto || !categoria) continue;
      const key = categoria + '|' + producto.toUpperCase();
      if (porNombreCat[key]) {
        item = porNombreCat[key]; // ya existe ese nombre en esa categoría → suma
      } else {
        const pref = prefDe(categoria);
        maxPref[pref] = (maxPref[pref] || 0) + 1;
        item = pref + String(maxPref[pref]).padStart(3, '0');
        porNombreCat[key] = item;
        nuevosProd.push({ item, producto, categoria, precio });
      }
    } else {
      // código dado: completar datos desde el inventario
      const p = porItem[item];
      if (p) { producto = producto || p.producto; categoria = categoria || p.categoria; }
    }
    movimientos.push({
      id_movimiento: 'MOV' + (nid++).toString(36).toUpperCase() + Math.random().toString(36).slice(2, 4).toUpperCase(),
      id_regn: null, item, categoria, fecha,
      factura_id: String(body.factura || '').trim(), producto,
      entradas: cantidad, salidas: 0, precio_un: precio || (porItem[item] ? Number(porItem[item].precio || 0) : 0),
      novedad: String(body.novedad || 'ENTRADA').trim(), empleado: '',
      origen: String(body.origen || '').trim(),
    });
  }
  if (!movimientos.length) return { ok: false, error: 'No hay productos válidos (revisa nombre/categoría y cantidad)' };
  if (nuevosProd.length) await sbWrite(env, 'POST', 'inventario', nuevosProd);
  await sbWrite(env, 'POST', 'inv_movimientos', movimientos);
  return { ok: true, n: movimientos.length, nuevos: nuevosProd.length, codigos: nuevosProd.map((p) => p.item) };
}

// Registrar SALIDA / entrega: crea el acta (con firma) + movimientos de salida
async function accionInvRegistrarSalida(body, env) {
  const items = Array.isArray(body.items) ? body.items : [];
  const fecha = String(body.fecha || '').trim() || isoDate(new Date());
  if (!items.length) return { ok: false, error: 'Agrega al menos un producto' };
  const empleado = String(body.empleado_proveedor || '').trim();
  if (!empleado) return { ok: false, error: 'Falta el empleado / proveedor que recibe' };
  const idRegn = Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
  await sbWrite(env, 'POST', 'inv_registros', {
    id_regn: idRegn,
    auxiliar: String(body.auxiliar || '').trim(),
    empleado_proveedor: empleado,
    id_factura: String(body.id_factura || '').trim(),
    fecha,
    firma: '',
    sede: 'NORTE',
  });
  // la firma va en su tabla aparte (no engorda el historial)
  const firma = String(body.firma || '');
  if (firma && firma.length > 20) {
    await sbWrite(env, 'POST', 'inv_firmas', { id_regn: idRegn, firma });
  }
  const filas = items.filter((it) => String(it.item || '').trim()).map((it) => ({
    id_movimiento: 'MOV' + Date.now().toString(36).toUpperCase() + Math.random().toString(36).slice(2, 6).toUpperCase(),
    id_regn: idRegn,
    item: String(it.item).trim(),
    categoria: String(it.categoria || '').trim().toUpperCase(),
    fecha,
    factura_id: String(body.id_factura || '').trim(),
    producto: String(it.producto || '').trim(),
    entradas: 0,
    salidas: parseFloat(it.cantidad) || 0,
    precio_un: parseFloat(it.precio) || 0,
    novedad: String(body.novedad || '').trim(),
    empleado,
  }));
  if (filas.length) await sbWrite(env, 'POST', 'inv_movimientos', filas);
  return { ok: true, id_regn: idRegn };
}

// Historial de actas (cabecera + sus items), con filtros
async function accionInvGetActas(body, env) {
  const desde = String(body.desde || '').trim();
  const hasta = String(body.hasta || '').trim();
  let path = 'inv_registros?select=id_regn,auxiliar,empleado_proveedor,id_factura,fecha,firma_ref&order=fecha.desc';
  if (desde) path += `&fecha=gte.${encodeURIComponent(desde)}`;
  if (hasta) path += `&fecha=lte.${encodeURIComponent(hasta + ' 23:59:59')}`;
  // Traer solo las actas más recientes (evita traer 1400+ y URLs enormes)
  const { rows: actas } = await sbPage(env, path, 0, 300);
  if (!actas.length) return { ok: true, data: [] };
  // qué actas tienen firma (solo ids, liviano)
  const firmadas = {};
  try { (await sbAll(env, 'inv_firmas?select=id_regn')).forEach((f) => { firmadas[f.id_regn] = true; }); } catch (e) { /* tabla puede no existir aún */ }
  // Items por lotes de 80 ids (una URL con 300 ids sería rechazada por longitud)
  const porActa = {};
  for (let i = 0; i < actas.length; i += 80) {
    const chunk = actas.slice(i, i + 80);
    const ids = chunk.map((a) => `"${String(a.id_regn).replace(/"/g, '')}"`).join(',');
    const items = await sbAll(env, `inv_movimientos?select=id_regn,item,producto,salidas,entradas,precio_un&id_regn=in.(${ids})`);
    items.forEach((it) => {
      (porActa[it.id_regn] = porActa[it.id_regn] || []).push({
        item: String(it.item || ''), producto: String(it.producto || ''),
        cantidad: Number(it.salidas || 0) || Number(it.entradas || 0), precio_un: Number(it.precio_un || 0),
      });
    });
  }
  const data = actas.map((a) => ({
    id_regn: a.id_regn,
    auxiliar: String(a.auxiliar || ''),
    empleado_proveedor: String(a.empleado_proveedor || ''),
    id_factura: String(a.id_factura || ''),
    fecha: a.fecha,
    firma: '',
    tiene_firma: !!firmadas[a.id_regn],
    items: porActa[a.id_regn] || [],
  }));
  return { ok: true, data };
}
async function accionInvEliminarActa(body, env) {
  const id = String(body.id_regn || '').trim();
  if (!id) return { ok: false, error: 'Falta id_regn' };
  await sbWrite(env, 'DELETE', `inv_movimientos?id_regn=eq.${encodeURIComponent(id)}`);
  await sbWrite(env, 'DELETE', `inv_registros?id_regn=eq.${encodeURIComponent(id)}`);
  return { ok: true };
}

// Resumen de TODAS las entregas (cabeceras, sin items) para agrupar por empleado
async function accionInvEntregasResumen(body, env) {
  const actas = await sbAll(env, 'inv_registros?select=id_regn,empleado_proveedor,id_factura,fecha,auxiliar&order=fecha.desc');
  const firmadas = {};
  try { (await sbAll(env, 'inv_firmas?select=id_regn')).forEach((f) => { firmadas[f.id_regn] = true; }); } catch (e) { /* tabla puede no existir aún */ }
  const data = actas.map((a) => ({
    id_regn: a.id_regn,
    empleado_proveedor: String(a.empleado_proveedor || ''),
    id_factura: String(a.id_factura || ''),
    fecha: a.fecha,
    auxiliar: String(a.auxiliar || ''),
    tiene_firma: !!firmadas[a.id_regn],
  }));
  return { ok: true, data };
}

// Items (elementos) de una lista de actas — cargados a demanda al expandir
async function accionInvItemsActas(body, env) {
  const ids = Array.isArray(body.ids) ? body.ids : [];
  if (!ids.length) return { ok: true, data: [] };
  const out = [];
  for (let i = 0; i < ids.length; i += 80) {
    const chunk = ids.slice(i, i + 80).map((x) => `"${String(x).replace(/"/g, '')}"`).join(',');
    const part = await sbAll(env, `inv_movimientos?select=id_regn,item,producto,salidas,entradas&id_regn=in.(${chunk})`);
    part.forEach((it) => out.push({
      id_regn: it.id_regn, item: String(it.item || ''), producto: String(it.producto || ''),
      cantidad: Number(it.salidas || 0) || Number(it.entradas || 0),
    }));
  }
  return { ok: true, data: out };
}

// ── Configuración de inventario: auxiliares y proveedores ──
async function accionGetInvConfig(body, env) {
  const rows = await sbAll(env, 'inv_config?select=id,tipo,nombre,activo&order=tipo,nombre');
  const data = rows.map((r) => ({ id: r.id, tipo: String(r.tipo || ''), nombre: String(r.nombre || ''), activo: r.activo !== false }));
  return { ok: true, data };
}
async function accionGuardarInvConfig(body, env) {
  const tipo = String(body.tipo || '').trim().toLowerCase();
  const nombre = String(body.nombre || '').trim();
  if (tipo !== 'auxiliar' && tipo !== 'proveedor') return { ok: false, error: 'Tipo inválido' };
  if (!nombre) return { ok: false, error: 'Falta el nombre' };
  if (body.id) {
    await sbWrite(env, 'PATCH', `inv_config?id=eq.${encodeURIComponent(body.id)}`, { nombre });
  } else {
    const ex = await sb(env, `inv_config?select=id&tipo=eq.${encodeURIComponent(tipo)}&nombre=eq.${encodeURIComponent(nombre)}&limit=1`);
    if (ex.length) return { ok: true, id: ex[0].id }; // ya existe
    await sbWrite(env, 'POST', 'inv_config', { tipo, nombre });
  }
  return { ok: true };
}
async function accionEliminarInvConfig(body, env) {
  if (!body.id) return { ok: false, error: 'Falta id' };
  await sbWrite(env, 'DELETE', `inv_config?id=eq.${encodeURIComponent(body.id)}`);
  return { ok: true };
}

// Trae la firma (base64) de una entrega — solo al abrir el acta
async function accionInvGetFirma(body, env) {
  const id = String(body.id_regn || '').trim();
  if (!id) return { ok: false, error: 'Falta id_regn' };
  const rows = await sb(env, `inv_firmas?select=firma&id_regn=eq.${encodeURIComponent(id)}&limit=1`);
  if (rows.length) return { ok: true, firma: String(rows[0].firma || '') };
  const leg = await sb(env, `inv_registros?select=firma&id_regn=eq.${encodeURIComponent(id)}&limit=1`);
  return { ok: true, firma: (leg.length && leg[0].firma) ? String(leg[0].firma) : '' };
}

// ── Datos de la empresa (config para cartas y actas) ──
async function accionGetConfigEmpresa(body, env) {
  const rows = await sbAll(env, 'config_empresa?select=clave,valor');
  const data = {};
  rows.forEach((r) => { data[String(r.clave)] = String(r.valor || ''); });
  return { ok: true, data };
}
async function accionGuardarConfigEmpresa(body, env) {
  const datos = body.datos || {};
  const claves = Object.keys(datos);
  for (const clave of claves) {
    const valor = String(datos[clave] == null ? '' : datos[clave]);
    const ex = await sb(env, `config_empresa?select=clave&clave=eq.${encodeURIComponent(clave)}&limit=1`);
    if (ex.length) await sbWrite(env, 'PATCH', `config_empresa?clave=eq.${encodeURIComponent(clave)}`, { valor });
    else await sbWrite(env, 'POST', 'config_empresa', { clave, valor });
  }
  return { ok: true };
}

// Editar una entrega completa (cabecera + elementos)
async function accionInvEditarActa(body, env) {
  const id = String(body.id_regn || '').trim();
  if (!id) return { ok: false, error: 'Falta id_regn' };
  const cab = {};
  if (body.fecha !== undefined) cab.fecha = String(body.fecha || '').trim() || null;
  if (body.empleado_proveedor !== undefined) cab.empleado_proveedor = String(body.empleado_proveedor || '').trim();
  if (body.id_factura !== undefined) cab.id_factura = String(body.id_factura || '').trim();
  if (body.auxiliar !== undefined) cab.auxiliar = String(body.auxiliar || '').trim();
  if (Object.keys(cab).length) await sbWrite(env, 'PATCH', `inv_registros?id_regn=eq.${encodeURIComponent(id)}`, cab);
  if (Array.isArray(body.items)) {
    await sbWrite(env, 'DELETE', `inv_movimientos?id_regn=eq.${encodeURIComponent(id)}`);
    const fecha = cab.fecha || String(body.fecha || '').trim() || isoDate(new Date());
    let nid = Date.now();
    const filas = body.items.filter((it) => String(it.item || '').trim()).map((it) => ({
      id_movimiento: 'MOV' + (nid++).toString(36).toUpperCase() + Math.random().toString(36).slice(2, 4).toUpperCase(),
      id_regn: id, item: String(it.item).trim(), categoria: String(it.categoria || '').trim().toUpperCase(),
      fecha, factura_id: cab.id_factura || '', producto: String(it.producto || '').trim(),
      entradas: 0, salidas: parseFloat(it.cantidad) || 0, precio_un: parseFloat(it.precio) || 0,
      novedad: String(body.novedad || '').trim(), empleado: cab.empleado_proveedor || '',
    }));
    if (filas.length) await sbWrite(env, 'POST', 'inv_movimientos', filas);
  }
  return { ok: true };
}

// Ajuste de stock: crea un movimiento por la diferencia hasta el stock físico contado
async function accionInvAjustarStock(body, env) {
  const item = String(body.item || '').trim();
  const fisico = parseFloat(body.stock_fisico);
  if (!item) return { ok: false, error: 'Falta item' };
  if (isNaN(fisico)) return { ok: false, error: 'Stock físico inválido' };
  const mov = await sbAll(env, `inv_movimientos?select=entradas,salidas&item=eq.${encodeURIComponent(item)}`);
  let actual = 0; mov.forEach((m) => { actual += Number(m.entradas || 0) - Number(m.salidas || 0); });
  const diff = fisico - actual;
  if (Math.abs(diff) < 0.0001) return { ok: true, sinCambio: true, actual };
  const p = (await sb(env, `inventario?select=producto,categoria,precio&item=eq.${encodeURIComponent(item)}&limit=1`))[0] || {};
  await sbWrite(env, 'POST', 'inv_movimientos', {
    id_movimiento: 'AJU' + Date.now().toString(36).toUpperCase() + Math.random().toString(36).slice(2, 4).toUpperCase(),
    id_regn: null, item, categoria: String(p.categoria || ''), fecha: isoDate(new Date()),
    factura_id: '', producto: String(p.producto || ''),
    entradas: diff > 0 ? diff : 0, salidas: diff < 0 ? -diff : 0, precio_un: Number(p.precio || 0),
    novedad: 'AJUSTE DE INVENTARIO' + (body.motivo ? (' — ' + String(body.motivo).trim()) : ''),
    empleado: String(body.usuario || '').trim(),
  });
  return { ok: true, actual, fisico, diff };
}

// Activar / desactivar un producto (para referencias viejas: conserva su historial)
async function accionInvActivarProducto(body, env) {
  const item = String(body.item || '').trim();
  if (!item) return { ok: false, error: 'Falta item' };
  await sbWrite(env, 'PATCH', `inventario?item=eq.${encodeURIComponent(item)}`, { activo: body.activo !== false });
  return { ok: true };
}

// ── Configuración de nómina (tarifas de vigilancia y opciones) ──
async function accionGetNomConfig(body, env) {
  const rows = await sb(env, "nomina_config?select=valor&clave=eq.cfg&limit=1");
  let config = {};
  if (rows.length) { try { config = JSON.parse(rows[0].valor || '{}'); } catch (e) { config = {}; } }
  return { ok: true, config };
}
async function accionGuardarNomConfig(body, env) {
  const valor = JSON.stringify(body.config || {});
  const ex = await sb(env, "nomina_config?select=clave&clave=eq.cfg&limit=1");
  if (ex.length) await sbWrite(env, 'PATCH', "nomina_config?clave=eq.cfg", { valor });
  else await sbWrite(env, 'POST', 'nomina_config', { clave: 'cfg', valor });
  return { ok: true };
}

// Horas de vigilancia por trabajador y semana (para la regla del umbral)
async function accionGetVigHorasSemana(body, env) {
  const rows = await sbAll(env, 'vig_horas_semana?select=cedula,semana,horas');
  const data = rows.map((r) => ({ cedula: String(r.cedula || ''), semana: String(r.semana || ''), horas: Number(r.horas || 0) }));
  return { ok: true, data };
}

// Consolidado (Cobro vs Facturación) de UN solo coordinador — para su propio módulo.
// Trae solo sus datos (no expone los de otros coordinadores).
async function accionGetConsolidadoCoord(body, env) {
  const coord = String(body.coord || '').trim();
  if (!coord) return { ok: false, error: 'Falta coordinador' };
  const normSem = (s) => { const n = parseInt(String(s == null ? '' : s).replace(/[^0-9]/g, ''), 10); return isNaN(n) ? 0 : n; };
  const semanas = {};
  let sem0 = 0, adm = '', sede = '';
  const co = await sb(env, `coordinadores?select=id,nombre,administrador,sede&nombre=eq.${encodeURIComponent(coord)}&limit=1`);
  if (co.length) {
    const coordId = co[0].id; adm = co[0].administrador || ''; sede = co[0].sede || '';
    // Reportes por semana (lo que reportó a Riopaila = cobro labores + cobro vigilancia)
    const reps = await sbAll(env, `detalle_dia?select=semana,cobro_riopaila,cobro_vigilancia&coordinador_id=eq.${coordId}`);
    reps.forEach((r) => { const s = normSem(r.semana); if (!semanas[s]) semanas[s] = { rep: 0, fac: 0 }; semanas[s].rep += Number(r.cobro_riopaila || 0) + Number(r.cobro_vigilancia || 0); });
    // Facturación por semana (detallado de Riopaila)
    const dets = await sbAll(env, `detallado_factura?select=semana,valor_cobro&coordinador_id=eq.${coordId}`);
    dets.forEach((d) => { const s = normSem(d.semana); if (!semanas[s]) semanas[s] = { rep: 0, fac: 0 }; semanas[s].fac += Number(d.valor_cobro || 0); });
  }
  // Cobros históricos: semana 0 = saldo inicial; otras semanas suman a reportes
  const hist = await sbAll(env, `cobros_historicos?select=valor_cobro,semana&coordinador=eq.${encodeURIComponent(coord)}`);
  hist.forEach((h) => { const s = normSem(h.semana); if (s === 0) sem0 += Number(h.valor_cobro || 0); else { if (!semanas[s]) semanas[s] = { rep: 0, fac: 0 }; semanas[s].rep += Number(h.valor_cobro || 0); } });
  return { ok: true, data: { coord: coord, adm: adm, sede: sede, sem0: sem0, semanas: semanas } };
}


// ── Índice liviano de duplicados (módulo coordinador) ──
// Solo 5 datos por registro de labor (cédula, semana, día, labor, coordinador) y solo de
// las semanas pedidas (las abiertas para subir). Reemplaza la descarga de TODOS los registros.
async function accionGetIndiceDup(body, env) {
  const semanas = (Array.isArray(body.semanas) ? body.semanas : [])
    .map((x) => parseInt(x)).filter((x) => x > 0 && x < 60);
  if (!semanas.length) return { ok: true, semanas: [], items: [] };
  const rows = await sbAll(env, `detalle_dia?select=cedula,semana,dia,id_labor,coordinadores(nombre)&tipo=eq.labor&semana=in.(${semanas.join(',')})`);
  const items = rows.map((f) => [
    String(f.cedula == null ? '' : f.cedula).trim(),
    parseInt(f.semana) || 0,
    String(f.dia || '').trim(),
    String(f.id_labor || '').trim(),
    f.coordinadores ? String(f.coordinadores.nombre || '').trim() : '',
  ]);
  return { ok: true, semanas, items };
}

// ── Verificación final de duplicados para un lote completo (al enviar) ──
// Recibe [{ced, sem, dia, labId}] y devuelve los que YA existen en la base (con su coordinador).
async function accionVerificarDuplicadosLote(body, env) {
  const items = Array.isArray(body.items) ? body.items : [];
  const norm = (c) => String(c == null ? '' : c).replace(/[,.\s]/g, '').trim();
  const porSem = {};
  items.forEach((it) => {
    const sem = parseInt(it.sem); const ced = norm(it.ced);
    if (!sem || !ced || !it.dia || !it.labId) return;
    (porSem[sem] = porSem[sem] || new Set()).add(ced);
  });
  const existentes = [];
  for (const sem of Object.keys(porSem)) {
    const ceds = Array.from(porSem[sem]);
    for (let i = 0; i < ceds.length; i += 80) {
      const lista = ceds.slice(i, i + 80).map((c) => parseInt(c)).filter((c) => !isNaN(c)).join(',');
      if (!lista) continue;
      const rows = await sbAll(env, `detalle_dia?select=id,cedula,semana,dia,id_labor,coordinadores(nombre)&tipo=eq.labor&semana=eq.${parseInt(sem)}&cedula=in.(${lista})`);
      rows.forEach((f) => existentes.push({
        id: String(f.id || ''), ced: norm(f.cedula), sem: parseInt(f.semana) || 0,
        dia: String(f.dia || '').trim(), labId: String(f.id_labor || '').trim(),
        coord: f.coordinadores ? String(f.coordinadores.nombre || '').trim() : '',
      }));
    }
  }
  const dup = [];
  items.forEach((it, idx) => {
    const ced = norm(it.ced), sem = parseInt(it.sem), dia = String(it.dia || '').trim(), lab = String(it.labId || '').trim();
    const m = existentes.find((e) => e.ced === ced && e.sem === sem && e.dia === dia && e.labId === lab);
    if (m) dup.push({ idx, ced, sem, dia, labId: lab, coord: m.coord, id: m.id });
  });
  return { ok: true, duplicados: dup };
}


// ── Editar una tarifa (llave: código + sede; una labor puede tener tarifa distinta por sede) ──
async function accionGuardarTarifa(body, env) {
  const codigo = String(body.codigo || '').trim();
  const sede = String(body.sede || '').trim().toUpperCase();
  if (!codigo) return { ok: false, error: 'Falta el código de la tarifa' };
  const cambios = {};
  if (body.pago !== undefined && body.pago !== '') cambios.tarifa_colab = parseFloat(body.pago) || 0;
  if (body.cobro !== undefined && body.cobro !== '') cambios.tarifa_cobro = parseFloat(body.cobro) || 0;
  if (body.descripcion !== undefined) cambios.descripcion = String(body.descripcion).trim();
  if (!Object.keys(cambios).length) return { ok: false, error: 'No hay cambios que guardar' };
  let filtro = `codigo=eq.${encodeURIComponent(codigo)}`;
  filtro += sede ? `&sede=eq.${encodeURIComponent(sede)}` : '&sede=is.null';
  // Verificar que exista exactamente esa tarifa antes de tocarla
  const ex = await sb(env, `tarifas?select=codigo&${filtro}&limit=1`);
  if (!ex.length) return { ok: false, error: 'No se encontró la tarifa ' + codigo + (sede ? ' en la sede ' + sede : '') };
  await sbWrite(env, 'PATCH', `tarifas?${filtro}`, cambios);
  return { ok: true, codigo, sede, cambios };
}
