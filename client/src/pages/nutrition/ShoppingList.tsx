import { useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { useMenus } from '@/hooks/useMenus';
import { useSchools } from '@/hooks/useFirestore';
import { useOrgSettings } from '@/hooks/useOrgSettings';
import { assetToDataUrl } from '@/lib/pdfBranding';
import { ShoppingCart, Printer, Leaf, Search, X } from 'lucide-react';
import { toast } from 'sonner';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import type { Menu } from '@/types/nutrition';

// ── Types ─────────────────────────────────────────────────────────────────────

interface ShoppingItem {
  nome: string;
  totalGrams: number;       // soma de (pesoAtual * studentCount * dias)
  familyFarm: boolean;
  menus: string[];          // titulos dos cardapios que usam este item
}

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Conta quantos dias unicos esse cardapio tem com slots preenchidos */
function countMenuDays(menu: Menu): number {
  const days = new Set(menu.slots.filter(s => s.composicao.length > 0).map(s => s.dayLabel));
  return days.size || 5;
}

/** Consolida todos os insumos dos cardapios selecionados em uma lista unica */
function buildShoppingList(menus: Menu[]): ShoppingItem[] {
  const map = new Map<string, ShoppingItem>();

  for (const menu of menus) {
    const students = menu.studentCount || 100;
    const days = countMenuDays(menu);

    for (const slot of menu.slots) {
      for (const insumo of slot.composicao) {
        const key = insumo.nome.toLowerCase().trim();
        // pesoAtual = gramas per capita por refeicao; multiplicamos por alunos e dias
        const grams = insumo.pesoAtual * students * days;

        if (map.has(key)) {
          const existing = map.get(key)!;
          existing.totalGrams += grams;
          if (!existing.menus.includes(menu.title)) existing.menus.push(menu.title);
        } else {
          map.set(key, {
            nome: insumo.nome,
            totalGrams: grams,
            familyFarm: Boolean(insumo.familyFarm),
            menus: [menu.title],
          });
        }
      }
    }
  }

  return Array.from(map.values()).sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'));
}

function fmtKg(grams: number): string {
  if (grams >= 1000) return `${(grams / 1000).toFixed(1)} kg`;
  return `${Math.round(grams)} g`;
}

// ── PDF ───────────────────────────────────────────────────────────────────────

async function generateShoppingPDF(
  items: ShoppingItem[],
  selectedMenus: Menu[],
  orgSettings: { logoUrl?: string; logoDataUrl?: string; municipio?: string; uf?: string; nutritionistName?: string; nutritionistCrn?: string },
) {
  const doc = new jsPDF();
  const pw = doc.internal.pageSize.getWidth();
  const ph = doc.internal.pageSize.getHeight();
  const green: [number, number, number] = [22, 101, 52];

  // Logo
  let logoDataUrl: string | undefined;
  if (orgSettings.logoDataUrl) {
    logoDataUrl = orgSettings.logoDataUrl;
  } else if (orgSettings.logoUrl) {
    try { logoDataUrl = await assetToDataUrl(orgSettings.logoUrl); } catch { /* skip */ }
  }

  // Cabecalho
  doc.setFillColor(...green);
  doc.rect(0, 0, pw, 32, 'F');
  if (logoDataUrl) {
    try { doc.addImage(logoDataUrl, 'PNG', 6, 6, 20, 20); } catch { /* skip */ }
  }
  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(13);
  doc.text('LISTA DE COMPRAS — PNAE', pw / 2, 13, { align: 'center' });
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  const muni = orgSettings.municipio ? `${orgSettings.municipio}/${orgSettings.uf || 'SP'}` : 'Municipio';
  doc.text(`${muni}   |   Gerado em ${new Date().toLocaleDateString('pt-BR')}`, pw / 2, 21, { align: 'center' });
  doc.setTextColor(31, 41, 55);

  let y = 38;

  // Resumo dos cardapios incluidos
  doc.setFontSize(9);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...green);
  doc.text('Cardapios incluidos:', 14, y);
  y += 5;
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(60, 60, 60);
  selectedMenus.forEach(m => {
    const students = m.studentCount || 100;
    doc.text(`- ${m.title} (${m.referenceMonth || 'sem referencia'}, ${students} alunos)`, 16, y);
    y += 4.5;
  });
  y += 4;

  // Totais
  const totalItems = items.length;
  const familyFarmItems = items.filter(i => i.familyFarm).length;
  const familyFarmPct = totalItems > 0 ? Math.round((familyFarmItems / totalItems) * 100) : 0;

  autoTable(doc, {
    startY: y,
    head: [['Alimento / Insumo', 'Agricultura Familiar', 'Quantidade Total', 'Cardapios']],
    body: items.map(item => [
      item.nome,
      item.familyFarm ? 'SIM' : '-',
      fmtKg(item.totalGrams),
      item.menus.join(', '),
    ]),
    theme: 'striped',
    headStyles: { fillColor: green, textColor: 255, fontStyle: 'bold', fontSize: 8 },
    bodyStyles: { fontSize: 8 },
    columnStyles: {
      0: { cellWidth: 70 },
      1: { cellWidth: 30, halign: 'center' },
      2: { cellWidth: 30, halign: 'right' },
      3: { cellWidth: 60 },
    },
    alternateRowStyles: { fillColor: [240, 253, 244] },
    didParseCell: (data) => {
      if (data.section === 'body' && data.column.index === 1 && data.cell.text[0] === 'SIM') {
        data.cell.styles.textColor = [22, 101, 52];
        data.cell.styles.fontStyle = 'bold';
      }
    },
  });

  const lastY = (doc as any).lastAutoTable.finalY + 8;

  // Rodape de totais
  doc.setFontSize(8);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...green);
  doc.text(`Total de itens: ${totalItems}   |   Agricultura familiar: ${familyFarmItems} itens (${familyFarmPct}%)`, 14, lastY);

  // Assinatura
  const sigY = ph - 28;
  doc.setDrawColor(...green);
  doc.setLineWidth(0.3);
  doc.line(14, sigY, 90, sigY);
  doc.setFontSize(8);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(60, 60, 60);
  const nutriName = orgSettings.nutritionistName || 'Nutricionista Responsavel';
  const nutriCrn = orgSettings.nutritionistCrn ? `CRN: ${orgSettings.nutritionistCrn}` : '';
  doc.text(nutriName, 14, sigY + 4);
  if (nutriCrn) doc.text(nutriCrn, 14, sigY + 8);

  // Rodape paginas
  const totalPages = (doc as any).getNumberOfPages();
  for (let p = 1; p <= totalPages; p++) {
    doc.setPage(p);
    doc.setDrawColor(...green);
    doc.setLineWidth(0.3);
    doc.line(10, ph - 12, pw - 10, ph - 12);
    doc.setFontSize(7);
    doc.setTextColor(120, 120, 120);
    doc.text('EduPlate — Sistema de Gestao PNAE', 14, ph - 7);
    doc.text(`Pagina ${p}/${totalPages}`, pw - 14, ph - 7, { align: 'right' });
  }

  doc.save(`Lista_Compras_${new Date().toISOString().split('T')[0]}.pdf`);
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function ShoppingList() {
  const { menus, loading } = useMenus();
  const { schools } = useSchools();
  const { orgSettings } = useOrgSettings();

  const [selectedMenuIds, setSelectedMenuIds] = useState<string[]>([]);
  const [filterMonth, setFilterMonth] = useState<string>('all');
  const [search, setSearch] = useState('');
  const [generating, setGenerating] = useState(false);

  // Meses disponiveis nos cardapios
  const months = useMemo(() => {
    const set = new Set<string>();
    menus.forEach(m => { if (m.referenceMonth) set.add(m.referenceMonth); });
    return Array.from(set).sort().reverse();
  }, [menus]);

  // Cardapios filtrados pelo mes
  const filteredMenus = useMemo(() => {
    if (filterMonth === 'all') return menus;
    return menus.filter(m => m.referenceMonth === filterMonth);
  }, [menus, filterMonth]);

  const selectedMenus = useMemo(
    () => menus.filter(m => selectedMenuIds.includes(m.id)),
    [menus, selectedMenuIds],
  );

  const shoppingItems = useMemo(() => {
    if (selectedMenus.length === 0) return [];
    return buildShoppingList(selectedMenus);
  }, [selectedMenus]);

  const displayedItems = useMemo(() => {
    if (!search.trim()) return shoppingItems;
    const q = search.toLowerCase();
    return shoppingItems.filter(i => i.nome.toLowerCase().includes(q));
  }, [shoppingItems, search]);

  const familyFarmCount = shoppingItems.filter(i => i.familyFarm).length;
  const familyFarmPct = shoppingItems.length > 0
    ? Math.round((familyFarmCount / shoppingItems.length) * 100) : 0;

  function toggleMenu(id: string) {
    setSelectedMenuIds(prev =>
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id],
    );
  }

  function selectAll() {
    setSelectedMenuIds(filteredMenus.map(m => m.id));
  }

  async function handlePrint() {
    if (selectedMenus.length === 0) { toast.error('Selecione pelo menos um cardapio.'); return; }
    if (shoppingItems.length === 0) { toast.error('Nenhum insumo encontrado nos cardapios selecionados.'); return; }
    setGenerating(true);
    try {
      await generateShoppingPDF(shoppingItems, selectedMenus, orgSettings || {});
      toast.success('Lista de compras gerada!');
    } catch (e) {
      toast.error('Erro ao gerar PDF.');
    } finally {
      setGenerating(false);
    }
  }

  return (
    <div className="min-h-screen p-4 md:p-8 max-w-5xl mx-auto space-y-6">
      {/* Cabecalho */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <ShoppingCart className="w-6 h-6 text-green-700" />
            Lista de Compras
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            Consolidação automática dos insumos a partir dos cardápios cadastrados.
          </p>
        </div>
        <Button
          onClick={handlePrint}
          disabled={selectedMenus.length === 0 || generating}
          className="bg-green-700 hover:bg-green-800 text-white gap-2"
        >
          <Printer className="w-4 h-4" />
          {generating ? 'Gerando PDF...' : 'Gerar PDF'}
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Painel esquerdo: seletor de cardapios */}
        <div className="md:col-span-1 space-y-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-gray-700">Selecionar Cardápios</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <Select value={filterMonth} onValueChange={setFilterMonth}>
                <SelectTrigger className="h-9 text-sm">
                  <SelectValue placeholder="Filtrar por mês" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos os meses</SelectItem>
                  {months.map(m => (
                    <SelectItem key={m} value={m}>{m}</SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Button variant="outline" size="sm" className="w-full text-xs" onClick={selectAll}>
                Selecionar todos ({filteredMenus.length})
              </Button>

              {loading ? (
                <p className="text-xs text-gray-400 py-4 text-center">Carregando cardápios...</p>
              ) : filteredMenus.length === 0 ? (
                <p className="text-xs text-gray-400 py-4 text-center">Nenhum cardápio encontrado.</p>
              ) : (
                <div className="space-y-1 max-h-80 overflow-y-auto">
                  {filteredMenus.map(menu => {
                    const selected = selectedMenuIds.includes(menu.id);
                    return (
                      <button
                        key={menu.id}
                        onClick={() => toggleMenu(menu.id)}
                        className={`w-full text-left px-3 py-2 rounded-lg border text-xs transition-colors ${
                          selected
                            ? 'bg-green-50 border-green-400 text-green-800'
                            : 'bg-white border-gray-200 text-gray-700 hover:bg-gray-50'
                        }`}
                      >
                        <p className="font-medium truncate">{menu.title}</p>
                        <p className="text-gray-400 truncate">
                          {menu.referenceMonth || 'sem referência'} · {menu.studentCount || '?'} alunos · {menu.category}
                        </p>
                      </button>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>

          {selectedMenus.length > 0 && shoppingItems.length > 0 && (
            <Card className="bg-green-50 border-green-200">
              <CardContent className="pt-4 space-y-1">
                <p className="text-xs text-green-800 font-medium">Resumo</p>
                <p className="text-xs text-green-700">{shoppingItems.length} itens consolidados</p>
                <p className="text-xs text-green-700 flex items-center gap-1">
                  <Leaf className="w-3 h-3" />
                  {familyFarmCount} da agricultura familiar ({familyFarmPct}%)
                </p>
              </CardContent>
            </Card>
          )}
        </div>

        {/* Painel direito: lista consolidada */}
        <div className="md:col-span-2 space-y-4">
          {selectedMenus.length === 0 ? (
            <Card>
              <CardContent className="py-16 text-center">
                <ShoppingCart className="w-10 h-10 text-gray-300 mx-auto mb-3" />
                <p className="text-gray-500 text-sm font-medium">Selecione cardápios para ver os insumos</p>
                <p className="text-xs text-gray-400 mt-1">
                  As quantidades são calculadas automaticamente com base no número de alunos e dias do cardápio.
                </p>
              </CardContent>
            </Card>
          ) : shoppingItems.length === 0 ? (
            <Card>
              <CardContent className="py-16 text-center">
                <p className="text-gray-500 text-sm">Os cardápios selecionados não possuem insumos cadastrados.</p>
                <p className="text-xs text-gray-400 mt-1">
                  Verifique se os slots dos cardápios têm composição preenchida.
                </p>
              </CardContent>
            </Card>
          ) : (
            <Card>
              <CardHeader className="pb-3">
                <div className="flex items-center gap-3">
                  <div className="relative flex-1">
                    <Search className="w-4 h-4 absolute left-2.5 top-2.5 text-gray-400" />
                    <Input
                      className="pl-8 h-9 text-sm"
                      placeholder="Buscar alimento..."
                      value={search}
                      onChange={e => setSearch(e.target.value)}
                    />
                    {search && (
                      <button onClick={() => setSearch('')} className="absolute right-2.5 top-2.5">
                        <X className="w-4 h-4 text-gray-400" />
                      </button>
                    )}
                  </div>
                  <span className="text-xs text-gray-400 whitespace-nowrap">
                    {displayedItems.length}/{shoppingItems.length} itens
                  </span>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-1">
                  {/* Cabecalho da lista */}
                  <div className="grid grid-cols-12 gap-2 px-3 py-2 text-xs font-medium text-gray-500 border-b">
                    <span className="col-span-5">Alimento / Insumo</span>
                    <span className="col-span-3 text-right">Quantidade</span>
                    <span className="col-span-4">Origem</span>
                  </div>
                  {displayedItems.map((item, idx) => (
                    <div
                      key={idx}
                      className="grid grid-cols-12 gap-2 px-3 py-2 rounded-lg hover:bg-gray-50 text-sm"
                    >
                      <span className="col-span-5 font-medium text-gray-800 truncate">{item.nome}</span>
                      <span className="col-span-3 text-right font-mono text-gray-700">
                        {fmtKg(item.totalGrams)}
                      </span>
                      <span className="col-span-4 flex items-center gap-1">
                        {item.familyFarm && (
                          <Badge className="bg-green-100 text-green-800 text-xs gap-1 border-green-200">
                            <Leaf className="w-3 h-3" /> Familiar
                          </Badge>
                        )}
                      </span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
