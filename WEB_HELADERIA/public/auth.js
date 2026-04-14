/* ==========================================
   EL TORERO HELADOS - AUTH ROUTER JS
   ========================================== */

document.addEventListener('DOMContentLoaded', async () => {

    const tabs = document.querySelectorAll('.auth-tab');
    const forms = document.querySelectorAll('.auth-form');
    const formLogin = document.getElementById('form-login');
    const formRegister = document.getElementById('form-register');
    const errorBox = document.getElementById('auth-error');

    // Validación si ya está logueado, redirigir directo
    try {
        const res = await fetch('/api/session');
        const data = await res.json();
        if (data.loggedIn) {
            enrutarSegunRol(data.user.rol);
        }
    } catch (e) {}

    // Lógica visual de Tabs
    tabs.forEach(tab => {
        tab.addEventListener('click', () => {
            tabs.forEach(t => t.classList.remove('active'));
            forms.forEach(f => f.classList.remove('active'));
            
            tab.classList.add('active');
            document.getElementById(tab.dataset.target).classList.add('active');
            errorBox.style.display = 'none';
        });
    });

    function showError(msg) {
        errorBox.textContent = msg;
        errorBox.style.display = 'block';
    }

    // Lógica Central de Enrutamiento Inteligente
    function enrutarSegunRol(rol) {
        if (rol === 'admin') {
            window.location.href = '/admin.html';
        } else if (rol === 'empleado') {
            window.location.href = '/empleados.html';
        } else if (rol === 'cliente') {
            // El cliente es redirigido al frontend principal (catálogo)
            window.location.href = '/tienda.html';
        } else {
            // Failsafe
            window.location.href = '/tienda.html';
        }
    }

    // Enviar Login
    formLogin.addEventListener('submit', async (e) => {
        e.preventDefault();
        const data = Object.fromEntries(new FormData(formLogin).entries());
        
        try {
            const btn = formLogin.querySelector('button');
            const originalText = btn.textContent;
            btn.textContent = 'Autenticando...';

            const res = await fetch('/api/login', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(data)
            });
            const result = await res.json();

            if (result.ok) {
                enrutarSegunRol(result.rol);
            } else {
                showError(result.error || 'Credenciales inválidas');
                btn.textContent = originalText;
            }
        } catch (err) {
            showError('Error de red al conectar con el servidor.');
        }
    });

    // Enviar Registro
    formRegister.addEventListener('submit', async (e) => {
        e.preventDefault();
        const data = Object.fromEntries(new FormData(formRegister).entries());
        
        try {
            const btn = formRegister.querySelector('button');
            const originalText = btn.textContent;
            btn.textContent = 'Creando cuenta...';

            const res = await fetch('/api/register', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(data)
            });
            const result = await res.json();

            if (result.ok) {
                // Registro exitoso, iniciar sesión automáticamente
                enrutarSegunRol(result.rol);
            } else {
                showError(result.error || 'Error al registrar usuario');
                btn.textContent = originalText;
            }
        } catch (err) {
            showError('Error de red al conectar con el servidor.');
        }
    });

});
