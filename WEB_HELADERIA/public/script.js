/* ==========================================
   EL TORERO HELADOS PREMIUM - JS Logic
   ========================================== */

document.addEventListener('DOMContentLoaded', () => {

    const navbar = document.getElementById('navbar');
    const hamburger = document.getElementById('hamburger');
    const navMenu = document.getElementById('nav-menu');
    const navLinks = document.querySelectorAll('.nav-link');
    const backToTop = document.getElementById('back-to-top');
    const contactForm = document.getElementById('contact-form');
    const loginModal = document.getElementById('login-modal');
    const loginForm = document.getElementById('login-form');
    const btnLogin = document.getElementById('btn-login');
    const modalClose = document.getElementById('modal-close');
    const loginError = document.getElementById('login-error');
    const loginText = document.getElementById('login-text');

    let isAdmin = false;

    // === Scroll Actions & Observers ===
    function initObservers() {
        // Observer for revealing sections and cards
        const observer = new IntersectionObserver((entries) => {
            entries.forEach(entry => { 
                if (entry.isIntersecting) {
                    entry.target.classList.add('visible');
                    // Optional: unobserve after showing
                    // observer.unobserve(entry.target);
                } 
            });
        }, { rootMargin: '0px 0px -50px 0px', threshold: 0.1 });

        // Observe base static elements
        document.querySelectorAll('.section-reveal').forEach(el => observer.observe(el));

        // Create a global function to be used by dynamic fetched cards
        window.observeDynamicElements = (elements) => {
            elements.forEach((el, index) => {
                el.classList.add('reveal');
                // Staggered animation delay based on index
                el.style.transitionDelay = `${index * 0.1}s`;
                observer.observe(el);
            });
        };
    }
    initObservers();

    // Scroll Navbar & Top Button
    window.addEventListener('scroll', () => {
        const scrollY = window.scrollY;
        if(navbar) navbar.classList.toggle('scrolled', scrollY > 50);
        if(backToTop) backToTop.classList.toggle('visible', scrollY > 500);
        
        // Setup Active Link
        let cur = '';
        document.querySelectorAll('section[id], header[id]').forEach(s => {
            const top = s.offsetTop - 150;
            if (scrollY >= top && scrollY < top + s.offsetHeight) cur = s.id;
        });
        navLinks.forEach(l => {
            l.classList.remove('active');
            if (l.getAttribute('data-section') === cur) l.classList.add('active');
        });
    }, { passive: true });

    if(backToTop) backToTop.addEventListener('click', () => window.scrollTo(0,0));

    // Nav mobile toggle
    if(hamburger) {
        hamburger.addEventListener('click', () => {
            hamburger.classList.toggle('active');
            navMenu.classList.toggle('active');
        });
    }

    // Smooth navigation links
    navLinks.forEach(l => l.addEventListener('click', (e) => {
        e.preventDefault();
        document.querySelector(l.getAttribute('href'))?.scrollIntoView({behavior: 'smooth'});
        if(hamburger) { hamburger.classList.remove('active'); navMenu.classList.remove('active'); }
    }));

    // === Init Data Load ===
    checkSession();
    loadHelados();
    loadPromociones();
    loadUbicaciones();
    loadConfig();
    connectSSE();

    // === Server-Sent Events ===
    function connectSSE() {
        const evtSource = new EventSource('/api/events');
        evtSource.addEventListener('update', (e) => {
            try {
                const data = JSON.parse(e.data);
                if (data.type === 'helados') loadHelados();
                if (data.type === 'promociones') loadPromociones();
                if (data.type === 'ubicaciones') loadUbicaciones();
                if (data.type === 'config') loadConfig();
            } catch (err) {}
        });
        evtSource.onerror = () => setTimeout(() => connectSSE(), 5000);
    }

    // === Carrito Handling (Hash Map O(1)) ===
    let cartMap = {}; 
    const cartToggle = document.getElementById('cart-toggle');
    const cartModal = document.getElementById('cart-modal');
    const cartClose = document.getElementById('cart-close');
    const cartItemsContainer = document.getElementById('cart-items');
    const cartCount = document.getElementById('cart-count');
    const cartTotalNode = document.getElementById('cart-total');
    const btnCheckout = document.getElementById('btn-checkout');

    if (cartToggle) cartToggle.addEventListener('click', (e) => { e.preventDefault(); cartModal.classList.add('show'); });
    if (cartClose) cartClose.addEventListener('click', () => cartModal.classList.remove('show'));

    window.addClientCart = function(id, nombre, precio) {
        if(cartMap[id]) cartMap[id].qty++;
        else cartMap[id] = { id, nombre, precio, qty: 1 };
        renderClientCart();
        cartModal.classList.add('show');
    };

    window.updateClientCart = function(id, delta) {
        if(!cartMap[id]) return;
        cartMap[id].qty += delta;
        if(cartMap[id].qty <= 0) delete cartMap[id];
        renderClientCart();
    };

    function renderClientCart() {
        let total = 0;
        let count = 0;
        cartItemsContainer.innerHTML = Object.values(cartMap).map(c => {
            total += c.precio * c.qty;
            count += c.qty;
            return `
                <div style="display:flex; justify-content:space-between; align-items:center; padding:10px 0; border-bottom:1px solid rgba(255,255,255,0.1);">
                    <div style="flex:1;">
                        <div style="color:#fff; font-weight:600;">${c.nombre}</div>
                        <div style="color:var(--primary-glow); font-size:0.9rem;">Bs. ${c.precio}</div>
                    </div>
                    <div style="display:flex; align-items:center; gap:10px;">
                        <button onclick="updateClientCart('${c.id}', -1)" style="background:transparent; border:1px solid var(--primary-glow); color:var(--primary-glow); width:28px; height:28px; border-radius:4px; cursor:pointer;">-</button>
                        <span style="color:#fff;">${c.qty}</span>
                        <button onclick="updateClientCart('${c.id}', 1)" style="background:var(--primary-glow); border:none; color:#000; width:28px; height:28px; border-radius:4px; cursor:pointer; font-weight:bold;">+</button>
                    </div>
                </div>
            `;
        }).join('');
        if(Object.keys(cartMap).length === 0) cartItemsContainer.innerHTML = '<p style="text-align:center; color:gray; margin-top:20px;">Tu carrito está vacío.</p>';
        cartTotalNode.textContent = `Bs. ${total.toFixed(2)}`;
        cartCount.textContent = count;
    }

    if(btnCheckout) {
        btnCheckout.addEventListener('click', async () => {
            const items = Object.values(cartMap);
            if(items.length === 0) return alert('El carrito está vacío');
            const total = items.reduce((a,c) => a + (c.precio*c.qty), 0);
            
            btnCheckout.textContent = 'Enviando...';
            try {
                // Enviar a la Cola FIFO en backend
                const res = await fetch('/api/pos/ordenes', {
                    method: 'POST',
                    headers: {'Content-Type':'application/json'},
                    body: JSON.stringify({ items, total, origen: 'cliente_web', notas: 'Pedido web cliente' })
                });
                const data = await res.json();
                if(data.ok) {
                    cartItemsContainer.innerHTML = '<div style="text-align:center; padding:30px;"><h3 style="color:var(--primary-glow);font-size:2rem;margin-bottom:10px;">¡Gracias!</h3><p style="color:#fff;">Tu pedido está en cocina.</p></div>';
                    cartMap = {};
                    cartCount.textContent = '0';
                    cartTotalNode.textContent = 'Bs. 0.00';
                    setTimeout(() => cartModal.classList.remove('show'), 3000);
                }
            } catch(e) {}
            btnCheckout.textContent = 'Procesar Pedido';
        });
    }

    // === Session Handling Centralizado ===
    async function checkSession() {
        try {
            const res = await fetch('/api/session');
            const data = await res.json();
            const btnCentral = document.getElementById('btn-central');
            const userNameDisplay = document.getElementById('user-name-display');

            if (data.loggedIn) { 
                if (userNameDisplay) {
                    userNameDisplay.textContent = `👋 Hola, ${data.user.nombre}`;
                    userNameDisplay.style.display = 'inline-block';
                }
                if (btnCentral) {
                    btnCentral.textContent = 'Cerrar Sesión';
                    btnCentral.style.background = 'rgba(239, 68, 68, 0.2)';
                    btnCentral.style.border = '1px solid rgba(239, 68, 68, 0.4)';
                    btnCentral.onclick = async () => {
                        btnCentral.textContent = 'Saliendo...';
                        await fetch('/api/logout', { method: 'POST' });
                        window.location.href = '/';
                    };
                }
            } else {
                if (btnCentral) {
                    btnCentral.textContent = 'Regresar al Login';
                    btnCentral.onclick = () => window.location.href = '/';
                }
            }
        } catch (e) {}
    }

    // === API DATA BINDING AND PREMIUM CARDS ===
    async function loadHelados() {
        try {
            const helados = await fetch('/api/helados/activos').then(r => r.json());
            const grid = document.getElementById('menu-grid');
            if (!grid) return;
            
            grid.innerHTML = helados.map(h => `
                <div class="glass-card">
                    <div class="card-badge">${h.categoria.toUpperCase()}</div>
                    <div class="card-img-wrap">
                        <img src="${h.imagen || 'https://images.unsplash.com/photo-1557142046-c704a3adf817?auto=format&fit=crop&q=80&w=500'}" alt="${h.nombre}" loading="lazy">
                    </div>
                    <h3 class="card-title">${h.nombre}</h3>
                    <p class="card-desc">${h.descripcion}</p>
                    <div class="card-footer">
                        <span class="card-price">Bs. ${h.precio}</span>
                        <button onclick="addClientCart('h_${h.id}', '${h.nombre}', ${h.precio})" style="background:var(--primary-glow); border:none; color:#000; padding:6px 12px; border-radius:20px; font-weight:bold; cursor:pointer;">+ Añadir</button>
                    </div>
                </div>
            `).join('');
            
            if(window.observeDynamicElements) window.observeDynamicElements(grid.querySelectorAll('.glass-card'));
        } catch (e) {}
    }

    async function loadPromociones() {
        try {
            const promos = await fetch('/api/promociones/activas').then(r => r.json());
            const grid = document.getElementById('promos-grid');
            if (!grid) return;
            grid.innerHTML = promos.map(p => {
                let priceHTML = p.precio_original && p.precio_promo ? 
                    `<span style="text-decoration: line-through; color: var(--text-muted); font-size: 1rem; margin-right: 10px;">Bs.${p.precio_original}</span> Bs.${p.precio_promo}` : 
                    (p.precio_promo ? `Bs.${p.precio_promo}` : (p.descuento || 'OFERTA'));

                return `
                    <div class="glass-card">
                        <div class="card-badge">${p.badge || 'VIP'}</div>
                        ${p.imagen ? `<div class="card-img-wrap"><img src="${p.imagen}" alt="${p.titulo}" loading="lazy"></div>` : ''}
                        <h3 class="card-title">${p.titulo}</h3>
                        <p class="card-desc">${p.descripcion}</p>
                        <p style="color:var(--primary-glow); font-size: 0.85rem; padding-bottom:10px;">⌚ ${p.dia} | ${p.hora}</p>
                        <div class="card-footer">
                            <span class="card-price">${priceHTML}</span>
                        </div>
                    </div>
                `;
            }).join('');
            if(window.observeDynamicElements) window.observeDynamicElements(grid.querySelectorAll('.glass-card'));
        } catch (e) {}
    }

    async function loadUbicaciones() {
        try {
            const ubis = await fetch('/api/ubicaciones').then(r => r.json());
            const grid = document.getElementById('locations-grid');
            if (!grid) return;
            grid.innerHTML = ubis.map(u => `
                <div class="glass-card">
                    <div class="card-badge">${u.badge || 'Boutique'}</div>
                    <div class="card-img-wrap" style="height:150px;">
                        <img src="${u.imagen || 'https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?auto=format&fit=crop&q=80&w=500'}" alt="${u.nombre}" loading="lazy">
                    </div>
                    <h3 class="card-title">${u.nombre}</h3>
                    <p class="card-desc" style="color: var(--text-main); margin-bottom:5px;">📍 ${u.direccion}</p>
                    <p class="card-desc" style="margin-bottom:5px;">📞 ${u.telefono}</p>
                    <p class="card-desc">🕒 ${u.horario}</p>
                    ${u.mapa_url ? `<div style="margin-top:10px; border-radius:12px; overflow:hidden;"><iframe src="${u.mapa_url}" width="100%" height="150" style="border:0;" loading="lazy"></iframe></div>` : ''}
                </div>
            `).join('');
            if(window.observeDynamicElements) window.observeDynamicElements(grid.querySelectorAll('.glass-card'));
        } catch (e) {}
    }

    async function loadConfig() {
        try {
            const config = await fetch('/api/config').then(r => r.json());
            const wa = document.getElementById('social-whatsapp');
            const ig = document.getElementById('social-instagram');
            const fb = document.getElementById('social-facebook');
            if (wa && config.whatsapp) { wa.href = `https://wa.me/591${config.whatsapp}`; }
            if (ig && config.instagram) { ig.href = `https://instagram.com/${config.instagram}`; }
            if (fb && config.facebook) { fb.href = `https://facebook.com/${config.facebook}`; }
        } catch (e) {}
    }

    // === Contact Form Premium Anim ===
    if (contactForm) {
        contactForm.addEventListener('submit', (e) => {
            e.preventDefault();
            const btn = document.getElementById('submit-btn');
            const orig = btn.textContent;
            btn.textContent = 'Enviando...';
            btn.style.opacity = '0.5';
            setTimeout(() => {
                btn.textContent = '✓ Mensaje Recibido';
                btn.style.opacity = '1';
                btn.style.background = '#27AE60';
                btn.style.color = '#fff';
                setTimeout(() => { 
                    btn.textContent = orig; 
                    btn.style.background = ''; 
                    contactForm.reset(); 
                }, 3000);
            }, 1500);
        });
    }
});
