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
      container.innerHTML = '<p class="text-sm text-red-400 col-span-full text-center py-8">Error al cargar los equipos. Verifica tu conexión o base de datos.</p>';
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
      container.innerHTML = '<p class="text-sm text-red-400 col-span-full text-center py-8">Error al cargar los paquetes preconfigurados.</p>';
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
    container.innerHTML = '<p class="text-sm text-[#fefae2]/70 col-span-full text-center py-8">No se encontraron equipos con los filtros seleccionados.</p>';
    return;
  }

  container.innerHTML = productos.map(prod => `
    <div class="bg-[#620f14] border border-[#a4202e]/40 rounded-xl p-5 hover:border-[#a4202e] transition flex flex-col justify-between shadow-lg">
      <div>
        <img src="${prod.imagen_url || 'assets/img/equipos/default.jpg'}" alt="${prod.nombre}" class="w-full h-40 object-cover rounded-lg mb-4">
        <h3 class="text-xl font-bold text-[#fefae2] mb-1">${prod.nombre}</h3>
        <p class="text-xs text-[#e7b263] mb-3 line-clamp-2">${prod.especificaciones || 'Especificación profesional'}</p>
        <p class="text-xs text-[#fefae2]/70 mb-4">Stock disponible: <span class="font-bold text-[#fefae2]">${prod.stock_disponible}</span></p>
      </div>
      <div>
        <div class="flex items-center justify-between mb-3 pt-3 border-t border-[#a4202e]/30">
          <span class="text-lg font-black text-[#e7b263]">Bs. ${parseFloat(prod.precio_por_jornada || 0).toFixed(2)} <span class="text-[10px] text-gray-300">/ jornada</span></span>
        </div>
        <div class="grid grid-cols-2 gap-2">
          <button onclick="openProductModal(${prod.id})" class="bg-[#2d080a] border border-[#a4202e] text-[#fefae2] px-2 py-2 rounded-lg text-xs font-semibold hover:bg-[#a4202e]/40 transition text-center">
            Ver Detalle
          </button>
          <button onclick="addToCotizador(${prod.id}, '${prod.nombre.replace(/'/g, "")}', ${prod.precio_por_jornada})" class="bg-[#a4202e] text-[#fefae2] px-2 py-2 rounded-lg text-xs font-bold hover:bg-[#831823] transition text-center">
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
    container.innerHTML = '<p class="text-sm text-[#fefae2]/70 col-span-full text-center py-8">No hay paquetes disponibles.</p>';
    return;
  }

  container.innerHTML = paquetes.map(pkg => `
    <div class="bg-[#620f14] border-2 border-[#e7b263]/40 rounded-2xl p-6 relative flex flex-col justify-between shadow-xl">
      <div>
        <div class="inline-block bg-[#e7b263] text-[#620f14] text-xs font-bold px-2 py-0.5 rounded mb-3">
          ${pkg.nivel_equipamiento ? pkg.nivel_equipamiento.toUpperCase().replace(/_/g, ' ') : 'ESTÁNDAR'}
        </div>
        <h3 class="text-2xl font-bold text-[#fefae2] mb-2">${pkg.nombre}</h3>
        <p class="text-sm text-[#fefae2]/80 mb-4">${pkg.descripcion || ''}</p>
      </div>
      <div>
        <div class="text-2xl font-extrabold text-[#e7b263] mb-4">
          Bs. ${parseFloat(pkg.precio_base || 0).toFixed(2)}
        </div>
        <a href="cotizador.html?paquete_id=${pkg.id}" class="block text-center bg-[#e7b263] text-[#2d080a] hover:bg-[#d49f50] py-2.5 rounded-lg font-bold text-sm shadow-md transition">
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
  notification.className = 'fixed bottom-6 right-6 z-50 bg-[#1a4d2e] text-[#fefae2] border border-[#2e7d32] px-6 py-4 rounded-xl shadow-2xl text-sm font-bold transition-all duration-300';
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
    <div class="bg-[#620f14] border border-[#a4202e] rounded-2xl max-w-lg w-full p-6 shadow-2xl text-[#fefae2] relative animate-in fade-in zoom-in duration-200 max-h-[90vh] overflow-y-auto">
      <button onclick="document.getElementById('product-modal').remove()" class="absolute top-4 right-4 text-[#fefae2]/70 hover:text-[#fefae2] font-bold text-xl">✕</button>
      
      <img src="${prod.imagen_url || 'assets/img/equipos/default.jpg'}" alt="${prod.nombre}" class="w-full h-48 object-cover rounded-xl mb-4 border border-[#a4202e]/40">
      
      <h2 class="text-2xl font-black mb-2 text-[#e7b263]">${prod.nombre}</h2>
      
      <p class="text-xs text-[#fefae2]/80 mb-4">
        ${prod.especificaciones || 'Sin especificación general.'}
      </p>

      <div class="bg-[#2d080a] p-4 rounded-xl border border-[#a4202e]/30 mb-5 space-y-2 text-xs">
        <strong class="text-[#e7b263] text-sm block mb-2 border-b border-[#a4202e]/30 pb-1">Ficha Técnica Detallada:</strong>
        <p><strong>Componentes Principales:</strong> <span class="text-gray-300">${specsData?.componentes_principales || 'No especificado'}</span></p>
        <p><strong>Consumo (Energía/Combustible):</strong> <span class="text-gray-300">${specsData?.consumo_energetico_o_combustible || 'No especificado'}</span></p>
        <p><strong>Potencia o Rendimiento:</strong> <span class="text-gray-300">${specsData?.potencia_o_rendimiento || 'No especificado'}</span></p>
        <p><strong>Observaciones Extra:</strong> <span class="text-gray-300">${specsData?.observaciones_extra || 'Ninguna'}</span></p>
      </div>

      <div class="flex justify-between items-center mb-6 text-sm">
        <span>Stock disponible: <strong class="text-[#e7b263]">${prod.stock_disponible} unidades</strong></span>
        <span class="text-xl font-black text-[#e7b263]">Bs. ${parseFloat(prod.precio_por_jornada || 0).toFixed(2)} <span class="text-xs text-gray-300">/ jornada</span></span>
      </div>

      <div class="flex space-x-3">
        <button onclick="document.getElementById('product-modal').remove(); addToCotizador(${prod.id}, '${prod.nombre.replace(/'/g, "")}', ${prod.precio_por_jornada})" class="flex-1 bg-[#e7b263] text-[#2d080a] hover:bg-[#d49f50] font-extrabold py-3 rounded-xl transition shadow-lg text-center text-xs">
          Añadir a la Cotización
        </button>
        <button onclick="document.getElementById('product-modal').remove()" class="bg-[#2d080a] border border-[#a4202e] hover:bg-[#a4202e]/30 px-5 py-3 rounded-xl font-bold transition text-xs">
          Cerrar
        </button>
      </div>
    </div>
  `;

  document.body.appendChild(modal);
}