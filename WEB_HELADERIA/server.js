const cluster = require('cluster');
const os = require('os');
const express = require('express');
const session = require('express-session');
const bcrypt = require('bcryptjs');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { Worker } = require('worker_threads');

const db = require('./database');
const { ejecutarTaskGraph } = require('./tasks_graph');
const { exportarComprasPipeline } = require('./pipeline_exporter');
const { heladosTrie, reservasHeap, pedidosQueue } = require('./estructuras_datos');

// ==================== INICIALIZAR ESTRUCTURAS EN RAM ====================
function refreshDataStructures() {
  const helados = db.prepare('SELECT id, nombre, precio, imagen FROM helados WHERE activo=1').all();
  heladosTrie.buildFromDataset(helados.map(h => ({id: 'h_'+h.id, nombre: h.nombre, precio: h.precio, imagen: h.imagen})));
  
  const reservas = db.prepare("SELECT * FROM reservas WHERE estado = 'pendiente'").all();
  reservasHeap.buildFromDataset(reservas);

  // Reconstruir Queue desde BD (órdenes pendientes)
  const pend = db.prepare("SELECT * FROM compras WHERE estado_pedido='en_cola' ORDER BY id ASC").all();
  while(!pedidosQueue.isEmpty()) pedidosQueue.dequeue(); // Clean
  pend.forEach(p => {
    let itemsStr = '';
    try { itemsStr = JSON.parse(p.items).map(i=>i.qty+'x '+i.nombre).join(', '); } catch(e){}
    pedidosQueue.enqueue({ id: p.id, ticket: p.id, items_str: itemsStr, origen: p.origen });
  });
}
// Init locally
refreshDataStructures();

const app = express();
const PORT = 3000;

// ==================== SSE CLIENTS ====================
let sseClients = [];

function broadcast(event, data) {
  sseClients.forEach(res => {
    res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
  });
}

// ==================== MIDDLEWARE ====================
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static('public'));
app.use('/uploads', express.static('uploads'));

app.use(session({
  secret: 'eltorero-helados-secret-2025',
  resave: false,
  saveUninitialized: false,
  cookie: { maxAge: 24 * 60 * 60 * 1000 }
}));

// Multer for file uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    fs.mkdirSync('uploads', { recursive: true });
    cb(null, 'uploads');
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    cb(null, `${Date.now()}${ext}`);
  }
});
const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const allowed = /\.(jpg|jpeg|png|gif|webp|svg)$/i;
    if (allowed.test(path.extname(file.originalname))) cb(null, true);
    else cb(new Error('Solo se permiten imágenes'));
  }
});

function requireAuth(req, res, next) {
  if (req.session && req.session.userId) return next();
  res.status(401).json({ error: 'No autorizado' });
}

// ==================== SSE ENDPOINT & BROADCASTER ====================
app.get('/api/events', (req, res) => {
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive',
    'X-Accel-Buffering': 'no'
  });
  res.write('data: connected\n\n');
  sseClients.push(res);
  
  // Send state immediately upon connection
  res.write(`event: monitores\ndata: ${JSON.stringify({ cocinaQueue: pedidosQueue.toArray(), reservasHeap: reservasHeap.toArray() })}\n\n`);

  req.on('close', () => {
    sseClients = sseClients.filter(c => c !== res);
  });
});

function broadcastMonitores() {
  broadcast('monitores', { cocinaQueue: pedidosQueue.toArray(), reservasHeap: reservasHeap.toArray() });
}

// ==================== AUTH ROUTES ====================
app.post('/api/register', (req, res) => {
  const { username, password, nombre } = req.body;
  if (!username || !password) return res.status(400).json({ error: 'Usuario y Contraseña requeridos' });

  const exists = db.prepare('SELECT id FROM admin_users WHERE username = ?').get(username);
  if (exists) return res.status(400).json({ error: 'El nombre de usuario ya está en uso' });

  const hash = bcrypt.hashSync(password, 10);
  const result = db.prepare('INSERT INTO admin_users (username, password_hash, nombre, rol) VALUES (?, ?, ?, ?)').run(username, hash, nombre || username, 'cliente');
  
  req.session.userId = result.lastInsertRowid;
  req.session.username = username;
  req.session.rol = 'cliente';
  res.json({ ok: true, rol: 'cliente', nombre: nombre || username });
});

