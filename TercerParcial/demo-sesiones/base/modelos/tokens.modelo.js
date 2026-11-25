// Lista negra de JWT: la tabla tokens_revocados. Siempre con ? (consulta parametrizada).
function crearModeloTokens(pool) {
  // Anota un token como revocado (logout). exp viene del token en segundos desde 1970.
  // INSERT IGNORE: si ya estaba revocado, no truena por la llave primaria repetida.
  async function revocar(jti, usuario, exp) {
    await pool.query(
      'INSERT IGNORE INTO tokens_revocados (jti, usuario, expira) VALUES (?, ?, FROM_UNIXTIME(?))',
      [jti, usuario, exp]
    );
  }

  // true si el token ya está en la lista negra.
  async function estaRevocado(jti) {
    const [filas] = await pool.query('SELECT 1 FROM tokens_revocados WHERE jti = ?', [String(jti || '')]);
    return filas.length > 0;
  }

  // Todos los tokens revocados, el más reciente primero (para la tabla de la página).
  async function listar() {
    const [filas] = await pool.query(
      'SELECT jti, usuario, expira, revocado_en FROM tokens_revocados ORDER BY revocado_en DESC, jti'
    );
    return filas;
  }

  return { revocar, estaRevocado, listar };
}

module.exports = { crearModeloTokens };
