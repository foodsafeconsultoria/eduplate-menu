import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import type { Recipe } from '@/types/nutrition';
import { addPdfHeader } from '@/lib/pdfBranding';
import { FNDE_MEAL_REFERENCE, FNDE_REFERENCE_NOTE, adequacyPercent } from '@/data/fndeReference';

/**
 * Geração de PDF de Ficha Técnica de Preparo — compartilhado entre o módulo
 * de Fichas Técnicas e o "Pacote do Cardápio" (cardápio + fichas relacionadas).
 */
export function addFooterAllPages(doc: jsPDF, signerLabel = 'Nutricionista RT — PNAE'): void {
  const pw = doc.internal.pageSize.getWidth();
  const ph = doc.internal.pageSize.getHeight();
  const totalPages = (doc as any).getNumberOfPages();
  for (let p = 1; p <= totalPages; p++) {
    doc.setPage(p);
    doc.setDrawColor(22, 101, 52);
    doc.setLineWidth(0.3);
    doc.line(10, ph - 12, pw - 10, ph - 12);
    doc.setFontSize(7);
    doc.setTextColor(100, 100, 100);
    doc.text(signerLabel, 15, ph - 7);
    doc.text(`Pág. ${p}/${totalPages}`, pw - 15, ph - 7, { align: 'right' });
  }
}

