(() => {
  "use strict";
  document.documentElement.classList.add("js");

  const D = window.PLAYZONE; // datos de ejemplo; con la API se pisan con los de la planilla
  const { F } = window.PZ;
  const api = window.PZ.crearBackend(D);

  const $ = (s, el = document) => el.querySelector(s);
  const $$ = (s, el = document) => [...el.querySelectorAll(s)];
  const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

  const localById = (id) => D.locales.find((l) => l.id === id) || { nombre: id, direccion: "", mapa: "" };
  const barberById = (id) => D.barberos.find((b) => b.id === id);
  const money = (n) => (n > 0 ? "$" + Number(n).toLocaleString("es-AR") : null);
  const precio = (s) => money(s.precio) || (window.PLAYZONE_API ? "Consultar" : "[Precio]");
  const montoSeña = (s) => (D.seña.tipo === "fijo" ? D.seña.valor : Math.round((s.precio * D.seña.valor) / 100));
  const FT = window.PZFotos;
  const fotos = () => D.fotos || { portada: [], barberos: {}, locales: {}, recientes: [], antesDespues: [] };
  const fotosDe = (nombre) => fotos().barberos[nombre] || { perfil: null, cortes: [], antesDespues: [] };
  const fotoPrincipal = (nombre) => { const f = fotosDe(nombre); return f.perfil || f.cortes.find((x) => !FT.esVideo(x)) || null; };
  const igLink = (u) => (/^https?:/.test(u) ? u : "https://instagram.com/" + String(u || "").replace(/^@/, ""));

  /* ================= Datos ================= */
  /*
   * Los datos de la planilla llegan de tres lugares, del más rápido al más nuevo:
   * 1) la "foto" que tools/generar-seo.py deja dentro del HTML, 2) lo guardado en la visita anterior,
   * 3) la planilla en vivo. Se muestra lo primero que haya y se actualiza cuando llega lo nuevo.
   */
  const CACHE = "pz_datos_v1";
  function leerSnapshot() {
    const el = document.getElementById("pz-datos");
    if (!el) return null;
    try { return JSON.parse(el.textContent); } catch { return null; }
  }
  function leerCache() {
    try { return JSON.parse(localStorage.getItem(CACHE) || "null"); } catch { return null; }
  }
  function guardarCache(d) {
    try { localStorage.setItem(CACHE, JSON.stringify({ t: Date.now(), d })); } catch { /* sin lugar: no pasa nada */ }
  }

  async function cargarDatos() {
    try { return await api.datos(); }
    catch (e) { console.error("No se pudieron cargar los datos de la planilla", e); return null; }
  }

  function aplicarDatos(r, fresco) {
    {
      const n = r.negocio;
      D.negocio = {
        ...D.negocio,
        nombre: n.nombre || D.negocio.nombre,
        instagram: n.instagram || D.negocio.instagram,
        whatsapp: n.whatsapp || D.negocio.whatsapp,
        historia: n.historia || D.negocio.historia,
        google: { rating: n.google.rating || D.negocio.google.rating, reseñas: n.google.reseñas || D.negocio.google.reseñas },
      };
      Object.assign(D, {
        seña: r.seña, cancelacionHoras: r.cancelacionHoras, minutosReserva: r.minutosReserva,
        diasReserva: r.diasReserva, hoy: fresco ? r.hoy : undefined, locales: r.locales, barberos: r.barberos, servicios: r.servicios, fotos: r.fotos,
      });
    }
  }

  /* ================= Contenido de la página ================= */
  function renderSite() {
    const F0 = fotos();
    if (F0.portada && F0.portada[0]) {
      const h = $(".hero__photo");
      h.classList.add("ph--foto");
      h.innerHTML = FT.img(F0.portada[0], 1200, "Playzone Barber");
      const im = $("img", h);
      im.loading = "eager";
      im.setAttribute("fetchpriority", "high");
    }
    const fotoLocal = D.locales.map((l) => (F0.locales[l.nombre] || []).find((x) => !FT.esVideo(x))).find(Boolean);
    if (fotoLocal) {
      const st = $(".story__photo");
      st.classList.add("ph--foto");
      st.innerHTML = FT.img(fotoLocal, 1000, "El local");
    }
    $("#heroLocales").textContent = D.locales.map((l) => l.nombre).join(" · ");
    $("#h1Marca").textContent = `${D.negocio.nombre || "Playzone Barber"}, barbería. `;
    $("#heroRating").textContent = `★★★★★ ${D.negocio.google.rating} en Google` + (D.negocio.google.reseñas ? ` · ${D.negocio.google.reseñas} reseñas` : "");
    $("#historia").textContent = D.negocio.historia;
    $("#senaTexto").textContent = `Pedimos una seña que se descuenta del precio del corte. Si no podés venir, reprogramá o cancelá desde el mail de confirmación hasta ${D.cancelacionHoras} h antes y no la perdés.`;
    $("#lnkInstagram").href = D.negocio.instagram;
    $("#lnkWhatsapp").href = D.negocio.whatsapp;

    $("#barbersGrid").innerHTML = D.barberos
      .map(
        (b) => `
      <article class="barber">
        ${fotoPrincipal(b.nombre)
          ? `<button type="button" class="ph ph--foto barber__photo" data-perfil="${esc(b.id)}" aria-label="Ver perfil de ${esc(b.nombre)}">${FT.img(fotoPrincipal(b.nombre), 600, b.nombre)}</button>`
          : `<div class="ph barber__photo"><span>[Foto]</span></div>`}
        <h3 class="barber__name">${esc(b.nombre)}</h3>
        <p class="barber__spec">${esc(b.especialidad)}</p>
        <p class="barber__local">${esc(localById(b.local).nombre)}</p>
        <div class="barber__btns">
          <button class="btn btn--outline btn--xs" data-perfil="${esc(b.id)}">Ver perfil</button>
          <button class="btn btn--dark btn--xs btn-cut" data-reservar="${esc(b.id)}">Reservar</button>
        </div>
      </article>`
      )
      .join("");

    $("#servicesGrid").innerHTML = D.servicios
      .map(
        (s) => `
      <div class="service">
        <div><div class="service__name">${esc(s.nombre)}</div><div class="service__dur">${s.duracion} min</div></div>
        <div class="service__price">${esc(precio(s))}</div>
      </div>`
      )
      .join("");

    const rec = F0.recientes || [];
    if (rec.length) {
      FT.grupo("recientes", rec.map((r) => r.id));
      const items = rec.map((r, i) => FT.miniatura(r.id, { alt: "Corte de " + r.b, pie: r.b, grupo: "recientes", i }));
      (F0.antesDespues || []).forEach((p, k) => items.splice(1 + k * 4, 0, FT.antesDespues(p.a, p.d, p.b)));
      $("#galleryGrid").innerHTML = items.slice(0, 8).join("");
    } else $("#galleryGrid").innerHTML = D.galeria
      .map((g) =>
        g.antesDespues
          ? `<div class="ba" style="--pos:50%">
              <div class="ba__layer ba__before">Antes</div>
              <div class="ba__layer ba__after">Después</div>
              <div class="ba__handle"></div>
              <input type="range" min="0" max="100" value="50" aria-label="Comparar antes y después" />
            </div>`
          : `<div class="ph"><span>${esc(g.texto)}</span></div>`
      )
      .join("");
    FT.activarComparadores();

    $("#localesGrid").innerHTML = D.locales
      .map((l) => {
        const team = D.barberos.filter((b) => b.local === l.id).map((b) => b.nombre);
        const media = F0.locales[l.nombre] || [];
        if (media.length) FT.grupo("local:" + l.id, media);
        const conDireccion = l.direccion && !/\[/.test(l.direccion);
        const mapa = conDireccion
          ? `<div class="ph ph--foto local__map"><iframe title="Mapa de ${esc(l.nombre)}" loading="lazy" referrerpolicy="no-referrer-when-downgrade" src="https://www.google.com/maps?q=${encodeURIComponent(l.direccion)}&output=embed"></iframe></div>`
          : `<div class="ph local__map"><span>[Mapa de Google]</span></div>`;
        return `
      <article class="local">
        ${mapa}
        <div class="local__body">
          <h3>${esc(l.nombre)}</h3>
          <p class="local__tel">${/\d{6}/.test(String(l.telefono).replace(/\D/g, "")) ? `<a href="tel:${esc(String(l.telefono).replace(/[^\d+]/g, ""))}">${esc(l.telefono)}</a>` : esc(l.telefono)}</p>
          <p>${esc(l.direccion)}</p>
          <p>${esc(l.horarioTexto)}</p>
          ${team.length ? `<p class="local__team">Atienden ${esc(team.join(" y "))}</p>` : ""}
          <div class="local__btns">
            <a class="btn btn--outline btn--xs" href="${esc(l.mapa || "#")}" target="_blank" rel="noopener">Cómo llegar</a>
            ${media.length ? `<button type="button" class="btn btn--outline btn--xs" data-grupo="local:${esc(l.id)}" data-i="0">Fotos del local${media.some(FT.esVideo) ? " y videos" : ""}</button>` : api.demo ? `<button class="btn btn--outline btn--xs">Fotos del local</button>` : ""}
          </div>
        </div>
      </article>`;
      })
      .join("");

    $("#reviewsGrid").innerHTML = D.reseñas
      .map(
        (r) => `
      <figure class="review">
        <div class="review__stars">★★★★★</div>
        <blockquote class="review__text">${esc(r.texto)}</blockquote>
        <figcaption class="review__author">${esc(r.autor)}</figcaption>
      </figure>`
      )
      .join("");
  }

  /* ================= Efectos ================= */
  const loader = $("#loader");
  const hideLoader = () => loader.classList.add("is-done");

  // Títulos con efecto navaja
  const io = new IntersectionObserver(
    (entries) => entries.forEach((e) => {
      if (e.isIntersecting) { e.target.classList.add("is-cut"); io.unobserve(e.target); }
    }),
    { threshold: 0.4 }
  );

  // Nav con borde al scrollear + botón fijo en celular
  const nav = $("#nav");
  const sticky = $(".sticky-cta");
  const hero = $(".hero__ctas");
  window.addEventListener("scroll", () => {
    nav.classList.toggle("is-scrolled", scrollY > 8);
    sticky.classList.toggle("is-visible", hero.getBoundingClientRect().bottom < 0);
  }, { passive: true });

  // Botón que se corta al tocarlo (rápido: no demora la reserva)
  function cutButton(btn, done) {
    if (matchMedia("(prefers-reduced-motion: reduce)").matches) return done();
    const cs = getComputedStyle(btn);
    ["top", "bot"].forEach((k) => {
      const h = document.createElement("span");
      h.className = "cut-half cut-half--" + k;
      h.textContent = btn.textContent.trim();
      h.style.background = cs.backgroundColor;
      h.style.color = cs.color;
      h.style.border = `1px solid ${cs.borderColor}`;
      btn.appendChild(h);
    });
    btn.classList.add("is-cutting");
    setTimeout(done, 260);
    setTimeout(() => {
      btn.classList.remove("is-cutting");
      $$(".cut-half", btn).forEach((h) => h.remove());
    }, 460);
  }

  /* ================= Hojas (modales) ================= */
  function openSheet(el) {
    el.hidden = false;
    document.body.classList.add("lock");
  }
  function closeSheet(el) {
    if (el.id === "bookingSheet") onBookingClose();
    el.hidden = true;
    if (!$$(".sheet").some((s) => !s.hidden)) document.body.classList.remove("lock");
  }
  $$(".sheet").forEach((s) => {
    s.addEventListener("click", (e) => {
      if (e.target === s || e.target.closest("[data-close]")) { e.preventDefault(); closeSheet(s); }
    });
  });
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") $$(".sheet").filter((s) => !s.hidden).forEach(closeSheet);
  });

  document.addEventListener("click", (e) => {
    const r = e.target.closest("[data-reservar]");
    if (r) {
      e.preventDefault();
      const id = r.dataset.reservar || null;
      const go = () => startBooking(id);
      r.classList.contains("btn-cut") ? cutButton(r, go) : go();
      return;
    }
    const p = e.target.closest("[data-perfil]");
    if (p) openProfile(p.dataset.perfil);
  });

  /* ================= Perfil del barbero ================= */
  const profileSheet = $("#profileSheet");
  function openProfile(id) {
    const b = barberById(id);
    const l = localById(b.local);
    const meta = [l.nombre, b.dias, b.experiencia].filter(Boolean).map(esc).join(" · ");
    const fb = fotosDe(b.nombre);
    const principal = fotoPrincipal(b.nombre);
    const galeria = fb.cortes.filter((x) => x !== principal);
    FT.grupo("perfil", galeria);
    $("#profileBody").innerHTML = `
      ${principal ? `<div class="ph ph--foto profile__photo">${FT.img(principal, 900, b.nombre)}</div>` : `<div class="ph profile__photo"><span>[Foto del barbero trabajando]</span></div>`}
      <div class="profile">
        <h2 class="title"><em>${esc(b.especialidad)}</em> <strong>${esc(b.nombre)}</strong></h2>
        <p class="profile__meta">${meta}</p>
        <p class="profile__desc">${esc(b.descripcion)}</p>
        <div class="profile__socials">
          ${b.instagram ? `<a class="btn btn--outline btn--xs" href="${esc(igLink(b.instagram))}" target="_blank" rel="noopener">Instagram ${esc(b.instagram)}</a>` : ""}
          ${b.tiktok ? `<a class="btn btn--outline btn--xs" href="${esc(b.tiktok)}" target="_blank" rel="noopener">TikTok</a>` : ""}
        </div>
        <h3 class="title"><em>Sus</em> <strong>Cortes</strong></h3>
        ${fb.antesDespues.map((p) => FT.antesDespues(p[0], p[1])).join("")}
        <div class="profile__gallery">
          ${galeria.length
            ? galeria.map((x, i) => FT.miniatura(x, { ancho: 500, alt: "Corte de " + b.nombre, grupo: "perfil", i })).join("")
            : fb.antesDespues.length ? "" : [1, 2, 3, 4].map((n) => `<div class="ph"><span>[Corte ${n}]</span></div>`).join("")}
        </div>
      </div>`;
    FT.activarComparadores($("#profileBody"));
    const btn = $("#profileBook");
    btn.textContent = `Reservar con ${b.nombre}`;
    btn.onclick = () => { closeSheet(profileSheet); startBooking(id); };
    openSheet(profileSheet);
    $(".sheet__body", profileSheet).scrollTop = 0;
  }

  /* ================= Reserva paso a paso ================= */
  const bookingSheet = $("#bookingSheet");
  const ANY = "any";
  const P = { BARBERO: 0, SERVICIO: 1, HORARIO: 2, DATOS: 3, SENA: 4, LISTO: 5, VERIFICANDO: 6, GESTIONAR: 7, ERROR_PAGO: 8 };
  let bk;
  let timer = null;

  const STEPS = {
    [P.BARBERO]: { label: "Paso 1 de 4", em: "Elegí tu", strong: "Barbero", bar: 1 },
    [P.SERVICIO]: { label: "Paso 2 de 4", em: "Elegí el", strong: "Servicio", bar: 2 },
    [P.HORARIO]: { label: "Paso 3 de 4", em: "Elegí día y", strong: "Horario", bar: 3 },
    [P.DATOS]: { label: "Paso 4 de 4", em: "Completá tus", strong: "Datos", bar: 4 },
    [P.SENA]: { label: "Paso 4 de 4", em: "Confirmá y pagá la", strong: "Seña", bar: 4 },
    [P.LISTO]: { label: "Reserva", em: "¡Turno", strong: "Confirmado!", bar: 4 },
    [P.VERIFICANDO]: { label: "Reserva", em: "Un momento,", strong: "Verificando", bar: 4 },
    [P.GESTIONAR]: { label: "Tu turno", em: "Reprogramá o", strong: "Cancelá", bar: 0 },
    [P.ERROR_PAGO]: { label: "Reserva", em: "No se completó", strong: "El pago", bar: 0 },
  };

  function nuevoEstado(extra) {
    return { step: P.BARBERO, barber: null, service: null, fecha: null, hora: null, client: {}, reserva: null, aviso: "", ...extra };
  }

  function startBooking(barberId) {
    bk = nuevoEstado({ step: barberId ? P.SERVICIO : P.BARBERO, barber: barberId });
    renderStep();
    openSheet(bookingSheet);
  }

  // Si cierran la hoja con una reserva sin pagar, se libera el horario
  function onBookingClose() {
    stopTimer();
    if (bk && bk.step === P.SENA && bk.reserva) liberarReserva();
  }
  function liberarReserva() {
    const r = bk.reserva;
    bk.reserva = null;
    if (r) api.liberar({ id: r.turno.id, t: r.token }).catch(() => {});
  }

  const hoy = () => D.hoy || F.hoy();

  function diasDisponibles() {
    const cand = bk.barber === ANY || !bk.barber ? D.barberos : [barberById(bk.barber)];
    const abiertos = new Set(cand.flatMap((b) => b.diasAtiende || localById(b.local).diasAbierto || []));
    const out = [];
    const max = D.diasReserva || 14;
    for (let i = 0; i <= max && out.length < 14; i++) {
      const f = F.sumar(hoy(), i);
      if (abiertos.has(F.dia(f))) out.push(f);
    }
    return out;
  }

  const DOW = ["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"];
  const diaCorto = (f) => (f === hoy() ? "Hoy" : DOW[F.dia(f)]);

  function renderStep() {
    const s = STEPS[bk.step];
    $("#bkStepLabel").textContent = s.label.toUpperCase();
    let em = s.em, strong = s.strong;
    if (bk.step === P.LISTO && bk.reprogramado) { em = "¡Turno"; strong = "Reprogramado!"; }
    if (bk.step === P.LISTO && bk.cancelado) { em = "Turno"; strong = "Cancelado"; }
    if (bk.step === P.HORARIO && bk.modo === "reprogramar") { em = "Elegí el nuevo"; strong = "Horario"; }
    $("#bkTitle").innerHTML = `<em>${esc(em)}</em> <strong>${esc(strong)}</strong>`;
    $$("#bkProgress span").forEach((el, i) => el.classList.toggle("on", i < s.bar));
    $("#bkProgress").style.visibility = s.bar ? "visible" : "hidden";
    const puedeVolver = [P.SERVICIO, P.HORARIO, P.DATOS, P.SENA].includes(bk.step) && !(bk.step === P.SERVICIO && bk.fijo);
    $("#bkBack").style.visibility = puedeVolver ? "visible" : "hidden";
    const body = $("#bkBody");
    const next = $("#bkNext");
    next.parentElement.hidden = false;
    next.disabled = false;
    next.onclick = null; // algunos pasos le ponen una acción propia
    next.textContent = "Continuar";
    const render = {
      [P.BARBERO]: renderBarber, [P.SERVICIO]: renderService, [P.HORARIO]: renderDate, [P.DATOS]: renderData,
      [P.SENA]: renderPay, [P.LISTO]: renderDone, [P.VERIFICANDO]: renderVerificando, [P.GESTIONAR]: renderGestionar,
      [P.ERROR_PAGO]: renderErrorPago,
    }[bk.step];
    render(body, next);
    body.scrollTop = 0;
  }

  function avisoHtml() {
    if (!bk.aviso) return "";
    const a = `<div class="bk-alert" role="alert">${esc(bk.aviso)}</div>`;
    bk.aviso = "";
    return a;
  }

  function choiceList(items, selected) {
    return items
      .map(
        (it) => `<button class="choice ${it.id === selected ? "is-on" : ""}" data-id="${esc(it.id)}">
          ${it.avatar !== undefined ? `<span class="choice__avatar">${esc(it.avatar)}</span>` : ""}
          <span class="choice__main"><span class="choice__title">${esc(it.title)}</span><span class="choice__sub">${esc(it.sub)}</span></span>
          ${it.right ? `<span class="${it.rightClass}">${esc(it.right)}</span>` : ""}
        </button>`
      )
      .join("");
  }
  function bindChoices(body, key) {
    $$(".choice", body).forEach((c) =>
      c.addEventListener("click", () => {
        bk[key] = c.dataset.id;
        $$(".choice", body).forEach((x) => x.classList.toggle("is-on", x === c));
        $("#bkNext").disabled = false;
      })
    );
  }

  function renderBarber(body, next) {
    const items = D.barberos.map((b, i) => ({ id: b.id, avatar: "B" + (i + 1), title: b.nombre, sub: localById(b.local).nombre }));
    items.push({ id: ANY, avatar: "?", title: "Cualquier barbero", sub: "El primero disponible" });
    body.innerHTML = choiceList(items, bk.barber);
    bindChoices(body, "barber");
    next.disabled = !bk.barber;
  }

  function renderService(body, next) {
    const b = barberById(bk.barber);
    const who = bk.barber === ANY ? "Cualquier barbero" : `${b.nombre} · ${localById(b.local).nombre}`;
    const items = D.servicios.map((s) => ({ id: s.id, title: s.nombre, sub: s.duracion + " min", right: precio(s), rightClass: "choice__price" }));
    body.innerHTML = `<p class="bk-hint">Con ${esc(who)}</p>` + choiceList(items, bk.service);
    bindChoices(body, "service");
    next.disabled = !bk.service;
  }

  let pedidoHorarios = 0;
  function renderDate(body, next) {
    const dias = diasDisponibles();
    if (!bk.fecha || !dias.includes(bk.fecha)) bk.fecha = dias[0];
    const who = bk.barber === ANY ? "cualquier barbero" : barberById(bk.barber).nombre;
    body.innerHTML = `
      ${avisoHtml()}
      <div class="days">${dias
        .map((f) => `<button class="day ${f === bk.fecha ? "is-on" : ""}" data-f="${f}"><small>${diaCorto(f)}</small><b>${F.num(f)}</b></button>`)
        .join("")}</div>
      <p class="bk-hint">Horarios disponibles con ${esc(who)}</p>
      <div id="bkSlots"><div class="bk-loading">Buscando horarios libres…</div></div>
      <p class="bk-note">Los horarios tachados ya están tomados, también los que el barbero anotó por WhatsApp.</p>`;
    $$(".day", body).forEach((b) =>
      b.addEventListener("click", () => {
        bk.fecha = b.dataset.f;
        bk.hora = null;
        $$(".day", body).forEach((x) => x.classList.toggle("is-on", x === b));
        cargarHorarios(next);
      })
    );
    next.textContent = bk.modo === "reprogramar" ? "Confirmar el cambio" : "Continuar";
    cargarHorarios(next);
  }

  async function cargarHorarios(next) {
    const cont = $("#bkSlots");
    const id = ++pedidoHorarios;
    next.disabled = true;
    cont.innerHTML = `<div class="bk-loading">Buscando horarios libres…</div>`;
    let slots;
    try {
      const p = { barbero: bk.barber === ANY ? "" : bk.barber, servicio: bk.service, fecha: bk.fecha };
      if (bk.modo === "reprogramar") { p.turno = bk.gestion.id; p.t = bk.gestion.t; }
      slots = await api.horarios(p);
    } catch (e) {
      if (id === pedidoHorarios) cont.innerHTML = `<div class="bk-empty">${esc(e.message)}</div>`;
      return;
    }
    if (id !== pedidoHorarios) return; // llegó la respuesta de otro día
    if (!slots.length) {
      cont.innerHTML = `<div class="bk-empty">No quedan horarios libres este día. Probá con otro.</div>`;
      return;
    }
    cont.innerHTML = `<div class="slots">${slots
      .map((s) => `<button class="slot ${bk.hora === s.hora ? "is-on" : ""}" data-t="${s.hora}" ${s.libre ? "" : "disabled"}>${s.hora}</button>`)
      .join("")}</div>`;
    $$(".slot:not([disabled])", cont).forEach((b) =>
      b.addEventListener("click", () => {
        bk.hora = b.dataset.t;
        $$(".slot", cont).forEach((x) => x.classList.toggle("is-on", x === b));
        next.disabled = false;
      })
    );
    next.disabled = !(bk.hora && slots.some((s) => s.hora === bk.hora && s.libre));
  }

  const phoneKey = (p) => p.replace(/\D/g, "").slice(-10);

  function renderData(body, next) {
    const c = bk.client;
    body.innerHTML = `
      ${avisoHtml()}
      <label class="field"><span>Nombre y apellido</span><input type="text" id="fNombre" autocomplete="name" placeholder="Ej.: Juan Pérez" value="${esc(c.nombre || "")}" maxlength="80" /></label>
      <label class="field"><span>Celular</span><input type="tel" id="fCel" autocomplete="tel" inputmode="tel" placeholder="11 1234 5678" value="${esc(c.cel || "")}" maxlength="30" /></label>
      <label class="field"><span>Mail</span><input type="email" id="fMail" autocomplete="email" placeholder="tu@mail.com" value="${esc(c.mail || "")}" maxlength="120" /></label>
      <p class="bk-note" id="fMailGuardado" hidden></p>
      <label class="check"><input type="checkbox" id="fOk" ${c.ok ? "checked" : ""} /> Acepto recibir recordatorios y novedades de la barbería. Ver <a href="politicas.html#privacidad" target="_blank">política de privacidad</a>.</label>
      <p class="bk-note">Si ya viniste antes, al poner tu celular completamos tus datos solos.</p>`;
    next.textContent = "Revisar y pagar la seña";
    const f = { nombre: $("#fNombre"), cel: $("#fCel"), mail: $("#fMail"), ok: $("#fOk") };
    const guardado = $("#fMailGuardado");
    const validate = () => {
      bk.client = { nombre: f.nombre.value.trim(), cel: f.cel.value.trim(), mail: f.mail.value.trim(), ok: f.ok.checked, mailOculto: bk.client.mailOculto };
      const mailOk = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(bk.client.mail) || (!bk.client.mail && bk.client.mailOculto);
      next.disabled = !(bk.client.nombre.length > 2 && phoneKey(bk.client.cel).length >= 8 && mailOk);
    };
    const mostrarGuardado = () => {
      guardado.hidden = !(bk.client.mailOculto && !f.mail.value);
      guardado.textContent = `Si lo dejás vacío, usamos tu mail guardado (${bk.client.mailOculto}).`;
    };
    let ultimoCel = "";
    f.cel.addEventListener("input", async () => {
      validate();
      const k = phoneKey(f.cel.value);
      if (k.length < 10 || k === ultimoCel) return;
      ultimoCel = k;
      try {
        const r = await api.cliente(f.cel.value);
        if (r.encontrado && phoneKey(f.cel.value) === k) {
          if (!f.nombre.value) f.nombre.value = r.nombre;
          bk.client.mailOculto = r.mailOculto;
          if (!f.mail.value) f.mail.placeholder = r.mailOculto;
          validate();
          mostrarGuardado();
        }
      } catch { /* sin autocompletar, no pasa nada */ }
    });
    f.mail.addEventListener("input", mostrarGuardado);
    [f.nombre, f.mail, f.ok].forEach((el) => el.addEventListener("input", validate));
    validate();
    mostrarGuardado();
  }

  async function reservar(next) {
    next.disabled = true;
    next.textContent = "Reservando…";
    try {
      const r = await api.reservar({
        barbero: bk.barber === ANY ? "" : bk.barber, servicio: bk.service, fecha: bk.fecha, hora: bk.hora,
        nombre: bk.client.nombre, celular: bk.client.cel, mail: bk.client.mail, acepta: bk.client.ok,
      });
      bk.reserva = r;
      if (r.estado === "Confirmado") { bk.turno = r.turno; bk.step = P.LISTO; } // modo prueba: sin seña
      else bk.step = P.SENA;
    } catch (e) {
      bk.aviso = e.message;
      if (e.codigo === "ocupado") { bk.hora = null; bk.step = P.HORARIO; }
    }
    renderStep();
  }

  function filasResumen(t, conPago) {
    const fila = (a, b, cls = "") => `<div class="summary__row ${cls}"><span>${esc(a)}</span><b>${esc(b)}</b></div>`;
    return `<div class="summary">
      ${fila("Barbero", t.barbero)}
      ${fila("Local", t.local)}
      ${fila("Servicio", t.servicio)}
      ${fila("Día y hora", `${diaCorto(t.fecha)} ${F.num(t.fecha)} · ${t.hora} h`)}
      ${conPago ? `<hr />
      ${fila("Precio del servicio", money(t.precio) || "[Precio]")}
      ${fila("Seña ahora", money(t.sena) || "[Seña]", "summary__row--strong")}
      ${fila("Pagás en el local", money(t.precio - t.sena) || "[Resto]")}` : ""}
    </div>`;
  }

  function renderPay(body, next) {
    const r = bk.reserva;
    body.innerHTML = `
      ${filasResumen(r.turno, true)}
      <p class="bk-italic">Te guardamos el turno por <span class="timer" id="bkTimer">${D.minutosReserva}:00</span> minutos mientras pagás.</p>
      <p class="bk-note">La seña se descuenta del precio. Podés reprogramar o cancelar hasta ${D.cancelacionHoras} h antes sin perderla.</p>
      ${api.demo ? `<p class="bk-note">Demo: el pago está simulado, no se cobra nada.</p>` : ""}`;
    next.textContent = "Pagar seña con Mercado Pago";
    startTimer(r.vence);
  }

  async function pagar(next) {
    const r = bk.reserva;
    if (r.pago) {
      // Guardamos la reserva por si vuelve de Mercado Pago sin pagar
      sessionStorage.setItem("pz_reserva", JSON.stringify(r));
      stopTimer();
      next.disabled = true;
      next.textContent = "Abriendo Mercado Pago…";
      location.href = r.pago;
      return;
    }
    // Demo: se simula el pago
    stopTimer();
    bk.step = P.VERIFICANDO;
    renderStep();
    bk.turno = await api.verificar({ id: r.turno.id, t: r.token });
    bk.reserva = null;
    bk.step = P.LISTO;
    renderStep();
  }

  function startTimer(vence) {
    stopTimer();
    const end = vence || Date.now() + D.minutosReserva * 60000;
    const tick = () => {
      const left = Math.max(0, end - Date.now());
      const el = $("#bkTimer");
      if (el) el.textContent = `${Math.floor(left / 60000)}:${String(Math.floor(left / 1000) % 60).padStart(2, "0")}`;
      if (!left) {
        stopTimer();
        liberarReserva();
        bk.aviso = "Se venció el tiempo para pagar y el horario se liberó. Elegí un horario de nuevo.";
        bk.step = P.HORARIO;
        bk.hora = null;
        renderStep();
      }
    };
    tick();
    timer = setInterval(tick, 1000);
  }
  function stopTimer() { clearInterval(timer); timer = null; }

  function calendarLink(t) {
    const start = new Date(F.ms(t.fecha, t.hora));
    const end = new Date(start.getTime() + (t.duracion || 30) * 60000);
    const f = (d) => d.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
    const p = new URLSearchParams({
      action: "TEMPLATE",
      text: `${t.servicio} con ${t.barbero} · Playzone Barber`,
      dates: `${f(start)}/${f(end)}`,
      location: [t.local, t.direccion].filter(Boolean).join(", "),
    });
    return "https://calendar.google.com/calendar/render?" + p;
  }

  function renderDone(body) {
    stopTimer();
    const t = bk.turno;
    if (bk.cancelado) {
      body.innerHTML = `
        <div class="done">
          <div class="done__check">✕</div>
          <h3>Cancelamos tu turno del ${esc(t.fechaLarga)} a las ${esc(t.hora)} h</h3>
          <p>${bk.senaDevuelta ? "Como cancelaste a tiempo, te devolvemos la seña." : t.senaPagada ? `Faltaban menos de ${D.cancelacionHoras} h, así que la seña no se devuelve.` : ""}</p>
          <p>Te mandamos la confirmación por mail.</p>
          <div class="done__btns"><button class="btn btn--dark" data-reservar>Reservar otro turno</button></div>
          <a class="link" href="#" data-close>Volver a la página</a>
        </div>`;
      $("#bkNext").parentElement.hidden = true;
      return;
    }
    if (!api.demo) localStorage.setItem("pz_ultimo_cel", bk.client.cel || "");
    const pagos = t.senaPagada
      ? `<p>Seña pagada: ${money(t.sena) || "[Seña]"} · Resta pagar en el local: ${money(t.resta) || "[Resto]"}</p>`
      : t.precio ? `<p>Pagás ${money(t.precio)} en el local.</p>` : "";
    body.innerHTML = `
      <div class="done">
        <div class="done__check">✓</div>
        <h3>${esc(diaCorto(t.fecha))} ${F.num(t.fecha)} · ${esc(t.hora)} h con ${esc(t.barbero)}</h3>
        <p>${esc(t.local)}${t.direccion ? " · " + esc(t.direccion) : ""}</p>
        ${pagos}
        <p>Te mandamos la confirmación a tu mail y un recordatorio 24 h antes.</p>
        <div class="done__btns">
          <a class="btn btn--dark" href="${esc(calendarLink(t))}" target="_blank" rel="noopener">Agregar a mi calendario</a>
          ${t.mapa ? `<a class="btn btn--outline" href="${esc(t.mapa)}" target="_blank" rel="noopener">Cómo llegar</a>` : ""}
        </div>
        <a class="link" href="#" data-close>Volver a la página</a>
      </div>`;
    $("#bkNext").parentElement.hidden = true;
  }

  function renderVerificando(body) {
    body.innerHTML = `<div class="done"><div class="spinner" aria-hidden="true"></div><p>Estamos confirmando tu pago con Mercado Pago…</p></div>`;
    $("#bkNext").parentElement.hidden = true;
  }

  function renderErrorPago(body, next) {
    const r = bk.reserva;
    const sigueGuardado = r && r.vence > Date.now() && r.pago;
    body.innerHTML = `
      <div class="done">
        <div class="done__check">!</div>
        <h3>Tu turno todavía no está confirmado</h3>
        <p>${sigueGuardado ? "Todavía te guardamos el horario unos minutos. Podés intentar pagar de nuevo." : "El horario se liberó. Elegí uno de nuevo."}</p>
        ${r ? filasResumen(r.turno, false) : ""}
        <p class="bk-note">Si el pago se acreditó, te va a llegar el mail de confirmación en unos minutos.</p>
      </div>`;
    if (sigueGuardado) {
      next.textContent = "Intentar pagar de nuevo";
      next.onclick = () => { location.href = r.pago; };
    } else {
      next.textContent = "Elegir otro horario";
      next.onclick = null;
    }
  }

  /* ---------- Gestionar un turno (link del mail) ---------- */
  function renderGestionar(body, next) {
    const g = bk.gestion;
    const t = g.info.turno;
    const estado = t.estado;
    let html = filasResumen(t, false);
    if (!g.info.puedeCambiar) {
      html += `<p class="bk-note">${estado === "Cancelado" ? "Este turno está cancelado." : "Este turno ya no se puede modificar desde la web. Escribinos por WhatsApp."}</p>`;
      body.innerHTML = html;
      next.textContent = "Reservar otro turno";
      next.onclick = () => startBooking(null);
      return;
    }
    html += g.info.aTiempo
      ? `<p class="bk-note">Podés reprogramar o cancelar sin perder la seña.</p>`
      : `<p class="bk-note">Faltan menos de ${g.info.horasLimite} h: ya no se puede reprogramar, y si cancelás la seña no se devuelve.</p>`;
    html += `${avisoHtml()}<div class="done__btns">
        ${g.info.aTiempo ? `<button class="btn btn--dark" id="gReprog">Reprogramar</button>` : ""}
        <button class="btn btn--outline" id="gCancel">Cancelar turno</button>
      </div>`;
    body.innerHTML = html;
    next.parentElement.hidden = true;
    const rep = $("#gReprog");
    if (rep) rep.onclick = () => {
      const srv = D.servicios.find((s) => s.nombre === t.servicio || s.id === t.servicio);
      const bar = D.barberos.find((b) => b.nombre === t.barbero || b.id === t.barbero);
      Object.assign(bk, { modo: "reprogramar", step: P.HORARIO, barber: bar ? bar.id : t.barbero, service: srv ? srv.id : t.servicio, fecha: t.fecha, hora: null });
      renderStep();
    };
    const can = $("#gCancel");
    can.onclick = async () => {
      if (!can.dataset.confirmar) {
        can.dataset.confirmar = "1";
        can.textContent = "Sí, cancelar mi turno";
        can.classList.replace("btn--outline", "btn--dark");
        return;
      }
      can.disabled = true;
      can.textContent = "Cancelando…";
      try {
        const r = await api.cancelar({ id: g.id, t: g.t });
        Object.assign(bk, { step: P.LISTO, cancelado: true, senaDevuelta: r.senaDevuelta, turno: t });
      } catch (e) {
        bk.aviso = e.message;
      }
      renderStep();
    };
  }

  async function abrirGestion(id, t) {
    bk = nuevoEstado({ step: P.VERIFICANDO, gestion: { id, t } });
    openSheet(bookingSheet);
    renderStep();
    $("#bkBody").innerHTML = `<div class="done"><div class="spinner" aria-hidden="true"></div><p>Buscando tu turno…</p></div>`;
    try {
      bk.gestion.info = await api.turno({ id, t });
      bk.step = P.GESTIONAR;
      renderStep();
    } catch (e) {
      $("#bkBody").innerHTML = `<div class="bk-empty">${esc(e.message)}</div>`;
    }
  }

  async function reprogramar(next) {
    next.disabled = true;
    next.textContent = "Guardando…";
    try {
      const r = await api.reprogramar({ id: bk.gestion.id, t: bk.gestion.t, fecha: bk.fecha, hora: bk.hora });
      Object.assign(bk, { turno: r.turno, step: P.LISTO, reprogramado: true });
    } catch (e) {
      bk.aviso = e.message;
      bk.hora = null;
    }
    renderStep();
  }

  /* ---------- Vuelta desde Mercado Pago ---------- */
  async function volverDePago(id, t, paymentId, status) {
    let guardada = null;
    try { guardada = JSON.parse(sessionStorage.getItem("pz_reserva") || "null"); } catch { }
    bk = nuevoEstado({ step: P.VERIFICANDO, reserva: guardada && guardada.turno.id === id ? guardada : null });
    openSheet(bookingSheet);
    renderStep();
    // El aviso de Mercado Pago a veces tarda unos segundos: probamos varias veces
    const intentos = status === "approved" ? 6 : 1;
    for (let i = 0; i < intentos; i++) {
      try {
        const turno = await api.verificar({ id, t, payment_id: paymentId || "" });
        if (["Confirmado", "Asistió"].includes(turno.estado)) {
          sessionStorage.removeItem("pz_reserva");
          bk.turno = turno;
          bk.reserva = null;
          bk.step = P.LISTO;
          renderStep();
          return;
        }
        if (turno.estado === "Cancelado") break;
      } catch (e) {
        if (e.codigo === "no_encontrado") break;
      }
      if (i < intentos - 1) await new Promise((r) => setTimeout(r, 2500));
    }
    bk.step = P.ERROR_PAGO;
    renderStep();
  }

  /* ---------- Botones Continuar / Volver ---------- */
  $("#bkNext").addEventListener("click", (e) => {
    const next = e.currentTarget;
    if (next.onclick) return; // botones con acción propia (error de pago, gestionar)
    switch (bk.step) {
      case P.HORARIO:
        if (bk.modo === "reprogramar") return reprogramar(next);
        bk.step = P.DATOS; break;
      case P.DATOS: return reservar(next);
      case P.SENA: return pagar(next);
      case P.ERROR_PAGO: bk = nuevoEstado({ step: P.BARBERO }); break;
      default: bk.step++;
    }
    renderStep();
  });
  $("#bkBack").addEventListener("click", () => {
    if (bk.step === P.SENA) { stopTimer(); liberarReserva(); }
    if (bk.modo === "reprogramar" && bk.step === P.HORARIO) { bk.step = P.GESTIONAR; bk.modo = null; }
    else bk.step = Math.max(P.BARBERO, bk.step - 1);
    renderStep();
  });

  /* ================= Arranque ================= */
  (async () => {
    const inicio = Date.now();
    let mostrado = false;
    const mostrar = () => {
      if (mostrado) return;
      mostrado = true;
      renderSite();
      $$(".sheet .cut-title").forEach((t) => t.classList.remove("cut-title"));
      $$(".cut-title").forEach((t) => io.observe(t));
      // El poste de barbería se ve un instante (solo en la primera visita) y nunca frena la página
      setTimeout(hideLoader, Math.max(0, 450 - (Date.now() - inicio)));
    };

    if (api.demo) mostrar();
    else {
      const snap = leerSnapshot();
      const cache = leerCache();
      const inicial = [cache, snap].filter(Boolean).sort((a, b) => b.t - a.t)[0];
      let firma = "";
      if (inicial) {
        aplicarDatos(inicial.d, false);
        firma = JSON.stringify(inicial.d, (k, v) => (k === "hoy" ? undefined : v));
        mostrar();
      }
      const r = await cargarDatos();
      if (r) {
        guardarCache(r);
        aplicarDatos(r, true);
        const nueva = JSON.stringify(r, (k, v) => (k === "hoy" ? undefined : v));
        if (!mostrado) mostrar();
        else if (nueva !== firma) renderSite(); // cambió algo en la planilla: se actualiza
      } else mostrar();
    }

    const q = new URLSearchParams(location.search);
    const limpiar = () => history.replaceState(null, "", location.pathname + location.hash);
    if (q.get("reserva") && q.get("t")) {
      limpiar();
      volverDePago(q.get("reserva"), q.get("t"), q.get("payment_id") || q.get("collection_id"), q.get("status") || q.get("collection_status"));
    } else if (q.get("gestionar") && q.get("t")) {
      limpiar();
      abrirGestion(q.get("gestionar"), q.get("t"));
    }
  })();
  setTimeout(hideLoader, 4000); // por si la planilla tarda mucho
})();
