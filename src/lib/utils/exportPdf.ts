import html2canvas from "html2canvas";
import jsPDF from "jspdf";

/**
 * Captures an HTML element by its ID and triggers a PDF download.
 *
 * @param elementId The DOM ID of the container you want to export.
 * @param filename The desired output filename without the .pdf extension.
 */
export async function exportToPdf(elementId: string, filename: string): Promise<void> {
    const element = document.getElementById(elementId);
    if (!element) {
        console.error(`Element with id ${elementId} not found.`);
        return;
    }

    try {
        // We add a temporary class to potentially restyle for print (e.g. remove export buttons)
        element.classList.add("pdf-exporting");

        const canvas = await html2canvas(element, {
            scale: 2, // 2x scale adds better resolution
            useCORS: true, // For external images
            logging: false, // Prevents console spam
        });

        element.classList.remove("pdf-exporting");

        const imgData = canvas.toDataURL("image/png");

        const pdf = new jsPDF({
            orientation: "portrait",
            unit: "px",
            format: "a4",
        });

        const pdfWidth = pdf.internal.pageSize.getWidth();
        const pdfHeight = (canvas.height * pdfWidth) / canvas.width;

        pdf.addImage(imgData, "PNG", 0, 0, pdfWidth, pdfHeight);
        pdf.save(`${filename}.pdf`);
    } catch (error) {
        element.classList.remove("pdf-exporting");
        console.error("Error generating PDF:", error);
        throw error;
    }
}
