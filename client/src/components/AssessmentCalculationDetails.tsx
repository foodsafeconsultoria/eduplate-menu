import type { NutritionalAssessment } from '@/types';
import { ASSESSMENT_METHOD, ASSESSMENT_REFERENCES, BMI_FORMULA, bmiCalculation, calculateApproxZScore, diffMonths, getReferenceBand } from '@/lib/assessmentCalculation';

export function AssessmentReferences() {
  return <div className="space-y-2 text-sm">
    <p className="font-semibold">Referências para conferência</p>
    {ASSESSMENT_REFERENCES.map(source => <a key={source.url} className="block text-blue-700 underline" href={source.url} target="_blank" rel="noreferrer">{source.label}</a>)}
    <p className="text-gray-600">A fórmula do IMC é peso dividido pela altura ao quadrado. Para crianças e adolescentes, a interpretação depende de idade e sexo. As tabelas oficiais acima ainda não são usadas pela classificação estimada deste sistema.</p>
  </div>;
}

export function AssessmentCalculationDetails({ record }: { record: NutritionalAssessment }) {
  const ref = getReferenceBand(record.sex, record.ageMonths);
  const recalculatedZ = calculateApproxZScore(record.sex, record.ageMonths, record.bmi);
  const outsideRange = record.ageMonths < 60 || record.ageMonths > 228;
  const calculatedAge = diffMonths(record.birthDate, record.assessmentDate);
  return <div className="space-y-5 text-sm">
    <section className="space-y-2">
      <h3 className="font-semibold">1. IMC</h3>
      <p>{BMI_FORMULA}</p>
      <p className="rounded bg-slate-50 p-3 font-mono">{bmiCalculation(record.weightKg, record.heightCm)}</p>
      <p>IMC salvo: <strong>{record.bmi.toFixed(2)} kg/m²</strong>. O cálculo acima usa as medidas salvas; pequenas diferenças podem decorrer do arredondamento.</p>
    </section>
    <section className="space-y-2">
      <h3 className="font-semibold">2. Idade e valores usados na estimativa</h3>
      <p>Sexo: {record.sex === 'F' ? 'feminino' : 'masculino'}. Idade usada no registro: <strong>{record.ageMonths} meses</strong>.</p>
      <p>Idade pelas datas: {calculatedAge} meses completos, descontando um mês quando a avaliação ocorre antes do dia de nascimento no mês.</p>
      <p>{ASSESSMENT_METHOD}</p>
      {outsideRange && <p className="rounded bg-amber-50 p-3 text-amber-950">Esta idade está fora de 60–228 meses. O método antigo reutiliza o extremo mais próximo. A classificação precisa ser revista usando a referência apropriada à idade.</p>}
      <div className="overflow-x-auto"><table className="w-full text-center">
        <caption className="mb-2 text-left">Limites internos de IMC interpolados para esta idade (kg/m²)</caption>
        <thead><tr>{['z = −3', 'z = −2', 'z = +1', 'z = +2', 'z = +3'].map(label => <th key={label} className="border p-2">{label}</th>)}</tr></thead>
        <tbody><tr>{[ref.minus3, ref.minus2, ref.plus1, ref.plus2, ref.plus3].map((value, index) => <td key={index} className="border p-2">{value.toFixed(3)}</td>)}</tr></tbody>
      </table></div>
      <p>Entre idades-base: limite = limite inicial + (limite final − limite inicial) × (idade − idade inicial) ÷ (idade final − idade inicial).</p>
      <p>O escore-z é estimado linearmente entre esses limites de IMC. Abaixo de −3 usa o intervalo −3 a −2; acima de +3 usa +2 a +3. O denominador mínimo é 0,1.</p>
      <p>Escore-z aproximado salvo: <strong>{record.zScoreApprox?.toFixed(2) ?? 'Não registrado'}</strong>. Recalculado pelo método atual a partir do IMC salvo: <strong>{recalculatedZ.toFixed(2)}</strong>.</p>
    </section>
    <section className="space-y-2">
      <h3 className="font-semibold">3. Classificação estimada salva: {record.status}</h3>
      <p>Regras internas: z &lt; −3: magreza acentuada; −3 ≤ z &lt; −2: magreza; −2 ≤ z ≤ +1: eutrofia; +1 &lt; z ≤ +2: sobrepeso; +2 &lt; z ≤ +3: obesidade; z &gt; +3: obesidade grave.</p>
      <p className="text-amber-900">Essas regras e valores internos não substituem a avaliação pelas tabelas oficiais. Registros antigos podem ter resultados diferentes do recálculo exibido.</p>
    </section>
    <AssessmentReferences />
  </div>;
}
