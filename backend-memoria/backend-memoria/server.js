// Backend de talleres con los datos en MEMORIA (sin MySQL ni .env).
// Rutas: /api/talleres, /api/talleres/:id, /api/talleres/:id/asistencias, /api/asistencias, /api/usuarios
// Ojo: igual que el backend del proyecto, NO revisa cupo ni inscripciones repetidas (eso lo cuida el front).

const express = require('express');
const { randomUUID } = require('crypto');
const { datosIniciales } = require('./datos');

const PUERTO = process.env.PORT || 3001;
const db = datosIniciales();

const app = express();
app.use(express.json());

// Permite pedir datos directo desde otro origen (por si no usas el proxy de Next).
app.use((req, res, next) => {
  res.set('Access-Control-Allow-Origin', '*');
  res.set('Access-Control-Allow-Methods', 'GET,POST,PUT,DELETE,OPTIONS');
  res.set('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.sendStatus(204);
  next();
});

// ---------- Validaciones ----------
const esBoleta = (b) => typeof b === 'string' && /^\d{10}$/.test(b.trim());
const esFecha = (f) => typeof f === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(f) && !isNaN(new Date(f).getTime());
const esCorreo = (c) => typeof c === 'string' && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(c.trim());
const texto = (t) => (typeof t === 'string' ? t.trim() : '');

const buscarTaller = (id) => db.talleres.find((t) => t.id === id);
const asistenciasDe = (id) => db.asistencias.filter((a) => a.taller_id === id);

// ---------- Talleres ----------
app.get('/api/talleres', (req, res) => {
  const ordenados = [...db.talleres].sort((a, b) => a.fecha.localeCompare(b.fecha));
  res.json(ordenados);
});

app.get('/api/talleres/:id', (req, res) => {
  const taller = buscarTaller(req.params.id);
  if (!taller) return res.status(404).json({ error: 'Taller no encontrado' });
  res.json({ ...taller, asistentes: asistenciasDe(taller.id).length });
});

app.get('/api/talleres/:id/asistencias', (req, res) => {
  const taller = buscarTaller(req.params.id);
  if (!taller) return res.status(404).json({ error: 'Taller no encontrado' });
  res.json(asistenciasDe(taller.id));
});

function validarTaller(body, parcial = false) {
  const nombre = texto(body.nombre);
  if (!parcial || body.nombre !== undefined) {
    if (!nombre) return 'El nombre es obligatorio.';
  }
  if (!parcial || body.fecha !== undefined) {
    if (!esFecha(body.fecha)) return 'La fecha es obligatoria y debe tener el formato AAAA-MM-DD.';
  }
  if (body.cupo !== undefined && body.cupo !== null && body.cupo !== '') {
    const cupo = Number(body.cupo);
    if (!Number.isInteger(cupo) || cupo < 1) return 'El cupo debe ser un número entero mayor que 0.';
  }
  return null;
}

app.post('/api/talleres', (req, res) => {
  const error = validarTaller(req.body);
  if (error) return res.status(400).json({ error });
  const { nombre, instructor, fecha, cupo } = req.body;
  const nuevo = {
    id: randomUUID(),
    nombre: texto(nombre),
    instructor: texto(instructor) || null,
    fecha,
    cupo: cupo === undefined || cupo === null || cupo === '' ? 30 : Number(cupo),
  };
  db.talleres.push(nuevo);
  res.status(201).json(nuevo);
});

app.put('/api/talleres/:id', (req, res) => {
  const taller = buscarTaller(req.params.id);
  if (!taller) return res.status(404).json({ error: 'Taller no encontrado' });
  const error = validarTaller(req.body, true);
  if (error) return res.status(400).json({ error });
  const { nombre, instructor, fecha, cupo } = req.body;
  if (nombre !== undefined) taller.nombre = texto(nombre);
  if (instructor !== undefined) taller.instructor = texto(instructor) || null;
  if (fecha !== undefined) taller.fecha = fecha;
  if (cupo !== undefined && cupo !== null && cupo !== '') taller.cupo = Number(cupo);
  res.json(taller);
});

app.delete('/api/talleres/:id', (req, res) => {
  const i = db.talleres.findIndex((t) => t.id === req.params.id);
  if (i === -1) return res.status(404).json({ error: 'Taller no encontrado' });
  db.talleres.splice(i, 1);
  db.asistencias = db.asistencias.filter((a) => a.taller_id !== req.params.id);
  res.sendStatus(204);
});

// ---------- Asistencias ----------
app.get('/api/asistencias', (req, res) => {
  res.json(db.asistencias);
});

app.post('/api/asistencias', (req, res) => {
  const { taller_id, nombre_alumno, boleta } = req.body;
  if (!taller_id) return res.status(400).json({ error: 'El taller es obligatorio.' });
  if (!buscarTaller(taller_id)) return res.status(404).json({ error: 'Taller no encontrado' });
  if (!texto(nombre_alumno)) return res.status(400).json({ error: 'El nombre es obligatorio.' });
  if (!esBoleta(boleta)) return res.status(400).json({ error: 'La boleta debe tener 10 dígitos.' });

  const nueva = { id: randomUUID(), taller_id, nombre_alumno: texto(nombre_alumno), boleta: boleta.trim() };
  db.asistencias.push(nueva);
  res.status(201).json(nueva);
});

app.delete('/api/asistencias/:id', (req, res) => {
  const i = db.asistencias.findIndex((a) => a.id === req.params.id);
  if (i === -1) return res.status(404).json({ error: 'Asistencia no encontrada' });
  db.asistencias.splice(i, 1);
  res.sendStatus(204);
});

// ---------- Usuarios ----------
app.get('/api/usuarios', (req, res) => {
  res.json(db.usuarios);
});

app.get('/api/usuarios/:id', (req, res) => {
  const usuario = db.usuarios.find((u) => u.id === req.params.id);
  if (!usuario) return res.status(404).json({ error: 'Usuario no encontrado' });
  res.json(usuario);
});

app.post('/api/usuarios', (req, res) => {
  const { nombre, correo, boleta, rol } = req.body;
  if (!texto(nombre)) return res.status(400).json({ error: 'El nombre es obligatorio.' });
  if (!esCorreo(correo)) return res.status(400).json({ error: 'El correo no es válido.' });
  if (!esBoleta(boleta)) return res.status(400).json({ error: 'La boleta debe tener 10 dígitos.' });
  if (db.usuarios.some((u) => u.boleta === boleta.trim())) {
    return res.status(409).json({ error: 'Ya existe un usuario con esa boleta.' });
  }
  const nuevo = {
    id: randomUUID(),
    nombre: texto(nombre),
    correo: correo.trim(),
    boleta: boleta.trim(),
    rol: rol === 'admin' ? 'admin' : 'alumno',
  };
  db.usuarios.push(nuevo);
  res.status(201).json(nuevo);
});

// ---------- Errores ----------
app.use('/api', (req, res) => {
  res.status(404).json({ error: `No existe la ruta ${req.method} ${req.originalUrl}` });
});

app.use((err, req, res, next) => {
  if (err.type === 'entity.parse.failed') return res.status(400).json({ error: 'El cuerpo no es JSON válido.' });
  console.error(err);
  res.status(500).json({ error: 'Error interno del servidor' });
});

app.listen(PUERTO, () => {
  console.log(
    `Servidor escuchando en el puerto ${PUERTO} (BD: memoria; ${db.talleres.length} talleres, ` +
      `${db.usuarios.length} usuarios, ${db.asistencias.length} asistencias)`
  );
});
