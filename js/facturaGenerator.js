// js/facturaGenerator.js

async function generarFacturaPDF(cotizacionId) {
    try {
        const { jsPDF } = window.jspdf;
        const doc = new jsPDF();

        // 1. Obtener la cotización completa, datos del cliente y paquete (usando 'precio_base')
        const { data: cotizacion, error: errCot } = await supabaseClient
            .from('cotizaciones_service_euros')
            .select(`
                *,
                usuarios_service_euros (nombre_completo, correo, telefono),
                paquetes_service_euros (nombre, descripcion, precio_base)
            `)
            .eq('id', cotizacionId)
            .single();

        if (errCot) throw errCot;

        let itemsParaTabla = [];

        // 2. Comprobar si la cotización viene de un Paquete Preconfigurado o de Ítems Individuales
        if (cotizacion.paquete_id && cotizacion.paquetes_service_euros) {
            // Si es un paquete, mostramos directamente el paquete completo como servicio único unificado
            itemsParaTabla.push({
                nombre: `Paquete: ${cotizacion.paquetes_service_euros.nombre}${cotizacion.paquetes_service_euros.descripcion ? ' - ' + cotizacion.paquetes_service_euros.descripcion : ''}`,
                cantidad: 1,
                precio_unitario: cotizacion.subtotal
            });
        } else {
            // Consultar ítems individuales añadidos a la cotización
            const { data: itemsInd, error: errItems } = await supabaseClient
                .from('cotizacion_items_service_euros')
                .select(`
                    cantidad,
                    precio_unitario,
                    productos_service_euros (nombre)
                `)
                .eq('cotizacion_id', cotizacionId);

            if (errItems) throw errItems;

            if (itemsInd && itemsInd.length > 0) {
                itemsParaTabla = itemsInd.map(item => ({
                    nombre: item.productos_service_euros?.nombre || 'Equipo / Servicio',
                    cantidad: item.cantidad,
                    precio_unitario: item.precio_unitario
                }));
            }
        }

        // Si la lista sigue vacía por alguna razón, agregamos una línea general
        if (itemsParaTabla.length === 0) {
            itemsParaTabla.push({
                nombre: `Servicio de Evento: ${cotizacion.tipo_evento} (${cotizacion.departamento})`,
                cantidad: 1,
                precio_unitario: cotizacion.subtotal
            });
        }

        // 3. Encabezado de la Factura con Logo ajustado a 30 de alto
        const imgLogo = new Image();
        imgLogo.src = 'assets/img/logo Los euros_facturas.png';
        
imgLogo.onload = function() {
    doc.addImage(imgLogo, 'PNG', 14, 10, 35, 30);
    
    // Coordenada X central entre el final del logo (49) y el margen derecho (196) -> 122.5
    const centroX = 122.5;

    doc.setFont("helvetica", "bold");
    doc.setFontSize(15);
    doc.setTextColor(45, 8, 10); // #2d080a
    // Bajamos el título principal a la posición Y = 20 (antes era 18)
    doc.text("LOS EUROS DE BOLIVIA", centroX, 20, { align: 'center' });
    
    doc.setFontSize(9.5);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(100, 100, 100);
    // Bajamos el subtítulo a la posición Y = 27 (antes era 24) para darle más espacio con el título
    doc.text("FACTURA DE COMPRA / SERVICIO - SONIDO EUROS", centroX, 27, { align: 'center' });

    doc.setDrawColor(164, 32, 46); // #a4202e
    doc.setLineWidth(0.5);
    doc.line(14, 44, 196, 44);


            // 4. Información general y del cliente
            doc.setFontSize(9);
            doc.setTextColor(45, 8, 10);
            doc.text(`Factura N°: SE-${String(cotizacion.id).padStart(5, '0')}`, 14, 50);
            doc.text(`Fecha de Emisión: ${new Date(cotizacion.created_at).toLocaleDateString()}`, 130, 50);
            
            doc.text(`Tipo de Evento: ${cotizacion.tipo_evento} (${cotizacion.departamento})`, 14, 56);
            doc.text(`Fecha del Evento: ${cotizacion.fecha_evento} a las ${cotizacion.hora_inicio}`, 130, 56);

            doc.setFont("helvetica", "bold");
            doc.text("Datos del Cliente:", 14, 64);
            doc.setFont("helvetica", "normal");
            doc.text(`Nombre: ${cotizacion.usuarios_service_euros?.nombre_completo || 'N/A'}`, 14, 70);
            doc.text(`Teléfono: ${cotizacion.usuarios_service_euros?.telefono || 'N/A'}`, 120, 70);
            doc.text(`Dirección: ${cotizacion.direccion_exacta || 'No especificada'}`, 14, 76);
            doc.text(`Correo: ${cotizacion.usuarios_service_euros?.correo || 'N/A'}`, 120, 76);

            let startYTable = 84;

            // 5. Mapeo de la tabla
            const tableRows = itemsParaTabla.map((item, index) => {
                const totalItem = item.cantidad * item.precio_unitario;
                return [
                    index + 1,
                    item.nombre,
                    item.cantidad,
                    `Bs. ${parseFloat(item.precio_unitario).toFixed(2)}`,
                    `Bs. ${parseFloat(totalItem).toFixed(2)}`
                ];
            });

            doc.autoTable({
                startY: startYTable,
                head: [['#', 'Descripción de Equipos / Servicios / Paquete', 'Cant.', 'P. Unitario (Bs.)', 'P. Total (Bs.)']],
                body: tableRows,
                headStyles: { fillColor: [164, 32, 46], textColor: [254, 250, 226] },
                bodyStyles: { textColor: [45, 8, 10] },
                theme: 'striped',
                styles: { fontSize: 8.5 }
            });

            // 6. Totales
            const finalY = doc.lastAutoTable.finalY + 10;
            
            doc.setFont("helvetica", "normal");
            doc.setFontSize(9);
            doc.setTextColor(45, 8, 10);
            
            doc.text(`Subtotal:`, 130, finalY);
            doc.text(`Bs. ${parseFloat(cotizacion.subtotal).toFixed(2)}`, 196, finalY, { align: 'right' });

            if (cotizacion.costo_flete > 0) {
                doc.text(`Costo de Flete / Logística:`, 130, finalY + 6);
                doc.text(`Bs. ${parseFloat(cotizacion.costo_flete).toFixed(2)}`, 196, finalY + 6, { align: 'right' });
            }

            const yTotal = cotizacion.costo_flete > 0 ? finalY + 14 : finalY + 8;

            doc.setDrawColor(200, 200, 200);
            doc.line(130, yTotal - 4, 196, yTotal - 4);

            doc.setFont("helvetica", "bold");
            doc.setFontSize(11);
            doc.setTextColor(164, 32, 46);
            doc.text(`TOTAL A PAGAR:`, 130, yTotal);
            doc.text(`Bs. ${parseFloat(cotizacion.precio_estimado_total).toFixed(2)}`, 196, yTotal, { align: 'right' });

            doc.save(`Factura_SonidoEuros_${cotizacion.id}.pdf`);
        };

        if (imgLogo.complete) {
            imgLogo.onload();
        }

    } catch (error) {
        console.error("Error al generar el PDF de la factura:", error);
        mostrarNotificacionFlotante("No se pudo generar la factura en este momento. Intente nuevamente.", "error");
    }
}

// Función auxiliar para notificaciones modernas sin usar alert()
function mostrarNotificacionFlotante(mensaje, tipo = 'error') {
    const alertaAnterior = document.getElementById('notificacion-flotante-euros');
    if (alertaAnterior) alertaAnterior.remove();

    const notificacion = document.createElement('div');
    notificacion.id = 'notificacion-flotante-euros';
    notificacion.className = `fixed bottom-6 right-6 z-50 px-5 py-3 rounded-xl shadow-2xl text-white text-xs font-bold transition-all duration-300 flex items-center space-x-2 ${
        tipo === 'error' ? 'bg-[#a4202e]' : 'bg-green-700'
    }`;
    notificacion.innerHTML = `<span>${mensaje}</span>`;
    
    document.body.appendChild(notificacion);

    setTimeout(() => {
        notificacion.style.opacity = '0';
        setTimeout(() => notificacion.remove(), 300);
    }, 4000);
}