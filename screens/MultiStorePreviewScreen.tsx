import React, { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  allocateOverheadExpenses,
  calculateCashClosing,
  F1_CATEGORY_LABELS,
  F1_STORES,
  type AllocationBase,
  type CashClosingInput,
  type OverheadExpense,
  type SalesCategoryId,
  type StoreId,
} from '../services/multiStoreAccounting';

/**
 * Pantalla experimental sin lecturas ni escrituras de Firestore.
 * No utilizar sus resultados para registrar un corte real.
 */
type CashFields = Pick<CashClosingInput,
  'openingCash' | 'countedCash' | 'cashCollections' |
  'cashPurchases' | 'cashOperatingExpenses' | 'cashWithdrawals'
>;

const initialSales: Record<SalesCategoryId, number> = {
  abarrotes: 2500,
  fiesta: 700,
  recargas: 380,
  estancias: 450,
  frutas_verduras: 1250,
  pan_galletas: 650,
  comida_preparada: 990,
};

const initialCash: Record<StoreId, CashFields> = {
  local_01: {
    openingCash: 500,
    countedCash: 3370,
    cashCollections: 0,
    cashPurchases: 950,
    cashOperatingExpenses: 230,
    cashWithdrawals: 0,
  },
  local_02: {
    openingCash: 400,
    countedCash: 2550,
    cashCollections: 0,
    cashPurchases: 560,
    cashOperatingExpenses: 160,
    cashWithdrawals: 0,
  },
};

const fmt = (amount: number): string =>
  new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(amount);

function parsePositiveNumber(value: string): number {
  const normalized = value.replace(',', '.').trim();
  if (normalized === '') return 0;
  const number = Number(normalized);
  if (!Number.isFinite(number)) return 0;
  return Math.max(0, Math.round(number * 100) / 100);
}

interface MoneyFieldProps {
  label: string;
  value: number;
  onChange: (number: number) => void;
}

function MoneyField({ label, value, onChange }: MoneyFieldProps) {
  return (
    <label className="flex items-center gap-3 justify-between py-2">
      <span className="text-xs font-semibold text-slate-700 dark:text-slate-200">{label}</span>
      <input
        type="number"
        inputMode="decimal"
        min="0"
        step="0.01"
        value={value}
        onChange={e => onChange(parsePositiveNumber(e.target.value))}
        aria-label={label}
        className="w-36 max-w-[45%] rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-right font-semibold tabular-nums text-slate-900 outline-none focus:border-blue-500 dark:border-slate-700 dark:bg-slate-900 dark:text-white"
      />
    </label>
  );
}

