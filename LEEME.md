# Baby Shower · Celeste Mira Rodríguez 🎀

Invitación web con confirmación de asistencia guardada en base de datos.

## Cómo encenderla

Doble clic en **`INICIAR.bat`** (o en una terminal: `node server.js`).

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

Para cambiar la clave, enciende así:

```
set CLAVE_ADMIN=miclave && node server.js
```

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

No hubo que instalar nada: **Node 24 trae SQLite incluido** (`node:sqlite`),
así que el proyecto tiene **cero dependencias**.

Los datos quedan en el archivo **`babyshower.db`** (junto a `server.js`).
Ese archivo es la copia de seguridad: guárdalo y no lo borres.

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

## Ponerla en internet (opcional)

Como es Node puro, sirve cualquier hosting de Node (Render, Railway, Fly.io) o
un túnel rápido desde este PC:

```
npx localtunnel --port 3000
```

Eso te da un enlace público temporal para enviar por WhatsApp.

## Archivos

```
server.js        servidor web + API
db.js            base de datos SQLite
babyshower.db    los datos (se crea solo al iniciar)
datos/
  articulos.json la lista de regalos sacada del Excel
public/
  index.html       la invitación
  estilos.css      diseño y colores
  app.js           brillos del cursor, jardín animado, cuenta regresiva, formulario
  admin.html       lista de confirmados
  img/
    celeste.png    ← TU imagen de la conejita (ponla aquí)
    flores.png     ← TU borde de flores en PNG transparente (ponla aquí)
    flores-base.svg  flores de respaldo dibujadas
```
