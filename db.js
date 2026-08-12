import { createClient } from '@libsql/client';
import { fileURLToPath } from 'node:url';
import fs from 'node:fs';
import path from 'node:path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const url = process.env.TURSO_DATABASE_URL;
const authToken = process.env.TURSO_AUTH_TOKEN;

if (!url) {
  throw new Error(
    'Falta TURSO_DATABASE_URL. Copia .env.example a .env y pon los datos de tu base de Turso.'
  );
}

export const db = createClient({ url, authToken });

async function preparar() {
  await db.execute(`
    CREATE TABLE IF NOT EXISTS confirmaciones (
      id            INTEGER PRIMARY KEY AUTOINCREMENT,
      nombre        TEXT    NOT NULL,
      telefono      TEXT,
      asistira      INTEGER NOT NULL DEFAULT 1,
      mensaje       TEXT,
      creado_en     TEXT    NOT NULL DEFAULT (datetime('now','localtime'))
    );
  `);

  await db.execute(`
    CREATE TABLE IF NOT EXISTS invitados (
      id              INTEGER PRIMARY KEY AUTOINCREMENT,
      confirmacion_id INTEGER NOT NULL REFERENCES confirmaciones(id) ON DELETE CASCADE,
      nombre          TEXT    NOT NULL,
      tipo            TEXT    NOT NULL DEFAULT 'adulto'
    );
  `);
  await db.execute(`CREATE INDEX IF NOT EXISTS idx_invitados_conf ON invitados(confirmacion_id);`);

  await db.execute(`
    CREATE TABLE IF NOT EXISTS articulos (
      id      INTEGER PRIMARY KEY AUTOINCREMENT,
      grupo   TEXT    NOT NULL,
      icono   TEXT,
      nombre  TEXT    NOT NULL,
      varios  INTEGER NOT NULL DEFAULT 0,
      orden   INTEGER NOT NULL DEFAULT 0
    );
  `);
  await db.execute(`CREATE UNIQUE INDEX IF NOT EXISTS uniq_articulo ON articulos(grupo, nombre);`);

  await db.execute(`
    CREATE TABLE IF NOT EXISTS reservas (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      articulo_id INTEGER NOT NULL REFERENCES articulos(id) ON DELETE CASCADE,
      nombre      TEXT    NOT NULL,
      telefono    TEXT,
      exclusivo   INTEGER NOT NULL DEFAULT 0,
      creado_en   TEXT    NOT NULL DEFAULT (datetime('now','localtime'))
    );
  `);
  await db.execute(
    `CREATE UNIQUE INDEX IF NOT EXISTS uniq_reserva_exclusiva ON reservas(articulo_id) WHERE exclusivo = 1;`
  );
  await db.execute(`CREATE INDEX IF NOT EXISTS idx_reservas_art ON reservas(articulo_id);`);
}

async function sembrarArticulos() {
  const ruta = path.join(__dirname, 'datos', 'articulos.json');
  if (!fs.existsSync(ruta)) return;

  const grupos = JSON.parse(fs.readFileSync(ruta, 'utf8'));
  const sentencias = [];
  let orden = 0;
  for (const g of grupos) {
    for (const nombre of g.articulos) {
      const varios = g.varios ? 1 : 0;
      sentencias.push({
        sql: `INSERT OR IGNORE INTO articulos (grupo, icono, nombre, varios, orden) VALUES (?, ?, ?, ?, ?)`,
        args: [g.titulo, g.icono, nombre, varios, orden]
      });
      sentencias.push({
        sql: `UPDATE articulos SET icono = ?, varios = ?, orden = ? WHERE grupo = ? AND nombre = ?`,
        args: [g.icono, varios, orden, g.titulo, nombre]
      });
      orden++;
    }
  }
  if (sentencias.length) await db.batch(sentencias, 'write');
}

// se resuelve una sola vez; server.js espera esto antes de aceptar peticiones
export const listo = (async () => {
  await preparar();
  await sembrarArticulos();
})();

const filas = (r) => r.rows.map((f) => Object.fromEntries(r.columns.map((c, i) => [c, f[i]])));

/**
 * Guarda una confirmación con su lista de acompañantes en una sola transacción.
 * @returns {Promise<{id:number, personas:number}>}
 */
export async function guardarConfirmacion({ nombre, telefono, asistira, mensaje, invitados }) {
  const tx = await db.transaction('write');
  try {
    const res = await tx.execute({
      sql: `INSERT INTO confirmaciones (nombre, telefono, asistira, mensaje) VALUES (?, ?, ?, ?)`,
      args: [nombre, telefono || null, asistira ? 1 : 0, mensaje || null]
    });
    const id = Number(res.lastInsertRowid);
    for (const inv of invitados) {
      await tx.execute({
        sql: `INSERT INTO invitados (confirmacion_id, nombre, tipo) VALUES (?, ?, ?)`,
        args: [id, inv.nombre, inv.tipo === 'nino' ? 'nino' : 'adulto']
      });
    }
    await tx.commit();
    return { id, personas: invitados.length };
  } catch (err) {
    await tx.rollback();
    throw err;
  }
}

