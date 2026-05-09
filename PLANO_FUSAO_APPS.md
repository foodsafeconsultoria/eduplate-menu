# Plano de Fusao dos Apps PNAE

## Decisao de arquitetura

O sistema unificado deve usar o projeto `GESTAO ESCOLA/sistema-pnae` como base principal.

Motivos:

- Ja possui estrutura mais adequada para crescer como plataforma.
- Ja possui autenticacao com Firebase.
- Ja possui organizacao em `client`, `server` e `shared`.
- Ja tem cadastro de escolas, perfil de usuario, agenda, fiscalizacao e relatorios.
- O app de cardapios pode entrar como um modulo tecnico dentro dessa base.

## Visao do sistema unico

O sistema deve ser organizado em modulos, e nao como um bloco unico sem separacao.

### 1. Nucleo comum

Responsabilidades:

- autenticacao
- usuarios e perfis
- escolas
- agenda
- anexos e fotos
- notificacoes
- historico de alteracoes
- configuracoes gerais do municipio

Entidades principais:

- `users`
- `schools`
- `roles`
- `attachments`
- `notifications`
- `settings`

### 2. Modulo Alimentacao Escolar

Vem principalmente do app `eduplate-nutri-main`.

Funcionalidades:

- base de alimentos
- fichas tecnicas
- cardapios
- dietas especiais
- diario de producao
- lista de compras
- indicadores nutricionais
- monitor de conformidade PNAE

Entidades sugeridas:

- `foods`
- `food_prices`
- `recipes`
- `recipe_versions`
- `recipe_ingredients`
- `menus`
- `menu_days`
- `menu_items`
- `special_diets`
- `production_logs`
- `purchase_projections`

### 3. Modulo Fiscalizacao e Visitas

Ja existe parcialmente no projeto base.

Funcionalidades:

- fiscalizacao
- checklist
- fotos
- plano de acao
- tickets de manutencao
- certificados
- acompanhamento de melhorias

Entidades sugeridas:

- `inspections`
- `inspection_sections`
- `inspection_items`
- `maintenance_tickets`
- `certificates`
- `school_evolution_records`

### 4. Modulo Qualidade

Une partes dos dois apps.

Funcionalidades:

- aceitabilidade
- resto ingesta
- desperdicio
- comparativo por escola
- alertas de baixa aceitacao

Entidades sugeridas:

- `acceptability_tests`
- `waste_logs`
- `leftover_logs`
- `quality_alerts`

## Estrutura recomendada de navegacao

- Dashboard Executivo
- Alimentacao Escolar
- Fiscalizacao
- Qualidade
- Escolas
- Agenda
- Relatorios
- Perfil

Dentro de `Alimentacao Escolar`:

- Alimentos
- Fichas Tecnicas
- Cardapios
- Dietas Especiais
- Producao
- Compras

Dentro de `Qualidade`:

- Aceitabilidade
- Resto Ingesta
- Desperdicio

## Estrategia de fusao

Nao recomendo copiar telas diretamente para dentro do projeto base sem antes organizar os modelos de dados.

Ordem correta:

1. Consolidar entidades comuns
2. Criar modelos de dados do modulo de alimentacao
3. Migrar layout e navegacao
4. Migrar paginas aos poucos
5. Substituir stores locais por Firebase
6. Revisar relatorios e permissoes

## Fases de implementacao

### Fase 1. Saneamento da base principal

Objetivo:

Preparar o projeto `sistema-pnae` para receber o modulo de alimentacao.

Entregas:

- padronizar tipos
- centralizar acesso a dados
- reduzir dependencia de `localStorage`
- definir colecoes do Firebase
- revisar rotas e sidebar

Prioridade alta:

- mover o que ainda esta salvo em `localStorage` para uma camada de servico
- criar repositorios ou hooks por dominio
- padronizar nomes de entidades e datas

### Fase 2. Cadastro mestre

Objetivo:

Criar base comum para todos os modulos.

Entregas:

- escolas com metadados
- usuarios com perfis e permissoes
- configuracoes do municipio
- nutricionistas responsaveis

Campos importantes para escola:

- nome
- codigo interno
- tipo de unidade
- numero de alunos por faixa etaria
- turno
- endereco
- status

### Fase 3. Modulo Alimentacao Escolar minimo viavel

Objetivo:

Trazer o coracao tecnico do app de cardapios para dentro da plataforma.

Entregas:

- modulo `Alimentos`
- modulo `Fichas Tecnicas`
- modulo `Cardapios`
- modulo `Dietas Especiais`

Regra:

Cada um desses modulos ja deve nascer integrado ao cadastro de escolas e perfis.

### Fase 4. Qualidade e operacao

Objetivo:

Conectar planejamento com execucao real.

Entregas:

- diario de producao
- aceitabilidade
- resto ingesta
- desperdicio
- indicadores por escola

### Fase 5. Relatorios PNAE

Objetivo:

Transformar o sistema em ferramenta gerencial de verdade.

Entregas:

- relatorio de cardapio por escola
- relatorio de dietas especiais
- relatorio de aceitabilidade
- relatorio de desperdicio
- relatorio de conformidade
- relatorio executivo do municipio

## O que reaproveitar de cada app

### Reaproveitar do `sistema-pnae`

- autenticacao
- estrutura de projeto
- sidebar
- modulo de escolas
- agenda
- fiscalizacao
- manutencao
- relatorios base

### Reaproveitar do `eduplate-nutri-main`

- logica de alimentos
- logica de ficha tecnica
- logica de cardapio
- logica de dieta especial
- logica de producao
- logica de lista de compras

### O que precisa ser refeito

- persistencia do app de cardapios
- tipagem e modelagem das entidades nutricionais
- calculos simplificados do monitor FNDE
- integracao entre cardapio, escola, dieta e producao
- dashboard executivo

## Primeira etapa pratica recomendada

A primeira implementacao deve ser pequena, segura e estrutural.

### Sprint 1 recomendada

Objetivo:

Criar o esqueleto do modulo `Alimentacao Escolar` dentro do projeto `sistema-pnae`.

Entregas:

- nova secao na navegacao
- novas rotas vazias para:
  - alimentos
  - fichas tecnicas
  - cardapios
  - dietas especiais
  - producao
- tipos iniciais do dominio de alimentacao
- pasta de hooks/servicos para esse dominio

Resultado:

O sistema passa a ter a espinha dorsal da fusao sem ainda migrar toda a logica antiga.

## Sequencia recomendada de desenvolvimento

1. Criar modulo `Alimentacao Escolar` no projeto base
2. Criar tipos compartilhados do dominio nutricional
3. Migrar `Alimentos`
4. Migrar `Fichas Tecnicas`
5. Migrar `Cardapios`
6. Migrar `Dietas Especiais`
7. Migrar `Diario de Producao`
8. Integrar `Aceitabilidade` e `Resto/Ingesta`
9. Refazer dashboard e relatorios gerenciais

## Observacoes operacionais

- Como o estoque ja e controlado na Fiorilli, nao vale criar modulo de estoque pesado agora.
- O sistema deve focar no que gera valor direto para a RT e para a operacao diaria.
- O objetivo e fazer a plataforma virar centro de planejamento, controle e conformidade PNAE.

## Proximo passo sugerido

Comecar agora pela Sprint 1:

- criar o modulo `Alimentacao Escolar`
- adicionar as rotas no projeto base
- preparar o terreno para migrar a primeira tela real