app.post('/api/login', (req, res) => {
  const { username, password } = req.body;
  const user = db.prepare('SELECT * FROM admin_users WHERE username = ?').get(username);
  if (!user || !bcrypt.compareSync(password, user.password_hash)) {
    return res.status(401).json({ error: 'Credenciales incorrectas' });
  }
  req.session.userId = user.id;
  req.session.username = user.username;
  req.session.rol = user.rol; // Guardamos el rol en sesion
  res.json({ ok: true, nombre: user.nombre, rol: user.rol });
});

app.post('/api/logout', (req, res) => {
  req.session.destroy();
  res.json({ ok: true });
});

app.get('/api/session', (req, res) => {
  if (req.session && req.session.userId) {
    const user = db.prepare('SELECT id, username, nombre, rol FROM admin_users WHERE id = ?').get(req.session.userId);
    return res.json({ loggedIn: true, user });
  }
  res.json({ loggedIn: false });
});

app.put('/api/password', requireAuth, (req, res) => {
  const { current, newpass } = req.body;
  const user = db.prepare('SELECT * FROM admin_users WHERE id = ?').get(req.session.userId);
  if (!bcrypt.compareSync(current, user.password_hash)) {
    return res.status(400).json({ error: 'Contraseña actual incorrecta' });
  }
  db.prepare('UPDATE admin_users SET password_hash = ? WHERE id = ?').run(bcrypt.hashSync(newpass, 10), req.session.userId);
  res.json({ ok: true });
});

// ==================== USUARIOS & PERMISOS ====================
app.get('/api/usuarios', requireAuth, (req, res) => {
  res.json(db.prepare('SELECT id, username, nombre, rol FROM admin_users ORDER BY id').all());
});

app.post('/api/usuarios', requireAuth, (req, res) => {
  const { username, password, nombre, rol } = req.body;
  try {
    const hash = bcrypt.hashSync(password, 10);
    const result = db.prepare('INSERT INTO admin_users (username, password_hash, nombre, rol) VALUES (?, ?, ?, ?)').run(username, hash, nombre, rol || 'cliente');
    res.json({ ok: true, id: result.lastInsertRowid });
  } catch(e) {
    if (e.message.includes('UNIQUE constraint')) return res.status(400).json({ error: 'El nombre de usuario ya está en uso' });
    res.status(500).json({ error: 'Error interno de base de datos' });
  }
});

app.delete('/api/usuarios/:id', requireAuth, (req, res) => {
  db.prepare('DELETE FROM admin_users WHERE id=?').run(req.params.id);
  res.json({ ok: true });
});

// ==================== HELADOS ====================
app.get('/api/helados', (req, res) => {
  res.json(db.prepare('SELECT * FROM helados ORDER BY id').all());
});

app.get('/api/helados/activos', (req, res) => {
  res.json(db.prepare('SELECT * FROM helados WHERE activo = 1 ORDER BY id').all());
});

app.post('/api/helados', requireAuth, (req, res) => {
  const { nombre, descripcion, precio, categoria, imagen, stock } = req.body;
  const result = db.prepare('INSERT INTO helados (nombre, descripcion, precio, categoria, imagen, stock) VALUES (?, ?, ?, ?, ?, ?)').run(nombre, descripcion, precio, categoria || 'clasicos', imagen || '', stock || 100);
  broadcast('update', { type: 'helados' });
  res.json({ ok: true, id: result.lastInsertRowid });
});

