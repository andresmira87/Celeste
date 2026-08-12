import http from 'node:http';
import fs from 'node:fs';
import fsp from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { fileURLToPath } from 'node:url';
import {
  listo, guardarConfirmacion, listarConfirmaciones, resumen,
  listarRegalos, reservarArticulo, liberarRegalo
} from './db.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PUBLIC_DIR = path.join(__dirname, 'public');
const PORT = Number(process.env.PORT) || 3000;
// Clave para ver el listado de confirmados: /admin.html
const CLAVE_ADMIN = process.env.CLAVE_ADMIN || 'celeste2026';

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.gif': 'image/gif',
  '.ico': 'image/x-icon',
  '.mp3': 'audio/mpeg',
  '.woff2': 'font/woff2'
};

function json(res, code, data) {
  const body = JSON.stringify(data);
  res.writeHead(code, {
    'Content-Type': 'application/json; charset=utf-8',
    'Content-Length': Buffer.byteLength(body),
    'Cache-Control': 'no-store'
  });
  res.end(body);
}

function leerCuerpo(req, limite = 64 * 1024) {
  return new Promise((resolve, reject) => {
    let datos = '';
    req.on('data', (chunk) => {
      datos += chunk;
      if (datos.length > limite) {
        reject(new Error('Cuerpo demasiado grande'));
        req.destroy();
      }
    });
    req.on('end', () => resolve(datos));
    req.on('error', reject);
  });
}

const limpiar = (v, max = 120) =>
  typeof v === 'string' ? v.replace(/\s+/g, ' ').trim().slice(0, max) : '';

async function servirEstatico(req, res, urlPath) {
  const relativo = decodeURIComponent(urlPath === '/' ? '/index.html' : urlPath);
  const destino = path.join(PUBLIC_DIR, path.normalize(relativo));

  // Evita salir de la carpeta public/
  if (!destino.startsWith(PUBLIC_DIR)) {
    res.writeHead(403).end('Prohibido');
    return;
  }

  try {
    const stat = await fsp.stat(destino);
    if (stat.isDirectory()) throw new Error('ENOTFILE');
    const ext = path.extname(destino).toLowerCase();
    res.writeHead(200, {
      'Content-Type': MIME[ext] || 'application/octet-stream',
      'Content-Length': stat.size,
      'Cache-Control': ext === '.html' ? 'no-cache' : 'public, max-age=3600'
    });
    fs.createReadStream(destino).pipe(res);
  } catch {
    res.writeHead(404, { 'Content-Type': 'text/html; charset=utf-8' });
    res.end('<h1 style="font-family:sans-serif">404 · Página no encontrada</h1>');
  }
}

