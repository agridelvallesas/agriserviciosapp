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
  'invEntregasResumen', 'invItemsActas', 'invRegistrarCambio', 'invInformeEntregas',
  'getInvConfig', 'guardarInvConfig', 'eliminarInvConfig',
  'invGetFirma',
  'getConfigEmpresa', 'guardarConfigEmpresa',
  'getNomConfig', 'guardarNomConfig',
  'getVigHorasSemana',
  'getConsolidadoCoord',
  'getIndiceDup', 'verificarDuplicadosLote',
  'guardarTarifa',
  'getRhCatalogos', 'guardarRhCatalogo', 'eliminarRhCatalogo',
  'getFotoTrabajador', 'guardarFotoTrabajador',
  'getRhConfig', 'guardarRhConfig',
  'getVinculaciones', 'registrarReingreso', 'cerrarVinculacion', 'eliminarVinculacion',
  'getIngresosRetiros', 'guardarMotivoRetiro', 'informeAusentismo', 'guardarRetiro', 'detalleAusentismo', 'clasificarDia',
  'getFacResponsables', 'guardarFacResponsable', 'eliminarFacResponsable',
  'getContratos', 'guardarContrato', 'eliminarContrato', 'guardarOtrosi', 'eliminarOtrosi',
  'getConsolidadoTodos',
  'getReferencias', 'guardarReferencia', 'eliminarReferencia',
  'guardarHistoricoContrato',
  'getIncapacidades', 'guardarIncapacidad', 'eliminarIncapacidad', 'buscarCie10', 'informeIncapacidades',
  'revisarIncapacidad',
  'facArchivoSubirUrl', 'facArchivoRegistrar', 'facArchivos', 'facArchivoEliminar',
  // Módulo SST — Encuesta sociodemográfica:
  'getEncuestas', 'getEncuesta', 'getEncuestaHistorial', 'getEncuestasResumen',
  'guardarEncuesta', 'editarEncuesta', 'eliminarEncuesta',
  'encuestaComparar', 'encuestaAplicar',
  // Consolidado de nómina (lo último que salía hacia Apps Script):
  'getNominaQna', 'guardarNominaQna',
  'getConceptosNom', 'guardarConceptoNom', 'eliminarConceptoNom',
  // Jornadas de reinducción (encPub* las llama el celular del trabajador):
  'encPubAbrir', 'encPubGuardar', 'encPubEnviar', 'jornadaCrear', 'jornadaListar',
  'jornadaDetalle', 'jornadaCerrar', 'jornadaAsistentes', 'encuestasPendientes', 'encuestaRevisar',
  // Diagnóstico: qué api.js está vivo
  'version',
]);