app.put('/api/helados/:id', requireAuth, (req, res) => {
  const { nombre, descripcion, precio, categoria, imagen, stock, activo } = req.body;
  db.prepare('UPDATE helados SET nombre=?, descripcion=?, precio=?, categoria=?, imagen=?, stock=?, activo=? WHERE id=?').run(nombre, descripcion, precio, categoria, imagen, stock, activo, req.params.id);
  broadcast('update', { type: 'helados' });
  res.json({ ok: true });
});

app.delete('/api/helados/:id', requireAuth, (req, res) => {
  db.prepare('DELETE FROM helados WHERE id=?').run(req.params.id);
  broadcast('update', { type: 'helados' });
  res.json({ ok: true });
});

// ==================== PROMOCIONES ====================
app.get('/api/promociones', (req, res) => {
  res.json(db.prepare('SELECT * FROM promociones ORDER BY id').all());
});

app.get('/api/promociones/activas', (req, res) => {
  res.json(db.prepare('SELECT * FROM promociones WHERE activo = 1 ORDER BY id').all());
});

app.post('/api/promociones', requireAuth, (req, res) => {
  const { titulo, descripcion, dia, hora, precio_original, precio_promo, descuento, imagen, badge } = req.body;
  const result = db.prepare('INSERT INTO promociones (titulo, descripcion, dia, hora, precio_original, precio_promo, descuento, imagen, badge) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)').run(titulo, descripcion, dia, hora, precio_original || null, precio_promo || null, descuento, imagen, badge || '🔥 HOT');
  broadcast('update', { type: 'promociones' });
  res.json({ ok: true, id: result.lastInsertRowid });
});

app.put('/api/promociones/:id', requireAuth, (req, res) => {
  const { titulo, descripcion, dia, hora, precio_original, precio_promo, descuento, imagen, badge, activo } = req.body;
  db.prepare('UPDATE promociones SET titulo=?, descripcion=?, dia=?, hora=?, precio_original=?, precio_promo=?, descuento=?, imagen=?, badge=?, activo=? WHERE id=?').run(titulo, descripcion, dia, hora, precio_original || null, precio_promo || null, descuento, imagen, badge, activo, req.params.id);
  broadcast('update', { type: 'promociones' });
  res.json({ ok: true });
});

app.delete('/api/promociones/:id', requireAuth, (req, res) => {
  db.prepare('DELETE FROM promociones WHERE id=?').run(req.params.id);
  broadcast('update', { type: 'promociones' });
  res.json({ ok: true });
});

// ==================== UBICACIONES ====================
app.get('/api/ubicaciones', (req, res) => {
  res.json(db.prepare('SELECT * FROM ubicaciones ORDER BY id').all());
});

app.post('/api/ubicaciones', requireAuth, (req, res) => {
  const { nombre, direccion, telefono, horario, imagen, mapa_url, badge } = req.body;
  const result = db.prepare('INSERT INTO ubicaciones (nombre, direccion, telefono, horario, imagen, mapa_url, badge) VALUES (?, ?, ?, ?, ?, ?, ?)').run(nombre, direccion, telefono, horario, imagen, mapa_url, badge || '📍 Sucursal');
  broadcast('update', { type: 'ubicaciones' });
  res.json({ ok: true, id: result.lastInsertRowid });
});

app.put('/api/ubicaciones/:id', requireAuth, (req, res) => {
  const { nombre, direccion, telefono, horario, imagen, mapa_url, badge } = req.body;
  db.prepare('UPDATE ubicaciones SET nombre=?, direccion=?, telefono=?, horario=?, imagen=?, mapa_url=?, badge=? WHERE id=?').run(nombre, direccion, telefono, horario, imagen, mapa_url, badge, req.params.id);
  broadcast('update', { type: 'ubicaciones' });
  res.json({ ok: true });
});

app.delete('/api/ubicaciones/:id', requireAuth, (req, res) => {
  db.prepare('DELETE FROM ubicaciones WHERE id=?').run(req.params.id);
  broadcast('update', { type: 'ubicaciones' });
  res.json({ ok: true });
});

