/**
 * AI route — /api/ai/inspection-report
 * Calls the Anthropic Claude API to generate a narrative inspection report
 * from the structured checklist data.
 *
 * Required env var: ANTHROPIC_API_KEY
 */
import { Router, type Request, type Response } from 'express';

const aiRouter = Router();

interface ChecklistItem {
  question: string;
  answer: 'yes' | 'no' | 'na' | null;
  observation?: string;
}

interface InspectionReportRequest {
  schoolName: string;
  nutritionist: string;
  director: string;
  inspectionDate: string;
  overallScore: number;
  visitObjective?: string;
  guidelines?: string;
  checklistSections: Record<string, ChecklistItem[]>;
  sectionLabels: Record<string, string>;
}

aiRouter.post('/inspection-report', async (req: Request, res: Response) => {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return res.status(503).json({
      error: 'ANTHROPIC_API_KEY não configurada. Configure a variável de ambiente no Railway.',
    });
  }

  const body = req.body as InspectionReportRequest;
  if (!body.schoolName || !body.checklistSections) {
    return res.status(400).json({ error: 'Dados insuficientes para gerar o relatório.' });
  }

  // Build a detailed prompt from inspection data
  const nonConformities: string[] = [];
  const sectionSummaries: string[] = [];

  for (const [key, items] of Object.entries(body.checklistSections)) {
    const label = body.sectionLabels[key] || key;
    const answered = items.filter(i => i.answer !== null && i.answer !== 'na');
    const yesCount = answered.filter(i => i.answer === 'yes').length;
    const pct = answered.length > 0 ? Math.round((yesCount / answered.length) * 100) : 0;
    sectionSummaries.push(`• ${label}: ${yesCount}/${answered.length} conformes (${pct}%)`);

    items
      .filter(i => i.answer === 'no')
      .forEach(i => {
        nonConformities.push(`  - [${label}] ${i.question}${i.observation ? `: ${i.observation}` : ''}`);
      });
  }

  const dateStr = new Date(body.inspectionDate).toLocaleDateString('pt-BR', {
    day: '2-digit', month: 'long', year: 'numeric',
  });

  const prompt = `Você é um nutricionista especialista em PNAE (Programa Nacional de Alimentação Escolar) e boas práticas de manipulação de alimentos (Resolução RDC nº 216/2004 e Resolução CD/FNDE nº 06/2020).

Com base nos dados da visita técnica abaixo, escreva um RELATÓRIO DE FISCALIZAÇÃO completo e profissional em português do Brasil.

REGRAS DE FORMATAÇÃO — MUITO IMPORTANTE:
- NÃO use markdown (sem **, sem ##, sem -, sem *).
- Separe as seções com o título da seção em LETRAS MAIÚSCULAS numa linha própria, seguido de dois-pontos. Exemplo: "1. IDENTIFICAÇÃO DA VISITA:"
- Depois do título, escreva o conteúdo em parágrafos normais.
- Use apenas texto plano. Sem listas com traço ou asterisco — use frases completas.
- Cada seção deve ser separada por uma linha em branco.

ESTRUTURA OBRIGATÓRIA:
1. IDENTIFICAÇÃO DA VISITA:
(escola, nutricionista, diretor, data, score geral — em parágrafos)

2. OBJETIVO DA VISITA:
(contextualize com base no objetivo informado)

3. ANÁLISE POR SEÇÃO:
(para cada seção do checklist, faça um comentário analítico — interprete os resultados, não apenas liste os números)

4. NÃO CONFORMIDADES CRÍTICAS:
(liste e explique as não conformidades encontradas em parágrafos, com referência à legislação quando pertinente; se não houver, diga "Nenhuma não conformidade crítica foi identificada nesta visita.")

5. CONCLUSÃO E RECOMENDAÇÕES:
(avaliação geral e orientações prioritárias para melhoria, em parágrafos)

---
DADOS DA VISITA:
Escola: ${body.schoolName}
Nutricionista RT: ${body.nutritionist}
Diretor(a): ${body.director}
Data: ${dateStr}
Score Geral de Conformidade: ${body.overallScore}%
${body.visitObjective ? `\nObjetivo informado: ${body.visitObjective}` : ''}
${body.guidelines ? `\nOrientações já registradas: ${body.guidelines}` : ''}

RESULTADOS POR SEÇÃO:
${sectionSummaries.join('\n')}

${nonConformities.length > 0 ? `NÃO CONFORMIDADES IDENTIFICADAS:\n${nonConformities.join('\n')}` : 'Nenhuma não conformidade registrada com observação.'}

---
Escreva o relatório completo agora. Use somente texto plano, SEM markdown, SEM asteriscos, SEM cerquilhas. Seja detalhado e profissional.`;

  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 2048,
        messages: [
          {
            role: 'user',
            content: prompt,
          },
        ],
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error('[AI] Anthropic API error:', response.status, errText);
      return res.status(502).json({
        error: `Erro na API da Anthropic: ${response.status}`,
        detail: errText,
      });
    }

    const data = await response.json() as {
      content: Array<{ type: string; text?: string }>;
    };

    const text = data.content
      .filter(c => c.type === 'text')
      .map(c => c.text || '')
      .join('');

    return res.json({ report: text });
  } catch (err) {
    console.error('[AI] Fetch error:', err);
    return res.status(503).json({
      error: 'Não foi possível conectar à API da Anthropic. Verifique a conexão do servidor.',
    });
  }
});

export default aiRouter;