// ── helper: escreve o conteúdo de UMA receita na página ativa do doc ─────────
export async function addRecipeToDoc(doc: jsPDF, recipe: Recipe): Promise<void> {
  const pw = doc.internal.pageSize.getWidth();
  const ph = doc.internal.pageSize.getHeight();

  let y = await addPdfHeader(doc, {
    title: 'FICHA TÉCNICA DE PREPARO',
    subtitle: 'PNAE — Gestão de Nutrição Escolar',
  });

  // Recipe name + classification
  doc.setTextColor(22, 101, 52);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(16);
  doc.text(recipe.displayName || recipe.name, pw / 2, y, { align: 'center' });
  y += 7;
  if (recipe.displayName && recipe.displayName !== recipe.name) {
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(80, 80, 80);
    doc.text(recipe.name, pw / 2, y, { align: 'center' });
    y += 6;
  }

  // Meta info table
  const metaRows = [
    ['Classificação', recipe.classification, 'Refeição', recipe.recommendedMeal || '—'],
    ['Nº de Porções', String(recipe.servings), 'Tempo de Preparo', recipe.prepTime || '—'],
    ['Rendimento Total', `${recipe.yieldTotal?.toFixed(3) || '—'} kg`, 'Rendimento Líquido', `${recipe.yieldPercentage.toFixed(1)}%`],
    ['Peso Bruto Total', `${recipe.totalGrossWeight.toFixed(3)} kg`, 'Peso Líquido Total', `${recipe.totalNetWeight.toFixed(3)} kg`],
    ['Per Capita', `${recipe.perCapita.toFixed(3)} kg`, 'Custo por Porção', `R$ ${recipe.costPerServing.toFixed(2)}`],
    ['Medida Caseira', recipe.medidaCaseira || '—', 'Agricultura Familiar', recipe.usesFamilyFarm ? 'Sim' : 'Não'],
    ['Alérgenos', recipe.allergens.length > 0 ? recipe.allergens.join(', ') : 'Nenhum', '', ''],
  ];

  autoTable(doc, {
    startY: y + 4,
    body: metaRows,
    theme: 'grid',
    styles: { fontSize: 8, cellPadding: 2.5 },
    columnStyles: {
      0: { fontStyle: 'bold', fillColor: [240, 253, 244], cellWidth: 40 },
      1: { cellWidth: 55 },
      2: { fontStyle: 'bold', fillColor: [240, 253, 244], cellWidth: 40 },
      3: { cellWidth: 55 },
    },
  });
  y = (doc as any).lastAutoTable.finalY + 8;

  // Ingredients
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.setTextColor(22, 101, 52);
  doc.text('INGREDIENTES', 15, y);
  y += 3;

  const ingRows = recipe.ingredients.map(ing => [
    ing.foodName,
    `${ing.grossWeight.toFixed(3)} kg`,
    `${ing.netWeight.toFixed(3)} kg`,
    ing.correctionFactor > 0 ? ing.correctionFactor.toFixed(2) : '—',
    `R$ ${ing.estimatedCost.toFixed(2)}`,
  ]);

  autoTable(doc, {
    startY: y,
    head: [['Ingrediente', 'Peso Bruto (kg)', 'Peso Líquido (kg)', 'F.C.', 'Custo']],
    body: ingRows,
    theme: 'striped',
    headStyles: { fillColor: [22, 101, 52], textColor: 255, fontSize: 8, fontStyle: 'bold' },
    bodyStyles: { fontSize: 8 },
    foot: [['Total', `${recipe.totalGrossWeight.toFixed(3)} kg`, `${recipe.totalNetWeight.toFixed(3)} kg`, '', `R$ ${recipe.costTotal.toFixed(2)}`]],
    footStyles: { fillColor: [240, 253, 244], fontStyle: 'bold', fontSize: 8 },
  });
  y = (doc as any).lastAutoTable.finalY + 8;

  // Nutrients
  if (y > ph - 60) { doc.addPage(); y = 15; }
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.setTextColor(22, 101, 52);
  doc.text('INFORMAÇÃO NUTRICIONAL (por porção)', 15, y);
  y += 3;

  const n = recipe.nutrientsPerServing;
  const nutRows = [
    ['Energia', `${n.kcal.toFixed(0)} kcal`, 'Proteínas', `${n.protein.toFixed(1)} g`],
    ['Lipídeos', `${n.lipids.toFixed(1)} g`, 'Carboidratos', `${n.carbohydrates.toFixed(1)} g`],
    ['Fibras', `${n.fiber.toFixed(1)} g`, 'Cálcio', `${n.calcium.toFixed(1)} mg`],
    ['Ferro', `${n.iron.toFixed(1)} mg`, 'Zinco', `${n.zinc.toFixed(1)} mg`],
    ['Vitamina A', `${n.vitaminA.toFixed(0)} µg`, 'Vitamina C', `${n.vitaminC.toFixed(1)} mg`],
  ];

  autoTable(doc, {
    startY: y,
    body: nutRows,
    theme: 'grid',
    styles: { fontSize: 8, cellPadding: 2.5 },
    columnStyles: {
      0: { fontStyle: 'bold', fillColor: [240, 253, 244], cellWidth: 40 },
      1: { cellWidth: 55 },
      2: { fontStyle: 'bold', fillColor: [240, 253, 244], cellWidth: 40 },
      3: { cellWidth: 55 },
    },
  });
  y = (doc as any).lastAutoTable.finalY + 8;

  // Adequação à referência PNAE (por porção)
  if (y > ph - 50) { doc.addPage(); y = 15; }
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.setTextColor(22, 101, 52);
  doc.text('ADEQUAÇÃO NUTRICIONAL (% da referência por refeição)', 15, y);
  y += 3;
  const adqRows = FNDE_MEAL_REFERENCE.map((it) => {
    const perServ = (n as any)[it.key] as number;
    const pct = adequacyPercent(perServ ?? 0, it.ref);
    return [
      it.label,
      `${(perServ ?? 0).toFixed(it.dec)} ${it.unit}`,
      `${it.ref} ${it.unit}`,
      `${pct}%`,
    ];
  });
  autoTable(doc, {
    startY: y,
    head: [['Nutriente', 'Por porção', 'Referência', 'Adequação']],
    body: adqRows,
    theme: 'striped',
    headStyles: { fillColor: [22, 101, 52], textColor: 255, fontSize: 8, fontStyle: 'bold' },
    bodyStyles: { fontSize: 8 },
    columnStyles: { 3: { fontStyle: 'bold', halign: 'right' } },
  });
  y = (doc as any).lastAutoTable.finalY + 4;
  doc.setFont('helvetica', 'italic');
  doc.setFontSize(6.5);
  doc.setTextColor(120, 120, 120);
  const refNote = doc.splitTextToSize(FNDE_REFERENCE_NOTE, pw - 30);
  doc.text(refNote, 15, y);
  y += refNote.length * 3 + 5;

  // Helper: renders wrapped text line-by-line, adding new pages as needed.
  // Returns the final Y after the last line.
  const lineH    = 5;           // line height in mm for fontSize 9
  const marginB  = 20;          // bottom margin — keep above footer
  const renderTextBlock = (lines: string[]): void => {
    for (const line of lines) {
      if (y > ph - marginB) {
        doc.addPage();
        y = 15;
      }
      doc.text(line, 15, y);
      y += lineH;
    }
  };

  // Preparation method
  if (recipe.preparationMethod) {
    if (y > ph - marginB) { doc.addPage(); y = 15; }
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.setTextColor(22, 101, 52);
    doc.text('MODO DE PREPARO', 15, y);
    y += 7;
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.setTextColor(40, 40, 40);
    const prepLines = doc.splitTextToSize(recipe.preparationMethod, pw - 30);
    renderTextBlock(prepLines);
    y += 4;
  }

  // Operational notes
  if (recipe.operationalNotes) {
    if (y > ph - marginB) { doc.addPage(); y = 15; }
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.setTextColor(22, 101, 52);
    doc.text('OBSERVAÇÕES OPERACIONAIS', 15, y);
    y += 6;
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(80, 80, 80);
    const noteLines = doc.splitTextToSize(recipe.operationalNotes, pw - 30);
    renderTextBlock(noteLines);
  }

}  // end addRecipeToDoc
