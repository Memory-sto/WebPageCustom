const { pipeline, Readable, Transform } = require('stream');
const zlib = require('zlib');
const db = require('./database');

function exportarComprasPipeline(res) {
    // 1. Readable Stream: Lector de la Base de Datos bajo demanda
    class DatabaseReaderStream extends Readable {
        constructor() {
            super({ objectMode: true });
            this.datos = db.prepare('SELECT * FROM compras').all();
            this.pos = 0;
            // Emitir como primer "chunk" la cabecera CSV
            this.push("id,fecha,cliente,total,metodo_pago,notas\n");
        }

        _read() {
            if (this.pos >= this.datos.length) {
                this.push(null); // Fin del origen de datos
                return;
            }
            const fila = this.datos[this.pos];
            this.pos++;
            this.push(fila); // Emitir data limpia al siguiente paso del pipe
        }
    }

    // 2. Transform Stream: Transforma Objecto de BD a Línea de CSV
    const csvTransformer = new Transform({
        objectMode: true,
        transform(chunk, encoding, callback) {
            if (typeof chunk === 'string') {
                // Passthrough la cabecera
                callback(null, chunk);
            } else {
                // Sanitizar y encadenar formato CSV
                const cliente = (chunk.cliente || '').replace(/"/g, '""');
                const notas = (chunk.notas || '').replace(/"/g, '""');
                const line = `${chunk.id},"${chunk.fecha}","${cliente}",${chunk.total},"${chunk.metodo_pago}","${notas}"\n`;
                
                // Retornar la porción transformada
                callback(null, line);
            }
        }
    });

    // 3. Compresser Stream: Utilización de zlib (nativo Node) para compresión Gzip
    const compressorStream = zlib.createGzip();

    // Headers HTTP para respuesta attachment comprimida
    res.setHeader('Content-Disposition', 'attachment; filename="compras_backups.csv.gz"');
    res.setHeader('Content-Type', 'application/gzip');

    // 4. Integración del Pipeline Model de forma secuencial y encadenada
    console.log('[Pipeline] Iniciando Flujo de Datos para Exportación...');
    pipeline(
        new DatabaseReaderStream(),  // Generador de datos (BD)
        csvTransformer,              // Transformador a CSV
        compressorStream,            // Transformador a GZIP (.gz)
        res,                         // Destino Final (Response Cliente HTTP)
        (err) => {
            if (err) {
                console.error('[Pipeline] Error crítico en el pipeline:', err);
                if (!res.headersSent) {
                    res.status(500).json({ error: 'Fallo al procesar pipeline' });
                }
            } else {
                console.log('[Pipeline] Flujo de exportación completado con éxito, conexión cerrada!');
            }
        }
    );
}

module.exports = { exportarComprasPipeline };
