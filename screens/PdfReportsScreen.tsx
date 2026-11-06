import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { db } from '../services/firebase';
import { 
  collection, 
  query, 
  getDocs, 
  where, 
  orderBy, 
  Timestamp, 
  collectionGroup,
  limit
} from 'firebase/firestore';
import BottomNav from '../components/BottomNav';
import Sidebar from '../components/Sidebar';
import ProfileMenu from '../components/ProfileMenu';
import NotificationBell from '../components/NotificationBell';
import { AccountResolver } from '../services/AccountResolver';
import { AccountingService } from '../services/AccountingService';
import { AccountMovement } from '../types';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';

const PdfReportsScreen: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [generatingType, setGeneratingType] = useState<string | null>(null);
  
  // States for Finance Report Option
  const [financePeriod, setFinancePeriod] = useState<'day' | 'week' | 'month' | 'year' | 'custom'>('month');
  const [customStartDate, setCustomStartDate] = useState(() => {
    const d = new Date();
    d.setDate(1);
    return d.toISOString().split('T')[0];
  });
  const [customEndDate, setCustomEndDate] = useState(() => {
    return new Date().toISOString().split('T')[0];
  });

  // States for Inventory Catalog Option
  const [catalogSearch, setCatalogSearch] = useState('');
  const [catalogLimit, setCatalogLimit] = useState<number>(500);
  const [catalogType, setCatalogType] = useState<'admin' | 'commercial'>('admin');
  const [catalogFormat, setCatalogFormat] = useState<'compact' | 'standard'>('compact');

  // States for Inventory Adjustments Option
  const [adjustmentsDays, setAdjustmentsDays] = useState<number>(30);

  const formatMXN = (val: number) => {
    return new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(val);
  };

  useEffect(() => {
    if (user) {
      AccountResolver.loadIndex(user.uid);
    }
  }, [user]);

  // FINANCE PDF GENERATOR
  const generateFinancePdf = async () => {
    if (!user) return;
    setGeneratingType('finance');

    try {
      // 1. Calculate boundaries
      let start = new Date();
      let end = new Date();

      if (financePeriod === 'day') {
        start.setHours(0, 0, 0, 0);
        end.setHours(23, 59, 59, 999);
      } else if (financePeriod === 'week') {
        const day = start.getDay();
        const diff = start.getDate() - day + (day === 0 ? -6 : 1);
        start.setDate(diff);
        start.setHours(0, 0, 0, 0);
        end.setDate(start.getDate() + 6);
        end.setHours(23, 59, 59, 999);
      } else if (financePeriod === 'month') {
        start.setDate(1);
        start.setHours(0, 0, 0, 0);
        end.setMonth(start.getMonth() + 1);
        end.setDate(0);
        end.setHours(23, 59, 59, 999);
      } else if (financePeriod === 'year') {
        start.setMonth(0, 1);
        start.setHours(0, 0, 0, 0);
        end.setMonth(11, 31);
        end.setHours(23, 59, 59, 999);
      } else {
        start = new Date(customStartDate + 'T00:00:00');
        end = new Date(customEndDate + 'T23:59:59');
      }

      // 2. Fetch movements
      const startTs = Timestamp.fromDate(start);
      const endTs = Timestamp.fromDate(end);

      const q = query(
        collectionGroup(db, "movements"),
        where("uid", "==", user.uid),
        where("createdAt", ">=", startTs),
        where("createdAt", "<=", endTs),
        orderBy("createdAt", "desc")
      );

      const snap = await getDocs(q);
      const fetchedMovs: AccountMovement[] = snap.docs.map(doc => {
        const data = doc.data();
        return {
          id: doc.id,
          accountId: String(data.accountId || ''),
          amount: Number(data.amount || 0),
          type: data.type,
          direction: data.direction || (data.type === 'INCOME' ? 'IN' : 'OUT'),
          conceptTitle: String(data.conceptTitle || ''),
          conceptSubtitle: String(data.conceptSubtitle || ''),
          source: String(data.source || ''),
          createdAt: data.createdAt?.toMillis ? data.createdAt.toMillis() : Date.now(),
          status: data.status || 'ACTIVE'
        } as any;
      });

      // Filter active and contable movements
      const contableMovs = fetchedMovs.filter(m => AccountingService.isMovementContable(m) && m.status === 'ACTIVE');
      const totals = AccountingService.calculateTotals(contableMovs);
      const statsByAccount = AccountingService.groupStatsByAccount(contableMovs);

      // 3. Setup PDF
      const doc = new jsPDF();
      const pageWidth = doc.internal.pageSize.width;
      
      // Header Decoration
      doc.setFillColor(99, 102, 241); // Indigo color
      doc.rect(0, 0, pageWidth, 40, 'F');
      
      // Title
      doc.setTextColor(255, 255, 255);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(22);
      doc.text("REPORTE FINANCIERO F1", 14, 20);
      
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(10);
      const rangeStr = `Periodo: ${start.toLocaleDateString('es-MX')} al ${end.toLocaleDateString('es-MX')}`;
      doc.text(rangeStr, 14, 28);
      doc.text(`Generado el: ${new Date().toLocaleString('es-MX')} • Email: ${user.email}`, 14, 34);

      // Stat Cards (X, Y, W, H)
      doc.setDrawColor(220, 225, 235);
      doc.setFillColor(250, 251, 253);
      
      // Card 1: Ingresos
      doc.roundedRect(14, 48, 56, 24, 3, 3, 'FD');
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(8);
      doc.setTextColor(110, 120, 140);
      doc.text("TOTAL INGRESOS", 18, 54);
      doc.setFontSize(14);
      doc.setTextColor(16, 185, 129); // Emerald
      doc.text(formatMXN(totals.income), 18, 64);

      // Card 2: Egresos
      doc.setDrawColor(220, 225, 235);
      doc.setFillColor(250, 251, 253);
      doc.roundedRect(77, 48, 56, 24, 3, 3, 'FD');
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(8);
      doc.setTextColor(110, 120, 140);
      doc.text("TOTAL EGRESOS", 81, 54);
      doc.setFontSize(14);
      doc.setTextColor(239, 68, 68); // Red
      doc.text(formatMXN(totals.expense), 81, 64);

      // Card 3: Balance / Resultado
      if (totals.balance >= 0) {
        doc.setDrawColor(187, 247, 208); // green-200 border
        doc.setFillColor(220, 252, 231); // green-100 fill (verde suave)
      } else {
        doc.setDrawColor(254, 202, 202); // red-200 border
        doc.setFillColor(254, 226, 226); // red-100 fill (rojo suave)
      }
      doc.roundedRect(140, 48, 56, 24, 3, 3, 'FD');
      
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(8);
      doc.setTextColor(71, 85, 105); // neutral readable title
      doc.text("FLUJO OPERATIVO NETO", 144, 54);
      doc.setFontSize(14);
      if (totals.balance >= 0) {
        doc.setTextColor(21, 128, 61); // deep green
      } else {
        doc.setTextColor(185, 28, 28); // deep red
      }
      doc.text(formatMXN(totals.balance), 144, 64);

      // Table 1: Breakdown by Rubro
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(12);
      doc.setTextColor(15, 23, 42);
      doc.text("COMPARATIVA POR RUBRO / CUENTA", 14, 84);

      const rubroRows = Object.entries(statsByAccount).map(([id, data]) => {
        const accName = AccountResolver.getAccount(id)?.name || id.toUpperCase();
        return [
          accName,
          id.toLowerCase(),
          formatMXN(data.income),
          formatMXN(data.expense),
          formatMXN(data.net)
        ];
      });

      autoTable(doc, {
        startY: 88,
        head: [['Rubro / Cuenta', 'Id Cuenta', 'Ingresos (+)', 'Egresos (-)', 'Flujo Neto']],
        body: rubroRows.length > 0 ? rubroRows : [['Sin transacciones para comparar', '-', '-', '-', '-']],
        theme: 'striped',
        styles: { fontSize: 9, font: 'helvetica', cellPadding: 3.5 },
        headStyles: { fillColor: [79, 70, 229], fontStyle: 'bold', textColor: 255 },
        columnStyles: {
          2: { halign: 'right' },
          3: { halign: 'right' },
          4: { halign: 'right', fontStyle: 'bold' }
        }
      });

      // --- ADD GRAPHICS / CHARTS SECTION FOR TOP ACCOUNTS ---
      const table1EndY = (doc as any).lastAutoTable.finalY || 135;
      const topAccounts = Object.entries(statsByAccount)
        .map(([id, data]) => {
          const accName = AccountResolver.getAccount(id)?.name || id.toUpperCase();
          return {
            id,
            name: accName,
            income: data.income,
            expense: data.expense,
            net: data.net,
            totalVolume: data.income + data.expense
          };
        })
        .sort((a, b) => b.totalVolume - a.totalVolume)
        .slice(0, 5); // top 5 accounts by volume

      // Render chart if there are accounts
      if (topAccounts.length > 0) {
        const chartHeight = 15 + (topAccounts.length * 15) + (topAccounts.length > 0 ? 10 : 0);
        let chartStartY = table1EndY + 12;
        if (chartStartY + chartHeight > 275) {
          doc.addPage();
          chartStartY = 20;
        }

        // Draw card container
        doc.setDrawColor(226, 232, 240); // slate-200 border
        doc.setFillColor(248, 250, 252); // slate-50 fill
        doc.roundedRect(14, chartStartY, 182, chartHeight, 4, 4, 'FD');

        // Draw visual chart title
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(10);
        doc.setTextColor(51, 65, 85);
        doc.text("FLUJO Y COMPARACIÓN POR CUENTA PRINCIPAL (TOP 5 DE MAYOR VOLUMEN)", 20, chartStartY + 8);

        // Find max value scale
        const maxVal = Math.max(...topAccounts.map(a => Math.max(a.income, a.expense)), 1);

        topAccounts.forEach((acc, idx) => {
          const rowY = chartStartY + 15 + (idx * 15);
          
          // Account Label
          doc.setFont('helvetica', 'bold');
          doc.setFontSize(8);
          doc.setTextColor(71, 85, 105);
          doc.text(acc.name, 20, rowY + 5);

          const barStartX = 72;
          const maxBarWidth = 60;
          const incWidth = (acc.income / maxVal) * maxBarWidth;
          const expWidth = (acc.expense / maxVal) * maxBarWidth;

          // Draw Income bar (emerald green)
          if (acc.income > 0) {
            doc.setFillColor(16, 185, 129); // emerald-500
            doc.rect(barStartX, rowY + 1, incWidth, 3, 'F');
          }

          // Draw Expense bar (rose red)
          if (acc.expense > 0) {
            doc.setFillColor(239, 68, 68); // red-500
            doc.rect(barStartX, rowY + 5, expWidth, 3, 'F');
          }

          // Draw text values next to the bars
          doc.setFont('helvetica', 'bold');
          doc.setFontSize(7);
          
          if (acc.income > 0) {
            doc.setTextColor(16, 185, 129);
            doc.text(`+${formatMXN(acc.income)}`, barStartX + incWidth + 3, rowY + 3.5);
          }
          if (acc.expense > 0) {
            doc.setTextColor(220, 38, 38);
            doc.text(`-${formatMXN(acc.expense)}`, barStartX + expWidth + 3, rowY + 7.5);
          }

          // Visual line separator
          if (idx < topAccounts.length - 1) {
            doc.setDrawColor(241, 245, 249);
            doc.line(20, rowY + 11.5, 190, rowY + 11.5);
          }
        });

        // Draw Legend
        const legendY = chartStartY + chartHeight - 4;
        doc.setFillColor(16, 185, 129);
        doc.rect(20, legendY - 2.5, 3, 3, 'F');
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(7.5);
        doc.setTextColor(71, 85, 105);
        doc.text("Ingresos (+)", 25, legendY);

        doc.setFillColor(239, 68, 68);
        doc.rect(60, legendY - 2.5, 3, 3, 'F');
        doc.text("Egresos (-)", 65, legendY);
      }

      // Table 2: Detailed Transaction Log
      // Since page 1 houses the executive cards, rubro summary, and visual charts,
      // we logically start the detailed transaction ledgers on page 2 for high visual hierarchy.
      doc.addPage();
      const startYLogs = 20;
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(12);
      doc.setTextColor(15, 23, 42);
      doc.text("HISTORIAL DETALLADO DE TRANSACCIONES", 14, startYLogs);

      const sortedMovs = [...contableMovs].sort((a,b) => b.createdAt - a.createdAt);
      const transactionRows = sortedMovs.map(m => {
        const textDate = new Date(m.createdAt).toLocaleDateString('es-MX', { day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit' });
        const accName = AccountResolver.getAccount(m.accountId)?.name || m.accountId.toUpperCase();
        const valueSign = m.direction === 'IN' ? '+' : '-';
        return [
          textDate,
          m.conceptTitle,
          m.conceptSubtitle || m.source || 'Manual',
          accName,
          m.direction === 'IN' ? 'INGRESO' : 'EGRESO',
          `${valueSign} ${formatMXN(m.amount)}`
        ];
      });

      autoTable(doc, {
        startY: startYLogs + 4,
        head: [['Fecha y Hora', 'Concepto Principal', 'Referencia / Canal', 'Cuenta', 'Tipo', 'Monto']],
        body: transactionRows.length > 0 ? transactionRows : [['-', 'No hay registros contables en este rango de fechas', '-', '-', '-', '-']],
        theme: 'striped',
        styles: { fontSize: 8, cellPadding: 3 },
        headStyles: { fillColor: [30, 41, 59], fontStyle: 'bold', textColor: 255 },
        columnStyles: {
          5: { halign: 'right', fontStyle: 'bold' }
        }
      });

      // Canvas Draw Signatures line
      const finalY = (doc as any).lastAutoTable.finalY || 240;
      const signatureSpaceNeeded = 40;
      if (finalY + signatureSpaceNeeded > doc.internal.pageSize.height) {
        doc.addPage();
      }
      
      const sigY = doc.internal.pageSize.height - 25;
      doc.setDrawColor(200, 200, 200);
      doc.line(14, sigY, 74, sigY);
      doc.line(136, sigY, 196, sigY);
      
      doc.setFontSize(8);
      doc.setTextColor(100, 110, 120);
      doc.text("Responsable de Sucursal", 14, sigY + 4);
      doc.text("Firma de Conformidad", 136, sigY + 4);

      // Page numbers footers callback
      const pagesCount = doc.internal.pages.length;
      for (let i = 1; i <= pagesCount; i++) {
        doc.setPage(i);
        doc.setFontSize(7);
        doc.setTextColor(150, 150, 150);
        doc.text(`Página ${i} de ${pagesCount} • Reporte de Operaciones Abarrotes F-1`, pageWidth - 80, doc.internal.pageSize.height - 10);
      }

      doc.save(`F1_Reporte_Financiero_${financePeriod}_${Date.now()}.pdf`);
    } catch (err) {
      console.error("Error generating finance PDF:", err);
      alert("Error al cargar la información de base de datos para generar el PDF.");
    } finally {
      setGeneratingType(null);
    }
  };

  // MARGINS PDF GENERATOR
  const generateMarginsPdf = async () => {
    if (!user) return;
    setGeneratingType('margins');

    try {
      // 1. Calculate boundaries
      let start = new Date();
      let end = new Date();

      if (financePeriod === 'day') {
        start.setHours(0, 0, 0, 0);
        end.setHours(23, 59, 59, 999);
      } else if (financePeriod === 'week') {
        const day = start.getDay();
        const diff = start.getDate() - day + (day === 0 ? -6 : 1);
        start.setDate(diff);
        start.setHours(0, 0, 0, 0);
        end.setDate(start.getDate() + 6);
        end.setHours(23, 59, 59, 999);
      } else if (financePeriod === 'month') {
        start.setDate(1);
        start.setHours(0, 0, 0, 0);
        end.setMonth(start.getMonth() + 1);
        end.setDate(0);
        end.setHours(23, 59, 59, 999);
      } else if (financePeriod === 'year') {
        start.setMonth(0, 1);
        start.setHours(0, 0, 0, 0);
        end.setMonth(11, 31);
        end.setHours(23, 59, 59, 999);
      } else {
        start = new Date(customStartDate + 'T00:00:00');
        end = new Date(customEndDate + 'T23:59:59');
      }

      // 2. Fetch movements
      const startTs = Timestamp.fromDate(start);
      const endTs = Timestamp.fromDate(end);

      const q = query(
        collectionGroup(db, "movements"),
        where("uid", "==", user.uid),
        where("createdAt", ">=", startTs),
        where("createdAt", "<=", endTs),
        orderBy("createdAt", "desc")
      );

      const snap = await getDocs(q);
      const fetchedMovs: AccountMovement[] = snap.docs.map(doc => {
        const data = doc.data();
        return {
          id: doc.id,
          accountId: String(data.accountId || ''),
          amount: Number(data.amount || 0),
          type: data.type,
          direction: data.direction || (data.type === 'INCOME' ? 'IN' : 'OUT'),
          conceptTitle: String(data.conceptTitle || ''),
          conceptSubtitle: String(data.conceptSubtitle || ''),
          source: String(data.source || ''),
          createdAt: data.createdAt?.toMillis ? data.createdAt.toMillis() : Date.now(),
          status: data.status || 'ACTIVE'
        } as any;
      });

      // Filter active and contable movements
      const contableMovs = fetchedMovs.filter(m => AccountingService.isMovementContable(m) && m.status === 'ACTIVE');
      const totals = AccountingService.calculateTotals(contableMovs);
      const statsByAccount = AccountingService.groupStatsByAccount(contableMovs);

      const getAccountNameLocal = (id: string) => {
        return AccountResolver.getAccount(id)?.name || id.toUpperCase();
      };

      // 3. Setup PDF
      const doc = new jsPDF();
      const pageWidth = doc.internal.pageSize.width;
      
      // Header Decoration
      doc.setFillColor(79, 70, 229); // Royal Indigo color
      doc.rect(0, 0, pageWidth, 40, 'F');
      
      // Title
      doc.setTextColor(255, 255, 255);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(20);
      doc.text("REPORTE DE MÁRGENES Y RENTABILIDAD F1", 14, 20);
      
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(10);
      const rangeStr = `Periodo: ${start.toLocaleDateString('es-MX')} al ${end.toLocaleDateString('es-MX')}`;
      doc.text(rangeStr, 14, 28);
      doc.text(`Generado el: ${new Date().toLocaleString('es-MX')} • Email: ${user.email}`, 14, 34);

      // Calculations
      const netBalance = totals.balance;
      const netMargin = totals.income > 0 ? (netBalance / totals.income) * 100 : 0;

      const salesStats = statsByAccount['ventas'] || { income: 0, expense: 0, net: 0 };
      const salesMargin = salesStats.income > 0 ? (salesStats.net / salesStats.income) * 100 : 0;

      const adminStats = statsByAccount['gastos_administrativos'] || { income: 0, expense: 0, net: 0 };
      const adminRatio = totals.income > 0 ? (adminStats.expense / totals.income) * 100 : 0;

      // Card setup
      doc.setDrawColor(220, 225, 235);
      doc.setFillColor(250, 251, 253);
      
      // Card 1: Margen Neto
      if (netMargin >= 15) {
        doc.setDrawColor(187, 247, 208); // green-200 border
        doc.setFillColor(220, 252, 231); // green-100 fill
      } else if (netMargin >= 5) {
        doc.setDrawColor(253, 230, 138); // amber-200 border
        doc.setFillColor(254, 243, 199); // amber-100 fill
      } else {
        doc.setDrawColor(254, 202, 202); // red-200 border
        doc.setFillColor(254, 226, 226); // red-100 fill
      }
      doc.roundedRect(14, 48, 56, 24, 3, 3, 'FD');
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(8);
      doc.setTextColor(71, 85, 105);
      doc.text("MARGEN OPERATIVO NETO", 18, 54);
      doc.setFontSize(14);
      if (netMargin >= 15) doc.setTextColor(21, 128, 61);
      else if (netMargin >= 5) doc.setTextColor(180, 83, 9);
      else doc.setTextColor(185, 28, 28);
      doc.text(`${netMargin.toFixed(1)}%`, 18, 64);

      // Card 2: Margen Giro Comercial
      doc.setDrawColor(199, 210, 254);
      doc.setFillColor(224, 231, 255);
      doc.roundedRect(77, 48, 56, 24, 3, 3, 'FD');
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(8);
      doc.setTextColor(71, 85, 105);
      doc.text("MARGEN CORE (VENTAS)", 81, 54);
      doc.setFontSize(14);
      doc.setTextColor(67, 56, 202);
      doc.text(`${salesMargin.toFixed(1)}%`, 81, 64);

      // Card 3: Impacto Gasto Administrativo
      doc.setDrawColor(254, 202, 202);
      doc.setFillColor(254, 226, 226);
      doc.roundedRect(140, 48, 56, 24, 3, 3, 'FD');
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(8);
      doc.setTextColor(71, 85, 105);
      doc.text("IMPACTO GTO. ADMIVO.", 144, 54);
      doc.setFontSize(14);
      doc.setTextColor(185, 28, 28);
      doc.text(`${adminRatio.toFixed(1)}%`, 144, 64);

      // Diagnostic and Feedback text block
      let feedbackTitle = "Rentabilidad Excelente";
      let feedbackDesc = "El negocio mantiene un nivel excepcional de eficiencia en la conversión neta. El control de gastos y la fijación de precios son sumamente robustos.";
      if (netMargin < 15 && netMargin >= 5) {
        feedbackTitle = "Rentabilidad Saludable";
        feedbackDesc = "La rentabilidad operativa neta se mantiene en parámetros comerciales estables. Excelente manejo ordinario.";
      } else if (netMargin < 5 && netMargin > 0) {
        feedbackTitle = "Rentabilidad Ajustada";
        feedbackDesc = "El negocio opera con un margen estrecho. Considere revisar las mermas del catálogo físico de abarrotes, o mitigar fugas en costos operativos fijos.";
      } else if (netMargin <= 0) {
        feedbackTitle = "Periodo con Pérdida Operativa";
        feedbackDesc = "Las erogaciones y el costo fijo administrativo superaron a los rendimientos o captaciones totales del lapso temporal evaluado. Requiere toma de decisiones estratégicas.";
      }

      let startBlockY = 80;
      doc.setDrawColor(226, 232, 240);
      doc.setFillColor(248, 250, 252);
      doc.roundedRect(14, startBlockY, 182, 22, 2, 2, 'FD');

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(9);
      doc.setTextColor(15, 23, 42);
      doc.text(`DIAGNÓSTICO CONTABLE: ${feedbackTitle.toUpperCase()}`, 18, startBlockY + 7);

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8);
      doc.setTextColor(71, 85, 105);
      const splitFeedback = doc.splitTextToSize(feedbackDesc, 174);
      doc.text(splitFeedback, 18, startBlockY + 13);

      // Margins summary table
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(11);
      doc.setTextColor(15, 23, 42);
      doc.text("DESGLOSE DE MÁRGENES ESTADÍSTICOS POR CUENTA", 14, startBlockY + 33);

      const specificLinesRows = Object.entries(statsByAccount).map(([id, data]) => {
        const accName = getAccountNameLocal(id);
        const margin = data.income > 0 ? (data.net / data.income) * 100 : 0;
        const impactOnTotalIncome = totals.income > 0 ? (data.income / totals.income) * 100 : 0;
        return [
          accName,
          formatMXN(data.income),
          formatMXN(data.expense),
          formatMXN(data.net),
          `${margin.toFixed(1)}%`,
          `${impactOnTotalIncome.toFixed(1)}%`
        ];
      });

      autoTable(doc, {
        startY: startBlockY + 37,
        head: [['Cuenta / Rubro', 'Ingreso Principal', 'Egreso / Compra', 'Rendimiento', 'Margen %', '% s/ Ventas']],
        body: specificLinesRows.length > 0 ? specificLinesRows : [['Sin transacciones registradas', '-', '-', '-', '-', '-']],
        theme: 'striped',
        styles: { fontSize: 8.5, cellPadding: 3.5, font: 'helvetica' },
        headStyles: { fillColor: [79, 70, 229], fontStyle: 'bold', textColor: 255 },
        columnStyles: {
          1: { halign: 'right' },
          2: { halign: 'right' },
          3: { halign: 'right' },
          4: { halign: 'right', fontStyle: 'bold' },
          5: { halign: 'right' }
        }
      });

      const tableEndY = (doc as any).lastAutoTable.finalY || 180;

      // Dynamic progress bar in PDF representing margins
      let visualY = tableEndY + 12;
      if (visualY + 35 > 275) {
        doc.addPage();
        visualY = 20;
      }

      // Visual block
      doc.setDrawColor(241, 245, 249);
      doc.setFillColor(250, 251, 253);
      doc.roundedRect(14, visualY, 182, 30, 3, 3, 'FD');

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(9);
      doc.setTextColor(71, 85, 105);
      doc.text("DISTRIBUCIÓN BRUTA DEL GIRO CORE (VENTAS ABARROTES)", 20, visualY + 7);

      const barX = 20;
      const barY = visualY + 12;
      const barW = 170;
      const barH = 5;

      const salesCostPercent = Math.max(0, Math.min(100, 100 - salesMargin));
      const salesMarginPercent = Math.max(0, Math.min(100, salesMargin));

      doc.setFillColor(226, 232, 240);
      doc.rect(barX, barY, barW, barH, 'F');

      const filledW = (salesMarginPercent / 100) * barW;
      doc.setFillColor(99, 102, 241);
      doc.rect(barX + (barW - filledW), barY, filledW, barH, 'F');

      doc.setFontSize(7.5);
      doc.setTextColor(100, 110, 120);
      doc.text(`Costo de Adquisición/Reposición: ${formatMXN(salesStats.expense)} (${salesCostPercent.toFixed(0)}%)`, barX, barY + 11);
      doc.setTextColor(79, 70, 229);
      doc.text(`Margen de Ganancia: ${formatMXN(salesStats.net)} (${salesMarginPercent.toFixed(1)}%)`, barX + 85, barY + 11);

      // Signatures
      const sigY = doc.internal.pageSize.height - 25;
      doc.setDrawColor(200, 200, 200);
      doc.line(14, sigY, 74, sigY);
      doc.line(136, sigY, 196, sigY);
      
      doc.setFontSize(8);
      doc.setTextColor(100, 110, 120);
      doc.text("Responsable de Operaciones", 14, sigY + 4);
      doc.text("Firma de Conformidad", 136, sigY + 4);

      // Page numbers footers callback
      const pagesCount = doc.internal.pages.length;
      for (let i = 1; i <= pagesCount; i++) {
        doc.setPage(i);
        doc.setFontSize(7);
        doc.setTextColor(150, 150, 150);
        doc.text(`Página ${i} de ${pagesCount} • Reporte de Márgenes y Margen Comercial Abarrotes F-1`, pageWidth - 98, doc.internal.pageSize.height - 10);
      }

      doc.save(`F1_Reporte_Margenes_${financePeriod}_${Date.now()}.pdf`);
    } catch (err) {
      console.error("Error generating margins PDF:", err);
      alert("Error al cargar la información de base de datos para generar el reporte de márgenes.");
    } finally {
      setGeneratingType(null);
    }
  };

  // INVENTORY CATALOG PDF GENERATOR
  const generateCatalogPdf = async () => {
    setGeneratingType('catalog');
    try {
      const parseNumeric = (val: any): number | null => {
        if (val === null || val === undefined) return null;
        if (typeof val === 'number') return isNaN(val) ? null : val;
        const clean = String(val).replace(/[$,\s]/g, '');
        const num = parseFloat(clean);
        return isNaN(num) ? null : num;
      };

      const normalize = (text: string) => {
        return String(text || '')
          .toLowerCase()
          .normalize("NFD")
          .replace(/[\u0300-\u036f]/g, "")
          .replace(/ñ/g, "n")
          .replace(/[^a-z0-9\s]/g, " ")
          .replace(/\s+/g, " ")
          .trim();
      };

      // 1. Fetch concurrently from all product & supplier related collections
      const [costsRes, prodsRes, provsRes] = await Promise.allSettled([
        getDocs(collection(db, "costs_catalog")),
        getDocs(collection(db, "products")),
        getDocs(collection(db, "providers"))
      ]);

      // Auxiliary maps to cross-reference data across collections
      const providersMap = new Map<string, string>();
      const categoriesMap = new Map<string, string>();
      const namesMap = new Map<string, string>();
      const costsMap = new Map<string, number>();

      if (prodsRes.status === 'fulfilled' && prodsRes.value) {
        prodsRes.value.docs.forEach(d => {
          const data = d.data();
          const key = d.id;
          const prov = data.Proveedor_principal || data.Proveedor || data.proveedor || data.supplierName || data.proveedor_principal || '';
          const cat = data.Categoría || data.Categoria || data.categoria || '';
          const name = data.Nombre_Completo || `${data.Producto || ''} ${data.Presentación || ''}`.trim() || data.nombre || '';
          if (prov) providersMap.set(key, prov);
          if (cat) categoriesMap.set(key, cat);
          if (name) namesMap.set(key, name);
        });
      }

      if (provsRes.status === 'fulfilled' && provsRes.value) {
        provsRes.value.docs.forEach(d => {
          const data = d.data();
          const key = d.id;
          const altKey = data.ProductKey;
          const prov = data.Proveedor || data.supplierName || data.proveedor || data.name || '';
          const cost = parseNumeric(data.Costo_actual || data.costo);
          if (prov) {
            if (!providersMap.has(key)) providersMap.set(key, prov);
            if (altKey && !providersMap.has(altKey)) providersMap.set(altKey, prov);
          }
          if (cost !== null) {
            if (!costsMap.has(key)) costsMap.set(key, cost);
            if (altKey && !costsMap.has(altKey)) costsMap.set(altKey, cost);
          }
        });
      }

      // Merge into a comprehensive unified candidate map
      const candidatesMap = new Map<string, any>();

      // Pass 1: Costs catalog entries
      if (costsRes.status === 'fulfilled' && costsRes.value) {
        costsRes.value.docs.forEach(d => {
          const data = d.data();
          const key = d.id;
          const altKey = data.ProductKey || key;
          
          const prov = data.Proveedor || data.supplierName || data.proveedor || providersMap.get(key) || providersMap.get(altKey) || 'General';
          const cat = data.Categoría || data.Categoria || categoriesMap.get(key) || categoriesMap.get(altKey) || 'Abarrotes';
          const name = data.Nombre_Completo || namesMap.get(key) || namesMap.get(altKey) || data.nombre || key;
          
          const costoUnidad = parseNumeric(data.Costo_unidad) ?? parseNumeric(data.Costo_base_principal) ?? costsMap.get(key) ?? costsMap.get(altKey) ?? null;
          const costoBase = parseNumeric(data.Costo_base_principal) ?? costoUnidad;
          const precioSugRed = parseNumeric(data.Precio_sug_red);
          const precioSug = parseNumeric(data.Precio_sugerido) ?? precioSugRed;
          const utilidad = parseNumeric(data["Utilidad_%"]);

          candidatesMap.set(key, {
            id: key,
            ProductKey: altKey,
            Nombre_Completo: String(name),
            Costo_base_principal: costoBase,
            Costo_unidad: costoUnidad,
            Precio_sugerido: precioSug,
            Precio_sug_red: precioSugRed,
            utilidad: utilidad,
            proveedor: String(prov),
            categoria: String(cat),
            rawSearch: `${name} ${prov} ${cat} ${key} ${altKey}`
          });
        });
      }

      // Pass 2: Products collection items not yet in candidatesMap
      if (prodsRes.status === 'fulfilled' && prodsRes.value) {
        prodsRes.value.docs.forEach(d => {
          const key = d.id;
          if (!candidatesMap.has(key)) {
            const data = d.data();
            const altKey = data.ProductKey || key;
            const prov = data.Proveedor_principal || data.Proveedor || data.proveedor || data.supplierName || providersMap.get(key) || 'General';
            const cat = data.Categoría || data.Categoria || 'Abarrotes';
            const name = data.Nombre_Completo || `${data.Producto || ''} ${data.Presentación || ''}`.trim() || data.nombre || key;
            const cost = parseNumeric(data.Costo_unidad || data.Costo_base_principal || data.costo) ?? costsMap.get(key) ?? null;
            const price = parseNumeric(data.Precio_sug_red || data.Precio_sugerido || data.precio);

            candidatesMap.set(key, {
              id: key,
              ProductKey: altKey,
              Nombre_Completo: String(name),
              Costo_base_principal: cost,
              Costo_unidad: cost,
              Precio_sugerido: price,
              Precio_sug_red: price,
              utilidad: parseNumeric(data["Utilidad_%"] || data.utilidad),
              proveedor: String(prov),
              categoria: String(cat),
              rawSearch: `${name} ${prov} ${cat} ${key} ${altKey}`
            });
          }
        });
      }

      // Pass 3: Providers collection items not yet in candidatesMap
      if (provsRes.status === 'fulfilled' && provsRes.value) {
        provsRes.value.docs.forEach(d => {
          const key = d.id;
          const data = d.data();
          const altKey = data.ProductKey || key;
          if (!candidatesMap.has(key) && !candidatesMap.has(altKey)) {
            const prov = data.Proveedor || data.supplierName || 'General';
            const name = data.Nombre_Completo || data.nombre || key;
            const cost = parseNumeric(data.Costo_actual || data.costo);

            candidatesMap.set(key, {
              id: key,
              ProductKey: altKey,
              Nombre_Completo: String(name),
              Costo_base_principal: cost,
              Costo_unidad: cost,
              Precio_sugerido: cost ? cost * 1.2 : null,
              Precio_sug_red: cost ? Math.ceil(cost * 1.2) : null,
              utilidad: 0.20,
              proveedor: String(prov),
              categoria: 'Abarrotes',
              rawSearch: `${name} ${prov} ${key} ${altKey}`
            });
          }
        });
      }

      let candidates = Array.from(candidatesMap.values());

      // Filter by search text across the complete inventory
      const trimmedSearch = catalogSearch.trim();
      if (trimmedSearch) {
        const normQuery = normalize(trimmedSearch);
        const queryTokens = normQuery.split(' ').filter(Boolean);

        candidates = candidates.filter(c => {
          const normRaw = normalize(c.rawSearch);
          const normProv = normalize(c.proveedor);
          const normName = normalize(c.Nombre_Completo);
          const normId = normalize(c.id);
          const normKey = normalize(c.ProductKey);
          const normCat = normalize(c.categoria);

          // Direct match against provider, product name, id, key or category
          if (
            normProv.includes(normQuery) || 
            normName.includes(normQuery) || 
            normId.includes(normQuery) || 
            normKey.includes(normQuery) || 
            normCat.includes(normQuery)
          ) {
            return true;
          }

          // Multi-token match across all fields
          return queryTokens.every(t => normRaw.includes(t));
        });
      }

      // Sort alphabetically by product name
      candidates.sort((a, b) => a.Nombre_Completo.localeCompare(b.Nombre_Completo, 'es', { sensitivity: 'base' }));

      // Apply export limit if specified
      const totalFound = candidates.length;
      if (catalogLimit && catalogLimit > 0 && candidates.length > catalogLimit) {
        candidates = candidates.slice(0, catalogLimit);
      }

      // 2. Setup PDF based on format (Compact 2-columns vs Standard)
      const doc = new jsPDF({ unit: 'mm', format: 'letter' });
      const pageWidth = doc.internal.pageSize.getWidth();
      const pageHeight = doc.internal.pageSize.getHeight();
      const safeSearchSuffix = trimmedSearch ? `_${trimmedSearch.replace(/[^a-zA-Z0-9]/g, '_')}` : '';
      const isCommercial = catalogType === 'commercial';

      if (catalogFormat === 'compact') {
        // COMPACT 2-COLUMN LAYOUT (Paper saving - matches sample PDF template)
        const ROWS_PER_COL = 58;
        const ITEMS_PER_PAGE = ROWS_PER_COL * 2; // 116 items per page
        const totalPages = Math.max(1, Math.ceil(candidates.length / ITEMS_PER_PAGE));

        const headers = isCommercial 
          ? [['CLAVE', 'PRODUCTO', 'VENTA']]
          : [['PRODUCTO', 'COMPRA', 'VENTA', 'UTILIDAD']];

        const colStyles = isCommercial ? {
          0: { cellWidth: 22.5, textColor: [100, 100, 100] as [number, number, number] },
          1: { cellWidth: 55 },
          2: { cellWidth: 20, halign: 'right' as const, fontStyle: 'bold' as const }
        } : {
          0: { cellWidth: 48.5 },
          1: { cellWidth: 15, halign: 'right' as const },
          2: { cellWidth: 15, halign: 'right' as const },
          3: { cellWidth: 19, halign: 'right' as const }
        };

        for (let p = 0; p < totalPages; p++) {
          if (p > 0) doc.addPage();

          const pageCandidates = candidates.slice(p * ITEMS_PER_PAGE, (p + 1) * ITEMS_PER_PAGE);
          const leftColItems = pageCandidates.slice(0, Math.min(ROWS_PER_COL, Math.ceil(pageCandidates.length / 2)));
          const rightColItems = pageCandidates.slice(leftColItems.length);

          // Page Header Top Line
          doc.setFont('helvetica', 'bold');
          doc.setFontSize(10.5);
          doc.setTextColor(20, 20, 20);

          const titlePrefix = isCommercial ? 'CATÁLOGO COMERCIAL' : 'INVENTARIO';
          const providerLabel = trimmedSearch ? trimmedSearch.toUpperCase() : 'GENERAL';
          const titleText = `${titlePrefix} ${providerLabel} - LISTA COMPACTA`;
          doc.text(titleText, 8, 10);

          // Page & count info on the right
          doc.setFont('helvetica', 'normal');
          doc.setFontSize(8.5);
          doc.setTextColor(60, 60, 60);
          const infoRight = `${candidates.length} productos | Página ${p + 1} de ${totalPages}`;
          doc.text(infoRight, pageWidth - 8, 10, { align: 'right' });

          // Subtitle line
          doc.setFontSize(7.5);
          doc.setTextColor(90, 90, 90);
          const subText = isCommercial
            ? "Lista de precios sugeridos de venta al público • Importes en MXN"
            : "Utilidad unitaria = precio sugerido de venta - precio de compra";
          doc.text(subText, 8, 14.5);

          // Subtle divider line
          doc.setDrawColor(220, 220, 220);
          doc.setLineWidth(0.2);
          doc.line(8, 16, pageWidth - 8, 16);

          // Format data rows
          const buildRow = (c: any) => {
            const cost = c.Costo_unidad ?? c.Costo_base_principal ?? 0;
            const price = c.Precio_sug_red ?? c.Precio_sugerido ?? 0;
            const profit = price - cost;
            if (isCommercial) {
              return [
                c.id,
                c.Nombre_Completo,
                formatMXN(price)
              ];
            } else {
              return [
                c.Nombre_Completo,
                formatMXN(cost),
                formatMXN(price),
                formatMXN(profit)
              ];
            }
          };

          const leftRows = leftColItems.map(buildRow);
          const rightRows = rightColItems.map(buildRow);

          // Render Left Table
          autoTable(doc, {
            startY: 17.5,
            margin: { left: 8, right: pageWidth - (8 + 97.5) },
            tableWidth: 97.5,
            head: headers,
            body: leftRows.length > 0 ? leftRows : [[
              isCommercial ? '-' : (trimmedSearch ? `Sin coincidencias para "${trimmedSearch}"` : 'Sin artículos'),
              '-',
              '-',
              ...(isCommercial ? [] : ['-'])
            ]],
            theme: 'plain',
            pageBreak: 'avoid',
            styles: { 
              fontSize: 6.6, 
              cellPadding: { top: 0.65, bottom: 0.65, left: 0.8, right: 0.8 }, 
              textColor: [30, 30, 30],
              overflow: 'ellipsize',
              lineColor: [230, 230, 230],
              lineWidth: 0.1
            },
            headStyles: { 
              fillColor: [245, 245, 245], 
              textColor: [20, 20, 20], 
              fontStyle: 'bold',
              fontSize: 6.8,
              cellPadding: { top: 1, bottom: 1, left: 0.8, right: 0.8 }
            },
            alternateRowStyles: {
              fillColor: [252, 252, 252]
            },
            columnStyles: colStyles
          });

          // Render Right Table
          if (rightRows.length > 0) {
            autoTable(doc, {
              startY: 17.5,
              margin: { left: 110, right: 8 },
              tableWidth: 97.5,
              head: headers,
              body: rightRows,
              theme: 'plain',
              pageBreak: 'avoid',
              styles: { 
                fontSize: 6.6, 
                cellPadding: { top: 0.65, bottom: 0.65, left: 0.8, right: 0.8 }, 
                textColor: [30, 30, 30],
                overflow: 'ellipsize',
                lineColor: [230, 230, 230],
                lineWidth: 0.1
              },
              headStyles: { 
                fillColor: [245, 245, 245], 
                textColor: [20, 20, 20], 
                fontStyle: 'bold',
                fontSize: 6.8,
                cellPadding: { top: 1, bottom: 1, left: 0.8, right: 0.8 }
              },
              alternateRowStyles: {
                fillColor: [252, 252, 252]
              },
              columnStyles: colStyles
            });
          }

          // Footer on this page
          doc.setFontSize(6.8);
          doc.setTextColor(140, 140, 140);
          const footerText = isCommercial
            ? "Abarrotes F-1 • Lista de Precios de Venta al Público. Importes en MXN."
            : "Valores tomados del catálogo enviado. Importes en MXN.";
          doc.text(footerText, 8, pageHeight - 6);
        }

        const reportName = isCommercial ? 'Comercial' : 'Administrativo';
        doc.save(`F1_Inventario_${reportName}_Compacto${safeSearchSuffix}_${Date.now()}.pdf`);
      } else {
        // STANDARD TABLE LAYOUT (Full width detailed table)
        doc.setFillColor(16, 185, 129); // Emerald header
        doc.rect(0, 0, pageWidth, 40, 'F');
        
        doc.setTextColor(255, 255, 255);
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(18);
        doc.text(isCommercial ? "CATÁLOGO COMERCIAL DE PRECIOS" : "CATÁLOGO DE INVENTARIO Y COSTOS", 14, 16);
        
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(8.5);
        const filterLabel = trimmedSearch ? `Filtro aplicado: "${trimmedSearch}"` : 'Todos los proveedores y productos';
        doc.text(`Criterio: ${filterLabel} • Límite máximo: ${catalogLimit}`, 14, 23);
        doc.text(`Generado el: ${new Date().toLocaleString('es-MX')} • Registros encontrados: ${totalFound} (Exportados: ${candidates.length})`, 14, 29);
        doc.text(`Abarrotes F-1 • ${isCommercial ? 'Lista de Precios al Mostrador' : 'Auditoría de Costos, Precios y Rentabilidad'}`, 14, 35);

        // Data Rows
        const catalogRows = candidates.map((c, i) => {
          const cost = c.Costo_unidad ?? c.Costo_base_principal ?? 0;
          const price = c.Precio_sug_red ?? c.Precio_sugerido ?? 0;
          const profit = price - cost;
          const profitPercent = c.utilidad ?? (price > 0 ? (profit / price) * 100 : 0);
          
          if (isCommercial) {
            return [
              String(i + 1),
              c.id,
              c.Nombre_Completo,
              c.proveedor,
              formatMXN(price)
            ];
          } else {
            return [
              String(i + 1),
              c.id,
              c.Nombre_Completo,
              c.proveedor,
              formatMXN(cost),
              formatMXN(price),
              `${profitPercent.toFixed(1)}%`
            ];
          }
        });

        const stdHead = isCommercial
          ? [['#', 'Código/Clave', 'Nombre del Articulo / Descripción', 'Proveedor', 'Precio Venta']]
          : [['#', 'Código/Clave', 'Nombre del Articulo / Descripción', 'Proveedor', 'Costo Unit.', 'P. Sugerido', 'Margen %']];

        const stdColStyles = isCommercial ? {
          0: { cellWidth: 12, halign: 'center' as const },
          1: { cellWidth: 32 },
          2: { cellWidth: 'auto' as const },
          3: { cellWidth: 40 },
          4: { cellWidth: 30, halign: 'right' as const, fontStyle: 'bold' as const }
        } : {
          0: { cellWidth: 10, halign: 'center' as const },
          1: { cellWidth: 28 },
          2: { cellWidth: 'auto' as const },
          3: { cellWidth: 32 },
          4: { cellWidth: 22, halign: 'right' as const },
          5: { cellWidth: 22, halign: 'right' as const, fontStyle: 'bold' as const },
          6: { cellWidth: 18, halign: 'center' as const }
        };

        autoTable(doc, {
          startY: 46,
          head: stdHead,
          body: catalogRows.length > 0 ? catalogRows : [[
            '-', 
            '-', 
            trimmedSearch 
              ? `No se encontraron productos con el filtro "${trimmedSearch}". Verifica el nombre o proveedor.` 
              : 'Base de datos sin registros de productos.', 
            '-', 
            '-', 
            ...(isCommercial ? [] : ['-', '-'])
          ]],
          theme: 'striped',
          styles: { fontSize: 8, cellPadding: 3 },
          headStyles: { fillColor: [16, 185, 129], fontStyle: 'bold', textColor: 255 },
          columnStyles: stdColStyles
        });

        // Page numbers footers callback
        const pagesCount = doc.internal.pages.length;
        for (let i = 1; i <= pagesCount; i++) {
          doc.setPage(i);
          doc.setFontSize(7);
          doc.setTextColor(150, 150, 150);
          doc.text(`Página ${i} de ${pagesCount} • ${isCommercial ? 'Lista de Precios F-1' : 'Auditoría Inventario de Caja F-1'}`, pageWidth - 70, doc.internal.pageSize.height - 10);
        }

        const reportName = isCommercial ? 'Comercial' : 'Administrativo';
        doc.save(`F1_Inventario_${reportName}_Estandar${safeSearchSuffix}_${Date.now()}.pdf`);
      }
    } catch (err) {
      console.error("Error generating catalog PDF:", err);
      alert("Error al cargar el catálogo de productos.");
    } finally {
      setGeneratingType(null);
    }
  };

  // STOCK ADJUSTMENTS PDF GENERATOR
  const generateAdjustmentsPdf = async () => {
    if (!user) return;
    setGeneratingType('adjustments');
    try {
      // 1. Fetch info for inventarios account
      const invInfo = await AccountResolver.assertAccount(user.uid, 'inventarios');
      const startLimitDate = new Date();
      startLimitDate.setDate(startLimitDate.getDate() - adjustmentsDays);
      
      const q = query(
        collection(db, "users", user.uid, "accounts", invInfo.accountDocId, "movements"),
        where("createdAt", ">=", Timestamp.fromDate(startLimitDate)),
        orderBy("createdAt", "desc")
      );
      const snap = await getDocs(q);
      const fetched = snap.docs.map(doc => {
        const data = doc.data();
        return {
          id: doc.id,
          amount: Number(data.amount || 0),
          direction: data.direction || 'IN',
          signedAmount: Number(data.signedAmount || 0),
          conceptTitle: String(data.conceptTitle || ''),
          conceptSubtitle: String(data.conceptSubtitle || 'Auto-ajuste'),
          source: String(data.source || ''),
          createdAt: data.createdAt?.toMillis ? new Date(data.createdAt.toMillis()) : new Date()
        };
      });

      // 2. Setup PDF
      const doc = new jsPDF();
      const pageWidth = doc.internal.pageSize.width;
      
      doc.setFillColor(79, 70, 229); // Violet/Purple
      doc.rect(0, 0, pageWidth, 38, 'F');
      
      doc.setTextColor(255, 255, 255);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(20);
      doc.text("REPORTE DE MOVIMIENTOS DE INVENTARIOS", 14, 18);
      
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(9);
      doc.text(`Ajustes, mermas, altas y ventas contabilizadas • Rango: Últimos ${adjustmentsDays} días`, 14, 25);
      doc.text(`Generado el: ${new Date().toLocaleString('es-MX')} • Total de transacciones: ${fetched.length}`, 14, 30);

      // Calculations
      let altaSum = 0;
      let bajaSum = 0;
      fetched.forEach(f => {
        if (f.direction === 'IN') altaSum += f.amount;
        else bajaSum += f.amount;
      });

      // Display high-level metrics
      doc.setDrawColor(220, 225, 235);
      doc.setFillColor(250, 251, 253);
      doc.roundedRect(14, 44, 90, 18, 2, 2, 'FD');
      doc.setFontSize(8);
      doc.setTextColor(100, 110, 120);
      doc.text("ALTAS REGISTRADAS (+)", 18, 50);
      doc.setFontSize(11);
      doc.setTextColor(16, 185, 129);
      doc.text(formatMXN(altaSum), 18, 57);

      doc.setFillColor(250, 251, 253);
      doc.roundedRect(110, 44, 86, 18, 2, 2, 'FD');
      doc.setFontSize(8);
      doc.setTextColor(100, 110, 120);
      doc.text("SALIDAS / CONVERTIDOS (-)", 114, 50);
      doc.setFontSize(11);
      doc.setTextColor(239, 68, 68);
      doc.text(formatMXN(bajaSum), 114, 57);

      const tableRows = fetched.map((item, i) => {
        const sign = item.direction === 'IN' ? '+' : '-';
        return [
          String(i + 1),
          item.createdAt.toLocaleDateString('es-MX', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }),
          item.conceptTitle,
          item.conceptSubtitle,
          item.source.toUpperCase() || 'MANUAL',
          `${sign} ${formatMXN(item.amount)}`
        ];
      });

      autoTable(doc, {
        startY: 68,
        head: [['#', 'Fecha del Ajuste', 'Concepto', 'Referencia / Cuenta', 'Canal', 'Impacto Neto']],
        body: tableRows.length > 0 ? tableRows : [['-', '-', 'No se detectaron movimientos en el rango configurado', '-', '-', '-']],
        theme: 'striped',
        styles: { fontSize: 8.5, cellPadding: 3.5 },
        headStyles: { fillColor: [79, 70, 229], fontStyle: 'bold', textColor: 255 },
        columnStyles: {
          5: { halign: 'right', fontStyle: 'bold' }
        }
      });

      const pagesCount = doc.internal.pages.length;
      for (let i = 1; i <= pagesCount; i++) {
        doc.setPage(i);
        doc.setFontSize(7);
        doc.text(`Página ${i} de ${pagesCount} • Auditoría Inventario de Caja F-1`, pageWidth - 65, doc.internal.pageSize.height - 10);
      }

      doc.save(`F1_Movimientos_Stock_${Date.now()}.pdf`);
    } catch (err) {
      console.error("Error generating adjustments PDF:", err);
      alert("Error al cargar los movimientos del inventario.");
    } finally {
      setGeneratingType(null);
    }
  };

  return (
    <div className="relative flex h-full min-h-screen w-full flex-col overflow-x-hidden max-w-md mx-auto shadow-2xl bg-slate-50 dark:bg-background-dark pb-32 font-display">
      <Sidebar isOpen={isSidebarOpen} onClose={() => setIsSidebarOpen(false)} />
      
      {/* Header */}
      <header className="sticky top-0 z-30 bg-slate-50/95 dark:bg-background-dark/95 backdrop-blur-md pt-12 px-6 pb-6 border-b border-slate-100 dark:border-white/5">
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-2">
            <button 
              onClick={() => navigate('/tools')}
              className="flex items-center justify-center w-10 h-10 rounded-full hover:bg-black/5 dark:hover:bg-white/10 transition-colors"
            >
              <span className="material-symbols-outlined text-3xl">arrow_back</span>
            </button>
            <h1 className="text-xl font-black text-slate-900 dark:text-white uppercase tracking-tight">Reportes PDF</h1>
          </div>
          <div className="flex gap-2">
            <NotificationBell />
            <ProfileMenu />
          </div>
        </div>
        <p className="text-[10px] text-slate-400 font-black uppercase tracking-[0.2em] flex items-center gap-2">
          <span className="w-4 h-[1px] bg-slate-300"></span>
          Exportador Oficial del Sistema
        </p>
      </header>

      {/* Main Content */}
      <main className="px-4 sm:px-6 py-6 space-y-6 flex-1 overflow-y-auto no-scrollbar">
        
        {/* FINANCE REPORTS CARD */}
        <section className="bg-white dark:bg-surface-dark p-4 sm:p-6 rounded-[1.5rem] sm:rounded-[2.5rem] border border-slate-100 dark:border-white/5 shadow-sm space-y-5">
          <div className="flex items-center gap-3">
            <div className="size-10 rounded-2xl bg-indigo-500/10 text-indigo-500 flex items-center justify-center">
              <span className="material-symbols-outlined text-2xl">finance</span>
            </div>
            <div>
              <h2 className="text-md font-black text-slate-800 dark:text-white uppercase tracking-tight">Resmenes Financieros</h2>
              <p className="text-[8px] font-bold text-slate-400 uppercase tracking-widest mt-0.5">Ingresos, Egresos, Balances y Listados</p>
            </div>
          </div>

          <div className="space-y-3 pt-2">
            <label className="text-[9px] font-black uppercase tracking-wider text-slate-400 block">Seleccione el Período del Reporte</label>
            <div className="grid grid-cols-5 gap-1.5">
              <button 
                onClick={() => setFinancePeriod('day')}
                className={`py-2 px-1 text-[9px] font-black rounded-xl uppercase tracking-wider border transition-all ${financePeriod === 'day' ? 'bg-indigo-500/10 text-indigo-400 border-indigo-500/30' : 'bg-transparent text-slate-500 border-slate-200 dark:border-white/5'}`}
              >
                Día
              </button>
              <button 
                onClick={() => setFinancePeriod('week')}
                className={`py-2 px-1 text-[9px] font-black rounded-xl uppercase tracking-wider border transition-all ${financePeriod === 'week' ? 'bg-indigo-500/10 text-indigo-400 border-indigo-500/30' : 'bg-transparent text-slate-500 border-slate-200 dark:border-white/5'}`}
              >
                Semana
              </button>
              <button 
                onClick={() => setFinancePeriod('month')}
                className={`py-2 px-1 text-[9px] font-black rounded-xl uppercase tracking-wider border transition-all ${financePeriod === 'month' ? 'bg-indigo-500/10 text-indigo-400 border-indigo-500/30' : 'bg-transparent text-slate-500 border-slate-200 dark:border-white/5'}`}
              >
                Mes
              </button>
              <button 
                onClick={() => setFinancePeriod('year')}
                className={`py-2 px-1 text-[9px] font-black rounded-xl uppercase tracking-wider border transition-all ${financePeriod === 'year' ? 'bg-indigo-500/10 text-indigo-400 border-indigo-500/30' : 'bg-transparent text-slate-500 border-slate-200 dark:border-white/5'}`}
              >
                Año
              </button>
              <button 
                onClick={() => setFinancePeriod('custom')}
                className={`py-2 px-1 text-[9px] font-black rounded-xl uppercase tracking-wider border transition-all ${financePeriod === 'custom' ? 'bg-indigo-500/10 text-indigo-400 border-indigo-500/30' : 'bg-transparent text-slate-500 border-slate-200 dark:border-white/5'}`}
              >
                Pers.
              </button>
            </div>

            {financePeriod === 'custom' && (
              <div className="grid grid-cols-2 gap-3 pt-2 border-t border-slate-150 dark:border-white/5">
                <div className="space-y-1">
                  <span className="text-[8px] font-black uppercase text-slate-400">Fecha Inicio</span>
                  <input 
                    type="date" 
                    value={customStartDate} 
                    onChange={e => setCustomStartDate(e.target.value)}
                    className="w-full text-xs p-2 bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/5 rounded-xl text-slate-700 dark:text-white"
                  />
                </div>
                <div className="space-y-1">
                  <span className="text-[8px] font-black uppercase text-slate-400">Fecha Fin</span>
                  <input 
                    type="date" 
                    value={customEndDate} 
                    onChange={e => setCustomEndDate(e.target.value)}
                    className="w-full text-xs p-2 bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/5 rounded-xl text-slate-700 dark:text-white"
                  />
                </div>
              </div>
            )}

            <button 
              disabled={generatingType !== null}
              onClick={generateFinancePdf}
              className="w-full mt-3 py-3 bg-indigo-600 text-white font-black rounded-2xl flex items-center justify-center gap-2 hover:bg-indigo-700 transition-colors shadow-lg shadow-indigo-600/10 disabled:opacity-50"
            >
              {generatingType === 'finance' ? (
                <>
                  <span className="material-symbols-outlined animate-spin text-sm">sync</span>
                  <span className="text-[10px] font-black tracking-widest uppercase">Generando PDF...</span>
                </>
              ) : (
                <>
                  <span className="material-symbols-outlined text-md">download_for_offline</span>
                  <span className="text-[10px] font-black tracking-widest uppercase">Descargar Reporte Financiero</span>
                </>
              )}
            </button>
          </div>
        </section>

        {/* MARGINS & PROFITS CARD */}
        <section className="bg-white dark:bg-surface-dark p-4 sm:p-6 rounded-[1.5rem] sm:rounded-[2.5rem] border border-slate-100 dark:border-white/5 shadow-sm space-y-5">
          <div className="flex items-center gap-3">
            <div className="size-10 rounded-2xl bg-indigo-500/10 text-indigo-500 flex items-center justify-center">
              <span className="material-symbols-outlined text-2xl">percent</span>
            </div>
            <div>
              <h2 className="text-md font-black text-slate-800 dark:text-white uppercase tracking-tight">Márgenes y Rentabilidad</h2>
              <p className="text-[8px] font-bold text-slate-400 uppercase tracking-widest mt-0.5">Auditoría de Utilidades, Costos de Reposición y Margen Neto</p>
            </div>
          </div>

          <div className="space-y-3 pt-2">
            <p className="text-[10px] text-slate-500 dark:text-slate-400 leading-relaxed">
              Genera un reporte avanzado que desglosa los márgenes operativos de cada línea de negocio, calcula el margen de ganancia comercial para abarrotes (core) y analiza el impacto proporcional del gasto administrativo conforme al periodo seleccionado arriba.
            </p>

            <button 
              disabled={generatingType !== null}
              onClick={generateMarginsPdf}
              className="w-full mt-3 py-3 bg-indigo-600 text-white font-black rounded-2xl flex items-center justify-center gap-2 hover:bg-indigo-700 transition-colors shadow-lg shadow-indigo-600/10 disabled:opacity-50"
            >
              {generatingType === 'margins' ? (
                <>
                  <span className="material-symbols-outlined animate-spin text-sm">sync</span>
                  <span className="text-[10px] font-black tracking-widest uppercase">Generando PDF...</span>
                </>
              ) : (
                <>
                  <span className="material-symbols-outlined text-md">download_for_offline</span>
                  <span className="text-[10px] font-black tracking-widest uppercase">Descargar Reporte de Márgenes</span>
                </>
              )}
            </button>
          </div>
        </section>

        {/* INVENTORY CATALOG CARD */}
        <section className="bg-white dark:bg-surface-dark p-4 sm:p-6 rounded-[1.5rem] sm:rounded-[2.5rem] border border-slate-100 dark:border-white/5 shadow-sm space-y-5">
          <div className="flex items-center gap-3">
            <div className="size-10 rounded-2xl bg-emerald-500/10 text-emerald-500 flex items-center justify-center">
              <span className="material-symbols-outlined text-2xl">inventory_2</span>
            </div>
            <div>
              <h2 className="text-md font-black text-slate-800 dark:text-white uppercase tracking-tight">Catálogo e Inventario de Productos</h2>
              <p className="text-[8px] font-bold text-slate-400 uppercase tracking-widest mt-0.5">Listas de Precios, Costos y Utilidades en PDF</p>
            </div>
          </div>

          <div className="space-y-4 pt-1">
            {/* Report Type Selector: Admin vs Commercial */}
            <div className="space-y-1">
              <label className="text-[9px] font-black uppercase tracking-wider text-slate-400 block">Tipo de Inventario</label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setCatalogType('admin')}
                  className={`p-2.5 rounded-2xl border text-left flex items-start gap-2.5 transition-all ${
                    catalogType === 'admin'
                      ? 'bg-emerald-500/10 border-emerald-500/40 text-emerald-600 dark:text-emerald-400 shadow-sm'
                      : 'bg-slate-50 dark:bg-white/5 border-slate-200 dark:border-white/5 text-slate-500 hover:border-slate-300'
                  }`}
                >
                  <span className="material-symbols-outlined text-lg mt-0.5 shrink-0">admin_panel_settings</span>
                  <div>
                    <div className="text-[10px] font-black uppercase tracking-wider">Administrativo</div>
                    <div className="text-[8px] text-slate-400 leading-tight mt-0.5">Incluye Compra, Venta y Utilidad ($)</div>
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => setCatalogType('commercial')}
                  className={`p-2.5 rounded-2xl border text-left flex items-start gap-2.5 transition-all ${
                    catalogType === 'commercial'
                      ? 'bg-emerald-500/10 border-emerald-500/40 text-emerald-600 dark:text-emerald-400 shadow-sm'
                      : 'bg-slate-50 dark:bg-white/5 border-slate-200 dark:border-white/5 text-slate-500 hover:border-slate-300'
                  }`}
                >
                  <span className="material-symbols-outlined text-lg mt-0.5 shrink-0">storefront</span>
                  <div>
                    <div className="text-[10px] font-black uppercase tracking-wider">Comercial / Mostrador</div>
                    <div className="text-[8px] text-slate-400 leading-tight mt-0.5">Solo Clave, Nombre y Precio Público</div>
                  </div>
                </button>
              </div>
            </div>

            {/* Layout Format: Compact vs Standard */}
            <div className="space-y-1">
              <label className="text-[9px] font-black uppercase tracking-wider text-slate-400 block">Diseño de Impresión</label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setCatalogFormat('compact')}
                  className={`p-2.5 rounded-2xl border text-left flex items-center gap-2 transition-all ${
                    catalogFormat === 'compact'
                      ? 'bg-emerald-500/10 border-emerald-500/40 text-emerald-600 dark:text-emerald-400 shadow-sm'
                      : 'bg-slate-50 dark:bg-white/5 border-slate-200 dark:border-white/5 text-slate-500 hover:border-slate-300'
                  }`}
                >
                  <span className="material-symbols-outlined text-base shrink-0">view_column</span>
                  <div>
                    <div className="text-[9.5px] font-black uppercase">Lista Compacta (2 Col.)</div>
                    <div className="text-[7.5px] text-emerald-500 font-bold">Ahorro de papel (~115 productos/hoja)</div>
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => setCatalogFormat('standard')}
                  className={`p-2.5 rounded-2xl border text-left flex items-center gap-2 transition-all ${
                    catalogFormat === 'standard'
                      ? 'bg-emerald-500/10 border-emerald-500/40 text-emerald-600 dark:text-emerald-400 shadow-sm'
                      : 'bg-slate-50 dark:bg-white/5 border-slate-200 dark:border-white/5 text-slate-500 hover:border-slate-300'
                  }`}
                >
                  <span className="material-symbols-outlined text-base shrink-0">table_rows</span>
                  <div>
                    <div className="text-[9.5px] font-black uppercase">Tabla Estándar</div>
                    <div className="text-[7.5px] text-slate-400">1 columna ancha tradicional</div>
                  </div>
                </button>
              </div>
            </div>

            {/* Filter Input */}
            <div className="space-y-1">
              <label className="text-[9px] font-black uppercase tracking-wider text-slate-400 block">Filtro de Proveedor / Nombre / Código / Categoría</label>
              <div className="relative">
                <input 
                  type="text" 
                  placeholder="Ej. Dunosusa, Bimbo, Sabritas, Botanas..."
                  value={catalogSearch} 
                  onChange={e => setCatalogSearch(e.target.value)}
                  className="w-full text-xs p-3 pr-8 bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/5 rounded-xl text-slate-700 dark:text-white outline-none focus:ring-2 focus:ring-emerald-500"
                />
                {catalogSearch && (
                  <button 
                    onClick={() => setCatalogSearch('')} 
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-white"
                  >
                    <span className="material-symbols-outlined text-sm">close</span>
                  </button>
                )}
              </div>
              <p className="text-[8px] text-slate-400">Escribe el nombre del proveedor para exportar únicamente sus artículos.</p>
            </div>

            {/* Limit Buttons */}
            <div className="space-y-1">
              <label className="text-[9px] font-black uppercase tracking-wider text-slate-400 block">Límite de Artículos a Exportar</label>
              <div className="grid grid-cols-5 gap-1.5">
                {[100, 250, 500, 1000, 5000].map(val => (
                  <button 
                    key={val}
                    onClick={() => setCatalogLimit(val)}
                    className={`py-2 px-1 text-[8.5px] font-black rounded-xl border transition-all ${catalogLimit === val ? 'bg-emerald-500/10 text-emerald-500 border-emerald-500/30' : 'bg-transparent text-slate-500 border-slate-200 dark:border-white/5'}`}
                  >
                    {val === 5000 ? 'Todos' : `${val}`}
                  </button>
                ))}
              </div>
            </div>

            <button 
              disabled={generatingType !== null}
              onClick={generateCatalogPdf}
              className="w-full mt-2 py-3.5 bg-emerald-600 text-white font-black rounded-2xl flex items-center justify-center gap-2 hover:bg-emerald-700 transition-colors shadow-lg shadow-emerald-600/10 disabled:opacity-50"
            >
              {generatingType === 'catalog' ? (
                <>
                  <span className="material-symbols-outlined animate-spin text-sm">sync</span>
                  <span className="text-[10px] font-black tracking-widest uppercase">Generando PDF...</span>
                </>
              ) : (
                <>
                  <span className="material-symbols-outlined text-md">download_for_offline</span>
                  <span className="text-[10px] font-black tracking-widest uppercase">
                    Descargar Inventario {catalogType === 'commercial' ? 'Comercial' : 'Administrativo'} ({catalogFormat === 'compact' ? 'Compacto' : 'Estándar'})
                  </span>
                </>
              )}
            </button>
          </div>
        </section>

        {/* STOCK ADJUSTMENTS CARD */}
        <section className="bg-white dark:bg-surface-dark p-4 sm:p-6 rounded-[1.5rem] sm:rounded-[2.5rem] border border-slate-100 dark:border-white/5 shadow-sm space-y-5">
          <div className="flex items-center gap-3">
            <div className="size-10 rounded-2xl bg-indigo-500/10 text-indigo-500 flex items-center justify-center">
              <span className="material-symbols-outlined text-2xl">manage_history</span>
            </div>
            <div>
              <h2 className="text-md font-black text-slate-800 dark:text-white uppercase tracking-tight">Kardex • Ajustes de Stock</h2>
              <p className="text-[8px] font-bold text-slate-400 uppercase tracking-widest mt-0.5">Reporte de Auditoría de Mermas y Ajustes</p>
            </div>
          </div>

          <div className="space-y-3 pt-2">
            <div className="space-y-1">
              <label className="text-[9px] font-black uppercase tracking-wider text-slate-400 block">Rango de Días de Historial</label>
              <div className="grid grid-cols-4 gap-2">
                {[7, 15, 30, 45].map(days => (
                  <button 
                    key={days}
                    onClick={() => setAdjustmentsDays(days)}
                    className={`py-2 text-[9px] font-black rounded-xl border transition-all ${adjustmentsDays === days ? 'bg-indigo-500/10 text-indigo-400 border-indigo-500/30' : 'bg-transparent text-slate-500 border-slate-200 dark:border-white/5'}`}
                  >
                    {days} Días
                  </button>
                ))}
              </div>
            </div>

            <button 
              disabled={generatingType !== null}
              onClick={generateAdjustmentsPdf}
              className="w-full mt-3 py-3 bg-indigo-600 text-white font-black rounded-2xl flex items-center justify-center gap-2 hover:bg-indigo-700 transition-colors shadow-lg shadow-indigo-600/10 disabled:opacity-50"
            >
              {generatingType === 'adjustments' ? (
                <>
                  <span className="material-symbols-outlined animate-spin text-sm">sync</span>
                  <span className="text-[10px] font-black tracking-widest uppercase">Generando PDF...</span>
                </>
              ) : (
                <>
                  <span className="material-symbols-outlined text-md">download_for_offline</span>
                  <span className="text-[10px] font-black tracking-widest uppercase">Descargar Auditoría de Stock</span>
                </>
              )}
            </button>
          </div>
        </section>

      </main>

      <BottomNav />
    </div>
  );
};

export default PdfReportsScreen;
