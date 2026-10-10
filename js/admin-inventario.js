let vistaActual = 'productos';
let listaProductosGlobal = []; // Para llenar selects del desglose de paquetes

// Alternar entre pestañas de Productos y Paquetes
function cambiarVistaAdmin(vista) {
    vistaActual = vista;
    const btnProd = document.getElementById('btn-tab-productos');
    const btnPaq = document.getElementById('btn-tab-paquetes');
    const secProd = document.getElementById('seccion-productos');
    const secPaq = document.getElementById('seccion-paquetes');

    if (vista === 'productos') {
        btnProd.className = "flex-1 sm:flex-none px-4 py-2.5 text-xs font-extrabold rounded-xl bg-[#00e4fb] text-[#12192a] shadow-lg transition cursor-pointer";
        btnPaq.className = "flex-1 sm:flex-none px-4 py-2.5 text-xs font-bold rounded-xl bg-[#1b253d] text-[#eaecee]/80 border border-[#00e4fb]/30 hover:text-[#00e4fb] transition cursor-pointer";
        secProd.classList.remove('hidden');
        secPaq.classList.add('hidden');
        inicializarInventario();
    } else {
        btnPaq.className = "flex-1 sm:flex-none px-4 py-2.5 text-xs font-extrabold rounded-xl bg-[#00e4fb] text-[#12192a] shadow-lg transition cursor-pointer";
        btnProd.className = "flex-1 sm:flex-none px-4 py-2.5 text-xs font-bold rounded-xl bg-[#1b253d] text-[#eaecee]/80 border border-[#00e4fb]/30 hover:text-[#00e4fb] transition cursor-pointer";
        secPaq.classList.remove('hidden');
        secProd.classList.add('hidden');
        inicializarPaquetes();
    }
}

// -------------------------------------------------------------
// 1. MÓDULO DE PRODUCTOS / EQUIPOS
// -------------------------------------------------------------
async function inicializarInventario() {
    try {
        const { data: productos, error } = await window.supabaseClient
            .from('productos_service_euros')
            .select(`*, especificaciones_tecnicas_service_euros(*)`)
            .order('id', { ascending: true });

        if (error) {
            console.error("Error al cargar inventario:", error.message);
            return;
        }

        listaProductosGlobal = productos || [];
        const tbody = document.getElementById('tabla-inventario-contenido');
        if (!tbody) return;
        tbody.innerHTML = '';

        if (!productos || productos.length === 0) {
            tbody.innerHTML = `<tr><td colspan="6" class="p-6 text-center text-[#eaecee]/60">No hay equipos registrados en el inventario.</td></tr>`;
            return;
        }

        productos.forEach(prod => {
            const tr = document.createElement('tr');
            tr.className = "hover:bg-[#1b253d]/50 transition border-b border-[#00e4fb]/10 text-xs";
            tr.innerHTML = `
                <td class="p-3.5 text-center font-bold text-[#00e4fb]">#${prod.id}</td>
                <td class="p-3.5 font-extrabold text-sm text-[#eaecee]">${prod.nombre}</td>
                <td class="p-3.5 text-[#eaecee]/75">${prod.especificaciones || 'Sin especificación'}</td>
                <td class="p-3.5 text-right font-black text-[#00e4fb] text-sm">Bs. ${Number(prod.precio_por_jornada || 0).toFixed(2)}</td>
                <td class="p-3.5 text-center"><span class="px-3 py-1 bg-[#1b253d] border border-[#00e4fb]/30 rounded-xl font-bold text-[#eaecee]">${prod.stock_disponible} un.</span></td>
                <td class="p-3.5 text-center">
                    <div class="flex items-center justify-center gap-1.5">
                        <button onclick='abrirModalEditarProducto(${JSON.stringify(prod)})' class="px-3 py-1.5 bg-amber-500/20 hover:bg-amber-500 text-amber-300 hover:text-[#12192a] border border-amber-500/40 rounded-xl font-bold transition cursor-pointer">Editar</button>
                        <button onclick="eliminarProducto(${prod.id})" class="px-3 py-1.5 bg-rose-500/20 hover:bg-rose-500 text-rose-300 hover:text-white border border-rose-500/40 rounded-xl font-bold transition cursor-pointer">Eliminar</button>
                    </div>
                </td>
            `;
            tbody.appendChild(tr);
        });
    } catch (err) {
        console.error("Error inesperado en inventario:", err);
    }
}

