# Sistema de Gestão PNAE

Sistema web completo para gestão de Nutrição Escolar (PNAE) com funcionalidades de fiscalização, gestão de EPIs, cronograma de visitas e relatórios gráficos.

## 🎯 Funcionalidades Principais

### 1. **Dashboard**
- Visão geral do sistema
- Gráficos de conformidade geral
- Estatísticas de visitas realizadas
- EPIs entregues no mês

### 2. **Fiscalização (Checklist)**
- Checklist completo baseado no documento oficial da Prefeitura
- 13 seções de verificação:
  - Procedimentos de Manipulação
  - Uniformização
  - Visitantes
  - Estoque
  - Geladeira
  - Freezer
  - Cozinha
  - Cardápio
  - Distribuição
  - Controle de Pragas
  - Potabilidade da Água
  - Estrutura Física
  - Executores da Alimentação
- Campo obrigatório de observação quando resposta é "NÃO"
- Cálculo automático de taxa de conformidade
- Geração de PDF com relatório completo

### 3. **Gestão de EPIs**
- Registro de entrega de 11 tipos de EPIs:
  - Luva de Malha de Aço
  - Luva Nitrílico
  - Bota PVC Branca
  - Calçado de Segurança (Borracha)
  - Avental PVC
  - Avental Térmico
  - Protetor Auricular
  - Respirador PFF
  - Luva Térmica
  - Touca
  - Óculos de Segurança
- Assinatura digital da funcionária
- Relatórios com histórico de entregas
- Exportação em PDF

### 4. **Cronograma de Visitas**
- Visualização em calendário (mensal)
- Visualização em lista
- Agendamento de novas visitas
- Filtro por nutricionista
- Exportação em PDF
- Status de visita (Pendente, Concluída, Cancelada)

### 5. **Cadastro de Escolas**
- CRUD completo de escolas
- Lista inicial de 13 escolas pré-cadastradas
- Adição de novas escolas
- Remoção de escolas

### 6. **Relatórios Gráficos**
- Conformidade por escola
- Distribuição de conformidade
- Inspeções por mês
- Estatísticas de EPIs
- Gráficos interativos com Recharts

### 7. **Autenticação**
- Login e registro de usuários
- Diferentes níveis de acesso (Admin, Nutricionista, Visualizador)
- Persistência de sessão
- Logout seguro

## 🚀 Tecnologias Utilizadas

- **Frontend**: React 19 + TypeScript
- **Styling**: Tailwind CSS 4
- **Roteamento**: Wouter
- **Backend/Database**: Firebase (Firestore, Auth, Storage)
- **Gráficos**: Recharts
- **PDF**: jsPDF + jsPDF-AutoTable
- **Assinatura Digital**: react-signature-canvas
- **UI Components**: shadcn/ui
- **Ícones**: Lucide React
- **Data**: date-fns

## 📋 Pré-requisitos

- Node.js 18+
- npm ou pnpm
- Conta Firebase

## 🔧 Instalação

1. **Clone ou extraia o projeto**
```bash
cd sistema-pnae
```

2. **Instale as dependências**
```bash
pnpm install
```

3. **Configure o Firebase**
   - Siga as instruções em `FIREBASE_SETUP.md`
   - Atualize o arquivo `client/src/lib/firebase.ts` com suas credenciais

4. **Inicie o servidor de desenvolvimento**
```bash
pnpm dev
```

5. **Acesse a aplicação**
   - Abra `http://localhost:3000` no navegador

## 📱 Responsividade

O sistema é totalmente responsivo e funciona perfeitamente em:
- **Desktop**: Navegação completa com sidebar
- **Tablet**: Interface adaptada com menu colapsável
- **Mobile**: Navegação otimizada com menu mobile

## 🔐 Segurança

- Autenticação com Firebase Auth
- Regras de segurança no Firestore
- Dados criptografados em trânsito (HTTPS)
- Senhas hasheadas pelo Firebase

## 📊 Estrutura de Dados

### Collections Firestore

