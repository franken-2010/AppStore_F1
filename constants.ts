
import { ActivityItem, HistoryItem } from './types';

export const APP_VERSION: string = '1.2.5';

export const RECENT_CORTES: HistoryItem[] = [
  { id: 'h1', date: 'Hoy', description: 'Corte de caja matutino', amount: 12450.00, status: 'completed' },
  { id: 'h2', date: 'Ayer', description: 'Corte de caja final', amount: 18920.50, status: 'completed' },
  { id: 'h3', date: '25 Oct', description: 'Diferencia detectada (-$120)', amount: 15400.00, status: 'revision' },
];

export const QUICK_STATS = [
  { label: 'Ventas (7d)', value: '$124,500', icon: 'trending_up', color: 'text-emerald-500' },
  { label: 'Balance Caja', value: 'Cuadrado', icon: 'account_balance_wallet', color: 'text-blue-500' },
];
