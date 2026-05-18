import { useEffect, useState } from 'react';
import { EPI, Inspection, Schedule, School } from '@/types';
import { loadHybridCollection, persistHybridSnapshot, syncHybridCollectionSnapshot, syncHybridDocument } from '@/lib/hybridStore';
import { useAuth } from '@/contexts/AuthContext';
import { useOrgId } from '@/hooks/useOrgId';

const LEGACY_ORG_ID = 'pnae-default-org';

const DEMO_SCHOOLS: School[] = [
  { id: '1', name: 'EMEI Profa. Angelina Maria de Almeida Tannus', createdAt: new Date(), updatedAt: new Date() },
  { id: '2', name: 'EMEF Prof. Antonio de Freitas Filho', createdAt: new Date(), updatedAt: new Date() },
  { id: '3', name: 'CEI Prof. Carmen Silvia Beltrame Martineli', createdAt: new Date(), updatedAt: new Date() },
  { id: '4', name: 'CEI Prof. Jose Goncalves de Sousa', createdAt: new Date(), updatedAt: new Date() },
  { id: '5', name: 'Creche Escola Pro Infancia Elisa Yoshie Takeda Toyonaga', createdAt: new Date(), updatedAt: new Date() },
  { id: '6', name: 'EMEF Profa. Elza Apparecida Cagliari Rolim', createdAt: new Date(), updatedAt: new Date() },
  { id: '7', name: 'Escola Creche Professora Elza Maria de Melo', createdAt: new Date(), updatedAt: new Date() },
  { id: '8', name: 'EMEF Profa. Lucia de Morais Camargo Rocha', createdAt: new Date(), updatedAt: new Date() },
  { id: '9', name: 'EMEI Profa. Maria Araujo Pinheiro', createdAt: new Date(), updatedAt: new Date() },
  { id: '10', name: 'CEI Monteiro Lobato', createdAt: new Date(), updatedAt: new Date() },
  { id: '11', name: 'EE Profa. Sandra Aparecida de Araujo', createdAt: new Date(), updatedAt: new Date() },
  { id: '12', name: 'EE Abilio Raposo Ferraz Junior', createdAt: new Date(), updatedAt: new Date() },
  { id: '13', name: 'EE Joao Michelin', createdAt: new Date(), updatedAt: new Date() },
];