#### `users`
```
{
  email: string
  displayName: string
  role: 'admin' | 'nutritionist' | 'viewer'
  createdAt: timestamp
}
```

#### `schools`
```
{
  name: string
  createdAt: timestamp
  updatedAt: timestamp
}
```

#### `inspections`
```
{
  schoolId: string
  schoolName: string
  director: string
  regularStudents: number
  integralStudents: number
  inspectionDate: timestamp
  inspectionTime: string
  nutritionist: string
  manipulationProcedures: ChecklistItem[]
  uniformization: ChecklistItem[]
  ... (outras seções)
  overallScore: number
  visitObjective: string
  guidelines: string
  createdAt: timestamp
  createdBy: string
}
```

#### `epis`
```
{
  schoolId: string
  schoolName: string
  employeeName: string
  deliveryDate: timestamp
  items: {
    luvaMalhaAco: boolean
    luvaNitrilo: boolean
    ... (outros itens)
  }
  signature: string (base64)
  createdAt: timestamp
  createdBy: string
}
```

#### `schedules`
```
{
  schoolId: string
  schoolName: string
  scheduledDate: timestamp
  nutritionist: string
  type: 'inspection' | 'epi_delivery' | 'other'
  description: string
  status: 'pending' | 'completed' | 'cancelled'
  createdAt: timestamp
  createdBy: string
}
```

## 🎨 Design

- **Paleta de Cores**: Azul como cor principal (#3b82f6)
- **Tipografia**: Fonte padrão do sistema
- **Layout**: Sidebar fixo no desktop, mobile-first responsive
- **Componentes**: Baseados em shadcn/ui com customizações

## 📖 Guia de Uso

### Primeira Execução

1. Crie uma conta de usuário
2. Selecione o papel (Nutricionista ou Visualizador)
3. Acesse o Dashboard

### Adicionar Escola

1. Acesse "Escolas" no menu lateral
2. Clique em "Nova Escola"
3. Digite o nome e confirme

### Realizar Fiscalização

1. Acesse "Fiscalização"
2. Preencha os dados da escola e nutricionista
3. Responda o checklist (SIM, NÃO ou N/A)
4. Para respostas "NÃO", adicione observação obrigatória
5. Clique em "Salvar Fiscalização"
6. Exporte em PDF se necessário

### Registrar Entrega de EPIs

1. Acesse "Gestão de EPIs"
2. Preencha os dados da funcionária
3. Selecione os EPIs entregues
4. Capture a assinatura
5. Clique em "Salvar Entrega"

### Agendar Visita

1. Acesse "Cronograma"
2. Clique em "Agendar Visita"
3. Selecione a escola e data
4. Adicione observações (opcional)
5. Confirme o agendamento

### Visualizar Relatórios

1. Acesse "Relatórios"
2. Selecione a aba desejada (Conformidade, Inspeções, EPIs)
3. Analise os gráficos e estatísticas

## 🐛 Troubleshooting

### Erro de autenticação
- Verifique as credenciais do Firebase
- Certifique-se de que o Authentication está habilitado

### Dados não aparecem
- Verifique a conexão com o Firestore
- Confirme as regras de segurança
- Abra o DevTools para ver mensagens de erro

### Problema com assinatura
- Limpe o cache do navegador
- Tente em outro navegador
- Verifique se o canvas é suportado

## 📝 Licença

Este projeto é fornecido como está para fins educacionais e de gestão.

## 🤝 Suporte

Para dúvidas ou problemas, consulte:
- Documentação do Firebase: https://firebase.google.com/docs
- Documentação do React: https://react.dev
- Documentação do Tailwind: https://tailwindcss.com

## 🔄 Atualizações Futuras

- [ ] Integração com SMS/Email para notificações
- [ ] Exportação em Excel
- [ ] Gráficos mais avançados
- [ ] Integração com Google Calendar
- [ ] Aplicativo mobile nativo
- [ ] Sincronização offline
- [ ] Relatórios por período
- [ ] Análise de tendências

---

**Desenvolvido com ❤️ para o Sistema PNAE**