function abrirModalCrearProducto() {
    document.getElementById('modal-producto-tituloinnerText').innerText = "Nuevo Equipo / Producto";
    document.getElementById('form-producto').reset();
    document.getElementById('prod-id').value = '';
    document.getElementById('modal-producto').classList.remove('hidden');
}

function abrirModalEditarProducto(prod) {
    document.getElementById('modal-producto-titulo').innerText = `Editar Equipo #${prod.id}`;
    document.getElementById('prod-id').value = prod.id;
    document.getElementById('prod-nombre').value = prod.nombre;
    document.getElementById('prod-precio').value = prod.precio_por_jornada;
    document.getElementById('prod-stock').value = prod.stock_disponible;
    document.getElementById('prod-especificaciones').value = prod.especificaciones || '';

    const tech = prod.especificaciones_tecnicas_service_euros?.[0] || {};
    document.getElementById('tech-componentes').value = tech.componentes_principales || '';
    document.getElementById('tech-consumo').value = tech.consumo_energetico_o_combustible || '';
    document.getElementById('tech-potencia').value = tech.potencia_o_rendimiento || '';
    document.getElementById('tech-obs').value = tech.observaciones_extra || '';

    document.getElementById('modal-producto').classList.remove('hidden');
}

async function guardarProducto(event) {
    event.preventDefault();
    const id = document.getElementById('prod-id').value;
    const nombre = document.getElementById('prod-nombre').value;
    const precio = parseFloat(document.getElementById('prod-precio').value);
    const stock = parseInt(document.getElementById('prod-stock').value);
    const especificaciones = document.getElementById('prod-especificaciones').value;

    const techData = {
        componentes_principales: document.getElementById('tech-componentes').value,
        consumo_energetico_o_combustible: document.getElementById('tech-consumo').value,
        potencia_o_rendimiento: document.getElementById('tech-potencia').value,
        observaciones_extra: document.getElementById('tech-obs').value
    };

    if (id) {
        // ACTUALIZAR
        const { error: errProd } = await window.supabaseClient
            .from('productos_service_euros')
            .update({ nombre, precio_por_jornada: precio, stock_disponible: stock, especificaciones })
            .eq('id', id);

        if (errProd) return alert("Error al actualizar: " + errProd.message);

        const { data: existingTech } = await window.supabaseClient
            .from('especificaciones_tecnicas_service_euros')
            .select('id')
            .eq('producto_id', id);

        if (existingTech && existingTech.length > 0) {
            await window.supabaseClient
                .from('especificaciones_tecnicas_service_euros')
                .update(techData)
                .eq('producto_id', id);
        } else {
            techData.producto_id = id;
            await window.supabaseClient
                .from('especificaciones_tecnicas_service_euros')
                .insert([techData]);
        }
    } else {
        // CREAR
        const { data: newProd, error: errProd } = await window.supabaseClient
            .from('productos_service_euros')
            .insert([{ nombre, precio_por_jornada: precio, stock_disponible: stock, especificaciones }])
            .select();

        if (errProd) return alert("Error al crear: " + errProd.message);

        if (newProd && newProd.length > 0) {
            techData.producto_id = newProd[0].id;
            await window.supabaseClient
                .from('especificaciones_tecnicas_service_euros')
                .insert([techData]);
        }
    }

    cerrarModales();
    inicializarInventario();
}

async function eliminarProducto(id) {
    if (!confirm(`¿Eliminar equipo #${id}? Se eliminarán también sus especificaciones técnicas.`)) return;

    const { error } = await window.supabaseClient
        .from('productos_service_euros')
        .delete()
        .eq('id', id);

    if (error) return alert("Error al eliminar: " + error.message);
    inicializarInventario();
}

