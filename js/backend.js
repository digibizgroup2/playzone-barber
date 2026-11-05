/*
 * Conexión con el sistema de reservas.
 * - Con PLAYZONE_API configurada: habla con la planilla (Google Apps Script) y Mercado Pago.
 * - Sin PLAYZONE_API: modo demo, todo simulado en este navegador.
 * Las dos versiones tienen las mismas funciones, así la web no tiene que saber cuál usa.
 */
(() => {
  "use strict";

  const TZ = "America/Argentina/Buenos_Aires";
  const DIAS_LARGOS = ["domingo", "lunes", "martes", "miércoles", "jueves", "viernes", "sábado"];
  const MESES = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"];

  // ---------- fechas como texto "2026-11-06", siempre en hora de Argentina ----------
  const F = {
    hoy: () => new Intl.DateTimeFormat("en-CA", { timeZone: TZ }).format(new Date()),
    minutosAhora: () => {
      const p = new Intl.DateTimeFormat("en-GB", { timeZone: TZ, hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).format(new Date());
      const [h, m] = p.split(":").map(Number);
      return h * 60 + m;
    },
    sumar: (f, n) => new Date(Date.parse(f + "T12:00:00Z") + n * 864e5).toISOString().slice(0, 10),
    dia: (f) => new Date(f + "T12:00:00Z").getUTCDay(),
    num: (f) => Number(f.slice(8, 10)),
    larga: (f) => `${DIAS_LARGOS[F.dia(f)]} ${F.num(f)} de ${MESES[Number(f.slice(5, 7)) - 1]}`,
    ms: (f, h) => Date.parse(`${f}T${h}:00-03:00`),
  };
  const toMin = (t) => { const [h, m] = t.split(":").map(Number); return h * 60 + m; };
  const hhmm = (m) => `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;

  function errorCon(codigo, mensaje) {
    const e = new Error(mensaje);
    e.codigo = codigo;
    return e;
  }

  /* ================================================================ */
  /* Backend real (Google Apps Script)                                 */
  /* ================================================================ */
  function backendReal(url) {
    async function leer(r) {
      let j;
      try { j = await r.json(); } catch { throw errorCon("red", "No pudimos conectarnos. Revisá tu conexión y probá de nuevo."); }
      if (!j.ok) throw errorCon(j.codigo, j.error);
      return j.data;
    }
    const get = async (params) => {
      try { return await leer(await fetch(url + "?" + new URLSearchParams(params))); }
      catch (e) { if (e.codigo) throw e; throw errorCon("red", "No pudimos conectarnos. Revisá tu conexión y probá de nuevo."); }
    };
    // text/plain evita el "preflight" de CORS, que Apps Script no soporta
    const post = async (body) => {
      try { return await leer(await fetch(url, { method: "POST", headers: { "Content-Type": "text/plain;charset=utf-8" }, body: JSON.stringify(body) })); }
      catch (e) { if (e.codigo) throw e; throw errorCon("red", "No pudimos conectarnos. Revisá tu conexión y probá de nuevo."); }
    };
    return {
      demo: false,
      async datos() {
        // Si la página ya los pidió al arrancar (ver <head>), usamos ese pedido
        const pre = window.PZ_DATOS;
        window.PZ_DATOS = null;
        if (pre) { const j = await pre; if (j && j.ok) return j.data; }
        return get({ accion: "datos" });
      },
      horarios: (p) => get({ accion: "horarios", ...p }).then((d) => d.horarios),
      cliente: (celular) => get({ accion: "cliente", celular }),
      reservar: (p) => post({ accion: "reservar", ...p }),
      verificar: (p) => post({ accion: "verificar", ...p }),
      liberar: (p) => post({ accion: "liberar", ...p }),
      turno: (p) => get({ accion: "turno", ...p }),
      cancelar: (p) => post({ accion: "cancelar", ...p }),
      reprogramar: (p) => post({ accion: "reprogramar", ...p }),
    };
  }

  /* ================================================================ */
  /* Backend demo (todo simulado en el navegador)                      */
  /* ================================================================ */
  function backendDemo(D) {
    const KEY = "pz_demo_turnos";
    const leerTurnos = () => JSON.parse(localStorage.getItem(KEY) || "[]");
    const guardarTurnos = (l) => localStorage.setItem(KEY, JSON.stringify(l));
    const barbero = (n) => D.barberos.find((b) => b.id === n);
    const local = (n) => D.locales.find((l) => l.id === n);
    const servicio = (n) => D.servicios.find((s) => s.id === n);
    const sena = (precio) => (D.seña.tipo === "fijo" ? D.seña.valor : Math.round((precio * D.seña.valor) / 100));
    const espera = (ms) => new Promise((r) => setTimeout(r, ms));

    // Horarios tomados "de mentira" pero siempre iguales para el mismo barbero, día y hora
    function tomadoFalso(b, f, h) {
      let x = 0;
      for (const c of b + f + h) x = (x * 31 + c.charCodeAt(0)) >>> 0;
      return x % 100 < 28;
    }

    function horariosBarbero(nombre, srv, fecha, excluir) {
      const b = barbero(nombre);
      const l = local(b.local);
      const dur = servicio(srv).duracion;
      if (!l.diasAbierto.includes(F.dia(fecha))) return [];
      const hoy = F.hoy();
      const minimo = fecha === hoy ? F.minutosAhora() + 60 : -1;
      const propios = leerTurnos().filter((t) => t.barbero === nombre && t.fecha === fecha && t.id !== excluir && !["Cancelado", "Vencido"].includes(t.estado));
      const out = [];
      for (let m = toMin(l.apertura); m + dur <= toMin(l.cierre); m += dur) {
        if (m < minimo) continue;
        const choca = propios.some((t) => m < toMin(t.hora) + t.duracion && m + dur > toMin(t.hora));
        out.push({ hora: hhmm(m), libre: !choca && !tomadoFalso(nombre, fecha, hhmm(m)) });
      }
      return out;
    }

    function publico(t) {
      const l = local(t.local);
      return {
        ...t, barbero: barbero(t.barbero).nombre, local: l.nombre,
        fechaLarga: F.larga(t.fecha), direccion: l.direccion, mapa: l.mapa,
        senaPagada: t.estado !== "Pendiente de pago" && t.sena > 0, token: undefined,
      };
    }

    function buscar(p) {
      const t = leerTurnos().find((x) => x.id === p.id && x.token === p.t);
      if (!t) throw errorCon("no_encontrado", "No encontramos ese turno.");
      return t;
    }
    function cambiar(id, cambios) {
      const l = leerTurnos();
      const i = l.findIndex((x) => x.id === id);
      Object.assign(l[i], cambios);
      guardarTurnos(l);
      return l[i];
    }

    return {
      demo: true,
      datos: async () => D,
      async horarios({ barbero: b, servicio: s, fecha, turno }) {
        await espera(250);
        const lista = b ? [b] : D.barberos.map((x) => x.id);
        const mapa = {};
        lista.forEach((n) => horariosBarbero(n, s, fecha, turno).forEach((h) => { mapa[h.hora] = mapa[h.hora] || h.libre; }));
        return Object.keys(mapa).sort().map((h) => ({ hora: h, libre: mapa[h] }));
      },
      async cliente(cel) {
        const c = JSON.parse(localStorage.getItem("pz_clientes") || "{}")[cel.replace(/\D/g, "").slice(-10)];
        return c ? { encontrado: true, nombre: c.nombre, mailOculto: c.mail.replace(/^(.{2})[^@]*(@.*)$/, "$1•••$2") } : { encontrado: false };
      },
      async reservar(p) {
        await espera(500);
        let nombreB = p.barbero;
        if (!nombreB) nombreB = (D.barberos.find((b) => horariosBarbero(b.id, p.servicio, p.fecha).some((h) => h.hora === p.hora && h.libre)) || {}).id;
        if (!nombreB || !horariosBarbero(nombreB, p.servicio, p.fecha).some((h) => h.hora === p.hora && h.libre)) {
          throw errorCon("ocupado", "Ese horario se acaba de ocupar. Elegí otro.");
        }
        const clientes = JSON.parse(localStorage.getItem("pz_clientes") || "{}");
        const k = p.celular.replace(/\D/g, "").slice(-10);
        const mail = p.mail || (clientes[k] || {}).mail || "";
        clientes[k] = { nombre: p.nombre, mail };
        localStorage.setItem("pz_clientes", JSON.stringify(clientes));
        const s = servicio(p.servicio);
        const t = {
          id: "DEMO-" + Math.random().toString(36).slice(2, 6).toUpperCase(),
          token: crypto.randomUUID ? crypto.randomUUID() : String(Math.random()).slice(2) + String(Math.random()).slice(2),
          fecha: p.fecha, hora: p.hora, fin: hhmm(toMin(p.hora) + s.duracion), duracion: s.duracion,
          barbero: nombreB, local: barbero(nombreB).local, servicio: s.nombre, cliente: p.nombre, mail,
          precio: s.precio, sena: sena(s.precio), resta: s.precio - sena(s.precio), estado: "Pendiente de pago",
        };
        guardarTurnos([...leerTurnos(), t]);
        return { estado: t.estado, turno: publico(t), token: t.token, pago: null, vence: Date.now() + D.minutosReserva * 60000 };
      },
      async verificar(p) {
        await espera(600);
        const t = buscar(p);
        return publico(t.estado === "Pendiente de pago" ? cambiar(t.id, { estado: "Confirmado" }) : t);
      },
      async liberar(p) {
        const t = buscar(p);
        if (t.estado === "Pendiente de pago") cambiar(t.id, { estado: "Vencido" });
        return {};
      },
      async turno(p) {
        const t = buscar(p);
        const horas = (F.ms(t.fecha, t.hora) - Date.now()) / 36e5;
        return { turno: publico(t), aTiempo: horas >= D.cancelacionHoras, puedeCambiar: t.estado === "Confirmado" && horas > 0, horasLimite: D.cancelacionHoras };
      },
      async cancelar(p) {
        await espera(400);
        const t = buscar(p);
        if (t.estado !== "Confirmado") throw errorCon("estado", "Este turno ya no se puede cancelar.");
        const aTiempo = (F.ms(t.fecha, t.hora) - Date.now()) / 36e5 >= D.cancelacionHoras;
        cambiar(t.id, { estado: "Cancelado" });
        return { estado: "Cancelado", senaDevuelta: aTiempo && t.sena > 0 };
      },
      async reprogramar(p) {
        await espera(400);
        const t = buscar(p);
        if (!horariosBarbero(t.barbero, Object.values(D.servicios).find((s) => s.nombre === t.servicio).id, p.fecha, t.id).some((h) => h.hora === p.hora && h.libre)) {
          throw errorCon("ocupado", "Ese horario se acaba de ocupar. Elegí otro.");
        }
        return { turno: publico(cambiar(t.id, { fecha: p.fecha, hora: p.hora, fin: hhmm(toMin(p.hora) + t.duracion) })) };
      },
    };
  }

  window.PZ = {
    F,
    crearBackend: (D) => (window.PLAYZONE_API ? backendReal(window.PLAYZONE_API) : backendDemo(D)),
  };
})();
