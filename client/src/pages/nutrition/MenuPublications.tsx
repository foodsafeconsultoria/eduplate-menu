import { useMemo, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useMenus } from '@/hooks/useMenus';
import { useSchools } from '@/hooks/useFirestore';
import { CalendarDays, Globe, School } from 'lucide-react';
import { format } from 'date-fns';

const categories = ['all', 'Creche', 'Fundamental 1', 'Fundamental 2', 'Medio'] as const;

export default function MenuPublications() {
  const { menus, loading } = useMenus();
  const { schools } = useSchools();
  const [referenceMonth, setReferenceMonth] = useState('');
  const [selectedSchoolId, setSelectedSchoolId] = useState('all');
  const [selectedCategory, setSelectedCategory] = useState<(typeof categories)[number]>('all');

  const schoolMap = useMemo(() => new Map(schools.map((school) => [school.id, school.name])), [schools]);

  const publishedMenus = useMemo(() => {
    return menus
      .filter((menu) => menu.status === 'published')
      .filter((menu) => {
        const schoolIds = menu.schoolIds || [];
        if (referenceMonth && !menu.referenceMonth.toLowerCase().includes(referenceMonth.toLowerCase())) return false;
        if (selectedCategory !== 'all' && menu.category !== selectedCategory) return false;
        if (selectedSchoolId === 'all') return true;
        if (schoolIds.length === 0) return true;
        return schoolIds.includes(selectedSchoolId);
      })
      .sort((a, b) => {
        const toMs = (v: unknown): number => {
          if (!v) return 0;
          if (typeof (v as any).toDate === 'function') return (v as any).toDate().getTime();
          if (v instanceof Date) return v.getTime();
          return 0;
        };
        return toMs(b.publishedAt) - toMs(a.publishedAt);
      });
  }, [menus, referenceMonth, selectedCategory, selectedSchoolId]);

  return (
    <div className="min-h-screen flex-1 bg-gray-50 p-4 md:p-8">
      <div className="mx-auto max-w-7xl space-y-6">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Publicações de Cardápio</h1>
          <p className="mt-2 text-gray-600">
            Consulta operacional dos cardápios publicados por período, categoria e unidade.
          </p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Filtros</CardTitle>
            <CardDescription>Use estes filtros para localizar rapidamente o cardapio valido para cada escola.</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4 md:grid-cols-3">
            <div>
              <Label>Mes de referencia</Label>
              <Input
                value={referenceMonth}
                onChange={(e) => setReferenceMonth(e.target.value)}
                className="mt-2"
                placeholder="Ex.: Abril 2026"
              />
            </div>
            <div>
              <Label>Escola</Label>
              <Select value={selectedSchoolId} onValueChange={setSelectedSchoolId}>
                <SelectTrigger className="mt-2 w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas as escolas</SelectItem>
                  {schools.map((school) => (
                    <SelectItem key={school.id} value={school.id}>
                      {school.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Categoria</Label>
              <Select value={selectedCategory} onValueChange={(value) => setSelectedCategory(value as (typeof categories)[number])}>
                <SelectTrigger className="mt-2 w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas as categorias</SelectItem>
                  {categories
                    .filter((category) => category !== 'all')
                    .map((category) => (
                      <SelectItem key={category} value={category}>
                        {category}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        {loading ? (
          <Card>
            <CardContent className="py-16 text-center text-gray-500">Carregando publicacoes...</CardContent>
          </Card>
        ) : publishedMenus.length === 0 ? (
          <Card>
            <CardContent className="py-16 text-center">
              <CalendarDays className="mx-auto mb-4 h-12 w-12 text-gray-300" />
              <p className="font-medium text-gray-600">Nenhum cardapio publicado encontrado.</p>
              <p className="mt-2 text-sm text-gray-500">
                Ajuste os filtros ou publique um cardapio no fluxo de planejamento.
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            {publishedMenus.map((menu) => (
              <Card key={menu.id} className="border-blue-200 shadow-sm">
                <CardHeader>
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <CardTitle>{menu.title}</CardTitle>
                      <CardDescription>
                        {menu.category} - {menu.referenceMonth || 'Sem referencia'}
                      </CardDescription>
                    </div>
                    <span className="rounded-full border border-blue-200 bg-blue-100 px-3 py-1 text-xs font-medium text-blue-800">
                      Publicado
                    </span>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4 text-sm">
                  <div className="grid gap-3 md:grid-cols-2">
                    <div className="rounded-lg border bg-white p-3">
                      <p className="text-xs uppercase text-gray-500">Escopo</p>
                      <div className="mt-2 flex items-start gap-2 text-gray-800">
                        {(menu.schoolIds || []).length > 0 ? <School className="mt-0.5 h-4 w-4 text-blue-600" /> : <Globe className="mt-0.5 h-4 w-4 text-blue-600" />}
                        <p>
                          {(menu.schoolIds || []).length > 0
                            ? (menu.schoolIds || []).map((id) => schoolMap.get(id) || id).join(', ')
                            : 'Toda a rede'}
                        </p>
                      </div>
                    </div>
                    <div className="rounded-lg border bg-white p-3">
                      <p className="text-xs uppercase text-gray-500">Publicacao</p>
                      <p className="mt-2 text-gray-800">
                        {menu.publishedAt ? format(menu.publishedAt, 'dd/MM/yyyy HH:mm') : 'Sem data registrada'}
                      </p>
                      <p className="mt-1 text-gray-500">Aprovador: {menu.approverName || 'nao informado'}</p>
                    </div>
                  </div>

                  <div className="grid gap-3 md:grid-cols-3">
                    <div className="rounded-lg border bg-slate-50 p-3">
                      <p className="text-xs uppercase text-gray-500">Kcal media</p>
                      <p className="mt-2 text-xl font-semibold text-gray-900">{menu.averageKcal.toFixed(0)}</p>
                    </div>
                    <div className="rounded-lg border bg-slate-50 p-3">
                      <p className="text-xs uppercase text-gray-500">Proteina media</p>
                      <p className="mt-2 text-xl font-semibold text-gray-900">{menu.averageProtein.toFixed(1)} g</p>
                    </div>
                    <div className="rounded-lg border bg-slate-50 p-3">
                      <p className="text-xs uppercase text-gray-500">Agricultura familiar</p>
                      <p className={`mt-2 text-xl font-semibold ${menu.familyFarmShare >= 45 ? 'text-green-700' : 'text-amber-700'}`}>
                        {menu.familyFarmShare.toFixed(0)}%
                      </p>
                    </div>
                  </div>

                  <div className="rounded-lg border bg-white p-3">
                    <p className="text-xs uppercase text-gray-500">Resumo operacional</p>
                    <p className="mt-2 text-gray-700">{menu.items.length} itens planejados para a semana.</p>
                    <p className="mt-1 text-gray-700">Responsavel tecnico: {menu.responsibleName}</p>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