// -------------------------------------------------------------
// 2. MÓDULO DE PAQUETES PRECONFIGURADOS
// -------------------------------------------------------------
async function inicializarPaquetes() {
    try {
        const { data: paquetes, error } = await window.supabaseClient
            .from('paquetes_service_euros')
            .select(`*, paquete_detalles_service_euros(*, productos_service_euros(nombre))`)
            .order('id', { ascending: true });

        if (error) {
            console.error("Error al cargar paquetes:", error.message);
            return;
        }

        const tbody = document.getElementById('tabla-paquetes-contenido');
        if (!tbody) return;
        tbody.innerHTML = '';

        if (!paquetes || paquetes.length === 0) {
            tbody.innerHTML = `<tr><td colspan="5" class="p-6 text-center text-[#eaecee]/60">No hay paquetes registrados en Virtual Studio.</td></tr>`;
            return;
        }

        paquetes.forEach(paq => {
            const tr = document.createElement('tr');
            tr.className = "hover:bg-[#1b253d]/50 transition border-b border-[#00e4fb]/10 text-xs";
            tr.innerHTML = `
                <td class="p-3.5 text-center font-bold text-[#00e4fb]">#${paq.id}</td>
                <td class="p-3.5 font-extrabold text-sm text-[#eaecee]">${paq.nombre}</td>
                <td class="p-3.5 text-[#eaecee]/75">${paq.tipo_evento} <span class="text-[#00e4fb] font-bold">(${paq.nivel_equipamiento})</span></td>
                <td class="p-3.5 text-right font-black text-[#00e4fb] text-sm">Bs. ${Number(paq.precio_base || 0).toFixed(2)}</td>
                <td class="p-3.5 text-center">
                    <div class="flex items-center justify-center gap-1.5">
                        <button onclick='abrirModalEditarPaquete(${JSON.stringify(paq)})' class="px-3 py-1.5 bg-amber-500/20 hover:bg-amber-500 text-amber-300 hover:text-[#12192a] border border-amber-500/40 rounded-xl font-bold transition cursor-pointer">Editar</button>
                        <button onclick="eliminarPaquete(${paq.id})" class="px-3 py-1.5 bg-rose-500/20 hover:bg-rose-500 text-rose-300 hover:text-white border border-rose-500/40 rounded-xl font-bold transition cursor-pointer">Eliminar</button>
                    </div>
                </td>
            `;
            tbody.appendChild(tr);
        });
    } catch (err) {
        console.error("Error inesperado en paquetes:", err);
    }
}

async function abrirModalCrearPaquete() {
    document.getElementById('modal-paquete-titulo').innerText = "Nuevo Paquete Preconfigurado";
    document.getElementById('form-paquete').reset();
    document.getElementById('paq-id').value = '';
    document.getElementById('contenedor-desglose-paquete').innerHTML = '';

    // Asegurar productos actualizados para el selector
    if (listaProductosGlobal.length === 0) await inicializarInventario();

    agregarFilaDetallePaquete(); // Añadir fila por defecto
    document.getElementById('modal-paquete').classList.remove('hidden');
}

async function abrirModalEditarPaquete(paq) {
    document.getElementById('modal-paquete-titulo').innerText = `Editar Paquete #${paq.id}`;
    document.getElementById('paq-id').value = paq.id;
    document.getElementById('paq-nombre').value = paq.nombre;
    document.getElementById('paq-tipo-evento').value = paq.tipo_evento;
    document.getElementById('paq-nivel').value = paq.nivel_equipamiento;
    document.getElementById('paq-precio').value = paq.precio_base;
    document.getElementById('paq-descripcion').value = paq.descripcion || '';

    if (listaProductosGlobal.length === 0) await inicializarInventario();

    const contenedor = document.getElementById('contenedor-desglose-paquete');
    contenedor.innerHTML = '';

    const detalles = paq.paquete_detalles_service_euros || [];
    if (detalles.length > 0) {
        detalles.forEach(det => agregarFilaDetallePaquete(det.producto_id, det.cantidad));
    } else {
        agregarFilaDetallePaquete();
    }

    document.getElementById('modal-paquete').classList.remove('hidden');
}

