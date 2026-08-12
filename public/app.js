/* ═══════════════════════════════════════════════
   Baby Shower · Celeste Mira Rodríguez
   ═══════════════════════════════════════════════ */
(() => {
  'use strict';

  const $  = (s, ctx = document) => ctx.querySelector(s);
  const $$ = (s, ctx = document) => [...ctx.querySelectorAll(s)];
  const menosMovimiento = matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* ───────── 1 · Brillos que siguen el cursor ───────── */
  (function brillos() {
    const canvas = $('#brillos');
    const finoEs = matchMedia('(pointer: fine)').matches;   // mouse de verdad, no dedo
    if (!canvas || !finoEs || menosMovimiento) { canvas?.remove(); return; }

    const ctx = canvas.getContext('2d');
    const colores = ['#e8b6b0', '#f2cfd0', '#d9a94f', '#c1766a', '#fbe6e3'];
    let particulas = [];
    let raton = { x: -100, y: -100 };
    let anterior = { x: -100, y: -100 };
    let dpr = 1;

    function medir() {
      dpr = Math.min(devicePixelRatio || 1, 2);
      canvas.width  = innerWidth  * dpr;
      canvas.height = innerHeight * dpr;
      canvas.style.width  = innerWidth + 'px';
      canvas.style.height = innerHeight + 'px';
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    }
    medir();
    addEventListener('resize', medir);

    function estrella(x, y, r, giro) {
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(giro);
      ctx.beginPath();
      for (let i = 0; i < 8; i++) {
        const ang = (Math.PI / 4) * i;
        const radio = i % 2 === 0 ? r : r * 0.38;
        ctx[i ? 'lineTo' : 'moveTo'](Math.cos(ang) * radio, Math.sin(ang) * radio);
      }
      ctx.closePath();
      ctx.fill();
      ctx.restore();
    }

    function nacer(x, y, cantidad) {
      for (let i = 0; i < cantidad; i++) {
        particulas.push({
          x: x + (Math.random() - .5) * 14,
          y: y + (Math.random() - .5) * 14,
          vx: (Math.random() - .5) * 1.1,
          vy: Math.random() * .9 + .25,
          r: Math.random() * 5 + 2.5,
          giro: Math.random() * Math.PI,
          vg: (Math.random() - .5) * .12,
          vida: 1,
          baja: Math.random() * .018 + .012,
          color: colores[(Math.random() * colores.length) | 0]
        });
      }
      if (particulas.length > 260) particulas = particulas.slice(-260);
    }

    addEventListener('pointermove', (e) => {
      if (e.pointerType !== 'mouse') return;
      raton = { x: e.clientX, y: e.clientY };
      const dist = Math.hypot(raton.x - anterior.x, raton.y - anterior.y);
      if (dist > 6) {
        nacer(raton.x, raton.y, dist > 40 ? 3 : 2);
        anterior = { ...raton };
      }
    }, { passive: true });

    addEventListener('pointerdown', (e) => {
      if (e.pointerType === 'mouse') nacer(e.clientX, e.clientY, 14);
    }, { passive: true });

    (function pintar() {
      ctx.clearRect(0, 0, innerWidth, innerHeight);
      for (const p of particulas) {
        p.x += p.vx; p.y += p.vy; p.vy += .012;
        p.giro += p.vg; p.vida -= p.baja;
        if (p.vida <= 0) continue;
        ctx.globalAlpha = Math.max(p.vida, 0);
        ctx.fillStyle = p.color;
        ctx.shadowBlur = 8; ctx.shadowColor = p.color;
        estrella(p.x, p.y, p.r * p.vida, p.giro);
      }
      ctx.globalAlpha = 1; ctx.shadowBlur = 0;
      particulas = particulas.filter((p) => p.vida > 0);
      requestAnimationFrame(pintar);
    })();
  })();

  /* ───────── 2 · Imágenes propias (si el usuario las copió a public/img) ───────── */
  function buscarImagen(rutas) {
    return new Promise((resolve) => {
      let i = 0;
      (function probar() {
        if (i >= rutas.length) return resolve(null);
        const img = new Image();
        img.onload = () => resolve({ src: rutas[i], w: img.naturalWidth, h: img.naturalHeight });
        img.onerror = () => { i++; probar(); };
        img.src = rutas[i];
      })();
    });
  }

  const ext = (n) => [`img/${n}.png`, `img/${n}.jpg`, `img/${n}.jpeg`, `img/${n}.webp`];

  // Retrato de Celeste en la portada
  (async () => {
    const fig = $('#retrato');
    if (!fig) return;
    const foto = await buscarImagen(ext('celeste'));
    if (!foto) return;                     // sin imagen se queda el dibujo de respaldo
    $('img', fig).src = foto.src;
    fig.hidden = false;
    $('#respaldoPortada').hidden = true;
  })();

  /* ───────── 3 · Jardín que se mece con el cursor y el scroll ───────── */
  (async function jardin() {
    const zona = $('#jardin');
    if (!zona) return;

    const flores = (await buscarImagen(ext('flores'))) ||
                   (await buscarImagen(['img/flores-base.svg']));
    if (!flores) { zona.remove(); return; }

    const viento = matchMedia('(pointer: fine)').matches && !menosMovimiento;
    let matas = [];
    let raton = { x: -9999, y: -9999 };
    let energia = 0;                       // empujón que deja el scroll
    let ultimoY = scrollY;
    let corriendo = false;

    function armar() {
      zona.textContent = '';
      matas = [];
      const alto = zona.clientHeight;
      const anchoImg = alto * (flores.w / flores.h);          // ancho de una repetición
      const rebanadas = Math.max(4, Math.round(anchoImg / 78));
      const ancho = anchoImg / rebanadas;
      const total = Math.ceil(innerWidth / ancho) + 1;

      for (let i = 0; i < total; i++) {
        const d = document.createElement('div');
        d.className = 'mata';
        d.style.width = ancho + 'px';
        d.style.left = i * ancho + 'px';
        d.style.backgroundImage = `url("${flores.src}")`;
        d.style.backgroundSize = `${anchoImg}px 100%`;
        d.style.backgroundPosition = `${-(i % rebanadas) * ancho}px bottom`;
        zona.appendChild(d);
        matas.push({ el: d, centro: i * ancho + ancho / 2, fase: i * 0.9, ang: 0, y: 0 });
      }
    }

    function paso(t) {
      const bandaTop = innerHeight - zona.clientHeight;
      let quieto = true;

      for (const m of matas) {
        let objAng = 0, objY = 0;

        // el cursor aparta las flores al pasar por el lado
        const dx = m.centro - raton.x;
        const dist = Math.abs(dx);
        const alcance = 190;
        if (dist < alcance) {
          const dy = raton.y - (bandaTop - 150);
          const vert = dy <= 0 ? 0 : Math.min(1, dy / 150);
          if (vert > 0) {
            objAng += Math.sin((dx / alcance) * Math.PI) * vert * 13;
            objY -= (1 - dist / alcance) * vert * 6;
          }
        }

        // el scroll las sacude en ola
        objAng += energia * (0.9 + Math.sin(m.fase) * 0.3);
        // brisa suave permanente (solo con mouse)
        if (viento) objAng += Math.sin(t * 0.0011 + m.fase) * 1.7;

        m.ang += (objAng - m.ang) * 0.12;
        m.y   += (objY   - m.y)   * 0.12;
        m.el.style.transform = `translateY(${m.y.toFixed(2)}px) rotate(${m.ang.toFixed(2)}deg)`;

        if (Math.abs(objAng - m.ang) > .04 || Math.abs(m.ang) > .04) quieto = false;
      }

      energia *= .9;
      if (Math.abs(energia) < .05) energia = 0;

      if (viento || !quieto || energia) requestAnimationFrame(paso);
      else corriendo = false;
    }

    function arrancar() {
      if (corriendo || menosMovimiento) return;
      corriendo = true;
      requestAnimationFrame(paso);
    }

    armar();
    arrancar();

    addEventListener('pointermove', (e) => { raton = { x: e.clientX, y: e.clientY }; arrancar(); }, { passive: true });
    addEventListener('pointerleave', () => { raton = { x: -9999, y: -9999 }; });
    addEventListener('scroll', () => {
      const d = scrollY - ultimoY;
      ultimoY = scrollY;
      energia = Math.max(-22, Math.min(22, energia + d * .32));
      arrancar();
    }, { passive: true });

    let reloj;
    addEventListener('resize', () => {
      clearTimeout(reloj);
      reloj = setTimeout(() => { armar(); arrancar(); }, 200);
    });
  })();

  /* ───────── 4 · Pétalos y corazones que flotan ───────── */
  const ADORNOS = ['💗', '🎀', '🌸', '🤍', '✨'];
  let flotando = 0;

  function soltarPetalo(x, y, tam = 16, subida = 120) {
    if (menosMovimiento || flotando > 14 || document.hidden) return;
    flotando++;
    const s = document.createElement('span');
    s.className = 'petalo-flota';
    s.textContent = ADORNOS[(Math.random() * ADORNOS.length) | 0];
    s.style.left = x + 'px';
    s.style.top = y + 'px';
    s.style.fontSize = tam + 'px';
    document.body.appendChild(s);
    s.animate(
      [
        { transform: 'translate(-50%, 0) scale(.6) rotate(0deg)', opacity: 0 },
        { transform: `translate(-50%, ${-subida * .45}px) scale(1) rotate(${(Math.random() - .5) * 40}deg)`, opacity: .95, offset: .35 },
        { transform: `translate(calc(-50% + ${(Math.random() - .5) * 70}px), ${-subida}px) scale(.7) rotate(${(Math.random() - .5) * 120}deg)`, opacity: 0 }
      ],
      { duration: 2400 + Math.random() * 1600, easing: 'cubic-bezier(.3,.6,.4,1)' }
    ).onfinish = () => { s.remove(); flotando--; };
  }

  /* ───────── 5 · La conejita salta por la pantalla con el scroll ───────── */
  (async function viajera() {
    const coneja = $('#viajera');
    if (!coneja) return;

    // si existe un recorte propio (public/img/coneja.png) se usa ese
    const propia = await buscarImagen(ext('coneja'));
    if (propia) coneja.innerHTML = `<img src="${propia.src}" alt="">`;

    // puntos por donde va saltando (fracción del ancho y del alto de la pantalla)
    const RUTA = [
      { x: .10, y: .74 }, { x: .34, y: .86 }, { x: .60, y: .70 }, { x: .84, y: .82 },
      { x: .90, y: .54 }, { x: .64, y: .42 }, { x: .38, y: .58 }, { x: .14, y: .46 },
      { x: .08, y: .72 }, { x: .36, y: .82 }, { x: .62, y: .60 }, { x: .88, y: .76 },
      { x: .68, y: .48 }, { x: .42, y: .70 }, { x: .18, y: .82 }, { x: .52, y: .88 }
    ];

    const angosto = () => innerWidth < 640;
    function punto(i) {
      const p = RUTA[Math.min(RUTA.length - 1, Math.max(0, i))];
      // en pantallas angostas se queda en la mitad de abajo, para no tapar el texto
      const fy = angosto() ? .58 + p.y * .38 : p.y;
      return {
        x: p.x * Math.max(1, innerWidth - coneja.offsetWidth),
        y: fy * Math.max(1, innerHeight - coneja.offsetHeight)
      };
    }

    let indice = 0;
    let pos = punto(0);
    let origen = { ...pos }, destino = { ...pos };
    let inicio = 0, duracion = 480, saltando = false, aterrizo = -9999;
    let mira = 1, objMira = 1, visible = false, corriendo = false;

    function pintar(t = 0) {
      let estiraY = 1, estiraX = 1, giro = 0;

      if (saltando) {
        const k = Math.min(1, (t - inicio) / duracion);
        const arco = Math.sin(k * Math.PI);
        pos.x = origen.x + (destino.x - origen.x) * k;
        pos.y = origen.y + (destino.y - origen.y) * k - arco * (70 + Math.abs(destino.x - origen.x) * .16);
        estiraY = 1 + arco * .16;
        estiraX = 1 - arco * .1;
        giro = Math.max(-14, Math.min(14, (destino.x - origen.x) * .05)) * arco;
        if (k >= 1) {
          saltando = false;
          aterrizo = t;
          const cx = pos.x + coneja.offsetWidth / 2;
          const cy = pos.y + coneja.offsetHeight * .85;
          soltarPetalo(cx - 12, cy, 13, 70);
          soltarPetalo(cx + 12, cy, 15, 80);
        }
      } else {
        // aterrizaje: se achata un momentico y luego respira
        const desde = t - aterrizo;
        if (desde < 260) {
          const g = 1 - desde / 260;
          estiraY = 1 - .18 * g * Math.cos(desde / 260 * Math.PI * 2);
          estiraX = 1 + .12 * g * Math.cos(desde / 260 * Math.PI * 2);
        } else {
          estiraY = 1 + Math.sin(t * .0028) * .022;
        }
      }

      mira += (objMira - mira) * .18;
      coneja.style.transform =
        `translate(${pos.x.toFixed(1)}px, ${pos.y.toFixed(1)}px) rotate(${giro.toFixed(2)}deg)` +
        ` scale(${(estiraX * mira).toFixed(3)}, ${estiraY.toFixed(3)})`;
    }

    function saltarA(i) {
      const meta = punto(i);
      origen = { x: pos.x, y: pos.y };
      destino = meta;
      duracion = 380 + Math.min(320, Math.abs(meta.x - origen.x) * .35);
      inicio = performance.now();
      saltando = true;
      if (Math.abs(meta.x - origen.x) > 8) objMira = meta.x > origen.x ? 1 : -1;
      arrancar();
    }

    function revisar() {
      const total = document.documentElement.scrollHeight - innerHeight;
      const p = total > 0 ? Math.min(1, Math.max(0, scrollY / total)) : 0;
      const meta = Math.round(p * (RUTA.length - 1));

      const debeVerse = scrollY > innerHeight * .45;
      if (debeVerse !== visible) {
        visible = debeVerse;
        coneja.classList.toggle('visible', visible);
        if (visible) arrancar();
      }

      if (meta !== indice) {
        indice = meta;
        if (menosMovimiento) { pos = punto(indice); pintar(); return; }
        saltarA(indice);
      }
    }

    function paso(t) {
      pintar(t);
      // sigue animando mientras salte, aterrice o esté a la vista (respiración)
      if (saltando || t - aterrizo < 300 || (visible && !document.hidden)) requestAnimationFrame(paso);
      else corriendo = false;
    }

    function arrancar() {
      if (corriendo || menosMovimiento) return;
      corriendo = true;
      requestAnimationFrame(paso);
    }

    pintar();
    revisar();
    addEventListener('scroll', revisar, { passive: true });
    addEventListener('resize', () => { pos = punto(indice); destino = { ...pos }; pintar(); });
    document.addEventListener('visibilitychange', () => { if (!document.hidden) arrancar(); });

    // brisa de pétalos de fondo, para que la página respire
    setInterval(() => {
      if (visible && !document.hidden && Math.random() < .7) {
        soltarPetalo(Math.random() * innerWidth, innerHeight - 40 - Math.random() * 60, 12 + Math.random() * 10, 160);
      }
    }, 2800);
  })();

  /* ───────── 6 · Aparición al hacer scroll ───────── */
  (function revelar() {
    const items = $$('.revelar');
    if (!('IntersectionObserver' in window)) { items.forEach((i) => i.classList.add('visible')); return; }

    const obs = new IntersectionObserver((entradas) => {
      entradas.forEach((e, i) => {
        if (!e.isIntersecting) return;
        setTimeout(() => e.target.classList.add('visible'), i * 110);
        obs.unobserve(e.target);
      });
    }, { threshold: .18, rootMargin: '0px 0px -8% 0px' });
    items.forEach((i) => obs.observe(i));

    // Red de seguridad: si algo quedó dentro de la pantalla y no se reveló, se muestra igual
    const revisar = () => items.forEach((el) => {
      const r = el.getBoundingClientRect();
      if (r.top < innerHeight * .95 && r.bottom > 0) el.classList.add('visible');
    });
    setTimeout(revisar, 1400);
    addEventListener('load', () => setTimeout(revisar, 400));
  })();

  /* ───────── 7 · Cuenta regresiva ───────── */
  (function cuenta() {
    const caja = $('#cuenta');
    if (!caja) return;
    const destino = new Date('2026-10-10T15:00:00-05:00').getTime();
    const campos = {
      dias:  $('[data-c=dias]',  caja),
      horas: $('[data-c=horas]', caja),
      min:   $('[data-c=min]',   caja),
      seg:   $('[data-c=seg]',   caja)
    };
    const dos = (n) => String(n).padStart(2, '0');

    (function tic() {
      const falta = destino - Date.now();
      if (falta <= 0) {
        caja.innerHTML = '<div style="min-width:auto;padding:14px 26px"><b>¡Hoy es el día!</b></div>';
        return;
      }
      const s = Math.floor(falta / 1000);
      campos.dias.textContent  = Math.floor(s / 86400);
      campos.horas.textContent = dos(Math.floor(s / 3600) % 24);
      campos.min.textContent   = dos(Math.floor(s / 60) % 60);
      campos.seg.textContent   = dos(s % 60);
      setTimeout(tic, 1000);
    })();
  })();

  /* ───────── 8 · Formulario de confirmación ───────── */
  const modal      = $('#modal');
  const formulario = $('#formulario');
  const lista      = $('#listaPersonas');
  const tpl        = $('#tplPersona');
  const cajaError  = $('#error');
  const gracias    = $('#gracias');
  const btnEnviar  = $('#btnEnviar');
  const bloquePers = $('#bloquePersonas');
  const campoNombre = $('#nombre');
  const CLAVE_LS = 'babyshower-celeste-confirmado';

  function agregarPersona(valor = '', foco = false) {
    const fila = tpl.content.firstElementChild.cloneNode(true);
    const input = $('.nombre-persona', fila);
    input.value = valor;
    $('.quitar', fila).addEventListener('click', () => {
      fila.remove();
      if (!lista.children.length) agregarPersona();
    });
    lista.appendChild(fila);
    if (foco) input.focus();
    return input;
  }

  function abrir() {
    modal.hidden = false;
    document.body.style.overflow = 'hidden';
    formulario.hidden = false;
    gracias.hidden = true;
    if (!lista.children.length) agregarPersona();
    setTimeout(() => campoNombre.focus(), 250);
  }

  function cerrar() {
    modal.hidden = true;
    document.body.style.overflow = '';
  }

  $('#btnAbrir')?.addEventListener('click', abrir);
  // Enlace directo al formulario:  .../#formulario
  if (location.hash === '#formulario') abrir();
  $('#btnOtra')?.addEventListener('click', () => {
    formulario.reset();
    lista.innerHTML = '';
    cajaError.hidden = true;
    bloquePers.hidden = false;
    abrir();
  });
  $$('[data-cerrar]').forEach((b) => b.addEventListener('click', cerrar));
  addEventListener('keydown', (e) => { if (e.key === 'Escape' && !modal.hidden) cerrar(); });
  $('#btnAgregar')?.addEventListener('click', () => agregarPersona('', true));

  // La primera persona se llena sola con el nombre de quien confirma
  campoNombre?.addEventListener('input', () => {
    const primera = $('.nombre-persona', lista);
    if (primera && !primera.dataset.tocado) primera.value = campoNombre.value;
  });
  lista.addEventListener('input', (e) => {
    if (e.target.classList.contains('nombre-persona')) e.target.dataset.tocado = '1';
  });

  // Mostrar u ocultar la lista según si asiste o no
  $$('input[name=asistira]').forEach((r) =>
    r.addEventListener('change', () => { bloquePers.hidden = r.value === 'no' && r.checked; })
  );

  formulario.addEventListener('submit', async (e) => {
    e.preventDefault();
    cajaError.hidden = true;

    const datos = new FormData(formulario);
    const nombre = (datos.get('nombre') || '').toString().trim();
    const asistira = datos.get('asistira') !== 'no';
    const invitados = $$('.persona', lista)
      .map((f) => ({
        nombre: $('.nombre-persona', f).value.trim(),
        tipo: $('.tipo-persona', f).value
      }))
      .filter((p) => p.nombre);

    if (!nombre) return mostrarError('Por favor escribe tu nombre.');
    if (asistira && !invitados.length) return mostrarError('Agrega al menos una persona que asistirá.');

    btnEnviar.disabled = true;
    btnEnviar.textContent = 'Enviando…';
    try {
      const r = await fetch('/api/confirmar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          nombre,
          telefono: (datos.get('telefono') || '').toString().trim(),
          mensaje: (datos.get('mensaje') || '').toString().trim(),
          asistira,
          invitados: asistira ? invitados : []
        })
      });
      const res = await r.json();
      if (!r.ok || !res.ok) throw new Error(res.error || 'Error al guardar');

      localStorage.setItem(CLAVE_LS, nombre);
      formulario.hidden = true;
      gracias.hidden = false;
      $('#textoGracias').innerHTML = asistira
        ? `Te esperamos el <b>sábado 10 de octubre</b> a las 3:00 pm.<br>Quedaron registradas <b>${res.personas}</b> persona${res.personas === 1 ? '' : 's'}.`
        : 'Gracias por avisarnos. Te vamos a extrañar 💗';
      marcarConfirmado();
      cargarResumen();
      lluviaDeCorazones();
    } catch (err) {
      mostrarError(err.message || 'No pudimos guardar tu confirmación. Intenta de nuevo.');
    } finally {
      btnEnviar.disabled = false;
      btnEnviar.textContent = 'Enviar confirmación';
    }
  });

  function mostrarError(txt) {
    cajaError.textContent = txt;
    cajaError.hidden = false;
    cajaError.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  }

  function marcarConfirmado() {
    if (!localStorage.getItem(CLAVE_LS)) return;
    $('#yaConfirmado').hidden = false;
  }
  marcarConfirmado();

  async function cargarResumen() {
    try {
      const r = await fetch('/api/resumen');
      const d = await r.json();
      if (d.ok && d.personas > 0) {
        const p = $('#contadorPersonas');
        p.textContent = `Ya hay ${d.personas} persona${d.personas === 1 ? '' : 's'} confirmada${d.personas === 1 ? '' : 's'} 🎀`;
        p.hidden = false;
      }
    } catch { /* sin conexión: no pasa nada */ }
  }
  cargarResumen();

  /* ───────── 9 · Lista de regalos ───────── */
  (function regalos() {
    const pestanas = $('#pestanasRegalos');
    const rejilla  = $('#rejillaRegalos');
    const modalReg = $('#modalRegalo');
    if (!pestanas || !rejilla) return;

    const MIS_REGALOS = 'babyshower-celeste-regalos';
    let grupos = [];
    let activo = 0;
    let elegido = null;

    const mios = () => { try { return JSON.parse(localStorage.getItem(MIS_REGALOS)) || []; } catch { return []; } };
    const guardarMio = (id) => localStorage.setItem(MIS_REGALOS, JSON.stringify([...new Set([...mios(), id])]));

    const escapar = (t) => String(t ?? '').replace(/[&<>"']/g, (m) =>
      ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[m]));

    function pintarPestanas() {
      pestanas.innerHTML = grupos.map((g, i) => {
        const libres = g.articulos.filter((a) => !a.tomado).length;
        return `<button type="button" class="pestana ${i === activo ? 'activa' : ''}" data-i="${i}">
                  ${g.icono} ${escapar(g.titulo)} <small>${libres}</small>
                </button>`;
      }).join('');
    }

    function pintarArticulos() {
      const g = grupos[activo];
      if (!g) return;
      const propios = mios();

      rejilla.innerHTML = g.articulos.map((a) => {
        const gente = a.personas.map((p) => escapar(p.nombre)).join(', ');
        const esMio = propios.includes(a.id);
        let estado, quien = '';

        if (a.tomado) {
          estado = 'Ya lo llevan';
          quien = `<span class="quien">${gente}</span>`;
        } else if (a.varios) {
          estado = a.personas.length ? `Lo llevan ${a.personas.length}` : 'Yo lo llevo →';
          if (gente) quien = `<span class="quien">${gente}</span>`;
        } else {
          estado = 'Yo lo llevo →';
        }

        return `<button type="button" class="regalo ${a.tomado ? 'ocupado' : ''} ${esMio ? 'mio' : ''}"
                        data-id="${a.id}" ${a.tomado ? 'disabled' : ''}>
                  <span class="nombre">${escapar(a.nombre)}</span>
                  <span class="estado">${estado}</span>
                  ${quien}
                </button>`;
      }).join('');
    }

    async function cargar() {
      try {
        const r = await fetch('/api/lista');
        const d = await r.json();
        if (!d.ok) return;
        grupos = d.grupos;
        pintarPestanas();
        pintarArticulos();
      } catch { /* sin conexión */ }
    }

    pestanas.addEventListener('click', (e) => {
      const b = e.target.closest('.pestana');
      if (!b) return;
      activo = +b.dataset.i;
      pintarPestanas();
      pintarArticulos();
    });

    rejilla.addEventListener('click', (e) => {
      const b = e.target.closest('.regalo');
      if (!b || b.disabled) return;
      const id = +b.dataset.id;
      elegido = grupos[activo].articulos.find((a) => a.id === id);
      if (!elegido) return;

      $('#regaloElegido').textContent = elegido.nombre;
      $('#errorRegalo').hidden = true;
      const guardado = localStorage.getItem('babyshower-celeste-confirmado') || '';
      $('#nombreRegalo').value = guardado;
      modalReg.hidden = false;
      document.body.style.overflow = 'hidden';
      setTimeout(() => $('#nombreRegalo').focus(), 250);
    });

    function cerrarRegalo() {
      modalReg.hidden = true;
      document.body.style.overflow = '';
    }
    $$('[data-cerrar-regalo]').forEach((b) => b.addEventListener('click', cerrarRegalo));
    addEventListener('keydown', (e) => { if (e.key === 'Escape' && !modalReg.hidden) cerrarRegalo(); });

    $('#formRegalo').addEventListener('submit', async (e) => {
      e.preventDefault();
      const nombre = $('#nombreRegalo').value.trim();
      const err = $('#errorRegalo');
      err.hidden = true;

      if (!nombre) { err.textContent = 'Escribe tu nombre.'; err.hidden = false; return; }

      const btn = $('#btnApartar');
      btn.disabled = true;
      btn.textContent = 'Apartando…';
      try {
        const r = await fetch('/api/reservar', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ articuloId: elegido.id, nombre })
        });
        const d = await r.json();
        if (!d.ok) {
          if (d.grupos) { grupos = d.grupos; pintarPestanas(); pintarArticulos(); }
          err.textContent = d.error || 'No se pudo apartar.';
          err.hidden = false;
          if (d.ocupado) await cargar();
          return;
        }
        guardarMio(elegido.id);
        grupos = d.grupos;
        pintarPestanas();
        pintarArticulos();
        cerrarRegalo();
        lluviaDeCorazones();
      } catch {
        err.textContent = 'No pudimos apartarlo. Intenta de nuevo.';
        err.hidden = false;
      } finally {
        btn.disabled = false;
        btn.textContent = 'Apartar este regalo';
      }
    });

    cargar();
  })();

  /* ───────── 10 · Corazones al confirmar ───────── */
  function lluviaDeCorazones() {
    if (menosMovimiento) return;
    const emojis = ['💗', '🎀', '🌸', '✨', '🤍'];
    for (let i = 0; i < 26; i++) {
      const s = document.createElement('span');
      s.textContent = emojis[(Math.random() * emojis.length) | 0];
      s.style.cssText = `position:fixed;z-index:10000;pointer-events:none;left:${Math.random() * 100}vw;top:-40px;font-size:${14 + Math.random() * 20}px;opacity:.95`;
      document.body.appendChild(s);
      const dur = 2600 + Math.random() * 2200;
      s.animate(
        [
          { transform: 'translateY(0) rotate(0deg)', opacity: 1 },
          { transform: `translateY(105vh) rotate(${(Math.random() - .5) * 720}deg)`, opacity: 0 }
        ],
        { duration: dur, easing: 'cubic-bezier(.3,.1,.5,1)' }
      ).onfinish = () => s.remove();
    }
  }
})();
