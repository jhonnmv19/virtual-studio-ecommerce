// js/cotizador.js

let tarifasGlobales = {}; // Almacenará las tarifas cargadas desde Supabase

document.addEventListener('DOMContentLoaded', async () => {
  // Configurar la fecha mínima permitida a partir de hoy
  const fechaInput = document.getElementById('fecha_evento');
  if (fechaInput) {
    const today = new Date().toISOString().split('T')[0];
    fechaInput.setAttribute('min', today);
  }

  // 1. Cargar tarifas de transporte desde Supabase al iniciar
  await loadTarifasTransporte();

  // Verificar si se seleccionó un paquete desde la URL (Ej. cotizador.html?paquete_id=1)
  const urlParams = new URLSearchParams(window.location.search);
  const paqueteId = urlParams.get('paquete_id');
  if (paqueteId && window.supabaseClient) {
    await handlePaqueteSelection(paqueteId);
  }

  renderCotizadorItems();
  setupListeners();
  calculateTotals();
});

function setupListeners() {
  const deptSelect = document.getElementById('departamento');
  if (deptSelect) {
    deptSelect.addEventListener('change', () => {
      updateFleteDescription();
      calculateTotals();
    });
  }

  const transporteClienteCheckbox = document.getElementById('transporte_a_cargo_cliente');
  if (transporteClienteCheckbox) {
    transporteClienteCheckbox.addEventListener('change', calculateTotals);
  }
}

/**
 * Carga las tarifas de transporte desde la tabla 'tarifas_transporte_service_euros'
 */
async function loadTarifasTransporte() {
  const deptSelect = document.getElementById('departamento');
  if (!deptSelect || !window.supabaseClient) return;

  try {
    const { data: tarifas, error } = await window.supabaseClient
      .from('tarifas_transporte_service_euros')
      .select('*');

    if (error) throw error;

    if (tarifas && tarifas.length > 0) {
      deptSelect.innerHTML = '';
      tarifasGlobales = {}; // Reiniciar diccionario global

      tarifas.forEach(tarifa => {
        tarifasGlobales[tarifa.id] = tarifa;
        tarifasGlobales[tarifa.departamento_o_zona] = tarifa;

        const option = document.createElement('option');
        option.value = tarifa.id;
        option.dataset.zona = tarifa.departamento_o_zona;
        option.dataset.costo = tarifa.costo_base_flete;
        option.dataset.permiteCliente = tarifa.permite_transporte_cliente;
        option.textContent = `${tarifa.departamento_o_zona} (Bs. ${parseFloat(tarifa.costo_base_flete).toFixed(2)})`;
        
        deptSelect.appendChild(option);
      });

      updateFleteDescription();
    }
  } catch (err) {
    console.error('Error cargando tarifas de transporte de Supabase:', err.message);
    showNotification('No se pudieron cargar las tarifas de transporte dinámicas.', 'error');
  }
}

/**
 * Actualiza información adicional de condiciones de flete si existe el contenedor en el HTML
 */
function updateFleteDescription() {
  const deptSelect = document.getElementById('departamento');
  const descContainer = document.getElementById('flete-condiciones-text');
  if (!deptSelect) return;

  const selectedOption = deptSelect.options[deptSelect.selectedIndex];
  if (!selectedOption) return;

  const tarifaId = deptSelect.value;
  const tarifaInfo = tarifasGlobales[tarifaId];

  if (tarifaInfo && descContainer) {
    descContainer.textContent = tarifaInfo.descripcion_condiciones || 'Costo basado en distancia y consumo de combustible de la ruta.';
  }
}

/**
 * Carga el paquete preconfigurado desde Supabase y lo añade a los ítems de cotización
 */
async function handlePaqueteSelection(paqueteId) {
  try {
    const { data: paquete, error } = await window.supabaseClient
      .from('paquetes_service_euros')
      .select('*')
      .eq('id', paqueteId)
      .single();

    if (error || !paquete) return;

    let items = JSON.parse(localStorage.getItem('cotizacion_items') || '[]');
    
    const itemKey = `pkg_${paquete.id}`;
    const existingIndex = items.findIndex(item => item.id === itemKey);

    if (existingIndex === -1) {
      items.push({
        id: itemKey,
        paquete_db_id: paquete.id,
        nombre: `📦 Paquete: ${paquete.nombre}`,
        precio: parseFloat(paquete.precio_base),
        cantidad: 1,
        esPaquete: true
      });
      localStorage.setItem('cotizacion_items', JSON.stringify(items));
      showNotification(`Paquete "${paquete.nombre}" añadido con éxito.`);
    }
  } catch (err) {
    console.error('Error al cargar el paquete:', err.message);
  }
}

