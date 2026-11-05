/*
 * Fotos y videos que vienen de Google Drive.
 * Cada foto llega como su ID de Drive (o { id, v: 1 } si es un video).
 */
(() => {
  "use strict";
  const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const idDe = (x) => (typeof x === "string" ? x : x && x.id);
  const esVideo = (x) => !!(x && typeof x === "object" && x.v);

  /** Link a la imagen en el tamaño pedido (Drive la achica sola). */
  const url = (id, ancho = 800) => `https://lh3.googleusercontent.com/d/${encodeURIComponent(id)}=w${ancho}`;
  const urlAlternativa = (id, ancho = 800) => `https://drive.google.com/thumbnail?id=${encodeURIComponent(id)}&sz=w${ancho}`;

  // Si el primer servidor de Drive falla, probamos con el otro
  document.addEventListener("error", (e) => {
    const img = e.target;
    if (img.tagName !== "IMG" || !img.dataset.drive || img.dataset.alt) return;
    img.dataset.alt = "1";
    img.src = urlAlternativa(img.dataset.drive, img.dataset.w);
  }, true);

  function img(x, ancho, alt = "", clase = "") {
    const id = idDe(x);
    return `<img class="foto ${clase}" src="${url(id, ancho)}" data-drive="${esc(id)}" data-w="${ancho}" alt="${esc(alt)}" loading="lazy" decoding="async" />`;
  }

  /** Miniatura que abre el visor. `grupo` agrupa las fotos que se recorren juntas. */
  function miniatura(x, { ancho = 600, alt = "", pie = "", grupo = "", i = 0 } = {}) {
    return `<button type="button" class="foto-btn" data-grupo="${esc(grupo)}" data-i="${i}" aria-label="${esc(alt || "Ver foto")}">
      ${img(x, ancho, alt)}
      ${esVideo(x) ? `<span class="foto-play" aria-hidden="true">▶</span>` : ""}
      ${pie ? `<span class="foto-pie">${esc(pie)}</span>` : ""}
    </button>`;
  }

  /** Comparador antes / después. */
  function antesDespues(antes, despues, pie = "") {
    return `<div class="ba" style="--pos:50%">
      <div class="ba__layer ba__before">${img(antes, 900, "Antes")}<span class="ba__tag">Antes</span></div>
      <div class="ba__layer ba__after">${img(despues, 900, "Después")}<span class="ba__tag ba__tag--r">Después</span></div>
      <div class="ba__handle"></div>
      <input type="range" min="0" max="100" value="50" aria-label="Comparar antes y después${pie ? " · " + esc(pie) : ""}" />
      ${pie ? `<span class="foto-pie">${esc(pie)}</span>` : ""}
    </div>`;
  }

  function activarComparadores(raiz = document) {
    raiz.querySelectorAll(".ba").forEach((ba) => {
      const r = ba.querySelector("input");
      if (r.dataset.ok) return;
      r.dataset.ok = "1";
      r.addEventListener("input", () => ba.style.setProperty("--pos", r.value + "%"));
    });
  }

  /* ---------------- Visor (lightbox) ---------------- */
  const grupos = {};
  let actual = { lista: [], i: 0 };
  const visor = document.createElement("div");
  visor.className = "visor";
  visor.hidden = true;
  visor.setAttribute("role", "dialog");
  visor.setAttribute("aria-modal", "true");
  visor.innerHTML = `
    <button type="button" class="visor__x" aria-label="Cerrar">✕</button>
    <button type="button" class="visor__nav visor__ant" aria-label="Anterior">‹</button>
    <div class="visor__media"></div>
    <button type="button" class="visor__nav visor__sig" aria-label="Siguiente">›</button>
    <div class="visor__cuenta"></div>`;
  document.addEventListener("DOMContentLoaded", () => document.body.appendChild(visor));
  if (document.body) document.body.appendChild(visor);

  function mostrar() {
    const x = actual.lista[actual.i];
    const id = idDe(x);
    visor.querySelector(".visor__media").innerHTML = esVideo(x)
      ? `<iframe src="https://drive.google.com/file/d/${encodeURIComponent(id)}/preview" allow="autoplay; fullscreen" allowfullscreen title="Video"></iframe>`
      : `<img src="${url(id, 1600)}" data-drive="${esc(id)}" data-w="1600" alt="" />`;
    const varios = actual.lista.length > 1;
    visor.querySelector(".visor__cuenta").textContent = varios ? `${actual.i + 1} / ${actual.lista.length}` : "";
    visor.querySelectorAll(".visor__nav").forEach((b) => { b.hidden = !varios; });
  }
  function abrir(lista, i = 0) {
    if (!lista || !lista.length) return;
    actual = { lista, i };
    mostrar();
    visor.hidden = false;
    document.body.classList.add("lock");
  }
  function cerrar() {
    visor.hidden = true;
    visor.querySelector(".visor__media").innerHTML = "";
    if (![...document.querySelectorAll(".sheet")].some((s) => !s.hidden)) document.body.classList.remove("lock");
  }
  const mover = (d) => { actual.i = (actual.i + d + actual.lista.length) % actual.lista.length; mostrar(); };
  visor.addEventListener("click", (e) => {
    if (e.target.closest(".visor__x") || e.target === visor) cerrar();
    else if (e.target.closest(".visor__ant")) mover(-1);
    else if (e.target.closest(".visor__sig")) mover(1);
  });
  document.addEventListener("keydown", (e) => {
    if (visor.hidden) return;
    if (e.key === "Escape") { e.stopPropagation(); cerrar(); }
    if (e.key === "ArrowLeft") mover(-1);
    if (e.key === "ArrowRight") mover(1);
  }, true);
  let x0 = null;
  visor.addEventListener("touchstart", (e) => { x0 = e.touches[0].clientX; }, { passive: true });
  visor.addEventListener("touchend", (e) => {
    if (x0 === null) return;
    const dx = e.changedTouches[0].clientX - x0;
    if (Math.abs(dx) > 50) mover(dx < 0 ? 1 : -1);
    x0 = null;
  });
  document.addEventListener("click", (e) => {
    const b = e.target.closest("[data-grupo][data-i]");
    if (b && grupos[b.dataset.grupo]) abrir(grupos[b.dataset.grupo], Number(b.dataset.i));
  });

  window.PZFotos = {
    url, img, miniatura, antesDespues, activarComparadores, idDe, esVideo,
    grupo: (nombre, lista) => { grupos[nombre] = lista; },
    abrir,
  };
})();
