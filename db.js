import { DatabaseSync } from 'node:sqlite';
import { fileURLToPath } from 'node:url';
import fs from 'node:fs';
import path from 'node:path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DB_PATH = process.env.DB_PATH || path.join(__dirname, 'babyshower.db');

export const db = new DatabaseSync(DB_PATH);

db.exec(`PRAGMA journal_mode = WAL;`);
db.exec(`PRAGMA foreign_keys = ON;`);

db.exec(`
  CREATE TABLE IF NOT EXISTS confirmaciones (
    id            INTEGER PRIMARY KEY AUTOINCREMENT,
    nombre        TEXT    NOT NULL,
    telefono      TEXT,
    asistira      INTEGER NOT NULL DEFAULT 1,
    mensaje       TEXT,
    creado_en     TEXT    NOT NULL DEFAULT (datetime('now','localtime'))
  );
`);

db.exec(`
  CREATE TABLE IF NOT EXISTS invitados (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    confirmacion_id INTEGER NOT NULL REFERENCES confirmaciones(id) ON DELETE CASCADE,
    nombre          TEXT    NOT NULL,
    tipo            TEXT    NOT NULL DEFAULT 'adulto'
  );
`);

db.exec(`CREATE INDEX IF NOT EXISTS idx_invitados_conf ON invitados(confirmacion_id);`);

/* ── lista de regalos ── */
db.exec(`
  CREATE TABLE IF NOT EXISTS articulos (
    id      INTEGER PRIMARY KEY AUTOINCREMENT,
    grupo   TEXT    NOT NULL,
    icono   TEXT,
    nombre  TEXT    NOT NULL,
    varios  INTEGER NOT NULL DEFAULT 0,   -- 1 = lo pueden llevar varias personas
    orden   INTEGER NOT NULL DEFAULT 0
  );
`);
db.exec(`CREATE UNIQUE INDEX IF NOT EXISTS uniq_articulo ON articulos(grupo, nombre);`);

db.exec(`
  CREATE TABLE IF NOT EXISTS reservas (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    articulo_id INTEGER NOT NULL REFERENCES articulos(id) ON DELETE CASCADE,
    nombre      TEXT    NOT NULL,
    telefono    TEXT,
    exclusivo   INTEGER NOT NULL DEFAULT 0,
    creado_en   TEXT    NOT NULL DEFAULT (datetime('now','localtime'))
  );
`);
// candado de la base: un artículo exclusivo no puede tener dos reservas
db.exec(`CREATE UNIQUE INDEX IF NOT EXISTS uniq_reserva_exclusiva ON reservas(articulo_id) WHERE exclusivo = 1;`);
db.exec(`CREATE INDEX IF NOT EXISTS idx_reservas_art ON reservas(articulo_id);`);

/** Carga/actualiza el catálogo desde datos/articulos.json sin borrar lo ya reservado. */
function sembrarArticulos() {
  const ruta = path.join(__dirname, 'datos', 'articulos.json');
  if (!fs.existsSync(ruta)) return;

  const grupos = JSON.parse(fs.readFileSync(ruta, 'utf8'));
  const insertar = db.prepare(
    `INSERT OR IGNORE INTO articulos (grupo, icono, nombre, varios, orden) VALUES (?, ?, ?, ?, ?)`
  );
  const actualizar = db.prepare(
    `UPDATE articulos SET icono = ?, varios = ?, orden = ? WHERE grupo = ? AND nombre = ?`
  );

  db.exec('BEGIN');
  try {
    let orden = 0;
    for (const g of grupos) {
      for (const nombre of g.articulos) {
        const varios = g.varios ? 1 : 0;
        insertar.run(g.titulo, g.icono, nombre, varios, orden);
        actualizar.run(g.icono, varios, orden, g.titulo, nombre);
        orden++;
      }
    }
    db.exec('COMMIT');
  } catch (err) {
    db.exec('ROLLBACK');
    throw err;
  }
}
sembrarArticulos();

const insertConfirmacion = db.prepare(
  `INSERT INTO confirmaciones (nombre, telefono, asistira, mensaje) VALUES (?, ?, ?, ?)`
);
const insertInvitado = db.prepare(
  `INSERT INTO invitados (confirmacion_id, nombre, tipo) VALUES (?, ?, ?)`
);

/**
 * Guarda una confirmación con su lista de acompañantes dentro de una transacción.
 * @returns {{id:number, personas:number}}
 */
