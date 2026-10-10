// ==========================================
// 1. Métricas Generales y Solicitudes Recientes del Dashboard
// ==========================================
async function cargarMetricasGenerales() {
    try {
        if (typeof window.supabaseClient === 'undefined') return;

        // 1. Obtener ingresos y calcular el mes actual
        const { data: ingresos, error: errIngresos } = await window.supabaseClient
            .from('ingresos_service_euros')
            .select('monto_final_cobrado, fecha_pago');

        let totalIngresosMes = 0;
        if (!errIngresos && ingresos) {
            const fechaActual = new Date();
            const mesActual = fechaActual.getMonth();
            const anioActual = fechaActual.getFullYear();

            totalIngresosMes = ingresos
                .filter(item => {
                    const fechaPago = new Date(item.fecha_pago);
                    return fechaPago.getMonth() === mesActual && fechaPago.getFullYear() === anioActual;
                })
                .reduce((acc, curr) => acc + parseFloat(curr.monto_final_cobrado || 0), 0);
        }

        // 2. Obtener cotizaciones en revisión (pendientes)
        const { count: countPendientes, error: errCot } = await window.supabaseClient
            .from('cotizaciones_service_euros')
            .select('*', { count: 'exact', head: true })
            .eq('estado', 'en_revision');

        // 3. Obtener eventos confirmados (aprobados)
        const { count: countAprobados, error: errAprob } = await window.supabaseClient
            .from('cotizaciones_service_euros')
            .select('*', { count: 'exact', head: true })
            .eq('estado', 'aprobado');

        // Renderizar en el DOM de forma segura las métricas
        const elIngresos = document.getElementById('metric-ingresos');
        const elPendientes = document.getElementById('metric-pendientes');
        const elEventos = document.getElementById('metric-eventos');

        if (elIngresos) elIngresos.textContent = `Bs. ${totalIngresosMes.toLocaleString('es-BO', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
        if (elPendientes) elPendientes.textContent = errCot ? '0' : (countPendientes || 0);
        if (elEventos) elEventos.textContent = errAprob ? '0' : (countAprobados || 0);

        // 4. Cargar la tabla de solicitudes recientes "en revisión"
        await cargarSolicitudesEnRevision();

    } catch (err) {
        console.error("Error al cargar métricas generales:", err);
    }
}

// Función para obtener y listar las solicitudes recientes en revisión en el Dashboard
async function cargarSolicitudesEnRevision() {
    const tablaBody = document.getElementById('tabla-solicitudes-recientes');
    if (!tablaBody) return;

    try {
        const { data: solicitudes, error } = await window.supabaseClient
            .from('cotizaciones_service_euros')
            .select(`
                id,
                tipo_evento,
                fecha_evento,
                hora_inicio,
                departamento,
                direccion_exacta,
                precio_estimado_total,
                created_at,
                usuarios_service_euros (nombre_completo, telefono)
            `)
            .eq('estado', 'en_revision')
            .order('created_at', { ascending: false })
            .limit(5); // Traemos las 5 más recientes para revisión rápida

        if (error) throw error;

        if (!solicitudes || solicitudes.length === 0) {
            tablaBody.innerHTML = `
                <tr>
                    <td colspan="6" class="py-6 text-center text-[#e7b263]/70 text-sm">
                        No hay solicitudes pendientes en revisión por el momento. ¡Todo al día!
                    </td>
                </tr>
            `;
            return;
        }

        let htmlRows = '';
        solicitudes.forEach(item => {
            const clienteNombre = item.usuarios_service_euros?.nombre_completo || 'Cliente General';
            const clienteTelefono = item.usuarios_service_euros?.telefono || 'Sin teléfono';
            const fechaFormateada = new Date(item.fecha_evento).toLocaleDateString('es-BO');
            const montoTotal = parseFloat(item.precio_estimado_total || 0).toLocaleString('es-BO', { minimumFractionDigits: 2 });

            htmlRows += `
                <tr class="border-b border-[#a4202e]/20 hover:bg-[#620f14]/30 transition">
                    <td class="py-3 px-4 font-semibold text-white">#${item.id} - ${item.tipo_evento}</td>
                    <td class="py-3 px-4">
                        <div class="font-medium">${clienteNombre}</div>
                        <div class="text-xs text-[#e7b263]">${clienteTelefono}</div>
                    </td>
                    <td class="py-3 px-4 text-xs">${fechaFormateada} (${item.hora_inicio})</td>
                    <td class="py-3 px-4 text-xs">${item.departamento} <br><span class="text-gray-400">${item.direccion_exacta || ''}</span></td>
                    <td class="py-3 px-4 font-bold text-emerald-400">Bs. ${montoTotal}</td>
                    <td class="py-3 px-4 text-right">
                        <button onclick="cargarVista('cotizaciones')" class="bg-[#a4202e] hover:bg-rose-700 text-[#fefae2] text-xs font-semibold px-3 py-1.5 rounded-lg transition shadow">
                            Ver Detalle
                        </button>
                    </td>
                </tr>
            `;
        });

        tablaBody.innerHTML = htmlRows;

    } catch (err) {
        console.error("Error al cargar solicitudes recientes:", err);
        tablaBody.innerHTML = `<tr><td colspan="6" class="py-4 text-center text-rose-400 text-xs">Error al cargar las solicitudes recientes.</td></tr>`;
    }
}

// ==========================================
// 2. Cambio de Vista Dinámico
// ==========================================
async function cargarVista(vista) {
    const container = document.getElementById('admin-main-container');
    const title = document.getElementById('header-title');
    
    // Actualizar estilos activos del menú lateral
    document.querySelectorAll('.nav-btn').forEach(btn => {
        if(btn.getAttribute('data-target') === vista) {
            btn.className = "w-full flex items-center space-x-3 px-4 py-3 rounded-xl bg-[#a4202e] text-[#fefae2] font-semibold transition nav-btn";
        } else {
            btn.className = "w-full flex items-center space-x-3 px-4 py-3 rounded-xl text-[#e7b263] hover:bg-[#620f14]/50 transition nav-btn";
        }
    });

    try {
        if (vista === 'dashboard') {
            title.textContent = "Control Operativo - Dashboard";
            container.innerHTML = `
                <!-- Tarjetas de Métricas -->
                <div class="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <div class="bg-[#620f14] border border-[#a4202e]/40 p-6 rounded-2xl shadow-lg">
                        <p class="text-xs text-[#e7b263] font-bold uppercase mb-1">Ingresos Confirmados / Mes</p>
                        <h3 id="metric-ingresos" class="text-3xl font-extrabold tracking-tight">Bs. 0.00</h3>
                    </div>
                    <div class="bg-[#620f14] border border-[#a4202e]/40 p-6 rounded-2xl shadow-lg">
                        <p class="text-xs text-[#e7b263] font-bold uppercase mb-1">Cotizaciones en Revisión</p>
                        <h3 id="metric-pendientes" class="text-3xl font-extrabold">0</h3>
                    </div>
                    <div class="bg-[#620f14] border border-[#a4202e]/40 p-6 rounded-2xl shadow-lg">
                        <p class="text-xs text-[#e7b263] font-bold uppercase mb-1">Eventos Confirmados</p>
                        <h3 id="metric-eventos" class="text-3xl font-extrabold">0</h3>
                    </div>
                </div>

                <!-- Sección de Solicitudes Recientes en Revisión -->
                <div class="bg-[#620f14]/80 border border-[#a4202e]/40 rounded-2xl p-6 shadow-xl space-y-4">
                    <div class="flex justify-between items-center border-b border-[#a4202e]/30 pb-3">
                        <div>
                            <h2 class="text-base font-extrabold tracking-wide text-[#fefae2]">Solicitudes Recientes en Revisión</h2>
                            <p class="text-xs text-[#e7b263]">Últimas peticiones de eventos enviadas por los clientes que requieren tu verificación</p>
                        </div>
                        <button onclick="cargarMetricasGenerales()" class="bg-[#240608] border border-[#a4202e]/40 text-[#e7b263] hover:text-white px-3 py-1.5 rounded-lg text-xs font-semibold transition flex items-center space-x-1.5">
                            <i data-lucide="refresh-cw" class="w-3.5 h-3.5"></i>
                            <span>Actualizar</span>
                        </button>
                    </div>

                    <div class="overflow-x-auto">
                        <table class="w-full text-left border-collapse">
                            <thead>
                                <tr class="border-b border-[#a4202e]/30 text-xs text-[#e7b263] uppercase tracking-wider">
                                    <th class="py-3 px-4">Evento</th>
                                    <th class="py-3 px-4">Cliente</th>
                                    <th class="py-3 px-4">Fecha / Hora</th>
                                    <th class="py-3 px-4">Ubicación</th>
                                    <th class="py-3 px-4">Total Est.</th>
                                    <th class="py-3 px-4 text-right">Acción</th>
                                </tr>
                            </thead>
                            <tbody id="tabla-solicitudes-recientes" class="text-sm divide-y divide-[#a4202e]/20">
                                <!-- Se inyecta dinámicamente -->
                                <tr>
                                    <td colspan="6" class="py-6 text-center text-[#e7b263]/70 text-sm">Cargando solicitudes recientes...</td>
                                </tr>
                            </tbody>
                        </table>
                    </div>
                </div>
            `;
            if (typeof cargarMetricasGenerales === 'function') cargarMetricasGenerales();
        } else {
            // Mapeo seguro de nombres del menú hacia los archivos reales en admin-content/
            const archivosMap = {
                'cotizaciones': 'cotizaciones.html',
                'inventario': 'inventario.html',
                'logistica': 'logistica.html',
                'usuarios': 'gestion-usuarios.html'
            };

            const archivoHtml = archivosMap[vista] || `${vista}.html`;

            const response = await fetch(`admin-content/${archivoHtml}`);
            if (!response.ok) throw new Error("No se pudo cargar la vista.");
            const html = await response.text();
            container.innerHTML = html;
            
            title.textContent = `Gestión de ${vista.toUpperCase()}`;

            if (vista === 'cotizaciones' && typeof inicializarCotizaciones === 'function') inicializarCotizaciones();
            if (vista === 'inventario' && typeof inicializarInventario === 'function') inicializarInventario();
            if (vista === 'logistica' && typeof inicializarLogistica === 'function') inicializarLogistica();
            if (vista === 'usuarios' && typeof inicializarUsuarios === 'function') inicializarUsuarios();
        }
        setTimeout(() => lucide.createIcons(), 100);
    } catch (err) {
        console.error("Error al cargar la sección:", err);
        container.innerHTML = `<div class="p-6 text-rose-400">Error al cargar el módulo ${vista}. Asegúrate de que el archivo exista en la carpeta admin-content/.</div>`;
    }
}

// ==========================================
// 3. Sistema de Alertas y Tiempo Real
// ==========================================
function iniciarEscuchaTiempoReal() {
    if (typeof window.supabaseClient === 'undefined') return;

    window.supabaseClient
        .channel('public:cotizaciones_service_euros')
        .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'cotizaciones_service_euros' }, payload => {
            console.log('Nueva solicitud recibida:', payload.new);
            
            const alertIndicator = document.getElementById('alert-indicator');
            const badge = document.getElementById('badge-notif');
            if (alertIndicator && badge) {
                alertIndicator.classList.remove('hidden');
                let actual = parseInt(badge.textContent || '0') + 1;
                badge.textContent = actual;
            }

            // Actualizar métricas y la tabla de solicitudes recientes de inmediato al recibir una nueva inserción
            if (typeof cargarMetricasGenerales === 'function') {
                cargarMetricasGenerales();
            }

            reproducirAlertaSonora();
        })
        .subscribe();
}

function reproducirAlertaSonora() {
    try {
        const ctx = new (window.AudioContext || window.webkitAudioContext)();
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(587.33, ctx.currentTime); // Nota D5
        gain.gain.setValueAtTime(0.1, ctx.currentTime);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start();
        osc.stop(ctx.currentTime + 0.2);
    } catch(e) {
        // Navegador bloqueó audio automático sin interacción previa
    }
}