/* ==========================================
   EL TORERO HELADOS - Admin Panel JS (v2)
   Real-time, Toasts, Image Upload, Cards
   ========================================== */

document.addEventListener('DOMContentLoaded', async () => {

    const layout = document.getElementById('admin-layout');
    const redirect = document.getElementById('login-redirect');

    // Check session
    const session = await fetch('/api/session').then(r => r.json());
    if (!session.loggedIn) { redirect.style.display = 'flex'; layout.style.display = 'none'; return; }
    if (session.user.rol !== 'admin') { window.location.href = '/empleados.html'; return; }
    redirect.style.display = 'none';
    layout.style.display = 'flex';
    const initials = (session.user.nombre || session.user.username || 'A').split(' ').map(w => w[0]).join('').substring(0, 2).toUpperCase();
    document.getElementById('admin-user').textContent = initials;

    // === Toast ===
    function toast(msg, type = 'success') {
        const el = document.createElement('div');
        el.className = `toast ${type}`;
        el.innerHTML = `${type === 'success' ? '✅' : type === 'error' ? '❌' : 'ℹ️'} ${msg}`;
        document.getElementById('toast-container').appendChild(el);
        setTimeout(() => { el.style.animation = 'toastOut 0.3s ease forwards'; setTimeout(() => el.remove(), 300); }, 3000);
    }

    // === SSE Real-Time ===
    function connectSSE() {
        const evtSource = new EventSource('/api/events');
        evtSource.addEventListener('update', (e) => {
            try {
                const data = JSON.parse(e.data);
                const activePanel = document.querySelector('.sidebar-link.active')?.dataset.panel;
                if (activePanel === 'dashboard') loadDashboard();
                if (data.type === 'helados' && activePanel === 'helados') loadHelados();
                if (data.type === 'promociones' && activePanel === 'promociones') loadPromos();
                if (data.type === 'ubicaciones' && activePanel === 'ubicaciones') loadUbis();
                if (data.type === 'config' && activePanel === 'config') loadConfig();
            } catch (err) {}
        });
        evtSource.onerror = () => { evtSource.close(); setTimeout(connectSSE, 5000); };
    }
    connectSSE();

    // === Navigation ===
    const sidebarLinks = document.querySelectorAll('.sidebar-link[data-panel]');
    const panels = document.querySelectorAll('.panel');
    const panelTitle = document.getElementById('panel-title');

    sidebarLinks.forEach(link => {
        link.addEventListener('click', (e) => {
            e.preventDefault();
            const target = link.dataset.panel;
            sidebarLinks.forEach(l => l.classList.remove('active'));
            link.classList.add('active');
            panels.forEach(p => p.classList.remove('active'));
            document.getElementById(`panel-${target}`).classList.add('active');
            panelTitle.textContent = link.textContent.trim();
            document.getElementById('sidebar').classList.remove('open');
            loadPanel(target);
        });
    });

    document.getElementById('sidebar-toggle').addEventListener('click', () => document.getElementById('sidebar').classList.toggle('open'));
    document.getElementById('btn-logout').addEventListener('click', async () => { await fetch('/api/logout', { method: 'POST' }); window.location.href = '/'; });

    // === Modal ===
    const modal = document.getElementById('admin-modal');
    const modalTitle = document.getElementById('admin-modal-title');
    const modalBody = document.getElementById('admin-modal-body');
    const modalForm = document.getElementById('admin-modal-form');
    let modalCallback = null;

    function openModal(title, fieldsHTML, onSubmit) {
        modalTitle.textContent = title;
        modalBody.innerHTML = fieldsHTML;
        modalCallback = onSubmit;
        modal.classList.add('show');
        // Init image upload previews
        modalBody.querySelectorAll('.upload-preview').forEach(p => {
            p.addEventListener('click', () => p.parentElement.querySelector('input[type=file]').click());
        });
        modalBody.querySelectorAll('.upload-file').forEach(f => {
            f.addEventListener('change', async (e) => {
                if (e.target.files[0]) {
                    const fd = new FormData();
                    fd.append('imagen', e.target.files[0]);
                    toast('Subiendo imagen...', 'info');
                    const res = await fetch('/api/upload', { method: 'POST', body: fd }).then(r => r.json());
                    if (res.ok) {
                        const urlInput = f.parentElement.querySelector('.upload-url');
                        if (urlInput) urlInput.value = res.url;
                        const preview = f.parentElement.querySelector('.upload-preview');
                        if (preview) preview.innerHTML = `<img src="${res.url}" alt="preview">`;
                        toast('Imagen subida');
                    }
                }
            });
        });
    }

    function closeModal() { modal.classList.remove('show'); modalCallback = null; }
    document.getElementById('admin-modal-close').addEventListener('click', closeModal);
    document.getElementById('admin-modal-cancel').addEventListener('click', closeModal);
    modal.addEventListener('click', (e) => { if (e.target === modal) closeModal(); });

    modalForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        if (modalCallback) {
            const fd = new FormData(modalForm);
            const data = Object.fromEntries(fd.entries());
            // Remove file inputs from data
            delete data.file_imagen;
            try {
                await modalCallback(data);
                closeModal();
            } catch (err) { toast('Error al guardar', 'error'); }
        }
    });

    // === Load panel ===
    async function loadPanel(p) {
        switch (p) {
            case 'dashboard': await loadDashboard(); break;
            case 'helados': await loadHelados(); break;
            case 'promociones': await loadPromos(); break;
            case 'ubicaciones': await loadUbis(); break;
            case 'usuarios': await loadUsuarios(); break;
            case 'compras': await loadCompras(); break;
            case 'reservas': await loadReservas(); break;
            case 'config': await loadConfig(); break;
        }
    }

    // === DASHBOARD ===
    async function loadDashboard() {
        const s = await fetch('/api/stats').then(r => r.json());
        document.getElementById('stats-grid').innerHTML = `
            <div class="stat-card info"><div class="sc-top"><span class="sc-icon">🍦</span></div><div class="sc-value">${s.totalHelados}</div><div class="sc-label">Sabores Activos</div></div>
            <div class="stat-card success"><div class="sc-top"><span class="sc-icon">🎉</span></div><div class="sc-value">${s.totalPromos}</div><div class="sc-label">Promociones Activas</div></div>
            <div class="stat-card primary"><div class="sc-top"><span class="sc-icon">🛒</span></div><div class="sc-value">${s.totalCompras}</div><div class="sc-label">Ventas Totales</div></div>
            <div class="stat-card warning"><div class="sc-top"><span class="sc-icon">📅</span></div><div class="sc-value">${s.totalReservas}</div><div class="sc-label">Reservas Pendientes</div></div>
            <div class="stat-card success"><div class="sc-top"><span class="sc-icon">💰</span></div><div class="sc-value">Bs. ${s.ventasHoy}</div><div class="sc-label">Ventas de Hoy</div></div>
            <div class="stat-card ${s.stockBajo > 0 ? 'danger' : 'info'}"><div class="sc-top"><span class="sc-icon">⚠️</span></div><div class="sc-value">${s.stockBajo}</div><div class="sc-label">Stock Bajo (&lt;20)</div></div>
            <div class="stat-card info"><div class="sc-top"><span class="sc-icon">💵</span></div><div class="sc-value">Bs. ${s.ingresosMes}</div><div class="sc-label">Ingresos del Mes</div></div>
            <div class="stat-card"><div class="sc-top"><span class="sc-icon">📍</span></div><div class="sc-value">${s.totalUbicaciones}</div><div class="sc-label">Sucursales</div></div>
        `;
    }

    // === USUARIOS ===
    async function loadUsuarios() {
        const users = await fetch('/api/usuarios').then(r => r.json());
        const tbody = document.querySelector('#table-usuarios tbody');
        tbody.innerHTML = users.map(u => `
            <tr>
                <td>#${u.id}</td>
                <td><span class="badge ${u.rol==='admin'?'badge-active':u.rol==='empleado'?'badge-pending':'badge-inactive'}">${u.rol.toUpperCase()}</span></td>
                <td><strong>${u.username}</strong></td>
                <td>${u.nombre || '-'}</td>
                <td><button class="btn-sm btn-delete" onclick="deleteUser(${u.id})">🗑️</button></td>
            </tr>
        `).join('');
    }

    document.getElementById('btn-add-user')?.addEventListener('click', () => {
        openModal('👥 Nuevo Perfil', `
            <div class="form-grid">
                <div class="fg"><label>Usuario</label><input name="username" required></div>
                <div class="fg"><label>Contraseña</label><input name="password" type="password" required></div>
                <div class="fg"><label>Nombre</label><input name="nombre" required></div>
                <div class="fg"><label>Rol</label>
                    <select name="rol">
                        <option value="cliente">Cliente</option>
                        <option value="empleado">Empleado (Caja)</option>
                        <option value="admin">Administrador</option>
                    </select>
                </div>
            </div>
        `, async (data) => {
            const res = await fetch('/api/usuarios', { method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify(data) });
            const result = await res.json();
            if(result.ok) { toast('Usuario creado'); loadUsuarios(); }
            else { toast(result.error, 'error'); }
        });
    });

    window.deleteUser = async (id) => {
        if (!confirm('¿Eliminar cuenta de acceso?')) return;
        await fetch(`/api/usuarios/${id}`, { method: 'DELETE' });
        toast('Cuenta eliminada');
        loadUsuarios();
    };

    // === UPLOAD FIELD HTML ===
    function uploadField(current) {
        return `
            <div class="fg full fg-upload">
                <label>Imagen</label>
                <div class="upload-preview">${current ? `<img src="${current}" alt="preview">` : '<span class="upload-text">📷 Click para subir imagen</span>'}</div>
                <input type="file" class="upload-file" name="file_imagen" accept="image/*" style="display:none">
                <input type="hidden" class="upload-url" name="imagen" value="${current||''}">
            </div>
        `;
    }

    // === HELADOS ===
    async function loadHelados() {
        const helados = await fetch('/api/helados').then(r => r.json());
        document.getElementById('helados-count').textContent = `${helados.length} items`;
        document.getElementById('helados-cards').innerHTML = helados.map(h => `
            <div class="item-card">
                ${h.imagen ? `<img class="ic-img" src="${h.imagen}" alt="${h.nombre}">` : '<div class="ic-img" style="display:flex;align-items:center;justify-content:center;font-size:3rem;">🍦</div>'}
                <div class="ic-body">
                    <div class="ic-header"><h4>${h.nombre}</h4><span class="badge ${h.activo ? 'badge-active' : 'badge-inactive'}">${h.activo ? 'Activo' : 'Inactivo'}</span></div>
                    <p class="ic-desc">${h.descripcion || 'Sin descripción'}</p>
                    <div class="ic-meta">
                        <span class="tag tag-price">Bs. ${h.precio}</span>
                        <span class="tag tag-cat">${h.categoria}</span>
                        <span class="tag tag-stock ${h.stock < 20 ? 'low' : ''}">Stock: ${h.stock}</span>
                    </div>
                    <div class="ic-actions">
                        <button class="btn-sm btn-edit" onclick="editHelado(${h.id})">✏️ Editar</button>
                        <button class="btn-sm btn-delete" onclick="deleteHelado(${h.id})">🗑️ Eliminar</button>
                    </div>
                </div>
            </div>
        `).join('');
    }

    const heladoFields = (h = {}) => `
        <div class="form-grid">
            <div class="fg"><label>Nombre</label><input name="nombre" value="${h.nombre||''}" required></div>
            <div class="fg"><label>Precio (Bs.)</label><input name="precio" type="number" step="0.01" value="${h.precio||''}" required></div>
            <div class="fg full"><label>Descripción</label><textarea name="descripcion">${h.descripcion||''}</textarea></div>
            <div class="fg"><label>Categoría</label>
                <select name="categoria">
                    <option value="clasicos" ${h.categoria==='clasicos'?'selected':''}>Clásicos</option>
                    <option value="especiales" ${h.categoria==='especiales'?'selected':''}>Especiales</option>
                    <option value="frutales" ${h.categoria==='frutales'?'selected':''}>Frutales</option>
                    <option value="premium" ${h.categoria==='premium'?'selected':''}>Premium</option>
                </select>
            </div>
            <div class="fg"><label>Stock</label><input name="stock" type="number" value="${h.stock??100}"></div>
            <div class="fg"><label>Estado</label>
                <select name="activo"><option value="1" ${h.activo!==0?'selected':''}>Activo</option><option value="0" ${h.activo===0?'selected':''}>Inactivo</option></select>
            </div>
            ${uploadField(h.imagen)}
        </div>
    `;

    document.getElementById('btn-add-helado').addEventListener('click', () => {
        openModal('🍦 Nuevo Helado', heladoFields(), async (data) => {
            await fetch('/api/helados', { method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify(data) });
            toast('Helado creado exitosamente');
            loadHelados();
        });
    });

    window.editHelado = async (id) => {
        const h = (await fetch('/api/helados').then(r => r.json())).find(x => x.id === id);
        if (!h) return;
        openModal('✏️ Editar Helado', heladoFields(h), async (data) => {
            await fetch(`/api/helados/${id}`, { method: 'PUT', headers: {'Content-Type':'application/json'}, body: JSON.stringify(data) });
            toast('Helado actualizado');
            loadHelados();
        });
    };

    window.deleteHelado = async (id) => {
        if (!confirm('¿Eliminar este helado?')) return;
        await fetch(`/api/helados/${id}`, { method: 'DELETE' });
        toast('Helado eliminado');
        loadHelados();
    };

    // === PROMOCIONES ===
    async function loadPromos() {
        const promos = await fetch('/api/promociones').then(r => r.json());
        document.getElementById('promos-count').textContent = `${promos.length} items`;
        document.getElementById('promos-cards').innerHTML = promos.map(p => `
            <div class="item-card">
                ${p.imagen ? `<img class="ic-img" src="${p.imagen}" alt="${p.titulo}">` : '<div class="ic-img" style="display:flex;align-items:center;justify-content:center;font-size:3rem;">🎉</div>'}
                <div class="ic-body">
                    <div class="ic-header"><h4>${p.titulo}</h4><span class="badge ${p.activo ? 'badge-active' : 'badge-inactive'}">${p.activo ? 'Activa' : 'Inactiva'}</span></div>
                    <p class="ic-desc">${p.descripcion || 'Sin descripción'}</p>
                    <div class="ic-meta">
                        ${p.dia ? `<span class="tag tag-day">📅 ${p.dia}</span>` : ''}
                        ${p.hora ? `<span class="tag tag-cat">🕐 ${p.hora}</span>` : ''}
                        ${p.precio_promo ? `<span class="tag tag-price">Bs. ${p.precio_promo}</span>` : ''}
                        ${p.descuento ? `<span class="tag tag-price">${p.descuento}</span>` : ''}
                    </div>
                    <div class="ic-actions">
                        <button class="btn-sm btn-edit" onclick="editPromo(${p.id})">✏️ Editar</button>
                        <button class="btn-sm btn-delete" onclick="deletePromo(${p.id})">🗑️ Eliminar</button>
                    </div>
                </div>
            </div>
        `).join('');
    }

    const promoFields = (p = {}) => `
        <div class="form-grid">
            <div class="fg full"><label>Título</label><input name="titulo" value="${p.titulo||''}" required></div>
            <div class="fg full"><label>Descripción</label><textarea name="descripcion">${p.descripcion||''}</textarea></div>
            <div class="fg"><label>Día</label>
                <select name="dia">
                    <option value="">Seleccionar...</option>
                    <option value="Lunes" ${p.dia==='Lunes'?'selected':''}>Lunes</option>
                    <option value="Martes" ${p.dia==='Martes'?'selected':''}>Martes</option>
                    <option value="Miércoles" ${p.dia==='Miércoles'?'selected':''}>Miércoles</option>
                    <option value="Jueves" ${p.dia==='Jueves'?'selected':''}>Jueves</option>
                    <option value="Viernes" ${p.dia==='Viernes'?'selected':''}>Viernes</option>
                    <option value="Sábado" ${p.dia==='Sábado'?'selected':''}>Sábado</option>
                    <option value="Domingo" ${p.dia==='Domingo'?'selected':''}>Domingo</option>
                    <option value="Todos los días" ${p.dia==='Todos los días'?'selected':''}>Todos los días</option>
                    <option value="Lunes a Viernes" ${p.dia==='Lunes a Viernes'?'selected':''}>Lunes a Viernes</option>
                    <option value="Fines de Semana" ${p.dia==='Fines de Semana'?'selected':''}>Fines de Semana</option>
                </select>
            </div>
            <div class="fg"><label>Horario</label><input name="hora" value="${p.hora||''}" placeholder="ej. 14:00 - 17:00"></div>
            <div class="fg"><label>Precio Original (Bs.)</label><input name="precio_original" type="number" step="0.01" value="${p.precio_original||''}"></div>
            <div class="fg"><label>Precio Promo (Bs.)</label><input name="precio_promo" type="number" step="0.01" value="${p.precio_promo||''}"></div>
            <div class="fg"><label>Descuento</label><input name="descuento" value="${p.descuento||''}" placeholder="ej. 2x1, -30%"></div>
            <div class="fg"><label>Badge/Tipo</label>
                <select name="badge">
                    <option value="🔥 HOT" ${p.badge==='🔥 HOT'?'selected':''}>🔥 HOT</option>
                    <option value="⭐ NUEVA" ${p.badge==='⭐ NUEVA'?'selected':''}>⭐ NUEVA</option>
                    <option value="🎂 CUMPLE" ${p.badge==='🎂 CUMPLE'?'selected':''}>🎂 CUMPLE</option>
                    <option value="📱 APP" ${p.badge==='📱 APP'?'selected':''}>📱 APP</option>
                    <option value="🎉 ESPECIAL" ${p.badge==='🎉 ESPECIAL'?'selected':''}>🎉 ESPECIAL</option>
                    <option value="💝 FAMILIAR" ${p.badge==='💝 FAMILIAR'?'selected':''}>💝 FAMILIAR</option>
                </select>
            </div>
            <div class="fg"><label>Estado</label>
                <select name="activo"><option value="1" ${p.activo!==0?'selected':''}>Activa</option><option value="0" ${p.activo===0?'selected':''}>Inactiva</option></select>
            </div>
            ${uploadField(p.imagen)}
        </div>
    `;

    document.getElementById('btn-add-promo').addEventListener('click', () => {
        openModal('🎉 Nueva Promoción', promoFields(), async (data) => {
            await fetch('/api/promociones', { method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify(data) });
            toast('Promoción creada exitosamente');
            loadPromos();
        });
    });

    window.editPromo = async (id) => {
        const p = (await fetch('/api/promociones').then(r => r.json())).find(x => x.id === id);
        if (!p) return;
        openModal('✏️ Editar Promoción', promoFields(p), async (data) => {
            await fetch(`/api/promociones/${id}`, { method: 'PUT', headers: {'Content-Type':'application/json'}, body: JSON.stringify(data) });
            toast('Promoción actualizada');
            loadPromos();
        });
    };

    window.deletePromo = async (id) => {
        if (!confirm('¿Eliminar esta promoción?')) return;
        await fetch(`/api/promociones/${id}`, { method: 'DELETE' });
        toast('Promoción eliminada');
        loadPromos();
    };

    // === UBICACIONES ===
    async function loadUbis() {
        const ubis = await fetch('/api/ubicaciones').then(r => r.json());
        document.getElementById('ubis-count').textContent = `${ubis.length} items`;
        document.getElementById('ubis-cards').innerHTML = ubis.map(u => `
            <div class="item-card">
                ${u.imagen ? `<img class="ic-img" src="${u.imagen}" alt="${u.nombre}">` : '<div class="ic-img" style="display:flex;align-items:center;justify-content:center;font-size:3rem;">📍</div>'}
                <div class="ic-body">
                    <div class="ic-header"><h4>${u.nombre}</h4></div>
                    <p class="ic-desc">${u.direccion || 'Sin dirección'}</p>
                    <div class="ic-meta">
                        ${u.telefono ? `<span class="tag tag-cat">📞 ${u.telefono}</span>` : ''}
                        ${u.horario ? `<span class="tag tag-day">🕐 ${u.horario}</span>` : ''}
                    </div>
                    <div class="ic-actions">
                        <button class="btn-sm btn-edit" onclick="editUbi(${u.id})">✏️ Editar</button>
                        <button class="btn-sm btn-delete" onclick="deleteUbi(${u.id})">🗑️ Eliminar</button>
                    </div>
                </div>
            </div>
        `).join('');
    }

    const ubiFields = (u = {}) => `
        <div class="form-grid">
            <div class="fg"><label>Nombre</label><input name="nombre" value="${u.nombre||''}" required></div>
            <div class="fg"><label>Teléfono</label><input name="telefono" value="${u.telefono||''}"></div>
            <div class="fg full"><label>Dirección</label><input name="direccion" value="${u.direccion||''}"></div>
            <div class="fg"><label>Horario</label><input name="horario" value="${u.horario||''}"></div>
            <div class="fg"><label>Badge</label><input name="badge" value="${u.badge||'📍 Sucursal'}"></div>
            <div class="fg full"><label>URL Mapa (embed)</label><input name="mapa_url" value="${u.mapa_url||''}" placeholder="https://www.google.com/maps/embed?..."></div>
            ${uploadField(u.imagen)}
        </div>
    `;

    document.getElementById('btn-add-ubi').addEventListener('click', () => {
        openModal('📍 Nueva Ubicación', ubiFields(), async (data) => {
            await fetch('/api/ubicaciones', { method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify(data) });
            toast('Ubicación creada');
            loadUbis();
        });
    });

    window.editUbi = async (id) => {
        const u = (await fetch('/api/ubicaciones').then(r => r.json())).find(x => x.id === id);
        if (!u) return;
        openModal('✏️ Editar Ubicación', ubiFields(u), async (data) => {
            await fetch(`/api/ubicaciones/${id}`, { method: 'PUT', headers: {'Content-Type':'application/json'}, body: JSON.stringify(data) });
            toast('Ubicación actualizada');
            loadUbis();
        });
    };

    window.deleteUbi = async (id) => {
        if (!confirm('¿Eliminar esta ubicación?')) return;
        await fetch(`/api/ubicaciones/${id}`, { method: 'DELETE' });
        toast('Ubicación eliminada');
        loadUbis();
    };

    // === COMPRAS ===
    async function loadCompras() {
        const compras = await fetch('/api/compras').then(r => r.json());
        document.getElementById('compras-count').textContent = `${compras.length} ventas`;
        const tbody = document.querySelector('#table-compras tbody');
        tbody.innerHTML = compras.length === 0
            ? '<tr><td colspan="7" class="empty-row">🛒 No hay ventas registradas aún</td></tr>'
            : compras.map(c => `
                <tr>
                    <td><strong>#${c.id}</strong></td>
                    <td>${new Date(c.fecha).toLocaleDateString('es-BO')}</td>
                    <td>${c.cliente || 'Anónimo'}</td>
                    <td style="max-width:180px;font-size:0.82rem;color:var(--text-light)">${c.items || '-'}</td>
                    <td><strong>Bs. ${c.total}</strong></td>
                    <td><span class="badge ${c.metodo_pago==='efectivo'?'badge-active':c.metodo_pago==='qr'?'badge-pending':'badge-inactive'}">${c.metodo_pago}</span></td>
                    <td><button class="btn-sm btn-delete" onclick="deleteCompra(${c.id})">🗑️</button></td>
                </tr>
            `).join('');
    }

    document.getElementById('btn-add-compra').addEventListener('click', async () => {
        const helados = await fetch('/api/helados/activos').then(r => r.json());
        const opts = helados.map(h => `<option value="${h.id}" data-precio="${h.precio}">${h.nombre} - Bs.${h.precio} (Stock: ${h.stock})</option>`).join('');
        openModal('🛒 Registrar Venta', `
            <div class="form-grid">
                <div class="fg"><label>Cliente</label><input name="cliente" placeholder="Nombre del cliente"></div>
                <div class="fg"><label>Método de Pago</label>
                    <select name="metodo_pago"><option value="efectivo">💵 Efectivo</option><option value="tarjeta">💳 Tarjeta</option><option value="qr">📱 QR</option><option value="transferencia">🏦 Transferencia</option></select>
                </div>
                <div class="fg full"><label>Helado</label><select name="helado_id" id="modal-helado-select">${opts}</select></div>
                <div class="fg"><label>Cantidad</label><input name="cantidad" type="number" value="1" min="1" id="modal-cant"></div>
                <div class="fg"><label>Total (Bs.)</label><input name="total" type="number" step="0.01" id="modal-total" required></div>
                <div class="fg full"><label>Notas</label><textarea name="notas" placeholder="Notas adicionales..."></textarea></div>
            </div>
        `, async (data) => {
            const items = JSON.stringify([{ helado_id: parseInt(data.helado_id), cantidad: parseInt(data.cantidad || 1) }]);
            await fetch('/api/compras', { method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify({ ...data, items }) });
            toast('Venta registrada exitosamente');
            loadCompras();
        });
        // Auto-calc total
        setTimeout(() => {
            const sel = document.getElementById('modal-helado-select');
            const cant = document.getElementById('modal-cant');
            const total = document.getElementById('modal-total');
            function calc() { const opt = sel.options[sel.selectedIndex]; const p = opt?.dataset?.precio || 0; total.value = (parseFloat(p) * parseInt(cant.value||1)).toFixed(0); }
            sel?.addEventListener('change', calc);
            cant?.addEventListener('input', calc);
            calc();
        }, 100);
    });

    window.deleteCompra = async (id) => {
        if (!confirm('¿Eliminar esta venta?')) return;
        await fetch(`/api/compras/${id}`, { method: 'DELETE' });
        toast('Venta eliminada');
        loadCompras();
    };

    // === RESERVAS ===
    async function loadReservas() {
        const reservas = await fetch('/api/reservas').then(r => r.json());
        document.getElementById('reservas-count').textContent = `${reservas.length} reservas`;
        const tbody = document.querySelector('#table-reservas tbody');
        tbody.innerHTML = reservas.length === 0
            ? '<tr><td colspan="8" class="empty-row">📅 No hay reservas registradas aún</td></tr>'
            : reservas.map(r => `
                <tr>
                    <td><strong>#${r.id}</strong></td>
                    <td>${r.fecha_reserva || '-'}</td>
                    <td><strong>${r.cliente}</strong></td>
                    <td>${r.telefono || '-'}</td>
                    <td>${r.tipo}</td>
                    <td style="max-width:150px;font-size:0.82rem;color:var(--text-light)">${r.detalles || '-'}</td>
                    <td><span class="badge badge-${r.estado === 'pendiente' ? 'pending' : 'confirmed'}">${r.estado}</span></td>
                    <td>
                        ${r.estado === 'pendiente' ? `<button class="btn-sm btn-success" onclick="confirmReserva(${r.id})">✅ Confirmar</button>` : ''}
                        <button class="btn-sm btn-delete" onclick="deleteReserva(${r.id})">🗑️</button>
                    </td>
                </tr>
            `).join('');
    }

    document.getElementById('btn-add-reserva').addEventListener('click', () => {
        openModal('📅 Nueva Reserva', `
            <div class="form-grid">
                <div class="fg"><label>Cliente</label><input name="cliente" required></div>
                <div class="fg"><label>Teléfono</label><input name="telefono"></div>
                <div class="fg"><label>Fecha</label><input name="fecha_reserva" type="date" required></div>
                <div class="fg"><label>Tipo</label>
                    <select name="tipo">
                        <option value="cumpleaños">🎂 Cumpleaños</option>
                        <option value="evento">🎉 Evento</option>
                        <option value="pedido_grande">📦 Pedido Grande</option>
                        <option value="catering">🍽️ Catering</option>
                        <option value="corporativo">🏢 Corporativo</option>
                    </select>
                </div>
                <div class="fg full"><label>Detalles</label><textarea name="detalles" placeholder="Detalles..."></textarea></div>
            </div>
        `, async (data) => {
            await fetch('/api/reservas', { method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify(data) });
            toast('Reserva creada');
            loadReservas();
        });
    });

    window.confirmReserva = async (id) => {
        await fetch(`/api/reservas/${id}`, { method: 'PUT', headers: {'Content-Type':'application/json'}, body: JSON.stringify({ estado: 'confirmada' }) });
        toast('Reserva confirmada');
        loadReservas();
    };

    window.deleteReserva = async (id) => {
        if (!confirm('¿Eliminar esta reserva?')) return;
        await fetch(`/api/reservas/${id}`, { method: 'DELETE' });
        toast('Reserva eliminada');
        loadReservas();
    };

    // === CONFIG ===
    async function loadConfig() {
        const c = await fetch('/api/config').then(r => r.json());
        const set = (id, key) => { const el = document.getElementById(id); if (el && c[key] !== undefined) el.value = c[key]; };
        set('cfg-whatsapp', 'whatsapp'); set('cfg-instagram', 'instagram');
        set('cfg-facebook', 'facebook'); set('cfg-tiktok', 'tiktok');
        set('cfg-nombre', 'nombre_negocio'); set('cfg-slogan', 'slogan');
        set('cfg-email', 'email'); set('cfg-telefono', 'telefono');
        set('cfg-direccion', 'direccion');
        set('cfg-horario-lv', 'horario_lv'); set('cfg-horario-sab', 'horario_sab');
        set('cfg-horario-dom', 'horario_dom');
        set('cfg-delivery', 'delivery_activo'); set('cfg-delivery-costo', 'delivery_costo');
        set('cfg-delivery-min', 'delivery_minimo'); set('cfg-delivery-zona', 'delivery_zona');
    }

    // Config form submissions
    ['config-social', 'config-negocio', 'config-horarios', 'config-delivery'].forEach(formId => {
        const form = document.getElementById(formId);
        if (form) form.addEventListener('submit', async (e) => {
            e.preventDefault();
            const data = Object.fromEntries(new FormData(form).entries());
            await fetch('/api/config', { method: 'PUT', headers: {'Content-Type':'application/json'}, body: JSON.stringify(data) });
            toast('✅ Configuración guardada');
        });
    });

    // === PASSWORD ===
    document.getElementById('form-password').addEventListener('submit', async (e) => {
        e.preventDefault();
        const fd = new FormData(e.target);
        const data = Object.fromEntries(fd.entries());
        if (data.newpass !== data.confirm) { toast('Las contraseñas no coinciden', 'error'); return; }
        const res = await fetch('/api/password', { method: 'PUT', headers: {'Content-Type':'application/json'}, body: JSON.stringify(data) });
        const result = await res.json();
        if (res.ok) { toast('Contraseña actualizada'); e.target.reset(); }
        else toast(result.error || 'Error', 'error');
    });

    // Initial load
    await loadDashboard();
});
