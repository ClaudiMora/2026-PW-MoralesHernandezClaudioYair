// La página solo hace fetch a la API. El navegador manda la cookie solo (misma página, mismo servidor).
const $ = (id) => document.getElementById(id);

// token es opcional: solo lo usa la sección 6 (JWT). Con cookie no hace falta, el navegador la manda solo.
async function llamar(metodo, url, cuerpo, token) {
  const opciones = { method: metodo, headers: {} };
  if (token) opciones.headers.Authorization = `Bearer ${token}`;
  if (cuerpo) {
    opciones.headers['Content-Type'] = 'application/json';
    opciones.body = JSON.stringify(cuerpo);
  }
  const respuesta = await fetch(url, opciones);
  let datos = null;
  try { datos = await respuesta.json(); } catch { datos = null; }
  return { status: respuesta.status, datos };
}

function anotar(metodo, url, status, datos, lista = 'bitacora') {
  const li = document.createElement('li');
  const clase = status < 300 ? 'ok' : status === 401 ? 'e401' : status === 403 ? 'e403' : 'error';
  li.innerHTML = `<span class="codigo ${clase}">${status}</span> <code>${metodo} ${url}</code>`;
  const cuerpo = document.createElement('pre');
  cuerpo.textContent = JSON.stringify(datos, null, 2);
  li.appendChild(cuerpo);
  $(lista).prepend(li);
}

async function refrescarEstado() {
  const { status, datos } = await llamar('GET', '/api/sesion');
  const estado = $('estado');
  if (status === 200) {
    estado.textContent = `${datos.usuario.nombre} · rol ${datos.usuario.rol} · sesión ${datos.sesion} · vence en ${datos.expiraEnSegundos} s`;
    estado.className = 'estado con-sesion';
  } else {
    estado.textContent = 'Sin sesión (el servidor responde 401)';
    estado.className = 'estado sin-sesion';
  }
  $('cookie-js').textContent = document.cookie || '(vacío)';
}

async function refrescarSesiones() {
  const { datos: respuesta } = await llamar('GET', '/api/diagnostico/sesiones');
  const datos = respuesta ? respuesta.sesiones : [];
  if (respuesta) {
    $('donde').textContent = respuesta.almacen === 'memoria'
      ? 'En la MEMORIA del servidor: se borra al reiniciarlo.'
      : 'En MySQL, tabla sessions. En Workbench: SELECT * FROM demo_sesiones.sessions;';
  }
  const cuerpo = $('tabla-sesiones');
  cuerpo.innerHTML = '';
  if (!datos || datos.length === 0) {
    cuerpo.innerHTML = '<tr><td colspan="4">(sin sesiones)</td></tr>';
    return;
  }
  for (const s of datos) {
    const fila = document.createElement('tr');
    if (s.esLaTuya) fila.className = 'tuya';
    const vence = s.expira ? new Date(s.expira).toLocaleTimeString() : '—';
    for (const valor of [s.sesion + (s.esLaTuya ? ' (la tuya)' : ''), s.usuario, s.visitas, vence]) {
      const celda = document.createElement('td');
      celda.textContent = valor;
      fila.appendChild(celda);
    }
    cuerpo.appendChild(fila);
  }
}

async function refrescarTodo() {
  await refrescarEstado();
  await refrescarSesiones();
}

$('usuario').addEventListener('change', () => {
  $('contrasena').value = `${$('usuario').value}12345`;
});

$('form-login').addEventListener('submit', async (evento) => {
  evento.preventDefault();
  const cuerpo = { usuario: $('usuario').value, contrasena: $('contrasena').value };
  const { status, datos } = await llamar('POST', '/api/login', cuerpo);
  anotar('POST', '/api/login', status, datos);
  await refrescarTodo();
});

for (const boton of document.querySelectorAll('[data-url]')) {
  boton.addEventListener('click', async () => {
    const { metodo, url } = boton.dataset;
    const { status, datos } = await llamar(metodo, url);
    anotar(metodo, url, status, datos);
    await refrescarTodo();
  });
}

$('btn-refrescar').addEventListener('click', refrescarTodo);
$('btn-sesiones').addEventListener('click', refrescarSesiones);

llamar('GET', '/api/config').then(({ datos }) => {
  $('config').textContent = JSON.stringify(datos, null, 2);
});
refrescarTodo();

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

  const { status, datos } = await llamar('GET', '/api/jwt/sesion', null, tokenJWT);
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
  const { status, datos } = await llamar('GET', '/api/diagnostico/tokens', null, tokenJWT);
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
  anotar('POST', '/api/jwt/login', status, datos, 'bitacora-jwt');
  if (status === 200) guardarToken(datos.token);
  await refrescarJWT();
});

// Los demás botones mandan el token que tenga la página.
for (const boton of document.querySelectorAll('[data-jwt-url]')) {
  boton.addEventListener('click', async () => {
    const metodo = boton.dataset.jwtMetodo;
    const url = boton.dataset.jwtUrl;
    const { status, datos } = await llamar(metodo, url, null, tokenJWT);
    anotar(metodo, url, status, datos, 'bitacora-jwt');
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
