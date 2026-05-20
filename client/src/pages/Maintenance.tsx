import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Download, Trash2, AlertTriangle } from 'lucide-react';
import { MaintenanceTicket } from '@/types';
import { useMaintenanceTickets } from '@/hooks/useMaintenanceTickets';
import { toast } from 'sonner';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { addPdfHeader, addPdfFooter, brandColors } from '@/lib/pdfBranding';

function safeDate(v: unknown): Date {
  if (!v) return new Date();
  if (typeof (v as any).toDate === 'function') return (v as any).toDate();
  if (v instanceof Date) return v;
  const d = new Date(v as string | number);
  return isNaN(d.getTime()) ? new Date() : d;
}

export default function MaintenancePage() {
  const { tickets, deleteTicket } = useMaintenanceTickets();
  const [filterPriority, setFilterPriority] = useState<'all' | 'high' | 'low'>('all');

  const generateTicketPDF = async (ticket: MaintenanceTicket) => {
    const doc = new jsPDF();

    let yPosition = await addPdfHeader(doc, {
      title: 'TICKET DE MANUTENÇÃO',
      subtitle: 'PNAE — Gestão de Nutrição Escolar',
    });

    doc.setTextColor(31, 41, 55);
    doc.setFontSize(10);
    doc.setFont('helvetica', 'bold');

    const infoData = [
      ['Escola', ticket.schoolName],
      ['Equipamento', ticket.equipment],
      ['Prioridade', ticket.priority === 'high' ? 'ALTA' : 'BAIXA'],
      ['Data do Relato', format(safeDate(ticket.createdAt), 'dd/MM/yyyy HH:mm', { locale: ptBR })],
      ['Status', ticket.status === 'open' ? 'ABERTO' : 'RESOLVIDO'],
    ];

    autoTable(doc, {
      startY: yPosition,
      head: [['Campo', 'Informação']],
      body: infoData,
      theme: 'grid',
      headStyles: { fillColor: brandColors.green, textColor: 255, fontStyle: 'bold' },
    });

    yPosition = (doc as any).lastAutoTable.finalY + 12;

    doc.setFontSize(10);
    doc.setFont('helvetica', 'bold');
    doc.text('Descrição do Problema:', 15, yPosition);
    yPosition += 8;

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.setTextColor(74, 85, 104);
    const splitText = doc.splitTextToSize(ticket.description, 170);
    doc.text(splitText, 15, yPosition);

    addPdfFooter(doc);
    doc.save(`Ticket_${ticket.schoolName}_${format(new Date(), 'yyyy-MM-dd')}.pdf`);
    toast.success('PDF gerado com sucesso!');
  };

  const filteredTickets = tickets.filter(ticket => {
    if (filterPriority === 'all') return true;
    return ticket.priority === filterPriority;
  });

  const highPriorityCount = tickets.filter(t => t.priority === 'high').length;
  const openCount = tickets.filter(t => t.status === 'open').length;

  return (
    <div className="flex-1 p-4 md:p-8">
      <div className="max-w-6xl mx-auto">
        <div className="mb-8">
          <h1 className="text-4xl font-bold text-gray-900 mb-2">Manutenção</h1>
          <p className="text-gray-600">Gerenciamento de tickets de problemas estruturais</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-gray-600">Total de Tickets</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">{tickets.length}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-gray-600">Abertos</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-orange-600">{openCount}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-gray-600">Prioridade Alta</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-red-600">{highPriorityCount}</div>
            </CardContent>
          </Card>
        </div>

        {/* Filtros */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle>Filtros</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              <Button
                variant={filterPriority === 'all' ? 'default' : 'outline'}
                onClick={() => setFilterPriority('all')}
              >
                Todos
              </Button>
              <Button
                variant={filterPriority === 'high' ? 'default' : 'outline'}
                onClick={() => setFilterPriority('high')}
                className="bg-red-600 hover:bg-red-700"
              >
                Prioridade Alta
              </Button>
              <Button
                variant={filterPriority === 'low' ? 'default' : 'outline'}
                onClick={() => setFilterPriority('low')}
              >
                Prioridade Baixa
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Tickets */}
        <div className="space-y-4">
          {filteredTickets.length === 0 ? (
            <Card>
              <CardContent className="pt-6 text-center text-gray-500">
                Nenhum ticket encontrado
              </CardContent>
            </Card>
          ) : (
            filteredTickets.map(ticket => (
              <Card key={ticket.id} className="hover:shadow-md transition-shadow">
                <CardContent className="pt-6">
                  <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
                    <div className="flex-1">
                      <div className="flex flex-wrap items-center gap-3 mb-2">
                        <h4 className="font-semibold text-lg">{ticket.schoolName}</h4>
                        <Badge
                          variant={ticket.priority === 'high' ? 'destructive' : 'secondary'}
                          className="flex items-center gap-1"
                        >
                          {ticket.priority === 'high' && <AlertTriangle className="w-3 h-3" />}
                          {ticket.priority === 'high' ? 'ALTA' : 'BAIXA'}
                        </Badge>
                        <Badge variant={ticket.status === 'open' ? 'outline' : 'secondary'}>
                          {ticket.status === 'open' ? 'ABERTO' : 'RESOLVIDO'}
                        </Badge>
                      </div>

                      <p className="text-sm text-gray-600 mb-2">
                        <span className="font-semibold">Equipamento:</span> {ticket.equipment}
                      </p>

                      <p className="text-sm text-gray-700 mb-2 bg-gray-50 p-3 rounded">
                        {ticket.description}
                      </p>

                      <p className="text-xs text-gray-500">
                        Reportado em: {format(safeDate(ticket.createdAt), 'dd/MM/yyyy HH:mm', { locale: ptBR })}
                      </p>
                    </div>

                    <div className="flex gap-2 sm:ml-4 shrink-0">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => generateTicketPDF(ticket)}
                      >
                        <Download className="w-4 h-4" />
                      </Button>
                      <Button
                        variant="destructive"
                        size="sm"
                        onClick={() => {
                          deleteTicket(ticket.id);
                          toast.success('Ticket removido');
                        }}
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
