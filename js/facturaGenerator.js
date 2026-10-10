// js/facturaGenerator.js

async function generarFacturaPDF(cotizacionId) {
    try {
        if (cotizacionId && typeof cotizacionId === 'object' && cotizacionId.id) {
            cotizacionId = cotizacionId.id;
        }

        if (!cotizacionId || typeof cotizacionId === 'object') {
            throw new Error(`ID de cotización inválido recibido: ${JSON.stringify(cotizacionId)}.`);
        }

        const { jsPDF } = window.jspdf;
        if (!jsPDF) {
            throw new Error("jsPDF no está cargado en el objeto global window.");
        }
        const doc = new jsPDF();

        // 1. Obtener datos de Supabase
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
        if (!cotizacion) {
            throw new Error(`No se encontró la cotización con ID: ${cotizacionId}`);
        }

        let itemsParaTabla = [];

        if (cotizacion.paquete_id && cotizacion.paquetes_service_euros) {
            itemsParaTabla.push({
                nombre: `Paquete: ${cotizacion.paquetes_service_euros.nombre}${cotizacion.paquetes_service_euros.descripcion ? ' - ' + cotizacion.paquetes_service_euros.descripcion : ''}`,
                cantidad: 1,
                precio_unitario: cotizacion.subtotal
            });
        } else {
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

        if (itemsParaTabla.length === 0) {
            itemsParaTabla.push({
                nombre: `Servicio de Evento: ${cotizacion.tipo_evento} (${cotizacion.departamento})`,
                cantidad: 1,
                precio_unitario: cotizacion.subtotal
            });
        }

        // Construcción del documento PDF
        const construirPDF = (imgData) => {
            if (imgData) {
                doc.addImage(imgData, 'PNG', 14, 10, 35, 30);
            }

            const centroX = 122.5;

            // Encabezado con color oscuro corporativo (#12192a -> RGB 18, 25, 42)
            doc.setFont("helvetica", "bold");
            doc.setFontSize(15);
            doc.setTextColor(18, 25, 42); 
            doc.text("VIRTUAL STUDIO BOLIVIA", centroX, 20, { align: 'center' });

            doc.setFontSize(9.5);
            doc.setFont("helvetica", "normal");
            doc.setTextColor(100, 100, 100);
            doc.text("FACTURA DE COMPRA / SERVICIO - VIRTUAL STUDIO", centroX, 27, { align: 'center' });

            // Línea divisoria en cyan (#00e4fb -> RGB 0, 228, 251)
            doc.setDrawColor(0, 228, 251); 
            doc.setLineWidth(0.8);
            doc.line(14, 44, 196, 44);

            doc.setFontSize(9);
            doc.setTextColor(18, 25, 42);
            doc.text(`Factura N°: VS-${String(cotizacion.id).padStart(5, '0')}`, 14, 50);
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

            if (typeof doc.autoTable !== 'function') {
                throw new Error("El plugin autoTable de jsPDF no está disponible.");
            }

            doc.autoTable({
                startY: startYTable,
                head: [['#', 'Descripción de Equipos / Servicios / Paquete', 'Cant.', 'P. Unitario (Bs.)', 'P. Total (Bs.)']],
                body: tableRows,
                headStyles: { fillColor: [18, 25, 42], textColor: [0, 228, 251] }, // Fondo oscuro con letras cyan
                bodyStyles: { textColor: [18, 25, 42] },
                theme: 'striped',
                styles: { fontSize: 8.5 }
            });

            const finalY = doc.lastAutoTable.finalY + 10;

            doc.setFont("helvetica", "normal");
            doc.setFontSize(9);
            doc.setTextColor(18, 25, 42);

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
            doc.setTextColor(18, 25, 42);
            doc.text(`TOTAL A PAGAR:`, 130, yTotal);
            doc.text(`Bs. ${parseFloat(cotizacion.precio_estimado_total).toFixed(2)}`, 196, yTotal, { align: 'right' });

            doc.save(`Factura_VirtualStudio_${cotizacion.id}.pdf`);
        };

        const imgLogo = new Image();
        imgLogo.src = 'assets/img/logo_visual.png'; 

        imgLogo.onload = function() {
            construirPDF(imgLogo);
        };

        imgLogo.onerror = function() {
            console.warn("No se pudo cargar el logo, generando PDF sin logotipo.");
            construirPDF(null); 
        };

        if (imgLogo.complete && imgLogo.naturalWidth !== 0) {
            construirPDF(imgLogo);
        }

    } catch (error) {
        console.error("Error al generar el PDF de la factura:", error);
        mostrarNotificacionFlotante("No se pudo generar el comprobante en este momento. Intente nuevamente.", "error");
    }
}

// Notificación flotante adaptada al estilo de Virtual Studio
function mostrarNotificacionFlotante(mensaje, tipo = 'error') {
    const alertaAnterior = document.getElementById('notificacion-flotante-euros');
    if (alertaAnterior) alertaAnterior.remove();

    const notificacion = document.createElement('div');
    notificacion.id = 'notificacion-flotante-euros';
    notificacion.className = `fixed bottom-6 right-6 z-50 px-5 py-3 rounded-xl shadow-2xl text-xs font-bold transition-all duration-300 flex items-center space-x-2 border ${
        tipo === 'error' ? 'bg-[#12192a] text-[#00e4fb] border-[#00e4fb]/40' : 'bg-emerald-900 text-emerald-200 border-emerald-500/40'
    }`;
    notificacion.innerHTML = `<span>${mensaje}</span>`;

    document.body.appendChild(notificacion);

    setTimeout(() => {
        notificacion.style.opacity = '0';
        setTimeout(() => notificacion.remove(), 300);
    }, 4000);
}