

const talleres = [
  { nombre: 'Introducción a Python', instructor: 'Ing. María López', cupo: 25, inscritos: 25 },
  { nombre: 'Fundamentos de Redes', instructor: 'Ing. Carlos Ramírez', cupo: 30, inscritos: 18 },
  { nombre: 'Diseño de Bases de Datos', instructor: 'Ing. Ana Torres', cupo: 20, inscritos: 20 },
  { nombre: 'Desarrollo Web con JS', instructor: 'Ing. María López', cupo: 25, inscritos: 10 },
];


function pintarTabla(){
    //debe de obtener la tabla y rellenarla con los datos de talleres
}

const formArreglos = document.getElementById('form-arreglos');
const resultadoArreglos = document.getElementById('resultado-arreglo');
const selectOperacionArreglo = document.getElementById('operacion-arreglo');

formArreglos.addEventListener('submit', (evento) =>{
    evento.preventDefault();
    const operacion = selectOperacionArreglo.value;

    let resultado;

    switch(operacion){
        case 'forEach':
            resultado = talleres.map((t) => `- ${t.nombre} (${t.inscritos}/${t.cupo})`).join('\n');
            break;

        case 'find': {
            const instructor = 'Ing. María López';
            const taller = talleres.find((t) => t.instructor === instructor);
            resultado = taller
                ? `${taller.nombre} - ${taller.instructor}`
                : `No se encontró taller de ${instructor}`;
            break;
        }

        case 'reduce': {
            const totalInscritos = talleres.reduce((acc, t) => acc + t.inscritos, 0);
            resultado = `Total de inscritos: ${totalInscritos}`;
            break;
        }

        case 'filterMap': {
            const conCupo = talleres.filter((t) => t.inscritos < t.cupo).map((t) => t.nombre);
            resultado = conCupo.join('\n') || "No hay talleres con cupo disponible";
            break;
        }

        case 'map': {
            const nombres = talleres.map((t) => t.nombre);
            resultado = nombres.join('\n');
            break;
        }

        case 'filter': {
            const llenos = talleres.filter((t) => t.inscritos >= t.cupo).map((t) => t.nombre);
            resultado = llenos.join('\n') || "No hay talleres llenos";
            break;
        }

        default:
            resultado = "Operación no válida";  
        
            
    }

    resultadoArreglos.textContent = resultado;
});
    
      pintarTabla();




const formObjeto = document.getElementById('form-objeto');
const resultadoObjeto = document.getElementById('resultado-objeto');

formObjeto.addEventListener('submit', (evento) => {
    evento.preventDefault();
    const taller = {
        nombre : document.getElementById('objeto-nombre').value,
        instructor : document.getElementById('objeto-instructor').value,
        cupo : Number(document.getElementById('objeto-cupo')).value,
        inscritos: Number(document.getElementById('objeto-inscritos').value)

    };
    const operacion = document.getElementById('operacion-objeto').value;

    let resultado
    switch(operacion){
        case 'keys':
            resultado = JSON.stringify(Object.keys(taller));
            break;

        case 'values':
            resultado = JSON.stringify(Object.values(taller));
            break;

        case 'entries':
            resultado = Object.entries(taller).map(([campo, valor]) => `${campo}: ${valor}`).join('\n');
            break;

        case 'stringify':
            resultado = JSON.stringify(taller, null, 2);
            break;
            
        case 'roundtrip':
            const textoJson = JSON.stringify(taller, null, 2);
            const objetoDeVuelta = JSON.parse(textoJson);

            resultado = [
                '',
                textoJson,
                '',
                `tipo: ${typeof objetoDeVuelta}`,
                objetoDeVuelta.nombre
                ].join('\n')
            break;
    }
})  

    resultadoArreglos.textContent = resultado;