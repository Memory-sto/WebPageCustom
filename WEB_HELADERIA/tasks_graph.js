const db = require('./database');

// Nodo A del grafo: Tarea asíncrona simulada pero independiente
async function obtenerHelados() {
    return new Promise((resolve) => {
        setTimeout(() => {
            // Operación que simula un retraso de I/O externo o microservicio
            const helados = db.prepare('SELECT nombre, precio, stock FROM helados WHERE activo=1').all();
            resolve(helados);
        }, 300); 
    });
}

// Nodo B del grafo: Tarea asíncrona simulada e independiente de Nodo A
async function obtenerPromociones() {
    return new Promise((resolve) => {
        setTimeout(() => {
            const promos = db.prepare('SELECT titulo, precio_promo FROM promociones WHERE activo=1').all();
            resolve(promos);
        }, 150);
    });
}

// Nodo C del grafo: Tarea dependiente (Requiere A y B)
async function consolidarInforme(helados, promos) {
    return new Promise((resolve) => {
        setTimeout(() => {
            const totalStock = helados.reduce((acc, h) => acc + h.stock, 0);
            const preciosPromos = promos.reduce((acc, p) => acc + (p.precio_promo || 0), 0);
            resolve({
                mensaje: "Analisis predictivo de inventario finalizado con exito",
                metricas: {
                    totalStockHelados: totalStock,
                    promedioPrecioPromociones: promos.length ? (preciosPromos / promos.length) : 0,
                    heladosActivos: helados.length,
                    promosActivas: promos.length
                },
                nodos_graficos_resueltos: ['A', 'B', 'C']
            });
        }, 100);
    });
}

// Orquestador Principal del DAG (Gráfico de Tareas Direccional Acíclico)
async function ejecutarTaskGraph() {
    console.log('[Task Graph] Iniciando Nodos Independientes (A y B) en Paralelo...');
    // Paralelismo a nivel de control de flujo asíncrono
    const [helados, promos] = await Promise.all([
        obtenerHelados(),
        obtenerPromociones()
    ]);

    console.log('[Task Graph] Nodos resueltos. Iniciando Nodo C (Dependiente)...');
    // Resolución de nivel dos del grafo
    const resultado = await consolidarInforme(helados, promos);
    
    return resultado;
}

module.exports = { ejecutarTaskGraph };
