/*
 * Datos de la barbería.
 * Todo lo que está entre [corchetes] se reemplaza con la información real.
 * Más adelante este archivo se va a alimentar desde la planilla de Google Sheets,
 * así que la estructura ya está pensada para eso.
 */
window.PLAYZONE = {
  negocio: {
    nombre: "Playzone Barber",
    instagram: "https://instagram.com/[usuario]",
    whatsapp: "https://wa.me/[5491100000000]",
    google: { rating: "[4,9]", reseñas: "[000]" },
    historia:
      "[Historia breve de la barbería: desde cuándo está, cómo empezó y qué va a encontrar el cliente cuando entra. Dos o tres líneas.]",
  },

  // Seña: tipo "fijo" (monto en $) o "porcentaje" (del precio del servicio)
  seña: { tipo: "porcentaje", valor: 30 },
  cancelacionHoras: 24,
  minutosReserva: 15,

  locales: [
    {
      id: "local1",
      nombre: "[Local 1]",
      telefono: "[Teléfono]",
      direccion: "[Dirección], [Barrio]",
      horarioTexto: "Lunes a sábado · [10 a 20 h]",
      apertura: "10:00",
      cierre: "20:00",
      diasAbierto: [1, 2, 3, 4, 5, 6], // 0 = domingo
      mapa: "https://www.google.com/maps/search/?api=1&query=Playzone+Barber",
    },
    {
      id: "local2",
      nombre: "[Local 2]",
      telefono: "[Teléfono]",
      direccion: "[Dirección], [Barrio]",
      horarioTexto: "Lunes a sábado · [10 a 20 h]",
      apertura: "10:00",
      cierre: "20:00",
      diasAbierto: [1, 2, 3, 4, 5, 6],
      mapa: "https://www.google.com/maps/search/?api=1&query=Playzone+Barber",
    },
  ],

  barberos: [
    {
      id: "b1",
      nombre: "[Barbero 1]",
      especialidad: "[fades y degradés]",
      local: "local1",
      dias: "[Mar a sáb]",
      experiencia: "[X años de experiencia]",
      descripcion:
        "[Descripción breve: cómo trabaja, qué estilos le gustan, qué lo diferencia. Dos o tres líneas en primera persona.]",
      instagram: "[@usuario]",
      tiktok: "#",
    },
    {
      id: "b2",
      nombre: "[Barbero 2]",
      especialidad: "[barba y navaja]",
      local: "local1",
      dias: "[Lun a vie]",
      experiencia: "[X años de experiencia]",
      descripcion: "[Descripción breve del barbero.]",
      instagram: "[@usuario]",
      tiktok: "#",
    },
    {
      id: "b3",
      nombre: "[Barbero 3]",
      especialidad: "[cortes clásicos]",
      local: "local2",
      dias: "[Mar a sáb]",
      experiencia: "[X años de experiencia]",
      descripcion: "[Descripción breve del barbero.]",
      instagram: "[@usuario]",
      tiktok: "#",
    },
    {
      id: "b4",
      nombre: "[Barbero 4]",
      especialidad: "[diseños]",
      local: "local2",
      dias: "[Lun a sáb]",
      experiencia: "[X años de experiencia]",
      descripcion: "[Descripción breve del barbero.]",
      instagram: "[@usuario]",
      tiktok: "#",
    },
  ],

  servicios: [
    { id: "corte", nombre: "Corte", precio: 0, duracion: 30 },
    { id: "corte-barba", nombre: "Corte + barba", precio: 0, duracion: 45 },
    { id: "barba", nombre: "Barba", precio: 0, duracion: 20 },
    { id: "infantil", nombre: "Corte infantil", precio: 0, duracion: 30 },
    { id: "afeitado", nombre: "Afeitado con navaja", precio: 0, duracion: 30 },
    { id: "otro", nombre: "[Otro servicio]", precio: 0, duracion: 30 },
  ],

  galeria: [
    { texto: "[Corte de Barbero 1]" },
    { texto: "[Antes / después]", antesDespues: true },
    { texto: "[Corte de Barbero 2]" },
    { texto: "[Corte de Barbero 3]" },
    { texto: "[Barba con navaja]" },
    { texto: "[Corte de Barbero 4]" },
  ],

  reseñas: [
    { texto: "[Reseña real de Google]", autor: "[Nombre del cliente]" },
    { texto: "[Reseña real de Google]", autor: "[Nombre del cliente]" },
    { texto: "[Reseña real de Google]", autor: "[Nombre del cliente]" },
  ],
};
