// js/catalog.js

document.addEventListener('DOMContentLoaded', async () => {
  if (document.getElementById('catalog-container') || document.getElementById('packages-container')) {
    await loadCategories();
    await loadCategoriesAndProducts();
    await loadPackages();
    setupFilters();
  }
});

let productosGlobal = [];
let categoriasGlobal = [];

async function loadCategories() {
  try {
    const { data: categorias, error } = await window.supabaseClient
      .from('categorias_service_euros')
      .select('*');

    if (error) throw error;
    categoriasGlobal = categorias || [];

    const selectCat = document.getElementById('category-filter');
    if (selectCat) {
      categoriasGlobal.forEach(cat => {
        const option = document.createElement('option');
        option.value = cat.id;
        option.textContent = cat.nombre;
        selectCat.appendChild(option);
      });
    }
  } catch (err) {
    console.error('Error cargando categorías:', err.message);
  }
}

async function loadCategoriesAndProducts() {
  try {
    const { data: productos, error: prodError } = await window.supabaseClient
      .from('productos_service_euros')
      .select('*');

    if (prodError) throw prodError;

    productosGlobal = productos || [];
    filterAndRenderCatalog();
  } catch (err) {
    console.error('Error cargando el catálogo:', err.message);
    const container = document.getElementById('catalog-container');
    if (container) {
      container.innerHTML = '<p class="text-sm text-rose-400 col-span-full text-center py-8">Error al cargar los equipos. Verifica tu conexión o base de datos.</p>';
    }
  }
}

async function loadPackages() {
  try {
    const { data: paquetes, error } = await window.supabaseClient
      .from('paquetes_service_euros')
      .select('*');

    if (error) throw error;

    renderPackages(paquetes || []);
  } catch (err) {
    console.error('Error cargando paquetes:', err.message);
    const container = document.getElementById('packages-container');
    if (container) {
      container.innerHTML = '<p class="text-sm text-rose-400 col-span-full text-center py-8">Error al cargar los paquetes preconfigurados.</p>';
    }
  }
}

function setupFilters() {
  const searchInput = document.getElementById('search-input');
  const categoryFilter = document.getElementById('category-filter');
  const sortFilter = document.getElementById('sort-filter');

  if (searchInput) {
    searchInput.addEventListener('input', filterAndRenderCatalog);
  }
  if (categoryFilter) {
    categoryFilter.addEventListener('change', filterAndRenderCatalog);
  }
  if (sortFilter) {
    sortFilter.addEventListener('change', filterAndRenderCatalog);
  }
}

function filterAndRenderCatalog() {
  const searchTerm = document.getElementById('search-input')?.value.toLowerCase().trim() || '';
  const selectedCategory = document.getElementById('category-filter')?.value || '';
  const sortOption = document.getElementById('sort-filter')?.value || 'default';

  // 1. Filtrado por texto (nombre o especificaciones)
  let filtered = productosGlobal.filter(prod => {
    const matchName = prod.nombre.toLowerCase().includes(searchTerm);
    const matchSpecs = prod.especificaciones && prod.especificaciones.toLowerCase().includes(searchTerm);
    return matchName || matchSpecs;
  });

  // 2. Filtrado por categoría
  if (selectedCategory !== '') {
    filtered = filtered.filter(prod => String(prod.categoria_id) === String(selectedCategory));
  }

  // 3. Ordenamiento
  if (sortOption === 'precio-asc') {
    filtered.sort((a, b) => parseFloat(a.precio_por_jornada) - parseFloat(b.precio_por_jornada));
  } else if (sortOption === 'precio-desc') {
    filtered.sort((a, b) => parseFloat(b.precio_por_jornada) - parseFloat(a.precio_por_jornada));
  } else if (sortOption === 'nombre-asc') {
    filtered.sort((a, b) => a.nombre.localeCompare(b.nombre));
  }

  renderCatalog(filtered);
}

