import jsPDF from "jspdf";
import html2canvas from "html2canvas";

// html2canvas no sabe nada de "páginas": si capturas el informe entero de una y lo cortas
// a intervalos fijos, el corte cae donde caiga — a mitad de una tarjeta, de un diagrama, de una
// fila de tabla. Por eso capturamos cada sección marcada con [data-pdf-section] por separado y
// solo saltamos de página ENTRE secciones completas (nunca a la mitad de una), salvo que una sola
// sección sea más alta que una página completa, en cuyo caso esa sección puntual sí se corta.
const MARGIN = 28;
const SECTION_GAP = 10;

// thum.io (las capturas de pantalla) no manda headers CORS, así que el navegador no deja leer sus
// píxeles desde un <canvas>. Las saltamos a propósito en el PDF (en la web sí se ven normal).
function isUncapturableImage(el: Element): boolean {
  return el.tagName === "IMG" && (el as HTMLImageElement).src.includes("image.thum.io");
}

function sectionLabel(el: HTMLElement, index: number): string {
  const heading = el.querySelector("h1,h2,h3,[class*='CardTitle'],p");
  return `#${index} "${heading?.textContent?.trim().slice(0, 40) ?? el.tagName}"`;
}

// jsPDF embebe imágenes PNG como píxeles RGB sin comprimir dentro del PDF (no reusa la compresión
// del propio PNG) — un screenshot de UI normal termina pesando varios MB por sección, y un informe
// con ~20 secciones daba un PDF de 60-90MB. JPEG sí comprime de verdad (DCTDecode).
const JPEG_QUALITY = 0.82;
// El ancho útil de una A4 es ~540pt; capturar a escala 2 sobre un contenedor de 768px daba 1536px,
// muy por encima de lo que una A4 puede mostrar (~1240px a 150 DPI) — solo inflaba el archivo.
// A 1.5 se sigue viendo nítido en pantalla y en impresión, con ~44% menos de píxeles.
const CAPTURE_SCALE = 1.5;

function drawImage(pdf: jsPDF, imgData: string, x: number, y: number, w: number, h: number) {
  pdf.addImage(imgData, "JPEG", x, y, w, h);
}

// Pie de página en cada hoja: sin esto el PDF no tiene forma de saber de qué sitio es cada página
// suelta, ni cuántas páginas son en total — algo que se espera de cualquier entregable formal.
function drawFooters(pdf: jsPDF, label: string, pageWidth: number, pageHeight: number) {
  const total = pdf.getNumberOfPages();
  for (let page = 1; page <= total; page++) {
    pdf.setPage(page);
    pdf.setFontSize(8);
    pdf.setTextColor(140);
    // Va dentro del margen inferior, por debajo del área de contenido: nunca lo pisa.
    pdf.text(label, MARGIN, pageHeight - 14);
    pdf.text(`${page} / ${total}`, pageWidth - MARGIN, pageHeight - 14, { align: "right" });
  }
}

export async function exportElementToPdf(
  containerId: string,
  filename: string,
  onProgress?: (current: number, total: number) => void,
  footerLabel?: string,
): Promise<void> {
  const container = document.getElementById(containerId);
  if (!container) throw new Error(`No se encontró el elemento #${containerId}`);

  const hiddenEls = Array.from(container.querySelectorAll<HTMLElement>('[class*="print:hidden"]'));
  const previousDisplay = hiddenEls.map((el) => el.style.display);
  hiddenEls.forEach((el) => {
    el.style.display = "none";
  });

  try {
    const sections = Array.from(container.querySelectorAll<HTMLElement>("[data-pdf-section]"));
    if (sections.length === 0) throw new Error("El informe no tiene secciones marcadas para exportar");

    const pdf = new jsPDF({ unit: "pt", format: "a4" });
    const pageWidth = pdf.internal.pageSize.getWidth();
    const pageHeight = pdf.internal.pageSize.getHeight();
    const usableWidth = pageWidth - MARGIN * 2;
    const usableHeight = pageHeight - MARGIN * 2;

    let cursorY = MARGIN;
    let isFirstDraw = true;
    let skippedSections = 0;

    for (let i = 0; i < sections.length; i++) {
      const section = sections[i];
      onProgress?.(i + 1, sections.length);
      // Todo lo relativo a esta sección (capturar, codificar Y dibujar) va en un único try:
      // si cualquiera de esos pasos falla, saltamos SOLO esta sección y seguimos con el resto,
      // en vez de perder el PDF completo por una imagen o un SVG problemático.
      try {
        const canvas = await html2canvas(section, {
          scale: CAPTURE_SCALE,
          useCORS: true,
          backgroundColor: "#ffffff",
          ignoreElements: isUncapturableImage,
        });
        if (canvas.width === 0 || canvas.height === 0) {
          throw new Error("canvas vacío (0x0)");
        }

        const imgHeight = (canvas.height * usableWidth) / canvas.width;
        const imgData = canvas.toDataURL("image/jpeg", JPEG_QUALITY);

        if (imgHeight > usableHeight) {
          if (!isFirstDraw) pdf.addPage();
          let remaining = imgHeight;
          let offset = 0;
          while (remaining > 0) {
            drawImage(pdf, imgData, MARGIN, MARGIN - offset, usableWidth, imgHeight);
            remaining -= usableHeight;
            offset += usableHeight;
            if (remaining > 0) pdf.addPage();
          }
          cursorY = MARGIN + (imgHeight % usableHeight || usableHeight) + SECTION_GAP;
        } else {
          if (!isFirstDraw && cursorY + imgHeight > pageHeight - MARGIN) {
            pdf.addPage();
            cursorY = MARGIN;
          }
          drawImage(pdf, imgData, MARGIN, cursorY, usableWidth, imgHeight);
          cursorY += imgHeight + SECTION_GAP;
        }
        isFirstDraw = false;
      } catch (err) {
        console.error(`exportElementToPdf: se omite la sección ${sectionLabel(section, i)}`, err);
        skippedSections++;
      }
    }

    if (skippedSections === sections.length) {
      throw new Error("No se pudo capturar ninguna sección del informe");
    }

    if (footerLabel) drawFooters(pdf, footerLabel, pageWidth, pageHeight);

    pdf.save(filename);
  } finally {
    hiddenEls.forEach((el, i) => {
      el.style.display = previousDisplay[i];
    });
  }
}