export async function onRequestPost({ request, env }) {
  let body = {};
  try { body = JSON.parse(await request.text()); }
  catch (_) { return json({ ok: false, error: 'Cuerpo inválido' }); }

  const accion = body.accion;
  try {
    if (!PORTADAS.has(accion)) return await reenviarLegacy(body, env);

    // ── sesión ──────────────────────────────────────────────────
    // El rol sale del token firmado, nunca de lo que diga el navegador.
    if (!SIN_SESION.has(accion)) {
      const ses = await leerSesion(body.tk, env);
      if (ses) {
        body._ses = ses;
      } else if (authModo(env) === 'exigir') {
        return json({
          ok: false, cod: 'SESION_INVALIDA',
          error: 'Su sesión venció o no ha iniciado sesión. Vuelva a entrar.',
        });
      }
      // en modo 'aviso' sigue sin token, para poder desplegar sin tumbar la app
    }

    let r;
    if      (accion === 'version')            r = accionVersion(env);
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
    else if (accion === 'invRegistrarCambio')   r = await accionInvRegistrarCambio(body, env);
    else if (accion === 'invInformeEntregas')   r = await accionInvInformeEntregas(body, env);
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
    else if (accion === 'getEncuestas')         r = await accionGetEncuestas(body, env);
    else if (accion === 'getEncuesta')          r = await accionGetEncuesta(body, env);
    else if (accion === 'getEncuestaHistorial') r = await accionGetEncuestaHistorial(body, env);
    else if (accion === 'guardarEncuesta')      r = await accionGuardarEncuesta(body, env);
    else if (accion === 'editarEncuesta')       r = await accionEditarEncuesta(body, env);
    else if (accion === 'eliminarEncuesta')     r = await accionEliminarEncuesta(body, env);
    else if (accion === 'encuestaComparar')     r = await accionEncuestaComparar(body, env);
    else if (accion === 'encuestaAplicar')      r = await accionEncuestaAplicar(body, env);
    else if (accion === 'getEncuestasResumen')  r = await accionGetEncuestasResumen(body, env);
    else if (accion === 'getNominaQna')         r = await accionGetNominaQna(body, env);
    else if (accion === 'guardarNominaQna')     r = await accionGuardarNominaQna(body, env);
    else if (accion === 'getConceptosNom')      r = await accionGetConceptosNom(body, env);
    else if (accion === 'guardarConceptoNom')   r = await accionGuardarConceptoNom(body, env);
    else if (accion === 'eliminarConceptoNom')  r = await accionEliminarConceptoNom(body, env);
    else if (accion === 'encPubAbrir')            r = await accionEncPubAbrir(body, env);
    else if (accion === 'encPubGuardar')          r = await accionEncPubGuardar(body, env);
    else if (accion === 'encPubEnviar')           r = await accionEncPubEnviar(body, env);
    else if (accion === 'jornadaCrear')           r = await accionJornadaCrear(body, env);
    else if (accion === 'jornadaListar')          r = await accionJornadaListar(body, env);
    else if (accion === 'jornadaDetalle')         r = await accionJornadaDetalle(body, env);
    else if (accion === 'jornadaCerrar')          r = await accionJornadaCerrar(body, env);
    else if (accion === 'jornadaAsistentes')      r = await accionJornadaAsistentes(body, env);
    else if (accion === 'encuestasPendientes')    r = await accionEncuestasPendientes(body, env);
    else if (accion === 'encuestaRevisar')        r = await accionEncuestaRevisar(body, env);
    else if (accion === 'getIndiceDup')         r = await accionGetIndiceDup(body, env);
    else if (accion === 'verificarDuplicadosLote') r = await accionVerificarDuplicadosLote(body, env);
    else if (accion === 'guardarTarifa')        r = await accionGuardarTarifa(body, env);
    else if (accion === 'getRhCatalogos')       r = await accionGetRhCatalogos(body, env);
    else if (accion === 'guardarRhCatalogo')    r = await accionGuardarRhCatalogo(body, env);
    else if (accion === 'eliminarRhCatalogo')   r = await accionEliminarRhCatalogo(body, env);
    else if (accion === 'getFotoTrabajador')    r = await accionGetFotoTrabajador(body, env);
    else if (accion === 'guardarFotoTrabajador') r = await accionGuardarFotoTrabajador(body, env);
    else if (accion === 'getRhConfig')          r = await accionGetRhConfig(body, env);
    else if (accion === 'guardarRhConfig')      r = await accionGuardarRhConfig(body, env);
    else if (accion === 'getVinculaciones')     r = await accionGetVinculaciones(body, env);
    else if (accion === 'registrarReingreso')   r = await accionRegistrarReingreso(body, env);
    else if (accion === 'cerrarVinculacion')    r = await accionCerrarVinculacion(body, env);
    else if (accion === 'eliminarVinculacion')  r = await accionEliminarVinculacion(body, env);
    else if (accion === 'getIngresosRetiros')   r = await accionGetIngresosRetiros(body, env);
    else if (accion === 'guardarMotivoRetiro')  r = await accionGuardarMotivoRetiro(body, env);
    else if (accion === 'informeAusentismo')    r = await accionInformeAusentismo(body, env);
    else if (accion === 'guardarRetiro')        r = await accionGuardarRetiro(body, env);
    else if (accion === 'detalleAusentismo')    r = await accionDetalleAusentismo(body, env);
    else if (accion === 'clasificarDia')        r = await accionClasificarDia(body, env);
    else if (accion === 'getFacResponsables')   r = await accionGetFacResponsables(body, env);
    else if (accion === 'guardarFacResponsable') r = await accionGuardarFacResponsable(body, env);
    else if (accion === 'eliminarFacResponsable') r = await accionEliminarFacResponsable(body, env);
    else if (accion === 'getReferencias')       r = await accionGetReferencias(body, env);
    else if (accion === 'guardarReferencia')    r = await accionGuardarReferencia(body, env);
    else if (accion === 'eliminarReferencia')   r = await accionEliminarReferencia(body, env);
    else if (accion === 'getConsolidadoTodos')  r = await accionGetConsolidadoTodos(body, env);
    else if (accion === 'getContratos')         r = await accionGetContratos(body, env);
    else if (accion === 'guardarContrato')      r = await accionGuardarContrato(body, env);
    else if (accion === 'eliminarContrato')     r = await accionEliminarContrato(body, env);
    else if (accion === 'guardarOtrosi')        r = await accionGuardarOtrosi(body, env);
    else if (accion === 'eliminarOtrosi')       r = await accionEliminarOtrosi(body, env);
    else if (accion === 'guardarHistoricoContrato') r = await accionGuardarHistoricoContrato(body, env);
    else if (accion === 'getIncapacidades')     r = await accionGetIncapacidades(body, env);
    else if (accion === 'guardarIncapacidad')   r = await accionGuardarIncapacidad(body, env);
    else if (accion === 'eliminarIncapacidad')  r = await accionEliminarIncapacidad(body, env);
    else if (accion === 'buscarCie10')          r = await accionBuscarCie10(body, env);
    else if (accion === 'informeIncapacidades') r = await accionInformeIncapacidades(body, env);
    else if (accion === 'revisarIncapacidad')   r = await accionRevisarIncapacidad(body, env);
    else if (accion === 'facArchivoSubirUrl')   r = await accionFacArchivoSubirUrl(body, env);
    else if (accion === 'facArchivoRegistrar')  r = await accionFacArchivoRegistrar(body, env);
    else if (accion === 'facArchivos')          r = await accionFacArchivos(body, env);
    else if (accion === 'facArchivoEliminar')   r = await accionFacArchivoEliminar(body, env);
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
// Festivos por año, con fecha completa. Antes estaban como 'día/mes' sin año,
// lo que servía en 2026 pero habría dado festivos corridos en 2027, porque los
// trasladables (Ley Emiliani) caen en fecha distinta cada año.
const FESTIVOS = new Set([
  '2026-01-01','2026-01-12','2026-03-23','2026-04-02','2026-04-03','2026-05-01',
  '2026-05-18','2026-06-08','2026-06-15','2026-06-29','2026-07-13','2026-07-20',
  '2026-08-07','2026-08-17','2026-10-12','2026-11-02','2026-11-16','2026-12-08',
  '2026-12-25',
  '2027-01-01','2027-01-11','2027-03-22','2027-03-25','2027-03-26','2027-05-01',
  '2027-05-10','2027-05-31','2027-06-07','2027-07-05','2027-07-12','2027-07-20',
  '2027-08-07','2027-08-16','2027-10-18','2027-11-01','2027-11-15','2027-12-08',
  '2027-12-25'
]);
function esFestivoISO(iso) { return FESTIVOS.has(String(iso).slice(0, 10)); }
// ── Calendario de semanas, por año ──────────────────────────────────────
// El arranque de cada año vive en la tabla calendario_anios. Estos valores
// son el respaldo: si la tabla no se puede leer, el sistema sigue andando.
const CAL_DEFECTO = {
  2026: { ancla: Date.UTC(2025, 11, 29), semanas: 52 },
  2027: { ancla: Date.UTC(2026, 11, 28), semanas: 52 },
};
let CAL_ANIOS = Object.assign({}, CAL_DEFECTO);
let CAL_LEIDO = 0;   // cuándo se leyó la tabla por última vez

// Lee la tabla y mezcla lo que encuentre sobre los valores de respaldo.
// Se guarda un minuto en memoria para no consultar en cada operación.
async function cargarCalendario(env) {
  if (Date.now() - CAL_LEIDO < 60000) return CAL_ANIOS;
  try {
    const filas = await sb(env, 'calendario_anios?select=anio,lunes_sem1,num_semanas');
    const nuevo = Object.assign({}, CAL_DEFECTO);
    for (const f of filas) {
      const a = parseInt(f.anio);
      if (!a || !f.lunes_sem1) continue;
      const p = String(f.lunes_sem1).slice(0, 10).split('-').map(Number);
      nuevo[a] = { ancla: Date.UTC(p[0], p[1] - 1, p[2]), semanas: parseInt(f.num_semanas) || 52 };
    }
    CAL_ANIOS = nuevo;
    CAL_LEIDO = Date.now();
  } catch (e) { /* se sigue con los valores de respaldo */ }
  return CAL_ANIOS;
}

function anclaDeAnio(anio) {
  const c = CAL_ANIOS[parseInt(anio)];
  return c ? c.ancla : CAL_ANIOS[2026].ancla;
}
// Año al que pertenece una fecha según el calendario de semanas.
// No es el año del calendario común: la semana 01 de 2027 arranca en diciembre.
function anioDeFecha(fecha) {
  const d = (fecha instanceof Date) ? fecha : new Date(String(fecha).slice(0, 10) + 'T12:00:00Z');
  const ts = d.getTime();
  const anios = Object.keys(CAL_ANIOS).map(Number).sort((x, y) => y - x);
  for (const a of anios) if (ts >= CAL_ANIOS[a].ancla) return a;
  return anios[anios.length - 1];
}
function fechaDeSemanaDia(sem, dia, anio) {
  const s = parseInt(sem, 10) || 1;
  const off = DIAS_OFFSET[dia] !== undefined ? DIAS_OFFSET[dia] : 0;
  return new Date(anclaDeAnio(anio || anioDeFecha(new Date())) + ((s - 1) * 7 + off) * 86400000);
}
// Inverso: de una fecha a su año y su semana. Única definición en el servidor.
function anioSemanaDeFecha(fecha) {
  const d = (fecha instanceof Date) ? fecha : new Date(String(fecha).slice(0, 10) + 'T12:00:00Z');
  const anio = anioDeFecha(d);
  return { anio, semana: Math.floor((d.getTime() - anclaDeAnio(anio)) / (7 * 86400000)) + 1 };
}
function semanaDeFecha(fecha) { return anioSemanaDeFecha(fecha).semana; }
// Código del día de la semana que usa el sistema
function diaDeFecha(fecha) {
  const d = (fecha instanceof Date) ? fecha : new Date(String(fecha).slice(0, 10) + 'T12:00:00Z');
  return ['D', 'L', 'M', 'MI', 'J', 'V', 'S'][d.getUTCDay()];
}
function isoDate(d) {
  return d.toISOString().slice(0, 10); // YYYY-MM-DD para columnas date
}
function ddmmyyyy(iso) {
  if (!iso) return '';
  const p = String(iso).slice(0, 10).split('-');
  return p.length === 3 ? `${p[2]}/${p[1]}/${p[0]}` : String(iso);
}
function esDomFest(sem, dia, anio) {
  const d = fechaDeSemanaDia(sem, dia, anio);
  if (d.getUTCDay() === 0) return true; // domingo
  return esFestivoISO(d.toISOString().slice(0, 10));
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
  const salida = {
    ok: true, usuario: u.usuario, rol, adminCampo,
    sede: String(u.sede || 'TODAS').trim().toUpperCase(),
  };
  salida.tk = await firmarSesion(salida, env);
  if (!salida.tk) {
    // sin AUTH_SECRET no se puede firmar: se avisa en vez de fallar en silencio
    salida.aviso_sesion = 'Falta configurar AUTH_SECRET en Cloudflare: la sesión no queda protegida.';
  }
  return salida;
}

// ---------------------------------------------------------------------
//  GET DATOS
// ---------------------------------------------------------------------
async function accionGetDatos(body, env) {
  const sede = body && body.sede ? String(body.sede).trim().toUpperCase() : '';
  await cargarCalendario(env);   // el navegador lo necesita para calcular fechas
  const [empleados, tarifas, coordinadores, quincenas] = await Promise.all([
    getEmpleados(sede, env), getTarifas(sede, env), getCoordinadores(env), getQuincenas(env),
  ]);
  // Calendario de semanas por año, para que el navegador use el mismo ancla
  const calendario = Object.keys(CAL_ANIOS).map((k) => ({
    anio: parseInt(k),
    ancla: new Date(CAL_ANIOS[k].ancla).toISOString().slice(0, 10),
    semanas: CAL_ANIOS[k].semanas,
  }));
  return { ok: true, empleados, tarifas, coordinadores, quincenas, calendario };
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

  await cargarCalendario(env);
  const coordMap = await mapaCoordPorNombre(env);
  const ahora = new Date().toISOString();
  const anioPorDefecto = anioDeFecha(new Date());
  const filas = registros.map((r) => ({
    id: crypto.randomUUID().slice(0, 18),
    coordinador_id: coordMap.get(String(r.coord || '').trim().toUpperCase()) || null,
    anio: parseInt(r.anio) || anioPorDefecto,
    semana: parseInt(r.sem) || null,
    cedula: parseInt(String(r.ced || '').replace(/,/g, '')) || null,
    dia: r.dia || '',
    fecha: isoDate(fechaDeSemanaDia(r.sem, r.dia, parseInt(r.anio) || anioPorDefecto)),
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
    dom_fest: esDomFest(r.sem, r.dia, parseInt(r.anio) || anioPorDefecto),   // recalculado por fecha real
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
  const semDesde = parseInt(body.semDesde) || 0;      // rango de semanas (opcional)
  const semHasta = parseInt(body.semHasta) || 0;
  const filtroCoord = String(body.coord || '').trim();
  const filtroCed = String(body.ced || '').trim();
  const filtroTipo = String(body.tipo || '').trim();
  const desde = parseInt(body.desde) || 2;
  const lote = (filtroSem || semDesde) ? 5000 : 3000;
  const offset = Math.max(0, desde - 2);

  const cols = 'id,coordinador_id,anio,semana,cedula,dia,fecha,tipo,id_labor,unidad,cantidad,pago_trabajador,cobro_riopaila,auxilio_alim,novedad,observacion,es_vigilancia,vig_hd,vig_hn,dom_fest,cobro_vigilancia,obs_tarea,fecha_registro,coordinadores(nombre,administrador),trabajadores(nombres)';
  let path = `detalle_dia?select=${cols}&order=fecha_registro`;
  // Sin el año, la semana 01 de 2026 y la de 2027 saldrían revueltas
  const filtroAnio = parseInt(body.anio) || 0;
  if (filtroAnio) path += `&anio=eq.${filtroAnio}`;
  if (semDesde && semHasta) {
    path += `&semana=gte.${semDesde}&semana=lte.${semHasta}`;
  } else if (semDesde) {
    path += `&semana=eq.${semDesde}`;
  } else if (filtroSem) {
    path += `&semana=eq.${parseInt(filtroSem)}`;
  }
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
    anio: parseInt(f.anio) || null,
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
  const anioDup = parseInt(body.anio) || anioDeFecha(new Date());
  const path = `detalle_dia?select=${cols}&tipo=eq.labor&anio=eq.${anioDup}&semana=eq.${parseInt(sem)}&cedula=eq.${parseInt(ced.replace(/,/g, ''))}&dia=eq.${encodeURIComponent(dia)}&id_labor=eq.${encodeURIComponent(labId)}&limit=1`;
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
  await cargarCalendario(env);
  const id = String(body.id || '').trim();
  if (!id) return { ok: false, error: 'Registro no encontrado' };
  const coordMap = await mapaCoordPorNombre(env);
  const cambios = {
    coordinador_id: coordMap.get(String(body.coord || '').trim().toUpperCase()) || null,
    semana: parseInt(body.sem) || null,
    cedula: parseInt(String(body.ced || '').replace(/,/g, '')) || null,
    dia: body.dia || '',
    anio: parseInt(body.anio) || anioDeFecha(new Date()),
    fecha: isoDate(fechaDeSemanaDia(body.sem, body.dia, parseInt(body.anio) || anioDeFecha(new Date()))),
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
// Llama una función de Postgres: el cálculo pesado ocurre en la base y aquí
// se recibe el resultado. Las funciones de este sistema devuelven el total en
// una sola respuesta, así que basta UNA petición: pedir páginas contra una
// función agota el límite de peticiones del servidor.
async function sbRpc(env, fn, args) {
  const url = `${baseUrl(env)}/rest/v1/rpc/${fn}`;
  const res = await fetch(url, {
    method: 'POST',
    headers: { ...headers(env), 'Content-Type': 'application/json' },
    body: JSON.stringify(args || {}),
  });
  const txt = await res.text();
  if (!res.ok) throw new Error('RPC ' + fn + ' ' + res.status + ': ' + txt);
  try { return JSON.parse(txt); } catch (e) { return []; }
}

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
// Usa la misma lista de festivos que el resto del servidor, para que no se
// desfasen entre sí. Antes había dos listas separadas y ambas incompletas.
async function accionCoberturaSemanas(body, env) {
  const desde = parseInt(body && body.semDesde) || 17;
  let semActual = semanaDeFecha(new Date());
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
  const anioCob = parseInt(body.anio) || anioDeFecha(new Date());
  const filasDD = await sbAll(env, `cobertura_dias?select=coordinador_id,semana,dia&anio=eq.${anioCob}&semana=gte.${desde}`);
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
    const lunes = anclaDeAnio(anioDeFecha(new Date())) + (sn - 1) * 7 * 86400000;
    const exp = [], fest = [];
    for (const cod of codigos) {
      const f = new Date(lunes + offset[cod] * 86400000);
      if (esFestivoISO(f.toISOString().slice(0, 10))) fest.push(cod); else exp.push(cod);
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
  ['MOTIVO_RETIRO','motivo_retiro'],['TIPO_RETIRO','tipo_retiro'],['OBS_RETIRO','obs_retiro'],
  ['BANCO','banco'],['CUENTA','num_cuenta'],
  ['EPS','eps'],['PENSION','pension'],['CAJA','caja'],['ARL','arl'],['CESANTIAS','cesantias'],
  ['TALLA_CAMISA','talla_camisa'],['TALLA_PANTALON','talla_pant'],['TALLA_GUAYO','talla_guayo'],['TALLA_BOTA','talla_bota'],['TALLA_ZAPATO','talla_zap'],['TALLA_IMPERMEABLE','talla_impermeable'],
  ['BARRIO','barrio'],['TIPO_SANGRE','tipo_sangre'],['GENERO','genero'],['NUM_HIJOS','num_hijos'],['TEL_EMERG','tel_emerg'],['GRADO_ESCOLAR','grado_escolar'],
  ['PAIS_NAC','pais_nac'],['DEPTO_NAC','depto_nac'],['CIUDAD_NAC','ciudad_nac'],['DEPTO_EXP','depto_exp'],
  ['NIVEL_EDUCATIVO','nivel_educativo'],['TITULO','titulo'],['INSTITUCION','institucion'],
  ['ESTUDIA_ACTUAL','estudia_actual'],['EST_QUE','est_que'],['EST_DONDE','est_donde'],['EST_SEMESTRE','est_semestre'],
  ['ESTADO_CIVIL','estado_civil'],['CONYUGE_NOMBRE','conyuge_nombre'],['CONYUGE_CEDULA','conyuge_cedula'],['CONYUGE_TEL','conyuge_tel'],
  ['OBSERVACIONES','observacion'],['FECHA_CREACION','fecha_registro'],['ACTUALIZADO_POR','actualizado_por'],
];
async function accionGetTrabajadores(body, env) {
  const cols = TRAB_MAP.map((p) => p[1]).join(',');
  const rows = await sbAll(env, `trabajadores?select=${cols}&order=nombres`);
  const data = rows.map((f) => {
    const o = {};
    for (const [key, col] of TRAB_MAP) {
      let v = f[col];
      if (col === 'estudia_actual') v = (v === true || v === 'true') ? 'SI' : '';
      else if (v === null || v === undefined) v = '';
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
  const id = f.id || crypto.randomUUID().slice(0, 18);
  const fila = {
    fecha_fac: fechaONull(f.ffac),
    fecha_ven: fechaONull(f.fven),
    num_factura: f.nfac || '',
    num_acta: f.nacta || '',
    pedido: f.pedido || '',
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
  const rows = await sbAll(env, 'facturas?select=id,fecha_fac,fecha_ven,num_factura,num_acta,pedido,valor_factura,retencion,valor_pagar,semanas,contrato,responsable,nota,estado,no_detallable,fecha_pago');
  const facturas = rows.map((f, i) => ({
    id: String(f.id || '').trim(),
    ffac: f.fecha_fac ? String(f.fecha_fac).slice(0, 10) : '',
    fven: f.fecha_ven ? String(f.fecha_ven).slice(0, 10) : '',
    nfac: String(f.num_factura || '').trim(),
    nacta: String(f.num_acta || '').trim(),
    pedido: String(f.pedido || '').trim(),
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
    id: crypto.randomUUID().slice(0, 18),
    id_factura: d.idFac || '',
    num_acta: d.nacta || '',
    coordinador_id: coordMap.get(String(d.coord || '').trim().toUpperCase()) || null,
    semana: parseInt(d.sem) || null,
    valor_cobro: d.val || 0,
    fecha_registro: ahora,
    resp: d.resp || '',
  }));
  await sbWrite(env, 'POST', 'detallado_factura', filas);
  // Devolver los ids generados para que la pantalla pueda editar sin recargar
  return { ok: true, guardados: filas.length, ids: filas.map((f) => f.id) };
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
  // Campo booleano: el formulario envía 'SI' / '' — la columna es boolean
  const ea = String(t.ESTUDIA_ACTUAL == null ? '' : t.ESTUDIA_ACTUAL).trim().toUpperCase();
  row.estudia_actual = (ea === 'SI' || ea === 'SÍ' || ea === 'TRUE' || ea === '1');
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
  // Al borrar los movimientos el stock se restituye solo: la vista de
  // inventario lo calcula como entradas menos salidas.
  await sbWrite(env, 'DELETE', `inv_movimientos?id_regn=eq.${encodeURIComponent(id)}`);
  await sbWrite(env, 'DELETE', `inv_registros?id_regn=eq.${encodeURIComponent(id)}`);
  // La firma del acta se elimina también, para no dejarla huérfana
  try {
    await sbWrite(env, 'DELETE', `inv_firmas?id_regn=eq.${encodeURIComponent(id)}`);
  } catch (e) { /* la tabla puede no existir aún */ }
  return { ok: true };
}

// Resumen de TODAS las entregas (cabeceras, sin items) para agrupar por empleado
async function accionInvEntregasResumen(body, env) {
  const actas = await sbAll(env, 'inv_registros?select=id_regn,empleado_proveedor,id_factura,fecha,auxiliar,tipo,ref_regn,motivo&order=fecha.desc');
  const firmadas = {};
  try { (await sbAll(env, 'inv_firmas?select=id_regn')).forEach((f) => { firmadas[f.id_regn] = true; }); } catch (e) { /* tabla puede no existir aún */ }
  const data = actas.map((a) => ({
    id_regn: a.id_regn,
    empleado_proveedor: String(a.empleado_proveedor || ''),
    id_factura: String(a.id_factura || ''),
    fecha: a.fecha,
    auxiliar: String(a.auxiliar || ''),
    tipo: String(a.tipo || 'ENTREGA'),
    ref_regn: String(a.ref_regn || ''),
    motivo: String(a.motivo || ''),
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
      devuelto: Number(it.entradas || 0) > 0,
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
    const reps = await sbAll(env, `detalle_dia?select=semana,cobro_riopaila,cobro_vigilancia,auxilio_alim&coordinador_id=eq.${coordId}`);
    // El auxilio de alimentación lo paga Riopaila, así que entra al cobro.
    reps.forEach((r) => { const s = normSem(r.semana); if (!semanas[s]) semanas[s] = { rep: 0, fac: 0 }; semanas[s].rep += Number(r.cobro_riopaila || 0) + Number(r.cobro_vigilancia || 0) + Number(r.auxilio_alim || 0); });
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
  const anioDups = parseInt(body.anio) || anioDeFecha(new Date());
  const rows = await sbAll(env, `detalle_dia?select=cedula,semana,dia,id_labor,coordinadores(nombre)&tipo=eq.labor&anio=eq.${anioDups}&semana=in.(${semanas.join(',')})`);
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
      const rows = await sbAll(env, `detalle_dia?select=id,cedula,semana,dia,id_labor,coordinadores(nombre)&tipo=eq.labor&anio=eq.${parseInt(body.anio) || anioDeFecha(new Date())}&semana=eq.${parseInt(sem)}&cedula=in.(${lista})`);
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


// ── Catálogos de RH (listas del formulario: departamentos, municipios, EPS, ARL, etc.) ──
async function accionGetRhCatalogos(body, env) {
  const tipo = String(body.tipo || '').trim();
  let path = 'rh_catalogos?select=id,tipo,valor,padre,orden,activo&activo=is.true&order=tipo,orden,valor';
  if (tipo) path = `rh_catalogos?select=id,tipo,valor,padre,orden,activo&tipo=eq.${encodeURIComponent(tipo)}&activo=is.true&order=orden,valor`;
  const rows = await sbAll(env, path);
  // Compacto: [tipo, valor, padre] para que la carga sea liviana
  return { ok: true, items: rows.map((r) => [String(r.tipo), String(r.valor), String(r.padre || '')]) };
}
async function accionGuardarRhCatalogo(body, env) {
  const tipo = String(body.tipo || '').trim();
  const valor = String(body.valor || '').trim().toUpperCase();
  const padre = String(body.padre || '').trim().toUpperCase();
  if (!tipo || !valor) return { ok: false, error: 'Falta tipo o valor' };
  if (body.id) { await sbWrite(env, 'PATCH', `rh_catalogos?id=eq.${encodeURIComponent(body.id)}`, { valor, padre }); return { ok: true }; }
  const ex = await sb(env, `rh_catalogos?select=id&tipo=eq.${encodeURIComponent(tipo)}&valor=eq.${encodeURIComponent(valor)}&padre=eq.${encodeURIComponent(padre)}&limit=1`);
  if (ex.length) return { ok: true, id: ex[0].id };
  await sbWrite(env, 'POST', 'rh_catalogos', { tipo, valor, padre });
  return { ok: true };
}
async function accionEliminarRhCatalogo(body, env) {
  if (body.id) { await sbWrite(env, 'DELETE', `rh_catalogos?id=eq.${encodeURIComponent(body.id)}`); return { ok: true }; }
  const tipo = String(body.tipo || '').trim();
  const valor = String(body.valor || '').trim().toUpperCase();
  if (!tipo || !valor) return { ok: false, error: 'Falta id, o tipo y valor' };
  await sbWrite(env, 'DELETE', `rh_catalogos?tipo=eq.${encodeURIComponent(tipo)}&valor=eq.${encodeURIComponent(valor)}`);
  return { ok: true };
}

// ── Foto del trabajador (tabla aparte para no alentar la lista de trabajadores) ──
async function accionGetFotoTrabajador(body, env) {
  const ced = String(body.cedula || '').replace(/[,.\s]/g, '').trim();
  if (!ced) return { ok: false, error: 'Falta cédula' };
  const rows = await sb(env, `trabajador_fotos?select=foto&cedula=eq.${encodeURIComponent(ced)}&limit=1`);
  return { ok: true, foto: rows.length ? String(rows[0].foto || '') : '' };
}
async function accionGuardarFotoTrabajador(body, env) {
  const ced = String(body.cedula || '').replace(/[,.\s]/g, '').trim();
  if (!ced) return { ok: false, error: 'Falta cédula' };
  const foto = String(body.foto || '');
  if (!foto) { await sbWrite(env, 'DELETE', `trabajador_fotos?cedula=eq.${encodeURIComponent(ced)}`); return { ok: true, borrada: true }; }
  const ex = await sb(env, `trabajador_fotos?select=cedula&cedula=eq.${encodeURIComponent(ced)}&limit=1`);
  if (ex.length) await sbWrite(env, 'PATCH', `trabajador_fotos?cedula=eq.${encodeURIComponent(ced)}`, { foto, fecha_carga: new Date().toISOString() });
  else await sbWrite(env, 'POST', 'trabajador_fotos', { cedula: ced, foto });
  return { ok: true };
}


// ── Configuración de RH (qué campos aparecen en la hoja de datos) ──
async function accionGetRhConfig(body, env) {
  const rows = await sb(env, "rh_config?select=valor&clave=eq.hoja_datos&limit=1");
  let config = {};
  if (rows.length) { try { config = JSON.parse(rows[0].valor || '{}'); } catch (e) { config = {}; } }
  return { ok: true, config };
}
async function accionGuardarRhConfig(body, env) {
  const valor = JSON.stringify(body.config || {});
  const ex = await sb(env, "rh_config?select=clave&clave=eq.hoja_datos&limit=1");
  if (ex.length) await sbWrite(env, 'PATCH', "rh_config?clave=eq.hoja_datos", { valor });
  else await sbWrite(env, 'POST', 'rh_config', { clave: 'hoja_datos', valor });
  return { ok: true };
}


// ═══════════════════════════════════════════════════════════════════════════
//  ARCHIVOS DE FACTURACIÓN (PDF de factura y de acta) — Supabase Storage
//  Los PDF no pasan por aquí: el navegador los sube DIRECTO al bucket con un
//  enlace firmado, y los ve con otro enlace firmado temporal.
// ═══════════════════════════════════════════════════════════════════════════
const FAC_BUCKET = 'facturas';

function rutaSegura(txt) {
  return String(txt || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9._-]+/g, '_').replace(/_+/g, '_').slice(0, 80);
}
async function storageFetch(env, metodo, ruta, bodyObj) {
  const url = `${baseUrl(env)}/storage/v1/${ruta}`;
  const res = await fetch(url, {
    method: metodo,
    headers: { ...headers(env), 'Content-Type': 'application/json' },
    body: bodyObj ? JSON.stringify(bodyObj) : undefined,
  });
  const txt = await res.text();
  if (!res.ok) throw new Error('Storage ' + res.status + ': ' + txt);
  try { return JSON.parse(txt); } catch (e) { return {}; }
}

// 1) Enlace firmado para SUBIR (el navegador sube el archivo directo al bucket)
async function accionFacArchivoSubirUrl(body, env) {
  const idFac = String(body.idFac || '').trim();
  const tipo = String(body.tipo || 'factura').trim().toLowerCase();
  const nombre = rutaSegura(body.nombre || (tipo + '.pdf'));
  if (!idFac) return { ok: false, error: 'Falta la factura' };
  const ruta = `${rutaSegura(idFac)}/${tipo}_${Date.now()}_${nombre}`;
  const r = await storageFetch(env, 'POST', `object/upload/sign/${FAC_BUCKET}/${ruta}`, {});
  // r.url viene como "/object/upload/sign/bucket/ruta?token=..."
  return { ok: true, ruta, url: `${baseUrl(env)}/storage/v1${r.url}` };
}

// 2) Registrar el archivo ya subido
async function accionFacArchivoRegistrar(body, env) {
  const idFac = String(body.idFac || '').trim();
  const ruta = String(body.ruta || '').trim();
  if (!idFac || !ruta) return { ok: false, error: 'Faltan datos del archivo' };
  await sbWrite(env, 'POST', 'factura_archivos', {
    id_factura: idFac,
    tipo: String(body.tipo || 'factura').toLowerCase(),
    ruta,
    nombre: String(body.nombre || ''),
    tamano: parseInt(body.tamano) || 0,
    content_type: String(body.contentType || ''),
    subido_por: String(body.usuario || ''),
  });
  return { ok: true };
}

// 3) Listar los archivos de una factura (o de varias) con enlace firmado para verlos
async function accionFacArchivos(body, env) {
  const ids = Array.isArray(body.ids) ? body.ids : (body.idFac ? [body.idFac] : []);
  if (!ids.length) return { ok: true, data: [] };
  const lista = ids.map((x) => `"${String(x).replace(/"/g, '')}"`).join(',');
  const rows = await sbAll(env, `factura_archivos?select=id,id_factura,tipo,ruta,nombre,tamano,fecha_carga&id_factura=in.(${lista})&order=fecha_carga.desc`);
  const conUrl = [];
  for (const f of rows) {
    let url = '';
    if (body.conUrl !== false) {
      try {
        const sg = await storageFetch(env, 'POST', `object/sign/${FAC_BUCKET}/${f.ruta}`, { expiresIn: 3600 });
        if (sg && sg.signedURL) url = `${baseUrl(env)}/storage/v1${sg.signedURL}`;
      } catch (e) { /* si falla la firma, se devuelve sin url */ }
    }
    conUrl.push({
      id: f.id, idFac: f.id_factura, tipo: f.tipo, nombre: f.nombre || f.ruta.split('/').pop(),
      tamano: Number(f.tamano || 0), fecha: f.fecha_carga, url,
    });
  }
  return { ok: true, data: conUrl };
}

// 4) Eliminar un archivo (del bucket y del registro)
async function accionFacArchivoEliminar(body, env) {
  const id = body.id;
  if (!id) return { ok: false, error: 'Falta id' };
  const rows = await sb(env, `factura_archivos?select=ruta&id=eq.${encodeURIComponent(id)}&limit=1`);
  if (rows.length) {
    try { await storageFetch(env, 'DELETE', `object/${FAC_BUCKET}/${rows[0].ruta}`); } catch (e) { /* ya no existe */ }
  }
  await sbWrite(env, 'DELETE', `factura_archivos?id=eq.${encodeURIComponent(id)}`);
  return { ok: true };
}


// ── Devolución o cambio de elementos (SST) ──────────────────────────────────
// Lo devuelto vuelve al stock (entrada) y lo entregado sale (salida). Todo
// queda enlazado a la entrega original para ver la historia del trabajador.
async function accionInvRegistrarCambio(body, env) {
  const devueltos = Array.isArray(body.devueltos) ? body.devueltos : [];
  const entregados = Array.isArray(body.entregados) ? body.entregados : [];
  if (!devueltos.length && !entregados.length) return { ok: false, error: 'No hay elementos para registrar' };
  const empleado = String(body.empleado_proveedor || '').trim();
  if (!empleado) return { ok: false, error: 'Falta el trabajador' };
  const fecha = String(body.fecha || '').trim() || isoDate(new Date());
  const tipo = entregados.length ? 'CAMBIO' : 'DEVOLUCION';
  const idRegn = Date.now().toString(36) + Math.random().toString(36).slice(2, 6);

  await sbWrite(env, 'POST', 'inv_registros', {
    id_regn: idRegn,
    auxiliar: String(body.auxiliar || '').trim(),
    empleado_proveedor: empleado,
    id_factura: String(body.id_factura || '').trim(),
    fecha,
    firma: '',
    sede: 'NORTE',
    tipo,
    ref_regn: String(body.ref_regn || '').trim(),
    motivo: String(body.motivo || '').trim(),
  });
  if (body.firma && String(body.firma).length > 20) {
    await sbWrite(env, 'POST', 'inv_firmas', { id_regn: idRegn, firma: String(body.firma) });
  }

  let nid = Date.now();
  const filas = [];
  devueltos.filter((it) => String(it.item || '').trim() && parseFloat(it.cantidad) > 0).forEach((it) => {
    filas.push({
      id_movimiento: 'DEV' + (nid++).toString(36).toUpperCase() + Math.random().toString(36).slice(2, 4).toUpperCase(),
      id_regn: idRegn, item: String(it.item).trim(), categoria: String(it.categoria || '').toUpperCase(),
      fecha, factura_id: '', producto: String(it.producto || '').trim(),
      entradas: parseFloat(it.cantidad) || 0, salidas: 0, precio_un: parseFloat(it.precio) || 0,
      novedad: 'DEVOLUCIÓN' + (body.motivo ? (' — ' + String(body.motivo).trim()) : ''),
      empleado,
    });
  });
  entregados.filter((it) => String(it.item || '').trim() && parseFloat(it.cantidad) > 0).forEach((it) => {
    filas.push({
      id_movimiento: 'CAM' + (nid++).toString(36).toUpperCase() + Math.random().toString(36).slice(2, 4).toUpperCase(),
      id_regn: idRegn, item: String(it.item).trim(), categoria: String(it.categoria || '').toUpperCase(),
      fecha, factura_id: '', producto: String(it.producto || '').trim(),
      entradas: 0, salidas: parseFloat(it.cantidad) || 0, precio_un: parseFloat(it.precio) || 0,
      novedad: 'CAMBIO' + (body.motivo ? (' — ' + String(body.motivo).trim()) : ''),
      empleado,
    });
  });
  if (filas.length) await sbWrite(env, 'POST', 'inv_movimientos', filas);
  return { ok: true, id_regn: idRegn, tipo };
}


// ── Informe de entregas de dotación por categoría y rango de fechas ─────────
// Devuelve una fila por elemento entregado (no por acta), con la cédula y el
// nombre del trabajador. Solo salidas; las devoluciones no cuentan.
async function accionInvInformeEntregas(body, env) {
  const desde = String(body.desde || '').trim();
  const hasta = String(body.hasta || '').trim();
  const categoria = String(body.categoria || '').trim().toUpperCase();
  let path = 'inv_movimientos?select=id_regn,item,producto,categoria,salidas,fecha,empleado,novedad&salidas=gt.0';
  if (desde) path += `&fecha=gte.${encodeURIComponent(desde)}`;
  if (hasta) path += `&fecha=lte.${encodeURIComponent(hasta)}`;
  if (categoria) path += `&categoria=eq.${encodeURIComponent(categoria)}`;
  const movs = await sbAll(env, path + '&order=fecha.desc');
  if (!movs.length) return { ok: true, data: [] };

  // Datos del acta (cédula y nombre) para cada movimiento
  const ids = Array.from(new Set(movs.map((m) => m.id_regn).filter(Boolean)));
  const actas = {};
  for (let i = 0; i < ids.length; i += 80) {
    const lote = ids.slice(i, i + 80).map((x) => `"${String(x).replace(/"/g, '')}"`).join(',');
    const part = await sbAll(env, `inv_registros?select=id_regn,empleado_proveedor,id_factura,fecha,tipo,auxiliar&id_regn=in.(${lote})`);
    part.forEach((a) => { actas[a.id_regn] = a; });
  }
  const data = movs.map((m) => {
    const a = actas[m.id_regn] || {};
    return {
      id_regn: m.id_regn,
      cedula: String(a.id_factura || '').trim(),
      nombre: String(a.empleado_proveedor || m.empleado || '').trim(),
      fecha: m.fecha,
      item: String(m.item || ''),
      producto: String(m.producto || ''),
      categoria: String(m.categoria || ''),
      cantidad: Number(m.salidas || 0),
      auxiliar: String(a.auxiliar || ''),
      tipo: String(a.tipo || 'ENTREGA'),
      novedad: String(m.novedad || ''),
    };
  });
  return { ok: true, data };
}


// ── Historial de vinculaciones (ingresos y retiros) ─────────────────────────
async function accionGetVinculaciones(body, env) {
  const ced = String(body.cedula || '').replace(/[.,\s]/g, '').trim();
  if (!ced) return { ok: false, error: 'Falta cédula' };
  const rows = await sbAll(env, `trabajador_vinculaciones?select=*&cedula=eq.${encodeURIComponent(ced)}&order=fecha_ingreso.desc`);
  return { ok: true, data: rows.map((v) => ({
    id: v.id, cedula: v.cedula,
    ingreso: v.fecha_ingreso ? String(v.fecha_ingreso).slice(0, 10) : '',
    retiro: v.fecha_retiro ? String(v.fecha_retiro).slice(0, 10) : '',
    cargo: v.cargo || '', sede: v.sede || '',
    motivo: v.motivo_retiro || '', obs: v.observacion || '',
  })) };
}

// Cierra la vinculación vigente con una fecha de retiro
async function accionCerrarVinculacion(body, env) {
  const ced = String(body.cedula || '').replace(/[.,\s]/g, '').trim();
  const retiro = fechaONull(body.retiro);
  if (!ced || !retiro) return { ok: false, error: 'Falta cédula o fecha de retiro' };
  const abiertas = await sb(env, `trabajador_vinculaciones?select=id&cedula=eq.${encodeURIComponent(ced)}&fecha_retiro=is.null&order=fecha_ingreso.desc&limit=1`);
  if (!abiertas.length) return { ok: true, sinVinculacionAbierta: true };
  await sbWrite(env, 'PATCH', `trabajador_vinculaciones?id=eq.${abiertas[0].id}`, {
    fecha_retiro: retiro,
    motivo_retiro: String(body.motivo || '').trim(),
  });
  return { ok: true };
}

// Reingreso: cierra la vinculación anterior (si está abierta) y abre una nueva
async function accionRegistrarReingreso(body, env) {
  const ced = String(body.cedula || '').replace(/[.,\s]/g, '').trim();
  const ingreso = fechaONull(body.ingreso);
  if (!ced || !ingreso) return { ok: false, error: 'Falta cédula o fecha de ingreso' };
  const retiroAnt = fechaONull(body.retiroAnterior);

  // Cerrar la vinculación vigente con la fecha de retiro indicada
  const abiertas = await sb(env, `trabajador_vinculaciones?select=id,fecha_ingreso&cedula=eq.${encodeURIComponent(ced)}&fecha_retiro=is.null&order=fecha_ingreso.desc&limit=1`);
  if (abiertas.length && retiroAnt) {
    await sbWrite(env, 'PATCH', `trabajador_vinculaciones?id=eq.${abiertas[0].id}`, {
      fecha_retiro: retiroAnt,
      motivo_retiro: String(body.motivoAnterior || '').trim(),
    });
  }
  // Abrir la nueva
  await sbWrite(env, 'POST', 'trabajador_vinculaciones', {
    cedula: ced, fecha_ingreso: ingreso, fecha_retiro: null,
    cargo: String(body.cargo || ''), sede: String(body.sede || ''),
    observacion: 'Reingreso', registrado_por: String(body.usuario || ''),
  });
  // Dejar la ficha con la vinculación vigente
  await sbWrite(env, 'PATCH', `trabajadores?cedula=eq.${parseInt(ced)}`, {
    fecha_ingreso: ingreso, fecha_ret: null, estado: 'ACTIVO',   // en trabajadores la columna es fecha_ret
  });
  return { ok: true };
}

async function accionEliminarVinculacion(body, env) {
  if (!body.id) return { ok: false, error: 'Falta id' };
  await sbWrite(env, 'DELETE', `trabajador_vinculaciones?id=eq.${encodeURIComponent(body.id)}`);
  return { ok: true };
}


// ── Responsables de facturación (con su correo para la copia) ──────────────
async function accionGetFacResponsables(body, env) {
  const rows = await sbAll(env, 'facturacion_responsables?select=id,nombre,email,activo,orden&order=orden,nombre');
  return { ok: true, data: rows.map((r) => ({
    id: r.id, nombre: String(r.nombre || ''), email: String(r.email || ''), activo: r.activo !== false,
  })) };
}
async function accionGuardarFacResponsable(body, env) {
  const nombre = String(body.nombre || '').trim().toUpperCase();
  if (!nombre) return { ok: false, error: 'Falta el nombre' };
  const fila = { nombre, email: String(body.email || '').trim(), activo: body.activo !== false };
  if (body.id) {
    await sbWrite(env, 'PATCH', `facturacion_responsables?id=eq.${encodeURIComponent(body.id)}`, fila);
    return { ok: true };
  }
  const ex = await sb(env, `facturacion_responsables?select=id&nombre=eq.${encodeURIComponent(nombre)}&limit=1`);
  if (ex.length) {
    await sbWrite(env, 'PATCH', `facturacion_responsables?id=eq.${ex[0].id}`, fila);
    return { ok: true, actualizado: true };
  }
  await sbWrite(env, 'POST', 'facturacion_responsables', fila);
  return { ok: true };
}
async function accionEliminarFacResponsable(body, env) {
  if (!body.id) return { ok: false, error: 'Falta id' };
  await sbWrite(env, 'DELETE', `facturacion_responsables?id=eq.${encodeURIComponent(body.id)}`);
  return { ok: true };
}


// ═══════════════════════════════════════════════════════════════════════════
//  INCAPACIDADES (enfermedad general, accidente de trabajo y licencias)
// ═══════════════════════════════════════════════════════════════════════════
function incFila(i, pagos) {
  return {
    id: i.id, cedula: String(i.cedula || ''), nombres: i.nombres || '',
    tipo: i.tipo || 'EG', prorroga: !!i.prorroga,
    inicio: i.fecha_inicio ? String(i.fecha_inicio).slice(0, 10) : '',
    dias: Number(i.dias || 0),
    fin: i.fecha_fin ? String(i.fecha_fin).slice(0, 10) : '',
    diasAcum: Number(i.dias_acum || 0), numero: i.numero || '',
    ibc: Number(i.ibc || 0), cie10: i.codigo_cie10 || '', diagnostico: i.diagnostico || '',
    grupo: i.grupo_dx || '', entidad: i.entidad || '', origen: i.origen || '',
    obsRad: i.observacion_rad || '',
    valorEmpresa: Number(i.valor_empresa || 0), valorEntidad: Number(i.valor_entidad || 0),
    notaCredito: Number(i.nota_credito || 0),
    fechaConsig: i.fecha_consig ? String(i.fecha_consig).slice(0, 10) : '',
    estado: i.estado || 'REGISTRADA', observacion: i.observacion || '',
    revision: i.revision || 'REVISADA', revisadoPor: i.revisado_por || '',
    fechaRevision: i.fecha_revision || '', obsRevision: i.obs_revision || '',
    registradoPor: i.registrado_por || '',
    pagos: pagos || [],
  };
}
async function accionGetIncapacidades(body, env) {
  let path = 'incapacidades?select=*&order=fecha_inicio.desc';
  const f = [];
  if (body.tipo) f.push(`tipo=eq.${encodeURIComponent(body.tipo)}`);
  if (body.cedula) f.push(`cedula=eq.${encodeURIComponent(String(body.cedula).replace(/[.,\s]/g, ''))}`);
  if (body.desde) f.push(`fecha_inicio=gte.${encodeURIComponent(body.desde)}`);
  if (body.hasta) f.push(`fecha_inicio=lte.${encodeURIComponent(body.hasta)}`);
  if (f.length) path = 'incapacidades?select=*&' + f.join('&') + '&order=fecha_inicio.desc';
  const rows = await sbAll(env, path);
  if (!rows.length) return { ok: true, data: [] };
  // Pagos por quincena de esas incapacidades
  const ids = rows.map((r) => r.id);
  const pagosPorInc = {};
  for (let i = 0; i < ids.length; i += 100) {
    const lote = ids.slice(i, i + 100).join(',');
    const ps = await sbAll(env, `incapacidad_pagos?select=*&incapacidad_id=in.(${lote})&order=desde`);
    ps.forEach((p) => {
      (pagosPorInc[p.incapacidad_id] = pagosPorInc[p.incapacidad_id] || []).push({
        id: p.id, quincena: p.quincena || '',
        desde: p.desde ? String(p.desde).slice(0, 10) : '',
        hasta: p.hasta ? String(p.hasta).slice(0, 10) : '',
        dias: Number(p.dias || 0), valor: Number(p.valor || 0),
        aCargo: p.a_cargo || 'EPS', pagado: !!p.pagado, observacion: p.observacion || '',
      });
    });
  }
  return { ok: true, data: rows.map((r) => incFila(r, pagosPorInc[r.id] || [])) };
}
async function accionGuardarIncapacidad(body, env) {
  const i = body.incapacidad || {};
  const ced = String(i.cedula || '').replace(/[.,\s]/g, '').trim();
  if (!ced || !i.inicio || !i.dias) return { ok: false, error: 'Faltan cédula, fecha de inicio o días' };
  const fila = {
    cedula: ced, nombres: String(i.nombres || ''), tipo: String(i.tipo || 'EG'),
    prorroga: !!i.prorroga, fecha_inicio: fechaONull(i.inicio), dias: parseInt(i.dias) || 0,
    fecha_fin: fechaONull(i.fin), dias_acum: parseInt(i.diasAcum) || 0,
    numero: String(i.numero || ''), ibc: parseFloat(i.ibc) || 0,
    codigo_cie10: String(i.cie10 || '').toUpperCase(), diagnostico: String(i.diagnostico || ''),
    grupo_dx: String(i.grupo || ''), entidad: String(i.entidad || ''), origen: String(i.origen || ''),
    observacion_rad: String(i.obsRad || ''),
    valor_empresa: parseFloat(i.valorEmpresa) || 0, valor_entidad: parseFloat(i.valorEntidad) || 0,
    nota_credito: parseFloat(i.notaCredito) || 0, fecha_consig: fechaONull(i.fechaConsig),
    estado: String(i.estado || 'REGISTRADA'), observacion: String(i.observacion || ''),
    registrado_por: String(body.usuario || ''),
  };
  // ¿El usuario que registra requiere revisión posterior?
  if (!i.id) {
    const cfg = await sb(env, "config_empresa?select=valor&clave=eq.inc_usuarios_revisar&limit=1");
    const lista = (cfg.length ? String(cfg[0].valor || '') : '').split(',')
      .map((x) => x.trim().toUpperCase()).filter(Boolean);
    const quien = String(body.usuario || '').trim().toUpperCase();
    fila.revision = (quien && lista.indexOf(quien) >= 0) ? 'PENDIENTE' : 'REVISADA';
  }
  let id = i.id;
  if (id) await sbWrite(env, 'PATCH', `incapacidades?id=eq.${encodeURIComponent(id)}`, fila);
  else {
    await sbWrite(env, 'POST', 'incapacidades', fila);
    const nueva = await sb(env, `incapacidades?select=id&cedula=eq.${encodeURIComponent(ced)}&fecha_inicio=eq.${encodeURIComponent(fila.fecha_inicio)}&order=id.desc&limit=1`);
    id = nueva.length ? nueva[0].id : null;
  }
  if (!id) return { ok: false, error: 'No se pudo guardar la incapacidad' };
  // Reemplazar los pagos por quincena
  await sbWrite(env, 'DELETE', `incapacidad_pagos?incapacidad_id=eq.${encodeURIComponent(id)}`);
  const pagos = (body.pagos || []).filter((p) => p && (parseInt(p.dias) || 0) > 0);
  if (pagos.length) {
    await sbWrite(env, 'POST', 'incapacidad_pagos', pagos.map((p) => ({
      incapacidad_id: id, quincena: String(p.quincena || ''),
      desde: fechaONull(p.desde), hasta: fechaONull(p.hasta),
      dias: parseInt(p.dias) || 0, valor: parseFloat(p.valor) || 0,
      a_cargo: String(p.aCargo || 'EPS'), pagado: !!p.pagado, observacion: String(p.observacion || ''),
    })));
  }
  return { ok: true, id };
}
async function accionEliminarIncapacidad(body, env) {
  if (!body.id) return { ok: false, error: 'Falta id' };
  await sbWrite(env, 'DELETE', `incapacidad_pagos?incapacidad_id=eq.${encodeURIComponent(body.id)}`);
  await sbWrite(env, 'DELETE', `incapacidades?id=eq.${encodeURIComponent(body.id)}`);
  return { ok: true };
}
async function accionBuscarCie10(body, env) {
  const q = String(body.q || '').trim();
  if (q.length < 2) return { ok: true, data: [] };
  const esCodigo = /^[A-Za-z]\d/.test(q);
  const path = esCodigo
    ? `cie10?select=codigo,descripcion,grupo&codigo=ilike.${encodeURIComponent(q + '%')}&limit=20`
    : `cie10?select=codigo,descripcion,grupo&descripcion=ilike.${encodeURIComponent('%' + q + '%')}&limit=20`;
  const rows = await sb(env, path);
  return { ok: true, data: rows };
}
// Informe por quincena o por mes: lo que se paga en ese periodo
async function accionInformeIncapacidades(body, env) {
  const f = [];
  if (body.quincena) f.push(`quincena=eq.${encodeURIComponent(body.quincena)}`);
  if (body.desde) f.push(`desde=gte.${encodeURIComponent(body.desde)}`);
  if (body.hasta) f.push(`hasta=lte.${encodeURIComponent(body.hasta)}`);
  const pagos = await sbAll(env, `incapacidad_pagos?select=*${f.length ? '&' + f.join('&') : ''}&order=desde`);
  if (!pagos.length) return { ok: true, data: [] };
  const ids = Array.from(new Set(pagos.map((p) => p.incapacidad_id)));
  const incs = {};
  for (let i = 0; i < ids.length; i += 100) {
    const lote = ids.slice(i, i + 100).join(',');
    const rows = await sbAll(env, `incapacidades?select=id,cedula,nombres,tipo,codigo_cie10,diagnostico,entidad,fecha_inicio,fecha_fin,dias&id=in.(${lote})`);
    rows.forEach((r) => { incs[r.id] = r; });
  }
  const data = pagos.map((p) => {
    const i = incs[p.incapacidad_id] || {};
    return {
      cedula: String(i.cedula || ''), nombres: i.nombres || '', tipo: i.tipo || 'EG',
      quincena: p.quincena || '',
      desde: p.desde ? String(p.desde).slice(0, 10) : '',
      hasta: p.hasta ? String(p.hasta).slice(0, 10) : '',
      dias: Number(p.dias || 0), valor: Number(p.valor || 0), aCargo: p.a_cargo || 'EPS',
      pagado: !!p.pagado, cie10: i.codigo_cie10 || '', diagnostico: i.diagnostico || '',
      entidad: i.entidad || '',
      incInicio: i.fecha_inicio ? String(i.fecha_inicio).slice(0, 10) : '',
      incDias: Number(i.dias || 0),
    };
  }).filter((x) => !body.tipo || x.tipo === body.tipo);
  return { ok: true, data };
}


// Marcar una incapacidad como revisada (o devolverla con una observación)
async function accionRevisarIncapacidad(body, env) {
  if (!body.id) return { ok: false, error: 'Falta id' };
  const estado = String(body.revision || 'REVISADA').toUpperCase();
  await sbWrite(env, 'PATCH', `incapacidades?id=eq.${encodeURIComponent(body.id)}`, {
    revision: estado,
    revisado_por: String(body.usuario || ''),
    fecha_revision: new Date().toISOString(),
    obs_revision: String(body.observacion || ''),
  });
  return { ok: true };
}


// ── Ingresos y retiros ─────────────────────────────────────────────────────
// Combina lo que hay en la ficha del trabajador con el historial de
// vinculaciones, que es donde queda el motivo del retiro.
async function accionGetIngresosRetiros(body, env) {
  // Si todavía no se ha corrido el SQL de retiros, se consulta sin esas columnas
  let trabs = [];
  let faltaSqlRetiros = false;
  try {
    trabs = await sbAll(env, 'trabajadores?select=cedula,nombres,fecha_ingreso,fecha_ret,sede,cargo,estado,motivo_retiro,tipo_retiro', 5000);
  } catch (e) {
    faltaSqlRetiros = true;
    trabs = await sbAll(env, 'trabajadores?select=cedula,nombres,fecha_ingreso,fecha_ret,sede,cargo,estado', 5000);
  }
  let vincs = [];
  try {
    vincs = await sbAll(env, 'trabajador_vinculaciones?select=cedula,fecha_ingreso,fecha_retiro,motivo_retiro,sede,cargo');
  } catch (e) { vincs = []; }

  const nombre = new Map();
  const sedeDe = new Map();
  trabs.forEach((t) => {
    nombre.set(String(t.cedula), String(t.nombres || ''));
    sedeDe.set(String(t.cedula), String(t.sede || ''));
  });

  const filas = [];
  const vistos = new Set();
  const iso = (x) => (x ? String(x).slice(0, 10) : '');

  // Datos de la ficha, por cédula, para completar lo que falte en el historial
  const fichaDe = new Map(trabs.map((t) => [String(t.cedula), t]));
  vincs.forEach((v) => {
    const ced = String(v.cedula || '');
    const ing = iso(v.fecha_ingreso);
    vistos.add(ced + '|' + ing);
    const t = fichaDe.get(ced);
    let ret = iso(v.fecha_retiro);
    // El historial se sembró una sola vez: si la ficha ya tiene la fecha de
    // retiro de esa misma vinculación y aquí falta, se toma la de la ficha.
    if (!ret && t && iso(t.fecha_ingreso) === ing) ret = iso(t.fecha_ret);
    filas.push({
      cedula: ced, nombre: nombre.get(ced) || '', ingreso: ing, retiro: ret,
      sede: String(v.sede || sedeDe.get(ced) || ''), cargo: String(v.cargo || ''),
      motivo: String(v.motivo_retiro || (t && t.motivo_retiro) || ''), origen: 'historial',
    });
  });
  trabs.forEach((t) => {
    const ced = String(t.cedula);
    const ing = iso(t.fecha_ingreso);
    if (!ing || vistos.has(ced + '|' + ing)) return;
    filas.push({
      cedula: ced, nombre: String(t.nombres || ''), ingreso: ing, retiro: iso(t.fecha_ret),
      sede: String(t.sede || ''), cargo: String(t.cargo || ''),
      motivo: String(t.motivo_retiro || ''), tipoRetiro: String(t.tipo_retiro || ''),
      estado: String(t.estado || ''), origen: 'ficha',
    });
  });
  // Completar el motivo de los que ya lo tienen en la ficha
  const motFicha = new Map(trabs.map((t) => [String(t.cedula), {
    m: String(t.motivo_retiro || ''), tp: String(t.tipo_retiro || ''), est: String(t.estado || ''),
  }]));
  filas.forEach((f) => {
    const x = motFicha.get(f.cedula);
    if (!x) return;
    if (!f.motivo && x.m) f.motivo = x.m;
    if (!f.tipoRetiro && x.tp) f.tipoRetiro = x.tp;
    if (!f.estado) f.estado = x.est;
  });

  // Filtro por rango de fechas y por tipo de movimiento
  const d1 = String(body.desde || '').slice(0, 10);
  const d2 = String(body.hasta || '').slice(0, 10);
  const tipo = String(body.tipo || '').toUpperCase();   // INGRESO | RETIRO | vacío
  const enRango = (f) => !!f && (!d1 || f >= d1) && (!d2 || f <= d2);

  const out = filas.filter((f) => {
    const ingOk = enRango(f.ingreso);
    const retOk = enRango(f.retiro);
    if (tipo === 'INGRESO') return ingOk;
    if (tipo === 'RETIRO') return retOk;
    return ingOk || retOk;
  }).sort((a, b) => {
    const fa = (tipo === 'RETIRO') ? a.retiro : a.ingreso;
    const fb = (tipo === 'RETIRO') ? b.retiro : b.ingreso;
    return String(fb).localeCompare(String(fa));
  });
  // Marcados como RETIRADO pero sin fecha: no se pueden ubicar en el periodo,
  // así que van aparte para completarlos desde la pantalla.
  const sinFecha = trabs.filter((t) => String(t.estado || '').toUpperCase() === 'RETIRADO' && !iso(t.fecha_ret))
    .map((t) => ({
      cedula: String(t.cedula), nombre: String(t.nombres || ''),
      ingreso: iso(t.fecha_ingreso), retiro: '', sede: String(t.sede || ''),
      cargo: String(t.cargo || ''), motivo: String(t.motivo_retiro || ''),
      tipoRetiro: String(t.tipo_retiro || ''), estado: 'RETIRADO', sinFecha: true,
    }));
  const conFechaRet = trabs.filter((t) => !!iso(t.fecha_ret)).length;
  const marcadosRet = trabs.filter((t) => String(t.estado || '').toUpperCase() === 'RETIRADO').length;
  return {
    ok: true, data: out, sinFecha,
    diag: {
      trabajadores: trabs.length,
      conFechaRetiro: conFechaRet,
      marcadosRetirados: marcadosRet,
      vinculaciones: vincs.length,
      faltaSqlRetiros,
    },
  };
}

// Registrar la fecha, el tipo y el motivo del retiro (queda en la ficha y en el historial)
async function accionGuardarRetiro(body, env) {
  const ced = String(body.cedula || '').replace(/[.,\s]/g, '').trim();
  if (!ced) return { ok: false, error: 'Falta la cédula' };
  const ret = fechaONull(body.retiro);
  const datos = {
    motivo_retiro: String(body.motivo || '').trim(),
    tipo_retiro: String(body.tipoRetiro || '').trim().toUpperCase(),
    obs_retiro: String(body.observacion || '').trim(),
  };
  if (ret) { datos.fecha_ret = ret; datos.estado = 'RETIRADO'; }
  await sbWrite(env, 'PATCH', `trabajadores?cedula=eq.${parseInt(ced)}`, datos);
  // Cerrar también la vinculación vigente, para que el historial cuadre
  try {
    const ab = await sb(env, `trabajador_vinculaciones?select=id&cedula=eq.${encodeURIComponent(ced)}&fecha_retiro=is.null&order=fecha_ingreso.desc&limit=1`);
    if (ab.length && ret) {
      await sbWrite(env, 'PATCH', `trabajador_vinculaciones?id=eq.${ab[0].id}`, {
        fecha_retiro: ret, motivo_retiro: datos.motivo_retiro,
      });
    }
  } catch (e) { /* si no existe la tabla, no pasa nada */ }
  return { ok: true };
}

// Registrar o corregir el motivo de un retiro
async function accionGuardarMotivoRetiro(body, env) {
  const ced = String(body.cedula || '').replace(/[.,\s]/g, '').trim();
  const ing = fechaONull(body.ingreso);
  if (!ced || !ing) return { ok: false, error: 'Faltan datos de la vinculación' };
  const motivo = String(body.motivo || '').trim();
  const ret = fechaONull(body.retiro);
  const ex = await sb(env, `trabajador_vinculaciones?select=id&cedula=eq.${encodeURIComponent(ced)}&fecha_ingreso=eq.${encodeURIComponent(ing)}&limit=1`);
  if (ex.length) {
    await sbWrite(env, 'PATCH', `trabajador_vinculaciones?id=eq.${ex[0].id}`, { motivo_retiro: motivo, fecha_retiro: ret });
  } else {
    await sbWrite(env, 'POST', 'trabajador_vinculaciones', {
      cedula: ced, fecha_ingreso: ing, fecha_retiro: ret, motivo_retiro: motivo,
      sede: String(body.sede || ''), cargo: String(body.cargo || ''), observacion: 'Motivo registrado desde Ingresos y retiros',
    });
  }
  return { ok: true };
}


// ═══════════════════════════════════════════════════════════════════════════
//  INFORME DE AUSENTISMO
//  Días programados (lunes a sábado, sin festivos) frente a días perdidos.
//  Las vacaciones NO son ausentismo. La vigilancia se mide por horas, porque
//  sus turnos dejan días sin reporte que no son ausencia.
// ═══════════════════════════════════════════════════════════════════════════
const AUS_NOV = {
  '1':  { nom: 'Incapacidad E.G.',        grupo: 'Salud' },
  '2':  { nom: 'Incapacidad A.T.',        grupo: 'Salud' },
  '3':  { nom: 'Cita médica general',     grupo: 'Salud' },
  '24': { nom: 'Cita médica especialista',grupo: 'Salud' },
  '15': { nom: 'Exámenes médicos',        grupo: 'Salud' },
  '4':  { nom: 'Calamidad',               grupo: 'Permisos' },
  '6':  { nom: 'Permiso',                 grupo: 'Permisos' },
  '7':  { nom: 'Permiso no remunerado',   grupo: 'Permisos' },
  '11': { nom: 'Licencia de luto',        grupo: 'Permisos' },
  '21': { nom: 'Día de reposo',           grupo: 'Permisos' },
  '9':  { nom: 'Licencia paternidad',     grupo: 'Licencias' },
  '10': { nom: 'Licencia maternidad',     grupo: 'Licencias' },
  '16': { nom: 'Varada de moto',          grupo: 'Transporte' },
  '17': { nom: 'Falta sin causa',         grupo: 'Injustificado' },
  '12': { nom: 'Suspendido',              grupo: 'Disciplinario' },
};
// No son ausentismo: MB (motobomba) y 8 (nocturno) son trabajo; 13 vacaciones;
// 5 día de familia, 14 reinducción y 20 capacitación son tiempo reconocido;
// 18 y 19 solo marcan ingreso y retiro.
const AUS_NO = new Set(['MB', '5', '8', '13', '14', '18', '19', '20']);

function ausDiasHabiles(desde, hasta) {
  // Días de lunes a sábado que no sean festivos
  const out = [];
  const d = new Date(desde + 'T12:00:00Z');
  const fin = new Date(hasta + 'T12:00:00Z');
  while (d <= fin) {
    const dow = d.getUTCDay();                       // 0 = domingo
    if (dow !== 0 && !esFestivoISO(d.toISOString().slice(0, 10))) {
      out.push(d.toISOString().slice(0, 10));
    }
    d.setUTCDate(d.getUTCDate() + 1);
  }
  return out;
}

async function accionInformeAusentismo(body, env) {
  const d1 = String(body.desde || '').slice(0, 10);
  const d2 = String(body.hasta || '').slice(0, 10);
  if (!d1 || !d2) return { ok: false, error: 'Falta el periodo' };
  const horasDia = parseFloat(body.horasDia) || 7;   // horas de vigilancia que equivalen a un día

  const habiles = ausDiasHabiles(d1, d2);
  const setHabiles = new Set(habiles);

  const trabs = await sbAll(env, 'trabajadores?select=cedula,nombres,fecha_ingreso,fecha_ret,sede,cargo,estado');
  // Resumen por trabajador calculado en la base (una sola petición)
  let agregado = [];
  let sinFuncion = false;
  try {
    agregado = await sbRpc(env, 'ausentismo_datos', { p_desde: d1, p_hasta: d2 });
  } catch (e) {
    sinFuncion = true;
  }
  let incaps = [];
  try {
    // Solo las que pueden tocar el periodo (desde 400 días antes del corte)
    const ini = new Date(new Date(d1 + 'T12:00:00Z').getTime() - 400 * 86400000).toISOString().slice(0, 10);
    incaps = await sbAll(env, `incapacidades?select=cedula,tipo,fecha_inicio,dias&fecha_inicio=gte.${ini}&fecha_inicio=lte.${d2}`, 5000);
  } catch (e) { incaps = []; }

  // Lo que hizo cada trabajador en el periodo, a partir del resumen de la base
  const porCed = {};
  agregado.forEach((a) => {
    const c = String(a.cedula || ''); if (!c) return;
    const b = (porCed[c] = { diasLabor: parseInt(a.dias_labor) || 0, horasVig: parseFloat(a.horas_vig) || 0,
                             nov: {}, vacDias: parseInt(a.dias_vac) || 0, diasPresentes: new Set() });
    String(a.novedades || '').split(',').forEach((par) => {
      const p = par.split(':');
      if (p.length < 2) return;
      const f = p[0].slice(0, 10), nv = String(p[1] || '').trim().toUpperCase();
      if (!f || !nv || !setHabiles.has(f)) return;
      if (AUS_NO.has(nv)) { b.diasPresentes.add(f); return; }   // novedad reconocida: cuenta como presente
      if (AUS_NOV[nv]) { (b.nov[nv] = b.nov[nv] || new Set()).add(f); }
    });
  });

  // Días de incapacidad del módulo, que mandan sobre la novedad del día
  const incPorCed = {};
  incaps.forEach((i) => {
    const c = String(i.cedula || ''); if (!c) return;
    const ini = String(i.fecha_inicio || '').slice(0, 10);
    if (!ini) return;
    const dias = parseInt(i.dias) || 0;
    const d = new Date(ini + 'T12:00:00Z');
    for (let k = 0; k < dias; k++) {
      const f = d.toISOString().slice(0, 10);
      if (setHabiles.has(f)) {
        const t = String(i.tipo || 'EG');
        const grupo = (t === 'AT') ? 'Salud' : (t === 'MATERNIDAD' || t === 'PATERNIDAD') ? 'Licencias' : 'Salud';
        const nom = (t === 'AT') ? 'Incapacidad A.T.' : (t === 'MATERNIDAD') ? 'Licencia maternidad'
                  : (t === 'PATERNIDAD') ? 'Licencia paternidad' : 'Incapacidad E.G.';
        (incPorCed[c] = incPorCed[c] || {});
        incPorCed[c][f] = { nom, grupo };
      }
      d.setUTCDate(d.getUTCDate() + 1);
    }
  });

  const sedeF = String(body.sede || '').toUpperCase();
  const filas = [];
  const causas = {};
  trabs.forEach((t) => {
    const c = String(t.cedula);
    const ing = t.fecha_ingreso ? String(t.fecha_ingreso).slice(0, 10) : '';
    const ret = t.fecha_ret ? String(t.fecha_ret).slice(0, 10) : '';
    if (ing && ing > d2) return;                 // ingresó después del periodo
    if (ret && ret < d1) return;                 // se retiró antes del periodo
    if (sedeF && String(t.sede || '').toUpperCase() !== sedeF) return;

    const prog = habiles.filter((f) => (!ing || f >= ing) && (!ret || f <= ret));
    if (!prog.length) return;
    const b = porCed[c] || { diasLabor: 0, horasVig: 0, nov: {}, vacDias: 0, diasPresentes: new Set() };

    // Ausencias: primero el módulo de incapacidades, luego las novedades del día
    const ausDias = {};
    const inc = incPorCed[c] || {};
    Object.keys(inc).forEach((f) => { if (prog.indexOf(f) >= 0) ausDias[f] = inc[f]; });
    Object.keys(b.nov).forEach((nv) => {
      b.nov[nv].forEach((f) => {
        if (ausDias[f]) return;
        if (prog.indexOf(f) < 0) return;
        ausDias[f] = { nom: AUS_NOV[nv].nom, grupo: AUS_NOV[nv].grupo };
      });
    });
    const perdidos = Object.keys(ausDias).length;
    Object.keys(ausDias).forEach((f) => {
      const g = ausDias[f].grupo, n = ausDias[f].nom;
      causas[g] = causas[g] || { grupo: g, dias: 0, detalle: {} };
      causas[g].dias++;
      causas[g].detalle[n] = (causas[g].detalle[n] || 0) + 1;
    });

    const vacac = Math.min(prog.length, b.vacDias);
    const diasVig = b.horasVig > 0 ? Math.min(prog.length, Math.round(b.horasVig / horasDia)) : 0;
    const otros = Array.from(b.diasPresentes).filter((f) => prog.indexOf(f) >= 0).length;
    const presentes = Math.min(prog.length, b.diasLabor + diasVig + otros);
    const sinReg = Math.max(0, prog.length - presentes - perdidos - vacac);

    filas.push({
      cedula: c, nombre: String(t.nombres || ''), sede: String(t.sede || ''), cargo: String(t.cargo || ''),
      programados: prog.length, presentes, perdidos, vacaciones: vacac, sinRegistro: sinReg,
      horasVig: Math.round(b.horasVig),
      tasa: prog.length ? Number(((perdidos / prog.length) * 100).toFixed(1)) : 0,
      causas: Object.keys(ausDias).reduce((acc, f) => {
        acc[ausDias[f].nom] = (acc[ausDias[f].nom] || 0) + 1; return acc;
      }, {}),
    });
  });

  filas.sort((a, b2) => b2.perdidos - a.perdidos || String(a.nombre).localeCompare(String(b2.nombre)));
  const totProg = filas.reduce((a, f) => a + f.programados, 0);
  const totPerd = filas.reduce((a, f) => a + f.perdidos, 0);
  return {
    ok: true,
    data: filas,
    resumen: {
      desde: d1, hasta: d2, diasHabiles: habiles.length,
      trabajadores: filas.length, programados: totProg, perdidos: totPerd,
      vacaciones: filas.reduce((a, f) => a + f.vacaciones, 0),
      sinRegistro: filas.reduce((a, f) => a + f.sinRegistro, 0),
      conAusencia: filas.filter((f) => f.perdidos > 0).length,
      sinFuncion,
      tasa: totProg ? Number(((totPerd / totProg) * 100).toFixed(2)) : 0,
      causas: Object.keys(causas).map((g) => causas[g]).sort((a, b3) => b3.dias - a.dias),
    },
  };
}


// ── Detalle día por día del ausentismo de un trabajador ────────────────────
// Permite auditar el cálculo: qué pasó cada día del periodo.
async function accionDetalleAusentismo(body, env) {
  const ced = String(body.cedula || '').replace(/[.,\s]/g, '').trim();
  const d1 = String(body.desde || '').slice(0, 10);
  const d2 = String(body.hasta || '').slice(0, 10);
  if (!ced || !d1 || !d2) return { ok: false, error: 'Faltan datos' };
  const horasDia = parseFloat(body.horasDia) || 7;

  const tr = await sb(env, `trabajadores?select=cedula,nombres,fecha_ingreso,fecha_ret&cedula=eq.${parseInt(ced)}&limit=1`);
  const t = tr.length ? tr[0] : {};
  const ing = t.fecha_ingreso ? String(t.fecha_ingreso).slice(0, 10) : '';
  const ret = t.fecha_ret ? String(t.fecha_ret).slice(0, 10) : '';

  const regs = await sbAll(env, `detalle_dia?select=fecha,tipo,novedad,es_vigilancia,vig_hd,vig_hn,cantidad,id_labor,coordinador_id&cedula=eq.${parseInt(ced)}&fecha=gte.${d1}&fecha=lte.${d2}`);
  let incaps = [];
  try {
    incaps = await sbAll(env, `incapacidades?select=tipo,fecha_inicio,dias&cedula=eq.${encodeURIComponent(ced)}`);
  } catch (e) { incaps = []; }

  // Qué hay en cada fecha
  const porDia = {};
  regs.forEach((r) => {
    const f = String(r.fecha || '').slice(0, 10); if (!f) return;
    const d = (porDia[f] = porDia[f] || { labores: 0, horasVig: 0, novs: [] });
    if (r.es_vigilancia === true) { d.horasVig += (parseFloat(r.vig_hd) || 0) + (parseFloat(r.vig_hn) || 0); return; }
    if (String(r.tipo || '') === 'labor') { d.labores++; return; }
    const nv = String(r.novedad || '').trim().toUpperCase();
    if (nv) d.novs.push(nv);
  });
  const incDia = {};
  incaps.forEach((i) => {
    const ini = String(i.fecha_inicio || '').slice(0, 10); if (!ini) return;
    const d = new Date(ini + 'T12:00:00Z');
    for (let k = 0; k < (parseInt(i.dias) || 0); k++) {
      incDia[d.toISOString().slice(0, 10)] = String(i.tipo || 'EG');
      d.setUTCDate(d.getUTCDate() + 1);
    }
  });

  const DIAS = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];
  const out = [];
  const d = new Date(d1 + 'T12:00:00Z');
  const fin = new Date(d2 + 'T12:00:00Z');
  while (d <= fin) {
    const f = d.toISOString().slice(0, 10);
    const dow = d.getUTCDay();
    const esFestivo = esFestivoISO(f);
    const fuera = (ing && f < ing) || (ret && f > ret);
    let estado, nota = '';
    if (dow === 0) { estado = 'DOMINGO'; }
    else if (esFestivo) { estado = 'FESTIVO'; }
    else if (fuera) { estado = 'FUERA'; nota = (ing && f < ing) ? 'antes del ingreso' : 'después del retiro'; }
    else {
      const x = porDia[f] || { labores: 0, horasVig: 0, novs: [] };
      const inc = incDia[f];
      if (inc) { estado = 'AUSENCIA'; nota = (inc === 'AT') ? 'Incapacidad A.T.' : (inc === 'EG') ? 'Incapacidad E.G.' : 'Licencia ' + inc.toLowerCase(); }
      else if (x.novs.some((n) => n === '13')) { estado = 'VACACIONES'; }
      else if (x.labores > 0) { estado = 'PRESENTE'; nota = x.labores + ' registro(s)'; }
      else if (x.horasVig > 0) { estado = 'PRESENTE'; nota = x.horasVig + ' horas de vigilancia'; }
      else if (x.novs.some((n) => AUS_NOV[n])) {
        const n = x.novs.find((y) => AUS_NOV[y]);
        estado = 'AUSENCIA'; nota = AUS_NOV[n].nom;
      } else if (x.novs.some((n) => AUS_NO.has(n))) { estado = 'PRESENTE'; nota = 'novedad reconocida'; }
      else { estado = 'SIN REGISTRO'; }
    }
    out.push({ fecha: f, dia: DIAS[dow], estado, nota });
    d.setUTCDate(d.getUTCDate() + 1);
  }
  return { ok: true, nombre: String(t.nombres || ''), ingreso: ing, retiro: ret, dias: out };
}


// ── Clasificar un día sin registro como novedad ────────────────────────────
// Convierte el informe de ausentismo en una herramienta de depuración: lo que
// estaba sin explicar queda documentado y pasa a contar como ausentismo.
async function accionClasificarDia(body, env) {
  const ced = parseInt(String(body.cedula || '').replace(/[^\d]/g, '')) || null;
  const fecha = String(body.fecha || '').slice(0, 10);
  const nov = String(body.novedad || '').trim().toUpperCase();
  if (!ced || !fecha || !nov) return { ok: false, error: 'Faltan datos del día' };

  // Semana y día que corresponden a esa fecha, con la MISMA regla del resto
  // del sistema. Antes aquí se calculaba la semana con una fórmula genérica
  // que arrancaba el 1 de enero y contaba de domingo a sábado: los sábados y
  // domingos quedaban una semana corrida.
  await cargarCalendario(env);
  const dia = diaDeFecha(fecha);
  const sm = anioSemanaDeFecha(fecha);
  const semana = sm.semana;
  const anio = sm.anio;

  // No duplicar: si ya hay algo registrado ese día, se informa
  const ya = await sb(env, `detalle_dia?select=id,tipo,novedad&cedula=eq.${ced}&fecha=eq.${fecha}&limit=1`);
  if (ya.length) return { ok: false, error: 'Ese día ya tiene un registro (' + (ya[0].tipo || '') + ')' };

  // Se hereda el coordinador con el que estuvo más recientemente
  let coordId = null;
  try {
    const prev = await sb(env, `detalle_dia?select=coordinador_id&cedula=eq.${ced}&fecha=lte.${fecha}&order=fecha.desc&limit=1`);
    if (prev.length) coordId = prev[0].coordinador_id || null;
  } catch (e) { /* queda sin coordinador */ }

  await sbWrite(env, 'POST', 'detalle_dia', {
    id: crypto.randomUUID().slice(0, 18),
    coordinador_id: coordId,
    anio, semana, cedula: ced, dia, fecha,
    tipo: 'novedad', id_labor: '', unidad: '', cantidad: 0,
    pago_trabajador: 0, cobro_riopaila: 0, auxilio_alim: 0,
    novedad: nov,
    observacion: String(body.observacion || 'Clasificado desde el informe de ausentismo'),
    fecha_registro: new Date().toISOString(),
  });
  return { ok: true, anio, semana, dia };
}


// ── Contratos y otrosíes ───────────────────────────────────────────────────
async function accionGetContratos(body, env) {
  const cs = await sbAll(env, 'contratos?select=*&order=orden,numero');
  let otros = [];
  try { otros = await sbAll(env, 'contrato_otrosi?select=*&order=fecha'); } catch (e) { otros = []; }
  let hist = [];
  try { hist = await sbAll(env, 'contrato_historico?select=*&order=anio'); } catch (e) { hist = []; }
  const histPorContrato = {};
  hist.forEach((h) => {
    (histPorContrato[h.contrato_id] = histPorContrato[h.contrato_id] || [])
      .push({ id: h.id, anio: parseInt(h.anio) || 0, valor: Number(h.valor || 0), observacion: String(h.observacion || '') });
  });
  const porContrato = {};
  otros.forEach((o) => {
    (porContrato[o.contrato_id] = porContrato[o.contrato_id] || []).push({
      id: o.id, numero: String(o.numero || ''),
      fecha: o.fecha ? String(o.fecha).slice(0, 10) : '',
      valor: Number(o.valor || 0),
      nuevaFin: o.nueva_fecha_fin ? String(o.nueva_fecha_fin).slice(0, 10) : '',
      observacion: String(o.observacion || ''),
    });
  });
  return { ok: true, data: cs.map((c) => {
    const os = porContrato[c.id] || [];
    const ampliacion = os.reduce((a, o) => a + (o.valor || 0), 0);
    // La vigencia puede extenderse por un otrosí
    let fin = c.fecha_fin ? String(c.fecha_fin).slice(0, 10) : '';
    os.forEach((o) => { if (o.nuevaFin && o.nuevaFin > fin) fin = o.nuevaFin; });
    return {
      id: c.id, numero: String(c.numero || ''), planta: String(c.planta || ''),
      clave: String(c.clave_factura || ''), valorInicial: Number(c.valor_inicial || 0),
      ampliacion, valorVigente: Number(c.valor_inicial || 0) + ampliacion,
      inicio: c.fecha_inicio ? String(c.fecha_inicio).slice(0, 10) : '',
      fin, finOriginal: c.fecha_fin ? String(c.fecha_fin).slice(0, 10) : '',
      activo: c.activo !== false, observacion: String(c.observacion || ''),
      otrosies: os, historico: histPorContrato[c.id] || [],
    };
  }) };
}
async function accionGuardarContrato(body, env) {
  const c = body.contrato || {};
  const num = String(c.numero || '').trim();
  if (!num) return { ok: false, error: 'Falta el número del contrato' };
  const fila = {
    numero: num, planta: String(c.planta || '').toUpperCase(),
    clave_factura: String(c.clave || '').toUpperCase(),
    valor_inicial: parseFloat(c.valorInicial) || 0,
    fecha_inicio: fechaONull(c.inicio), fecha_fin: fechaONull(c.fin),
    activo: c.activo !== false, observacion: String(c.observacion || ''),
    orden: parseInt(c.orden) || 0,
  };
  if (c.id) await sbWrite(env, 'PATCH', `contratos?id=eq.${encodeURIComponent(c.id)}`, fila);
  else await sbWrite(env, 'POST', 'contratos', fila);
  return { ok: true };
}
async function accionEliminarContrato(body, env) {
  if (!body.id) return { ok: false, error: 'Falta id' };
  await sbWrite(env, 'DELETE', `contratos?id=eq.${encodeURIComponent(body.id)}`);
  return { ok: true };
}
async function accionGuardarOtrosi(body, env) {
  const o = body.otrosi || {};
  if (!o.contratoId) return { ok: false, error: 'Falta el contrato' };
  const fila = {
    contrato_id: o.contratoId, numero: String(o.numero || ''),
    fecha: fechaONull(o.fecha), valor: parseFloat(o.valor) || 0,
    nueva_fecha_fin: fechaONull(o.nuevaFin), observacion: String(o.observacion || ''),
    registrado_por: String(body.usuario || ''),
  };
  if (o.id) await sbWrite(env, 'PATCH', `contrato_otrosi?id=eq.${encodeURIComponent(o.id)}`, fila);
  else await sbWrite(env, 'POST', 'contrato_otrosi', fila);
  return { ok: true };
}
async function accionEliminarOtrosi(body, env) {
  if (!body.id) return { ok: false, error: 'Falta id' };
  await sbWrite(env, 'DELETE', `contrato_otrosi?id=eq.${encodeURIComponent(body.id)}`);
  return { ok: true };
}


// Facturación de años anteriores, cargada a mano (lo que no está en el sistema)
async function accionGuardarHistoricoContrato(body, env) {
  const cid = body.contratoId;
  const anio = parseInt(body.anio) || 0;
  if (!cid || !anio) return { ok: false, error: 'Falta el contrato o el año' };
  const valor = parseFloat(body.valor) || 0;
  const ex = await sb(env, `contrato_historico?select=id&contrato_id=eq.${encodeURIComponent(cid)}&anio=eq.${anio}&limit=1`);
  if (ex.length) {
    if (valor === 0) await sbWrite(env, 'DELETE', `contrato_historico?id=eq.${ex[0].id}`);
    else await sbWrite(env, 'PATCH', `contrato_historico?id=eq.${ex[0].id}`, { valor, observacion: String(body.observacion || '') });
  } else if (valor !== 0) {
    await sbWrite(env, 'POST', 'contrato_historico', {
      contrato_id: cid, anio, valor, observacion: String(body.observacion || 'Cargado manualmente'),
    });
  }
  return { ok: true };
}


// ── Novedades (tabla "referencias") ────────────────────────────────────────
// El texto viene como "3 - CITA MEDICA GENERAL": de ahí se separan el código
// y el nombre que ve el usuario.
function partirReferencia(txt) {
  const t = String(txt || '').trim();
  const m = t.match(/^\s*([A-Za-z0-9]+)\s*[-–]\s*(.+)$/);
  if (m) return { cod: m[1].toUpperCase(), nom: m[2].trim() };
  return { cod: t.toUpperCase(), nom: t };
}
async function accionGetReferencias(body, env) {
  const rows = await sbAll(env, 'referencias?select=id,referencia&order=id');
  return { ok: true, data: rows.map((r) => {
    const p = partirReferencia(r.referencia);
    return { id: r.id, cod: p.cod, nom: p.nom, texto: String(r.referencia || '') };
  }) };
}
async function accionGuardarReferencia(body, env) {
  const texto = String(body.texto || '').trim();
  if (!texto) return { ok: false, error: 'Falta el texto de la novedad' };
  if (body.id) {
    await sbWrite(env, 'PATCH', `referencias?id=eq.${encodeURIComponent(body.id)}`, { referencia: texto });
    return { ok: true };
  }
  // Id siguiente disponible
  const ult = await sb(env, 'referencias?select=id&order=id.desc&limit=1');
  const nuevo = parseInt(body.idNuevo) || ((ult.length ? parseInt(ult[0].id) : 0) + 1);
  await sbWrite(env, 'POST', 'referencias', { id: nuevo, referencia: texto });
  return { ok: true, id: nuevo };
}
async function accionEliminarReferencia(body, env) {
  if (!body.id) return { ok: false, error: 'Falta id' };
  await sbWrite(env, 'DELETE', `referencias?id=eq.${encodeURIComponent(body.id)}`);
  return { ok: true };
}


// ── Consolidado semanal de TODOS los coordinadores ─────────────────────────
// La suma se hace en la base de datos (función consolidado_semanal), igual
// que el Cobro vs Facturación del módulo de coordinadores. Así no depende de
// cuántos registros alcance a cargar el navegador.
async function accionGetConsolidadoTodos(body, env) {
  const d = parseInt(body.desde) || null;
  const h = parseInt(body.hasta) || null;
  let filas;
  try {
    const resp = await sbRpc(env, 'consolidado_semanal', { p_desde: d, p_hasta: h });
    filas = (resp && resp.filas) ? resp.filas : (Array.isArray(resp) ? resp : []);
  } catch (e) {
    // Se devuelve el error tal cual: así se distingue una función que no
    // existe de un error dentro de la consulta o de un problema de permisos.
    const msg = String((e && e.message) || e);
    const noExiste = /PGRST202|could not find the function|does not exist|42883/i.test(msg);
    return { ok: false, error: noExiste ? 'FALTA_FUNCION' : 'ERROR_RPC', detalle: msg };
  }
  // Agrupar por coordinador y administrador, como lo espera la pantalla
  const out = {};
  (filas || []).forEach((f) => {
    const coord = String(f.coordinador || '');
    const adm = String(f.administrador || '');
    if (!coord) return;
    const k = coord + '|' + adm;
    if (!out[k]) out[k] = { coord, adm, sede: String(f.sede || ''), sem0: 0, semanas: {} };
    const s = parseInt(f.semana) || 0;
    const rep = Number(f.reportes || 0);
    const fac = Number(f.facturacion || 0);
    if (s === 0) { out[k].sem0 += rep; return; }   // semana 0 = saldo de cierre
    if (!out[k].semanas[s]) out[k].semanas[s] = { rep: 0, fac: 0 };
    out[k].semanas[s].rep += rep;
    out[k].semanas[s].fac += fac;
  });
  return { ok: true, data: out };
}

// =====================================================================
// ENCUESTA SOCIODEMOGRÁFICA (SST)
// ---------------------------------------------------------------------
// Una fila por encuesta: se conserva el historial. El bloque de salud
// reservado (enfermedades, medicamentos, tabaco, alcohol) solo lo ve SST
// y el ADMIN; RH ve todo lo demás, incluidas alergias y tipo de sangre.
// =====================================================================

// Campos de salud reservados. Quien no sea SST ni ADMIN no los recibe.
const ENC_SALUD_RESERVADA = [
  'enfermedad', 'enfermedad_cual',
  'medicamento', 'medicamento_cual',
  'fuma', 'fuma_prom', 'fuma_rango',
  'alcohol', 'alcohol_frec',
];

// Todas las columnas de la encuesta, en el orden del formulario.
const ENC_COLS = [
  'id', 'cedula', 'tipo', 'anio', 'etiqueta', 'fecha_encuesta', 'realizado_por',
  'nombres', 'email', 'lugar_exp', 'fecha_exp', 'cargo', 'fecha_ingreso',
  'telefono', 'direccion', 'ciudad', 'estado', 'fecha_nac', 'tipo_sangre',
  'estado_civil', 'genero', 'nivel_educativo', 'titulo',
  'talla_camisa', 'talla_pant', 'talla_bota_punt', 'talla_guayo', 'talla_impermeable',
  'monitor', 'talla_bota_lisa', 'edad', 'rango_edad',
  'planta_agua', 'suministro_agua', 'estrato', 'tipo_vivienda',
  'personas_cargo', 'parentesco', 'otros_cursos', 'tiempo_libre',
  'ingresos', 'antiguedad', 'experiencia', 'tipo_contrato', 'activ_salud',
  'alergia', 'alergia_cual',
  'enfermedad', 'enfermedad_cual', 'medicamento', 'medicamento_cual',
  'fuma', 'fuma_prom', 'fuma_rango', 'alcohol', 'alcohol_frec',
  'deporte', 'deporte_cual', 'deporte_frec',
  'licencia', 'soat', 'tecnomecanica', 'tarjeta_prop',
  'vacuna_covid', 'vacuna_tipo', 'vacuna_esquema',
  'origen', 'volcada_trab', 'volcada_en', 'volcada_por',
  'observacion', 'creado_en', 'actualizado_en', 'actualizado_por',
];

// Columnas que se escriben desde el formulario (ni id ni campos de control).
const ENC_COLS_EDIT = ENC_COLS.filter((c) =>
  ['id', 'origen', 'volcada_trab', 'volcada_en', 'volcada_por',
   'creado_en', 'actualizado_en', 'actualizado_por'].indexOf(c) < 0);

const ENC_FECHAS  = ['fecha_encuesta', 'fecha_exp', 'fecha_ingreso', 'fecha_nac'];
const ENC_ENTEROS = ['edad', 'personas_cargo'];

// Los 21 campos que se cruzan con trabajadores: encuesta -> columna de trabajadores.
// 'talla_bota_lisa' (botas sin puntera) y 'personas_cargo' NO están aquí a propósito:
// no tienen equivalente real en la ficha de RH.
const ENC_A_TRAB = {
  nombres: 'nombres', email: 'email', lugar_exp: 'lugar_exp', fecha_exp: 'fecha_exp',
  cargo: 'cargo', fecha_ingreso: 'fecha_ingreso', telefono: 'telefono',
  direccion: 'direccion', ciudad: 'ciudad', estado: 'estado', fecha_nac: 'fecha_nac',
  tipo_sangre: 'tipo_sangre', estado_civil: 'estado_civil', genero: 'genero',
  nivel_educativo: 'nivel_educativo', titulo: 'titulo',
  talla_camisa: 'talla_camisa', talla_pant: 'talla_pant',
  talla_bota_punt: 'talla_bota', talla_guayo: 'talla_guayo',
  talla_impermeable: 'talla_impermeable',
};

// El rol se toma de la sesión firmada. Antes salía de body.rol, que lo
// manda el navegador: bastaba con decir "soy SST" para ver la salud.
function encVeSalud(body) {
  const ses = body && body._ses;
  const rol = String((ses ? ses.rol : (body && body.rol)) || '').trim().toLowerCase();
  const usr = String((ses ? ses.usuario : (body && body.usuario)) || '').trim().toUpperCase();
  return rol === 's' || rol === 'sst' || usr === 'ADMIN';
}

// Quién hizo la acción: de la sesión firmada si la hay.
function encUsuario(body) {
  const ses = body && body._ses;
  return String((ses ? ses.usuario : (body && body.usuario)) || '');
}

function encLimpiaTexto(v) {
  if (v === null || v === undefined) return null;
  const s = String(v).trim();
  return s === '' ? null : s;
}

function encLimpiaFecha(v) {
  const s = encLimpiaTexto(v);
  if (!s) return null;
  let m = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (m) return m[0];
  m = s.replace(/[/\-]{2,}/g, '/').match(/^(\d{1,2})[/\-](\d{1,2})[/\-](\d{4})$/);
  if (m) {
    const d = parseInt(m[1], 10), mo = parseInt(m[2], 10), y = parseInt(m[3], 10);
    if (mo >= 1 && mo <= 12 && d >= 1 && d <= 31) {
      return y + '-' + String(mo).padStart(2, '0') + '-' + String(d).padStart(2, '0');
    }
  }
  return null;
}

function encLimpiaEntero(v) {
  const s = encLimpiaTexto(v);
  if (!s) return null;
  const m = s.match(/-?\d+/);
  return m ? parseInt(m[0], 10) : null;
}

// Convierte lo que manda el formulario en una fila lista para la tabla.
function encAFilaDB(e) {
  const row = {};
  for (const c of ENC_COLS_EDIT) {
    if (!(c in e)) continue;
    if (ENC_FECHAS.indexOf(c) >= 0)       row[c] = encLimpiaFecha(e[c]);
    else if (ENC_ENTEROS.indexOf(c) >= 0) row[c] = encLimpiaEntero(e[c]);
    else if (c === 'cedula')              row[c] = encLimpiaEntero(String(e[c] || '').replace(/\D/g, ''));
    else if (c === 'anio')                row[c] = encLimpiaEntero(e[c]);
    else                                  row[c] = encLimpiaTexto(e[c]);
  }
  return row;
}

// Quita del objeto los campos de salud reservados.
function encTapaSalud(o) {
  const out = {};
  for (const k in o) {
    if (ENC_SALUD_RESERVADA.indexOf(k) >= 0) continue;
    out[k] = o[k];
  }
  out._salud_oculta = true;
  return out;
}

function encNormaliza(f) {
  const o = {};
  for (const c of ENC_COLS) {
    let v = f[c];
    if (v === null || v === undefined) v = '';
    else if (c === 'volcada_trab') v = (v === true || v === 'true') ? 'SI' : '';
    else if (ENC_FECHAS.indexOf(c) >= 0) v = String(v).slice(0, 10);
    else v = String(v);
    o[c] = v;
  }
  return o;
}

// --------------------------------------------------------------
// LISTADO — columnas de resumen, para la tabla y el buscador.
// Nunca trae salud: para eso se abre la encuesta.
// --------------------------------------------------------------
async function accionGetEncuestas(body, env) {
  const sel = ['id', 'cedula', 'nombres', 'tipo', 'anio', 'etiqueta', 'fecha_encuesta',
    'cargo', 'ciudad', 'estado', 'monitor', 'realizado_por', 'origen',
    'volcada_trab', 'actualizado_en'].join(',');

  let q = 'encuestas_sst?select=' + sel;
  const anio = encLimpiaEntero(body && body.anio);
  if (anio) q += '&anio=eq.' + anio;
  const tipo = String((body && body.tipo) || '').trim().toUpperCase();
  if (tipo === 'IND' || tipo === 'REIN') q += '&tipo=eq.' + tipo;
  const ced = String((body && body.cedula) || '').replace(/\D/g, '');
  if (ced) q += '&cedula=eq.' + ced;
  q += '&order=anio.desc,fecha_encuesta.desc,id.desc';

  const rows = await sbAll(env, q);
  return {
    ok: true,
    data: rows.map((f) => {
      const o = {};
      for (const k in f) {
        let v = f[k];
        if (v === null || v === undefined) v = '';
        else if (k === 'volcada_trab') v = (v === true || v === 'true') ? 'SI' : '';
        else if (k === 'fecha_encuesta') v = String(v).slice(0, 10);
        else v = String(v);
        o[k] = v;
      }
      return o;
    }),
  };
}

// --------------------------------------------------------------
// UNA ENCUESTA COMPLETA
// --------------------------------------------------------------
async function accionGetEncuesta(body, env) {
  const id = encLimpiaEntero(body && body.id);
  if (!id) return { ok: false, error: 'Falta el id de la encuesta' };
  const tabla = encVeSalud(body) ? 'encuestas_sst' : 'encuestas_sst_rh';
  const rows = await sb(env, tabla + '?select=*&id=eq.' + id + '&limit=1');
  if (!rows.length) return { ok: false, error: 'Encuesta no encontrada' };
  let e = encNormaliza(rows[0]);
  if (!encVeSalud(body)) e = encTapaSalud(e);
  return { ok: true, encuesta: e };
}

// --------------------------------------------------------------
// HISTORIAL DE UNA PERSONA — todas sus encuestas, de la más nueva
// a la más vieja, para ver qué cambió año a año.
// --------------------------------------------------------------
async function accionGetEncuestaHistorial(body, env) {
  const ced = String((body && body.cedula) || '').replace(/\D/g, '');
  if (!ced) return { ok: false, error: 'Falta la cédula' };
  const tabla = encVeSalud(body) ? 'encuestas_sst' : 'encuestas_sst_rh';
  const rows = await sbAll(env, tabla +
    '?select=*&cedula=eq.' + ced + '&order=anio.desc,fecha_encuesta.desc,id.desc');
  const lista = rows.map((f) => {
    let e = encNormaliza(f);
    if (!encVeSalud(body)) e = encTapaSalud(e);
    return e;
  });
  return { ok: true, cedula: ced, data: lista };
}

// --------------------------------------------------------------
// GUARDAR UNA NUEVA ENCUESTA
// Avisa (no bloquea) si ya hay una del mismo tipo y año: en el
// histórico hay un caso real de dos reinducciones en un mismo año.
// --------------------------------------------------------------
async function accionGuardarEncuesta(body, env) {
  const e = body.encuesta || {};
  const row = encAFilaDB(e);
  if (!row.cedula) return { ok: false, error: 'Falta la cédula' };
  if (!row.anio)   return { ok: false, error: 'Falta el año de la encuesta' };
  if (!row.tipo)   row.tipo = 'IND';
  row.tipo = String(row.tipo).toUpperCase() === 'REIN' ? 'REIN' : 'IND';
  if (!row.etiqueta) row.etiqueta = row.tipo + '-' + row.anio;

  const ya = await sb(env, 'encuestas_sst?select=id,fecha_encuesta&cedula=eq.' + row.cedula +
    '&tipo=eq.' + row.tipo + '&anio=eq.' + row.anio + '&limit=5');

  row.origen = 'app';
  row.actualizado_en = new Date().toISOString();
  row.actualizado_por = String(body.usuario || '');
  await sbWrite(env, 'POST', 'encuestas_sst', row);

  return {
    ok: true,
    aviso: ya.length
      ? 'Esta persona ya tenía ' + ya.length + ' encuesta(s) ' + row.tipo + '-' + row.anio +
        '. Se guardó de todas formas; quedan las dos en el historial.'
      : '',
  };
}

// --------------------------------------------------------------
// EDITAR UNA ENCUESTA YA GUARDADA
// Quien no ve salud tampoco la puede escribir.
// --------------------------------------------------------------
async function accionEditarEncuesta(body, env) {
  const id = encLimpiaEntero(body && body.id);
  if (!id) return { ok: false, error: 'Falta el id de la encuesta' };
  const e = body.encuesta || {};
  const row = encAFilaDB(e);
  delete row.cedula;   // la cédula no se cambia: se borra y se crea de nuevo

  if (!encVeSalud(body)) {
    for (const c of ENC_SALUD_RESERVADA) delete row[c];
  }
  if (!Object.keys(row).length) return { ok: false, error: 'Nada que cambiar' };

  row.actualizado_en = new Date().toISOString();
  row.actualizado_por = String(body.usuario || '');
  await sbWrite(env, 'PATCH', 'encuestas_sst?id=eq.' + id, row);
  return { ok: true };
}

async function accionEliminarEncuesta(body, env) {
  const id = encLimpiaEntero(body && body.id);
  if (!id) return { ok: false, error: 'Falta el id de la encuesta' };
  await sbWrite(env, 'DELETE', 'encuestas_sst?id=eq.' + id);
  return { ok: true };
}

// --------------------------------------------------------------
// COMPARAR CON TRABAJADORES
// Devuelve, campo a campo, qué dice la encuesta, qué dice la ficha
// de RH y el veredicto: igual / llenar / cambia / solo_rh.
// --------------------------------------------------------------
async function accionEncuestaComparar(body, env) {
  const id = encLimpiaEntero(body && body.id);
  if (!id) return { ok: false, error: 'Falta el id de la encuesta' };
  const r = await sbRpc(env, 'encuesta_vs_trabajador', { p_id: id });
  if (!r || r.ok === false) {
    return { ok: false, error: (r && r.error) || 'No se pudo comparar' };
  }
  return { ok: true, comparacion: r };
}

// --------------------------------------------------------------
// APLICAR A TRABAJADORES
// Solo escribe los campos que vienen en body.campos, y solo los que
// están en el mapa de cruce. Si la persona no existe, la crea.
// Nada se escribe sin que alguien haya marcado el campo.
// --------------------------------------------------------------
async function accionEncuestaAplicar(body, env) {
  const id = encLimpiaEntero(body && body.id);
  if (!id) return { ok: false, error: 'Falta el id de la encuesta' };

  const pedidos = Array.isArray(body.campos) ? body.campos : [];
  if (!pedidos.length) return { ok: false, error: 'No se marcó ningún campo para aplicar' };

  const enc = await sb(env, 'encuestas_sst?select=*&id=eq.' + id + '&limit=1');
  if (!enc.length) return { ok: false, error: 'Encuesta no encontrada' };
  const e = enc[0];
  const ced = String(e.cedula || '').replace(/\D/g, '');
  if (!ced) return { ok: false, error: 'La encuesta no tiene cédula' };

  // Solo campos del mapa de cruce, y solo si la encuesta trae valor.
  const row = {};
  const aplicados = [];
  const vacios = [];
  for (const campo of pedidos) {
    const colTrab = ENC_A_TRAB[campo];
    if (!colTrab) continue;
    let v = e[campo];
    if (v === null || v === undefined) { vacios.push(campo); continue; }
    v = String(v).trim();
    if (v === '' || ['N/A', 'NA', 'NO APLICA', 'NINGUNO', 'NINGUNA'].indexOf(v.toUpperCase()) >= 0) {
      vacios.push(campo);
      continue;
    }
    row[colTrab] = v;
    aplicados.push(campo);
  }
  if (!aplicados.length) {
    return { ok: false, error: 'Los campos marcados vienen vacíos en la encuesta' };
  }

  const sello = String(body.usuario || '') + ' · encuesta ' +
    (e.etiqueta || (e.tipo + '-' + e.anio)) + ' · ' +
    new Date().toISOString().slice(0, 16).replace('T', ' ');

  const ex = await sb(env, 'trabajadores?select=cedula&cedula=eq.' + ced + '&limit=1');
  let creado = false;
  if (ex.length) {
    row.actualizado_por = sello;
    await sbWrite(env, 'PATCH', 'trabajadores?cedula=eq.' + ced, row);
  } else {
    row.cedula = ced;
    row.fecha_registro = new Date().toISOString();
    row.actualizado_por = sello;
    await sbWrite(env, 'POST', 'trabajadores', row);
    creado = true;
  }

  await sbWrite(env, 'PATCH', 'encuestas_sst?id=eq.' + id, {
    volcada_trab: true,
    volcada_en: new Date().toISOString(),
    volcada_por: String(body.usuario || ''),
  });

  return {
    ok: true,
    creado: creado,
    cedula: ced,
    aplicados: aplicados.length,
    campos: aplicados,
    vacios: vacios,
  };
}

// --------------------------------------------------------------
// RESUMEN PARA EL TABLERO DE SST
// Un solo recorrido: encuestas por año y tipo, cuántas sin volcar,
// y los datos que se contradicen entre encuestas de la misma persona.
// --------------------------------------------------------------
async function accionGetEncuestasResumen(body, env) {
  const rows = await sbAll(env,
    'encuestas_sst?select=id,cedula,nombres,tipo,anio,fecha_encuesta,tipo_sangre,fecha_nac,volcada_trab');

  const porAnio = {};
  const porPersona = {};
  let sinVolcar = 0;

  rows.forEach((r) => {
    const a = String(r.anio || '');
    if (!porAnio[a]) porAnio[a] = { IND: 0, REIN: 0, total: 0 };
    const t = String(r.tipo || 'IND').toUpperCase() === 'REIN' ? 'REIN' : 'IND';
    porAnio[a][t]++;
    porAnio[a].total++;
    if (!(r.volcada_trab === true || r.volcada_trab === 'true')) sinVolcar++;

    const c = String(r.cedula || '');
    if (!porPersona[c]) porPersona[c] = { nombres: r.nombres || '', n: 0, rh: {}, fnac: {} };
    porPersona[c].n++;
    if (r.nombres) porPersona[c].nombres = r.nombres;
    const rh = String(r.tipo_sangre || '').trim().toUpperCase();
    if (rh && rh !== 'N/A') porPersona[c].rh[rh] = 1;
    const fn = String(r.fecha_nac || '').slice(0, 10);
    if (fn) porPersona[c].fnac[fn] = 1;
  });

  const confRH = [], confNac = [];
  for (const c in porPersona) {
    const p = porPersona[c];
    const rhs = Object.keys(p.rh);
    const fns = Object.keys(p.fnac);
    if (rhs.length > 1)  confRH.push({ cedula: c, nombres: p.nombres, valores: rhs.sort() });
    if (fns.length > 1) confNac.push({ cedula: c, nombres: p.nombres, valores: fns.sort() });
  }
  const porNombre = (a, b) => String(a.nombres).localeCompare(String(b.nombres));
  confRH.sort(porNombre);
  confNac.sort(porNombre);

  return {
    ok: true,
    data: {
      encuestas: rows.length,
      personas: Object.keys(porPersona).length,
      sinVolcar: sinVolcar,
      porAnio: porAnio,
      conflictoRH: confRH,
      conflictoNac: confNac,
    },
  };
}

// =====================================================================
// CONSOLIDADO DE NÓMINA — conceptos manuales
// ---------------------------------------------------------------------
// Las últimas cinco acciones que seguían saliendo hacia Apps Script
// contra una hoja de Google. Ahora van contra Supabase.
// =====================================================================

// Lee un valor de dinero. En Colombia el punto separa miles y la coma
// decimales, al reves de como lo lee parseFloat: sin esto, '$ 1.250.000'
// se volveria 1,25 y dañaria una liquidacion sin que nadie lo note.
// La pantalla manda un numero de verdad; esto es para el cargue del
// historico y para cualquier llamada que traiga texto.
function nomNum(v) {
  if (v === null || v === undefined || v === '') return 0;
  if (typeof v === 'number') return isFinite(v) ? v : 0;

  let t = String(v).trim().replace(/[^\d.,\-]/g, '');
  if (!t || t === '-') return 0;

  const neg = t.indexOf('-') === 0;
  t = t.replace(/-/g, '');

  const punto = t.lastIndexOf('.');
  const coma  = t.lastIndexOf(',');

  if (punto >= 0 && coma >= 0) {
    // el que va de ultimo es el decimal; el otro separa miles
    if (coma > punto) t = t.replace(/\./g, '').replace(',', '.');
    else              t = t.replace(/,/g, '');
  } else if (coma >= 0) {
    // solo coma: decimal a la colombiana  (1,5 -> 1.5)
    t = t.replace(/,/g, '.');
  } else if (punto >= 0) {
    // solo punto: 1.250.000 y 1.250 son miles; 1.25 es decimal
    const partes = t.split('.');
    const ultima = partes[partes.length - 1];
    if (partes.length > 2 || ultima.length === 3) t = partes.join('');
  }

  const n = parseFloat(t);
  if (!isFinite(n)) return 0;
  return neg ? -n : n;
}
function nomCed(v) {
  const d = String(v === null || v === undefined ? '' : v).replace(/\D/g, '');
  return d ? parseInt(d, 10) : 0;
}
function nomTxt(v) {
  const s = String(v === null || v === undefined ? '' : v).trim();
  return s === '' ? null : s;
}

// --------------------------------------------------------------
// Los valores digitados de una quincena.
// Devuelve [{cedula, concepto, valor}] — la misma forma que
// entregaba Apps Script, para que la pantalla no cambie.
// --------------------------------------------------------------
async function accionGetNominaQna(body, env) {
  const qna = nomTxt(body && body.qna);
  if (!qna) return { ok: false, error: 'Falta la quincena' };
  const filas = await sbAll(env,
    'nomina_qna?select=cedula,concepto,valor&qna=eq.' + encodeURIComponent(qna));
  return {
    ok: true,
    data: filas.map((f) => ({
      cedula: String(f.cedula),
      concepto: String(f.concepto || ''),
      valor: Number(f.valor) || 0,
    })),
  };
}

// --------------------------------------------------------------
// Guardado automático de la pantalla.
// Llega un lote: {conceptos: {clave: {cedula, concepto, valor}}}
//
// Va por upsert sobre (qna, cedula, concepto). Eso es lo que hace
// que un reintento tras un fallo de red reescriba en vez de duplicar.
// --------------------------------------------------------------
async function accionGuardarNominaQna(body, env) {
  const qna = nomTxt(body && body.qna);
  if (!qna) return { ok: false, error: 'Falta la quincena' };

  const entrada = body.conceptos;
  const lista = Array.isArray(entrada)
    ? entrada
    : (entrada && typeof entrada === 'object') ? Object.values(entrada) : [];
  if (!lista.length) return { ok: false, error: 'Nada que guardar' };

  const usuario = String(body.usuario || '');
  const ahora = new Date().toISOString();

  // Si el mismo lote trae dos veces la misma celda, se queda la última:
  // un upsert con claves repetidas lo rechaza entero.
  const porClave = new Map();
  for (const c of lista) {
    const ced = nomCed(c && c.cedula);
    const con = nomTxt(c && c.concepto);
    if (!ced || !con) continue;
    porClave.set(ced + '|' + con, {
      qna: qna,
      cedula: ced,
      concepto: con,
      valor: nomNum(c.valor),
      usuario: usuario,
      actualizado_en: ahora,
    });
  }
  const filas = [...porClave.values()];
  if (!filas.length) return { ok: false, error: 'Ninguna celda válida en el lote' };

  await sbUpsert(env, 'nomina_qna', filas, 'qna,cedula,concepto');
  return { ok: true, guardados: filas.length };
}

// --------------------------------------------------------------
// Los conceptos personalizados: [{k, n, cat}]
// --------------------------------------------------------------
async function accionGetConceptosNom(body, env) {
  const filas = await sbAll(env, 'conceptos_nom?select=k,n,cat,orden&order=orden.asc,n.asc');
  return {
    ok: true,
    data: filas.map((f) => ({
      k: String(f.k || ''),
      n: String(f.n || ''),
      cat: String(f.cat || 'sal'),
    })),
  };
}

async function accionGuardarConceptoNom(body, env) {
  const k = nomTxt(body && body.k);
  const n = nomTxt(body && body.n);
  let cat = String((body && body.cat) || 'sal').trim().toLowerCase();
  if (['sal', 'ns', 'ded'].indexOf(cat) < 0) cat = 'sal';
  if (!k) return { ok: false, error: 'Falta la clave del concepto' };
  if (!n) return { ok: false, error: 'Falta el nombre del concepto' };

  const ya = await sb(env, 'conceptos_nom?select=k&k=eq.' + encodeURIComponent(k) + '&limit=1');
  if (ya.length) return { ok: false, error: 'Ya existe un concepto con esa clave' };

  await sbWrite(env, 'POST', 'conceptos_nom', {
    k: k, n: n, cat: cat,
    creado_en: new Date().toISOString(),
    creado_por: String(body.usuario || ''),
  });
  return { ok: true };
}

// --------------------------------------------------------------
// Borrar un concepto.
// La pantalla ya le advierte a la persona que se van tambien todos
// los valores guardados en todas las quincenas, asi que hay que
// borrar las dos cosas o quedan filas huerfanas que nadie ve pero
// que siguen sumando si el concepto se vuelve a crear con la misma clave.
// --------------------------------------------------------------
async function accionEliminarConceptoNom(body, env) {
  const k = nomTxt(body && body.k);
  if (!k) return { ok: false, error: 'Falta la clave del concepto' };

  const valores = await sbAll(env,
    'nomina_qna?select=id&concepto=eq.' + encodeURIComponent(k));

  await sbWrite(env, 'DELETE', 'nomina_qna?concepto=eq.' + encodeURIComponent(k));
  await sbWrite(env, 'DELETE', 'conceptos_nom?k=eq.' + encodeURIComponent(k));

  return { ok: true, valores_borrados: valores.length };
}

// =====================================================================
// JORNADAS DE REINDUCCIÓN
// ---------------------------------------------------------------------
// Los trabajadores llenan su propia encuesta desde el celular cuando
// los llaman en grupos. SST abre la jornada con la lista de quienes
// asisten; solo esas cédulas pueden responder, y solo mientras esté
// abierta.
//
// Las acciones encPub* son las que llama la página del celular.
// No piden usuario: la puerta es el token de la jornada, y lo valida
// la base de datos. Nunca devuelven nada de nadie que no sea el
// trabajador que está contestando.
// =====================================================================

// Sin I, O, 0, 1: se dictan en voz alta en una sala con ruido.
const JOR_ALFABETO = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

function jorToken(n) {
  n = n || 8;
  const b = new Uint8Array(n);
  crypto.getRandomValues(b);
  let s = '';
  for (let i = 0; i < n; i++) s += JOR_ALFABETO[b[i] % JOR_ALFABETO.length];
  return s;
}

// Lo único que la página del celular puede escribir. Todo lo demás
// —estado de revisión, jornada, cédula, origen— lo pone el servidor.
const ENC_CAMPOS_PUBLICOS = ENC_COLS_EDIT.filter(
  (c) => ['cedula', 'tipo', 'anio', 'etiqueta', 'realizado_por'].indexOf(c) < 0
);

// ── LO QUE LLAMA EL CELULAR DEL TRABAJADOR ──────────────────────────

async function accionEncPubAbrir(body, env) {
  const token = String((body && body.token) || '').trim().toUpperCase();
  const ced = String((body && body.cedula) || '').replace(/\D/g, '');
  if (!token) return { ok: false, motivo: 'enlace_invalido' };
  if (!ced)   return { ok: false, motivo: 'cedula_vacia' };

  const r = await sbRpc(env, 'jornada_abrir_encuesta', {
    p_token: token, p_cedula: parseInt(ced, 10),
  });
  if (!r || r.ok !== true) {
    return { ok: false, motivo: (r && r.motivo) || 'enlace_invalido' };
  }

  // Se arma la respuesta campo por campo: lo guardado manda, y lo que
  // esté vacío se precarga de la ficha para que solo corrija lo que cambió.
  const g = r.guardado || {};
  const f = r.ficha || {};
  const deFicha = {
    nombres: 'nombres', email: 'email', telefono: 'telefono', direccion: 'direccion',
    ciudad: 'ciudad', fecha_nac: 'fecha_nac', tipo_sangre: 'tipo_sangre',
    lugar_exp: 'lugar_exp', fecha_exp: 'fecha_exp', cargo: 'cargo',
    fecha_ingreso: 'fecha_ingreso', estado_civil: 'estado_civil', genero: 'genero',
    nivel_educativo: 'nivel_educativo', titulo: 'titulo',
    talla_camisa: 'talla_camisa', talla_pant: 'talla_pant',
    talla_bota_punt: 'talla_bota', talla_guayo: 'talla_guayo',
    talla_impermeable: 'talla_impermeable',
  };

  const datos = {};
  for (const c of ENC_CAMPOS_PUBLICOS) {
    let v = g[c];
    if ((v === null || v === undefined || String(v).trim() === '') && deFicha[c]) {
      v = f[deFicha[c]];
    }
    datos[c] = (v === null || v === undefined) ? ''
             : (ENC_FECHAS.indexOf(c) >= 0 ? String(v).slice(0, 10) : String(v));
  }

  return {
    ok: true,
    jornada: r.jornada,
    nombres: r.nombres || '',
    ya_enviada: r.ya_enviada === true,
    datos: datos,
  };
}

// Guardado automático por sección: si al trabajador se le va el
// internet o no alcanza a terminar, lo que llevaba ya está guardado
// y le llega a SST marcado como incompleto.
async function accionEncPubGuardar(body, env) {
  const token = String((body && body.token) || '').trim().toUpperCase();
  const ced = String((body && body.cedula) || '').replace(/\D/g, '');
  if (!token || !ced) return { ok: false, motivo: 'enlace_invalido' };

  // Se vuelve a validar completo en cada guardado: la página del
  // celular no manda el id de la encuesta y el servidor no se lo cree.
  const r = await sbRpc(env, 'jornada_abrir_encuesta', {
    p_token: token, p_cedula: parseInt(ced, 10),
  });
  if (!r || r.ok !== true) return { ok: false, motivo: (r && r.motivo) || 'enlace_invalido' };
  if (r.ya_enviada) return { ok: false, motivo: 'ya_enviada' };

  const entrada = (body && body.datos) || {};
  const row = {};
  for (const c of ENC_CAMPOS_PUBLICOS) {
    if (!(c in entrada)) continue;
    if (ENC_FECHAS.indexOf(c) >= 0)       row[c] = encLimpiaFecha(entrada[c]);
    else if (ENC_ENTEROS.indexOf(c) >= 0) row[c] = encLimpiaEntero(entrada[c]);
    else                                  row[c] = encLimpiaTexto(entrada[c]);
  }
  if (!Object.keys(row).length) return { ok: true, guardados: 0 };

  row.actualizado_en = new Date().toISOString();
  row.actualizado_por = 'celular ' + ced;
  await sbWrite(env, 'PATCH', 'encuestas_sst?id=eq.' + r.encuesta_id, row);

  const av = encLimpiaEntero(body && body.avance);
  await sbWrite(env, 'PATCH',
    'encuestas_jornada_asistentes?jornada_id=eq.' + r.jornada.id + '&cedula=eq.' + ced,
    { estado: 'en_curso', avance: av || 0 });

  return { ok: true, guardados: Object.keys(row).length };
}

async function accionEncPubEnviar(body, env) {
  const token = String((body && body.token) || '').trim().toUpperCase();
  const ced = String((body && body.cedula) || '').replace(/\D/g, '');
  if (!token || !ced) return { ok: false, motivo: 'enlace_invalido' };

  const r = await sbRpc(env, 'jornada_abrir_encuesta', {
    p_token: token, p_cedula: parseInt(ced, 10),
  });
  if (!r || r.ok !== true) return { ok: false, motivo: (r && r.motivo) || 'enlace_invalido' };

  if (body && body.datos) {
    const g = await accionEncPubGuardar(body, env);
    if (g && g.ok === false && g.motivo !== 'ya_enviada') return g;
  }

  await sbWrite(env, 'PATCH', 'encuestas_sst?id=eq.' + r.encuesta_id, {
    fecha_encuesta: new Date().toISOString().slice(0, 10),
    realizado_por: 'EL TRABAJADOR (celular)',
    actualizado_en: new Date().toISOString(),
  });
  await sbWrite(env, 'PATCH',
    'encuestas_jornada_asistentes?jornada_id=eq.' + r.jornada.id + '&cedula=eq.' + ced,
    { estado: 'enviada', enviada_en: new Date().toISOString(), avance: 99 });

  return { ok: true };
}

// ── LO QUE USA SST ──────────────────────────────────────────────────

async function accionJornadaCrear(body, env) {
  const nombre = encLimpiaTexto(body && body.nombre);
  if (!nombre) return { ok: false, error: 'Póngale un nombre a la jornada' };

  const cedulas = (Array.isArray(body.cedulas) ? body.cedulas : [])
    .map((c) => String(c || '').replace(/\D/g, ''))
    .filter((c) => c.length >= 6 && c.length <= 11);
  const unicas = [...new Set(cedulas)];
  if (!unicas.length) return { ok: false, error: 'Agregue al menos un trabajador a la lista' };

  const hoy = new Date();
  const fecha = encLimpiaFecha(body && body.fecha) || hoy.toISOString().slice(0, 10);
  const anio = encLimpiaEntero(body && body.anio) || parseInt(fecha.slice(0, 4), 10);
  const tipo = String((body && body.tipo) || 'REIN').toUpperCase() === 'IND' ? 'IND' : 'REIN';

  // por defecto la jornada se cierra sola a las 12 horas, para que un
  // enlace olvidado no quede vivo
  const horas = encLimpiaEntero(body && body.horas) || 12;
  const cierra = new Date(Date.now() + horas * 3600 * 1000).toISOString();

  let token = '', libre = false;
  for (let i = 0; i < 5 && !libre; i++) {
    token = jorToken(8);
    const ya = await sb(env, 'encuestas_jornadas?select=id&token=eq.' + token + '&limit=1');
    libre = !ya.length;
  }
  if (!libre) return { ok: false, error: 'No se pudo generar el código, intente otra vez' };

  await sbWrite(env, 'POST', 'encuestas_jornadas', {
    nombre: nombre, fecha: fecha, anio: anio, tipo: tipo, token: token,
    abierta: true, cierra_en: cierra,
    sede: encLimpiaTexto(body && body.sede),
    observacion: encLimpiaTexto(body && body.observacion),
    creada_por: String(body.usuario || ''),
  });

  const j = await sb(env, 'encuestas_jornadas?select=id&token=eq.' + token + '&limit=1');
  if (!j.length) return { ok: false, error: 'No se pudo crear la jornada' };
  const jid = j[0].id;

  // los nombres salen de trabajadores, para que el trabajador vea
  // "¿Es usted JUAN PÉREZ?" y no se equivoque de cédula
  const trabs = await sbAll(env,
    'trabajadores?select=cedula,nombres&cedula=in.(' + unicas.join(',') + ')');
  const nombrePorCed = {};
  trabs.forEach((t) => { nombrePorCed[String(t.cedula)] = t.nombres || ''; });

  await sbWrite(env, 'POST', 'encuestas_jornada_asistentes', unicas.map((c) => ({
    jornada_id: jid, cedula: parseInt(c, 10),
    nombres: nombrePorCed[c] || '', estado: 'sin_abrir',
  })));

  return {
    ok: true, id: jid, token: token, asistentes: unicas.length,
    sin_ficha: unicas.filter((c) => !nombrePorCed[c]),
    cierra_en: cierra,
  };
}

async function accionJornadaListar(body, env) {
  const filas = await sbAll(env,
    'encuestas_jornadas?select=id,nombre,fecha,anio,tipo,token,abierta,cierra_en,sede,creada_por,creada_en,cerrada_en&order=fecha.desc,id.desc');
  const ids = filas.map((f) => f.id);
  let porJor = {};
  if (ids.length) {
    const asis = await sbAll(env,
      'encuestas_jornada_asistentes?select=jornada_id,estado&jornada_id=in.(' + ids.join(',') + ')');
    asis.forEach((a) => {
      const k = String(a.jornada_id);
      if (!porJor[k]) porJor[k] = { total: 0, enviadas: 0, en_curso: 0 };
      porJor[k].total++;
      if (a.estado === 'enviada') porJor[k].enviadas++;
      else if (a.estado === 'en_curso') porJor[k].en_curso++;
    });
  }
  return {
    ok: true,
    data: filas.map((f) => {
      const c = porJor[String(f.id)] || { total: 0, enviadas: 0, en_curso: 0 };
      return {
        id: String(f.id), nombre: f.nombre || '', fecha: String(f.fecha || '').slice(0, 10),
        anio: String(f.anio || ''), tipo: f.tipo || 'REIN', token: f.token || '',
        abierta: f.abierta === true || f.abierta === 'true',
        cierra_en: f.cierra_en || '', sede: f.sede || '',
        creada_por: f.creada_por || '', cerrada_en: f.cerrada_en || '',
        total: c.total, enviadas: c.enviadas, en_curso: c.en_curso,
      };
    }),
  };
}

async function accionJornadaDetalle(body, env) {
  const id = encLimpiaEntero(body && body.id);
  if (!id) return { ok: false, error: 'Falta el id de la jornada' };
  const j = await sb(env, 'encuestas_jornadas?select=*&id=eq.' + id + '&limit=1');
  if (!j.length) return { ok: false, error: 'Jornada no encontrada' };
  const a = await sbAll(env,
    'encuestas_jornada_asistentes?select=*&jornada_id=eq.' + id + '&order=nombres.asc');
  return {
    ok: true,
    jornada: {
      id: String(j[0].id), nombre: j[0].nombre || '',
      fecha: String(j[0].fecha || '').slice(0, 10), tipo: j[0].tipo || 'REIN',
      token: j[0].token || '',
      abierta: j[0].abierta === true || j[0].abierta === 'true',
      cierra_en: j[0].cierra_en || '', sede: j[0].sede || '',
      creada_por: j[0].creada_por || '',
    },
    asistentes: a.map((x) => ({
      cedula: String(x.cedula), nombres: x.nombres || '', estado: x.estado || 'sin_abrir',
      encuesta_id: x.encuesta_id ? String(x.encuesta_id) : '',
      avance: x.avance || 0, enviada_en: x.enviada_en || '',
    })),
  };
}

async function accionJornadaCerrar(body, env) {
  const id = encLimpiaEntero(body && body.id);
  if (!id) return { ok: false, error: 'Falta el id de la jornada' };
  const abrir = body && body.abrir === true;
  const campos = abrir
    ? { abierta: true, cerrada_en: null, cerrada_por: null,
        cierra_en: new Date(Date.now() + 12 * 3600 * 1000).toISOString() }
    : { abierta: false, cerrada_en: new Date().toISOString(),
        cerrada_por: String(body.usuario || '') };
  await sbWrite(env, 'PATCH', 'encuestas_jornadas?id=eq.' + id, campos);
  return { ok: true, abierta: abrir };
}

async function accionJornadaAsistentes(body, env) {
  const id = encLimpiaEntero(body && body.id);
  if (!id) return { ok: false, error: 'Falta el id de la jornada' };

  const quitar = String((body && body.quitar) || '').replace(/\D/g, '');
  if (quitar) {
    const a = await sb(env, 'encuestas_jornada_asistentes?select=estado&jornada_id=eq.' + id +
      '&cedula=eq.' + quitar + '&limit=1');
    if (a.length && a[0].estado === 'enviada') {
      return { ok: false, error: 'Esa persona ya envió su encuesta; no se puede quitar de la lista' };
    }
    await sbWrite(env, 'DELETE',
      'encuestas_jornada_asistentes?jornada_id=eq.' + id + '&cedula=eq.' + quitar);
    return { ok: true, quitado: quitar };
  }

  const cedulas = (Array.isArray(body.cedulas) ? body.cedulas : [])
    .map((c) => String(c || '').replace(/\D/g, ''))
    .filter((c) => c.length >= 6 && c.length <= 11);
  const unicas = [...new Set(cedulas)];
  if (!unicas.length) return { ok: false, error: 'No se indicó ninguna cédula' };

  const ya = await sbAll(env,
    'encuestas_jornada_asistentes?select=cedula&jornada_id=eq.' + id);
  const yaSet = new Set(ya.map((x) => String(x.cedula)));
  const nuevas = unicas.filter((c) => !yaSet.has(c));
  if (!nuevas.length) return { ok: true, agregados: 0, nota: 'Ya estaban todos en la lista' };

  const trabs = await sbAll(env,
    'trabajadores?select=cedula,nombres&cedula=in.(' + nuevas.join(',') + ')');
  const nom = {};
  trabs.forEach((t) => { nom[String(t.cedula)] = t.nombres || ''; });

  await sbWrite(env, 'POST', 'encuestas_jornada_asistentes', nuevas.map((c) => ({
    jornada_id: id, cedula: parseInt(c, 10), nombres: nom[c] || '', estado: 'sin_abrir',
  })));
  return { ok: true, agregados: nuevas.length, sin_ficha: nuevas.filter((c) => !nom[c]) };
}

// ── REVISIÓN DE LO QUE LLEGA DEL CELULAR ────────────────────────────

async function accionEncuestasPendientes(body, env) {
  const sel = ['id', 'cedula', 'nombres', 'tipo', 'anio', 'etiqueta', 'fecha_encuesta',
    'jornada_id', 'origen', 'actualizado_en'].join(',');
  const filas = await sbAll(env,
    'encuestas_sst?select=' + sel + '&estado_rev=eq.pendiente&order=actualizado_en.desc');
  return {
    ok: true,
    data: filas.map((f) => {
      const o = {};
      for (const k in f) o[k] = (f[k] === null || f[k] === undefined) ? '' : String(f[k]);
      return o;
    }),
  };
}

async function accionEncuestaRevisar(body, env) {
  const id = encLimpiaEntero(body && body.id);
  if (!id) return { ok: false, error: 'Falta el id de la encuesta' };
  if (body && body.descartar === true) {
    await sbWrite(env, 'DELETE', 'encuestas_sst?id=eq.' + id);
    return { ok: true, descartada: true };
  }
  await sbWrite(env, 'PATCH', 'encuestas_sst?id=eq.' + id, {
    estado_rev: 'revisada',
    revisada_por: String(body.usuario || ''),
    revisada_en: new Date().toISOString(),
  });
  return { ok: true };
}

// =====================================================================
// SESIONES
// ---------------------------------------------------------------------
// Antes de esto el login era solo una pantalla: comprobaba la clave y
// devolvía el rol, pero ninguna acción verificaba nada. Cualquiera que
// conociera la dirección /api podía pedir los trabajadores, la nómina o
// las encuestas sin usuario ni clave.
//
// Ahora el login entrega un token firmado y cada acción lo exige. El rol
// viaja DENTRO del token firmado, así que ya no sirve que el navegador
// diga "soy SST" para ver los datos de salud.
//
// Variables de entorno (Cloudflare → Settings → Variables):
//   AUTH_SECRET  (secreta)  cualquier texto largo y aleatorio
//   AUTH_MODO               'aviso' mientras se despliega, 'exigir' después
// =====================================================================

// Las únicas que no piden sesión.
// Las encPub* las protege el token de la jornada, que valida la base.
const SIN_SESION = new Set([
  'login', 'version',
  'encPubAbrir', 'encPubGuardar', 'encPubEnviar',
]);

const SESION_HORAS = 12;

function authModo(env) {
  const m = String((env && env.AUTH_MODO) || '').trim().toLowerCase();
  return m === 'exigir' ? 'exigir' : 'aviso';
}

function b64uDe(bytes) {
  let s = '';
  const b = new Uint8Array(bytes);
  for (let i = 0; i < b.length; i++) s += String.fromCharCode(b[i]);
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}
function b64uA(txt) {
  let s = String(txt).replace(/-/g, '+').replace(/_/g, '/');
  while (s.length % 4) s += '=';
  const bin = atob(s);
  const b = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) b[i] = bin.charCodeAt(i);
  return b;
}

// La clave se guarda en caché atada AL SECRETO que la generó. Si se
// guardara suelta, un token firmado con otro secreto se daría por bueno
// y rotar AUTH_SECRET no invalidaría los tokens viejos.
let _claveAuth = null;
let _claveAuthDe = null;
async function claveAuth(env) {
  const secreto = env && env.AUTH_SECRET ? String(env.AUTH_SECRET) : '';
  if (!secreto) return null;
  if (_claveAuth && _claveAuthDe === secreto) return _claveAuth;
  _claveAuth = await crypto.subtle.importKey(
    'raw', new TextEncoder().encode(secreto),
    { name: 'HMAC', hash: 'SHA-256' }, false, ['sign', 'verify']
  );
  _claveAuthDe = secreto;
  return _claveAuth;
}

async function firmarSesion(datos, env) {
  const k = await claveAuth(env);
  if (!k) return '';
  const carga = {
    u: String(datos.usuario || ''),
    r: String(datos.rol || ''),
    a: String(datos.adminCampo || ''),
    s: String(datos.sede || ''),
    exp: Date.now() + SESION_HORAS * 3600 * 1000,
  };
  const txt = b64uDe(new TextEncoder().encode(JSON.stringify(carga)));
  const firma = await crypto.subtle.sign('HMAC', k, new TextEncoder().encode(txt));
  return txt + '.' + b64uDe(firma);
}

// Devuelve los datos de la sesión, o null si el token falta, está mal
// firmado o ya venció.
async function leerSesion(tk, env) {
  if (!tk || typeof tk !== 'string' || tk.indexOf('.') < 0) return null;
  const k = await claveAuth(env);
  if (!k) return null;
  const partes = tk.split('.');
  if (partes.length !== 2) return null;
  let valida = false;
  try {
    valida = await crypto.subtle.verify('HMAC', k, b64uA(partes[1]),
      new TextEncoder().encode(partes[0]));
  } catch (_) { return null; }
  if (!valida) return null;
  let carga;
  try { carga = JSON.parse(new TextDecoder().decode(b64uA(partes[0]))); }
  catch (_) { return null; }
  if (!carga || !carga.exp || Date.now() > carga.exp) return null;
  return { usuario: carga.u, rol: carga.r, adminCampo: carga.a, sede: carga.s, exp: carga.exp };
}

// =====================================================================
// VERSION — para saber que api.js esta vivo en el servidor.
// Desde la consola del navegador:
//   fetch('/api',{method:'POST',body:JSON.stringify({accion:'version'})})
//     .then(r=>r.json()).then(console.log)
// =====================================================================
const ACCIONES_CONOCIDAS = [
  'actualizarEstadoFac', 'actualizarFactura', 'buscarCie10', 'cerrarVinculacion',
  'clasificarDia', 'coberturaSemanas', 'cruzarSaldos', 'detalleAusentismo',
  'editarCobroHist', 'editarCoordinador', 'editarDetallado', 'editarEncuesta', 'editarReg',
  'editarTrabajador', 'editarUsuario', 'editarVacacion', 'eliminarAcumuladoQna',
  'eliminarConceptoAcum', 'eliminarConceptoNom', 'eliminarContrato', 'eliminarCoordinador',
  'eliminarCruce', 'eliminarDetallado', 'eliminarEncuesta', 'eliminarFacResponsable',
  'eliminarFactura', 'eliminarIncapacidad', 'eliminarInvConfig', 'eliminarOtrosi',
  'eliminarPlantilla', 'eliminarReferencia', 'eliminarReg', 'eliminarRegistros',
  'eliminarRhCatalogo', 'eliminarTrabajador', 'eliminarUsuario', 'eliminarVacacion',
  'eliminarVinculacion', 'encPubAbrir', 'encPubEnviar', 'encPubGuardar', 'encuestaAplicar',
  'encuestaComparar', 'encuestaRevisar', 'encuestasPendientes', 'facArchivoEliminar',
  'facArchivoRegistrar', 'facArchivoSubirUrl', 'facArchivos', 'getAcumulados',
  'getCobrosHist', 'getConceptosAcum', 'getConceptosNom', 'getConfigEmpresa',
  'getConsolidadoCoord', 'getConsolidadoTodos', 'getContratos', 'getCoordinadoresAdmin',
  'getCruces', 'getDatos', 'getDetallado', 'getEncuesta', 'getEncuestaHistorial',
  'getEncuestas', 'getEncuestasResumen', 'getFacResponsables', 'getFacturas',
  'getFotoTrabajador', 'getIncapacidades', 'getIndiceDup', 'getIngresosRetiros',
  'getInvConfig', 'getInventario', 'getNomConfig', 'getNominaQna', 'getPermisosSubida',
  'getPlantillas', 'getQuincenasAcum', 'getReferencias', 'getRegistros', 'getRhCatalogos',
  'getRhConfig', 'getTrabajadores', 'getUsuarios', 'getUsuariosAdmin', 'getVacaciones',
  'getVigHorasSemana', 'getVinculaciones', 'guardar', 'guardarCobrosHist',
  'guardarConceptoAcum', 'guardarConceptoNom', 'guardarConfigEmpresa', 'guardarContrato',
  'guardarCoordinador', 'guardarCruce', 'guardarDetallado', 'guardarEncuesta',
  'guardarFacResponsable', 'guardarFactura', 'guardarFotoTrabajador',
  'guardarHistoricoContrato', 'guardarIncapacidad', 'guardarInvConfig',
  'guardarMotivoRetiro', 'guardarNomConfig', 'guardarNominaQna', 'guardarOtrosi',
  'guardarPermisoSubida', 'guardarPlantilla', 'guardarReferencia', 'guardarRetiro',
  'guardarRhCatalogo', 'guardarRhConfig', 'guardarTarifa', 'guardarTrabajador',
  'guardarUsuario', 'guardarVacacion', 'importarAcumulados', 'importarTrabajadores',
  'importarVacaciones', 'informeAusentismo', 'informeIncapacidades', 'invActivarProducto',
  'invAjustarStock', 'invEditarActa', 'invEliminarActa', 'invEliminarProducto',
  'invEntregasResumen', 'invGetActas', 'invGetFirma', 'invGetMovimientos',
  'invGuardarProducto', 'invInformeEntregas', 'invItemsActas', 'invRegistrarCambio',
  'invRegistrarEntrada', 'invRegistrarSalida', 'jornadaAsistentes', 'jornadaCerrar',
  'jornadaCrear', 'jornadaDetalle', 'jornadaListar', 'login', 'nuevoEmpleado',
  'registrarReingreso', 'revisarIncapacidad', 'revocarPermisoSubida', 'vaciarAcumulados',
  'verificarDuplicado', 'verificarDuplicadosLote', 'version'
];
const API_VERSION = '2026-11-25';
const API_MODULOS = [
  'nomina', 'facturacion', 'rrhh', 'vacaciones', 'inventario-sst',
  'calendario-por-anio', 'encuesta-sociodemografica',
];
function accionVersion(env) {
  return {
    ok: true,
    version: API_VERSION,
    modulos: API_MODULOS,
    acciones: ACCIONES_CONOCIDAS,
    sesiones: (env && env.AUTH_SECRET) ? authModo(env) : 'SIN AUTH_SECRET',
    servidor: new Date().toISOString(),
  };
}