function renderCatalog(productos) {
  const container = document.getElementById('catalog-container');
  if (!container) return;

  if (!productos || productos.length === 0) {
    container.innerHTML = '<p class="text-sm text-[#eaecee]/60 col-span-full text-center py-8">No se encontraron equipos con los filtros seleccionados en Virtual Studio.</p>';
    return;
  }

  container.innerHTML = productos.map(prod => `
    <div class="bg-[#1b253d] border border-[#00e4fb]/30 rounded-2xl p-5 hover:border-[#00e4fb] transition flex flex-col justify-between shadow-xl">
      <div>
        <img src="${prod.imagen_url || 'assets/img/equipos/default.jpg'}" alt="${prod.nombre}" class="w-full h-44 object-cover rounded-xl mb-4 border border-[#00e4fb]/20">
        <h3 class="text-lg font-extrabold text-[#eaecee] mb-1">${prod.nombre}</h3>
        <p class="text-xs text-[#00e4fb] mb-3 line-clamp-2">${prod.especificaciones || 'Especificación profesional'}</p>
        <p class="text-xs text-[#eaecee]/70 mb-4">Stock disponible: <span class="font-bold text-[#eaecee]">${prod.stock_disponible} un.</span></p>
      </div>
      <div>
        <div class="flex items-center justify-between mb-4 pt-3 border-t border-[#00e4fb]/20">
          <span class="text-lg font-black text-[#00e4fb]">Bs. ${parseFloat(prod.precio_por_jornada || 0).toFixed(2)} <span class="text-[10px] text-[#eaecee]/60 font-normal">/ jornada</span></span>
        </div>
        <div class="grid grid-cols-2 gap-2">
          <button onclick="openProductModal(${prod.id})" class="bg-slate-700/60 border border-[#00e4fb]/40 text-[#eaecee] px-3 py-2.5 rounded-xl text-xs font-bold hover:bg-slate-700 transition text-center cursor-pointer">
            Ver Detalle
          </button>
          <button onclick="addToCotizador(${prod.id}, '${prod.nombre.replace(/'/g, "")}', ${prod.precio_por_jornada})" class="bg-[#00e4fb] text-[#12192a] px-3 py-2.5 rounded-xl text-xs font-extrabold hover:bg-[#cdf9fe] transition text-center shadow-md cursor-pointer">
            + Añadir
          </button>
        </div>
      </div>
    </div>
  `).join('');
}

function renderPackages(paquetes) {
  const container = document.getElementById('packages-container');
  if (!container) return;

  if (!paquetes || paquetes.length === 0) {
    container.innerHTML = '<p class="text-sm text-[#eaecee]/60 col-span-full text-center py-8">No hay paquetes disponibles en Virtual Studio.</p>';
    return;
  }

  container.innerHTML = paquetes.map(pkg => `
    <div class="bg-[#1b253d] border-2 border-[#00e4fb]/40 rounded-2xl p-6 relative flex flex-col justify-between shadow-2xl">
      <div>
        <div class="inline-block bg-[#00e4fb] text-[#12192a] text-xs font-extrabold px-3 py-1 rounded-xl mb-3 shadow">
          ${pkg.nivel_equipamiento ? pkg.nivel_equipamiento.toUpperCase().replace(/_/g, ' ') : 'ESTÁNDAR'}
        </div>
        <h3 class="text-2xl font-extrabold text-[#eaecee] mb-2">${pkg.nombre}</h3>
        <p class="text-sm text-[#eaecee]/80 mb-4">${pkg.descripcion || ''}</p>
      </div>
      <div>
        <div class="text-2xl font-black text-[#00e4fb] mb-4">
          Bs. ${parseFloat(pkg.precio_base || 0).toFixed(2)}
        </div>
        <a href="cotizador.html?paquete_id=${pkg.id}" class="block text-center bg-[#00e4fb] text-[#12192a] hover:bg-[#cdf9fe] py-3 rounded-xl font-extrabold text-xs shadow-lg transition cursor-pointer">
          Seleccionar Paquete
        </a>
      </div>
    </div>
  `).join('');
}

function addToCotizador(id, nombre, precio) {
  let selectedItems = JSON.parse(localStorage.getItem('cotizacion_items') || '[]');
  const existing = selectedItems.find(item => item.id === id && !item.esPaquete);

  if (existing) {
    existing.cantidad += 1;
  } else {
    selectedItems.push({ id, nombre, precio, cantidad: 1, esPaquete: false });
  }

  localStorage.setItem('cotizacion_items', JSON.stringify(selectedItems));
  showCatalogNotification(`Añadido a cotización: ${nombre}`);
}

function showCatalogNotification(message) {
  const existing = document.getElementById('catalog-notification');
  if (existing) existing.remove();

  const notification = document.createElement('div');
  notification.id = 'catalog-notification';
  notification.className = 'fixed bottom-6 right-6 z-50 bg-[#12192a] text-[#eaecee] border border-[#00e4fb]/60 px-6 py-4 rounded-2xl shadow-2xl text-xs font-extrabold transition-all duration-300';
  notification.textContent = message;

  document.body.appendChild(notification);
  setTimeout(() => notification.remove(), 3000);
}