const DEMO_INSPECTIONS: Inspection[] = [
  {
    id: '1',
    schoolId: '1',
    schoolName: 'EMEI Profa. Angelina Maria de Almeida Tannus',
    director: 'Maria Silva',
    regularStudents: 150,
    integralStudents: 50,
    inspectionDate: new Date('2026-02-10'),
    inspectionTime: '09:30',
    nutritionist: 'Ana Costa',
    employees: [],
    manipulationProcedures: Array(6).fill({ question: '', answer: 'yes', observation: '' }),
    uniformization: Array(5).fill({ question: '', answer: 'yes', observation: '' }),
    visitors: Array(2).fill({ question: '', answer: 'yes', observation: '' }),
    stockManagement: Array(15).fill({ question: '', answer: 'yes', observation: '' }),
    refrigerator: Array(5).fill({ question: '', answer: 'yes', observation: '' }),
    freezer: Array(5).fill({ question: '', answer: 'yes', observation: '' }),
    kitchen: Array(9).fill({ question: '', answer: 'yes', observation: '' }),
    menu: Array(2).fill({ question: '', answer: 'yes', observation: '' }),
    distribution: Array(9).fill({ question: '', answer: 'yes', observation: '' }),
    pestControl: Array(6).fill({ question: '', answer: 'yes', observation: '' }),
    waterPotability: Array(3).fill({ question: '', answer: 'yes', observation: '' }),
    physicalStructure: Array(4).fill({ question: '', answer: 'yes', observation: '' }),
    executors: Array(5).fill({ question: '', answer: 'yes', observation: '' }),
    meals: [],
    visitObjective: 'Verificacao de conformidade com boas praticas',
    guidelines: 'Implementar melhorias na organizacao do estoque',
    overallScore: 85,
    createdAt: new Date(),
    createdBy: 'Ana Costa',
  },
  {
    id: '2',
    schoolId: '2',
    schoolName: 'EMEF Prof. Antonio de Freitas Filho',
    director: 'Joao Santos',
    regularStudents: 200,
    integralStudents: 80,
    inspectionDate: new Date('2026-02-08'),
    inspectionTime: '14:00',
    nutritionist: 'Carlos Oliveira',
    employees: [],
    manipulationProcedures: Array(6).fill({ question: '', answer: 'yes', observation: '' }),
    uniformization: Array(5).fill({ question: '', answer: 'yes', observation: '' }),
    visitors: Array(2).fill({ question: '', answer: 'yes', observation: '' }),
    stockManagement: Array(15).fill({ question: '', answer: 'yes', observation: '' }),
    refrigerator: Array(5).fill({ question: '', answer: 'yes', observation: '' }),
    freezer: Array(5).fill({ question: '', answer: 'yes', observation: '' }),
    kitchen: Array(9).fill({ question: '', answer: 'yes', observation: '' }),
    menu: Array(2).fill({ question: '', answer: 'yes', observation: '' }),
    distribution: Array(9).fill({ question: '', answer: 'yes', observation: '' }),
    pestControl: Array(6).fill({ question: '', answer: 'yes', observation: '' }),
    waterPotability: Array(3).fill({ question: '', answer: 'yes', observation: '' }),
    physicalStructure: Array(4).fill({ question: '', answer: 'yes', observation: '' }),
    executors: Array(5).fill({ question: '', answer: 'yes', observation: '' }),
    meals: [],
    visitObjective: 'Verificacao de conformidade com boas praticas',
    guidelines: 'Realizar treinamento com funcionarios',
    overallScore: 78,
    createdAt: new Date(),
    createdBy: 'Carlos Oliveira',
  },
];

const DEMO_EPIS: EPI[] = [
  {
    id: '1',
    schoolId: '1',
    schoolName: 'EMEI Profa. Angelina Maria de Almeida Tannus',
    employeeName: 'Maria da Silva',
    deliveryDate: new Date('2026-02-05'),
    items: {
      luvaMalhaAco: true,
      luvaNitrilo: true,
      botaPvcBranca: true,
      calcadoSeguranca: true,
      aventalPvc: true,
      aventalTermico: false,
      proterorAuricular: true,
      respiradorPff: false,
      luvaTermica: false,
      touca: true,
      oculosSeguranca: true,
    },
    signature: '',
    createdAt: new Date(),
    createdBy: 'Ana Costa',
  },
];

const DEMO_SCHEDULES: Schedule[] = [
  {
    id: '1',
    schoolId: '3',
    schoolName: 'CEI Prof. Carmen Silvia Beltrame Martineli',
    scheduledDate: new Date('2026-02-20'),
    nutritionist: 'Ana Costa',
    type: 'inspection',
    description: 'Inspecao de rotina',
    status: 'pending',
    createdAt: new Date(),
    createdBy: 'Admin',
  },
];

function normalizeSchools(raw: unknown): School[] {
  if (!Array.isArray(raw)) return [];
  return raw.map((item, index) => {
    const school = item as Partial<School>;
    return {
      id: school.id || `school-imported-${index}`,
      name: school.name || 'Escola sem nome',
      email: school.email || '',
      createdAt: school.createdAt ? new Date(school.createdAt) : new Date(),
      updatedAt: school.updatedAt ? new Date(school.updatedAt) : new Date(),
    };
  });
}

