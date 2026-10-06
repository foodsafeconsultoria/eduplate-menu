# Revisão técnica do PNAE — 04/10/2026

Fonte: [Resolução CD/FNDE nº 4/2026, arts. 17–18 e Anexo IV](https://www.gov.br/fnde/pt-br/acesso-a-informacao/legislacao/resolucoes/2026/resolucao-cd_fnde-no-4-de-26-de-fevereiro-de-2026.pdf/@@download/file).

## Cardápios: etapa implementada

- Perfil explícito de faixa etária, jornada, refeições por aluno/dia e atendimento a povos e comunidades tradicionais (PCT).
- Quantidade de refeições a produzir permanece separada das refeições por aluno/dia.
- Referências transcritas do Anexo IV por faixa etária e cobertura de 20%, 30% ou 70%, sem reutilizar a antiga tabela fixa de 300 kcal.
- Energia comparada ao mínimo; macronutrientes comparados à faixa publicada. Vitaminas A/C, cálcio e ferro incluídos para creche, conforme a tabela. Zinco permanece informação nutricional, sem uma meta inventada para o Anexo IV.
- Média de segunda a sexta com dias vazios como zero, avisos de estrutura incompleta e quantidade mínima de refeições.
- Para PCT, exceto creche, a referência de 30% é conferida em cada refeição e agregada para o dia.
- Resultado e pendências no editor e no PDF; a comparação não aprova automaticamente o cardápio.
- Cardápios antigos precisam ter o perfil preenchido. Mais de uma faixa usa a mesma porção da composição atual e gera aviso para diferenciar porções em cardápios próprios.

### Divergência encontrada na publicação

Na página 30 do PDF oficial, a tabela de creche integral (70%) repete 204 kcal para 7–11 meses e 304 kcal para 1–3 anos, valores apresentados na tabela de 30%. As faixas de macronutrientes mudam. O sistema preserva os valores publicados e deixa a energia integral como pendente de conferência RT/FNDE; não aplica uma correção presumida.

## Fichas técnicas: revisão realizada

Foi revisado o módulo, seu PDF e a biblioteca local de **58 fichas-modelo**. Os cadastros particulares da organização não foram extraídos da nuvem nesta revisão; o painel novo identifica pendências desses cadastros quando carregados no aplicativo.

| Conferência dos modelos | Resultado |
| --- | --- |
| Modo de preparo | 58 de 58 possuem |
| Soma dos pesos bruto e líquido | 58 de 58 consistentes |
| Per capita = rendimento pronto ÷ porções | 58 de 58 consistentes |
| Padrão de apresentação/serviço em campo próprio | Ausente nos 58 modelos; preencher na validação local |
| Custo total | Zerado nos 58 modelos; conferir preços da organização |

As fórmulas consistentes não comprovam o rendimento real ou a composição dos produtos. As fichas-modelo precisam de validação local da RT: pesagem do rendimento pronto, medida caseira, ingredientes efetivos, custo, alérgenos e comportamento após cocção.

### Ajustes no módulo de fichas

- Campo de padrão de apresentação e serviço, persistido no cadastro e incluído no PDF.
- Lista de pendências por ficha: preparo, apresentação, pesos/FC, porções, rendimento, custos e vínculo dos alimentos.
- Removida a comparação de uma preparação isolada com uma referência fixa da refeição completa.
- Modo de preparo exigido também ao atualizar fichas existentes.
- Recálculo bloqueado quando ingredientes não têm vínculo nutricional, para evitar soma parcial apresentada como completa.
- Custos automáticos por kg; custo de ingredientes adquiridos por unidade ou litro informado manualmente, sem presumir peso unitário ou densidade.
- Alérgenos cadastrados nos alimentos combinados com a identificação pelo nome; conferir produtos e contato cruzado localmente.
- Recálculo em lote preserva todas as atualizações e deixa fichas incompletas pendentes.

## Indicadores financeiros existentes

A tela continua servindo como relatório de apoio à contabilidade. O percentual declarado de agricultura familiar usa os recursos recebidos e não pode ser aprovado pela contagem de insumos do cardápio. Foi removida a declaração automática de autoria da RT. Não foi implementado um fluxo de prestação de contas.

## Limites desta etapa

Ainda não foram implementadas as validações de frequência e grupos alimentares dos arts. 18–19, proibições por idade, cardápios adaptados completos e metodologia dos testes de aceitabilidade. As faixas não contempladas no Anexo IV precisam de avaliação individual. Este trabalho não declara atendimento integral à resolução nem substitui a responsabilidade técnica.

Alterações locais; sem publicação ou alteração automática de cadastros na nuvem.

## Registro diário da alimentação escolar

Disponível em Alimentação → Registro diário (`/nutrition/daily-records`).

- Registro por cardápio e data, sem seleção obrigatória de escola ou turno/grupo; distingue sim, parcialmente e não no cumprimento do cardápio.
- Captura o planejamento do dia, porções/per capita e quantidades como cópia independente do cardápio. Alterações futuras no planejamento não modificam o relato salvo. Novos registros exigem vínculo ao cardápio cadastrado. Registros anteriores por escola ou com previsão manual continuam disponíveis para consulta, PDF e correção, preservando as referências históricas.
- Perguntas sobre preparo/porções, oferta, dietas, aferição de temperaturas, higiene e amostras segundo os procedimentos da unidade. Nenhuma resposta vem preenchida como sim. Não, não verificado e não se aplica exigem explicação.
- Alterações e verificações negativas ou desconhecidas exigem providência e pessoa informada. Não realiza envio automático de mensagens.
- Nome, identificador e perfil do usuário autenticado e horário de gravação são registrados; a data de atendimento pode ser anterior, mas não futura. O horário é o do dispositivo, não uma assinatura digital nem certificação oficial.
- Correções e atualizações de acompanhamento criam documentos novos ligados à versão anterior. Não há exclusão ou edição destrutiva na tela. As regras Firestore locais restringem exclusão/alteração; precisam acompanhar a próxima publicação das regras para vigorar na nuvem.
- Histórico e PDF individual incluem todas as respostas, ocorrências, encaminhamentos, referências de evidências e motivo das correções. Arquivos devem ser cadastrados em Documentos e referenciados; não são anexados ao registro por esta tela.
- Cache por organização mantém registros offline e identifica sincronização pendente, com tentativa manual de reenvio. Sem acesso à nuvem, o histórico pode estar incompleto e a prevenção de duplicatas considera apenas os registros conhecidos neste navegador. Duas pessoas offline podem criar registros paralelos para o mesmo cardápio e dia; não há bloqueio global por cardápio/data.
- Perfis nutricionista e administrador gravam; demais perfis consultam segundo as permissões atuais do sistema. Não foi ampliado o acesso de diretores à gravação.
- O preenchimento documenta a execução declarada. Não conclui automaticamente conformidade integral com o FNDE ou normas sanitárias, nem substitui os controles citados.