/**
 * Modal mejorado que consulta la tabla 'especificaciones_tecnicas_service_euros'
 */
async function openProductModal(id) {
  const prod = productosGlobal.find(p => p.id === id);
  if (!prod) return;

  const existingModal = document.getElementById('product-modal');
  if (existingModal) existingModal.remove();

  let specsData = null;
  try {
    const { data, error } = await window.supabaseClient
      .from('especificaciones_tecnicas_service_euros')
      .select('*')
      .eq('producto_id', id)
      .maybeSingle();

    if (!error) {
      specsData = data;
    }
  } catch (err) {
    console.error('Error consultando especificaciones técnicas:', err);
  }

  const modal = document.createElement('div');
  modal.id = 'product-modal';
  modal.className = 'fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4 backdrop-blur-sm';
  
  modal.innerHTML = `
    <div class="bg-[#12192a] border border-[#00e4fb]/40 rounded-2xl max-w-lg w-full p-6 md:p-8 shadow-2xl text-[#eaecee] relative animate-in fade-in zoom-in duration-200 max-h-[90vh] overflow-y-auto">
      <button onclick="document.getElementById('product-modal').remove()" class="absolute top-5 right-5 text-[#eaecee]/60 hover:text-[#00e4fb] font-bold text-xl cursor-pointer">✕</button>
      
      <img src="${prod.imagen_url || 'assets/img/equipos/default.jpg'}" alt="${prod.nombre}" class="w-full h-52 object-cover rounded-xl mb-4 border border-[#00e4fb]/30">
      
      <h2 class="text-2xl font-extrabold mb-2 text-[#eaecee]">${prod.nombre}</h2>
      
      <p class="text-xs text-[#eaecee]/80 mb-4">
        ${prod.especificaciones || 'Sin especificación general.'}
      </p>

      <div class="bg-[#1b253d] p-4 rounded-xl border border-[#00e4fb]/30 mb-5 space-y-2 text-xs">
        <strong class="text-[#00e4fb] text-xs uppercase tracking-wider block mb-2 border-b border-[#00e4fb]/20 pb-1">Ficha Técnica Detallada:</strong>
        <p><strong class="text-[#eaecee]">Componentes Principales:</strong> <span class="text-[#eaecee]/75">${specsData?.componentes_principales || 'No especificado'}</span></p>
        <p><strong class="text-[#eaecee]">Consumo (Energía/Combustible):</strong> <span class="text-[#eaecee]/75">${specsData?.consumo_energetico_o_combustible || 'No especificado'}</span></p>
        <p><strong class="text-[#eaecee]">Potencia o Rendimiento:</strong> <span class="text-[#eaecee]/75">${specsData?.potencia_o_rendimiento || 'No especificado'}</span></p>
        <p><strong class="text-[#eaecee]">Observaciones Extra:</strong> <span class="text-[#eaecee]/75">${specsData?.observaciones_extra || 'Ninguna'}</span></p>
      </div>

      <div class="flex justify-between items-center mb-6 text-sm">
        <span class="text-xs text-[#eaecee]/80">Stock disponible: <strong class="text-[#00e4fb]">${prod.stock_disponible} unidades</strong></span>
        <span class="text-xl font-black text-[#00e4fb]">Bs. ${parseFloat(prod.precio_por_jornada || 0).toFixed(2)} <span class="text-xs text-[#eaecee]/60 font-normal">/ jornada</span></span>
      </div>

      <div class="flex space-x-3">
        <button onclick="document.getElementById('product-modal').remove(); addToCotizador(${prod.id}, '${prod.nombre.replace(/'/g, "")}', ${prod.precio_por_jornada})" class="flex-1 bg-[#00e4fb] text-[#12192a] hover:bg-[#cdf9fe] font-extrabold py-3 rounded-xl transition shadow-lg text-center text-xs cursor-pointer">
          Añadir a la Cotización
        </button>
        <button onclick="document.getElementById('product-modal').remove()" class="bg-slate-700 border border-[#00e4fb]/40 hover:bg-slate-600 px-5 py-3 rounded-xl font-bold transition text-xs cursor-pointer text-white">
          Cerrar
        </button>
      </div>
    </div>
  `;

  document.body.appendChild(modal);
}