function normalizeInspections(raw: unknown): Inspection[] {
  if (!Array.isArray(raw)) return [];
  return raw.map((item, index) => {
    const inspection = item as Partial<Inspection>;
    return {
      ...inspection,
      id: inspection.id || `inspection-imported-${index}`,
      schoolId: inspection.schoolId || '',
      schoolName: inspection.schoolName || '',
      director: inspection.director || '',
      regularStudents: Number(inspection.regularStudents) || 0,
      integralStudents: Number(inspection.integralStudents) || 0,
      inspectionDate: toDate(inspection.inspectionDate),
      inspectionTime: inspection.inspectionTime || '',
      nutritionist: inspection.nutritionist || '',
      employees: Array.isArray(inspection.employees) ? inspection.employees : [],
      manipulationProcedures: Array.isArray(inspection.manipulationProcedures) ? inspection.manipulationProcedures : [],
      uniformization: Array.isArray(inspection.uniformization) ? inspection.uniformization : [],
      visitors: Array.isArray(inspection.visitors) ? inspection.visitors : [],
      stockManagement: Array.isArray(inspection.stockManagement) ? inspection.stockManagement : [],
      refrigerator: Array.isArray(inspection.refrigerator) ? inspection.refrigerator : [],
      freezer: Array.isArray(inspection.freezer) ? inspection.freezer : [],
      kitchen: Array.isArray(inspection.kitchen) ? inspection.kitchen : [],
      menu: Array.isArray(inspection.menu) ? inspection.menu : [],
      distribution: Array.isArray(inspection.distribution) ? inspection.distribution : [],
      pestControl: Array.isArray(inspection.pestControl) ? inspection.pestControl : [],
      waterPotability: Array.isArray(inspection.waterPotability) ? inspection.waterPotability : [],
      physicalStructure: Array.isArray(inspection.physicalStructure) ? inspection.physicalStructure : [],
      executors: Array.isArray(inspection.executors) ? inspection.executors : [],
      meals: Array.isArray(inspection.meals) ? inspection.meals : [],
      visitObjective: inspection.visitObjective || '',
      guidelines: inspection.guidelines || '',
      photos: Array.isArray(inspection.photos) ? inspection.photos : [],
      overallScore: Number(inspection.overallScore) || 0,
      aiReport: inspection.aiReport || undefined,
      createdAt: toDate(inspection.createdAt),
      createdBy: inspection.createdBy || 'Sistema',
    } as Inspection;
  });
}

function normalizeEpis(raw: unknown): EPI[] {
  if (!Array.isArray(raw)) return [];
  return raw.map((item, index) => {
    const epi = item as Partial<EPI>;
    return {
      ...epi,
      id: epi.id || `epi-imported-${index}`,
      schoolId: epi.schoolId || '',
      schoolName: epi.schoolName || '',
      employeeName: epi.employeeName || '',
      deliveryDate: toDate(epi.deliveryDate),
      items: epi.items || {
        luvaMalhaAco: false,
        luvaNitrilo: false,
        botaPvcBranca: false,
        calcadoSeguranca: false,
        aventalPvc: false,
        aventalTermico: false,
        proterorAuricular: false,
        respiradorPff: false,
        luvaTermica: false,
        touca: false,
        oculosSeguranca: false,
      },
      signature: epi.signature || '',
      createdAt: toDate(epi.createdAt),
      createdBy: epi.createdBy || 'Sistema',
    } as EPI;
  });
}

/** Safely converts a Firestore Timestamp, ISO string, or Date to a JS Date. */
function toDate(value: unknown): Date {
  if (!value) return new Date();
  // Firestore Timestamp
  if (typeof (value as any).toDate === 'function') return (value as any).toDate();
  if (value instanceof Date) return value;
  const d = new Date(value as string | number);
  return isNaN(d.getTime()) ? new Date() : d;
}

function normalizeSchedules(raw: unknown): Schedule[] {
  if (!Array.isArray(raw)) return [];
  return raw.map((item, index) => {
    const schedule = item as Partial<Schedule>;
    return {
      id: schedule.id || `schedule-imported-${index}`,
      schoolId: schedule.schoolId || '',
      schoolName: schedule.schoolName || '',
      scheduledDate: toDate(schedule.scheduledDate),
      nutritionist: schedule.nutritionist || '',
      type: schedule.type || 'inspection',
      description: schedule.description || '',
      status: schedule.status || 'pending',
      createdAt: toDate(schedule.createdAt),
      createdBy: schedule.createdBy || 'Sistema',
    };
  });
}