const servidor = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);

  // ---------- API ----------
  if (url.pathname === '/api/confirmar' && req.method === 'POST') {
    try {
      const datos = JSON.parse((await leerCuerpo(req)) || '{}');

      const nombre = limpiar(datos.nombre, 80);
      const telefono = limpiar(datos.telefono, 30);
      const mensaje = limpiar(datos.mensaje, 400);
      const asistira = datos.asistira !== false;

      if (!nombre) return json(res, 400, { ok: false, error: 'Falta el nombre de quien confirma.' });

      let invitados = Array.isArray(datos.invitados) ? datos.invitados : [];
      invitados = invitados
        .map((i) => ({ nombre: limpiar(i?.nombre, 80), tipo: i?.tipo === 'nino' ? 'nino' : 'adulto' }))
        .filter((i) => i.nombre.length > 0)
        .slice(0, 30);

      if (asistira && invitados.length === 0) {
        return json(res, 400, { ok: false, error: 'Agrega al menos una persona que asistirá.' });
      }

      const guardado = await guardarConfirmacion({ nombre, telefono, asistira, mensaje, invitados });
      return json(res, 200, { ok: true, ...guardado, resumen: await resumen() });
    } catch (err) {
      console.error('Error al guardar:', err);
      return json(res, 500, { ok: false, error: 'No pudimos guardar tu confirmación. Intenta de nuevo.' });
    }
  }

  if (url.pathname === '/api/resumen' && req.method === 'GET') {
    return json(res, 200, { ok: true, ...(await resumen()) });
  }

  // ---------- lista de regalos ----------
  if (url.pathname === '/api/lista' && req.method === 'GET') {
    return json(res, 200, { ok: true, grupos: await listarRegalos(), resumen: await resumen() });
  }

  if (url.pathname === '/api/reservar' && req.method === 'POST') {
    try {
      const datos = JSON.parse((await leerCuerpo(req)) || '{}');
      const nombre = limpiar(datos.nombre, 80);
      const telefono = limpiar(datos.telefono, 30);
      const articuloId = Number(datos.articuloId);

      if (!nombre) return json(res, 400, { ok: false, error: 'Escribe tu nombre para apartarlo.' });
      if (!Number.isInteger(articuloId)) return json(res, 400, { ok: false, error: 'Regalo inválido.' });

      const r = await reservarArticulo({ articuloId, nombre, telefono });
      if (!r.ok) return json(res, r.ocupado ? 409 : 400, { ...r, grupos: await listarRegalos() });
      return json(res, 200, { ...r, grupos: await listarRegalos() });
    } catch (err) {
      console.error('Error al reservar:', err);
      return json(res, 500, { ok: false, error: 'No pudimos apartar el regalo. Intenta de nuevo.' });
    }
  }

  // liberar un regalo: solo con la clave de administración
  if (url.pathname === '/api/liberar' && req.method === 'POST') {
    try {
      const datos = JSON.parse((await leerCuerpo(req)) || '{}');
      if (datos.clave !== CLAVE_ADMIN) return json(res, 401, { ok: false, error: 'Clave incorrecta' });

      const r = await liberarRegalo({
        reservaId: datos.reservaId ? Number(datos.reservaId) : null,
        articuloId: datos.articuloId ? Number(datos.articuloId) : null
      });
      if (!r.ok) return json(res, 400, r);
      return json(res, 200, { ...r, grupos: await listarRegalos(), resumen: await resumen() });
    } catch (err) {
      console.error('Error al liberar:', err);
      return json(res, 500, { ok: false, error: 'No pudimos liberar el regalo.' });
    }
  }

  if (url.pathname === '/api/confirmaciones' && req.method === 'GET') {
    if (url.searchParams.get('clave') !== CLAVE_ADMIN) {
      return json(res, 401, { ok: false, error: 'Clave incorrecta' });
    }
    return json(res, 200, {
      ok: true,
      resumen: await resumen(),
      lista: await listarConfirmaciones(),
      grupos: await listarRegalos()
    });
  }

  // Descarga en CSV para imprimir la lista
  if (url.pathname === '/api/csv' && req.method === 'GET') {
    if (url.searchParams.get('clave') !== CLAVE_ADMIN) {
      return json(res, 401, { ok: false, error: 'Clave incorrecta' });
    }
    const esc = (t) => `"${String(t ?? '').replace(/"/g, '""')}"`;
    const filas = [['id', 'confirma', 'telefono', 'asiste', 'personas', 'invitados', 'mensaje', 'fecha']];
    for (const c of await listarConfirmaciones()) {
      filas.push([
        c.id, c.nombre, c.telefono, c.asistira ? 'SI' : 'NO', c.invitados.length,
        c.invitados.map((i) => `${i.nombre}${i.tipo === 'nino' ? ' (niño)' : ''}`).join(' / '),
        c.mensaje, c.creado_en
      ]);
    }
    const csv = '﻿' + filas.map((f) => f.map(esc).join(';')).join('\r\n');
    res.writeHead(200, {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': 'attachment; filename="confirmaciones-babyshower.csv"'
    });
    return res.end(csv);
  }

  // ---------- Archivos ----------
  if (req.method === 'GET' || req.method === 'HEAD') return servirEstatico(req, res, url.pathname);

  res.writeHead(405).end('Método no permitido');
});

// espera a que la base de datos (tablas + catálogo de regalos) esté lista
listo
  .then(() => {
    servidor.listen(PORT, '0.0.0.0', () => {
      // en Vercel no hay red local que anunciar
      if (process.env.VERCEL) { console.log('Baby Shower · servidor listo (Vercel)'); return; }

      const ips = Object.values(os.networkInterfaces())
        .flat()
        .filter((i) => i && i.family === 'IPv4' && !i.internal)
        .map((i) => i.address);

      console.log('\n  💗  Baby Shower de Celeste Mira — servidor encendido\n');
      console.log(`  En este PC:        http://localhost:${PORT}`);
      for (const ip of ips) console.log(`  Desde el celular:  http://${ip}:${PORT}   (misma red WiFi)`);
      console.log(`\n  Lista de confirmados:  http://localhost:${PORT}/admin.html   (clave: ${CLAVE_ADMIN})`);
      console.log('  Base de datos:         Turso (en la nube)\n');
      console.log('  Para apagar el servidor: Ctrl + C\n');
    });
  })
  .catch((err) => {
    console.error('No se pudo preparar la base de datos:', err);
    process.exit(1);
  });