function agregarFilaDetallePaquete(productoIdSeleccionado = '', cantidad = 1) {
    const contenedor = document.getElementById('contenedor-desglose-paquete');
    const div = document.createElement('div');
    div.className = "flex items-center gap-2 fila-desglose-paquete";

    let opciones = `<option value="">-- Seleccionar Equipo --</option>`;
    listaProductosGlobal.forEach(p => {
        const selected = p.id === productoIdSeleccionado ? 'selected' : '';
        opciones += `<option value="${p.id}" ${selected}>${p.nombre} (Bs. ${p.precio_por_jornada})</option>`;
    });

    div.innerHTML = `
        <select class="select-prod-id flex-1 p-2.5 rounded-xl bg-[#1b253d] border border-[#00e4fb]/40 text-[#eaecee] text-xs focus:outline-none focus:border-[#00e4fb] transition">
            ${opciones}
        </select>
        <input type="number" min="1" value="${cantidad}" class="input-prod-cant w-20 p-2.5 rounded-xl bg-[#1b253d] border border-[#00e4fb]/40 text-[#eaecee] text-xs focus:outline-none focus:border-[#00e4fb] transition text-center" placeholder="Cant.">
        <button type="button" onclick="this.parentElement.remove()" class="px-3 py-2 bg-rose-500/20 hover:bg-rose-500 text-rose-300 hover:text-white border border-rose-500/40 font-extrabold rounded-xl transition cursor-pointer">&times;</button>
    `;
    contenedor.appendChild(div);
}

async function guardarPaquete(event) {
    event.preventDefault();
    const id = document.getElementById('paq-id').value;
    const nombre = document.getElementById('paq-nombre').value;
    const tipo_evento = document.getElementById('paq-tipo-evento').value;
    const nivel_equipamiento = document.getElementById('paq-nivel').value;
    const precio_base = parseFloat(document.getElementById('paq-precio').value);
    const descripcion = document.getElementById('paq-descripcion').value;

    let paqueteId = id;

    if (id) {
        // UPDATE PAQUETE
        const { error } = await window.supabaseClient
            .from('paquetes_service_euros')
            .update({ nombre, tipo_evento, nivel_equipamiento, precio_base, descripcion })
            .eq('id', id);

        if (error) return alert("Error al actualizar paquete: " + error.message);
    } else {
        // INSERT PAQUETE
        const { data: newPaq, error } = await window.supabaseClient
            .from('paquetes_service_euros')
            .insert([{ nombre, tipo_evento, nivel_equipamiento, precio_base, descripcion }])
            .select();

        if (error) return alert("Error al crear paquete: " + error.message);
        paqueteId = newPaq[0].id;
    }

    // Reconstruir detalles/desglose del paquete
    await window.supabaseClient.from('paquete_detalles_service_euros').delete().eq('paquete_id', paqueteId);

    const filas = document.querySelectorAll('.fila-desglose-paquete');
    const nuevosDetalles = [];

    filas.forEach(f => {
        const pId = f.querySelector('.select-prod-id').value;
        const cant = parseInt(f.querySelector('.input-prod-cant').value);
        if (pId && cant > 0) {
            nuevosDetalles.push({ paquete_id: paqueteId, producto_id: pId, cantidad: cant });
        }
    });

    if (nuevosDetalles.length > 0) {
        await window.supabaseClient.from('paquete_detalles_service_euros').insert(nuevosDetalles);
    }

    cerrarModales();
    inicializarPaquetes();
}

async function eliminarPaquete(id) {
    if (!confirm(`¿Estás seguro de eliminar el Paquete #${id}?`)) return;

    const { error } = await window.supabaseClient
        .from('paquetes_service_euros')
        .delete()
        .eq('id', id);

    if (error) return alert("Error al eliminar paquete: " + error.message);
    inicializarPaquetes();
}

// -------------------------------------------------------------
// AUXILIARES
// -------------------------------------------------------------
function abrirModalCrearActual() {
    if (vistaActual === 'productos') {
        abrirModalCrearProducto();
    } else {
        abrirModalCrearPaquete();
    }
}

function cerrarModales() {
    document.getElementById('modal-producto').classList.add('hidden');
    document.getElementById('modal-paquete').classList.add('hidden');
}

document.addEventListener("DOMContentLoaded", () => {
    inicializarInventario();
});