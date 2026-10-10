async function inicializarUsuarios() {
    try {
        const { data: usuarios, error } = await window.supabaseClient
            .from('usuarios_service_euros')
            .select('*')
            .order('created_at', { ascending: false });

        const tbody = document.getElementById('tabla-usuarios-contenido');
        if (!tbody) return;
        tbody.innerHTML = '';

        if (error || !usuarios || usuarios.length === 0) {
            tbody.innerHTML = `<tr><td colspan="5" class="p-6 text-center text-[#eaecee]/60">No hay usuarios registrados en Virtual Studio.</td></tr>`;
            return;
        }

        usuarios.forEach(user => {
            const rolBadge = user.rol === 'admin' 
                ? `<span class="px-3 py-1 bg-rose-500/20 text-rose-300 border border-rose-500/40 rounded-xl text-xs font-extrabold uppercase">Admin</span>`
                : `<span class="px-3 py-1 bg-[#00e4fb]/20 text-[#00e4fb] border border-[#00e4fb]/40 rounded-xl text-xs font-extrabold uppercase">Cliente</span>`;

            const tr = document.createElement('tr');
            tr.className = "hover:bg-[#1b253d]/50 transition border-b border-[#00e4fb]/10 text-xs text-[#eaecee]/90";
            tr.innerHTML = `
                <td class="p-3.5 font-extrabold text-sm text-[#eaecee]">${user.nombre_completo}</td>
                <td class="p-3.5 text-[#00e4fb] font-mono">${user.correo}</td>
                <td class="p-3.5 text-[#eaecee]/75">${user.telefono || 'N/A'}</td>
                <td class="p-3.5 text-center">${rolBadge}</td>
                <td class="p-3.5 text-center">
                    <div class="flex items-center justify-center gap-1.5">
                        <button onclick='abrirModalEditarUsuario(${JSON.stringify(user)})' class="px-3 py-1.5 bg-amber-500/20 hover:bg-amber-500 text-amber-300 hover:text-[#12192a] border border-amber-500/40 rounded-xl font-bold transition cursor-pointer">Editar</button>
                        <button onclick="eliminarUsuario('${user.id}')" class="px-3 py-1.5 bg-rose-500/20 hover:bg-rose-500 text-rose-300 hover:text-white border border-rose-500/40 rounded-xl font-bold transition cursor-pointer">Eliminar</button>
                    </div>
                </td>
            `;
            tbody.appendChild(tr);
        });
    } catch (err) {
        console.error("Error al cargar usuarios:", err);
    }
}

function abrirModalUsuario() {
    document.getElementById('modal-usuario-titulo').innerText = "Nuevo Usuario";
    document.getElementById('form-usuario').reset();
    document.getElementById('user-id').value = '';
    
    // Al crear es obligatoria la contraseña
    const passInput = document.getElementById('user-password');
    passInput.required = true;
    document.getElementById('lbl-password').innerText = "Contraseña *";

    document.getElementById('modal-usuario').classList.remove('hidden');
}

function abrirModalEditarUsuario(user) {
    document.getElementById('modal-usuario-titulo').innerText = `Editar Usuario: ${user.nombre_completo}`;
    document.getElementById('user-id').value = user.id;
    document.getElementById('user-nombre').value = user.nombre_completo;
    document.getElementById('user-correo').value = user.correo;
    document.getElementById('user-telefono').value = user.telefono || '';
    document.getElementById('user-rol').value = user.rol || 'cliente';

    // Al editar la contraseña es opcional (solo si se quiere cambiar)
    const passInput = document.getElementById('user-password');
    passInput.value = '';
    passInput.required = false;
    document.getElementById('lbl-password').innerText = "Contraseña (dejar en blanco para conservar)";

    document.getElementById('modal-usuario').classList.remove('hidden');
}

function cerrarModalUsuario() {
    document.getElementById('modal-usuario').classList.add('hidden');
}

async function guardarUsuario(event) {
    event.preventDefault();

    const id = document.getElementById('user-id').value;
    const nombre_completo = document.getElementById('user-nombre').value;
    const correo = document.getElementById('user-correo').value;
    const telefono = document.getElementById('user-telefono').value;
    const rol = document.getElementById('user-rol').value;
    const password = document.getElementById('user-password').value;

    if (id) {
        // ACTUALIZAR USUARIO
        const payload = { nombre_completo, correo, telefono, rol };
        
        // Si ingresó una nueva contraseña la actualizamos
        if (password.trim() !== "") {
            payload.password_hash = password;
        }

        const { error } = await window.supabaseClient
            .from('usuarios_service_euros')
            .update(payload)
            .eq('id', id);

        if (error) {
            alert("Error al actualizar usuario: " + error.message);
            return;
        }
    } else {
        // CREAR NUEVO USUARIO
        const { error } = await window.supabaseClient
            .from('usuarios_service_euros')
            .insert([{
                nombre_completo,
                correo,
                telefono,
                rol,
                password_hash: password
            }]);

        if (error) {
            alert("Error al crear usuario: " + error.message);
            return;
        }
    }

    cerrarModalUsuario();
    inicializarUsuarios();
}

async function eliminarUsuario(id) {
    if (!confirm("¿Estás seguro de eliminar este usuario? Esta acción no se puede deshacer.")) return;

    const { error } = await window.supabaseClient
        .from('usuarios_service_euros')
        .delete()
        .eq('id', id);

    if (error) {
        alert("Error al eliminar usuario: " + error.message);
        return;
    }

    inicializarUsuarios();
}

// Cargar al iniciar
document.addEventListener("DOMContentLoaded", () => {
    inicializarUsuarios();
});