export function guardarConfirmacion({ nombre, telefono, asistira, mensaje, invitados }) {
  db.exec('BEGIN');
  try {
    const res = insertConfirmacion.run(nombre, telefono || null, asistira ? 1 : 0, mensaje || null);
    const id = Number(res.lastInsertRowid);
    for (const inv of invitados) {
      insertInvitado.run(id, inv.nombre, inv.tipo === 'nino' ? 'nino' : 'adulto');
    }
    db.exec('COMMIT');
    return { id, personas: invitados.length };
  } catch (err) {
    db.exec('ROLLBACK');
    throw err;
  }
}

export function listarConfirmaciones() {
  const filas = db.prepare(
    `SELECT id, nombre, telefono, asistira, mensaje, creado_en
       FROM confirmaciones ORDER BY id DESC`
  ).all();
  const stmtInv = db.prepare(
    `SELECT nombre, tipo FROM invitados WHERE confirmacion_id = ? ORDER BY id`
  );
  return filas.map((f) => ({ ...f, asistira: !!f.asistira, invitados: stmtInv.all(f.id) }));
}

/* ═══════════ lista de regalos ═══════════ */

/** Devuelve la lista agrupada, con quién lleva cada cosa. */
export function listarRegalos() {
  const articulos = db.prepare(
    `SELECT id, grupo, icono, nombre, varios FROM articulos ORDER BY orden, id`
  ).all();
  const reservas = db.prepare(
    `SELECT id, articulo_id, nombre, creado_en FROM reservas ORDER BY id`
  ).all();

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
 * @returns {{ok:boolean, error?:string, reservaId?:number, articulo?:string}}
 */
export function reservarArticulo({ articuloId, nombre, telefono }) {
  const art = db.prepare(`SELECT id, nombre, varios FROM articulos WHERE id = ?`).get(articuloId);
  if (!art) return { ok: false, error: 'Ese regalo ya no está en la lista.' };

  const exclusivo = art.varios ? 0 : 1;

  if (exclusivo) {
    const ya = db.prepare(`SELECT nombre FROM reservas WHERE articulo_id = ?`).get(art.id);
    if (ya) return { ok: false, error: `«${art.nombre}» ya lo va a llevar ${ya.nombre}.`, ocupado: true };
  } else {
    const repetido = db.prepare(
      `SELECT id FROM reservas WHERE articulo_id = ? AND lower(nombre) = lower(?)`
    ).get(art.id, nombre);
    if (repetido) return { ok: false, error: `Ya habías apartado «${art.nombre}».` };
  }

  try {
    const res = db.prepare(
      `INSERT INTO reservas (articulo_id, nombre, telefono, exclusivo) VALUES (?, ?, ?, ?)`
    ).run(art.id, nombre, telefono || null, exclusivo);
    return { ok: true, reservaId: Number(res.lastInsertRowid), articulo: art.nombre };
  } catch {
    // saltó el índice único: alguien lo apartó un segundo antes
    return { ok: false, error: `«${art.nombre}» lo acaban de apartar.`, ocupado: true };
  }
}

/** Suelta un regalo (por reserva puntual o el artículo completo) para que vuelva a estar libre. */
export function liberarRegalo({ reservaId, articuloId }) {
  if (reservaId) {
    const r = db.prepare(`DELETE FROM reservas WHERE id = ?`).run(reservaId);
    return { ok: true, borradas: r.changes };
  }
  if (articuloId) {
    const r = db.prepare(`DELETE FROM reservas WHERE articulo_id = ?`).run(articuloId);
    return { ok: true, borradas: r.changes };
  }
  return { ok: false, error: 'Falta indicar qué liberar.' };
}

export function resumen() {
  const asisten = db.prepare(
    `SELECT COUNT(*) AS n FROM confirmaciones WHERE asistira = 1`
  ).get().n;
  const personas = db.prepare(
    `SELECT COUNT(*) AS n FROM invitados i
       JOIN confirmaciones c ON c.id = i.confirmacion_id
      WHERE c.asistira = 1`
  ).get().n;
  const adultos = db.prepare(
    `SELECT COUNT(*) AS n FROM invitados i
       JOIN confirmaciones c ON c.id = i.confirmacion_id
      WHERE c.asistira = 1 AND i.tipo = 'adulto'`
  ).get().n;
  const regalos = db.prepare(`SELECT COUNT(*) AS n FROM reservas`).get().n;
  const articulos = db.prepare(`SELECT COUNT(*) AS n FROM articulos`).get().n;
  const librados = db.prepare(
    `SELECT COUNT(*) AS n FROM articulos a
      WHERE a.varios = 0 AND NOT EXISTS (SELECT 1 FROM reservas r WHERE r.articulo_id = a.id)`
  ).get().n;

  return {
    confirmaciones: asisten, personas, adultos, ninos: personas - adultos,
    regalos, articulos, disponibles: librados
  };
}