/**
 * Renderiza los ítems seleccionados (individuales o paquetes)
 */
function renderCotizadorItems() {
  const container = document.getElementById('cotizador-items-container');
  if (!container) return;

  const items = JSON.parse(localStorage.getItem('cotizacion_items') || '[]');

  if (items.length === 0) {
    container.innerHTML = `
      <div class="text-center py-6 text-[#eaecee]/70">
        <p class="mb-3">No has seleccionado ningún equipo o paquete todavía.</p>
        <a href="catalogo.html" class="inline-block bg-[#00e4fb] text-[#12192a] px-4 py-2 rounded-lg font-bold text-sm hover:bg-white transition">
          Ir a explorar el Catálogo
        </a>
      </div>
    `;
    return;
  }

  container.innerHTML = `
    <div class="overflow-x-auto">
      <table class="w-full text-left text-sm text-[#eaecee]">
        <thead>
          <tr class="border-b border-[#00e4fb]/30 text-[#00e4fb]">
            <th class="py-2">Equipo / Paquete</th>
            <th class="py-2 text-center">Cantidad</th>
            <th class="py-2 text-right">Precio U.</th>
            <th class="py-2 text-right">Subtotal</th>
            <th class="py-2 text-center">Acción</th>
          </tr>
        </thead>
        <tbody class="divide-y divide-[#00e4fb]/20">
          ${items.map((item, index) => `
            <tr>
              <td class="py-3 font-medium">${item.nombre}</td>
              <td class="py-3 text-center">
                <input type="number" min="1" value="${item.cantidad}" onchange="updateQuantity(${index}, this.value)" class="w-16 bg-[#1b253d] border border-[#00e4fb]/40 rounded text-center text-[#eaecee] py-1 focus:outline-none focus:border-[#00e4fb]">
              </td>
              <td class="py-3 text-right">Bs. ${parseFloat(item.precio).toFixed(2)}</td>
              <td class="py-3 text-right font-bold text-[#00e4fb]">Bs. ${(parseFloat(item.precio) * parseInt(item.cantidad)).toFixed(2)}</td>
              <td class="py-3 text-center">
                <button type="button" onclick="removeItem(${index})" class="text-rose-300 hover:text-white font-bold px-2 py-1 text-xs bg-rose-950/40 rounded border border-rose-500/30 transition">Eliminar</button>
              </td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    </div>
  `;
}

function updateQuantity(index, nuevaCantidad) {
  let items = JSON.parse(localStorage.getItem('cotizacion_items') || '[]');
  const cantidad = parseInt(nuevaCantidad);
  if (cantidad > 0) {
    items[index].cantidad = cantidad;
  } else {
    items.splice(index, 1);
  }
  localStorage.setItem('cotizacion_items', JSON.stringify(items));
  renderCotizadorItems();
  calculateTotals();
}

function removeItem(index) {
  let items = JSON.parse(localStorage.getItem('cotizacion_items') || '[]');
  items.splice(index, 1);
  localStorage.setItem('cotizacion_items', JSON.stringify(items));
  renderCotizadorItems();
  calculateTotals();
}

function calculateTotals() {
  const items = JSON.parse(localStorage.getItem('cotizacion_items') || '[]');
  const deptSelect = document.getElementById('departamento');
  const transporteClienteCheckbox = document.getElementById('transporte_a_cargo_cliente');
  
  const subtotal = items.reduce((sum, item) => sum + (parseFloat(item.precio) * parseInt(item.cantidad)), 0);
  
  let costoFlete = 0.00;
  if (deptSelect && deptSelect.value) {
    const tarifaId = deptSelect.value;
    const tarifaInfo = tarifasGlobales[tarifaId];
    if (tarifaInfo) {
      costoFlete = parseFloat(tarifaInfo.costo_base_flete || 0);
    }
  }

  const aCargoCliente = transporteClienteCheckbox ? transporteClienteCheckbox.checked : false;
  if (aCargoCliente) {
    costoFlete = 0.00;
  }

  const total = subtotal + costoFlete;

  const subtotalEl = document.getElementById('resumen-subtotal');
  const fleteEl = document.getElementById('resumen-flete');
  const totalEl = document.getElementById('resumen-total');

  if (subtotalEl) subtotalEl.textContent = `Bs. ${subtotal.toFixed(2)}`;
  if (fleteEl) fleteEl.textContent = `Bs. ${costoFlete.toFixed(2)}`;
  if (totalEl) totalEl.textContent = `Bs. ${total.toFixed(2)}`;

  return { subtotal, costoFlete, total, items, tarifaId: deptSelect ? deptSelect.value : null, aCargoCliente };
}

function showNotification(message, type = 'success') {
  const existing = document.getElementById('custom-notification');
  if (existing) existing.remove();

  const notification = document.createElement('div');
  notification.id = 'custom-notification';
  notification.className = `fixed bottom-6 right-6 z-50 px-6 py-4 rounded-xl shadow-2xl text-sm font-bold border transition-all duration-300 transform translate-y-2 opacity-0 ${
    type === 'success' 
      ? 'bg-[#12192a] text-[#00e4fb] border-[#00e4fb]/40' 
      : 'bg-[#12192a] text-rose-300 border-rose-500/40'
  }`;
  notification.textContent = message;

  document.body.appendChild(notification);
  setTimeout(() => {
    notification.classList.remove('translate-y-2', 'opacity-0');
  }, 10);

  setTimeout(() => {
    notification.classList.add('translate-y-2', 'opacity-0');
    setTimeout(() => notification.remove(), 300);
  }, 4000);
}

/**
 * Envía la cotización validando autenticación, campos obligatorios y registrando en Supabase
 */
async function submitCotizacion() {
  const user = getCurrentUser();
  if (!user) {
    showNotification('Por favor inicia sesión o regístrate antes de enviar tu solicitud.', 'error');
    setTimeout(() => {
      window.location.href = 'login.html';
    }, 1500);
    return;
  }

  const { subtotal, costoFlete, total, items, tarifaId, aCargoCliente } = calculateTotals();

  if (items.length === 0) {
    showNotification('Tu cotización está vacía. Añade al menos un equipo o paquete.', 'error');
    return;
  }

  const tipoEvento = document.getElementById('tipo_evento')?.value;
  const fechaEvento = document.getElementById('fecha_evento')?.value;
  const horaInicio = document.getElementById('hora_inicio')?.value;
  const direccionExacta = document.getElementById('direccion_exacta')?.value;

  if (!tipoEvento || !fechaEvento || !horaInicio || !tarifaId || !direccionExacta) {
    showNotification('Por favor completa todos los campos obligatorios de logística y fecha.', 'error');
    return;
  }

  const tarifaInfo = tarifasGlobales[tarifaId];
  const departamentoNombre = tarifaInfo ? tarifaInfo.departamento_o_zona : 'Cochabamba';

  const paqueteItem = items.find(i => i.esPaquete);
  const paqueteIdDb = paqueteItem ? paqueteItem.paquete_db_id : null;

  try {
    const { data: cotizacion, error: cotError } = await window.supabaseClient
      .from('cotizaciones_service_euros')
      .insert([
        {
          usuario_id: user.id,
          tipo_evento: tipoEvento,
          fecha_evento: fechaEvento,
          hora_inicio: horaInicio,
          departamento: departamentoNombre,
          direccion_exacta: direccionExacta,
          costo_flete: costoFlete,
          paquete_id: paqueteIdDb,
          subtotal: subtotal,
          precio_estimado_total: total,
          estado: 'en_revision',
          transporte_a_cargo_cliente: aCargoCliente,
          tarifas_transporte_id: parseInt(tarifaId)
        }
      ])
      .select()
      .single();

    if (cotError) throw cotError;

    const productosIndividuales = items.filter(i => !i.esPaquete);
    if (productosIndividuales.length > 0) {
      const itemsPayload = productosIndividuales.map(item => ({
        cotizacion_id: cotizacion.id,
        producto_id: item.id,
        cantidad: item.cantidad,
        precio_unitario: item.precio
      }));

      const { error: itemsError } = await window.supabaseClient
        .from('cotizacion_items_service_euros')
        .insert(itemsPayload);

      if (itemsError) throw itemsError;
    }

    localStorage.removeItem('cotizacion_items');

    showNotification(`¡Cotización enviada exitosamente, ${user.nombre_completo}! Nos pondremos en contacto para confirmar tu evento.`);
    setTimeout(() => {
      window.location.href = 'index.html';
    }, 2500);

  } catch (err) {
    console.error('Error registrando cotización:', err.message);
    showNotification('Ocurrió un error al enviar la cotización: ' + err.message, 'error');
  }
}