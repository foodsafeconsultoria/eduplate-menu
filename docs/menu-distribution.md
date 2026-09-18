# Distribuição de cardápios por grupo

1. Em **Escolas**, cadastre a rede de ensino, as etapas atendidas, o e-mail e os horários das refeições.
2. Em **Cardápios**, use o botão de envelope **Distribuir por grupo: e-mail ou ZIP** (disponível nas visualizações de tabela e cartões).
3. Filtre por rede e/ou etapa e clique em **Selecionar grupo**. Escolas antigas sem classificação aparecem quando os filtros estão em **Todas**.
4. Confira os destinatários e as pendências. O sistema exige a confirmação da revisão quando há pendências; e-mails ausentes ou inválidos não são enviados. O ZIP continua disponível para essas escolas.
5. Envie o lote ou baixe os PDFs em ZIP. Cada PDF contém apenas a escola destinatária, seus horários e as observações de dietas pertinentes à etapa do cardápio.

Mantenha a tela aberta até concluir. Os envios são sequenciais; **Parar após o envio atual** interrompe o restante. **Repetir somente falhas** reutiliza o mesmo anexo e a mesma chave de envio, sem incluir os sucessos do lote. O resultado significa aceitação pelo serviço de e-mail, não confirmação de entrega na caixa de entrada. O progresso exibido é mantido enquanto a janela de distribuição estiver aberta; abrir uma nova janela inicia outro lote.

## Operação e publicação

- Publicar frontend, API e `firestore.rules` juntos. A nova rota é `POST /api/email/send-menu-school`.
- O servidor requer as configurações existentes `RESEND_API_KEY`, `RESEND_FROM` e `FIREBASE_SERVICE_ACCOUNT_KEY`. Não há credenciais novas no frontend.
- A API valida a organização autenticada, busca o e-mail no cadastro da escola e rejeita destinatários que tenham mudado desde a conferência.
- Resultados e bloqueios de tentativas simultâneas ficam em `organizations/{orgId}/menu_email_deliveries`. Somente a API pode gravar nessa coleção; ela não armazena PDFs nem prescrições.
- Resultados confirmados não são reenviados com a mesma chave de lote/escola. Falhas incertas são repetidas com idempotência do Resend; após 23 horas, a API exige conferência manual antes de outro lote, mantendo margem em relação à validade de 24 horas das chaves do provedor.
- PDFs são gerados no navegador e têm limite de 4 MB por envio. O ZIP não envia mensagens.

## Verificação

`npx vitest run --config vitest.menu.config.ts`

Os testes usam provedores simulados, cobrem seleção por grupo, anexos isolados, ZIP, pendências e repetição segura. Não enviam e-mails reais.
