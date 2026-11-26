// La página solo hace fetch a la API. El navegador manda la cookie solo (misma página, mismo servidor).
const $ = (id) => document.getElementById(id);

// Etapa 1: una sola función para todas las peticiones, así no repito fetch en cada botón.
// No uso credentials: 'include' porque la página y la API están en el mismo servidor (mismo origen):
// el navegador manda la cookie solo. Haría falta si la API estuviera en otro puerto, como con Next.js.
// token es opcional: solo lo usa la sección 6 (JWT), donde no hay cookie y el token se manda a mano.
async function llamar(metodo, url, cuerpo, token) {
  const opciones = { method: metodo, headers: {} };
  if (token) opciones.headers.Authorization = 'Bearer ' + token;

  // Content-Type solo cuando hay cuerpo: express.json() lo necesita para leerlo.
  if (cuerpo !== undefined) {
    opciones.headers['Content-Type'] = 'application/json';
    opciones.body = JSON.stringify(cuerpo);
  }

  const respuesta = await fetch(url, opciones);

  // fetch no lanza error con 401/403; el código está en respuesta.status.
  let datos = null;
  try {
    datos = await respuesta.json();
  } catch {
    datos = null; // la respuesta no era JSON
  }
  return { status: respuesta.status, datos };
}

// Etapa 2: agrega cada respuesta arriba. Uso textContent y no innerHTML
// porque el JSON puede traer texto ajeno (riesgo de XSS).
// lista: en qué <ol> se anota (la bitácora de la cookie o la del JWT).
function anotarBitacora(metodo, url, status, datos, lista = 'bitacora') {
  let clase = 'error';
  if (status >= 200 && status < 300) clase = 'ok';
  else if (status === 401) clase = 'e401';
  else if (status === 403) clase = 'e403';

  const li = document.createElement('li');

  const codigo = document.createElement('span');
  codigo.className = 'codigo ' + clase;
  codigo.textContent = status;

  const ruta = document.createElement('strong');
  ruta.textContent = ' ' + metodo + ' ' + url;

  const pre = document.createElement('pre');
  pre.textContent = JSON.stringify(datos, null, 2);

  li.append(codigo, ruta, pre);
  $(lista).prepend(li);
}

// Etapa 3: pregunta al servidor quién soy.
async function pintarEstado() {
  const { status, datos } = await llamar('GET', '/api/sesion');
  const caja = $('estado');

  if (status === 200) {
    caja.textContent = datos.usuario.nombre + ' (' + datos.usuario.rol + ') · sesión ' +
      datos.sesion + ' · vence en ' + datos.expiraEnSegundos + ' s';
    caja.className = 'estado con-sesion';
  } else {
    caja.textContent = 'Sin sesión (el servidor responde 401)';
    caja.className = 'estado sin-sesion';
  }

  // Con httpOnly:true JavaScript no ve la cookie, por eso sale vacío aunque haya sesión.
  $('cookie-js').textContent = document.cookie || '(vacío)';
}

// Etapa 4: muestra las sesiones que guarda el servidor.
async function pintarTabla() {
  const { datos } = await llamar('GET', '/api/diagnostico/sesiones');

  $('donde').textContent =
    datos.almacen === 'mysql'
      ? 'En MySQL, tabla sessions'
      : 'En la memoria del servidor (se pierde al reiniciar)';

  const tbody = $('tabla-sesiones');
  tbody.replaceChildren(); // vacío antes de llenar; si no, las filas se duplican

  if (datos.sesiones.length === 0) {
    const tr = document.createElement('tr');
    const td = document.createElement('td');
    td.colSpan = 4;
    td.textContent = '(sin sesiones)';
    tr.appendChild(td);
    tbody.appendChild(tr);
    return;
  }

  for (const s of datos.sesiones) {
    const tr = document.createElement('tr');
    if (s.esLaTuya) tr.className = 'tuya';

    const valores = [
      s.sesion + (s.esLaTuya ? ' (la tuya)' : ''),
      s.usuario,
      s.visitas,
      new Date(s.expira).toLocaleTimeString(), // de texto ISO a hora local
    ];
    for (const v of valores) {
      const td = document.createElement('td');
      td.textContent = v;
      tr.appendChild(td);
    }
    tbody.appendChild(tr);
  }
}

// Etapa 5: después de cada acción refresco estado y tabla.
async function refrescarTodo() {
  await pintarEstado();
  await pintarTabla();
}

async function accion(metodo, url, cuerpo) {
  const { status, datos } = await llamar(metodo, url, cuerpo);
  anotarBitacora(metodo, url, status, datos);
  await refrescarTodo();
}

// preventDefault evita que el formulario recargue la página.
$('form-login').addEventListener('submit', (e) => {
  e.preventDefault();
  accion('POST', '/api/login', {
    usuario: $('usuario').value,
    contrasena: $('contrasena').value,
  });
});

// Un solo recorrido para todos los botones con data-url.
document.querySelectorAll('[data-url]').forEach((boton) => {
  boton.addEventListener('click', () => {
    accion(boton.dataset.metodo, boton.dataset.url);
  });
});

// Al cambiar de usuario pongo su contraseña de ejemplo.
$('usuario').addEventListener('change', (e) => {
  $('contrasena').value = e.target.value + '12345';
});

$('btn-refrescar').addEventListener('click', refrescarTodo);
$('btn-sesiones').addEventListener('click', pintarTabla);

// Etapa 6: al cargar. No uso DOMContentLoaded porque el <script> está al final del <body>.
async function iniciar() {
  const { datos } = await llamar('GET', '/api/config');
  $('config').textContent = JSON.stringify(datos, null, 2);
  await refrescarTodo();
}
iniciar();

