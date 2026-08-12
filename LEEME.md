# Baby Shower · Celeste Mira Rodríguez 🎀

Invitación web con confirmación de asistencia guardada en base de datos.

## Cómo encenderla

Doble clic en **`INICIAR.bat`** (o en una terminal: `npm run dev`).

> La primera vez, instala las dependencias con `npm install` (solo una vez).

Verás algo así:

```
En este PC:        http://localhost:3000
Desde el celular:  http://192.168.x.x:3000   (misma red WiFi)
```

- **Desde este PC:** abre `http://localhost:3000`
- **Desde el celular:** conéctate al **mismo WiFi** y abre la dirección `http://192.168.x.x:3000` que muestra la consola.
- Para apagar: `Ctrl + C` en la ventana negra.

## Lista de regalos

Se armó sola desde **`todo para bebe.xlsx`** (8 hojas, 70 artículos). El catálogo
quedó guardado en `datos/articulos.json`.

- **Ropita** 👗 y **Cambio de pañal** 🧷 → los puede llevar **varias personas**
  (cada una escribe su nombre y quedan todas anotadas).
- **Las demás hojas** (Alimentación, Dormir, Baño, Paseo y viaje, Juegos, Para mamá)
  → **una sola persona por artículo**. Al apartarlo queda con su nombre, se ve
  tachado y **nadie más lo puede escoger**.

Si cambias el Excel, vuelve a generar `datos/articulos.json` con los mismos
títulos y reinicia el servidor: los artículos nuevos se agregan y **no se pierde
lo ya apartado**.

## Ver quién confirmó

`http://localhost:3000/admin.html` → clave: **`celeste2026`**

(o directo, sin escribir la clave: `http://localhost:3000/admin.html?clave=celeste2026`)

El panel tiene dos pestañas:

1. **Confirmaciones** — quién confirmó, con cuántas personas (adultos y niños),
   teléfono y su mensaje. Se puede descargar en **CSV** para abrirlo en Excel.
2. **Lista de regalos** — cada artículo con quién lo va a llevar y a qué hora lo
   apartó. El botón **Liberar** le quita el regalo a esa persona y lo deja
   **disponible otra vez** para que alguien más lo escoja.

Arriba se ven los totales: personas, adultos, niños, familias, regalos apartados
y cuántos siguen libres.

Para cambiar la clave, edítala en el archivo **`.env`** (línea `CLAVE_ADMIN=...`)
y reinicia el servidor. En Vercel, cámbiala en las variables de entorno del
proyecto (ver más abajo).

## ⚠️ Poner tus dos imágenes (importante)

