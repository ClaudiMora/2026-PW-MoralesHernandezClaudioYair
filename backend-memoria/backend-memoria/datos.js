// Datos de ejemplo. Viven en memoria: cada vez que reinicias el servidor vuelven a ser estos.
// Los id de los talleres son fijos para que las URL de la guía siempre funcionen.

const PYTHON = 'a1000000-0000-4000-8000-000000000001';
const REDES = 'a1000000-0000-4000-8000-000000000002';
const BD = 'a1000000-0000-4000-8000-000000000003';
const GIT = 'a1000000-0000-4000-8000-000000000004';
const NEXT = 'a1000000-0000-4000-8000-000000000005';

function datosIniciales() {
  const usuarios = [
    { id: 'u1000000-0000-4000-8000-000000000000', nombre: 'Admin Semilla', correo: 'admin@ipn.mx', boleta: '0000000000', rol: 'admin' },
    { id: 'u1000000-0000-4000-8000-000000000001', nombre: 'Ana López', correo: 'ana.lopez@alumno.ipn.mx', boleta: '2026090001', rol: 'alumno' },
    { id: 'u1000000-0000-4000-8000-000000000002', nombre: 'Luis Pérez', correo: 'luis.perez@alumno.ipn.mx', boleta: '2026090002', rol: 'alumno' },
    { id: 'u1000000-0000-4000-8000-000000000003', nombre: 'María Hernández', correo: 'maria.hernandez@alumno.ipn.mx', boleta: '2026090003', rol: 'alumno' },
  ];

  // Fechas como texto 'AAAA-MM-DD' (igual que una columna DATE de MySQL).
  const talleres = [
    { id: PYTHON, nombre: 'Introducción a Python', instructor: 'Mtro. Carlos Ruiz', fecha: '2026-10-26', cupo: 20 },
    { id: REDES, nombre: 'Fundamentos de Redes', instructor: 'Ing. Jorge Salinas', fecha: '2026-11-09', cupo: 15 },
    { id: BD, nombre: 'Diseño de Bases de Datos', instructor: 'Ing. Ana Torres', fecha: '2026-11-11', cupo: 10 },
    { id: GIT, nombre: 'Git y GitHub en equipo', instructor: 'Lic. Sofía Méndez', fecha: '2026-10-28', cupo: 3 },
    { id: NEXT, nombre: 'Next.js desde cero', instructor: null, fecha: '2026-11-04', cupo: 2 },
  ];

  const asistencias = [
    { id: 'b1000000-0000-4000-8000-000000000001', taller_id: PYTHON, nombre_alumno: 'Ana López', boleta: '2026090001' },
    { id: 'b1000000-0000-4000-8000-000000000002', taller_id: PYTHON, nombre_alumno: 'Alumno sin cuenta', boleta: '2026999999' },
    { id: 'b1000000-0000-4000-8000-000000000003', taller_id: GIT, nombre_alumno: 'Ana López', boleta: '2026090001' },
    { id: 'b1000000-0000-4000-8000-000000000004', taller_id: GIT, nombre_alumno: 'Luis Pérez', boleta: '2026090002' },
    { id: 'b1000000-0000-4000-8000-000000000005', taller_id: NEXT, nombre_alumno: 'Luis Pérez', boleta: '2026090002' },
    { id: 'b1000000-0000-4000-8000-000000000006', taller_id: NEXT, nombre_alumno: 'María Hernández', boleta: '2026090003' },
  ];

  return { usuarios, talleres, asistencias };
}

module.exports = { datosIniciales };