export async function listarConfirmaciones() {
  const r = await db.execute(
    `SELECT id, nombre, telefono, asistira, mensaje, creado_en FROM confirmaciones ORDER BY id DESC`
  );
  const confirmaciones = filas(r);

  const ri = await db.execute(
    `SELECT confirmacion_id, nombre, tipo FROM invitados ORDER BY id`
  );
  const porConf = new Map();
  for (const inv of filas(ri)) {
    if (!porConf.has(inv.confirmacion_id)) porConf.set(inv.confirmacion_id, []);
    porConf.get(inv.confirmacion_id).push({ nombre: inv.nombre, tipo: inv.tipo });
  }

  return confirmaciones.map((c) => ({
    ...c, asistira: !!c.asistira, invitados: porConf.get(c.id) || []
  }));
}

/* ═══════════ lista de regalos ═══════════ */

export async function listarRegalos() {
  const ra = await db.execute(`SELECT id, grupo, icono, nombre, varios FROM articulos ORDER BY orden, id`);
  const articulos = filas(ra);

  const rr = await db.execute(`SELECT id, articulo_id, nombre, creado_en FROM reservas ORDER BY id`);
  const reservas = filas(rr);

  const porArticulo = new Map();
  for (const r of reservas) {
    if (!porArticulo.has(r.articulo_id)) porArticulo.set(r.articulo_id, []);
    porArticulo.get(r.articulo_id).push({ id: r.id, nombre: r.nombre, creado_en: r.creado_en });
  }

  const grupos = [];
  for (const a of articulos) {
    let g = grupos.find((x) => x.titulo === a.grupo);
    if (!g) { g = { titulo: a.grupo, icono: a.icono, varios: !!a.varios, articulos: [] }; grupos.push(g); }
    const personas = porArticulo.get(a.id) || [];
    g.articulos.push({
      id: a.id,
      nombre: a.nombre,
      varios: !!a.varios,
      personas,
      tomado: !a.varios && personas.length > 0
    });
  }
  return grupos;
}

/**
 * Aparta un artículo. Si es exclusivo y ya está tomado devuelve {ok:false}.
 * @returns {Promise<{ok:boolean, error?:string, reservaId?:number, articulo?:string, ocupado?:boolean}>}
 */
export async function reservarArticulo({ articuloId, nombre, telefono }) {
  const rArt = await db.execute({
    sql: `SELECT id, nombre, varios FROM articulos WHERE id = ?`, args: [articuloId]
  });
  const art = filas(rArt)[0];
  if (!art) return { ok: false, error: 'Ese regalo ya no está en la lista.' };

  const exclusivo = art.varios ? 0 : 1;

  if (exclusivo) {
    const rYa = await db.execute({ sql: `SELECT nombre FROM reservas WHERE articulo_id = ?`, args: [art.id] });
    const ya = filas(rYa)[0];
    if (ya) return { ok: false, error: `«${art.nombre}» ya lo va a llevar ${ya.nombre}.`, ocupado: true };
  } else {
    const rRep = await db.execute({
      sql: `SELECT id FROM reservas WHERE articulo_id = ? AND lower(nombre) = lower(?)`,
      args: [art.id, nombre]
    });
    if (filas(rRep)[0]) return { ok: false, error: `Ya habías apartado «${art.nombre}».` };
  }

  try {
    const res = await db.execute({
      sql: `INSERT INTO reservas (articulo_id, nombre, telefono, exclusivo) VALUES (?, ?, ?, ?)`,
      args: [art.id, nombre, telefono || null, exclusivo]
    });
    return { ok: true, reservaId: Number(res.lastInsertRowid), articulo: art.nombre };
  } catch {
    // saltó el índice único: alguien lo apartó un instante antes
    return { ok: false, error: `«${art.nombre}» lo acaban de apartar.`, ocupado: true };
  }
}

/** Suelta un regalo (por reserva puntual o el artículo completo) para que vuelva a estar libre. */
export async function liberarRegalo({ reservaId, articuloId }) {
  if (reservaId) {
    const r = await db.execute({ sql: `DELETE FROM reservas WHERE id = ?`, args: [reservaId] });
    return { ok: true, borradas: Number(r.rowsAffected) };
  }
  if (articuloId) {
    const r = await db.execute({ sql: `DELETE FROM reservas WHERE articulo_id = ?`, args: [articuloId] });
    return { ok: true, borradas: Number(r.rowsAffected) };
  }
  return { ok: false, error: 'Falta indicar qué liberar.' };
}

export async function resumen() {
  const uno = async (sql, args = []) => Number(filas(await db.execute({ sql, args }))[0]?.n || 0);

  const asisten = await uno(`SELECT COUNT(*) AS n FROM confirmaciones WHERE asistira = 1`);
  const personas = await uno(
    `SELECT COUNT(*) AS n FROM invitados i JOIN confirmaciones c ON c.id = i.confirmacion_id WHERE c.asistira = 1`
  );
  const adultos = await uno(
    `SELECT COUNT(*) AS n FROM invitados i JOIN confirmaciones c ON c.id = i.confirmacion_id
      WHERE c.asistira = 1 AND i.tipo = 'adulto'`
  );
  const regalos = await uno(`SELECT COUNT(*) AS n FROM reservas`);
  const articulos = await uno(`SELECT COUNT(*) AS n FROM articulos`);
  const disponibles = await uno(
    `SELECT COUNT(*) AS n FROM articulos a
      WHERE a.varios = 0 AND NOT EXISTS (SELECT 1 FROM reservas r WHERE r.articulo_id = a.id)`
  );

  return {
    confirmaciones: asisten, personas, adultos, ninos: personas - adultos,
    regalos, articulos, disponibles
  };
}
