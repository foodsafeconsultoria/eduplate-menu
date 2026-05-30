import { useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useFoods } from '@/hooks/useFoods';
import { getFoodSeasonality, seasonLabels } from '@/data/seasonality';
import { Checkbox } from '@/components/ui/checkbox';
import { Check, Pencil, Plus, Search, X } from 'lucide-react';
import { toast } from 'sonner';
import type { Food } from '@/types/nutrition';

type FoodFormState = {
  name: string;
  unit: Food['unit'];
  price: string;
  familyFarm: boolean;
  kcal: string;
  protein: string;
  lipids: string;
  carbohydrates: string;
  fiber: string;
  calcium: string;
  iron: string;
  zinc: string;
  vitaminA: string;
  vitaminC: string;
};

const emptyForm: FoodFormState = {
  name: '',
  unit: 'kg',
  price: '',
  familyFarm: false,
  kcal: '',
  protein: '',
  lipids: '',
  carbohydrates: '',
  fiber: '',
  calcium: '',
  iron: '',
  zinc: '',
  vitaminA: '',
  vitaminC: '',
};

export default function Foods() {
  const { foods, loading, addFood, updateFoodPrice, toggleFamilyFarm } = useFoods();
  const [search, setSearch] = useState('');
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<FoodFormState>(emptyForm);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingPrice, setEditingPrice] = useState('');
  const currentMonth = new Date().getMonth(); // 0=Jan … 11=Dez

  const filteredFoods = useMemo(() => {
    const term = search.toLowerCase().trim();
    if (!term) return foods;

    return foods.filter((food) => food.name.toLowerCase().includes(term));
  }, [foods, search]);

  const startEdit = (food: Food) => {
    setEditingId(food.id);
    setEditingPrice(food.price.toFixed(2));
  };

  const confirmEdit = () => {
    if (!editingId) return;
    updateFoodPrice(editingId, Number(editingPrice) || 0);
    setEditingId(null);
    setEditingPrice('');
    toast.success('Preco atualizado com sucesso.');
  };

  const handleSave = () => {
    if (!form.name.trim()) {
      toast.error('Informe o nome do alimento.');
      return;
    }

    addFood({
      name: form.name,
      unit: form.unit,
      price: Number(form.price) || 0,
      familyFarm: form.familyFarm,
      nutrients: {
        kcal: Number(form.kcal) || 0,
        protein: Number(form.protein) || 0,
        lipids: Number(form.lipids) || 0,
        carbohydrates: Number(form.carbohydrates) || 0,
        fiber: Number(form.fiber) || 0,
        calcium: Number(form.calcium) || 0,
        iron: Number(form.iron) || 0,
        zinc: Number(form.zinc) || 0,
        vitaminA: Number(form.vitaminA) || 0,
        vitaminC: Number(form.vitaminC) || 0,
      },
    });

    setForm(emptyForm);
    setOpen(false);
    toast.success('Alimento cadastrado com sucesso.');
  };

  return (
    <div className="min-h-screen flex-1 p-4 md:p-8">
      <div className="w-full space-y-6">
        <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Alimentos</h1>
            <p className="text-gray-600 mt-2">
              Base nutricional e econômica para fichas técnicas, cardápios e cálculos de custo.
            </p>
          </div>

          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button className="bg-blue-600 hover:bg-blue-700">
                <Plus className="w-4 h-4 mr-2" />
                Novo Alimento
              </Button>
            </DialogTrigger>
            <DialogContent className="w-full max-w-[95vw] sm:max-w-3xl max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>Cadastrar Alimento</DialogTitle>
                <DialogDescription>
                  Inclua alimentos adicionais alem da base inicial para ampliar a composicao do cardapio.
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-4">
                <div className="grid gap-4 md:grid-cols-3">
                  <div className="md:col-span-2">
                    <Label>Nome</Label>
                    <Input
                      value={form.name}
                      onChange={(e) => setForm({ ...form, name: e.target.value })}
                      className="mt-2"
                    />
                  </div>
                  <div>
                    <Label>Unidade</Label>
                    <Select value={form.unit} onValueChange={(value) => setForm({ ...form, unit: value as Food['unit'] })}>
                      <SelectTrigger className="mt-2 w-full">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="kg">Por kg</SelectItem>
                        <SelectItem value="unit">Por unidade</SelectItem>
                        <SelectItem value="liter">Por litro</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                {/* Agricultura Familiar */}
                <div className="flex items-center gap-3 rounded-lg border border-green-200 bg-green-50 px-4 py-3">
                  <Checkbox
                    id="familyFarm"
                    checked={form.familyFarm}
                    onCheckedChange={(checked) => setForm({ ...form, familyFarm: Boolean(checked) })}
                    className="data-[state=checked]:bg-green-700 data-[state=checked]:border-green-700"
                  />
                  <label htmlFor="familyFarm" className="cursor-pointer select-none text-sm font-medium text-green-800">
                    🌱 Oriundo da Agricultura Familiar (AF)
                  </label>
                </div>

                <div className="grid gap-4 md:grid-cols-4">
                  <div>
                    <Label>Kcal</Label>
                    <Input type="number" value={form.kcal} onChange={(e) => setForm({ ...form, kcal: e.target.value })} className="mt-2" />
                  </div>
                  <div>
                    <Label>Proteina (g)</Label>
                    <Input type="number" value={form.protein} onChange={(e) => setForm({ ...form, protein: e.target.value })} className="mt-2" />
                  </div>
                  <div>
                    <Label>Lipideos (g)</Label>
                    <Input type="number" value={form.lipids} onChange={(e) => setForm({ ...form, lipids: e.target.value })} className="mt-2" />
                  </div>
                  <div>
                    <Label>Preco (R$)</Label>
                    <Input type="number" value={form.price} onChange={(e) => setForm({ ...form, price: e.target.value })} className="mt-2" />
                  </div>
                </div>

                <div className="grid gap-4 md:grid-cols-3">
                  <div>
                    <Label>Carboidratos (g)</Label>
                    <Input type="number" value={form.carbohydrates} onChange={(e) => setForm({ ...form, carbohydrates: e.target.value })} className="mt-2" />
                  </div>
                  <div>
                    <Label>Fibras (g)</Label>
                    <Input type="number" value={form.fiber} onChange={(e) => setForm({ ...form, fiber: e.target.value })} className="mt-2" />
                  </div>
                  <div>
                    <Label>Calcio (mg)</Label>
                    <Input type="number" value={form.calcium} onChange={(e) => setForm({ ...form, calcium: e.target.value })} className="mt-2" />
                  </div>
                </div>

                <div className="grid gap-4 md:grid-cols-4">
                  <div>
                    <Label>Ferro (mg)</Label>
                    <Input type="number" value={form.iron} onChange={(e) => setForm({ ...form, iron: e.target.value })} className="mt-2" />
                  </div>
                  <div>
                    <Label>Zinco (mg)</Label>
                    <Input type="number" value={form.zinc} onChange={(e) => setForm({ ...form, zinc: e.target.value })} className="mt-2" />
                  </div>
                  <div>
                    <Label>Vitamina A</Label>
                    <Input type="number" value={form.vitaminA} onChange={(e) => setForm({ ...form, vitaminA: e.target.value })} className="mt-2" />
                  </div>
                  <div>
                    <Label>Vitamina C</Label>
                    <Input type="number" value={form.vitaminC} onChange={(e) => setForm({ ...form, vitaminC: e.target.value })} className="mt-2" />
                  </div>
                </div>

                <div className="flex justify-end gap-3">
                  <Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
                  <Button onClick={handleSave} className="bg-blue-600 hover:bg-blue-700">Salvar Alimento</Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>
        </div>

        <div className="grid gap-4 md:grid-cols-3">
          <Card>
            <CardContent className="p-5">
              <p className="text-sm text-gray-500">Total de alimentos</p>
              <p className="text-3xl font-bold text-gray-900 mt-1">{foods.length}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-5">
              <p className="text-sm text-gray-500">Base inicial TACO</p>
              <p className="text-3xl font-bold text-gray-900 mt-1">{foods.filter((food) => food.source === 'taco').length}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-5">
              <p className="text-sm text-gray-500">Cadastros proprios</p>
              <p className="text-3xl font-bold text-gray-900 mt-1">{foods.filter((food) => food.source === 'custom').length}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-5">
              <p className="text-sm text-gray-500">🌱 Agricultura Familiar</p>
              <p className="text-3xl font-bold text-green-700 mt-1">{foods.filter((food) => food.familyFarm).length}</p>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardContent className="p-4">
            <div className="relative max-w-md">
              <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Buscar alimento..."
                className="pl-9"
              />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Alimento</TableHead>
                  <TableHead className="text-center w-10">AF</TableHead>
                  <TableHead className="text-right">Kcal</TableHead>
                  <TableHead className="text-right">Prot (g)</TableHead>
                  <TableHead className="text-right">Lip (g)</TableHead>
                  <TableHead className="text-right">Carb (g)</TableHead>
                  <TableHead className="text-right">Fibra (g)</TableHead>
                  <TableHead className="text-right">Preco</TableHead>
                  <TableHead className="text-right">Unidade</TableHead>
                  <TableHead className="text-right">Acao</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading && (
                  <TableRow>
                    <TableCell colSpan={10} className="py-10 text-center text-gray-500">
                      Carregando alimentos...
                    </TableCell>
                  </TableRow>
                )}

                {!loading && filteredFoods.map((food) => {
                  const seasonal = getFoodSeasonality(food.name, currentMonth);
                  const seasonInfo = seasonal ? seasonLabels[seasonal.season] : null;
                  return (
                  <TableRow key={food.id}>
                    <TableCell className="font-medium">
                      <div className="flex items-center gap-2">
                        <span>{food.name}</span>
                        {seasonInfo && (
                          <span
                            className={`inline-flex items-center gap-0.5 rounded-full border px-1.5 py-0.5 text-[10px] font-semibold ${seasonInfo.color}`}
                            title={seasonal?.tip || `Em safra agora: ${seasonInfo.label}`}
                          >
                            {seasonInfo.emoji} Safra
                          </span>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="text-center">
                      <button
                        type="button"
                        title={food.familyFarm ? 'Agricultura Familiar — clique para remover' : 'Marcar como Agricultura Familiar'}
                        onClick={() => { toggleFamilyFarm(food.id); toast.success(food.familyFarm ? 'AF removido.' : 'Marcado como Agricultura Familiar.'); }}
                        className={`text-base transition-opacity ${food.familyFarm ? 'opacity-100' : 'opacity-20 hover:opacity-60'}`}
                      >
                        🌱
                      </button>
                    </TableCell>
                    <TableCell className="text-right">{food.nutrients.kcal}</TableCell>
                    <TableCell className="text-right">{food.nutrients.protein.toFixed(1)}</TableCell>
                    <TableCell className="text-right">{food.nutrients.lipids.toFixed(1)}</TableCell>
                    <TableCell className="text-right">{food.nutrients.carbohydrates.toFixed(1)}</TableCell>
                    <TableCell className="text-right">{food.nutrients.fiber.toFixed(1)}</TableCell>
                    <TableCell className="text-right">
                      {editingId === food.id ? (
                        <div className="flex items-center justify-end gap-2">
                          <Input
                            type="number"
                            value={editingPrice}
                            onChange={(e) => setEditingPrice(e.target.value)}
                            className="w-24 h-8 text-right"
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') confirmEdit();
                            }}
                          />
                          <button onClick={confirmEdit} className="text-green-600 hover:text-green-700">
                            <Check className="w-4 h-4" />
                          </button>
                          <button onClick={() => setEditingId(null)} className="text-gray-500 hover:text-gray-700">
                            <X className="w-4 h-4" />
                          </button>
                        </div>
                      ) : (
                        `R$ ${food.price.toFixed(2)}`
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      {food.unit === 'kg' ? 'kg' : food.unit === 'liter' ? 'litro' : 'unidade'}
                    </TableCell>
                    <TableCell className="text-right">
                      {editingId !== food.id && (
                        <button onClick={() => startEdit(food)} className="text-blue-600 hover:text-blue-700">
                          <Pencil className="w-4 h-4" />
                        </button>
                      )}
                    </TableCell>
                  </TableRow>
                  );
                })}

                {!loading && filteredFoods.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={10} className="py-10 text-center text-gray-500">
                      Nenhum alimento encontrado.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
