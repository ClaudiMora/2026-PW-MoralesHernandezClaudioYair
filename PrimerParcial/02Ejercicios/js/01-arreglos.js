// 01-arreglos.js
// Métodos de arreglo más usados en JS/Node — practícalos sobre esta lista
// de talleres (misma forma que la API real de CECyT9). Completa cada TODO.

function pintarTabla(){
    const tabla = document.getElementById('tabla-talleres');
    const tbody = tabla.querySelector('tbody');

    tbody.innerHTML = '';

    talleres.forEach((taller) => {
        const fila = document.createElement('tr');

        fila.innerHTML = `
            <td>${taller.nombre}</td>
            <td>${taller.instructor}</td>
            <td>${taller.cupo}</td>
            <td>${taller.inscritos}</td>
        `;

        tbody.appendChild(fila);
    });
}

// TODO: forEach — imprime "- <nombre> (<inscritos>/<cupo>)" de cada taller
console.log("Aplicando un forEach para imprimir los talleres:");
talleres.forEach((t) => console.log(`- ${t.nombre} (${t.inscritos}/${t.cupo})`));

// TODO: map — crea un arreglo `nombres` solo con los nombres de los talleres
console.log("Aplicando funcion Map con solo Nombres")
const nombres = talleres.map((t) => t.nombre);
console.log(nombres);

// TODO: filter — crea un arreglo `llenos` con los talleres donde inscritos >= cupo

console.log("Aplicando la función Filter en los talleres")
const llenos = talleres.filter((t) => t.inscritos >= t.cupo);
console.log(llenos.map((t)=> t.nombre))

const tallermaria = talleres.filter((t) => t.instructor === 'Ing. María López');
console.log(tallermaria.map((t)=> t.nombre))

const totalInscritos = talleres.reduce((total, t) => total + t.inscritos, 0);
console.log("Total de inscritos en todos los talleres: " + totalInscritos);

const conCupo = talleres
    .filter((t) => t.inscritos < t.cupo)
    .map((t) => t.nombre);
console.log(conCupo);

// TODO: find — encuentra el PRIMER taller impartido por 'Ing. María López'

// TODO: reduce — calcula `totalInscritos`, la suma de inscritos de todos los talleres

// TODO: filter + map encadenados — nombres de los talleres que SÍ tienen cupo disponible
