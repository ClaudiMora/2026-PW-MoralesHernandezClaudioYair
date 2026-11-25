// La aplicación de la demo. server.js la arranca; las pruebas la arrancan con otras configuraciones.
// Parte 1: sesiones con cookie (semana 12). Parte 2: JWT (semana 13).
// OJO: TODAS las rutas van DENTRO de crearApp(), porque ahí es donde existen app, config, usuarios y tokens.
const path = require('path');
const crypto = require('crypto'); // para el id único (jti) de cada token
const express = require('express');
const session = require('express-session');
const MySQLStore = require('express-mysql-session')(session);
const jwt = require('jsonwebtoken'); // firma y verifica los JWT
const { crearModeloUsuarios } = require('./modelos/usuarios.modelo');
const { crearModeloTokens } = require('./modelos/tokens.modelo');

const NOMBRE_COOKIE = 'connect.sid';

// Regresa todas las sesiones del almacén (MemoryStore usa callback; MySQLStore regresa una promesa).
function todasLasSesiones(almacen) {
  return new Promise((resolve, reject) => {
    const promesa = almacen.all((error, sesiones) => (error ? reject(error) : resolve(sesiones)));
    if (promesa && typeof promesa.then === 'function') promesa.then(resolve, reject);
  });
}

// Los primeros 8 caracteres del id de sesión, para poder compararlos en pantalla.
const idCorto = (id) => (id ? `${id.slice(0, 8)}…` : null);

