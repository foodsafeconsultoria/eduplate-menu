# EduPlate Menu — Gestão da alimentação escolar

Aplicação React/TypeScript com Firebase e API Express para organizar a alimentação escolar.

## Funcionalidades

- Cardápios, alimentos, fichas técnicas, publicações e lista de compras.
- Registro diário, produção e sobras, resto-ingesta e aceitabilidade.
- Dietas especiais e avaliação nutricional.
- Inspeções com checklist, histórico e PDF; agenda de visitas e cadastro de escolas.
- Documentos e alertas de vencimento; treinamentos, equipe e assinatura.
- Relatório gerencial de apoio à gestão e à contabilidade.

Os módulos de manutenção e gestão de EPIs foram retirados. Seus dados históricos não foram apagados da nuvem. Questões sobre uso de EPI no checklist continuam como conteúdo de boas práticas.

## Desenvolvimento

Instale as dependências com `pnpm install`. Configure as variáveis de ambiente e o Firebase conforme `FIREBASE_SETUP.md` e `SETUP_INSTRUCTIONS.md`, sem versionar segredos.

- `pnpm dev`: frontend Vite (porta inicial 3000).
- `pnpm dev:api`: API Express local (requer `.env`).
- `pnpm check`: verificação TypeScript.
- `pnpm test`: testes automatizados.
- `pnpm build`: build do frontend e da API.

O proxy de desenvolvimento encaminha `/api` para `http://localhost:3001`. As instruções de hospedagem estão em `DEPLOYMENT_GUIDE.md`.

## Revisão e produto

- [Check-up, alterações e prioridades técnicas](docs/checkup-e-enxugamento-2026-10-19.md).
- [Persona compradora e primeiros conteúdos](docs/persona-e-conteudo-eduplate.md).
- [Revisão dos cálculos, fichas e registro diário](docs/revisao-pnae-2026.md).

Os indicadores e relatórios apoiam o trabalho da equipe e exigem validação técnica. O app não declara conformidade integral nem realiza prestação de contas ou envio ao SIGPC. As pendências de autorização e sincronização identificadas no check-up precisam ser resolvidas antes de ampliar o uso comercial.
