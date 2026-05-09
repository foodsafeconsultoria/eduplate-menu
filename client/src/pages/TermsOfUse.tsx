export default function TermsOfUse() {
  return (
    <div className="min-h-screen bg-gray-50 py-10 px-4">
      <div className="max-w-3xl mx-auto bg-white rounded-2xl shadow-sm border border-gray-100 p-8 md:p-12">

        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Termos de Uso</h1>
          <p className="text-gray-500 text-sm">Sistema PNAE — Versão 1.0 · Vigência a partir de 1º de junho de 2026</p>
          <div className="mt-4 bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 text-sm text-amber-800">
            Ao acessar ou utilizar o Sistema PNAE, você concorda com os presentes Termos. Se não concordar, não utilize a plataforma.
          </div>
        </div>

        <hr className="border-gray-100 mb-8" />

        <Section title="1. O que é o Sistema PNAE">
          <p>O <strong>Sistema PNAE</strong> é uma plataforma SaaS (Software como Serviço) para gestão digital da alimentação escolar, oferecida para Secretarias Municipais de Educação e entidades executoras do Programa Nacional de Alimentação Escolar.</p>
        </Section>

        <Section title="2. Cadastro e conta de acesso">
          <p>Para utilizar a plataforma, é necessário criar uma conta com e-mail válido e senha. O usuário é responsável por:</p>
          <List items={[
            'Fornecer informações verdadeiras e atualizadas no cadastro',
            'Manter a confidencialidade da senha',
            'Notificar imediatamente o suporte em caso de acesso não autorizado',
            'Todo uso feito com suas credenciais, inclusive por terceiros',
          ]} />
          <p className="mt-3">Cada organização (município) é um ambiente isolado. Usuários não têm acesso a dados de outras organizações.</p>
        </Section>

        <Section title="3. Funcionalidades disponíveis">
          <p>O Sistema PNAE oferece, conforme o plano contratado:</p>
          <List items={[
            'Elaboração e publicação de cardápios escolares',
            'Cadastro de fichas técnicas de preparações',
            'Controle de dietas especiais de alunos',
            'Registro de produção, sobras e testes de aceitabilidade',
            'Fiscalização e auditorias de unidades escolares',
            'Gestão de treinamentos com emissão de certificados (QR Code)',
            'Geração de relatórios e exportação para o SIGPC/FNDE',
            'Controle de EPIs e documentação operacional',
          ]} />
        </Section>

        <Section title="4. Responsabilidades do usuário">
          <p>O usuário compromete-se a:</p>
          <List items={[
            'Utilizar a plataforma exclusivamente para fins legítimos relacionados ao PNAE',
            'Não inserir dados falsos, enganosos ou ilegais',
            'Respeitar os direitos de terceiros, incluindo dados de alunos e funcionários',
            'Não tentar acessar dados de outras organizações',
            'Não realizar engenharia reversa, scraping ou qualquer uso não autorizado do sistema',
            'Manter seus dados de acesso em sigilo',
          ]} />
        </Section>

        <Section title="5. Responsabilidades da plataforma">
          <p>O Sistema PNAE compromete-se a:</p>
          <List items={[
            'Disponibilizar a plataforma com SLA mínimo de 99% de uptime mensal',
            'Realizar backups automáticos diários',
            'Comunicar interrupções planejadas com antecedência de 24 horas',
            'Manter suporte técnico ativo nos dias úteis',
            'Proteger os dados conforme nossa Política de Privacidade e a LGPD',
          ]} />
          <p className="mt-3">Não nos responsabilizamos por decisões nutricionais, sanitárias ou administrativas tomadas com base nos relatórios gerados pela plataforma — essas decisões são de responsabilidade do nutricionista responsável técnico.</p>
        </Section>

        <Section title="6. Planos e pagamentos">
          <p>O acesso ao Sistema PNAE é oferecido em planos pagos, com cobrança mensal ou anual conforme contrato. O não pagamento por mais de 30 dias corridos pode resultar em suspensão temporária do acesso.</p>
          <p className="mt-2">Os dados permanecem disponíveis para exportação por 30 dias após o vencimento, mesmo com o acesso suspenso.</p>
        </Section>

        <Section title="7. Propriedade intelectual">
          <p>Todo o código-fonte, design, algoritmos e documentação do Sistema PNAE são de propriedade exclusiva dos seus desenvolvedores, protegidos pela Lei nº 9.609/1998 e Lei nº 9.610/1998.</p>
          <p className="mt-2">O contrato de uso confere ao usuário uma licença de uso não exclusiva e intransferível. Os <strong>dados inseridos na plataforma pertencem ao usuário/organização</strong> e podem ser exportados a qualquer momento.</p>
        </Section>

        <Section title="8. Privacidade e proteção de dados">
          <p>O tratamento de dados pessoais realizado pelo Sistema PNAE é regido pela nossa <strong>Política de Privacidade</strong>, disponível nesta plataforma, em conformidade com a LGPD (Lei nº 13.709/2018).</p>
        </Section>

        <Section title="9. Cancelamento">
          <p>O usuário pode cancelar sua conta a qualquer momento. Após o cancelamento:</p>
          <List items={[
            'O acesso é encerrado imediatamente ou ao final do período pago',
            'Os dados ficam disponíveis para exportação por 30 dias',
            'Após esse prazo, os dados são excluídos permanentemente dos nossos servidores',
          ]} />
        </Section>

        <Section title="10. Limitação de responsabilidade">
          <p>Em nenhuma hipótese o Sistema PNAE será responsável por danos indiretos, perda de receita, perda de dados (salvo por falha nossa) ou lucros cessantes. Nossa responsabilidade total está limitada ao valor pago pelo usuário nos últimos 12 meses.</p>
        </Section>

        <Section title="11. Alterações nos Termos">
          <p>Podemos atualizar estes Termos periodicamente. Alterações relevantes serão comunicadas por e-mail com 30 dias de antecedência. O uso continuado da plataforma após esse prazo representa aceitação dos novos Termos.</p>
        </Section>

        <Section title="12. Lei aplicável e foro">
          <p>Estes Termos são regidos pela legislação brasileira, incluindo o Código Civil, o CDC, a Lei de Software (nº 9.609/1998) e a LGPD. Eventuais disputas serão resolvidas preferencialmente por conciliação e, se necessário, no foro da comarca da sede da empresa.</p>
        </Section>

        <Section title="13. Contato">
          <div className="bg-gray-50 rounded-xl p-4 text-sm space-y-1">
            <p><strong>Suporte técnico:</strong> contato@sistema-pnae.com.br</p>
            <p><strong>Encarregado de Dados (DPO):</strong> contato@sistema-pnae.com.br</p>
          </div>
        </Section>

        <div className="mt-10 pt-6 border-t border-gray-100 text-center text-xs text-gray-400">
          Sistema PNAE · Termos de Uso v1.0 · {new Date().getFullYear()}
        </div>
      </div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mb-8">
      <h2 className="text-lg font-bold text-gray-900 border-b-2 border-green-200 pb-2 mb-4">{title}</h2>
      <div className="text-gray-600 leading-relaxed space-y-2">{children}</div>
    </section>
  );
}

function List({ items, className = '' }: { items: string[]; className?: string }) {
  return (
    <ul className={`list-disc list-inside space-y-1 text-gray-600 ${className}`}>
      {items.map((item) => <li key={item}>{item}</li>)}
    </ul>
  );
}
