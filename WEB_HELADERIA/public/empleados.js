/* ==========================================
   EL TORERO POS - EMPLEADOS JS
   ========================================== */

document.addEventListener('DOMContentLoaded', async () => {

    const userGreeting = document.getElementById('user-greeting');
    const posGrid = document.getElementById('pos-grid');
    const searchInput = document.getElementById('pos-search');
    const cartList = document.getElementById('pos-cart-list');
    const posTotal = document.getElementById('pos-total');
    const btnCobrar = document.getElementById('btn-cobrar');
    const queueCocina = document.getElementById('queue-cocina');
    const heapReservas = document.getElementById('heap-reservas');

    // Estado local estructurado
    let carrito = {}; // Hash Map para O(1) lookups: { idItem: { item, qty } }
    let heladosData = [];

    // Validar Sesión y Rol Restringido
    try {
        const res = await fetch('/api/session');
        const data = await res.json();
        if (!data.loggedIn) return window.location.href = '/';
        if (data.user.rol === 'cliente') return window.location.href = '/tienda.html';
        userGreeting.textContent = `Hola, ${data.user.nombre}`;
    } catch (e) { window.location.href = '/'; }

    document.getElementById('btn-logout').addEventListener('click', async () => {
        await fetch('/api/logout', { method: 'POST' });
        window.location.href = '/';
    });

    // Cargar Catálogo Completo
    async function loadCatalog() {
        try {
            const helados = await fetch('/api/helados/activos').then(r => r.json());
            const promos = await fetch('/api/promociones/activas').then(r => r.json());
            
            // Unificamos para la venta (Adaptador simple)
            const catHelados = helados.map(h => ({ id: `h_${h.id}`, tipo: 'helado', nombre: h.nombre, precio: h.precio, imagen: h.imagen }));
            const catPromos = promos.map(p => ({ id: `p_${p.id}`, tipo: 'promo', nombre: p.titulo, precio: p.precio_promo || p.precio_original, imagen: p.imagen }));
            
            heladosData = [...catHelados, ...catPromos];
            renderGrid(heladosData);
        } catch (e) {}
    }

    // Búsqueda Ultra Predictiva consultando al Trie del Backend
    searchInput.addEventListener('input', async (e) => {
        const query = e.target.value.trim();
        if (query.length === 0) {
            renderGrid(heladosData);
            return;
        }
        
        try {
            // Llamamos al API impulsada por Estructuras de Datos
            const res = await fetch(`/api/pos/buscar?q=${encodeURIComponent(query)}`);
            const data = await res.json();
            if(data.ok) renderGrid(data.resultados);
        } catch (e) {}
    });

    // Render Grid
    function renderGrid(items) {
        posGrid.innerHTML = items.map(item => `
            <div class="item-card" data-id="${item.id}">
                <img src="${item.imagen || 'https://via.placeholder.com/150'}" class="item-img" alt="${item.nombre}">
                <div class="item-info">
                    <h3 class="item-title">${item.nombre}</h3>
                    <div class="item-price">Bs. ${item.precio}</div>
                </div>
            </div>
        `).join('');

        // Listeners for adding to Cart
        posGrid.querySelectorAll('.item-card').forEach(card => {
            card.addEventListener('click', () => {
                const id = card.getAttribute('data-id');
                const item = items.find(i => i.id === id);
                addToCart(item);
            });
        });
    }

    // Operaciones en Carrito (Hash Map)
    function addToCart(item) {
        if(carrito[item.id]) {
            carrito[item.id].qty += 1;
        } else {
            carrito[item.id] = { ...item, qty: 1 };
        }
        renderCart();
    }

    window.updateQty = function(id, delta) {
        if(!carrito[id]) return;
        carrito[id].qty += delta;
        if(carrito[id].qty <= 0) delete carrito[id];
        renderCart();
    };

    function renderCart() {
        let total = 0;
        cartList.innerHTML = Object.values(carrito).map(c => {
            total += c.precio * c.qty;
            return `
                <li class="cart-item">
                    <div class="cart-item-name">${c.nombre} <br><small>Bs.${c.precio}</small></div>
                    <div class="cart-item-actions">
                        <button class="btn-qty" onclick="updateQty('${c.id}', -1)">-</button>
                        <span>${c.qty}</span>
                        <button class="btn-qty" onclick="updateQty('${c.id}', 1)">+</button>
                    </div>
                </li>
            `;
        }).join('');
        
        document.getElementById('pos-subtotal').textContent = `Bs. ${total.toFixed(2)}`;
        posTotal.textContent = `Bs. ${total.toFixed(2)}`;
    }

    // Cobrar: Enviar pedido a la Cola FIFO Backend
    btnCobrar.addEventListener('click', async () => {
        const items = Object.values(carrito);
        if(items.length === 0) return alert('El pedido está vacío');

        const total = items.reduce((acc, c) => acc + (c.precio * c.qty), 0);
        
        try {
            const res = await fetch('/api/pos/ordenes', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ items, total, origen: 'caja_empleado' })
            });
            const data = await res.json();
            if(data.ok) {
                alert('¡Orden Generada y Encolada en Cocina!');
                carrito = {};
                renderCart();
            }
        } catch (e) { alert('Error de red'); }
    });

    // Conectar Monitors En Vivo
    function connectSSE() {
        const evtSource = new EventSource('/api/events');
        evtSource.addEventListener('monitores', (e) => {
            try {
                const data = JSON.parse(e.data);
                
                // Actualizar Monitor FIFO de Órdenes
                if (data.cocinaQueue) {
                    queueCocina.innerHTML = data.cocinaQueue.map((o, index) => `
                        <li class="q-item ${index === 0 ? 'q-urgent' : 'q-normal'}">
                            <strong>#${o.id || o.ticket} - ${o.origen === 'cliente_web' ? '🌐 WEB' : '🏪 CAJA'}</strong>
                            ${o.items_str}
                            <div style="margin-top:5px; text-align:right;">
                                <button class="btn-outline" style="color:var(--primary); background:var(--border); padding:2px 6px; font-size:0.75rem;" onclick="completarOrden(${o.id})">Entregar</button>
                            </div>
                        </li>
                    `).join('');
                }

                // Actualizar Monitor Min-Heap de Reservas
                if (data.reservasHeap) {
                    heapReservas.innerHTML = data.reservasHeap.map((r, index) => {
                        const dateObj = new Date(r.fecha_reserva);
                        const isClose = (dateObj.getTime() - Date.now()) < (1000 * 60 * 60 * 24); // Menos de 24h
                        return `
                            <li class="q-item ${isClose ? 'q-urgent' : 'q-normal'}">
                                <strong>👤 ${r.cliente} - ${r.telefono}</strong>
                                Tipo: ${r.tipo}<br>
                                Fecha/Hora: ${new Date(r.fecha_reserva).toLocaleString()}<br>
                            </li>
                        `;
                    }).join('');
                }
            } catch (err) {}
        });
        evtSource.onerror = () => setTimeout(() => connectSSE(), 5000);
    }

    // Exponer API global para completar orden desde la vista HTML generada
    window.completarOrden = async (id) => {
        try {
            // Este endpoint debe extraer (Dequeue) la primera orden
            await fetch(`/api/pos/ordenes/${id}/entregar`, { method: 'POST' });
        } catch (e) {}
    };

    loadCatalog();
    connectSSE();
});