// ==================== COMPRAS Y POS (API QUEUE) ====================
app.get('/api/pos/buscar', (req, res) => {
  // Búsqueda O(m) via Trie
  const result = heladosTrie.searchPrefix(req.query.q || '');
  res.json({ ok: true, resultados: result });
});

app.post('/api/pos/ordenes', (req, res) => {
  const { items, total, origen, notas } = req.body;
  const result = db.prepare('INSERT INTO compras (cliente, items, total, origen, estado_pedido) VALUES (?, ?, ?, ?, ?)').run('Cliente', JSON.stringify(items), total, origen, 'en_cola');
  
  refreshDataStructures();
  if (process.send) process.send({ type: 'sync_structures' });
  else broadcastMonitores();
  
  res.json({ ok: true, id: result.lastInsertRowid });
});

app.post('/api/pos/ordenes/:id/entregar', (req, res) => {
  db.prepare("UPDATE compras SET estado_pedido='entregado' WHERE id=?").run(req.params.id);
  
  refreshDataStructures();
  if (process.send) process.send({ type: 'sync_structures' });
  else broadcastMonitores();
  
  res.json({ ok: true });
});

app.get('/api/compras', requireAuth, (req, res) => {
  res.json(db.prepare('SELECT * FROM compras ORDER BY fecha DESC LIMIT 200').all());
});

app.delete('/api/compras/:id', requireAuth, (req, res) => {
  db.prepare('DELETE FROM compras WHERE id=?').run(req.params.id);
  res.json({ ok: true });
});

// ==================== RESERVAS (API MIN-HEAP) ====================
app.get('/api/reservas', requireAuth, (req, res) => {
  res.json(db.prepare('SELECT * FROM reservas ORDER BY fecha DESC LIMIT 200').all());
});

app.post('/api/reservas', (req, res) => {
  const { fecha_reserva, cliente, telefono, tipo, detalles } = req.body;
  const result = db.prepare('INSERT INTO reservas (fecha_reserva, cliente, telefono, tipo, detalles) VALUES (?, ?, ?, ?, ?)').run(fecha_reserva, cliente, telefono, tipo || 'cumpleaños', detalles);
  
  refreshDataStructures();
  if (process.send) process.send({ type: 'sync_structures' });
  else broadcastMonitores();

  res.json({ ok: true, id: result.lastInsertRowid });
});

app.put('/api/reservas/:id', requireAuth, (req, res) => {
  const { estado } = req.body;
  db.prepare('UPDATE reservas SET estado = ? WHERE id = ?').run(estado, req.params.id);
  
  refreshDataStructures();
  if (process.send) process.send({ type: 'sync_structures' });
  else broadcastMonitores();
  
  res.json({ ok: true });
});

app.delete('/api/reservas/:id', requireAuth, (req, res) => {
  db.prepare('DELETE FROM reservas WHERE id=?').run(req.params.id);
  
  refreshDataStructures();
  if (process.send) process.send({ type: 'sync_structures' });
  else broadcastMonitores();
  
  res.json({ ok: true });
});

// ==================== CONFIGURACION ====================
app.get('/api/config', (req, res) => {
  const rows = db.prepare('SELECT * FROM configuracion').all();
  const config = {};
  rows.forEach(r => config[r.clave] = r.valor);
  res.json(config);
});

app.put('/api/config', requireAuth, (req, res) => {
  const configs = req.body;
  const stmt = db.prepare('INSERT OR REPLACE INTO configuracion (clave, valor) VALUES (?, ?)');
  for (const [key, value] of Object.entries(configs)) {
    stmt.run(key, String(value));
  }
  broadcast('update', { type: 'config' });
  res.json({ ok: true });
});

// ==================== FILE UPLOAD ====================
app.post('/api/upload', requireAuth, upload.single('imagen'), (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No se subió archivo' });
  res.json({ ok: true, url: `/uploads/${req.file.filename}` });
});

