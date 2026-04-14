const { parentPort, workerData } = require('worker_threads');

// workerData contiene la porción de datos (chunks) asignada a este worker
const datos = workerData;

let totalSuma = 0;
let procesados = 0;

// Simulamos un procesamiento pesado par cada elemento
for (let item of datos) {
    // Retraso computacional simulado (simula cifrado, transformaciones, machine learning, etc)
    for(let i = 0; i < 50000; i++) {
        Math.sqrt((i * Math.random()) + item.total);
    }
    
    totalSuma += parseFloat(item.total || 0);
    procesados++;
}

// Retornamos el resultado del hilo al proceso principal (Master-Worker -> Worker Node)
parentPort.postMessage({
    procesados: procesados,
    totalAcumulado: totalSuma,
    promedio: procesados > 0 ? (totalSuma / procesados) : 0
});
