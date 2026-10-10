/**
 * Retorna el usuario actual almacenado en sesión
 */
function getCurrentUser() {
  try {
    const userStr = localStorage.getItem('usuario_service_euros');
    return userStr ? JSON.parse(userStr) : null;
  } catch (e) {
    console.error("Error al leer la sesión:", e);
    return null;
  }
}

/**
 * Cierra la sesión del usuario y redirige al inicio
 */
function logoutUser() {
  localStorage.removeItem('usuario_service_euros');
  window.location.href = 'index.html';
}

/**
 * Muestra mensajes limpios en la interfaz en lugar de usar alert()
 */
function showAuthMessage(message, isError = false) {
  const msgBox = document.getElementById('auth-message');
  if (!msgBox) return;
  
  msgBox.textContent = message;
  msgBox.className = `mb-4 p-3 rounded-xl text-xs font-semibold text-center ${
    isError ? 'bg-[#a4202e]/30 border border-[#a4202e] text-[#fefae2]' : 'bg-[#e7b263]/20 border border-[#e7b263] text-[#e7b263]'
  }`;
  msgBox.classList.remove('hidden');
}

/**
 * Cambia entre las pestañas de Inicio de Sesión y Registro
 */
function switchTab(tab) {
  const loginForm = document.getElementById('form-login');
  const regForm = document.getElementById('form-register');
  const tabLogin = document.getElementById('tab-login');
  const tabReg = document.getElementById('tab-register');
  const msgBox = document.getElementById('auth-message');

  if (msgBox) msgBox.classList.add('hidden');

  if (tab === 'login') {
    if (loginForm) loginForm.classList.remove('hidden');
    if (regForm) regForm.classList.add('hidden');
    if (tabLogin) tabLogin.className = "flex-1 text-center font-bold pb-2 text-[#e7b263] border-b-2 border-[#e7b263] transition";
    if (tabReg) tabReg.className = "flex-1 text-center font-bold pb-2 text-[#fefae2]/60 hover:text-[#fefae2] transition";
  } else {
    if (loginForm) loginForm.classList.add('hidden');
    if (regForm) regForm.classList.remove('hidden');
    if (tabReg) tabReg.className = "flex-1 text-center font-bold pb-2 text-[#e7b263] border-b-2 border-[#e7b263] transition";
    if (tabLogin) tabLogin.className = "flex-1 text-center font-bold pb-2 text-[#fefae2]/60 hover:text-[#fefae2] transition";
  }
}

/**
 * Maneja el inicio de sesión contra la tabla usuarios_service_euros
 */
async function handleLogin(e) {
  e.preventDefault();
  const emailInput = document.getElementById('login-email');
  const passwordInput = document.getElementById('login-password');
  
  if (!emailInput || !passwordInput) return;

  const correo = emailInput.value.trim();
  const password = passwordInput.value;

  try {
    const { data, error } = await window.supabaseClient
      .from('usuarios_service_euros')
      .select('*')
      .eq('correo', correo)
      .single();

    if (error || !data) {
      showAuthMessage('Correo electrónico o contraseña incorrectos.', true);
      return;
    }

    if (data.password_hash !== password) {
      showAuthMessage('Contraseña incorrecta.', true);
      return;
    }

    // Guardar sesión en localStorage
    localStorage.setItem('usuario_service_euros', JSON.stringify(data));
    showAuthMessage('¡Inicio de sesión exitoso! Redirigiendo...');

    const urlParams = new URLSearchParams(window.location.search);
    const redirectUrl = urlParams.get('redirect') || (data.rol === 'admin' ? 'admin.html' : 'index.html');

    setTimeout(() => {
      window.location.href = redirectUrl;
    }, 1000);

  } catch (err) {
    console.error(err);
    showAuthMessage('Ocurrió un error al intentar iniciar sesión.', true);
  }
}

/**
 * Maneja el registro de nuevos usuarios
 */
async function handleRegister(e) {
  e.preventDefault();
  const nombreInput = document.getElementById('reg-nombre');
  const telInput = document.getElementById('reg-telefono');
  const emailInput = document.getElementById('reg-email');
  const passInput = document.getElementById('reg-password');

  if (!nombreInput || !telInput || !emailInput || !passInput) return;

  const nombre_completo = nombreInput.value.trim();
  const telefono = telInput.value.trim();
  const correo = emailInput.value.trim();
  const password_hash = passInput.value;

  try {
    const { data, error } = await window.supabaseClient
      .from('usuarios_service_euros')
      .insert([
        {
          nombre_completo,
          telefono,
          correo,
          password_hash,
          rol: 'cliente'
        }
      ])
      .select()
      .single();

    if (error) {
      showAuthMessage('Error al registrar: ' + error.message, true);
      return;
    }

    showAuthMessage('¡Cuenta creada con éxito! Ya puedes iniciar sesión.');
    setTimeout(() => {
      switchTab('login');
      const loginEmailInput = document.getElementById('login-email');
      if (loginEmailInput) loginEmailInput.value = correo;
    }, 1500);

  } catch (err) {
    console.error(err);
    showAuthMessage('Error de conexión con la base de datos.', true);
  }
}

/**
 * Actualiza la barra de navegación según el estado de sesión en cualquier página
 */
function updateNavbarAuth() {
  const user = getCurrentUser();
  const authContainer = document.getElementById('auth-nav-container');
  
  if (!authContainer) return;

  if (user) {
    const safeName = user.nombre_completo ? user.nombre_completo.split(' ')[0] : 'Usuario';
    authContainer.innerHTML = `
      <div class="flex items-center space-x-3">
        <a href="mis-solicitudes.html" class="text-xs text-[#e7b263] hover:underline font-semibold flex items-center space-x-1" title="Mis Solicitudes">
          <i data-lucide="file-text" class="w-4 h-4"></i>
          <span class="hidden lg:inline">Mis Solicitudes</span>
        </a>
        <span class="text-xs text-[#e7b263] font-semibold hidden sm:inline">
          Hola, <strong class="text-[#fefae2]">${safeName}</strong>
        </span>
        ${user.rol === 'admin' ? '<a href="admin.html" class="text-xs bg-[#a4202e] hover:bg-[#861924] px-2.5 py-1.5 rounded-lg font-bold transition">Admin</a>' : ''}
        <button onclick="logoutUser()" class="text-xs text-[#fefae2]/70 hover:text-[#a4202e] font-semibold flex items-center space-x-1 transition cursor-pointer" title="Cerrar Sesión">
          <i data-lucide="log-out" class="w-4 h-4"></i>
          <span class="hidden md:inline">Salir</span>
        </button>
      </div>
    `;
  } else {
    const currentPage = window.location.pathname.split('/').pop() || 'index.html';
    const loginTarget = currentPage !== 'index.html' && currentPage !== '' 
      ? `login.html?redirect=${currentPage}` 
      : 'login.html';

    authContainer.innerHTML = `
      <a href="${loginTarget}" class="inline-flex items-center space-x-1 border border-[#fefae2]/40 px-3 py-2 rounded-lg text-xs font-medium hover:bg-[#fefae2] hover:text-[#2d080a] transition">
        <i data-lucide="user" class="w-3.5 h-3.5"></i>
        <span>Acceso / Mi Cuenta</span>
      </a>
    `;
  }

  if (typeof lucide !== 'undefined') {
    lucide.createIcons();
  }
}

// Ejecutar automáticamente al cargar cualquier página que incluya este script
document.addEventListener('DOMContentLoaded', () => {
  updateNavbarAuth();
});