// ==================== PARALELISMO Y CONCURRENCIA ====================
// 1. Data Parallelism Model
app.get('/api/analytics/ventas', requireAuth, (req, res) => {
  const compras = db.prepare('SELECT total FROM compras').all();
  const workerPath = path.resolve(__dirname, 'workers', 'data_worker.js');

  const worker = new Worker(workerPath, { workerData: compras });

  worker.on('message', (resultado) => {
    res.json({ ok: true, source: 'worker_thread', data: resultado });
  });

  worker.on('error', (err) => {
    res.status(500).json({ error: 'Fallo al procesar datos en paralelo' });
  });
});

// 2. Task Graph Model
app.get('/api/analytics/informe-complejo', requireAuth, async (req, res) => {
  try {
    const resultado = await ejecutarTaskGraph();
    res.json({ ok: true, source: 'dag_promises', data: resultado });
  } catch (err) {
    res.status(500).json({ error: 'Fallo al orquestar tareas de grafo' });
  }
});

// 3. Pipeline Model
app.get('/api/exportar/compras', requireAuth, (req, res) => {
  exportarComprasPipeline(res);
});

// ==================== DASHBOARD STATS ====================
app.get('/api/stats', requireAuth, (req, res) => {
  const totalHelados = db.prepare('SELECT COUNT(*) as c FROM helados WHERE activo=1').get().c;
  const totalPromos = db.prepare('SELECT COUNT(*) as c FROM promociones WHERE activo=1').get().c;
  const totalCompras = db.prepare('SELECT COUNT(*) as c FROM compras').get().c;
  const totalReservas = db.prepare("SELECT COUNT(*) as c FROM reservas WHERE estado='pendiente'").get().c;
  const ventasHoy = db.prepare("SELECT COALESCE(SUM(total),0) as t FROM compras WHERE date(fecha)=date('now')").get().t;
  const stockBajo = db.prepare('SELECT COUNT(*) as c FROM helados WHERE stock < 20 AND activo=1').get().c;
  const ingresosMes = db.prepare("SELECT COALESCE(SUM(total),0) as t FROM compras WHERE strftime('%Y-%m',fecha)=strftime('%Y-%m','now')").get().t;
  const totalUbicaciones = db.prepare('SELECT COUNT(*) as c FROM ubicaciones').get().c;
  res.json({ totalHelados, totalPromos, totalCompras, totalReservas, ventasHoy, stockBajo, ingresosMes, totalUbicaciones });
});

// ==================== START (MASTER-WORKER IPC SYNC) ====================
if (cluster.isPrimary) {
  const numCPUs = Math.min(os.cpus().length, 4);
  console.log(`\n🍦 El Torero Helados - [Master-Worker] Proceso Maestro PID ${process.pid} iniciando. Levantando ${numCPUs} workers...\n`);

  for (let i = 0; i < numCPUs; i++) {
    const worker = cluster.fork();
    // Inter-Process Communication (IPC) Broker
    worker.on('message', (msg) => {
      if (msg.type === 'sync_structures') {
        // Broadcast the sync signal to ALL workers
        for (const id in cluster.workers) {
          cluster.workers[id].send({ type: 'do_sync' });
        }
      }
    });
  }

  cluster.on('exit', (worker) => {
    console.log(`⚠️ [Master-Worker] Worker ${worker.process.pid} se detuvo. Inicializando recambio...`);
    cluster.fork();
  });
} else {
  // Escuchar comandos del Maestro
  process.on('message', (msg) => {
    if (msg.type === 'do_sync') {
      refreshDataStructures(); // RAM update
      broadcastMonitores();    // SSE blast to connected clients
    }
  });

  app.listen(PORT, () => {
    console.log(`✅ [Worker] PID ${process.pid} listo. Estructuras (Trie, Heap, Queue) activas en RAM.`);
  });
}
