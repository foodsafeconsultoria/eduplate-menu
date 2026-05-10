// Escola
// Perfil do Usuário
export interface UserProfile {
  id: string;
  name: string;
  email: string;
  phone?: string;
  role: 'admin' | 'fiscal' | 'nutricionista' | 'diretor';
  school?: string;
  avatar?: string; // Base64 da foto de perfil
  bio?: string;
  notifications: {
    email: boolean;
    sms: boolean;
    push: boolean;
  };
  createdAt: Date;
  updatedAt: Date;
}

export interface School {
  id: string;
  name: string;
  email?: string;
  createdAt: Date;
  updatedAt: Date;
}

// EPI - Equipamento de Proteção Individual
export interface EPIItem {
  luvaMalhaAco: boolean;
  luvaNitrilo: boolean;
  botaPvcBranca: boolean;
  calcadoSeguranca: boolean;
  aventalPvc: boolean;
  aventalTermico: boolean;
  proterorAuricular: boolean;
  respiradorPff: boolean;
  luvaTermica: boolean;
  touca: boolean;
  oculosSeguranca: boolean;
}

export interface EPI {
  id: string;
  schoolId: string;
  schoolName: string;
  employeeName: string;
  deliveryDate: Date;
  items: EPIItem;
  signature: string; // Base64 da assinatura
  createdAt: Date;
  createdBy: string;
}

// Fiscalização/Inspeção - Checklist Item
export interface ChecklistItemData {
  question: string;
  answer: 'yes' | 'no' | 'na' | null;
  observation?: string;
  photoUrl?: string;
}

// Fiscalização/Inspeção - Estrutura completa
export interface Inspection {
  id: string;
  schoolId: string;
  schoolName: string;
  director: string;
  regularStudents: number;
  integralStudents: number;
  inspectionDate: Date;
  inspectionTime: string;
  nutritionist: string;
  
  // Funcionários
  employees: Array<{
    name: string;
    role: string;
    workHours: string;
  }>;
  
  // Seções do checklist
  manipulationProcedures: ChecklistItemData[];
  uniformization: ChecklistItemData[];
  visitors: ChecklistItemData[];
  stockManagement: ChecklistItemData[];
  refrigerator: ChecklistItemData[];
  freezer: ChecklistItemData[];
  kitchen: ChecklistItemData[];
  menu: ChecklistItemData[];
  distribution: ChecklistItemData[];
  pestControl: ChecklistItemData[];
  waterPotability: ChecklistItemData[];
  physicalStructure: ChecklistItemData[];
  executors: ChecklistItemData[];
  
  // Refeições do dia
  meals: Array<{
    type: string;
    time: string;
    menu: string;
  }>;
  
  // Relatório
  visitObjective: string;
  guidelines: string;
  photos?: string[]; // Base64 de fotos
  
  overallScore: number; // Porcentagem de conformidade
  createdAt: Date;
  createdBy: string;
}

// Cronograma
export interface Schedule {
  id: string;
  schoolId: string;
  schoolName: string;
  scheduledDate: Date;
  nutritionist: string;
  type: 'inspection' | 'epi_delivery' | 'other';
  description?: string;
  status: 'pending' | 'completed' | 'cancelled';
  createdAt: Date;
  createdBy: string;
}

// Qualidade - Resto-Ingesta
export interface RestoIngesta {
  id: string;
  schoolId: string;
  schoolName: string;
  dishName: string;
  testDate: Date;
  pesoProducido: number;
  sobraLimpa: number;
  resto: number;
  percentual: number;
  createdAt: Date;
  createdBy: string;
}

// Qualidade - Aceitabilidade
export interface Acceptability {
  id: string;
  schoolId: string;
  schoolName: string;
  testDate: Date;
  mealType: string;
  dishName?: string;
  totalStudents: number;
  approvedStudents: number;
  percentualAprovacao: number;
  createdAt: Date;
  createdBy: string;
}

// Manutenção - Tickets
export interface MaintenanceTicket {
  id: string;
  schoolId: string;
  schoolName: string;
  inspectionId?: string;
  equipment: string;
  description: string;
  photo?: string;
  priority: 'low' | 'high';
  status: 'open' | 'in_progress' | 'resolved';
  createdAt: Date;
  createdBy: string;
  resolvedAt?: Date;
}

// Gamificação - Certificado
export interface Certificate {
  id: string;
  schoolName: string;
  inspectionId: string;
  score: number;
  issuedDate: Date;
  issuedBy: string;
}

// Documentos obrigatórios
export type DocumentCategory =
  | 'RDC 216'
  | 'RDC 275'
  | 'PNAE'
  | 'CVS'
  | 'ANVISA'
  | 'Municipal'
  | 'Outros';

export interface OrgDocument {
  id: string;
  name: string;
  category: DocumentCategory;
  description?: string;
  expiryDate?: string;       // ISO date string YYYY-MM-DD
  fileUrl?: string;
  fileName?: string;
  uploadedAt?: Date;
  updatedAt?: Date;
}

// Usuário
export interface User {
  uid: string;
  email: string;
  displayName: string;
  role: 'admin' | 'nutritionist' | 'nutricionista' | 'fiscal' | 'diretor' | 'viewer';
  organizationId: string;   // every user belongs to exactly one org
  createdAt: Date;
}