const MultiStorePreviewScreen: React.FC = () => {
  const navigate = useNavigate();
  const [storeId, setStoreId] = useState<StoreId>('local_01');
  const [sales, setSales] = useState<Record<SalesCategoryId, number>>(initialSales);
  const [cash, setCash] = useState<Record<StoreId, CashFields>>(initialCash);
  const [companyExpenses, setCompanyExpenses] = useState(1200);
  const [localExpenses, setLocalExpenses] = useState<Record<StoreId, number>>({
    local_01: 300,
    local_02: 200,
  });

  const closings = useMemo(() => F1_STORES.map(store => {
    const values = cash[store.id];
    return calculateCashClosing({
      storeId: store.id,
      dateKey: '2026-11-06',
      categorySales: store.categories.map(categoryId => ({
        categoryId,
        cashSales: sales[categoryId],
      })),
      openingCash: values.openingCash,
      countedCash: values.countedCash,
      cashCollections: values.cashCollections,
      cashPurchases: values.cashPurchases,
      cashOperatingExpenses: values.cashOperatingExpenses,
      cashWithdrawals: values.cashWithdrawals,
    });
  }), [sales, cash]);

  const allocations = useMemo(() => {
    const bases: AllocationBase[] = F1_STORES.flatMap(store =>
      store.categories.map(categoryId => ({
        storeId: store.id,
        categoryId,
        // Para Recargas se sustituirá por comisión reconocida al activar producción.
        eligibleRevenue: sales[categoryId],
      })),
    );
    const expenses: OverheadExpense[] = [
      { id: 'compartidos', concept: 'Gastos compartidos', amount: companyExpenses, scope: { kind: 'company' } },
      { id: 'local_01', concept: 'Gastos Local 1', amount: localExpenses.local_01, scope: { kind: 'store', storeId: 'local_01' } },
      { id: 'local_02', concept: 'Gastos Local 2', amount: localExpenses.local_02, scope: { kind: 'store', storeId: 'local_02' } },
    ];
    return allocateOverheadExpenses(bases, expenses);
  }, [sales, companyExpenses, localExpenses]);

  const active = F1_STORES.find(store => store.id === storeId)!;
  const activeClosing = closings.find(cut => cut.storeId === storeId)!;
  const totalSales = closings.reduce((sum, cut) => sum + cut.classifiedTotalSales, 0);
  const totalVariances = closings.reduce((sum, cut) => sum + cut.variance, 0);

  const setSalesValue = (categoryId: SalesCategoryId, value: number) =>
    setSales(previous => ({ ...previous, [categoryId]: value }));
  const setCashValue = (field: keyof CashFields, value: number) =>
    setCash(previous => ({ ...previous, [storeId]: { ...previous[storeId], [field]: value } }));

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 dark:bg-background-dark dark:text-white">
      <header className="mx-auto max-w-3xl px-5 pt-8 pb-4">
        <button type="button" onClick={() => navigate('/tools')}
          className="inline-flex items-center gap-2 text-sm font-semibold text-blue-700 dark:text-blue-300">
          <span className="material-symbols-outlined">arrow_back</span> Volver a Herramientas
        </button>
        <div className="mt-5 flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-2xl font-black tracking-tight">F1 · Dos locales</h1>
            <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">Simulador de caja y distribución de gastos</p>
          </div>
          <span className="rounded-full bg-amber-100 px-3 py-1 text-xs font-black text-amber-900">MODO PRUEBA</span>
        </div>
        <p className="mt-4 rounded-xl border border-blue-200 bg-blue-50 px-4 py-3 text-xs font-semibold text-blue-900 dark:border-blue-900 dark:bg-blue-950 dark:text-blue-200">
          Datos ficticios. No se lee ni guarda información en Firebase. Esta pantalla NO sustituye el corte de caja actual.
        </p>
      </header>

      <main className="mx-auto max-w-3xl space-y-5 px-5 pb-20">
        <div className="grid grid-cols-2 gap-3">
          {F1_STORES.map(store => (
            <button key={store.id} type="button" onClick={() => setStoreId(store.id)}
              aria-pressed={storeId === store.id}
              className={'rounded-2xl border p-4 text-left transition-colors ' +
                (storeId === store.id
                  ? 'border-blue-600 bg-blue-600 text-white shadow-md'
                  : 'border-slate-200 bg-white text-slate-700 dark:border-slate-700 dark:bg-surface-dark dark:text-slate-200')}>
              <span className="material-symbols-outlined mb-2 block">storefront</span>
              <span className="block text-sm font-black">{store.id === 'local_01' ? 'Local 1' : 'Local 2'}</span>
              <span className="block text-xs opacity-75">{store.id === 'local_01' ? 'Tienda actual' : 'Ampliación'}</span>
            </button>
          ))}
        </div>

        <section className="rounded-2xl bg-white p-5 shadow-sm dark:bg-surface-dark">
          <h2 className="text-base font-black">Ventas por categoría · {active.name}</h2>
          <p className="mb-3 mt-1 text-xs text-slate-500 dark:text-slate-400">
            Solo ingresos cobrados en efectivo. No se registran tarjetas ni transferencias.
          </p>
          {active.categories.map(categoryId => (
            <MoneyField key={categoryId} label={F1_CATEGORY_LABELS[categoryId]}
              value={sales[categoryId]} onChange={value => setSalesValue(categoryId, value)}/>
          ))}
          <div className="mt-3 flex justify-between border-t border-slate-200 pt-3 font-black dark:border-slate-700">
            <span>Total de ventas clasificadas</span>
            <span className="tabular-nums">{fmt(activeClosing.classifiedTotalSales)}</span>
          </div>
        </section>

        <section className="rounded-2xl bg-white p-5 shadow-sm dark:bg-surface-dark">
          <h2 className="mb-2 text-base font-black">Conciliación de efectivo</h2>
          <MoneyField label="Fondo inicial" value={cash[storeId].openingCash}
            onChange={value => setCashValue('openingCash', value)}/>
          <MoneyField label="Cobranza de créditos anteriores (no es venta)"
            value={cash[storeId].cashCollections ?? 0}
            onChange={value => setCashValue('cashCollections', value)}/>
          <MoneyField label="Compras pagadas con efectivo" value={cash[storeId].cashPurchases ?? 0}
            onChange={value => setCashValue('cashPurchases', value)}/>
          <MoneyField label="Gastos operativos pagados con efectivo" value={cash[storeId].cashOperatingExpenses ?? 0}
            onChange={value => setCashValue('cashOperatingExpenses', value)}/>
          <MoneyField label="Retiros de efectivo" value={cash[storeId].cashWithdrawals ?? 0}
            onChange={value => setCashValue('cashWithdrawals', value)}/>
          <MoneyField label="Dinero contado al cierre" value={cash[storeId].countedCash}
            onChange={value => setCashValue('countedCash', value)}/>
          <div className="mt-3 space-y-2 rounded-xl bg-slate-100 p-4 dark:bg-slate-900">
            <div className="flex justify-between text-sm">
              <span>Efectivo esperado</span><strong className="tabular-nums">{fmt(activeClosing.expectedCash)}</strong>
            </div>
            <div className="flex justify-between text-sm">
              <span>Dinero contado</span><strong className="tabular-nums">{fmt(activeClosing.countedCash)}</strong>
            </div>
            <div className="flex justify-between border-t border-slate-300 pt-2 text-sm dark:border-slate-700">
              <strong>{activeClosing.variance > 0 ? 'Sobrante por identificar'
                : activeClosing.variance < 0 ? 'Faltante por investigar' : 'Caja cuadrada'}</strong>
              <strong className={'tabular-nums ' + (activeClosing.variance < 0 ? 'text-rose-600'
                : activeClosing.variance > 0 ? 'text-amber-600' : 'text-emerald-600')}>
                {fmt(Math.abs(activeClosing.variance))}
              </strong>
            </div>
          </div>
          <p className="mt-3 text-xs text-slate-500 dark:text-slate-400">
            Los sobrantes incrementan el indicador general de caja ajustada, pero no las ventas ni la utilidad de ninguna categoría.
          </p>
        </section>

        <section className="rounded-2xl bg-white p-5 shadow-sm dark:bg-surface-dark">
          <h2 className="text-base font-black">Gastos administrativos proporcionales</h2>
          <p className="mb-3 mt-1 text-xs text-slate-500 dark:text-slate-400">
            Gastos ficticios asignados según las ventas elegibles de las siete categorías.
          </p>
          <MoneyField label="Gastos comunes a ambos locales" value={companyExpenses} onChange={setCompanyExpenses}/>
          <MoneyField label="Gastos exclusivos Local 1" value={localExpenses.local_01}
            onChange={value => setLocalExpenses(previous => ({ ...previous, local_01: value }))}/>
          <MoneyField label="Gastos exclusivos Local 2" value={localExpenses.local_02}
            onChange={value => setLocalExpenses(previous => ({ ...previous, local_02: value }))}/>
          <div className="mt-4 overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-slate-200 text-slate-500 dark:border-slate-700">
                  <th className="py-2">Categoría</th>
                  <th className="py-2 text-right">Ventas</th>
                  <th className="py-2 text-right">Gasto asignado</th>
                </tr>
              </thead>
              <tbody>
                {F1_STORES.flatMap(store => store.categories.map(categoryId => {
                  const assigned = allocations.allocations
                    .filter(item => item.storeId === store.id && item.categoryId === categoryId)
                    .reduce((sum, item) => sum + item.amount, 0);
                  return (
                    <tr key={categoryId} className="border-b border-slate-100 dark:border-slate-800">
                      <td className="py-2">{F1_CATEGORY_LABELS[categoryId]}</td>
                      <td className="py-2 text-right tabular-nums">{fmt(sales[categoryId])}</td>
                      <td className="py-2 text-right font-semibold tabular-nums">{fmt(assigned)}</td>
                    </tr>
                  );
                }))}
              </tbody>
            </table>
          </div>
          <div className="mt-3 flex justify-between text-sm font-black">
            <span>Total distribuido</span>
            <span className="tabular-nums">{fmt(allocations.totalAllocated)}</span>
          </div>
          {allocations.totalUnallocated > 0 && (
            <p className="mt-3 text-xs font-semibold text-amber-700">
              {fmt(allocations.totalUnallocated)} sin distribuir: no existen ventas elegibles para ese gasto.
            </p>
          )}
          <p className="mt-3 text-xs text-slate-500 dark:text-slate-400">
            En esta simulación, Recargas utiliza sus ventas brutas como base provisional.
            Antes del uso real, verificaremos si debe usar únicamente el ingreso por comisión.
          </p>
        </section>

        <section className="rounded-2xl border border-blue-200 bg-blue-50 p-5 dark:border-blue-900 dark:bg-blue-950">
          <h2 className="text-base font-black">Consolidado de ambos locales</h2>
          <div className="mt-3 grid grid-cols-2 gap-3 text-sm">
            <div><p className="text-xs opacity-70">Ventas clasificadas</p><strong className="tabular-nums">{fmt(totalSales)}</strong></div>
            <div><p className="text-xs opacity-70">Gastos asignados</p><strong className="tabular-nums">{fmt(allocations.totalAllocated)}</strong></div>
            <div><p className="text-xs opacity-70">Diferencias netas de caja</p><strong className="tabular-nums">{fmt(totalVariances)}</strong></div>
            <div><p className="text-xs opacity-70">Gastos pendientes</p><strong className="tabular-nums">{fmt(allocations.totalUnallocated)}</strong></div>
          </div>
          <p className="mt-4 text-xs opacity-80">
            No se presenta utilidad operativa: faltan costos de mercancía vendida y otros datos necesarios para estimarla.
          </p>
        </section>
      </main>
    </div>
  );
};

export default MultiStorePreviewScreen;
