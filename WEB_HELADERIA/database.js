const Database = require('better-sqlite3');
const bcrypt = require('bcryptjs');
const path = require('path');
const fs = require('fs');

const DB_PATH = path.join(__dirname, 'data', 'heladeria.db');

// Ensure data directory exists
fs.mkdirSync(path.join(__dirname, 'data'), { recursive: true });

const db = new Database(DB_PATH);

// Enable WAL mode for better performance
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

// ==================== CREATE TABLES ====================
db.exec(`
  CREATE TABLE IF NOT EXISTS admin_users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    nombre TEXT DEFAULT 'Administrador',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS helados (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    nombre TEXT NOT NULL,
    descripcion TEXT,
    precio REAL NOT NULL,
    categoria TEXT DEFAULT 'clasicos',
    imagen TEXT,
    stock INTEGER DEFAULT 100,
    activo INTEGER DEFAULT 1,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS promociones (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    titulo TEXT NOT NULL,
    descripcion TEXT,
    dia TEXT,
    hora TEXT,
    precio_original REAL,
    precio_promo REAL,
    descuento TEXT,
    imagen TEXT,
    badge TEXT DEFAULT '🔥 HOT',
    activo INTEGER DEFAULT 1,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS ubicaciones (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    nombre TEXT NOT NULL,
    direccion TEXT,
    telefono TEXT,
    horario TEXT,
    imagen TEXT,
    mapa_url TEXT,
    badge TEXT DEFAULT '📍 Sucursal',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS compras (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    fecha DATETIME DEFAULT CURRENT_TIMESTAMP,
    cliente TEXT,
    items TEXT,
    total REAL NOT NULL,
    metodo_pago TEXT DEFAULT 'efectivo',
    notas TEXT
  );

  CREATE TABLE IF NOT EXISTS reservas (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    fecha DATETIME DEFAULT CURRENT_TIMESTAMP,
    fecha_reserva TEXT,
    cliente TEXT NOT NULL,
    telefono TEXT,
    tipo TEXT DEFAULT 'cumpleaños',
    detalles TEXT,
    estado TEXT DEFAULT 'pendiente'
  );

  CREATE TABLE IF NOT EXISTS configuracion (
    clave TEXT PRIMARY KEY,
    valor TEXT
  );
`);

// ==================== MIGRACIONES (Para retrocompatibilidad) ====================
try { db.exec("ALTER TABLE admin_users ADD COLUMN rol TEXT DEFAULT 'admin'"); } catch (e) {}
try { db.exec("ALTER TABLE compras ADD COLUMN origen TEXT DEFAULT 'cliente_web'"); } catch (e) {}
try { db.exec("ALTER TABLE compras ADD COLUMN estado_pedido TEXT DEFAULT 'en_cola'"); } catch (e) {}

