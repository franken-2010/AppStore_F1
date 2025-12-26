
import { ActivityItem, HistoryItem } from './types';

export const APP_VERSION: string = '1.2.0';

export const RECENT_ACTIVITY: ActivityItem[] = [
  { id: '1', title: 'Bot Alpha Iniciado', description: 'Módulo de datos • #4292', time: '2m', type: 'info', icon: 'smart_toy' },
  { id: '2', title: 'Validación Requerida', description: 'Entrada #8821 necesita revisión', time: '15m', type: 'warning', icon: 'warning' },
  { id: '3', title: 'Informe Generado', description: 'Resumen Semanal PDF', time: '1h', type: 'success', icon: 'check_circle' },
];

export const HISTORY: HistoryItem[] = [
  { id: 'h1', date: '23 Octubre', description: 'Corte finalizado', amount: 42390, status: 'completed' },
  { id: 'h2', date: '22 Octubre', description: 'Corte finalizado', amount: 38150.50, status: 'completed' },
  { id: 'h3', date: '21 Octubre', description: 'Diferencia detectada', amount: 40000, status: 'revision' },
];