// pool: la conexión a MySQL (db.js). Los usuarios SIEMPRE se leen de MySQL.
function crearApp(config, pool) {
  const app = express();
  app.use(express.json());

  const usuarios = crearModeloUsuarios(pool);
  const tokens = crearModeloTokens(pool); // lista negra de JWT (tabla tokens_revocados)

  // Aquí vive lo que el servidor recuerda de cada sesión:
  //  - 'mysql':   en la tabla sessions. Sobrevive a un reinicio y la puedes ver en Workbench.
  //  - 'memoria': en la memoria del proceso. Si el servidor se reinicia, se pierde todo.
  const almacen =
    config.almacen === 'memoria'
      ? new session.MemoryStore()
      : new MySQLStore({ createDatabaseTable: false, clearExpired: false }, pool);
  app.locals.almacen = almacen;

  // Paso 1: configurar express-session ANTES de las rutas.
  app.use(
    session({
      name: NOMBRE_COOKIE,
      secret: process.env.SESSION_SECRET || 'secreto-solo-para-la-demo',
      store: almacen,
      resave: false,
      saveUninitialized: false, // no crea sesión ni cookie hasta que haya algo que guardar
      rolling: config.rolling,
      cookie: {
        maxAge: config.maxAgeMs,
        httpOnly: config.httpOnly,
        sameSite: config.sameSite,
        secure: false, // true solo con https
      },
    })
  );

  // ===================== SESIÓN CON COOKIE (semana 12) =====================

  // Paso 5: el que decide si la sesión venció es el servidor, no el navegador.
  function vencida(sesion) {
    const desde = config.rolling ? sesion.ultimoUso : sesion.creada;
    return Date.now() - desde > config.maxAgeMs;
  }

  // 401: "no sé quién eres" (no hay sesión o ya venció).
  function requiereSesion(req, res, next) {
    if (req.session.usuario && vencida(req.session)) {
      return req.session.destroy(() => {
        res.clearCookie(NOMBRE_COOKIE);
        res.status(401).json({ error: '401 · Tu sesión venció: vuelve a iniciar sesión' });
      });
    }
    if (!req.session.usuario) {
      return res.status(401).json({ error: '401 · No has iniciado sesión (o tu sesión ya venció)' });
    }
    req.session.ultimoUso = Date.now();
    next();
  }

  // Paso 3 · 403: "sé quién eres, pero no tienes permiso".
  function requiereRol(rol) {
    return (req, res, next) => {
      if (req.session.usuario.rol !== rol) {
        return res.status(403).json({
          error: `403 · Eres ${req.session.usuario.usuario}, pero esta ruta es solo para ${rol}`,
        });
      }
      next();
    };
  }

  app.get('/api/config', (req, res) => res.json(config));

  // Guarda un contador en la sesión. Sirve para ver que la sesión existe antes de entrar
  // (y para la demostración de fijación de sesión).
  app.post('/api/visita', (req, res) => {
    req.session.visitas = (req.session.visitas || 0) + 1;
    res.json({ visitas: req.session.visitas, sesion: idCorto(req.sessionID) });
  });

  // Paso 2: iniciar sesión. Paso 7: regenerar el id al entrar.
  app.post('/api/login', async (req, res, next) => {
    try {
      const { usuario, contrasena } = req.body || {};
      const datos = await usuarios.verificar(usuario, contrasena);
      if (!datos) return res.status(401).json({ error: 'Usuario o contraseña incorrectos' });

      const antes = req.session.visitas !== undefined ? idCorto(req.sessionID) : null;
      const visitas = req.session.visitas || 0;

      const guardar = () => {
        req.session.usuario = datos;
        req.session.visitas = visitas;
        req.session.creada = Date.now();
        req.session.ultimoUso = Date.now();
        req.session.save((error) => {
          if (error) return next(error);
          res.json({ usuario: datos, sesionAntes: antes, sesionDespues: idCorto(req.sessionID) });
        });
      };

      // regenerate cambia el id al entrar: es lo que evita la fijación de sesión.
      if (config.regenerarAlEntrar) {
        req.session.regenerate((error) => (error ? next(error) : guardar()));
      } else {
        guardar();
      }
    } catch (error) {
      next(error);
    }
  });

  // Paso 2: cerrar sesión.
  app.post('/api/logout', (req, res, next) => {
    req.session.destroy((error) => {
      if (error) return next(error);
      res.clearCookie(NOMBRE_COOKIE);
      res.json({ mensaje: 'Sesión cerrada: el servidor la borró' });
    });
  });

  app.get('/api/sesion', requiereSesion, (req, res) => {
    const desde = config.rolling ? req.session.ultimoUso : req.session.creada;
    res.json({
      usuario: req.session.usuario,
      sesion: idCorto(req.sessionID),
      expiraEnSegundos: Math.max(0, Math.round((desde + config.maxAgeMs - Date.now()) / 1000)),
    });
  });

  app.get('/api/perfil', requiereSesion, (req, res) => {
    req.session.visitas = (req.session.visitas || 0) + 1;
    res.json({ mensaje: `Hola, ${req.session.usuario.nombre}`, rol: req.session.usuario.rol, visitas: req.session.visitas });
  });

  app.get('/api/admin/reporte', requiereSesion, requiereRol('admin'), (req, res) => {
    res.json({ reporte: 'Talleres: 3 · Inscritos: 57 · Cupo libre: 18' });
  });

  // SOLO PARA LA CLASE: muestra lo que el servidor guarda de cada sesión.
  // Un servidor real NUNCA expone esto.
  app.get('/api/diagnostico/sesiones', async (req, res, next) => {
    try {
      const sesiones = await todasLasSesiones(almacen);
      const lista = Object.entries(sesiones || {}).map(([id, s]) => ({
        sesion: idCorto(id),
        esLaTuya: id === req.sessionID,
        usuario: s.usuario ? s.usuario.usuario : '(sin iniciar sesión)',
        visitas: s.visitas || 0,
        expira: s.cookie && s.cookie.expires,
      }));
      res.json({ almacen: config.almacen, sesiones: lista });
    } catch (error) {
      next(error);
    }
  });

  // ===================== JWT (semana 13) =====================
  // Con JWT el servidor NO guarda la sesión: los datos del usuario viajan DENTRO del token,
  // y el navegador lo manda en el encabezado  Authorization: Bearer <token>

  // Con esto se firman los tokens. Si cambia, todos los tokens viejos dejan de servir.
  const SECRETO_JWT = process.env.JWT_SECRET || 'secreto-jwt-solo-para-la-demo';

  // Crea el token: payload (datos del usuario) + vencimiento + id único (jti), firmado con HS256.
  // Nunca se mete la contraseña: el payload lo puede leer cualquiera.
  function firmarToken(usuario) {
    return jwt.sign(
      { sub: String(usuario.id), usuario: usuario.usuario, nombre: usuario.nombre, rol: usuario.rol },
      SECRETO_JWT,
      { algorithm: 'HS256', expiresIn: config.jwtExpiraSeg, jwtid: crypto.randomUUID() }
    );
  }

  // 401: falta el token, está alterado, ya venció o está en la lista negra.
  async function requiereJWT(req, res, next) {
    const encabezado = req.headers.authorization || '';
    if (!encabezado.startsWith('Bearer ')) {
      return res.status(401).json({ error: '401 · Falta el token (Authorization: Bearer ...)' });
    }
    const token = encabezado.slice('Bearer '.length).trim();

    let datos;
    try {
      // Solo aceptamos HS256 firmado con NUESTRO secreto (y jwt.verify revisa solo el vencimiento).
      datos = jwt.verify(token, SECRETO_JWT, { algorithms: ['HS256'] });
    } catch (error) {
      if (error.name === 'TokenExpiredError') {
        return res.status(401).json({ error: '401 · Token vencido: renuévalo o vuelve a iniciar sesión' });
      }
      return res.status(401).json({ error: '401 · Token inválido' });
    }

    try {
      if (config.jwtRevocar && (await tokens.estaRevocado(datos.jti))) {
        return res.status(401).json({ error: '401 · Token revocado: ya se cerró esa sesión' });
      }
    } catch (error) {
      return next(error);
    }

    req.jwt = datos; // las rutas leen al usuario desde aquí
    next();
  }

  // 403: el token es válido, pero el rol que trae no alcanza.
  function requiereRolJWT(rol) {
    return (req, res, next) => {
      if (req.jwt.rol !== rol) {
        return res.status(403).json({ error: `403 · Eres ${req.jwt.usuario}, pero esta ruta es solo para ${rol}` });
      }
      next();
    };
  }

  // Login con JWT: mismo verificar() que la sesión, pero en vez de cookie regresa un token.
  app.post('/api/jwt/login', async (req, res, next) => {
    try {
      const { usuario, contrasena } = req.body || {};
      const datos = await usuarios.verificar(usuario, contrasena);
      if (!datos) return res.status(401).json({ error: 'Usuario o contraseña incorrectos' });
      res.json({ token: firmarToken(datos), usuario: datos, expiraEnSegundos: config.jwtExpiraSeg });
    } catch (error) {
      next(error);
    }
  });

  // Lo que trae el token (equivale a /api/sesion, pero sin nada guardado en el servidor).
  app.get('/api/jwt/sesion', requiereJWT, (req, res) => {
    res.json({
      usuario: { id: req.jwt.sub, usuario: req.jwt.usuario, nombre: req.jwt.nombre, rol: req.jwt.rol },
      jti: req.jwt.jti,
      emitido: new Date(req.jwt.iat * 1000),
      expira: new Date(req.jwt.exp * 1000),
      expiraEnSegundos: Math.max(0, req.jwt.exp - Math.floor(Date.now() / 1000)),
    });
  });

  app.get('/api/jwt/perfil', requiereJWT, (req, res) => {
    res.json({
      mensaje: `Hola, ${req.jwt.nombre}`,
      rol: req.jwt.rol,
      expiraEnSegundos: Math.max(0, req.jwt.exp - Math.floor(Date.now() / 1000)),
    });
  });

  app.get('/api/jwt/reporte', requiereJWT, requiereRolJWT('admin'), (req, res) => {
    res.json({ reporte: 'Talleres: 3 · Inscritos: 57 · Cupo libre: 18' });
  });

  // Renovar: con un token que todavía sirve, se firma uno nuevo con el tiempo completo.
  app.post('/api/jwt/refresh', requiereJWT, (req, res) => {
    const { sub, usuario, nombre, rol } = req.jwt;
    res.json({ token: firmarToken({ id: sub, usuario, nombre, rol }), expiraEnSegundos: config.jwtExpiraSeg });
  });

  // Logout: un JWT no se puede "borrar" del servidor; lo anotamos en la lista negra.
  app.post('/api/jwt/logout', requiereJWT, async (req, res, next) => {
    try {
      if (config.jwtRevocar) {
        await tokens.revocar(req.jwt.jti, req.jwt.usuario, req.jwt.exp);
        return res.json({ mensaje: 'Token revocado: quedó en la lista negra (tabla tokens_revocados)', revocado: true });
      }
      res.json({ mensaje: 'El servidor no guarda nada: el token sigue sirviendo hasta que venza', revocado: false });
    } catch (error) {
      next(error);
    }
  });

  // SOLO PARA LA CLASE: la lista negra, y solo la ve el admin (401 sin token, 403 si no es admin).
  app.get('/api/diagnostico/tokens', requiereJWT, requiereRolJWT('admin'), async (req, res, next) => {
    try {
      res.json({ revocar: config.jwtRevocar, tokens: await tokens.listar() });
    } catch (error) {
      next(error);
    }
  });

  // ---------- Archivos, 404 y errores (siempre al final y en este orden) ----------
  app.use(express.static(path.join(__dirname, 'public')));

  app.use('/api', (req, res) => res.status(404).json({ error: 'Ruta no encontrada' }));
  // eslint-disable-next-line no-unused-vars
  app.use((error, req, res, next) => {
    console.error(error);
    res.status(500).json({ error: 'Error del servidor' });
  });

  return app;
}

module.exports = { crearApp, NOMBRE_COOKIE };