// ==================== SEED DATA ====================
function seedDatabase() {
  const adminCount = db.prepare("SELECT COUNT(*) as count FROM admin_users WHERE username='admin'").get().count;
  const hash = bcrypt.hashSync('admin123', 10);
  
  if (adminCount === 0) {
    db.prepare('INSERT INTO admin_users (username, password_hash, nombre, rol) VALUES (?, ?, ?, ?)').run('admin', hash, 'Administrador', 'admin');
    console.log('✅ Admin user created');
  }

  const cajaCount = db.prepare("SELECT COUNT(*) as count FROM admin_users WHERE username='caja1'").get().count;
  if (cajaCount === 0) {
    db.prepare('INSERT INTO admin_users (username, password_hash, nombre, rol) VALUES (?, ?, ?, ?)').run('caja1', hash, 'Cajero Principal', 'empleado');
    console.log('✅ Caja User created');
  }

  const heladoCount = db.prepare('SELECT COUNT(*) as count FROM helados').get().count;

  if (heladoCount === 0) {
    const helados = [
      { nombre: 'Leche de Toro', descripcion: 'Leche caramelizada cremosa con veta de dulce de leche', precio: 40, categoria: 'especiales', imagen: '/img/dulce-leche.png', stock: 50 },
      { nombre: 'Vainilla', descripcion: 'Helado clásico de vainilla, suave y cremoso.', precio: 35, categoria: 'clasicos', imagen: '/img/vanilla.png', stock: 80 },
      { nombre: 'Chocolate', descripcion: 'Helado intenso de cacao oscuro y cremoso.', precio: 38, categoria: 'clasicos', imagen: '/img/chocolate.png', stock: 60 },
      { nombre: 'Pistacho', descripcion: 'Helado de pistacho con trozos de pistacho crujientes.', precio: 40, categoria: 'especiales', imagen: '/img/cookies.png', stock: 30 },
      { nombre: 'Café', descripcion: 'Helado cremoso de café espresso, un toque intenso.', precio: 39, categoria: 'especiales', imagen: '/img/chocolate.png', stock: 40 },
      { nombre: 'Coco', descripcion: 'Helado tropical de coco, suave y aromático.', precio: 41, categoria: 'frutales', imagen: '/img/vanilla.png', stock: 35 },
      { nombre: 'Fresa', descripcion: 'Helado de crema y fresas naturales, dulce y delicado.', precio: 36, categoria: 'frutales', imagen: '/img/fresa.png', stock: 70 },
      { nombre: 'Mango', descripcion: 'Helado de mango maduro, refrescante y tropical.', precio: 36, categoria: 'frutales', imagen: '/img/mango.png', stock: 45 },
      { nombre: 'Limón', descripcion: 'Sorbete de limón fresco y ligero.', precio: 35, categoria: 'frutales', imagen: '/img/fresa.png', stock: 50 }
    ];

    const stmt = db.prepare('INSERT INTO helados (nombre, descripcion, precio, categoria, imagen, stock) VALUES (?, ?, ?, ?, ?, ?)');
    for (const h of helados) {
      stmt.run(h.nombre, h.descripcion, h.precio, h.categoria, h.imagen, h.stock);
    }
    console.log('✅ Seeded 9 helados');
  }

  const promoCount = db.prepare('SELECT COUNT(*) as count FROM promociones').get().count;

  if (promoCount === 0) {
    const promos = [
      { titulo: '2x1 en Conos Dobles', descripcion: 'Todos los martes, lleva dos conos dobles por el precio de uno. ¡Comparte con quien más quieras!', dia: 'Todos los Martes', hora: '14:00 - 18:00', precio_original: 50, precio_promo: 25, descuento: null, imagen: '/img/promo.png', badge: '🔥 HOT' },
      { titulo: 'Sundae Familiar', descripcion: 'Un sundae gigante para compartir con toda la familia. Incluye 6 bolas, toppings, crema batida y salsa.', dia: 'Fines de semana', hora: 'Todo el día', precio_original: null, precio_promo: 60, descuento: null, imagen: null, badge: '✨ NUEVO' },
      { titulo: 'Paquete Cumpleaños', descripcion: 'Celebra tu cumpleaños con nosotros. Torta helada para 10 personas, decoración y recuerdo especial.', dia: 'Previa reserva', hora: 'Consultar horarios', precio_original: null, precio_promo: 250, descuento: null, imagen: null, badge: '🎂 CUMPLE' },
      { titulo: 'Descuento Delivery', descripcion: 'Pide por delivery y obtén un 15% de descuento en tu primer pedido. Acumula puntos de fidelidad.', dia: 'Todos los días', hora: '10:00 - 22:00', precio_original: null, precio_promo: null, descuento: '-15%', imagen: null, badge: '📱 APP' }
    ];

    const stmt = db.prepare('INSERT INTO promociones (titulo, descripcion, dia, hora, precio_original, precio_promo, descuento, imagen, badge) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)');
    for (const p of promos) {
      stmt.run(p.titulo, p.descripcion, p.dia, p.hora, p.precio_original, p.precio_promo, p.descuento, p.imagen, p.badge);
    }
    console.log('✅ Seeded 4 promociones');
  }

  const ubiCount = db.prepare('SELECT COUNT(*) as count FROM ubicaciones').get().count;

  if (ubiCount === 0) {
    const ubis = [
      { nombre: 'Sucursal Centro', direccion: 'Av. Monseñor Rivero #234, Zona Centro', telefono: '+591 3 333-4444', horario: 'Lun - Dom: 10:00 - 22:00', imagen: '/img/tienda.png', mapa_url: 'https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d3801.8!2d-63.18!3d-17.78!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x0%3A0x0!2zMTfCsDQ2JzQ4LjAiUyA2M8KwMTAnNDguMCJX!5e0!3m2!1ses!2sbo!4v1', badge: '📍 Principal' },
      { nombre: 'Sucursal Equipetrol', direccion: 'Av. San Martín esq. Calle 10, Equipetrol', telefono: '+591 3 555-6666', horario: 'Lun - Dom: 11:00 - 23:00', imagen: '/img/tienda.png', mapa_url: 'https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d3801.8!2d-63.19!3d-17.77!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x0%3A0x0!2zMTfCsDQ2JzEyLjAiUyA2M8KwMTEnMjQuMCJX!5e0!3m2!1ses!2sbo!4v1', badge: '📍 Sucursal' }
    ];

    const stmt = db.prepare('INSERT INTO ubicaciones (nombre, direccion, telefono, horario, imagen, mapa_url, badge) VALUES (?, ?, ?, ?, ?, ?, ?)');
    for (const u of ubis) {
      stmt.run(u.nombre, u.direccion, u.telefono, u.horario, u.imagen, u.mapa_url, u.badge);
    }
    console.log('✅ Seeded 2 ubicaciones');
  }

  // Seed config
  const confCount = db.prepare('SELECT COUNT(*) as count FROM configuracion').get().count;
  if (confCount === 0) {
    const configs = [
      ['whatsapp', '73434220'],
      ['instagram', 'El_Torero'],
      ['facebook', 'El_Torero32'],
      ['nombre_negocio', 'El Torero Helados'],
      ['slogan', 'Los mejores helados artesanales de Santa Cruz']
    ];
    const stmt = db.prepare('INSERT INTO configuracion (clave, valor) VALUES (?, ?)');
    for (const [c, v] of configs) {
      stmt.run(c, v);
    }
    console.log('✅ Seeded configuration');
  }
}

seedDatabase();

module.exports = db;
