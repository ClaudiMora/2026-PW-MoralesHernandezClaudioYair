import { useEffect, useState } from "react";
import { pedirJSON } from "../../lib/api";
import { ocultarBoleta } from "../../lib/formato";
import {
  validarBoleta,
  validarContrasena,
  validarCorreo,
} from "../../lib/validaciones";
import estilos from "../../styles/Talleres.module.css";

// /usuarios — CRUD de usuarios (GET, POST, PUT y DELETE sobre /api/usuarios).
const VACIO = { nombre: "", correo: "", contrasena: "", boleta: "", rol: "alumno" };

export default function Usuarios() {
  const [usuarios, setUsuarios] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [errorCarga, setErrorCarga] = useState("");

  const [form, setForm] = useState(VACIO);
  const [errorForm, setErrorForm] = useState("");
  const [exito, setExito] = useState("");
  const [enviando, setEnviando] = useState(false);

  // Edición en la fila: editandoId guarda el usuario que se está editando y edicion sus valores.
  const [editandoId, setEditandoId] = useState(null);
  const [edicion, setEdicion] = useState({});
  const [errorFila, setErrorFila] = useState("");

  useEffect(() => {
    cargar();
  }, []);

  async function cargar() {
    try {
      setUsuarios(await pedirJSON("/usuarios"));
      setErrorCarga("");
    } catch (err) {
      setErrorCarga(err.message);
    } finally {
      setCargando(false);
    }
  }

  function cambiar(campo, valor) {
    setForm({ ...form, [campo]: valor });
  }

  async function registrar(e) {
    e.preventDefault();
    setErrorForm("");
    setExito("");

    const nombre = form.nombre.trim();
    if (nombre.length < 3) return setErrorForm("El nombre debe tener al menos 3 letras.");
    if (!validarCorreo(form.correo)) return setErrorForm("El correo no tiene un formato válido.");
    if (!validarBoleta(form.boleta)) return setErrorForm("La boleta debe tener 10 dígitos.");
    if (!validarContrasena(form.contrasena))
      return setErrorForm("La contraseña debe tener al menos 8 caracteres.");

    setEnviando(true);
    try {
      await pedirJSON("/usuarios", {
        method: "POST",
        body: JSON.stringify({
          ...form,
          nombre,
          correo: form.correo.trim(),
          boleta: form.boleta.trim(),
        }),
      });
      setExito(`Usuario ${nombre} registrado.`);
      setForm(VACIO);
      await cargar();
    } catch (err) {
      setErrorForm(err.message);
    } finally {
      setEnviando(false);
    }
  }

  function empezarEdicion(u) {
    setErrorFila("");
    setEditandoId(u.id);
    setEdicion({ nombre: u.nombre, correo: u.correo, rol: u.rol });
  }

  async function guardarEdicion(id) {
    setErrorFila("");
    if (edicion.nombre.trim().length < 3)
      return setErrorFila("El nombre debe tener al menos 3 letras.");
    if (!validarCorreo(edicion.correo))
      return setErrorFila("El correo no tiene un formato válido.");
    try {
      await pedirJSON(`/usuarios/${id}`, {
        method: "PUT",
        body: JSON.stringify({ ...edicion, nombre: edicion.nombre.trim() }),
      });
      setEditandoId(null);
      await cargar();
    } catch (err) {
      setErrorFila(err.message);
    }
  }

  async function eliminar(u) {
    if (!window.confirm(`¿Eliminar a ${u.nombre}? Esta acción no se puede deshacer.`)) return;
    setErrorFila("");
    try {
      await pedirJSON(`/usuarios/${u.id}`, { method: "DELETE" });
      await cargar();
    } catch (err) {
      setErrorFila(err.message);
    }
  }

  return (
    <main>
      <h1>Usuarios</h1>

      <section className={estilos.panel}>
        <h2>Registrar usuario</h2>
        <form onSubmit={registrar} className="formulario">
          <input
            placeholder="Nombre completo"
            value={form.nombre}
            onChange={(e) => cambiar("nombre", e.target.value)}
          />
          <input
            type="email"
            placeholder="Correo"
            value={form.correo}
            onChange={(e) => cambiar("correo", e.target.value)}
          />
          <input
            placeholder="Boleta (10 dígitos)"
            value={form.boleta}
            onChange={(e) => cambiar("boleta", e.target.value)}
          />
          <input
            type="password"
            placeholder="Contraseña (mínimo 8 caracteres)"
            value={form.contrasena}
            onChange={(e) => cambiar("contrasena", e.target.value)}
          />
          <select value={form.rol} onChange={(e) => cambiar("rol", e.target.value)}>
            <option value="alumno">Alumno</option>
            <option value="admin">Admin</option>
          </select>
          <button type="submit" disabled={enviando}>
            {enviando ? "Registrando…" : "Registrar usuario"}
          </button>
        </form>
        {errorForm && <p className="error">{errorForm}</p>}
        {exito && <p className={estilos.exito}>{exito}</p>}
      </section>

      <h2>Lista de usuarios ({usuarios.length})</h2>
      {cargando && <p>Cargando usuarios…</p>}
      {errorCarga && <p className="error">{errorCarga}</p>}
      {errorFila && <p className="error">{errorFila}</p>}
      {!cargando && !errorCarga && usuarios.length === 0 && (
        <p>No hay usuarios registrados.</p>
      )}

      {usuarios.length > 0 && (
        <table>
          <thead>
            <tr>
              <th>Nombre</th>
              <th>Correo</th>
              <th>Boleta</th>
              <th>Rol</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {usuarios.map((u) =>
              editandoId === u.id ? (
                <tr key={u.id}>
                  <td>
                    <input
                      value={edicion.nombre}
                      onChange={(e) => setEdicion({ ...edicion, nombre: e.target.value })}
                    />
                  </td>
                  <td>
                    <input
                      value={edicion.correo}
                      onChange={(e) => setEdicion({ ...edicion, correo: e.target.value })}
                    />
                  </td>
                  <td>{ocultarBoleta(u.boleta)}</td>
                  <td>
                    <select
                      value={edicion.rol}
                      onChange={(e) => setEdicion({ ...edicion, rol: e.target.value })}
                    >
                      <option value="alumno">Alumno</option>
                      <option value="admin">Admin</option>
                    </select>
                  </td>
                  <td>
                    <button onClick={() => guardarEdicion(u.id)}>Guardar</button>{" "}
                    <button onClick={() => setEditandoId(null)}>Cancelar</button>
                  </td>
                </tr>
              ) : (
                <tr key={u.id}>
                  <td>{u.nombre}</td>
                  <td>{u.correo}</td>
                  <td>{ocultarBoleta(u.boleta)}</td>
                  <td>{u.rol}</td>
                  <td>
                    <button onClick={() => empezarEdicion(u)}>Editar</button>{" "}
                    <button onClick={() => eliminar(u)}>Eliminar</button>
                  </td>
                </tr>
              ),
            )}
          </tbody>
        </table>
      )}
    </main>
  );
}
