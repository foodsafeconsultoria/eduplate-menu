# Check-up e simplificação — 19/10/2026

## Escopo

Revisão do código local, navegação, rotas, alertas, indicadores, persistência de inspeções, cache e testes automatizados. Nenhum deploy ou exclusão de dados da nuvem foi realizado. Não houve acesso autenticado aos dados reais, teste de cobrança real, envio de e-mail ou auditoria das regras atualmente publicadas no Firebase.

## Alterações realizadas

- Removidos os módulos de Manutenção e Gestão de EPIs: páginas, rotas, carregamento, links, estados e criação de tickets dentro das inspeções. Links antigos abrem a página de rota inexistente. Registros antigos e arquivos na nuvem permanecem preservados.
- Removido o menu Mais, que reunia apenas esses dois módulos.
- Excluída a antiga Sidebar sem referências no aplicativo, que duplicava a navegação e incluía link para certificados sem rota ativa. A navegação em uso é TopNav.
- Retiradas as configurações de notificação que eram gravadas, mas não filtravam os alertas nem implementavam o envio de e-mails prometido na tela. Preferências históricas permanecem salvas.
- Adicionada a lista de documentos vencidos/a vencer à central de notificações: antes o sino contava esses documentos, mas a central não os mostrava. Incluído acesso direto a documentos, agenda e cardápios.
- Contagem de visitas do painel alinhada à navegação: visitas passadas continuam no histórico, sem aparecer como visitas próximas.
- Perfil legado `nutricionista` passa a receber os mesmos alertas de rascunho que `nutritionist` na navegação e na central.
- Navegação principal usa Link do roteador, evitando recarregar todo o app a cada troca de módulo. Lista de compras, publicações e visão da alimentação ficaram acessíveis no menu; equipe e assinatura também no celular.
- Agricultura familiar no painel identificada como participação por quantidade de insumos. Removida comparação desse indicador com meta financeira, que mede outra coisa. Aceitabilidade apresentada como média dos registros, sem declarar uma meta única para metodologias diferentes.
- Texto comercial de planos corrigido para descrever relatório gerencial de apoio, sem prometer compatibilidade/envio ao SIGPC ou conformidade integral.
- Exclusão de inspeções agora remove explicitamente apenas o documento selecionado e confirma o servidor antes de avisar sucesso. Antes a exclusão retirava o item local, mas ele podia voltar ao recarregar.
- Removidas constantes de demonstração sem uso no hook compartilhado.
- Corrigido o pré-cache do service worker: havia referência a imagem inexistente, capaz de fazer falhar a gravação inicial do conjunto de arquivos. Versão do cache atualizada.

A pergunta de segurança sobre uso de EPI no checklist e o tema educativo de EPI nos treinamentos foram preservados: são conteúdo de boas práticas, não o módulo de entrega e gestão de EPIs.

## Pendências prioritárias encontradas

### 1. Controle de acesso — prioridade crítica antes de ampliar vendas

Em `firestore.rules`, a regra de `users/{userId}` permite que o próprio usuário escreva o documento inteiro. Entretanto, `role` e `organizationId` desse mesmo documento determinam as permissões e a organização acessível. Isso permite alterar os campos que sustentam a autorização. A constatação é do arquivo local; as regras publicadas não foram consultadas.

Recomendação: atribuir organização e papel por operações verificadas no servidor; no cliente, permitir atualização apenas de campos de perfil. Cadastro, recuperação de organização, convites e regras precisam mudar juntos. Só restringir a regra hoje interromperia fluxos que atualmente gravam esses campos pelo cliente. Também revisar a criação de organizações, que aceita campos de assinatura enviados pelo cliente, e exigir que os campos controlados pela cobrança sejam definidos pelo servidor.

