async function inicializarCotizaciones() {
    await cargarTablaCotizaciones();
}

async function cargarTablaCotizaciones() {
    try {
        const { data: cotizaciones, error } = await window.supabaseClient
            .from('cotizaciones_service_euros')
            .select(`
                *,
                usuarios_service_euros (
                    nombre_completo,
                    telefono
                )
            `)
            .order('created_at', { ascending: false });

        if (error) {
            console.error("Error al cargar cotizaciones:", error.message);
            return;
        }

        const tbody = document.getElementById('tabla-cotizaciones-contenido');
        if (!tbody) return;
        tbody.innerHTML = '';

        if (!cotizaciones || cotizaciones.length === 0) {
            tbody.innerHTML = `<tr><td colspan="8" class="py-6 px-3 text-center text-[#e7b263]/70 font-medium">No hay cotizaciones registradas.</td></tr>`;
            return;
        }

        cotizaciones.forEach(cot => {
            let badge = '';
            if (cot.estado === 'en_revision') {
                badge = `<span class="inline-block px-2.5 py-1 rounded-full text-[11px] font-bold bg-amber-500/20 text-amber-400 border border-amber-500/30 uppercase tracking-wide">En Revisión</span>`;
            } else if (cot.estado === 'aprobado') {
                badge = `<span class="inline-block px-2.5 py-1 rounded-full text-[11px] font-bold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 uppercase tracking-wide">Aprobado</span>`;
            } else {
                badge = `<span class="inline-block px-2.5 py-1 rounded-full text-[11px] font-bold bg-rose-500/20 text-rose-400 border border-rose-500/30 uppercase tracking-wide">Rechazado</span>`;
            }

            const cliente = cot.usuarios_service_euros || {};
            const nombreCliente = (cliente.nombre_completo || 'Cliente General').replace(/['"]+/g, '');
            const telefonoCliente = (cliente.telefono || 'Sin teléfono').replace(/['"]+/g, '');

            let accionesHTML = '';
            if (cot.estado === 'en_revision') {
                accionesHTML = `
                    <div class="flex items-center justify-center space-x-1.5">
                        <button type="button" onclick="abrirModalPrecio(${cot.id}, ${cot.precio_estimado_total || 0}, '${nombreCliente}', '${telefonoCliente}')" class="bg-amber-600 hover:bg-amber-700 text-white px-3 py-1.5 rounded-lg text-xs font-semibold transition shadow-sm w-28 text-center truncate cursor-pointer">Detalles</button>
                        <button type="button" onclick="cambiarEstadoCotizacion(${cot.id}, 'rechazado')" class="bg-rose-600 hover:bg-rose-700 text-white px-3 py-1.5 rounded-lg text-xs font-semibold transition shadow-sm w-24 text-center cursor-pointer">Rechazar</button>
                    </div>
                `;
            } else {
                accionesHTML = `<div class="text-center"><span class="text-xs text-neutral-400 italic">Cerrado</span></div>`;
            }

            const tr = document.createElement('tr');
            tr.className = "hover:bg-[#620f14]/40 transition border-b border-[#a4202e]/20";
            tr.innerHTML = `
                <td class="py-4 px-3 font-bold text-[#e7b263]">#${cot.id}</td>
                <td class="py-4 px-3">
                    <div class="font-semibold text-white truncate max-w-[150px]" title="${nombreCliente}">${nombreCliente}</div>
                    <div class="text-xs text-[#e7b263]/80 font-mono mt-0.5">📱 ${telefonoCliente}</div>
                </td>
                <td class="py-4 px-3 font-semibold text-white/90">${cot.tipo_evento || 'N/A'}</td>
                <td class="py-4 px-3 text-white/80">${cot.departamento || ''} ${cot.direccion_exacta ? '- ' + cot.direccion_exacta : ''}</td>
                <td class="py-4 px-3 text-xs text-white/80 whitespace-nowrap">${cot.fecha_evento || ''}</td>
                <td class="py-4 px-3 font-bold text-emerald-300 whitespace-nowrap">Bs. ${Number(cot.precio_estimado_total || 0).toFixed(2)}</td>
                <td class="py-4 px-3 whitespace-nowrap">${badge}</td>
                <td class="py-4 px-3 text-center">
                    ${accionesHTML}
                </td>
            `;
            tbody.appendChild(tr);
        });
    } catch (err) {
        console.error("Error inesperado en cargarTablaCotizaciones:", err);
    }
}

// Función del modal adaptada para generar enlace de WhatsApp
window.abrirModalPrecio = function(id, precioActual, nombre, telefono) {
    const modal = document.getElementById('modal-precio');
    const inputId = document.getElementById('modal-cot-id');
    const inputPrecio = document.getElementById('modal-nuevo-precio');
    const txtNombre = document.getElementById('modal-cliente-nombre');
    const txtTelefono = document.getElementById('modal-cliente-telefono');
    const btnLlamar = document.getElementById('modal-btn-llamar');
    
    if (modal && inputId && inputPrecio) {
        inputId.value = id;
        inputPrecio.value = precioActual;
        if (txtNombre) txtNombre.textContent = nombre;
        if (txtTelefono) txtTelefono.textContent = telefono;
        
        if (btnLlamar) {
            // Limpia el número eliminando espacios, guiones o caracteres extra para que wa.me funcione perfecto
            const telefonoLimpio = String(telefono).replace(/\D/g, '');
            btnLlamar.href = `https://wa.me/${telefonoLimpio}`;
        }
        
        modal.classList.remove('hidden');
    } else {
        console.error("No se encontraron los elementos del modal en el DOM.");
    }
}

window.cerrarModalPrecio = function() {
    const modal = document.getElementById('modal-precio');
    if (modal) {
        modal.classList.add('hidden');
    }
}

window.guardarPrecioYAProbar = async function() {
    const inputId = document.getElementById('modal-cot-id');
    const inputPrecio = document.getElementById('modal-nuevo-precio');
    
    if (!inputId || !inputPrecio) return;
    
    const id = inputId.value;
    const nuevoPrecio = parseFloat(inputPrecio.value);

    if (isNaN(nuevoPrecio) || nuevoPrecio < 0) {
        alert("Por favor ingrese un monto válido.");
        return;
    }

    try {
        const { error: updateError } = await window.supabaseClient
            .from('cotizaciones_service_euros')
            .update({ precio_estimado_total: nuevoPrecio, estado: 'aprobado' })
            .eq('id', id);

        if (updateError) {
            alert("Error al actualizar la cotización: " + updateError.message);
            return;
        }

        const { error: ingresoError } = await window.supabaseClient
            .from('ingresos_service_euros')
            .insert([{ cotizacion_id: id, monto_final_cobrado: nuevoPrecio }]);

        if (ingresoError) {
            console.error("Error al registrar ingreso:", ingresoError.message);
        }

        cerrarModalPrecio();
        await cargarTablaCotizaciones();
        alert("Cotización aprobada y tarifa preferencial registrada correctamente.");
    } catch (err) {
        console.error("Error al procesar precio personalizado:", err);
    }
}

window.cambiarEstadoCotizacion = async function(id, nuevoEstado) {
    try {
        const { error } = await window.supabaseClient
            .from('cotizaciones_service_euros')
            .update({ estado: nuevoEstado })
            .eq('id', id);

        if (error) {
            alert("Error al cambiar estado: " + error.message);
            return;
        }

        if (nuevoEstado === 'aprobado') {
            const { data: cotData } = await window.supabaseClient
                .from('cotizaciones_service_euros')
                .select('precio_estimado_total')
                .eq('id', id)
                .single();

            if (cotData) {
                await window.supabaseClient.from('ingresos_service_euros').insert([
                    { cotizacion_id: id, monto_final_cobrado: cotData.precio_estimado_total }
                ]);
            }
        }

        await cargarTablaCotizaciones();
    } catch (err) {
        console.error("Error al actualizar estado:", err);
    }
}