Guarda las dos imágenes que enviaste dentro de la carpeta **`public\img\`**
con estos nombres exactos:

| archivo | qué es | dónde sale |
|---|---|---|
| `public\img\celeste.png` | la conejita con el nombre *Celeste Mira Rodríguez* | portada, como imagen principal |
| `public\img\flores.png` | el borde de flores acuarela (**fondo transparente**) | franja de flores del pie de página |
| `public\img\coneja.png` | *(opcional)* solo la conejita recortada, **sin fondo** | el personaje que camina por la pantalla |

- Sirven también `.jpg`, `.jpeg` o `.webp` (por ejemplo `celeste.jpg`).
- La de las flores **debe ser PNG con fondo transparente**, si no se verá un
  rectángulo blanco.
- No hay que tocar nada de código: refrescas la página (F5) y aparecen solas.
  Mientras no estén, se ven los dibujos de respaldo que hice.

## Base de datos

La base de datos vive en **Turso** (SQLite en la nube, gratis para este uso) y
no en un archivo local. Se hizo así porque el sitio quedó publicado en
**Vercel**, y Vercel no permite guardar archivos de forma permanente — cada
visita puede atender un servidor distinto y desechable, así que un archivo
`.db` local se perdería. Con Turso, tanto tu PC como el sitio en internet leen
y escriben **la misma base**, en tiempo real.

Las credenciales de conexión están en el archivo **`.env`** (no se sube a
GitHub, está en `.gitignore`). Ahí también vive el ejemplo sin datos:
`.env.example`.

```
TURSO_DATABASE_URL=libsql://babyshower-celeste-andresmira87.aws-us-east-1.turso.io
TURSO_AUTH_TOKEN=········  (token largo, no lo compartas)
CLAVE_ADMIN=celeste2026
```

Tablas:

| tabla | qué guarda |
|---|---|
| `confirmaciones` | quién confirma, teléfono, si asiste, mensaje, fecha |
| `invitados` | el nombre de **cada persona** de esa confirmación (adulto / niño) |
| `articulos` | la lista de regalos sacada del Excel |
| `reservas` | quién apartó cada regalo y cuándo |

Los artículos de una sola persona tienen un candado en la base
(`uniq_reserva_exclusiva`), así que **es imposible que dos personas aparten lo
mismo**, aunque le den clic al mismo tiempo desde dos celulares.

### Ver o administrar la base directamente (opcional)

Panel web de Turso: **https://app.turso.tech/andresmira87** → base
`babyshower-celeste`. Ahí puedes ver las tablas, correr consultas SQL a mano o
crear un respaldo. También existe la CLI (`turso db shell babyshower-celeste`)
si prefieres la terminal.

## Qué incluye la página

- Portada con el lazo, la ilustración de Celeste y los colores de la invitación.
- **Jardín de flores en el pie que se mece**: se aparta cuando pasas el cursor
  por el lado, se sacude en ola al hacer scroll y tiene una brisa suave constante.
- **La conejita salta por la pantalla** a medida que bajas: brinca de un punto a
  otro (16 posiciones repartidas por toda la pantalla), se estira en el aire, se
  achata al aterrizar, se voltea hacia donde salta y suelta corazoncitos al caer.
- **Lista de regalos** con los artículos del Excel, para que cada invitado aparte
  lo que va a llevar.
- Pétalos y corazones que suben flotando de vez en cuando.
- **Brillos dorados y rosados que siguen el cursor** en computador (en celular se
  desactivan solos para no gastar batería).
- Secciones que aparecen al bajar, cuenta regresiva al 10 de octubre de 2026 y
  botón al mapa de Google.
- Botón **Confirmar asistencia** con formulario para agregar **varias personas**
  (adultos y niños), teléfono y mensaje para la mamá.
- Funciona igual en celular y en computador.
- Si envías el enlace terminado en **`/#formulario`**, la página abre directo en
  el formulario de confirmación.

## El sitio ya está en internet

Está conectado a GitHub (**github.com/andresmira87/Celeste**) y cada vez que
subes un cambio a la rama `main`, **Vercel lo publica solo** en un par de
minutos. Ese es el enlace que le mandas a la familia — no `localhost`.

### Dejar la base de datos funcionando en Vercel (hazlo una sola vez)

El código ya está listo, pero Vercel no conoce todavía las credenciales de
Turso (viven en tu `.env`, que nunca se sube a GitHub por seguridad). Sin este
paso, el sitio publicado no podrá guardar confirmaciones ni regalos:

1. Entra a tu proyecto en **vercel.com** → pestaña **Settings → Environment
   Variables**.
2. Agrega estas tres, copiando los valores desde tu archivo `.env`:
   - `TURSO_DATABASE_URL`
   - `TURSO_AUTH_TOKEN`
   - `CLAVE_ADMIN`
3. Guarda y vuelve a desplegar (**Deployments → ⋯ → Redeploy**), o simplemente
   sube cualquier cambio nuevo a GitHub — con eso ya recoge las variables.

Después de eso, el panel de administración en internet
(`https://tu-sitio.vercel.app/admin.html`) muestra exactamente lo mismo que ves
en tu PC, porque los dos leen la misma base en Turso.

### Subir cambios

```
git add -A
git commit -m "lo que cambiaste"
git push
```

Vercel detecta el `push` y publica solo.

## Archivos

```
server.js        servidor web + API
db.js            conexión a Turso + todas las consultas
.env             credenciales de Turso (NO se sube a GitHub)
.env.example     mismo archivo, sin datos, como referencia
datos/
  articulos.json la lista de regalos sacada del Excel
public/
  index.html       la invitación
  estilos.css      diseño y colores
  app.js           brillos del cursor, jardín animado, cuenta regresiva, formulario, regalos
  admin.html       panel: confirmaciones + lista de regalos
  img/
    celeste.png    ← TU imagen de la conejita (ponla aquí)
    flores.png     ← TU borde de flores en PNG transparente (ponla aquí)
    flores-base.svg  flores de respaldo dibujadas
```
