let vistaLogisticaActual = 'despachos';
let listaTarifasGlobal = [];

function cambiarVistaLogistica(vista) {
    vistaLogisticaActual = vista;
    const btnDesp = document.getElementById('btn-tab-despachos');
    const btnTar = document.getElementById('btn-tab-tarifas');
    const secDesp = document.getElementById('seccion-despachos');
    const secTar = document.getElementById('seccion-tarifas');

    if (vista === 'despachos') {
        btnDesp.className = "flex-1 sm:flex-none px-4 py-2 text-xs font-bold rounded-xl bg-[#e7b263] text-[#620f14] shadow transition";
        btnTar.className = "flex-1 sm:flex-none px-4 py-2 text-xs font-bold rounded-xl bg-neutral-900/80 text-[#e7b263] border border-[#e7b263]/30 hover:bg-neutral-800 transition";
        secDesp.classList.remove('hidden');
        secTar.classList.add('hidden');
        inicializarLogistica();
    } else {
        btnTar.className = "flex-1 sm:flex-none px-4 py-2 text-xs font-bold rounded-xl bg-[#e7b263] text-[#620f14] shadow transition";
        btnDesp.className = "flex-1 sm:flex-none px-4 py-2 text-xs font-bold rounded-xl bg-neutral-900/80 text-[#e7b263] border border-[#e7b263]/30 hover:bg-neutral-800 transition";
        secTar.classList.remove('hidden');
        secDesp.classList.add('hidden');
        inicializarTarifasTransporte();
    }
}

// -------------------------------------------------------------
// 1. MÓDULO DE EVENTOS APROBADOS Y LOGÍSTICA DE DESPACHO
// -------------------------------------------------------------
async function inicializarLogistica() {
    try {
        // Cargar tarifas primero para referencias cruzadas
        const { data: tarifas } = await window.supabaseClient
            .from('tarifas_transporte_service_euros')
            .select('*');
        listaTarifasGlobal = tarifas || [];

        const { data: aprobados, error } = await window.supabaseClient
            .from('cotizaciones_service_euros')
            .select(`*, tarifas_transporte_service_euros(*)`)
            .eq('estado', 'aprobado')
            .order('fecha_evento', { ascending: true });

        const container = document.getElementById('logistica-contenido');
        if (!container) return;

        if (error || !aprobados || aprobados.length === 0) {
            container.innerHTML = `<div class="col-span-full p-6 text-center bg-black/10 border border-[#a4202e]/30 rounded-xl"><p class="text-[#e7b263]/70 italic">No hay eventos aprobados pendientes de logística en este momento.</p></div>`;
            return;
        }

        let html = '';
        aprobados.forEach(ev => {
            const tarifaZona = ev.tarifas_transporte_service_euros?.departamento_o_zona || ev.departamento;
            html += `
                <div class="bg-[#240608] border border-[#a4202e]/40 p-4 rounded-xl space-y-3 flex flex-col justify-between shadow-md">
                    <div class="space-y-2">
                        <div class="flex justify-between items-center border-b border-[#a4202e]/30 pb-2">
                            <span class="text-xs font-bold text-[#e7b263]">EVENTO #${ev.id} - ${ev.tipo_evento}</span>
                            <span class="text-xs bg-emerald-500/20 text-emerald-400 font-semibold px-2.5 py-1 rounded-lg">${ev.fecha_evento} (${ev.hora_inicio})</span>
                        </div>
                        <div class="text-xs space-y-1">
                            <p class="text-white"><strong>Destino / Zona:</strong> <span class="text-[#e7b263]">${tarifaZona}</span></p>
                            <p class="text-[#fefae2]/80"><strong>Dirección exacta:</strong> ${ev.direccion_exacta || 'Sin dirección exacta registrada'}</p>
                            <p class="text-emerald-300 font-bold pt-1"><strong>Costo Flete Asignado:</strong> Bs. ${Number(ev.costo_flete || 0).toFixed(2)}</p>
                        </div>
                    </div>
                    <div class="pt-2 border-t border-[#a4202e]/30 flex justify-end">
                        <button onclick='abrirModalFlete(${JSON.stringify(ev)})' class="px-3 py-1.5 bg-amber-600/80 hover:bg-amber-600 text-white rounded-lg text-xs font-bold transition shadow">
                            Modificar Flete / Zona
                        </button>
                    </div>
                </div>
            `;
        });
        container.innerHTML = html;
    } catch (err) {
        console.error("Error en logística:", err);
    }
}

function abrirModalFlete(ev) {
    document.getElementById('flete-cotizacion-id').value = ev.id;
    document.getElementById('flete-txt-destino').innerText = `${ev.departamento} - ${ev.direccion_exacta || 'Sin dirección'}`;
    document.getElementById('flete-costo-input').value = ev.costo_flete || 0;

    // Llenar select de tarifas
    const select = document.getElementById('flete-select-tarifa');
    select.innerHTML = `<option value="">-- Seleccionar de la Lista de Tarifas --</option>`;
    listaTarifasGlobal.forEach(t => {
        select.innerHTML += `<option value="${t.id}" data-costo="${t.costo_base_flete}">${t.departamento_o_zona} (Bs. ${t.costo_base_flete})</option>`;
    });

    document.getElementById('modal-flete-evento').classList.remove('hidden');
}

function seleccionarTarifaZona() {
    const select = document.getElementById('flete-select-tarifa');
    const option = select.options[select.selectedIndex];
    const costo = option.getAttribute('data-costo');
    if (costo) {
        document.getElementById('flete-costo-input').value = costo;
    }
}

