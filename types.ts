
export interface ReceiptAnalysis {
  cashAmount: number;
  terminalAmount: number;
  expenses: number;
  summary: string;
}

export interface ActivityItem {
  id: string;
  title: string;
  description: string;
  time: string;
  type: 'success' | 'warning' | 'info';
  icon: string;
}

export interface HistoryItem {
  id: string;
  date: string;
  description: string;
  amount: number;
  status: 'completed' | 'revision';
}

export interface StoreProduct {
  productoID: number;
  nombreCompleto: string;
  costoBasePrincipal: number;
  uniPorCaja: number;
  costoUnidad: number;
  utilidadPorcentaje: number;
  precioSugerido: number;
  precioSugRed: number;
  margenPesos: number;
  lastUpdated: string;
}
