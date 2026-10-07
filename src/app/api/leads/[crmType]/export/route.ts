import { NextResponse } from 'next/server';
import connectMongo from '@/lib/mongodb';
import Lead from '@/models/Lead';
import * as xlsx from 'xlsx';
import { formatPhone } from '@/lib/phoneUtils';
import { isClassWithoutSection } from '@/types/crm';

export async function GET(request: Request, { params }: { params: Promise<{ crmType: string }> }) {
  const { crmType } = await params;
  try {
    await connectMongo();
    
    if (!['elios', 'formatic'].includes(crmType)) {
      return NextResponse.json({ error: 'Invalid CRM type' }, { status: 400 });
    }

    const leads = await Lead.find({ crmType }).sort({ date: -1 });

    // Format data for Excel with exact column headers matching original CRM export
    const data = leads.map(lead => {
      const fName = lead.firstName || (lead.name || '').trim().split(/\s+/)[0] || '';
      const lName = lead.lastName || (lead.name || '').trim().split(/\s+/).slice(1).join(' ') || '';
      
      const notesFormatted = Array.isArray(lead.notes) && lead.notes.length > 0
        ? lead.notes.map((n: any) => {
            if (typeof n === 'string') return n;
            return n.text || '';
          }).filter(Boolean).join('\n')
        : '';

      const formatDateFr = (d: any) => {
        if (!d) return '';
        try {
          const dt = new Date(d);
          if (isNaN(dt.getTime())) return String(d);
          const pad = (n: number) => String(n).padStart(2, '0');
          return `${pad(dt.getDate())}/${pad(dt.getMonth() + 1)}/${dt.getFullYear()} ${pad(dt.getHours())}:${pad(dt.getMinutes())}:${pad(dt.getSeconds())}`;
        } catch {
          return '';
        }
      };

      const rowData: Record<string, any> = {
        'ID': lead.id || '',
        'Prenom': fName,
        'Nom': lName,
        'Telephone': formatPhone(lead.phone) || lead.phone || '',
        'Offre': lead.offer || '',
        'Source': lead.source || '',
        'Grade': lead.grade || '',
        'Specialite': isClassWithoutSection(lead.grade) ? '' : (lead.section || ''),
        'Statut': lead.status || '',
        'Operateur': lead.staff || lead.lastModifiedBy || 'Système',
      };

      if (crmType === 'formatic') {
        rowData['To Elios'] = (lead.toElios || lead.fromFormatic) ? 'Oui' : 'Non';
      } else {
        rowData['From Formatic'] = (lead.fromFormatic || lead.source === 'From Formatic') ? 'Oui' : 'Non';
      }

      rowData['DateCreation'] = formatDateFr(lead.date);
      rowData['DerniereMiseAJour'] = formatDateFr(lead.updatedAt || lead.date);
      rowData['Notes'] = notesFormatted;

      return rowData;
    });

    // Create workbook & worksheet (with fallback headers if empty)
    const fallbackHeaders = crmType === 'formatic'
      ? ['ID', 'Prenom', 'Nom', 'Telephone', 'Offre', 'Source', 'Grade', 'Specialite', 'Statut', 'Operateur', 'To Elios', 'DateCreation', 'DerniereMiseAJour', 'Notes']
      : ['ID', 'Prenom', 'Nom', 'Telephone', 'Offre', 'Source', 'Grade', 'Specialite', 'Statut', 'Operateur', 'From Formatic', 'DateCreation', 'DerniereMiseAJour', 'Notes'];

    const ws = data.length > 0
      ? xlsx.utils.json_to_sheet(data)
      : xlsx.utils.aoa_to_sheet([fallbackHeaders]);

    // Column widths for professional readability
    const cols = [
      { wch: 14 }, // ID
      { wch: 16 }, // Prenom
      { wch: 18 }, // Nom
      { wch: 16 }, // Telephone
      { wch: 20 }, // Offre
      { wch: 16 }, // Source
      { wch: 14 }, // Grade
      { wch: 16 }, // Specialite
      { wch: 18 }, // Statut
      { wch: 16 }, // Operateur
    ];

    if (crmType === 'formatic') {
      cols.push({ wch: 12 }); // To Elios
    }

    cols.push(
      { wch: 22 }, // DateCreation
      { wch: 22 }, // DerniereMiseAJour
      { wch: 60 }  // Notes
    );

    ws['!cols'] = cols;

    const wb = xlsx.utils.book_new();
    xlsx.utils.book_append_sheet(wb, ws, `Prospects ${crmType.toUpperCase()}`);

    // Generate buffer
    const buf = xlsx.write(wb, { type: 'buffer', bookType: 'xlsx' });

    return new NextResponse(buf, {
      status: 200,
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="prospects_${crmType}_${new Date().toISOString().split('T')[0]}.xlsx"`,
      }
    });

  } catch (error) {
    console.error('Failed to export leads:', error);
    return NextResponse.json({ error: 'Failed to export leads' }, { status: 500 });
  }
}
