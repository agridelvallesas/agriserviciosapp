// =====================================================================
//  AGRISERVICIOS · API (Cloudflare Pages Function)
//  Ruta: /api   ·   Reemplaza progresivamente a Google Apps Script.
//
//  Cómo funciona:
//   - El frontend sigue mandando POST {accion:'...', ...} igual que antes.
//   - Las acciones YA PORTADAS se resuelven aquí contra Supabase.
//   - Las que faltan se REENVÍAN a Apps Script (LEGACY_URL) para que la
//     app siga funcionando completa mientras migramos una por una.
//
//  Variables de entorno (Cloudflare Pages → Settings → Environment variables).
//  NO van en el código; las pones tú en el panel:
//   - SUPABASE_URL          → https://TU-PROYECTO.supabase.co
//   - SUPABASE_SERVICE_KEY  → la service_role key (SECRETA)
//   - LEGACY_URL            → tu URL actual de Apps Script (.../exec)
//
//  Ubicación en el repo:  functions/api.js
// =====================================================================

// Acciones ya resueltas en Supabase (las demás se reenvían a Apps Script)
const PORTADAS = new Set(['login', 'getDatos']);

export async function onRequestPost({ request, env }) {
  let body = {};
  try {
    body = JSON.parse(await request.text());
  } catch (_) {
    return json({ ok: false, error: 'Cuerpo inválido' });
  }

  const accion = body.accion;

  try {
    // Si aún no está portada, reenviar a Apps Script tal cual
    if (!PORTADAS.has(accion)) {
      return await reenviarLegacy(body, env);
    }

    let resultado;
    if (accion === 'login')         resultado = await accionLogin(body, env);
    else if (accion === 'getDatos') resultado = await accionGetDatos(body, env);
    else resultado = { ok: false, error: 'Acción desconocida: ' + accion };

    return json(resultado);
  } catch (err) {
    return json({ ok: false, error: String(err && err.message || err) });
  }
}

// Verificación de que la API está viva (GET /api)
export async function onRequestGet() {
  return json({ ok: true, msg: 'Agriservicios API (Supabase) activa' });
}

// ---------------------------------------------------------------------
//  Helpers de Supabase (PostgREST vía fetch, con la service_role key)
// ---------------------------------------------------------------------
async function sb(env, path) {
  const res = await fetch(`${env.SUPABASE_URL}/rest/v1/${path}`, {
    headers: {
      apikey: env.SUPABASE_SERVICE_KEY,
      Authorization: `Bearer ${env.SUPABASE_SERVICE_KEY}`,
    },
  });
  if (!res.ok) throw new Error('Supabase ' + res.status + ': ' + (await res.text()));
  return res.json();
}

function json(data) {
  return new Response(JSON.stringify(data), {
    headers: { 'content-type': 'application/json' },
  });
}

// Reenvía la petición original a Apps Script (para acciones no portadas)
async function reenviarLegacy(body, env) {
  const res = await fetch(env.LEGACY_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'text/plain' },
    body: JSON.stringify(body),
  });
  const texto = await res.text();
  return new Response(texto, { headers: { 'content-type': 'application/json' } });
}

// ---------------------------------------------------------------------
//  LOGIN — valida contra la tabla usuarios (mismo esquema usuario/clave)
// ---------------------------------------------------------------------
async function accionLogin(body, env) {
  const usuario = String(body.usuario || '').trim().toUpperCase();
  const pass    = String(body.pass || '').trim();

  const usuarios = await sb(env, 'usuarios?select=usuario,contrasena,rol,activo,sede');
  const u = usuarios.find(
    (r) =>
      String(r.usuario || '').trim().toUpperCase() === usuario &&
      String(r.contrasena || '').trim() === pass &&
      r.activo === true
  );
  if (!u) return { ok: false, error: 'Usuario o contraseña incorrectos' };

  const rol = String(u.rol || '').trim().toLowerCase();
  let adminCampo = '';
  if (rol === 'coord') adminCampo = await getAdminDeCampo(usuario, env);

  return {
    ok: true,
    usuario: u.usuario,
    rol,
    adminCampo,
    sede: String(u.sede || 'TODAS').trim().toUpperCase(),
  };
}

async function getAdminDeCampo(coordinador, env) {
  const filas = await sb(env, 'coordinadores?select=nombre,administrador');
  const c = filas.find(
    (r) => String(r.nombre || '').trim().toUpperCase() === coordinador.toUpperCase()
  );
  return c ? String(c.administrador || '').trim() : '';
}

// ---------------------------------------------------------------------
//  GET DATOS — empleados, tarifas, coordinadores, quincenas
//  Devuelve exactamente las mismas formas que esperaba el frontend.
// ---------------------------------------------------------------------
async function accionGetDatos(body, env) {
  const sede = body && body.sede ? String(body.sede).trim().toUpperCase() : '';
  const [empleados, tarifas, coordinadores, quincenas] = await Promise.all([
    getEmpleados(sede, env),
    getTarifas(sede, env),
    getCoordinadores(env),
    getQuincenas(env),
  ]);
  return { ok: true, empleados, tarifas, coordinadores, quincenas };
}

// Empleados ahora salen de la tabla trabajadores (jubilamos la hoja EMPLEADOS)
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
      id: String(f.codigo).trim(),
      d: String(f.descripcion || '').trim(),
      u: String(f.unidad || '').trim(),
      c: parseFloat(f.tarifa_cobro) || 0,   // tarifa cobro Riopaila
      p: parseFloat(f.tarifa_colab) || 0,   // tarifa colaborador (pago)
      sede: tarSede,
      eficiencia: '',
      esVigilancia: String(f.codigo).trim() === 'LV1061183',
    });
  }
  return lista;
}

async function getCoordinadores(env) {
  const filas = await sb(env, 'coordinadores?select=nombre,administrador,sede&order=nombre');
  return filas
    .filter((f) => f.nombre)
    .map((f) => ({
      coord: String(f.nombre).trim(),
      admin: String(f.administrador || '').trim(),
      sede: String(f.sede || '').trim().toUpperCase(),
    }));
}

// Reconstruye la misma estructura agrupada por quincena que armaba Apps Script
async function getQuincenas(env) {
  const filas = await sb(
    env,
    'quincenas?select=sem,periodo_semana,dias,quincena,periodo_quincena,fecha_pago&order=id'
  );
  const quincenas = {};
  let qnaActual = '';
  for (const f of filas) {
    const sem    = String(f.sem || '').trim();
    const dias   = parseInt(f.dias) || 0;
    const qna    = String(f.quincena || '').trim();
    const perQna = String(f.periodo_quincena || '').trim();
    const pago   = String(f.fecha_pago || '').trim();

    if (qna) qnaActual = qna;
    if (sem && dias > 0 && qnaActual) {
      if (!quincenas[qnaActual]) {
        quincenas[qnaActual] = {
          id: qnaActual,
          n: qnaActual + (pago ? ' (pago: ' + pago + ')' : ''),
          periodoQna: perQna,
          fechaPago: pago,
          sems: [],
        };
      }
      const numSem = sem.replace('SEM ', '').replace('SEM', '').trim().padStart(2, '0');
      quincenas[qnaActual].sems.push({ s: numSem, d: dias });
    }
  }
  return Object.values(quincenas);
}
