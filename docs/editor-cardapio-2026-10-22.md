# Editor de cardápios e PDF — 22/10/2026

## Experiência implementada

1. **Proteção do preenchimento.** Rascunho automático no navegador, separado por usuário e organização. Ao sair pelo editor, é possível continuar, guardar o rascunho ou descartar as alterações. A tela inicial oferece recuperação, inclusive depois de recarregar. Há aviso antes de fechar a aba e ao navegar por links. Falha de armazenamento é mostrada e impede prometer que o rascunho foi guardado.
2. **Página de edição dedicada.** O editor deixou a janela modal e passou a ocupar a área da página. Etapas Atendimento, Montar semana e Revisar e exportar, resumo acessível e botão Salvar permanente no rodapé. A refeição selecionada recebe destaque; adicionar um item conduz à busca com o dia e a refeição identificados. Avisos ficam acima do rodapé para não cobrir os botões.
3. **Quantidades claras.** Separados alunos atendidos, porções a preparar em cada refeição e refeições consumidas por aluno/dia, com exemplos. As porções podem ser ajustadas por refeição. Corrigida a atualização que mantinha quantidade de alunos e data antigas quando a usuária limpava esses campos. A semana informada precisa começar numa segunda-feira.
4. **Estado de salvamento real.** A interface distingue alteração ainda em rascunho, cardápio salvo no dispositivo, sincronização em andamento e confirmação da nuvem. A fila pendente é persistida; tenta reenviar ao abrir a tela e ao reconectar, além do botão manual. Salvamentos sucessivos preservam a edição mais recente quando a confirmação antiga chega depois. Navegação e editor compartilham bloqueio de envio nesta aba e recebem o mesmo estado de confirmação.
5. **Ações protegidas.** Desfazer/refazer de alterações no atendimento e na composição, até 50 estados por sessão. Ctrl/Cmd+Z fora dos campos; campos mantêm o desfazer nativo. A exclusão pede confirmação, permite cancelar e só anuncia sucesso depois de confirmar o documento removido na nuvem. Falhas mantêm o item disponível e mostram o erro.

Salvar mantém o editor aberto. Na revisão há geração do PDF do cardápio salvo; alterações pendentes precisam ser salvas antes, evitando uma exportação diferente do que está registrado. As pendências técnicas continuam disponíveis, sem impedir a criação de um rascunho incompleto.

## PDF revisado

- Cabeçalho identifica a situação do cardápio (rascunho, em revisão, aprovado ou publicado, quando cadastrada).
- Removida linha vazia desnecessária entre preparação e ingredientes.
- Observações mais compactas e blocos de nutrientes/referência mantidos juntos quando couberem na página.
- Reserva da assinatura calculada pelo tamanho real do nome/CRN e existência de imagem. Evita uma página com somente assinatura, inclusive no exemplo com faixa etária preenchida.
- Refeição explicitamente definida com zero porções é identificada como sem produção prevista.
- Preservados horários por escola, ingredientes das fichas, consistência para creche, cálculo por porção, avisos sobre dietas sem identificar estudantes e numeração das páginas.

Gerados e renderizados exemplos de atendimento parcial, duas escolas, frutas, combinação de fichas/alimentos e descrições longas. Nos exemplos simples, o parcial e o misto passaram de duas páginas para uma; o exemplo de duas escolas passou de quatro para duas. Conteúdo extenso continua paginado sem forçar redução excessiva de fonte.

Foi produzido um PDF adicional de demonstração, com dados fictícios identificados e sem uso para oferta de refeições, para conferência do resultado com perfil etário e tabela de referência.

## Verificação

- 123 testes automatizados aprovados em 19 arquivos, incluindo regressões de rascunho, isolamento de chaves, histórico, confirmação de edição nova e paginação do PDF.
- Teste de navegador com o componente real e Firebase/autenticação simulados, sem gravar ou excluir dados reais. Inclui edição, produção de 24 kg a partir de 200 g × 120 porções, desfazer/refazer, recarregar/recuperar rascunho, erro/reenvio à nuvem, duas instâncias do hook, edições durante um envio, limpeza de campos opcionais, cancelamento/falha/confirmação de exclusão e erro de armazenamento local.
- Verificação em 1440 px e 390 px, sem rolagem horizontal e sem erros de JavaScript nos cenários executados.
- Conferência de páginas PDF renderizadas com Poppler, incluindo exemplos longos e assinatura.

Comandos: `npm test`, `npm run check`, `npm run build`. A suíte visual é `npm run test:editor`; requer Playwright disponível (ou `PLAYWRIGHT_MODULE_PATH` apontando para o pacote no runtime) e um navegador compatível. Em Windows utiliza Edge. Os testes usam somente fixtures de `tests/menu-editor`; não fazem parte da aplicação publicada.

Resultado final: testes, checagem TypeScript, suíte de navegador e build aprovados. O build mantém os avisos já conhecidos sobre arquivos JavaScript grandes e importação estática/dinâmica do Firebase; não houve falha de compilação. `git diff --check` sem erros.

## Limites preservados

Não houve deploy, envio de e-mails ou alteração de cadastros reais. A sincronização foi exercitada com serviço simulado; permanece necessária a homologação com uma conta de teste no Firebase real e suas regras publicadas.

O rascunho depende deste navegador e pode desaparecer se seus dados forem limpos. Não é backup em outro dispositivo. O histórico de desfazer é da sessão de edição. A fila nova trata operações desta experiência, sem prometer resolução de conflitos entre vários dispositivos/abas ou alterações simultâneas de profissionais diferentes. As pendências de permissões identificadas no check-up anterior não foram corrigidas por esta etapa.
