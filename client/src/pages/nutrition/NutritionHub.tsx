import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Link } from 'wouter';
import { Apple, BookOpen, ClipboardMinus, Factory, ShieldAlert, ShoppingCart } from 'lucide-react';

const moduleCards = [
  {
    title: 'Alimentos',
    description: 'Base padronizada de alimentos, composicao nutricional, precos e origem.',
    icon: Apple,
    href: '/nutrition/foods',
  },
  {
    title: 'Fichas Tecnicas',
    description: 'Preparo padronizado com ingredientes, rendimento, custo e nutrientes por porcao.',
    icon: ClipboardMinus,
    href: '/nutrition/recipes',
  },
  {
    title: 'Cardápios',
    description: 'Planejamento alimentar por categoria, periodo, escola e conformidade PNAE.',
    icon: BookOpen,
    href: '/nutrition/menus',
  },
  {
    title: 'Publicações',
    description: 'Consulta rápida dos cardápios publicados por escola, período e categoria.',
    icon: BookOpen,
    href: '/nutrition/publications',
  },
  {
    title: 'Dietas Especiais',
    description: 'Controle de restricoes alimentares com rastreabilidade por aluno e unidade.',
    icon: ShieldAlert,
    href: '/nutrition/special-diets',
  },
  {
    title: 'Produção',
    description: 'Acompanhamento da execucao diaria, sobras e indicadores operacionais.',
    icon: Factory,
    href: '/nutrition/production',
  },
  {
    title: 'Lista de Compras',
    description: 'Consolidação automática dos insumos por cardápio, com quantidades por número de alunos e PDF imprimível.',
    icon: ShoppingCart,
    href: '/nutrition/shopping-list',
  },
];

export default function NutritionHub() {
  return (
    <div className="min-h-screen flex-1 p-4 md:p-8">
      <div className="w-full space-y-8">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Alimentacao Escolar</h1>
          <p className="text-gray-600 mt-2">
            Novo módulo estruturado para centralizar cardápios, fichas, dietas, produção e conformidade PNAE.
          </p>
        </div>

        <Card className="border-blue-200 bg-blue-50">
          <CardHeader>
            <CardTitle>Fase atual da fusao</CardTitle>
            <CardDescription>
              Estrutura inicial criada no sistema base. O próximo passo será migrar a lógica real do app de cardápios para estas áreas.
            </CardDescription>
          </CardHeader>
        </Card>

        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
          {moduleCards.map((card) => (
            <Link key={card.title} href={card.href || '/nutrition'}>
              <Card className="cursor-pointer hover:shadow-md transition-shadow">
                <CardHeader>
                  <div className="flex items-center gap-3">
                    <div className="w-11 h-11 rounded-xl bg-blue-100 text-blue-700 flex items-center justify-center">
                      <card.icon className="w-5 h-5" />
                    </div>
                    <CardTitle className="text-lg">{card.title}</CardTitle>
                  </div>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-gray-600">{card.description}</p>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
