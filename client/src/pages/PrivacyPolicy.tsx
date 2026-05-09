export default function PrivacyPolicy() {
  return (
    <div className="min-h-screen bg-gray-50 py-10 px-4">
      <div className="max-w-3xl mx-auto bg-white rounded-2xl shadow-sm border border-gray-100 p-8 md:p-12">

        <div className="mb-8">
          <div className="inline-block bg-green-100 text-green-800 text-xs font-semibold px-3 py-1 rounded-full mb-4">
            LGPD — Lei nº 13.709/2018
          </div>
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Política de Privacidade</h1>
          <p className="text-gray-500 text-sm">Sistema PNAE — Versão 1.0 · Vigência a partir de 1º de junho de 2026</p>
          <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
            <div className="bg-gray-50 rounded-xl px-4 py-3">
              <span className="font-semibold text-gray-700">Encarregado (DPO): </span>
              <span className="text-gray-600">contato@sistema-pnae.com.br</span>
            </div>
            <div className="bg-gray-50 rounded-xl px-4 py-3">
              <span className="font-semibold text-gray-700">Infraestrutura: </span>
              <span className="text-gray-600">Google Firebase / Cloud (ISO 27001)</span>
            </div>
          </div>
        </div>

        <hr className="border-gray-100 mb-8" />

        <Section title="1. Quem somos e o papel de cada parte">
          <p>O <strong>Sistema PNAE</strong> é uma plataforma SaaS para gestão da alimentação escolar no âmbito do Programa Nacional de Alimentação Escolar.</p>
          <p className="mt-3">Nos termos da LGPD, as responsabilidades são divididas da seguinte forma:</p>
          <ul className="mt-2 space-y-1 list-disc list-inside text-gray-600">
            <li><strong>Controlador dos dados:</strong> a Secretaria Municipal de Educação contratante, que define as finalidades e meios de tratamento.</li>
            <li><strong>Operador dos dados:</strong> a empresa responsável pelo Sistema PNAE, que trata dados exclusivamente conforme as instruções do Controlador.</li>
          </ul>
        </Section>

        <Section title="2. Quais dados coletamos">
          <SubTitle>Dados dos usuários da plataforma (funcionários)</SubTitle>
          <List items={['Nome completo', 'E-mail institucional', 'Registro profissional (CRN, para nutricionistas)', 'Cargo/função', 'Registros de acesso para fins de segurança']} />
          <SubTitle>Dados operacionais da alimentação escolar</SubTitle>
          <List items={['Alunos com necessidades dietéticas especiais (nome, escola, condição)', 'Cardápios, fichas técnicas, registros de produção e sobras', 'Resultados de aceitabilidade e restos-ingestão', 'Registros de fiscalização das unidades escolares', 'Dados de fornecedores da agricultura familiar']} />
          <div className="mt-4 bg-green-50 border-l-4 border-green-500 pl-4 py-3 rounded-r-xl text-sm text-green-800 italic">
            Não coletamos CPF, RG, dados bancários ou informações de pagamento dos titulares.
          </div>
        </Section>

        <Section title="3. Por que coletamos — Finalidades e Bases Legais">
          <div className="overflow-x-auto">
            <table className="w-full text-sm border-collapse">
              <thead>
                <tr className="bg-green-700 text-white">
                  <th className="text-left px-3 py-2 rounded-tl-lg">Finalidade</th>
                  <th className="text-left px-3 py-2">Base legal (LGPD)</th>
                  <th className="text-left px-3 py-2 rounded-tr-lg">Art.</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {[
                  ['Autenticação e controle de acesso', 'Legítimo interesse', 'Art. 7º, IX'],
                  ['Gestão de cardápios e fichas técnicas', 'Execução de política pública (PNAE)', 'Art. 7º, III'],
                  ['Registro de alunos com dietas especiais', 'Proteção da vida / obrigação legal', 'Art. 7º, II e VI'],
                  ['Fiscalização das unidades escolares', 'Obrigação legal (Lei nº 11.947/2009)', 'Art. 7º, II'],
                  ['Relatórios para FNDE/SIGPC', 'Obrigação legal', 'Art. 7º, II'],
                  ['Segurança e auditoria', 'Legítimo interesse', 'Art. 7º, IX'],
                ].map(([f, b, a]) => (
                  <tr key={f} className="even:bg-gray-50">
                    <td className="px-3 py-2 text-gray-700">{f}</td>
                    <td className="px-3 py-2 text-gray-600">{b}</td>
                    <td className="px-3 py-2 text-gray-500">{a}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Section>

        <Section title="4. Armazenamento e segurança">
          <p>Os dados são armazenados no <strong>Google Firebase / Google Cloud Platform</strong> (certificação ISO/IEC 27001, SOC 2 Type II), com servidores nos EUA e replicação automática.</p>
          <List className="mt-3" items={[
            'Criptografia em trânsito (TLS 1.3) e em repouso (AES-256)',
            'Autenticação via Firebase Authentication',
            'Controle de acesso por papéis (admin, nutricionista, visualizador)',
            'Isolamento completo de dados entre organizações (multi-tenancy)',
            'Backups automáticos diários',
          ]} />
        </Section>

        <Section title="5. Compartilhamento de dados">
          <p>Não comercializamos nem compartilhamos dados com terceiros para marketing. Os dados só são compartilhados:</p>
          <List className="mt-2" items={[
            'Com o Google Firebase (sub-operador de infraestrutura)',
            'Com autoridades públicas, por determinação legal ou judicial',
            'Com o próprio Controlador, para relatórios ao FNDE',
          ]} />
        </Section>

        <Section title="6. Transferência internacional">
          <p>O Google LLC está sujeito às Cláusulas Contratuais Padrão (SCCs) e mecanismos de adequação reconhecidos internacionalmente, garantindo nível de proteção equivalente ao exigido pela LGPD (art. 33).</p>
        </Section>

        <Section title="7. Dados de crianças e adolescentes">
          <p>Dados de alunos menores de 18 anos são tratados exclusivamente para fins de segurança alimentar, sob responsabilidade do Controlador (Secretaria de Educação), que deve garantir o consentimento dos responsáveis legais quando exigido.</p>
        </Section>

        <Section title="8. Seus direitos (art. 18, LGPD)">
          <List items={[
            'Acesso: saber quais dados são tratados',
            'Correção: retificar dados incorretos ou desatualizados',
            'Exclusão: quando o tratamento for desnecessário ou ilegal',
            'Portabilidade: receber seus dados em formato estruturado',
            'Revogação: quando o tratamento se basear em consentimento',
            'Oposição: quando discordar do tratamento por legítimo interesse',
          ]} />
          <p className="mt-3 text-sm text-gray-500">Para exercer seus direitos, entre em contato com o DPO: <strong>contato@sistema-pnae.com.br</strong> (resposta em até 15 dias úteis).</p>
        </Section>

        <Section title="9. Retenção dos dados">
          <List items={[
            'Logs de acesso e segurança: 12 meses',
            'Dados operacionais (cardápios, fiscalizações): prazo do contrato + 5 anos',
            'Dados de alunos com dietas especiais: período de matrícula + 2 anos',
            'Após rescisão: anonimização ou exclusão conforme solicitação',
          ]} />
        </Section>

        <Section title="10. Contato e Encarregado (DPO)">
          <div className="bg-gray-50 rounded-xl p-4 text-sm space-y-2">
            <p><strong>E-mail:</strong> contato@sistema-pnae.com.br</p>
            <p><strong>Prazo de resposta:</strong> até 15 dias úteis</p>
            <p><strong>ANPD:</strong> <a href="https://www.gov.br/anpd" target="_blank" rel="noopener noreferrer" className="text-green-700 underline">www.gov.br/anpd</a></p>
          </div>
        </Section>

        <Section title="11. Alterações nesta Política">
          <p>Mudanças relevantes serão comunicadas ao Controlador com 30 dias de antecedência por e-mail. A versão vigente está sempre disponível nesta página.</p>
        </Section>

        <div className="mt-10 pt-6 border-t border-gray-100 text-center text-xs text-gray-400">
          Sistema PNAE · Política de Privacidade v1.0 · {new Date().getFullYear()}
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

function SubTitle({ children }: { children: React.ReactNode }) {
  return <h3 className="font-semibold text-gray-800 mt-4 mb-1">{children}</h3>;
}

function List({ items, className = '' }: { items: string[]; className?: string }) {
  return (
    <ul className={`list-disc list-inside space-y-1 text-gray-600 ${className}`}>
      {items.map((item) => <li key={item}>{item}</li>)}
    </ul>
  );
}
