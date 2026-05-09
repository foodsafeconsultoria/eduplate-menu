import { useState, useEffect } from 'react';

export interface PDFRecord {
  id: string;
  filename: string;
  type: 'epi' | 'inspection' | 'schedule' | 'report';
  school?: string;
  date: Date;
  data: string; // Base64 encoded PDF
}

export const usePDFHistory = () => {
  const [pdfs, setPdfs] = useState<PDFRecord[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Carregar histórico do localStorage
    setTimeout(() => {
      const saved = localStorage.getItem('pnae_pdf_history');
      if (saved) {
        try {
          const parsed = JSON.parse(saved);
          setPdfs(parsed.map((p: any) => ({
            ...p,
            date: new Date(p.date)
          })));
        } catch (err) {
          console.error('Erro ao carregar histórico de PDFs:', err);
        }
      }
      setLoading(false);
    }, 300);
  }, []);

  const savePDF = (record: Omit<PDFRecord, 'id'>) => {
    const newRecord: PDFRecord = {
      ...record,
      id: `pdf-${crypto.randomUUID()}`
    };

    const updated = [newRecord, ...pdfs];
    setPdfs(updated);
    localStorage.setItem('pnae_pdf_history', JSON.stringify(updated));
    return newRecord;
  };

  const deletePDF = (id: string) => {
    const updated = pdfs.filter(p => p.id !== id);
    setPdfs(updated);
    localStorage.setItem('pnae_pdf_history', JSON.stringify(updated));
  };

  const filterBySchool = (school: string) => {
    return pdfs.filter(p => p.school?.toLowerCase().includes(school.toLowerCase()));
  };

  const filterByDate = (startDate: Date, endDate: Date) => {
    return pdfs.filter(p => p.date >= startDate && p.date <= endDate);
  };

  const filterByType = (type: PDFRecord['type']) => {
    return pdfs.filter(p => p.type === type);
  };

  return {
    pdfs,
    loading,
    savePDF,
    deletePDF,
    filterBySchool,
    filterByDate,
    filterByType
  };
};