// ===================== JWT (semana 13) =====================
// Con JWT el navegador NO manda nada solo (no hay cookie): la página guarda el token y lo pone en cada petición.
// sessionStorage: se borra al cerrar la pestaña.
let tokenJWT = sessionStorage.getItem('tokenJWT');

function guardarToken(token) {
  tokenJWT = token || null;
  if (tokenJWT) sessionStorage.setItem('tokenJWT', tokenJWT);
  else sessionStorage.removeItem('tokenJWT');
}

// El payload es la parte de en medio del token (base64url): se lee SIN el secreto.
function leerPayload(token) {
  try {
    const parte = token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/');
    const json = decodeURIComponent(
      atob(parte).split('').map((c) => '%' + c.charCodeAt(0).toString(16).padStart(2, '0')).join('')
    );
    return JSON.parse(json);
  } catch {
    return null;
  }
}

// Le pregunta al servidor si el token sirve y pinta el estado.
async function refrescarJWT() {
  const estado = $('estado-jwt');
  if (!tokenJWT) {
    estado.textContent = 'Sin token';
    estado.className = 'estado sin-sesion';
    $('jwt-token').textContent = '(sin token)';
    $('jwt-payload').textContent = '(sin token)';
    await refrescarTokens();
    return;
  }
  $('jwt-token').textContent = tokenJWT;
  $('jwt-payload').textContent = JSON.stringify(leerPayload(tokenJWT), null, 2);

  const { status, datos } = await llamar('GET', '/api/jwt/sesion', undefined, tokenJWT);
  if (status === 200) {
    const u = datos.usuario;
    estado.textContent = `Con token: ${u.nombre} · rol ${u.rol} · token ${datos.jti.slice(0, 8)}… · vence en ${datos.expiraEnSegundos} s`;
    estado.className = 'estado con-sesion';
  } else {
    // El token ya no sirve (vencido, revocado o alterado), aunque la página lo siga teniendo.
    estado.textContent = `El token ya no sirve: ${datos ? datos.error : status}`;
    estado.className = 'estado sin-sesion';
  }
  await refrescarTokens();
}

// Lista negra: solo el admin la ve (el servidor responde 401 sin token válido y 403 si no eres admin).
async function refrescarTokens() {
  const tbody = $('tabla-tokens');
  const aviso = $('jwt-lista-aviso');
  const filaUnica = (texto) => {
    tbody.innerHTML = '';
    const tr = document.createElement('tr');
    const td = document.createElement('td');
    td.colSpan = 4;
    td.textContent = texto;
    tr.appendChild(td);
    tbody.appendChild(tr);
  };

  if (!tokenJWT) {
    aviso.textContent = 'Inicia sesión con JWT como admin para verla';
    return filaUnica('(necesitas un token de administrador)');
  }
  const { status, datos } = await llamar('GET', '/api/diagnostico/tokens', undefined, tokenJWT);
  if (status !== 200) {
    aviso.textContent = datos && datos.error ? datos.error : `Error ${status}`;
    return filaUnica(status === 403 ? '(solo el admin ve la lista negra)' : '(token no válido)');
  }

  aviso.textContent = datos.revocar
    ? 'jwtRevocar = true: al hacer logout el token se anota en MySQL (tabla tokens_revocados)'
    : 'jwtRevocar = false: el servidor no guarda nada, el token sirve hasta que venza';
  if (datos.tokens.length === 0) return filaUnica('(sin tokens revocados)');

  tbody.innerHTML = '';
  const miJti = (leerPayload(tokenJWT) || {}).jti;
  for (const t of datos.tokens) {
    const tr = document.createElement('tr');
    if (t.jti === miJti) tr.className = 'tuya';
    for (const valor of [`${t.jti.slice(0, 8)}…`, t.usuario, new Date(t.expira).toLocaleTimeString(), new Date(t.revocado_en).toLocaleTimeString()]) {
      const td = document.createElement('td');
      td.textContent = valor;
      tr.appendChild(td);
    }
    tbody.appendChild(tr);
  }
}

// Login JWT con el usuario y la contraseña de la sección 2.
document.querySelector('[data-jwt-login]').addEventListener('click', async () => {
  const cuerpo = { usuario: $('usuario').value, contrasena: $('contrasena').value };
  const { status, datos } = await llamar('POST', '/api/jwt/login', cuerpo);
  anotarBitacora('POST', '/api/jwt/login', status, datos, 'bitacora-jwt');
  if (status === 200) guardarToken(datos.token);
  await refrescarJWT();
});

// Los demás botones mandan el token que tenga la página.
for (const boton of document.querySelectorAll('[data-jwt-url]')) {
  boton.addEventListener('click', async () => {
    const metodo = boton.dataset.jwtMetodo;
    const url = boton.dataset.jwtUrl;
    const { status, datos } = await llamar(metodo, url, undefined, tokenJWT);
    anotarBitacora(metodo, url, status, datos, 'bitacora-jwt');
    if (url === '/api/jwt/refresh' && status === 200) guardarToken(datos.token); // el nuevo reemplaza al viejo
    await refrescarJWT();
  });
}

// Solo lo borra de esta página. Si no hiciste logout antes, el token sigue sirviendo hasta que venza.
$('btn-borrar-token').addEventListener('click', async () => {
  guardarToken(null);
  await refrescarJWT();
});

$('btn-tokens').addEventListener('click', refrescarTokens);

refrescarJWT();