Referência: [Firebase — restrição de campos em regras](https://firebase.google.com/docs/firestore/security/rules-fields). Validar a correção no emulador com cenários de outra organização, usuário de consulta, nutricionista, administrador e cadastro/convidado antes de publicar.

### 2. Concorrência e sincronização — prioridade alta

`syncHybridCollectionSnapshot` exclui da nuvem IDs ausentes no array local. O cronograma ainda usa esse método; uma aba desatualizada pode apagar um agendamento criado por outra pessoa. Migrar para gravação por documento e exclusão explícita, com confirmação de erro/estado pendente.

Inspeções ainda sincronizam todos os documentos do array a cada salvamento, sem confirmação individual de sucesso na interface. Uma edição pode regravar cópias antigas de outros itens. Migrar para salvar somente o registro alterado e exibir estado de sincronização. A exclusão individual foi corrigida nesta revisão, mas outro dispositivo com cache antigo ainda pode reenviar sua cópia: falta uma política global para conflitos/exclusões.

### 3. Autenticação — prioridade alta

O callback assíncrono de `onAuthStateChanged` não possui tratamento final de falhas de leitura/criação no Firestore. Uma falha pode deixar a tela em carregamento. Há também criação de organização de recuperação concorrente com o cadastro. Centralizar o provisionamento no servidor, impedir operações concorrentes e mostrar opção de tentar novamente.

### 4. Datas e indicadores — prioridade média

Há formulários usando `new Date('AAAA-MM-DD')` e datas por `toISOString()`, que podem deslocar o dia em horário brasileiro. Padronizar datas civis em string e converter apenas na apresentação; testar início/fim do dia e filtros inclusivos. Dados históricos não foram convertidos automaticamente.

As médias do painel são históricas e simples, sem ponderação por alunos/quantidade nem recorte de período. Exibir período e método do indicador antes de usá-lo para comparar escolas ou demonstrar resultados comerciais.

### 5. Carregamento — prioridade média

O build passou, mas avisou sobre arquivos JavaScript acima de 500 kB minificados: o módulo compartilhado de alimentos ficou em aproximadamente 1,46 MB e o principal em 974 kB, antes de gzip. Investigar carregamento da base de alimentos e divisão do código comum. O Firebase é importado de forma estática e dinâmica em lugares diferentes, por isso o import dinâmico não o separa em outro arquivo. Não foi medida redução de tamanho ou tempo de carregamento em relação à versão anterior.

## O que enxugar a seguir

| Proposta | Ganho esperado | Cuidados |
| --- | --- | --- |
| Reunir Produção, Sobras e Resto-ingesta em uma área de execução | Menos procura e preenchimento repetido | Manter conceitos e fórmulas distintos; não misturar sobra limpa com resto devolvido |
| Guiar a rotina: cardápio → compras → publicação → registro diário → acompanhamento | Mais clareza sobre o próximo passo | Preservar os cadastros já existentes e os acessos diretos |
| Colocar Alimentos e Fichas técnicas em Cadastros dentro de Alimentação | Reduzir o número de escolhas iniciais | Continuar oferecendo busca e acesso rápido para usuários frequentes |
| Painel com ações do dia, filtros de período e escola | Priorizar trabalho em vez de apenas números acumulados | Diferenciar pendência vencida de visita próxima |
| Avaliação nutricional como área complementar | Concentrar a experiência inicial na alimentação escolar | Preservar registros e revisar metodologia antes de destacar esse resultado comercialmente |
| Revisar dependências e arquivos de vídeo fora do fluxo do app | Simplificar instalação e manutenção do repositório | Medir o bundle e conferir referências antes de remover; esta revisão não declara redução de tamanho medida |

Não removi outros módulos funcionais por suposição. As propostas acima dependem de validar quais tarefas seus usuários realmente fazem toda semana.

## Validação

`npm test`: 114 testes aprovados em 17 arquivos. A configuração passou a incluir todos os testes existentes em `client/src` e `server`; anteriormente a lista explícita executava 90 testes em 13 arquivos. Não foram adicionados testes de interface nesta revisão.

`npm run check`: aprovado. `npm run build`: aprovado, com os avisos de tamanho e importação descritos acima. `git diff --check`: sem erros de whitespace.

A validação automatizada não comprova login, cobrança, regras publicadas, dados reais, funcionamento offline completo ou comportamento em dispositivos reais. Antes da publicação, executar um roteiro com conta de teste: navegar em celular/desktop, criar/editar/excluir inspeção, abrir PDF, ler alertas de documentos, criar cardápio e agendamento e conferir isolamento entre organizações.
