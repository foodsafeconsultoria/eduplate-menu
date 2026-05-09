import jsPDF from 'jspdf';

export const generateCertificate = (schoolName: string, score: number, issuedDate: Date) => {
  const doc = new jsPDF({
    orientation: 'landscape',
    unit: 'mm',
    format: 'a4'
  });

  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();

  // Fundo com gradiente simulado
  doc.setFillColor(240, 248, 255);
  doc.rect(0, 0, pageWidth, pageHeight, 'F');

  // Borda decorativa
  doc.setDrawColor(59, 130, 246);
  doc.setLineWidth(3);
  doc.rect(10, 10, pageWidth - 20, pageHeight - 20);

  // Borda interna
  doc.setDrawColor(16, 185, 129);
  doc.setLineWidth(1);
  doc.rect(15, 15, pageWidth - 30, pageHeight - 30);

  // Título
  doc.setFontSize(36);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(59, 130, 246);
  doc.text('CERTIFICADO DE QUALIDADE', pageWidth / 2, 40, { align: 'center' });

  // Subtítulo
  doc.setFontSize(14);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(100, 100, 100);
  doc.text('Programa Nacional de Alimentação Escolar - PNAE', pageWidth / 2, 52, { align: 'center' });

  // Linha decorativa
  doc.setDrawColor(16, 185, 129);
  doc.setLineWidth(0.5);
  doc.line(30, 58, pageWidth - 30, 58);

  // Texto principal
  doc.setFontSize(12);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(50, 50, 50);
  
  const mainText = 'Certificamos que a unidade escolar';
  doc.text(mainText, pageWidth / 2, 75, { align: 'center' });

  // Nome da escola
  doc.setFontSize(24);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(59, 130, 246);
  const schoolLines = doc.splitTextToSize(schoolName, pageWidth - 60);
  doc.text(schoolLines, pageWidth / 2, 90, { align: 'center' });

  // Texto continuação
  doc.setFontSize(12);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(50, 50, 50);
  
  const lines = [
    'cumpre com as Boas Práticas de Manipulação de Alimentos',
    'conforme os padrões estabelecidos pelo',
    'Programa Nacional de Alimentação Escolar (PNAE)'
  ];
  
  let yPos = 115;
  lines.forEach(line => {
    doc.text(line, pageWidth / 2, yPos, { align: 'center' });
    yPos += 8;
  });

  // Score/Nota
  yPos += 10;
  doc.setFontSize(11);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(100, 100, 100);
  doc.text('Taxa de Conformidade:', pageWidth / 2 - 30, yPos);
  
  doc.setFontSize(16);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(16, 185, 129);
  doc.text(`${score}%`, pageWidth / 2 + 20, yPos);

  // Data
  yPos += 15;
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(100, 100, 100);
  doc.text(
    `Emitido em ${issuedDate.toLocaleDateString('pt-BR')}`,
    pageWidth / 2,
    yPos,
    { align: 'center' }
  );

  // Assinatura
  yPos += 20;
  doc.setLineWidth(0.5);
  doc.setDrawColor(100, 100, 100);
  doc.line(pageWidth / 2 - 30, yPos, pageWidth / 2 + 30, yPos);
  
  yPos += 5;
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(100, 100, 100);
  doc.text('Sistema PNAE - Gestão de Nutrição Escolar', pageWidth / 2, yPos, { align: 'center' });

  // Ícones/Decoração
  doc.setFontSize(24);
  doc.setTextColor(16, 185, 129);
  doc.text('✓', 25, pageHeight - 25);
  doc.text('✓', pageWidth - 30, pageHeight - 25);

  return doc;
};
