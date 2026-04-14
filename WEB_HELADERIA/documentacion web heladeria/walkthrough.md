# El Torero Helados — Admin Mode & Database

## What Was Built

Converted the static HTML website into a **Node.js + Express + SQLite** application with:

- **Admin login** (button in navbar → modal → session-based auth)
- **Admin dashboard** at [/admin.html](file:///home/fisbert/Documents/WEB_HELADERIA/public/admin.html) with sidebar navigation
- **SQLite database** ([data/heladeria.db](file:///home/fisbert/Documents/WEB_HELADERIA/data/heladeria.db)) storing helados, promociones, ubicaciones, compras, reservas, and config
- **Full CRUD** for all entities via REST API
- **Dynamic content** — menu, promotions, and locations now load from the database
- **Social media updated** — WhatsApp 73434220, Instagram @El_Torero, Facebook El_Torero32

## How to Run

```bash
cd /home/fisbert/Documents/WEB_HELADERIA
npm start
# → http://localhost:3000
```

**Admin credentials:** `admin` / `admin123`

## Screenshots

### Hero Section (Social Media + Admin Button)
![Hero section with WhatsApp 73434220, Instagram El_Torero, Facebook El_Torero32](/home/fisbert/.gemini/antigravity/brain/fb0fd2b1-fa2d-4176-9530-5b2f3baca344/hero_section_verification_1773380221581.png)

### Menu Grid (3x3, loaded from API)
![Menu showing 9 flavors in grid from database](/home/fisbert/.gemini/antigravity/brain/fb0fd2b1-fa2d-4176-9530-5b2f3baca344/menu_section_verification_1_1773380254361.png)

### Login Modal
![Admin login modal with blur backdrop](/home/fisbert/.gemini/antigravity/brain/fb0fd2b1-fa2d-4176-9530-5b2f3baca344/login_modal_verification_1773380359885.png)

### Admin Dashboard
![Dashboard with stats cards](/home/fisbert/.gemini/antigravity/brain/fb0fd2b1-fa2d-4176-9530-5b2f3baca344/admin_dashboard_1773380989264.png)

### Helados Management (CRUD)
![Table with all flavors, stock, prices, and edit/delete buttons](/home/fisbert/.gemini/antigravity/brain/fb0fd2b1-fa2d-4176-9530-5b2f3baca344/helados_management_1773381043785.png)

### Compras Section
![Purchase registration panel](/home/fisbert/.gemini/antigravity/brain/fb0fd2b1-fa2d-4176-9530-5b2f3baca344/compras_management_1773381101594.png)

## Files Created/Modified

| File | Description |
|------|-------------|
| [server.js](file:///home/fisbert/Documents/WEB_HELADERIA/server.js) | Express server with REST API and auth |
| [database.js](file:///home/fisbert/Documents/WEB_HELADERIA/database.js) | SQLite schema, seeds, and connection |
| [package.json](file:///home/fisbert/Documents/WEB_HELADERIA/package.json) | Node.js project config |
| [public/index.html](file:///home/fisbert/Documents/WEB_HELADERIA/public/index.html) | Updated with login modal, dynamic content |
| [public/script.js](file:///home/fisbert/Documents/WEB_HELADERIA/public/script.js) | API data loading, login flow |
| [public/styles.css](file:///home/fisbert/Documents/WEB_HELADERIA/public/styles.css) | Added login modal, compact menu grid styles |
| [public/admin.html](file:///home/fisbert/Documents/WEB_HELADERIA/public/admin.html) | Admin dashboard page |
| [public/admin.css](file:///home/fisbert/Documents/WEB_HELADERIA/public/admin.css) | Admin panel styling |
| [public/admin.js](file:///home/fisbert/Documents/WEB_HELADERIA/public/admin.js) | Admin CRUD logic |

## Admin Demo Recording
![Admin panel demo](/home/fisbert/.gemini/antigravity/brain/fb0fd2b1-fa2d-4176-9530-5b2f3baca344/admin_demo.webp)
