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
        // Guardamos la tarifa en un objeto global indexada por su ID y nombre de zona
        tarifasGlobales[tarifa.id] = tarifa;
        tarifasGlobales[tarifa.departamento_o_zona] = tarifa;

        const option = document.createElement('option');
        option.value = tarifa.id; // Guardamos el ID de la tarifa como valor principal
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
      <div class="text-center py-6 text-[#fefae2]/70">
        <p class="mb-3">No has seleccionado ningún equipo o paquete todavía.</p>
        <a href="catalogo.html" class="inline-block bg-[#e7b263] text-[#2d080a] px-4 py-2 rounded-lg font-bold text-sm hover:bg-[#d49f50] transition">
          Ir a explorar el Catálogo
        </a>
      </div>
    `;
    return;
  }

  container.innerHTML = `
    <div class="overflow-x-auto">
      <table class="w-full text-left text-sm">
        <thead>
          <tr class="border-b border-[#a4202e]/40 text-[#e7b263]">
            <th class="py-2">Equipo / Paquete</th>
            <th class="py-2 text-center">Cantidad</th>
            <th class="py-2 text-right">Precio U.</th>
            <th class="py-2 text-right">Subtotal</th>
            <th class="py-2 text-center">Acción</th>
          </tr>
        </thead>
        <tbody class="divide-y divide-[#a4202e]/20">
          ${items.map((item, index) => `
            <tr>
              <td class="py-3 font-medium">${item.nombre}</td>
              <td class="py-3 text-center">
                <input type="number" min="1" value="${item.cantidad}" onchange="updateQuantity(${index}, this.value)" class="w-16 bg-[#2d080a] border border-[#a4202e] rounded text-center text-[#fefae2] py-1 focus:outline-none focus:border-[#e7b263]">
              </td>
              <td class="py-3 text-right">Bs. ${parseFloat(item.precio).toFixed(2)}</td>
              <td class="py-3 text-right font-bold text-[#e7b263]">Bs. ${(parseFloat(item.precio) * parseInt(item.cantidad)).toFixed(2)}</td>
              <td class="py-3 text-center">
                <button type="button" onclick="removeItem(${index})" class="text-red-400 hover:text-red-300 font-bold px-2 py-1 text-xs bg-red-950/40 rounded border border-red-900/50 transition">Eliminar</button>
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

  // Si el cliente marca que el transporte corre por su cuenta, el flete se anula (Bs. 0.00)
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
      ? 'bg-[#1a4d2e] text-[#fefae2] border-[#2e7d32]' 
      : 'bg-[#620f14] text-[#fefae2] border-[#a4202e]'
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
  // Validación estricta de sesión de usuario (Autenticación)
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

  // Capturar campos del formulario asegurando llenado correcto
  const tipoEvento = document.getElementById('tipo_evento')?.value;
  const fechaEvento = document.getElementById('fecha_evento')?.value;
  const horaInicio = document.getElementById('hora_inicio')?.value;
  const direccionExacta = document.getElementById('direccion_exacta')?.value;

  if (!tipoEvento || !fechaEvento || !horaInicio || !tarifaId || !direccionExacta) {
    showNotification('Por favor completa todos los campos obligatorios de logística y fecha.', 'error');
    return;
  }

  // Obtener el nombre del departamento/zona según la tarifa seleccionada
  const tarifaInfo = tarifasGlobales[tarifaId];
  const departamentoNombre = tarifaInfo ? tarifaInfo.departamento_o_zona : 'Cochabamba';

  // Paquete principal opcional
  const paqueteItem = items.find(i => i.esPaquete);
  const paqueteIdDb = paqueteItem ? paqueteItem.paquete_db_id : null;

  try {
    // 1. Insertar la cotización principal vinculando las columnas de tu esquema SQL
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
          tarifa_transporte_id: parseInt(tarifaId)
        }
      ])
      .select()
      .single();

    if (cotError) throw cotError;

    // 2. Insertar los ítems individuales en 'cotizacion_items_service_euros'
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

    // Limpiar carrito local
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