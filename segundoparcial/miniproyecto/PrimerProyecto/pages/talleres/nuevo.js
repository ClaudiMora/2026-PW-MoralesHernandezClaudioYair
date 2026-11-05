import Link from "next/link";
import { useRouter } from "next/router";
import { useState } from "react";
import { pedirJSON } from "../../lib/api";
import estilos from "../../styles/Talleres.module.css";

// /talleres/nuevo — formulario para crear un taller (POST /api/talleres).
export default function NuevoTaller() {
  const router = useRouter();
  const [nombre, setNombre] = useState("");
  const [instructor, setInstructor] = useState("");
  const [fecha, setFecha] = useState("");
  const [cupo, setCupo] = useState("");
  const [error, setError] = useState("");
  const [enviando, setEnviando] = useState(false);

  async function crear(e) {
    e.preventDefault();
    setError("");

    if (!nombre.trim()) return setError("Escribe el nombre del taller.");
    if (!fecha) return setError("Elige la fecha del taller.");
    // El backend permite cupo vacío, pero la página de detalle necesita el número para calcular los lugares.
    if (!Number.isInteger(Number(cupo)) || Number(cupo) < 1)
      return setError("El cupo debe ser un número entero mayor a 0.");

    setEnviando(true);
    try {
      const taller = await pedirJSON("/talleres", {
        method: "POST",
        body: JSON.stringify({
          nombre: nombre.trim(),
          instructor: instructor.trim() || null,
          fecha,
          cupo: Number(cupo),
        }),
      });
      router.push(`/talleres/${taller.id}`);
    } catch (err) {
      setError(err.message);
      setEnviando(false);
    }
  }

  return (
    <main>
      <Link className={estilos.volver} href="/talleres">
        ← Volver a talleres
      </Link>
      <h1>Nuevo taller</h1>

      <form onSubmit={crear} className="formulario">
        <input
          placeholder="Nombre del taller"
          value={nombre}
          onChange={(e) => setNombre(e.target.value)}
        />
        <input
          placeholder="Instructor (opcional)"
          value={instructor}
          onChange={(e) => setInstructor(e.target.value)}
        />
        <input
          type="date"
          value={fecha}
          onChange={(e) => setFecha(e.target.value)}
        />
        <input
          type="number"
          min="1"
          placeholder="Cupo (lugares)"
          value={cupo}
          onChange={(e) => setCupo(e.target.value)}
        />
        <button type="submit" disabled={enviando}>
          {enviando ? "Creando…" : "Crear taller"}
        </button>
      </form>
      {error && <p className="error">{error}</p>}
    </main>
  );
}
