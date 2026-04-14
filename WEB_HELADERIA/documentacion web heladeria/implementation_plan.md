# Admin Mode, Login System & Database for El Torero Helados

Convert the static HTML website into a local Node.js web application with an Express backend, SQLite database, and admin panel to manage all sections.

## User Review Required

> [!IMPORTANT]
> The site will now run as a Node.js server (`npm start`) at `http://localhost:3000` instead of opening [index.html](file:///home/fisbert/Documents/WEB_HELADERIA/index.html) directly.

> [!IMPORTANT]
> Default admin credentials: **admin** / **admin123** — change these after first login.

## Proposed Changes

### Backend Server

#### [NEW] [package.json](file:///home/fisbert/Documents/WEB_HELADERIA/package.json)
- Node.js project with dependencies: `express`, `better-sqlite3`, `express-session`, `multer` (for image uploads), `bcryptjs`

#### [NEW] [server.js](file:///home/fisbert/Documents/WEB_HELADERIA/server.js)
- Express server on port 3000
- Session-based authentication for admin
- API routes:
  - `POST /api/login` / `POST /api/logout` / `GET /api/session`
  - `GET/POST/PUT/DELETE /api/helados` — CRUD for ice cream flavors + stock
  - `GET/POST/PUT/DELETE /api/promociones` — CRUD for promotions
  - `GET/POST/PUT/DELETE /api/ubicaciones` — CRUD for locations
  - `GET/POST /api/compras` — Register/view purchases
  - `GET/POST /api/reservas` — Register/view reservations
  - `POST /api/upload` — Image uploads for menu/promos
- Serves static files from `/public`

#### [NEW] [database.js](file:///home/fisbert/Documents/WEB_HELADERIA/database.js)
- SQLite database initialization with tables:
  - `admin_users` (id, username, password_hash)
  - `helados` (id, nombre, descripcion, precio, categoria, imagen, stock, activo)
  - `promociones` (id, titulo, descripcion, dia, hora, precio_original, precio_promo, imagen, activo)
  - `ubicaciones` (id, nombre, direccion, telefono, horario, imagen, mapa_url)
  - `compras` (id, fecha, cliente, items_json, total, metodo_pago)
  - `reservas` (id, fecha, cliente, telefono, tipo, detalles, estado)
- Seeds initial data from the existing menu and promotions

---

### Frontend Updates

#### [MODIFY] [index.html](file:///home/fisbert/Documents/WEB_HELADERIA/index.html)
- Move to `public/index.html`
- Update social media to: WhatsApp `73434220`, Instagram `@El_Torero`, Facebook `El_Torero32`
- Add admin login button in navbar
- Add login modal overlay
- Menu and promotions sections rendered dynamically from API data
- Add admin edit overlays/buttons visible only when logged in as admin

#### [NEW] [public/admin.html](file:///home/fisbert/Documents/WEB_HELADERIA/public/admin.html)
- Full admin dashboard page with sidebar navigation:
  - **Dashboard** — overview stats (total sales, active promos, stock alerts)
  - **Helados** — add/edit/delete flavors, manage stock quantities
  - **Promociones** — add/edit/delete promotions
  - **Ubicaciones** — edit location info
  - **Compras** — view/register purchases
  - **Reservas** — view/manage reservations

#### [NEW] [public/admin.css](file:///home/fisbert/Documents/WEB_HELADERIA/public/admin.css)
- Premium admin panel styles

#### [NEW] [public/admin.js](file:///home/fisbert/Documents/WEB_HELADERIA/public/admin.js)
- Admin panel logic: fetch data from API, render tables/forms, handle CRUD

#### [MODIFY] [styles.css → public/styles.css](file:///home/fisbert/Documents/WEB_HELADERIA/styles.css)
- Move to `public/` and add admin login modal styles, admin button styles

#### [MODIFY] [script.js → public/script.js](file:///home/fisbert/Documents/WEB_HELADERIA/script.js)
- Move to `public/`, add login modal logic, dynamic menu/promo loading from API

---

### File Structure

```
WEB_HELADERIA/
├── server.js          # Express server
├── database.js        # SQLite setup + seeds
├── package.json
├── data/              # SQLite database file
│   └── heladeria.db
├── uploads/           # Uploaded images
└── public/            # Static files
    ├── index.html
    ├── styles.css
    ├── script.js
    ├── admin.html
    ├── admin.css
    ├── admin.js
    └── img/           # Existing images
```

## Verification Plan

### Automated Tests
1. Start server with `npm start`, verify it runs at `http://localhost:3000`
2. Use browser tool to:
   - Open main page, verify menu loads dynamically
   - Click login button, enter admin/admin123, verify admin access
   - Navigate to `/admin.html`, verify dashboard loads
   - Add a new helado via admin, verify it appears on main page
   - Register a purchase via admin, verify it appears in compras list