async function guardarFleteEvento(event) {
    event.preventDefault();
    const cotizacionId = document.getElementById('flete-cotizacion-id').value;
    const nuevoFlete = parseFloat(document.getElementById('flete-costo-input').value);
    const tarifaId = document.getElementById('flete-select-tarifa').value || null;

    const { error } = await window.supabaseClient
        .from('cotizaciones_service_euros')
        .update({ 
            costo_flete: nuevoFlete, 
            tarifa_transporte_id: tarifaId 
        })
        .eq('id', cotizacionId);

    if (error) {
        alert("Error al actualizar el flete del evento: " + error.message);
        return;
    }

    cerrarModalFlete();
    inicializarLogistica();
}

function cerrarModalFlete() {
    document.getElementById('modal-flete-evento').classList.add('hidden');
}


// -------------------------------------------------------------
// 2. MÓDULO DE TARIFAS DE TRANSPORTE Y ZONAS
// -------------------------------------------------------------
async function inicializarTarifasTransporte() {
    try {
        const { data: tarifas, error } = await window.supabaseClient
            .from('tarifas_transporte_service_euros')
            .select('*')
            .order('id', { ascending: true });

        if (error) {
            console.error("Error al cargar tarifas:", error.message);
            return;
        }

        listaTarifasGlobal = tarifas || [];
        const tbody = document.getElementById('tabla-tarifas-contenido');
        if (!tbody) return;
        tbody.innerHTML = '';

        if (!tarifas || tarifas.length === 0) {
            tbody.innerHTML = `<tr><td colspan="5" class="p-4 text-center text-[#e7b263]/70">No hay zonas o tarifas de transporte registradas.</td></tr>`;
            return;
        }

        tarifas.forEach(t => {
            const tr = document.createElement('tr');
            tr.className = "hover:bg-[#620f14]/50 transition border-b border-[#a4202e]/20 text-xs";
            tr.innerHTML = `
                <td class="p-3.5 text-center font-bold text-[#e7b263]">#${t.id}</td>
                <td class="p-3.5 font-semibold text-sm text-white">${t.departamento_o_zona}</td>
                <td class="p-3.5 text-right font-bold text-emerald-300 text-sm">Bs. ${Number(t.costo_base_flete || 0).toFixed(2)}</td>
                <td class="p-3.5 text-[#fefae2]/80">${t.descripcion_condiciones || 'Sin observaciones'}</td>
                <td class="p-3.5 text-center">
                    <div class="flex items-center justify-center gap-1.5">
                        <button onclick='abrirModalEditarTarifa(${JSON.stringify(t)})' class="px-2.5 py-1 bg-amber-600/80 hover:bg-amber-600 text-white rounded-lg font-bold transition">Editar</button>
                        <button onclick="eliminarTarifa(${t.id})" class="px-2.5 py-1 bg-red-700/80 hover:bg-red-700 text-white rounded-lg font-bold transition">Eliminar</button>
                    </div>
                </td>
            `;
            tbody.appendChild(tr);
        });
    } catch (err) {
        console.error("Error inesperado en tarifas:", err);
    }
}

function abrirModalTarifa() {
    document.getElementById('modal-tarifa-titulo').innerText = "Nueva Zona de Transporte";
    document.getElementById('form-tarifa').reset();
    document.getElementById('tarifa-id').value = '';
    document.getElementById('modal-tarifa').classList.remove('hidden');
}

function abrirModalEditarTarifa(t) {
    document.getElementById('modal-tarifa-titulo').innerText = `Editar Zona #${t.id}`;
    document.getElementById('tarifa-id').value = t.id;
    document.getElementById('tarifa-zona').value = t.departamento_o_zona;
    document.getElementById('tarifa-costo').value = t.costo_base_flete;
    document.getElementById('tarifa-desc').value = t.descripcion_condiciones || '';
    document.getElementById('modal-tarifa').classList.remove('hidden');
}

async function guardarTarifaZona(event) {
    event.preventDefault();
    const id = document.getElementById('tarifa-id').value;
    const departamento_o_zona = document.getElementById('tarifa-zona').value;
    const costo_base_flete = parseFloat(document.getElementById('tarifa-costo').value);
    const descripcion_condiciones = document.getElementById('tarifa-desc').value;

    if (id) {
        // Actualizar
        const { error } = await window.supabaseClient
            .from('tarifas_transporte_service_euros')
            .update({ departamento_o_zona, costo_base_flete, descripcion_condiciones })
            .eq('id', id);

        if (error) return alert("Error al actualizar zona: " + error.message);
    } else {
        // Crear
        const { error } = await window.supabaseClient
            .from('tarifas_transporte_service_euros')
            .insert([{ departamento_o_zona, costo_base_flete, descripcion_condiciones }]);

        if (error) return alert("Error al registrar nueva zona: " + error.message);
    }

    cerrarModalTarifa();
    inicializarTarifasTransporte();
}

async function eliminarTarifa(id) {
    if (!confirm(`¿Eliminar la zona de transporte #${id}?`)) return;

    const { error } = await window.supabaseClient
        .from('tarifas_transporte_service_euros')
        .delete()
        .eq('id', id);

    if (error) return alert("Error al eliminar zona: " + error.message);
    inicializarTarifasTransporte();
}

function cerrarModalTarifa() {
    document.getElementById('modal-tarifa').classList.add('hidden');
}

// Inicializar al cargar
document.addEventListener("DOMContentLoaded", () => {
    inicializarLogistica();
});