export const useSchools = () => {
  const { user } = useAuth();
  const orgId = useOrgId();

  const [schools, setSchoolsState] = useState<School[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!orgId) { setLoading(false); return; }
    let mounted = true;

    loadHybridCollection({
      orgId,
      collectionName: 'schools',
      storageKey: 'pnae_schools',
      normalize: normalizeSchools,
      fallbackData: [],
    })
      .then((items) => {
        if (mounted) setSchoolsState(items);
      })
      .finally(() => {
        if (mounted) setLoading(false);
      });
    return () => {
      mounted = false;
    };
  }, [orgId]);

  const setSchools = (next: School[]) => {
    setSchoolsState(next);
    persistHybridSnapshot(`pnae_schools_${orgId}`, next);
    void syncHybridCollectionSnapshot(orgId, 'schools', next);
  };

  return { schools, loading, setSchools };
};

export const useInspections = () => {
  const { user } = useAuth();
  const orgId = useOrgId();

  const [inspections, setInspectionsState] = useState<Inspection[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!orgId) { setLoading(false); return; }
    let mounted = true;

    loadHybridCollection({
      orgId,
      collectionName: 'inspections',
      storageKey: 'pnae_inspections',
      normalize: normalizeInspections,
      fallbackData: [],
    })
      .then((items) => {
        if (mounted) setInspectionsState(items);
      })
      .finally(() => {
        if (mounted) setLoading(false);
      });
    return () => {
      mounted = false;
    };
  }, [orgId]);

  const setInspections = (next: Inspection[]) => {
    setInspectionsState(next);
    persistHybridSnapshot(`pnae_inspections_${orgId}`, next);
    // Sync only individual documents — NEVER delete from Firestore so that
    // inspections saved by other users are not wiped.
    next.forEach((item) => void syncHybridDocument(orgId, 'inspections', item));
  };

  return { inspections, loading, setInspections };
};

export const useEPIs = () => {
  const { user } = useAuth();
  const orgId = useOrgId();

  const [epis, setEpisState] = useState<EPI[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!orgId) { setLoading(false); return; }
    let mounted = true;

    loadHybridCollection({
      orgId,
      collectionName: 'epis',
      storageKey: 'pnae_epis',
      normalize: normalizeEpis,
      fallbackData: [],
    })
      .then((items) => {
        if (mounted) setEpisState(items);
      })
      .finally(() => {
        if (mounted) setLoading(false);
      });
    return () => {
      mounted = false;
    };
  }, [orgId]);

  const setEpis = (next: EPI[]) => {
    setEpisState(next);
    persistHybridSnapshot(`pnae_epis_${orgId}`, next);
    void syncHybridCollectionSnapshot(orgId, 'epis', next);
  };

  return { epis, loading, setEpis };
};

export const useSchedules = () => {
  const { user } = useAuth();
  const orgId = useOrgId();

  const [schedules, setSchedulesState] = useState<Schedule[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!orgId) { setLoading(false); return; }
    let mounted = true;

    loadHybridCollection({
      orgId,
      collectionName: 'agendamentos',
      storageKey: 'pnae_schedules',
      normalize: normalizeSchedules,
      fallbackData: [],
    })
      .then((items) => {
        if (mounted) setSchedulesState(items);
      })
      .finally(() => {
        if (mounted) setLoading(false);
      });
    return () => {
      mounted = false;
    };
  }, [orgId]);

  const setSchedules = (next: Schedule[]) => {
    setSchedulesState(next);
    persistHybridSnapshot(`pnae_schedules_${orgId}`, next);
    void syncHybridCollectionSnapshot(orgId, 'agendamentos', next);
  };

  return { schedules, loading, setSchedules };
};
