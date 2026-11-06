import React, { useState } from 'react';
import { OperatingProfitabilityResult } from '../types';
import { 
  TrendingUp, 
  TrendingDown, 
  DollarSign, 
  ShieldCheck, 
  ChevronDown, 
  ChevronUp, 
  HelpCircle, 
  PieChart as PieChartIcon, 
  Layers, 
  Store, 
  Users, 
  Building, 
  UtensilsCrossed, 
  Sparkles, 
  AlertCircle, 
  CheckCircle2,
  FileSpreadsheet
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';

interface OperatingProfitabilityPanelProps {
  data: OperatingProfitabilityResult;
  periodLabel?: string;
  onNavigateToStats?: () => void;
  showDetailsDefault?: boolean;
}

export const OperatingProfitabilityPanel: React.FC<OperatingProfitabilityPanelProps> = ({
  data,
  periodLabel = 'Período Seleccionado',
  onNavigateToStats,
  showDetailsDefault = false
}) => {
  const navigate = useNavigate();
  const [showOpexDetails, setShowOpexDetails] = useState(showDetailsDefault);
  const [showAuditInfo, setShowAuditInfo] = useState(false);
  const [showCentersBreakdown, setShowCentersBreakdown] = useState(false);

  const formatMXN = (val: number) => 
    new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(val);

  const isProfitable = data.utilidadOperativa >= 0;

  return (
    <section 
      id="panel-analisis-rentabilidad-operativa" 
      className="bg-white dark:bg-surface-dark p-4 sm:p-7 rounded-[2rem] border border-slate-200/80 dark:border-white/10 shadow-sm space-y-5 transition-all overflow-hidden"
    >
      {/* Header with Title & Audit Verification Badge */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-2 border-b border-slate-100 dark:border-white/5">
        <div className="space-y-1">
          <div className="flex items-center gap-2.5">
            <div className="size-9 rounded-2xl bg-indigo-500/10 dark:bg-indigo-500/20 text-indigo-600 dark:text-indigo-400 flex items-center justify-center shrink-0">
              <span className="material-symbols-outlined text-2xl font-bold">query_stats</span>
            </div>
            <div className="min-w-0">
              <h2 className="text-base sm:text-lg font-black text-slate-900 dark:text-white tracking-tight uppercase truncate">
                Análisis de Rentabilidad Operativa
              </h2>
              <p className="text-[9px] font-extrabold uppercase tracking-widest text-slate-400 truncate">
                {periodLabel} • Estado de Resultados Automatizado
              </p>
            </div>
          </div>
        </div>

        {/* Audit Status Badge */}
        <div className="flex items-center gap-2">
          {data.isCoherentWithWeeklyReport ? (
            <button 
              onClick={() => setShowAuditInfo(!showAuditInfo)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-700 dark:text-emerald-400 text-[10px] font-black uppercase tracking-wider hover:bg-emerald-500/20 transition-all"
              title="Click para ver validación matemática con reporte semanal"
            >
              <CheckCircle2 className="size-3.5 text-emerald-600 dark:text-emerald-400" />
              <span>Validado Semanal</span>
              <HelpCircle className="size-3 opacity-60 ml-0.5" />
            </button>
          ) : (
            <button 
              onClick={() => setShowAuditInfo(!showAuditInfo)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-amber-500/10 border border-amber-500/30 text-amber-700 dark:text-amber-400 text-[10px] font-black uppercase tracking-wider hover:bg-amber-500/20 transition-all"
            >
              <AlertCircle className="size-3.5 text-amber-600 dark:text-amber-400" />
              <span>Revisar Arqueo</span>
            </button>
          )}
        </div>
      </div>

      {/* Explanatory Audit Banner if clicked */}
      {showAuditInfo && (
        <div className="p-3.5 rounded-2xl bg-indigo-50/70 dark:bg-indigo-950/30 border border-indigo-100 dark:border-indigo-900/40 text-[11px] leading-relaxed text-slate-700 dark:text-slate-300 space-y-2 animate-fadeIn">
          <div className="flex items-center gap-2 text-indigo-700 dark:text-indigo-400 font-black text-xs uppercase">
            <ShieldCheck className="size-4" />
            <span>Auditoría y Conciliación Operativa</span>
          </div>
          <p>
            El cálculo resta de forma automatizada todos los gastos operativos (<span className="font-bold">sueldos, renta, consumos de empleados al 82% real, cortesías, faltantes y gastos administrativos</span>) de la <span className="font-bold">Utilidad Bruta</span>.
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 pt-1 font-mono text-[10px]">
            <div className="bg-white/80 dark:bg-black/30 p-2.5 rounded-xl border border-indigo-100/60 dark:border-white/5">
              <span className="text-slate-400 block text-[9px] font-sans font-bold">UTILIDAD BRUTA</span>
              <span className="font-bold text-slate-800 dark:text-slate-200 block text-[10px] break-words">
                {formatMXN(data.ventasTotales)} - {formatMXN(data.costoVentasTotal)} = {formatMXN(data.utilidadBruta)}
              </span>
            </div>
            <div className="bg-white/80 dark:bg-black/30 p-2.5 rounded-xl border border-indigo-100/60 dark:border-white/5">
              <span className="text-slate-400 block text-[9px] font-sans font-bold">TOTAL GASTOS OPERATIVOS</span>
              <span className="font-bold text-rose-600 dark:text-rose-400 block text-[10px]">
                - {formatMXN(data.totalGastosOperativos)}
              </span>
            </div>
            <div className="bg-white/80 dark:bg-black/30 p-2.5 rounded-xl border border-indigo-100/60 dark:border-white/5">
              <span className="text-slate-400 block text-[9px] font-sans font-bold">UTILIDAD OPERATIVA RESULTANTE</span>
              <span className={`font-bold block text-[10px] ${isProfitable ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}`}>
                = {formatMXN(data.utilidadOperativa)} ({data.margenOperativo.toFixed(1)}%)
              </span>
            </div>
          </div>
        </div>
      )}

      {/* Main KPI Summary Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {/* KPI 1: Utilidad Operativa Neta */}
        <div className={`p-4 rounded-2xl border transition-all ${
          isProfitable 
            ? 'bg-gradient-to-br from-emerald-500/10 via-emerald-500/5 to-transparent border-emerald-500/20 text-emerald-950 dark:text-emerald-100' 
            : 'bg-gradient-to-br from-rose-500/10 via-rose-500/5 to-transparent border-rose-500/20 text-rose-950 dark:text-rose-100'
        }`}>
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-black uppercase tracking-wider text-slate-500 dark:text-slate-400">
              Utilidad Operativa
            </span>
            <div className={`size-7 rounded-xl flex items-center justify-center ${isProfitable ? 'bg-emerald-500/20 text-emerald-600' : 'bg-rose-500/20 text-rose-600'}`}>
              {isProfitable ? <TrendingUp className="size-4" /> : <TrendingDown className="size-4" />}
            </div>
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <h3 className={`text-xl sm:text-2xl font-black tracking-tight font-mono ${isProfitable ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}`}>
              {formatMXN(data.utilidadOperativa)}
            </h3>
          </div>
          <div className="mt-2 flex items-center justify-between text-[10px] font-bold text-slate-500 dark:text-slate-400">
            <span>Margen Operativo</span>
            <span className={`font-black px-2 py-0.5 rounded-md ${isProfitable ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400' : 'bg-rose-500/10 text-rose-600 dark:text-rose-400'}`}>
              {data.margenOperativo.toFixed(1)}%
            </span>
          </div>
        </div>

        {/* KPI 2: Utilidad Bruta */}
        <div className="p-4 rounded-2xl bg-slate-50/80 dark:bg-white/[0.02] border border-slate-200/70 dark:border-white/5 space-y-1">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-black uppercase tracking-wider text-slate-500 dark:text-slate-400">
              Utilidad Bruta
            </span>
            <span className="text-[10px] font-extrabold text-indigo-600 dark:text-indigo-400">
              MB: {data.margenBruto.toFixed(1)}%
            </span>
          </div>
          <h3 className="text-xl sm:text-2xl font-black text-slate-800 dark:text-white tracking-tight font-mono">
            {formatMXN(data.utilidadBruta)}
          </h3>
          <p className="text-[8.5px] font-bold text-slate-400 truncate">
            Ventas {formatMXN(data.ventasTotales)} • Costo {formatMXN(data.costoVentasTotal)}
          </p>
        </div>

        {/* KPI 3: Gastos Operativos Totales */}
        <div className="p-4 rounded-2xl bg-slate-50/80 dark:bg-white/[0.02] border border-slate-200/70 dark:border-white/5 space-y-1">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-black uppercase tracking-wider text-slate-500 dark:text-slate-400">
              Gastos Operativos (OPEX)
            </span>
            <span className="text-[10px] font-extrabold text-rose-600 dark:text-rose-400">
              {data.gastosOperativosPercent.toFixed(1)}% Vtas
            </span>
          </div>
          <h3 className="text-xl sm:text-2xl font-black text-rose-600 dark:text-rose-400 tracking-tight font-mono">
            {formatMXN(data.totalGastosOperativos)}
          </h3>
          <p className="text-[8.5px] font-bold text-slate-400 truncate">
            Nómina, renta, consumos y fijos
          </p>
        </div>
      </div>

      {/* Interactive Waterfall Breakdown */}
      <div className="p-3.5 sm:p-5 rounded-2xl bg-slate-50/60 dark:bg-white/[0.02] border border-slate-200/60 dark:border-white/5 space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <h4 className="text-xs font-black uppercase tracking-wider text-slate-700 dark:text-slate-200 flex items-center gap-2 min-w-0">
            <Layers className="size-4 text-indigo-500 shrink-0" />
            <span className="truncate">Cascada de Rentabilidad y Deducciones</span>
          </h4>
          <button 
            onClick={() => setShowOpexDetails(!showOpexDetails)}
            className="text-[10px] font-bold text-indigo-600 dark:text-indigo-400 hover:underline flex items-center gap-1 shrink-0 self-start sm:self-auto"
          >
            <span>{showOpexDetails ? 'Ocultar Desglose' : 'Ver Desglose de Gastos'}</span>
            {showOpexDetails ? <ChevronUp className="size-3.5" /> : <ChevronDown className="size-3.5" />}
          </button>
        </div>

        {/* Waterfall Steps */}
        <div className="space-y-2 text-xs">
          {/* 1. Ventas Totales */}
          <div className="flex items-start justify-between gap-2.5 p-3 rounded-2xl bg-white dark:bg-surface-dark border border-slate-100 dark:border-white/5 min-w-0 shadow-sm">
            <div className="flex items-start gap-2.5 min-w-0 flex-1">
              <span className="size-5 rounded-full bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 flex items-center justify-center font-black text-[10px] shrink-0 mt-0.5">+</span>
              <div className="min-w-0 flex-1">
                <span className="font-bold text-slate-800 dark:text-slate-200 block text-xs truncate">Ventas Totales Brutas</span>
                <span className="text-[9px] text-slate-400 font-semibold block leading-tight mt-0.5 break-words">
                  Contado: {formatMXN(data.ventasContado)} • Crédito: {formatMXN(data.ventasCredito)}
                </span>
              </div>
            </div>
            <div className="text-right shrink-0">
              <span className="font-black text-slate-900 dark:text-white font-mono text-xs sm:text-sm block">{formatMXN(data.ventasTotales)}</span>
            </div>
          </div>

          {/* 2. Costo de Ventas */}
          <div className="flex items-start justify-between gap-2.5 p-3 rounded-2xl bg-white dark:bg-surface-dark border border-slate-100 dark:border-white/5 min-w-0 shadow-sm">
            <div className="flex items-start gap-2.5 min-w-0 flex-1">
              <span className="size-5 rounded-full bg-slate-500/10 text-slate-600 dark:text-slate-400 flex items-center justify-center font-black text-[10px] shrink-0 mt-0.5">-</span>
              <div className="min-w-0 flex-1">
                <span className="font-bold text-slate-800 dark:text-slate-200 block text-xs truncate">Costo de Ventas (COGS / Reposición)</span>
                <span className="text-[9px] text-slate-400 font-semibold block leading-tight mt-0.5">
                  Reposición de inventario ({((data.costoVentasTotal / (data.ventasTotales || 1)) * 100).toFixed(1)}%)
                </span>
              </div>
            </div>
            <div className="text-right shrink-0">
              <span className="font-black text-rose-600 dark:text-rose-400 font-mono text-xs sm:text-sm block">-{formatMXN(data.costoVentasTotal)}</span>
            </div>
          </div>

          {/* 3. Utilidad Bruta */}
          <div className="flex items-start justify-between gap-2.5 p-3 rounded-2xl bg-indigo-50/60 dark:bg-indigo-950/20 border border-indigo-100 dark:border-indigo-900/30 min-w-0 shadow-sm">
            <div className="flex items-start gap-2.5 min-w-0 flex-1">
              <span className="size-5 rounded-full bg-indigo-500/20 text-indigo-700 dark:text-indigo-300 flex items-center justify-center font-black text-[10px] shrink-0 mt-0.5">=</span>
              <div className="min-w-0 flex-1">
                <span className="font-black text-indigo-900 dark:text-indigo-200 uppercase tracking-tight text-xs block">Utilidad Bruta</span>
                <span className="text-[9px] text-indigo-600 dark:text-indigo-400 font-bold block leading-tight mt-0.5">
                  Margen Comercial: {data.margenBruto.toFixed(1)}%
                </span>
              </div>
            </div>
            <div className="text-right shrink-0">
              <span className="font-black text-indigo-700 dark:text-indigo-300 font-mono text-xs sm:text-sm block">{formatMXN(data.utilidadBruta)}</span>
            </div>
          </div>

          {/* 4. Gastos Operativos Deducidos */}
          <div className="flex items-start justify-between gap-2.5 p-3 rounded-2xl bg-white dark:bg-surface-dark border border-slate-100 dark:border-white/5 min-w-0 shadow-sm">
            <div className="flex items-start gap-2.5 min-w-0 flex-1">
              <span className="size-5 rounded-full bg-rose-500/10 text-rose-600 flex items-center justify-center font-black text-[10px] shrink-0 mt-0.5">-</span>
              <div className="min-w-0 flex-1">
                <span className="font-bold text-slate-800 dark:text-slate-200 block text-xs truncate">Gastos Operativos (OPEX)</span>
                <span className="text-[9px] text-slate-400 font-semibold block leading-tight mt-0.5">
                  Nómina, renta y fijos ({data.gastosOperativosPercent.toFixed(1)}% de ventas)
                </span>
              </div>
            </div>
            <div className="text-right shrink-0">
              <span className="font-black text-rose-600 dark:text-rose-400 font-mono text-xs sm:text-sm block">-{formatMXN(data.totalGastosOperativos)}</span>
            </div>
          </div>

          {/* Detailed OPEX Items Sub-table */}
          {showOpexDetails && (
            <div className="pl-3 sm:pl-6 pr-2 py-2 space-y-1.5 border-l-2 border-rose-400/40 my-2 animate-fadeIn bg-rose-50/20 dark:bg-rose-950/10 rounded-r-xl min-w-0">
              <p className="text-[9px] font-black uppercase tracking-wider text-rose-600 dark:text-rose-400">
                Desglose Automatizado de Egresos Operativos:
              </p>
              
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-[10px]">
                {/* Sueldos */}
                <div className="p-2 rounded-lg bg-white dark:bg-surface-dark border border-slate-100 dark:border-white/5">
                  <span className="text-slate-400 block text-[8px] font-bold uppercase truncate">Sueldos / Nómina</span>
                  <span className="font-black text-slate-800 dark:text-white font-mono text-[10px] block truncate">{formatMXN(data.sueldos)}</span>
                </div>
                {/* Renta */}
                <div className="p-2 rounded-lg bg-white dark:bg-surface-dark border border-slate-100 dark:border-white/5">
                  <span className="text-slate-400 block text-[8px] font-bold uppercase truncate">Renta Local</span>
                  <span className="font-black text-slate-800 dark:text-white font-mono text-[10px] block truncate">{formatMXN(data.renta)}</span>
                </div>
                {/* Consumo Empleados */}
                <div className="p-2 rounded-lg bg-white dark:bg-surface-dark border border-slate-100 dark:border-white/5">
                  <span className="text-slate-400 block text-[8px] font-bold uppercase truncate">Consumo Empleados</span>
                  <span className="font-black text-slate-800 dark:text-white font-mono text-[10px] block truncate">{formatMXN(data.consumoEmpleados)}</span>
                </div>
                {/* Cortesías / Personal */}
                <div className="p-2 rounded-lg bg-white dark:bg-surface-dark border border-slate-100 dark:border-white/5">
                  <span className="text-slate-400 block text-[8px] font-bold uppercase truncate">Cortesías / Personal</span>
                  <span className="font-black text-slate-800 dark:text-white font-mono text-[10px] block truncate">{formatMXN(data.cortesias)}</span>
                </div>
                {/* Gastos Administrativos */}
                <div className="p-2 rounded-lg bg-white dark:bg-surface-dark border border-slate-100 dark:border-white/5">
                  <span className="text-slate-400 block text-[8px] font-bold uppercase truncate">Admón. & Mantenimiento</span>
                  <span className="font-black text-slate-800 dark:text-white font-mono text-[10px] block truncate">{formatMXN(data.gastosAdministrativos)}</span>
                </div>
                {/* Bonos */}
                <div className="p-2 rounded-lg bg-white dark:bg-surface-dark border border-slate-100 dark:border-white/5">
                  <span className="text-slate-400 block text-[8px] font-bold uppercase truncate">Bonos / Incentivos</span>
                  <span className="font-black text-slate-800 dark:text-white font-mono text-[10px] block truncate">{formatMXN(data.bonos)}</span>
                </div>
                {/* Faltantes */}
                <div className="p-2 rounded-lg bg-white dark:bg-surface-dark border border-slate-100 dark:border-white/5">
                  <span className="text-slate-400 block text-[8px] font-bold uppercase truncate">Faltantes Arqueo</span>
                  <span className="font-black text-slate-800 dark:text-white font-mono text-[10px] block truncate">{formatMXN(data.faltantes)}</span>
                </div>
                {/* Otros */}
                <div className="p-2 rounded-lg bg-white dark:bg-surface-dark border border-slate-100 dark:border-white/5">
                  <span className="text-slate-400 block text-[8px] font-bold uppercase truncate">Otros Operativos</span>
                  <span className="font-black text-slate-800 dark:text-white font-mono text-[10px] block truncate">{formatMXN(data.otrosGastos)}</span>
                </div>
              </div>
            </div>
          )}

          {/* 5. Utilidad Operativa Final */}
          <div className={`flex items-start justify-between gap-2.5 p-3 rounded-2xl border min-w-0 shadow-sm ${
            isProfitable 
              ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-950 dark:text-emerald-100' 
              : 'bg-rose-500/10 border-rose-500/30 text-rose-950 dark:text-rose-100'
          }`}>
            <div className="flex items-start gap-2.5 min-w-0 flex-1">
              <span className={`size-5 rounded-full flex items-center justify-center font-black text-xs shrink-0 mt-0.5 ${isProfitable ? 'bg-emerald-500 text-white' : 'bg-rose-500 text-white'}`}>=</span>
              <div className="min-w-0 flex-1">
                <span className="font-black uppercase tracking-tight text-xs block truncate">Utilidad Operativa Neta</span>
                <span className="text-[9px] font-bold opacity-80 block leading-tight mt-0.5">Margen Operativo Real: {data.margenOperativo.toFixed(1)}%</span>
              </div>
            </div>
            <div className="text-right shrink-0">
              <span className={`font-black text-sm sm:text-base font-mono block ${isProfitable ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}`}>
                {formatMXN(data.utilidadOperativa)}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Centers Breakdown Toggle */}
      {data.centrosList && data.centrosList.length > 0 && (
        <div className="space-y-3 pt-1">
          <button 
            onClick={() => setShowCentersBreakdown(!showCentersBreakdown)}
            className="w-full flex items-center justify-between p-3 rounded-xl bg-slate-50 dark:bg-white/[0.02] border border-slate-200/60 dark:border-white/5 hover:bg-slate-100/60 transition-colors text-xs font-bold text-slate-700 dark:text-slate-300"
          >
            <div className="flex items-center gap-2">
              <Store className="size-4 text-indigo-500" />
              <span>Ver Rentabilidad por Centro de Utilidad ({data.centrosList.length} líneas)</span>
            </div>
            {showCentersBreakdown ? <ChevronUp className="size-4" /> : <ChevronDown className="size-4" />}
          </button>

          {showCentersBreakdown && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-1 animate-fadeIn">
              {data.centrosList.map(centro => (
                <div key={centro.name} className="p-3 rounded-xl bg-white dark:bg-surface-dark border border-slate-100 dark:border-white/5 space-y-1.5">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-black uppercase text-slate-800 dark:text-slate-100">{centro.name}</span>
                    <span className="text-[10px] font-bold text-indigo-600 dark:text-indigo-400">{centro.participacion.toFixed(1)}% Vtas</span>
                  </div>
                  <div className="grid grid-cols-3 gap-1 text-[9px] pt-1 border-t border-slate-100 dark:border-white/5">
                    <div>
                      <span className="text-slate-400 block font-semibold">Ventas</span>
                      <span className="font-bold text-slate-700 dark:text-slate-200">{formatMXN(centro.ventas)}</span>
                    </div>
                    <div>
                      <span className="text-slate-400 block font-semibold">Util. Bruta</span>
                      <span className="font-bold text-indigo-600 dark:text-indigo-400">{formatMXN(centro.utilidadBruta)}</span>
                    </div>
                    <div>
                      <span className="text-slate-400 block font-semibold">Margen</span>
                      <span className="font-bold text-emerald-600 dark:text-emerald-400">{centro.margenBruto.toFixed(1)}%</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Direct Navigation Button to Full Financial Tools */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-2 border-t border-slate-100 dark:border-white/5">
        <p className="text-[10px] text-slate-400 font-bold flex items-center gap-1.5">
          <ShieldCheck className="size-3.5 text-emerald-500" />
          <span>Fórmula: Utilidad Operativa = Ventas - Costos Reposición - OPEX Total</span>
        </p>
        <div className="flex items-center gap-2 w-full sm:w-auto">
          <button 
            onClick={() => onNavigateToStats ? onNavigateToStats() : navigate('/finance-stats')}
            className="flex-1 sm:flex-none px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-[10px] font-black uppercase tracking-wider rounded-xl transition-all shadow-md shadow-indigo-600/10 flex items-center justify-center gap-1.5"
          >
            <span>Ver Auditoría Completa E.R</span>
            <span className="material-symbols-outlined text-sm">arrow_forward</span>
          </button>
          <button 
            onClick={() => navigate('/tools/pdf-reports')}
            className="px-3 py-2 bg-slate-100 dark:bg-white/5 hover:bg-slate-200 dark:hover:bg-white/10 text-slate-700 dark:text-slate-200 text-[10px] font-black uppercase tracking-wider rounded-xl transition-all flex items-center justify-center gap-1.5"
            title="Descargar Reporte PDF Semanal"
          >
            <FileSpreadsheet className="size-3.5 text-indigo-500" />
            <span className="hidden sm:inline">Reporte PDF</span>
          </button>
        </div>
      </div>
    </section>
  );
};

export default OperatingProfitabilityPanel;
