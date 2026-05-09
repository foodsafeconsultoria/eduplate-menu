import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

export interface PDFOptions {
  title: string;
  subtitle?: string;
  filename: string;
  school?: string;
  date?: Date;
  nutritionist?: string;
}

const COLORS = {
  primary: [59, 130, 246],      // Azul
  secondary: [16, 185, 129],    // Verde
  accent: [245, 158, 11],       // Laranja
  danger: [239, 68, 68],        // Vermelho
  dark: [31, 41, 55],           // Cinza escuro
  light: [243, 244, 246],       // Cinza claro
};

export const createPDF = (options: PDFOptions) => {
  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  let yPosition = 15;

  // Header com logo/marca
  doc.setFillColor(COLORS.primary[0], COLORS.primary[1], COLORS.primary[2]);
  doc.rect(0, 0, pageWidth, 30, 'F');

  // Título
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(18);
  doc.setFont('helvetica', 'bold');
  doc.text('PNAE', 15, 12);

  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.text('Sistema de Gestão de Nutrição Escolar', 15, 20);

  // Título do documento
  yPosition = 40;
  doc.setTextColor(COLORS.dark[0], COLORS.dark[1], COLORS.dark[2]);
  doc.setFontSize(16);
  doc.setFont('helvetica', 'bold');
  doc.text(options.title, pageWidth / 2, yPosition, { align: 'center' });
  yPosition += 10;

  if (options.subtitle) {
    doc.setFontSize(12);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(100, 100, 100);
    doc.text(options.subtitle, pageWidth / 2, yPosition, { align: 'center' });
    yPosition += 8;
  }

  // Informações
  yPosition += 5;
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(COLORS.dark[0], COLORS.dark[1], COLORS.dark[2]);

  if (options.school) {
    doc.text(`Escola: ${options.school}`, 15, yPosition);
    yPosition += 6;
  }

  if (options.nutritionist) {
    doc.text(`Nutricionista: ${options.nutritionist}`, 15, yPosition);
    yPosition += 6;
  }

  if (options.date) {
    doc.text(`Data: ${options.date.toLocaleDateString('pt-BR')}`, 15, yPosition);
    yPosition += 6;
  }

  // Linha separadora
  doc.setDrawColor(COLORS.primary[0], COLORS.primary[1], COLORS.primary[2]);
  doc.setLineWidth(0.5);
  doc.line(15, yPosition, pageWidth - 15, yPosition);

  return { doc, yPosition: yPosition + 8, pageWidth, pageHeight };
};

export const addTableToPDF = (
  doc: jsPDF,
  yPosition: number,
  columns: string[],
  data: any[][],
  pageHeight: number
) => {
  autoTable(doc, {
    startY: yPosition,
    head: [columns],
    body: data,
    theme: 'grid',
    headStyles: {
      fillColor: COLORS.primary as [number, number, number],
      textColor: [255, 255, 255] as [number, number, number],
      fontStyle: 'bold',
      fontSize: 11,
    },
    bodyStyles: {
      textColor: COLORS.dark as [number, number, number],
      fontSize: 10,
    },
    alternateRowStyles: {
      fillColor: COLORS.light as [number, number, number],
    },
    margin: { left: 15, right: 15 },
    didDrawPage: (data) => {
      // Footer
      const pageCount = (doc as any).internal.getNumberOfPages();
      const pageSize = doc.internal.pageSize;
      const pageHeight = pageSize.height;
      const pageWidth = pageSize.width;

      doc.setFontSize(9);
      doc.setTextColor(150, 150, 150);
      doc.text(
        `Página ${data.pageNumber} de ${pageCount}`,
        pageWidth / 2,
        pageHeight - 10,
        { align: 'center' }
      );

      doc.text(
        `Gerado em ${new Date().toLocaleDateString('pt-BR')} às ${new Date().toLocaleTimeString('pt-BR')}`,
        15,
        pageHeight - 10
      );
    },
  });

  return (doc as any).lastAutoTable.finalY + 10;
};

export const addSectionToPDF = (
  doc: jsPDF,
  yPosition: number,
  title: string,
  content: string,
  pageHeight: number
) => {
  if (yPosition > pageHeight - 40) {
    doc.addPage();
    yPosition = 15;
  }

  doc.setFontSize(12);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(COLORS.primary[0], COLORS.primary[1], COLORS.primary[2]);
  doc.text(title, 15, yPosition);
  yPosition += 8;

  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(COLORS.dark[0], COLORS.dark[1], COLORS.dark[2]);

  const lines = doc.splitTextToSize(content, 180);
  doc.text(lines, 15, yPosition);
  yPosition += lines.length * 5 + 5;

  return yPosition;
};

export const addFooterToPDF = (doc: jsPDF) => {
  const pageHeight = doc.internal.pageSize.getHeight();
  const pageWidth = doc.internal.pageSize.getWidth();

  // Linha separadora
  doc.setDrawColor(COLORS.primary[0], COLORS.primary[1], COLORS.primary[2]);
  doc.setLineWidth(0.5);
  doc.line(15, pageHeight - 20, pageWidth - 15, pageHeight - 20);

  // Texto do footer
  doc.setFontSize(8);
  doc.setTextColor(150, 150, 150);
  doc.text(
    'Sistema PNAE - Gestão de Nutrição Escolar',
    pageWidth / 2,
    pageHeight - 10,
    { align: 'center' }
  );
};

export const downloadPDF = (doc: jsPDF, filename: string) => {
  doc.save(filename);
};
