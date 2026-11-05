/*
 * Panel del barbero: turnos del día, asistencia, pagos, turnos de WhatsApp y bloqueos.
 * Con PLAYZONE_API habla con la planilla; sin ella funciona en modo demo.
 */
(() => {
  "use strict";
  const { F } = window.PZ;
  const D = window.PLAYZONE;
  const API = window.PLAYZONE_API;
  const DUENO = "__dueno__";

  const $ = (s, el = document) => el.querySelector(s);
  const $$ = (s, el = document) => [...el.querySelectorAll(s)];
  const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const plata = (n) => "$" + Math.round(Number(n) || 0).toLocaleString("es-AR");
  const toMin = (t) => { const [h, m] = t.split(":").map(Number); return h * 60 + m; };
  const hhmm = (m) => `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;
  const HORAS = Array.from({ length: (22 - 8) * 4 + 1 }, (_, i) => hhmm(8 * 60 + i * 15));

  function errorCon(codigo, mensaje) { const e = new Error(mensaje); e.codigo = codigo; return e; }

  /* ================================================================ */
  /* Conexión                                                          */
  /* ================================================================ */
  function panelReal(url) {
    const red = () => errorCon("red", "Sin conexión. Revisá internet y probá de nuevo.");
    async function post(body) {
      let r, j;
      try { r = await fetch(url, { method: "POST", headers: { "Content-Type": "text/plain;charset=utf-8" }, body: JSON.stringify(body) }); }
      catch { throw red(); }
      try { j = await r.json(); } catch { throw red(); }
      if (!j.ok) throw errorCon(j.codigo, j.error);
      return j.data;
    }
    return {
      demo: false,
      async barberos() {
        const r = await fetch(url + "?accion=datos").then((x) => x.json());
        if (!r.ok) throw red();
        return r.data.barberos.map((b) => b.nombre);
      },
      login: (p) => post({ ...p, accion: "panelLogin" }),
      agenda: (p) => post({ ...p, accion: "panelAgenda" }),
      marcar: (p) => post({ ...p, accion: "panelMarcar" }),
      agregar: (p) => post({ ...p, accion: "panelAgregar" }),
      bloquear: (p) => post({ ...p, accion: "panelBloquear" }),
      desbloquear: (p) => post({ ...p, accion: "panelDesbloquear" }),
      clientes: (p) => post({ ...p, accion: "panelClientes" }),
      fotos: (p) => post({ ...p, accion: "panelFotos" }),
      subirFoto: (p) => post({ ...p, accion: "panelSubirFoto" }),
      perfil: (p) => post({ ...p, accion: "panelPerfil" }),
      borrarFoto: (p) => post({ ...p, accion: "panelBorrarFoto" }),
    };
  }

  /* ---------- Demo: todo simulado en este navegador ---------- */
  function panelDemo() {
    const KEY = "pz_demo_panel";
    const st = JSON.parse(localStorage.getItem(KEY) || '{"turnos":[],"bloqueos":[],"sembrado":{}}');
    const guardar = () => localStorage.setItem(KEY, JSON.stringify(st));
    const espera = () => new Promise((r) => setTimeout(r, 250));
    const servicios = D.servicios.map((s, i) => ({ nombre: s.nombre, duracion: s.duracion, precio: s.precio || [12000, 16000, 8000, 10000, 11000, 9000][i] || 10000 }));
    const srv = (n) => servicios.find((s) => s.nombre === n) || servicios[0];
    const localDe = (b) => D.locales.find((l) => l.id === (D.barberos.find((x) => x.nombre === b) || {}).local) || D.locales[0];
    const NOMBRES = ["Juan P.", "Martín G.", "Lucas R.", "Tomás B.", "Nico F.", "Santi L.", "Franco D.", "Mateo C."];
    let id = Date.now();
    const fotosDemo = {};

    function sembrar(b, f) {
      if (st.sembrado[b + f] || !localDe(b).diasAbierto.includes(F.dia(f))) return;
      st.sembrado[b + f] = 1;
      const hoy = F.hoy();
      const base = f === hoy
        ? [["10:00", 0, "Asistió", true, "Web", 6], ["10:45", 1, "Confirmado", false, "Web", 0], ["11:30", 0, "Confirmado", false, "WhatsApp", 2], ["15:00", 1, "Confirmado", false, "Web", 4]]
        : [["10:00", 0, "Confirmado", false, "Web", 1], ["12:15", 1, "Confirmado", false, "WhatsApp", 3], ["17:00", 0, "Confirmado", false, "Web", 0]].slice(0, 1 + (F.num(f) % 3));
      base.forEach(([hora, si, estado, pagado, origen, visitas], i) => {
        const s = servicios[si];
        const web = origen === "Web";
        st.turnos.push({
          id: "D" + id++, fecha: f, hora, fin: hhmm(toMin(hora) + s.duracion), barbero: b, cliente: NOMBRES[(i + F.num(f)) % NOMBRES.length],
          celular: "11 5555 " + String(1000 + i * 37), servicio: s.nombre, estado, origen, precio: s.precio,
          sena: web ? Math.round(s.precio * 0.3) : 0, senaPagada: web, pagoResto: pagado, notas: "", visitas,
        });
      });
      guardar();
    }
    function dia(b, f) {
      sembrar(b, f);
      const l = localDe(b);
      const atiende = l.diasAbierto.includes(F.dia(f));
      const turnos = st.turnos.filter((t) => t.barbero === b && t.fecha === f && t.estado !== "Cancelado")
        .map((t) => ({ ...t, resta: t.senaPagada ? t.precio - t.sena : t.precio, whatsapp: "https://wa.me/5491155550000" }))
        .sort((a, c) => a.hora.localeCompare(c.hora));
      const bloqueos = st.bloqueos.filter((x) => x.barbero === b && x.fecha === f);
      const ocup = [...turnos.map((t) => [toMin(t.hora), toMin(t.fin)]), ...bloqueos.map((x) => [x.desde ? toMin(x.desde) : 0, x.hasta ? toMin(x.hasta) : 1440])].sort((a, c) => a[0] - c[0]);
      const libres = [];
      if (atiende) {
        let desde = 600;
        if (f === F.hoy()) desde = Math.max(desde, Math.ceil(F.minutosAhora() / 15) * 15);
        ocup.forEach((r) => { if (r[0] - desde >= 20 && r[0] <= 1200) libres.push({ desde: hhmm(desde), hasta: hhmm(Math.min(r[0], 1200)) }); desde = Math.max(desde, r[1]); });
        if (1200 - desde >= 20) libres.push({ desde: hhmm(desde), hasta: "20:00" });
      }
      return {
        fecha: f, fechaLarga: F.larga(f), atiende, turnos, libres,
        bloqueos: bloqueos.map((x) => ({ ...x, propio: true })),
        resumen: {
          turnos: turnos.length,
          senas: turnos.reduce((a, t) => a + (t.senaPagada ? t.sena : 0), 0),
          restaCobrar: turnos.filter((t) => !t.pagoResto && !["No vino", "Pendiente de pago"].includes(t.estado)).reduce((a, t) => a + t.resta, 0),
        },
      };
    }
    const quien = (p) => (p.token === DUENO ? p.barbero || D.barberos[0].nombre : p.token);
    const turnoPorId = (i) => st.turnos.find((t) => t.id === i);
    return {
      demo: true,
      barberos: async () => D.barberos.map((b) => b.nombre),
      async login(p) {
        await espera();
        if (!p.clave) throw errorCon("login", "Poné tu clave.");
        const dueno = p.barbero === DUENO;
        return { token: dueno ? DUENO : p.barbero, nombre: dueno ? "Dueño" : p.barbero, dueno, barberos: dueno ? D.barberos.map((b) => b.nombre) : [p.barbero] };
      },
      async agenda(p) {
        await espera();
        const b = quien(p);
        const desde = p.fecha || F.hoy();
        return { barbero: b, local: localDe(b).nombre, hoy: F.hoy(), dias: Array.from({ length: p.dias || 1 }, (_, i) => dia(b, F.sumar(desde, i))), servicios };
      },
      async marcar(p) {
        await espera();
        const t = turnoPorId(p.id);
        const c = { asistio: { estado: "Asistió" }, novino: { estado: "No vino" }, pagoResto: { pagoResto: true }, deshacer: { estado: "Confirmado", pagoResto: false }, cancelar: { estado: "Cancelado" } }[p.marca];
        Object.assign(t, c);
        guardar();
        return { turno: { ...t, resta: t.senaPagada ? t.precio - t.sena : t.precio } };
      },
      async agregar(p) {
        await espera();
        const b = quien(p);
        const s = srv(p.servicio);
        const ini = toMin(p.hora);
        const d = dia(b, p.fecha);
        const choca = d.turnos.some((t) => ini < toMin(t.fin) && ini + s.duracion > toMin(t.hora)) ||
          d.bloqueos.some((x) => ini < (x.hasta ? toMin(x.hasta) : 1440) && ini + s.duracion > (x.desde ? toMin(x.desde) : 0));
        if (choca && !p.forzar) throw errorCon("ocupado", "Ese horario se superpone con otro turno o un bloqueo.");
        st.turnos.push({ id: "D" + id++, fecha: p.fecha, hora: p.hora, fin: hhmm(ini + s.duracion), barbero: b, cliente: p.cliente, celular: p.celular, servicio: s.nombre, estado: "Confirmado", origen: p.origen || "WhatsApp", precio: s.precio, sena: 0, senaPagada: false, pagoResto: false, notas: p.notas || "", visitas: 0 });
        guardar();
        return {};
      },
      async bloquear(p) {
        await espera();
        if ((p.desde || p.hasta) && (!p.desde || !p.hasta || p.hasta <= p.desde)) throw errorCon("datos", 'Revisá el horario: "hasta" tiene que ser después de "desde".');
        st.bloqueos.push({ fila: id++, barbero: quien(p), fecha: p.fecha, desde: p.desde || "", hasta: p.hasta || "", motivo: p.motivo || "Bloqueado desde el panel" });
        guardar();
        return {};
      },
      async desbloquear(p) {
        await espera();
        st.bloqueos = st.bloqueos.filter((x) => x.fila !== p.fila);
        guardar();
        return {};
      },
      async clientes(p) {
        await espera();
        const b = quien(p);
        const vistos = {};
        st.turnos.filter((t) => t.barbero === b).forEach((t) => { vistos[t.cliente] = vistos[t.cliente] || { nombre: t.cliente, celular: t.celular, visitas: t.visitas, ultima: F.sumar(F.hoy(), -7), diasSinVenir: 7, proximo: t.fecha >= F.hoy() ? t.fecha : "", recontactar: false, whatsapp: "https://wa.me/5491155550000" }; });
        const lista = Object.values(vistos);
        lista.push({ nombre: "Diego M.", celular: "11 4444 2222", visitas: 5, novino: 0, ultima: F.sumar(F.hoy(), -45), diasSinVenir: 45, proximo: "", recontactar: true, whatsapp: "https://wa.me/5491144442222?text=" + encodeURIComponent("Hola Diego! Hace un tiempo que no te vemos por Playzone Barber. ¿Te reservo un turno?") });
        return { barbero: b, clientes: lista.sort((a, c) => (c.recontactar ? 1 : 0) - (a.recontactar ? 1 : 0)) };
      },
      // Fotos de la demo: quedan solo mientras la página está abierta
      async fotos(p) {
        await espera();
        const f = fotosDemo[quien(p)] || { perfil: null, cortes: [], antesDespues: [] };
        return { barbero: quien(p), fotos: f };
      },
      async subirFoto(p) {
        await espera();
        const f = (fotosDemo[quien(p)] = fotosDemo[quien(p)] || { perfil: null, cortes: [], antesDespues: [] });
        const nuevo = (d, t) => { const x = "data:" + t + ";base64," + d; srcDemo[x] = x; return x; };
        if (p.clase === "antesDespues") f.antesDespues.unshift([nuevo(p.antes, p.tipoAntes), nuevo(p.despues, p.tipoDespues)]);
        else if (p.clase === "perfil") { if (f.perfil) f.cortes.unshift({ id: f.perfil }); f.perfil = nuevo(p.datos, p.tipo); }
        else f.cortes.unshift({ id: nuevo(p.datos, p.tipo) });
        return {};
      },
      async perfil(p) {
        const f = fotosDemo[quien(p)];
        f.cortes = f.cortes.filter((x) => x.id !== p.id);
        if (f.perfil) f.cortes.unshift({ id: f.perfil });
        f.perfil = p.id;
        return {};
      },
      async borrarFoto(p) {
        const f = fotosDemo[quien(p)];
        const ids = [].concat(p.ids || p.id);
        f.cortes = f.cortes.filter((x) => !ids.includes(x.id));
        f.antesDespues = f.antesDespues.filter((x) => !ids.includes(x[0]));
        if (ids.includes(f.perfil)) f.perfil = null;
        return {};
      },
    };
  }

  const srcDemo = {};
  const api = API ? panelReal(API) : panelDemo();
  const FT = window.PZFotos;
  const srcFoto = (id, w = 500) => (srcDemo[id] ? id : FT.url(id, w));

  /* ================================================================ */
  /* Estado y sesión                                                   */
  /* ================================================================ */
  const S = { sesion: null, barbero: "", tab: "dia", fecha: F.hoy(), hoy: F.hoy(), dia: null, semana: null, clientes: null, servicios: [], buscar: "" };

  function guardarSesion(s) { S.sesion = s; localStorage.setItem("pz_panel", JSON.stringify(s)); }
  function salir() {
    localStorage.removeItem("pz_panel");
    S.sesion = null;
    mostrarLogin();
  }
  function conSesion(p) { return { token: S.sesion.token, barbero: S.barbero, ...p }; }

  async function llamar(fn, p) {
    try { return await api[fn](conSesion(p)); }
    catch (e) {
      if (e.codigo === "sesion") { salir(); aviso(e.message); }
      throw e;
    }
  }

  let toastTimer;
  function aviso(texto, deshacer) {
    const t = $("#toast");
    t.innerHTML = esc(texto) + (deshacer ? ' <button type="button">Deshacer</button>' : "");
    t.hidden = false;
    if (deshacer) $("button", t).onclick = () => { t.hidden = true; deshacer(); };
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => { t.hidden = true; }, deshacer ? 6000 : 3500);
  }

  /* ================================================================ */
  /* Entrar                                                            */
  /* ================================================================ */
  async function mostrarLogin() {
    $("#panel").hidden = true;
    $("#login").hidden = false;
    $("#lgDemo").hidden = !api.demo;
    const sel = $("#lgBarbero");
    if (!sel.options.length) {
      sel.innerHTML = `<option value="">Cargando…</option>`;
      try {
        const nombres = await api.barberos();
        const ultimo = localStorage.getItem("pz_panel_ultimo") || "";
        sel.innerHTML = `<option value="" disabled ${ultimo ? "" : "selected"}>Elegí tu nombre</option>` +
          nombres.map((n) => `<option ${n === ultimo ? "selected" : ""}>${esc(n)}</option>`).join("") +
          `<option value="${DUENO}" ${ultimo === DUENO ? "selected" : ""}>Dueño</option>`;
      } catch {
        sel.innerHTML = `<option value="">No se pudo cargar la lista</option>`;
      }
    }
  }

  $("#loginForm").addEventListener("submit", async (e) => {
    e.preventDefault();
    const btn = $("#lgBtn"), err = $("#lgError");
    err.hidden = true;
    btn.disabled = true;
    btn.textContent = "Entrando…";
    try {
      const barbero = $("#lgBarbero").value;
      const s = await api.login({ barbero, clave: $("#lgClave").value });
      localStorage.setItem("pz_panel_ultimo", barbero);
      guardarSesion(s);
      $("#lgClave").value = "";
      abrirPanel();
    } catch (ex) {
      err.textContent = ex.message;
      err.hidden = false;
    }
    btn.disabled = false;
    btn.textContent = "Entrar";
  });

  /* ================================================================ */
  /* Panel                                                             */
  /* ================================================================ */
  function abrirPanel() {
    $("#login").hidden = true;
    $("#panel").hidden = false;
    S.barbero = S.sesion.dueno ? (S.barbero || S.sesion.barberos[0]) : S.sesion.nombre;
    $("#pnNombre").textContent = S.sesion.dueno ? S.barbero : S.sesion.nombre;
    $(".pn-hola em").textContent = S.sesion.dueno ? "Agenda de" : "Hola,";
    const chips = $("#pnBarberos");
    chips.hidden = !S.sesion.dueno;
    if (S.sesion.dueno) {
      chips.innerHTML = S.sesion.barberos.map((b) => `<button type="button" data-b="${esc(b)}" class="${b === S.barbero ? "is-on" : ""}">${esc(b)}</button>`).join("");
      $$("button", chips).forEach((x) => x.onclick = () => {
        S.barbero = x.dataset.b;
        $$("button", chips).forEach((y) => y.classList.toggle("is-on", y === x));
        $("#pnNombre").textContent = S.barbero;
        S.dia = S.semana = S.clientes = S.fotos = null;
        cargar();
      });
    }
    cargar();
  }

  $$(".pn-tabs button").forEach((b) => b.addEventListener("click", () => {
    S.tab = b.dataset.tab;
    $$(".pn-tabs button").forEach((x) => x.classList.toggle("is-on", x === b));
    if (S.tab === "dia") S.fecha = S.fecha || S.hoy;
    cargar();
  }));

  function cargando() { $("#pnBody").innerHTML = `<div class="bk-loading">Cargando…</div>`; }

  async function cargar(silencioso) {
    const tab = S.tab;
    if (!silencioso) {
      const hay = (tab === "dia" && S.dia && S.dia.fecha === S.fecha) || (tab === "semana" && S.semana) || (tab === "clientes" && S.clientes) || (tab === "fotos" && S.fotos);
      if (hay) render(); else cargando();
    }
    try {
      if (tab === "dia") {
        const r = await llamar("agenda", { fecha: S.fecha, dias: 1 });
        Object.assign(S, { dia: r.dias[0], hoy: r.hoy, servicios: r.servicios });
        $("#pnLocal").textContent = r.local;
      } else if (tab === "semana") {
        const r = await llamar("agenda", { fecha: S.hoy, dias: 7 });
        Object.assign(S, { semana: r.dias, hoy: r.hoy, servicios: r.servicios });
        $("#pnLocal").textContent = r.local;
      } else if (tab === "fotos") {
        S.fotos = (await llamar("fotos", {})).fotos;
      } else {
        S.clientes = (await llamar("clientes", {})).clientes;
      }
      if (S.tab === tab) render();
    } catch (e) {
      if (e.codigo !== "sesion" && !silencioso) $("#pnBody").innerHTML = `<div class="pn-vacio">${esc(e.message)}<br><br><button class="btn btn--outline btn--xs" type="button" id="reintentar">Reintentar</button></div>`;
      const r = $("#reintentar");
      if (r) r.onclick = () => cargar();
    }
  }

  function render() {
    if (S.tab === "dia") renderDia();
    else if (S.tab === "semana") renderSemana();
    else if (S.tab === "fotos") renderFotos();
    else renderClientes();
  }

  function stats(res, etiqueta) {
    $("#stTurnos").previousElementSibling.textContent = etiqueta;
    $("#stSenas").previousElementSibling.textContent = "Señas cobradas";
    $("#stResta").previousElementSibling.textContent = "Resta cobrar";
    $("#stTurnos").textContent = res.turnos;
    $("#stSenas").textContent = plata(res.senas);
    $("#stResta").textContent = plata(res.restaCobrar);
  }

  /* ---------- Día ---------- */
  function recalcularResumen(d) {
    d.resumen = {
      turnos: d.turnos.length,
      senas: d.turnos.reduce((a, t) => a + (t.senaPagada ? t.sena : 0), 0),
      restaCobrar: d.turnos.filter((t) => !t.pagoResto && !["No vino", "Pendiente de pago"].includes(t.estado)).reduce((a, t) => a + t.resta, 0),
    };
  }

  function renderDia() {
    const d = S.dia;
    if (!d) return;
    const esHoy = d.fecha === S.hoy;
    stats(d.resumen, esHoy ? "Turnos hoy" : "Turnos");
    $(".pn-tabs [data-tab=dia]").textContent = esHoy ? "Hoy" : "Día";
    const items = [
      ...d.turnos.map((t) => ({ hora: t.hora, html: tarjeta(t) })),
      ...d.libres.map((l) => ({ hora: l.desde, html: `<button type="button" class="libre" data-libre="${l.desde}"><b>${l.desde}</b><span><strong>Libre</strong>Disponible en la web hasta las ${l.hasta}</span><em>＋</em></button>` })),
      ...d.bloqueos.map((x) => ({
        hora: x.desde || "00:00",
        html: `<div class="bloq"><b>${x.desde || "Todo"}</b><span><strong>Bloqueado${x.desde ? " hasta las " + x.hasta : " el día"}</strong>${esc(x.motivo)}</span>${x.propio ? `<button type="button" data-desbloq="${x.fila}" data-desde="${esc(x.desde)}">Desbloquear</button>` : ""}</div>`,
      })),
    ].sort((a, b) => a.hora.localeCompare(b.hora));
    const vacio = !d.atiende && !d.turnos.length
      ? `<div class="pn-vacio">No atendés este día.</div>`
      : !items.length ? `<div class="pn-vacio">No hay turnos ni horarios libres.</div>` : "";
    $("#pnBody").innerHTML = `
      <div class="pn-dia">
        <button type="button" class="icon-btn" id="diaAnt" aria-label="Día anterior">‹</button>
        <div style="text-align:center"><h2>${esc(d.fechaLarga)}</h2>${esHoy ? "" : `<button type="button" class="pn-hoy-link" id="irHoy">Volver a hoy</button>`}</div>
        <button type="button" class="icon-btn" id="diaSig" aria-label="Día siguiente">›</button>
      </div>
      ${vacio}${items.map((i) => i.html).join("")}
      <button type="button" class="pn-salir" id="salir">Salir del panel</button>`;
    $("#diaAnt").onclick = () => { S.fecha = F.sumar(S.fecha, -1); cargar(); };
    $("#diaSig").onclick = () => { S.fecha = F.sumar(S.fecha, 1); cargar(); };
    const irHoy = $("#irHoy");
    if (irHoy) irHoy.onclick = () => { S.fecha = S.hoy; cargar(); };
    $("#salir").onclick = salir;
    $$("[data-libre]").forEach((b) => b.onclick = () => abrirAgregar(b.dataset.libre));
    $$("[data-desbloq]").forEach((b) => b.onclick = () => desbloquear(Number(b.dataset.desbloq), b.dataset.desde));
    $$("[data-accion]").forEach((b) => b.onclick = () => marcar(b.dataset.id, b.dataset.accion));
  }

  function tarjeta(t) {
    const hecho = t.estado === "Asistió";
    const novino = t.estado === "No vino";
    const v = t.visitas || 0;
    const quien = v === 0 ? "primera visita" : v >= 3 ? `cliente frecuente (${v} visitas)` : `${v} ${v === 1 ? "visita" : "visitas"}`;
    const pills = [];
    if (hecho) pills.push(`<span class="pill">Asistió</span>`);
    else if (novino) pills.push(`<span class="pill pill--warn">No vino</span>`);
    else if (t.estado === "Pendiente de pago") pills.push(`<span class="pill pill--warn">Pagando la seña…</span>`);
    else pills.push(`<span class="pill">Confirmado</span>`);
    if (t.origen && t.origen !== "Web") pills.push(`<span class="pill pill--info">Cargado a mano (${esc(t.origen)})</span>`);
    if (t.pagoResto) pills.push(`<span class="pill pill--dark">Pagado completo</span>`);
    else if (t.senaPagada) pills.push(`<span class="pill pill--ok">Seña pagada · resta ${plata(t.resta)}</span>`);
    else if (!novino) pills.push(`<span class="pill pill--warn">Seña pendiente · ${plata(t.resta)}</span>`);

    const btn = (accion, texto, oscuro) => `<button type="button" class="btn ${oscuro ? "btn--dark" : "btn--outline"}" data-id="${esc(t.id)}" data-accion="${accion}">${texto}</button>`;
    let acciones = "";
    const pagando = t.estado === "Pendiente de pago";
    if (pagando) acciones = `<p class="tc__notas">El cliente está pagando la seña. Si no paga en 15 minutos, el horario se libera solo.</p>`;
    else if (!hecho && !novino) acciones = `<div class="tc__acciones">${btn("asistio", "Asistió", true)}${t.pagoResto ? "" : btn("pagoResto", "Pagó el resto")}${btn("novino", "No vino")}</div>`;
    else if (hecho && !t.pagoResto) acciones = `<div class="tc__acciones" style="grid-template-columns:1fr">${btn("pagoResto", "Pagó el resto · " + plata(t.resta), true)}</div>`;
    const mas = [
      t.whatsapp ? `<a href="${esc(t.whatsapp)}" target="_blank" rel="noopener">WhatsApp</a>` : "",
      hecho || novino || t.pagoResto ? `<button type="button" data-id="${esc(t.id)}" data-accion="deshacer">Deshacer</button>` : "",
      !hecho && !novino && !pagando ? `<button type="button" data-id="${esc(t.id)}" data-accion="cancelar">Cancelar turno</button>` : "",
    ].filter(Boolean).join("");
    return `<article class="tc ${hecho ? "tc--hecho" : ""} ${novino ? "tc--novino" : ""}" data-turno="${esc(t.id)}">
      <div class="tc__row">
        <span class="tc__hora">${esc(t.hora)}</span>
        <div class="tc__main">
          <div class="tc__cliente">${esc(t.cliente)}</div>
          <div class="tc__sub">${esc(t.servicio)} · ${quien}</div>
        </div>
      </div>
      <div class="tc__pills">${pills.join("")}</div>
      ${acciones}
      ${t.notas ? `<div class="tc__notas">${esc(t.notas)}</div>` : ""}
      ${mas ? `<div class="tc__mas">${mas}</div>` : ""}
    </article>`;
  }

  async function marcar(id, accion, sinDeshacer) {
    const t = S.dia.turnos.find((x) => x.id === id);
    if (!t) return;
    if (accion === "cancelar" && !confirm(`¿Cancelar el turno de ${t.cliente} a las ${t.hora}?` + (t.senaPagada ? "\n\nTiene la seña pagada: avisale al dueño si hay que devolverla." : ""))) return;
    const card = $(`[data-turno="${CSS.escape(id)}"]`);
    if (card) card.classList.add("is-busy");
    const antes = { estado: t.estado, pagoResto: t.pagoResto };
    try {
      const r = await llamar("marcar", { id, marca: accion });
      if (accion === "cancelar") S.dia.turnos = S.dia.turnos.filter((x) => x.id !== id);
      else Object.assign(t, r.turno);
      recalcularResumen(S.dia);
      renderDia();
      const textos = { asistio: "Marcado: asistió", novino: "Marcado: no vino", pagoResto: "Marcado: pagó el resto", cancelar: "Turno cancelado" };
      if (textos[accion] && !sinDeshacer && accion !== "cancelar") {
        aviso(textos[accion], async () => {
          await llamar("marcar", { id, marca: "deshacer" });
          if (antes.estado !== "Confirmado" || antes.pagoResto) await llamar("marcar", { id, marca: antes.estado === "Asistió" ? "asistio" : antes.estado === "No vino" ? "novino" : "deshacer" });
          if (antes.pagoResto) await llamar("marcar", { id, marca: "pagoResto" });
          cargar(true);
        });
      } else if (textos[accion]) aviso(textos[accion]);
      if (accion === "cancelar") cargar(true); // para que aparezca el hueco libre
    } catch (e) {
      if (card) card.classList.remove("is-busy");
      if (e.codigo !== "sesion") aviso(e.message);
    }
  }

  async function desbloquear(fila, desde) {
    if (!confirm("¿Desbloquear este horario? Va a quedar disponible en la web.")) return;
    try {
      await llamar("desbloquear", { fila, fecha: S.dia.fecha, desde });
      aviso("Horario desbloqueado");
      cargar();
    } catch (e) { if (e.codigo !== "sesion") aviso(e.message); }
  }

  /* ---------- Semana ---------- */
  function renderSemana() {
    const dias = S.semana || [];
    stats(dias.reduce((a, d) => ({ turnos: a.turnos + d.resumen.turnos, senas: a.senas + d.resumen.senas, restaCobrar: a.restaCobrar + d.resumen.restaCobrar }), { turnos: 0, senas: 0, restaCobrar: 0 }), "Turnos semana");
    $("#pnBody").innerHTML = dias.map((d) => {
      const lista = d.turnos.map((t) => `${t.hora} ${t.cliente.split(" ")[0]}`).join(" · ");
      const titulo = d.fecha === S.hoy ? "Hoy, " + d.fechaLarga : d.fechaLarga;
      return `<button type="button" class="sem ${d.atiende || d.turnos.length ? "" : "sem--cerrado"}" data-f="${d.fecha}">
        <div class="sem__top"><span class="sem__dia">${esc(titulo)}</span><span class="sem__cant">${d.atiende || d.turnos.length ? `${d.turnos.length} ${d.turnos.length === 1 ? "turno" : "turnos"}` : "No atendés"}</span></div>
        ${lista ? `<div class="sem__lista">${esc(lista)}</div>` : ""}
        ${d.bloqueos.length ? `<div class="sem__lista">Bloqueado: ${d.bloqueos.map((x) => x.desde ? `${x.desde}–${x.hasta}` : "todo el día").join(", ")}</div>` : ""}
      </button>`;
    }).join("");
    $$(".sem").forEach((b) => b.onclick = () => {
      S.fecha = b.dataset.f;
      S.tab = "dia";
      $$(".pn-tabs button").forEach((x) => x.classList.toggle("is-on", x.dataset.tab === "dia"));
      cargar();
    });
  }

  /* ---------- Clientes ---------- */
  function renderClientes() {
    const todos = S.clientes || [];
    $("#stTurnos").previousElementSibling.textContent = "Clientes";
    $("#stTurnos").textContent = todos.length;
    $("#stSenas").textContent = todos.filter((c) => c.recontactar).length;
    $("#stSenas").previousElementSibling.textContent = "Para recontactar";
    $("#stResta").textContent = todos.filter((c) => c.proximo).length;
    $("#stResta").previousElementSibling.textContent = "Con turno";
    const q = S.buscar.toLowerCase();
    const lista = todos.filter((c) => !q || c.nombre.toLowerCase().includes(q) || c.celular.replace(/\D/g, "").includes(q.replace(/\D/g, "") || "§"));
    const fila = (c) => {
      const sub = [
        `${c.visitas} ${c.visitas === 1 ? "visita" : "visitas"}`,
        c.diasSinVenir == null ? "todavía no vino" : c.diasSinVenir <= 0 ? "vino hoy" : c.diasSinVenir === 1 ? "vino ayer" : `vino hace ${c.diasSinVenir} días`,
        c.proximo ? `próximo turno: ${F.larga(c.proximo)}` : "",
      ].filter(Boolean).join(" · ");
      return `<div class="cli"><div class="cli__main"><div class="cli__nombre">${esc(c.nombre)}</div><div class="cli__sub">${esc(sub)}</div></div>
        ${c.whatsapp ? `<a class="btn ${c.recontactar ? "btn--dark" : "btn--outline"}" href="${esc(c.whatsapp)}" target="_blank" rel="noopener">WhatsApp</a>` : ""}</div>`;
    };
    const rec = lista.filter((c) => c.recontactar);
    const resto = lista.filter((c) => !c.recontactar);
    $("#pnBody").innerHTML = `
      <input class="pn-buscar" id="buscar" type="search" placeholder="Buscar por nombre o celular" value="${esc(S.buscar)}" />
      ${rec.length ? `<p class="pn-seccion">Para recontactar · hace mucho que no vienen</p>${rec.map(fila).join("")}` : ""}
      ${resto.length ? `<p class="pn-seccion">Todos</p>${resto.map(fila).join("")}` : ""}
      ${!lista.length ? `<div class="pn-vacio">${todos.length ? "No hay clientes con esa búsqueda." : "Todavía no hay clientes."}</div>` : ""}`;
    const b = $("#buscar");
    b.oninput = () => { S.buscar = b.value; renderClientes(); const nb = $("#buscar"); nb.focus(); nb.setSelectionRange(nb.value.length, nb.value.length); };
  }

  /* ---------- Fotos ---------- */
  function renderFotos() {
    const f = S.fotos || { perfil: null, cortes: [], antesDespues: [] };
    $("#stTurnos").previousElementSibling.textContent = "Fotos";
    $("#stTurnos").textContent = f.cortes.length;
    $("#stSenas").previousElementSibling.textContent = "Antes y después";
    $("#stSenas").textContent = f.antesDespues.length;
    $("#stResta").previousElementSibling.textContent = "Foto de perfil";
    $("#stResta").textContent = f.perfil ? "✓" : "Falta";
    const tile = (x) => `<div class="ft">
        ${x.video ? `<div class="ft__video">▶ Video</div>` : `<img src="${esc(srcFoto(x.id, 400))}" alt="" loading="lazy" />`}
        <div class="ft__acc">
          ${x.video ? "" : `<button type="button" data-perfil-foto="${esc(x.id)}">Perfil</button>`}
          <button type="button" data-borrar="${esc(x.id)}">Borrar</button>
        </div>
      </div>`;
    $("#pnBody").innerHTML = `
      <input type="file" id="inCortes" accept="image/*" multiple hidden />
      <input type="file" id="inPerfil" accept="image/*" hidden />
      <div class="ft-subir">
        <button type="button" class="btn btn--dark" id="btSubir">Subir fotos de cortes</button>
        <button type="button" class="btn btn--outline" id="btAD">Antes y después</button>
      </div>
      <p class="bk-note">Aparecen en la web en un minuto. Elegí las mejores: se ven en tu perfil y en "Cortes recientes".</p>
      <p class="pn-seccion">Foto de perfil</p>
      <div class="ft-perfil">
        ${f.perfil ? `<img src="${esc(srcFoto(f.perfil, 400))}" alt="Tu foto de perfil" />` : `<div class="ft-perfil__vacio">Sin foto</div>`}
        <div><button type="button" class="btn btn--outline btn--xs" id="btPerfil">${f.perfil ? "Cambiar foto de perfil" : "Subir foto de perfil"}</button>
        <p class="bk-note">Una foto tuya trabajando. Se ve en tu tarjeta y en tu perfil.</p></div>
      </div>
      ${f.antesDespues.length ? `<p class="pn-seccion">Antes y después</p>${f.antesDespues.map((p) => `<div class="ft-ad">
        <img src="${esc(srcFoto(p[0], 400))}" alt="Antes" /><img src="${esc(srcFoto(p[1], 400))}" alt="Después" />
        <button type="button" class="btn btn--outline btn--xs" data-borrar-par="${esc(p[0])}|${esc(p[1])}">Borrar</button></div>`).join("")}` : ""}
      <p class="pn-seccion">Tus cortes (${f.cortes.length})</p>
      ${f.cortes.length ? `<div class="ft-grid">${f.cortes.map(tile).join("")}</div>` : `<div class="pn-vacio">Todavía no subiste fotos de cortes.</div>`}
      <button type="button" class="pn-salir" id="salir">Salir del panel</button>`;
    $("#salir").onclick = salir;
    $("#btSubir").onclick = () => $("#inCortes").click();
    $("#btPerfil").onclick = () => $("#inPerfil").click();
    $("#btAD").onclick = abrirAntesDespues;
    $("#inCortes").onchange = (e) => subir([...e.target.files], "corte");
    $("#inPerfil").onchange = (e) => subir([...e.target.files].slice(0, 1), "perfil");
    $$("[data-perfil-foto]").forEach((b) => b.onclick = () => accionFoto("perfil", { id: b.dataset.perfilFoto }, "Listo, es tu nueva foto de perfil"));
    $$("[data-borrar]").forEach((b) => b.onclick = () => confirm("¿Borrar esta foto? Se saca de la web.") && accionFoto("borrarFoto", { id: b.dataset.borrar }, "Foto borrada"));
    $$("[data-borrar-par]").forEach((b) => b.onclick = () => confirm("¿Borrar este antes y después?") && accionFoto("borrarFoto", { ids: b.dataset.borrarPar.split("|") }, "Borrado"));
  }

  /** Achica la foto en el celular antes de subirla (más rápido y liviano). */
  async function comprimir(archivo, max = 1600, calidad = 0.82) {
    let fuente;
    try { fuente = await createImageBitmap(archivo, { imageOrientation: "from-image" }); }
    catch {
      fuente = await new Promise((ok, mal) => {
        const im = new Image();
        im.onload = () => ok(im);
        im.onerror = () => mal(errorCon("datos", "No se pudo leer la foto. Probá con otra."));
        im.src = URL.createObjectURL(archivo);
      });
    }
    const w = fuente.width, h = fuente.height;
    const k = Math.min(1, max / Math.max(w, h));
    const c = document.createElement("canvas");
    c.width = Math.round(w * k);
    c.height = Math.round(h * k);
    c.getContext("2d").drawImage(fuente, 0, 0, c.width, c.height);
    return { tipo: "image/jpeg", datos: c.toDataURL("image/jpeg", calidad).split(",")[1] };
  }

  async function subir(archivos, clase) {
    if (!archivos.length) return;
    let hechos = 0;
    try {
      for (const a of archivos) {
        aviso(archivos.length > 1 ? `Subiendo ${hechos + 1} de ${archivos.length}…` : "Subiendo…");
        const f = await comprimir(a);
        await llamar("subirFoto", { clase, ...f });
        hechos++;
      }
      aviso(hechos === 1 ? "Foto subida" : `${hechos} fotos subidas`);
    } catch (e) {
      if (e.codigo !== "sesion") aviso((hechos ? `Se subieron ${hechos}. ` : "") + e.message);
    }
    cargar();
  }

  async function accionFoto(fn, p, texto) {
    try { await llamar(fn, p); aviso(texto); }
    catch (e) { if (e.codigo !== "sesion") aviso(e.message); }
    cargar();
  }

  function abrirAntesDespues() {
    abrirSheet("ANTES Y DESPUÉS", `
      <label class="field"><span>Foto de antes</span><input type="file" name="antes" accept="image/*" required /></label>
      <label class="field"><span>Foto de después</span><input type="file" name="despues" accept="image/*" required /></label>
      <p class="bk-note">En la web se ven juntas, con una barra para comparar. Sacalas desde el mismo ángulo.</p>`,
    async (form) => {
      const [a, d] = [form.antes.files[0], form.despues.files[0]];
      if (!a || !d) throw errorCon("datos", "Elegí las dos fotos.");
      aviso("Subiendo…");
      const [ca, cd] = [await comprimir(a, 1200), await comprimir(d, 1200)];
      await llamar("subirFoto", { clase: "antesDespues", antes: ca.datos, tipoAntes: ca.tipo, despues: cd.datos, tipoDespues: cd.tipo });
      aviso("Antes y después subido");
      cargar();
    }, "Subir");
  }

  /* ================================================================ */
  /* Agregar turno y bloquear                                          */
  /* ================================================================ */
  const sheet = $("#pnSheet");
  function abrirSheet(titulo, html, onSubmit, textoOk) {
    $("#shTitulo").textContent = titulo;
    const form = $("#shForm");
    form.innerHTML = html + `<div class="bk-alert" id="shError" hidden></div>`;
    $("#shOk").textContent = textoOk;
    form.onsubmit = async (e) => {
      e.preventDefault();
      const ok = $("#shOk");
      ok.disabled = true;
      $("#shError").hidden = true;
      try { await onSubmit(form); cerrarSheet(); }
      catch (ex) {
        if (ex.codigo !== "sesion") { $("#shError").textContent = ex.message; $("#shError").hidden = false; }
        else cerrarSheet();
      }
      ok.disabled = false;
    };
    sheet.hidden = false;
    document.body.classList.add("lock");
  }
  function cerrarSheet() { sheet.hidden = true; document.body.classList.remove("lock"); }
  sheet.addEventListener("click", (e) => { if (e.target === sheet || e.target.closest("[data-close]")) cerrarSheet(); });

  const opcionesHora = (sel, vacio) => (vacio ? `<option value="">—</option>` : "") + HORAS.map((h) => `<option ${h === sel ? "selected" : ""}>${h}</option>`).join("");

  function abrirAgregar(hora) {
    const fecha = S.tab === "dia" && S.dia ? S.dia.fecha : S.hoy;
    const servs = S.servicios.length ? S.servicios : D.servicios;
    abrirSheet("AGREGAR TURNO", `
      <div class="pn-fila">
        <label class="field"><span>Día</span><input type="date" name="fecha" value="${fecha}" required /></label>
        <label class="field"><span>Hora</span><select name="hora" required>${opcionesHora(hora || (S.dia && S.dia.libres[0] ? S.dia.libres[0].desde : "10:00"))}</select></label>
      </div>
      <label class="field"><span>Servicio</span><select name="servicio" required>${servs.map((s) => `<option value="${esc(s.nombre)}">${esc(s.nombre)} · ${s.duracion} min</option>`).join("")}</select></label>
      <label class="field"><span>Cliente</span><input type="text" name="cliente" placeholder="Nombre y apellido" maxlength="80" required /></label>
      <label class="field"><span>Celular</span><input type="tel" name="celular" inputmode="tel" placeholder="11 1234 5678" maxlength="30" /></label>
      <label class="field"><span>Llegó por</span><select name="origen"><option>WhatsApp</option><option>Teléfono</option><option>En el local</option></select></label>
      <label class="field"><span>Notas (opcional)</span><input type="text" name="notas" maxlength="200" /></label>`,
    async (f) => {
      const p = Object.fromEntries(new FormData(f));
      try { await llamar("agregar", p); }
      catch (e) {
        if (e.codigo !== "ocupado" || !confirm(e.message + "\n\n¿Agregarlo igual?")) throw e;
        await llamar("agregar", { ...p, forzar: true });
      }
      aviso("Turno agregado. Ya aparece ocupado en la web.");
      S.fecha = p.fecha;
      S.semana = null;
      if (S.tab !== "dia") $$(".pn-tabs button").forEach((x) => x.classList.toggle("is-on", x.dataset.tab === "dia"));
      S.tab = "dia";
      cargar();
    }, "Agregar turno");
  }

  function abrirBloquear() {
    const fecha = S.tab === "dia" && S.dia ? S.dia.fecha : S.hoy;
    abrirSheet("BLOQUEAR HORARIO", `
      <label class="field"><span>Día</span><input type="date" name="fecha" value="${fecha}" required /></label>
      <label class="pn-check"><input type="checkbox" name="todo" id="shTodo" /> Todo el día</label>
      <div class="pn-fila" id="shHoras">
        <label class="field"><span>Desde</span><select name="desde">${opcionesHora("13:00")}</select></label>
        <label class="field"><span>Hasta</span><select name="hasta">${opcionesHora("14:00")}</select></label>
      </div>
      <label class="field"><span>Motivo (opcional)</span><input type="text" name="motivo" placeholder="Almuerzo, médico, franco…" maxlength="100" /></label>
      <p class="bk-note">En ese horario la web no va a ofrecer turnos.</p>`,
    async (f) => {
      const p = Object.fromEntries(new FormData(f));
      if (p.todo) { p.desde = ""; p.hasta = ""; }
      delete p.todo;
      await llamar("bloquear", p);
      aviso("Horario bloqueado");
      S.fecha = p.fecha;
      S.semana = null;
      if (S.tab === "dia") cargar();
    }, "Bloquear");
    $("#shTodo").onchange = (e) => { $("#shHoras").hidden = e.target.checked; };
  }

  $("#btnAgregar").onclick = () => abrirAgregar();
  $("#btnBloquear").onclick = () => abrirBloquear();

  // Se actualiza solo cada minuto (por si entra una reserva de la web)
  setInterval(() => {
    if (S.sesion && !document.hidden && sheet.hidden && ["dia", "semana"].includes(S.tab)) cargar(true);
  }, 60000);
  document.addEventListener("visibilitychange", () => {
    if (!document.hidden && S.sesion) { S.hoy = F.hoy(); cargar(true); }
  });

  /* ================================================================ */
  /* Arranque                                                          */
  /* ================================================================ */
  try { S.sesion = JSON.parse(localStorage.getItem("pz_panel") || "null"); } catch { S.sesion = null; }
  if (S.sesion && S.sesion.token) abrirPanel(); else mostrarLogin();
})();
