export interface CutCanonicalResult {
  income: {
    ventas: number;
    fiesta: number;
    recargas: number;
    estancias: number;
    pagoClientes: number;
    cxc: number;
  };
  expenses: {
    mercancias: number;
    fiesta: number;
    gastosAdministrativos: number;
    sueldos: number;
    consumoEmpleados: number;
    consumoPersonal: number;
  };
  cash: {
    dineroEntregado: number;
  };
  isFallback?: boolean;
  notice?: string;
  isPermissionDenied?: boolean;
  diagnostic?: any;
}

export interface ParsedOrderItem {
  rawName: string;
  qty: number;
  unit: string;
  notes: string[];
  searchKeywords: string[];
}

export interface ParsedOrderResult {
  items: ParsedOrderItem[];
  isFallback?: boolean;
  notice?: string;
}

// Smart rule-based corte parser for local calculation and fallback
export function parseCorteFallback(rawText: string): CutCanonicalResult {
  const rawLines = (rawText || '').split(/\r?\n/);
  const segments: string[] = [];

  for (const rawLine of rawLines) {
    if (!rawLine.trim()) continue;
    // Split on semicolon or commas followed by letters (e.g. 'Ventas: 4500, Luz: 1200')
    const parts = rawLine.split(/(?:;|\,(?=\s*[a-zA-ZáéíóúÁÉÍÓÚñÑ]{3,}))/);
    for (const part of parts) {
      if (part.trim()) segments.push(part.trim());
    }
  }

  const result: CutCanonicalResult = {
    income: {
      ventas: 0,
      fiesta: 0,
      recargas: 0,
      estancias: 0,
      pagoClientes: 0,
      cxc: 0,
    },
    expenses: {
      mercancias: 0,
      fiesta: 0,
      gastosAdministrativos: 0,
      sueldos: 0,
      consumoEmpleados: 0,
      consumoPersonal: 0,
    },
    cash: {
      dineroEntregado: 0,
    },
  };

  const extractLineSum = (str: string): number => {
    // Remove date patterns like 21/09/2026, 2026-09-21, 21-09-26
    const withoutDates = str.replace(/\b\d{1,4}[\/\-]\d{1,2}[\/\-]\d{2,4}\b/g, ' ');
    // Match amounts: $1,250.50, 668, 529.5, etc.
    const regex = /(?:\$|\b)([0-9]+(?:,[0-9]{3})*(?:\.[0-9]+)?|[0-9]+(?:\.[0-9]+)?)\b/g;
    let sum = 0;
    let match: RegExpExecArray | null;
    while ((match = regex.exec(withoutDates)) !== null) {
      const cleanNum = match[1].replace(/,/g, '');
      const val = parseFloat(cleanNum);
      if (!isNaN(val)) {
        sum += val;
      }
    }
    return Number(sum.toFixed(2));
  };

  for (const line of segments) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    const lower = trimmed.toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "");

    // Skip summary lines to avoid duplicate counting if pasting a previously calculated audit sheet
    if (lower.startsWith('subtotal') || lower.startsWith('total de ingreso') || lower.startsWith('total ingreso') || lower.startsWith('total esperado') || lower.startsWith('resultado') || lower.startsWith('total egreso')) {
      continue;
    }

    const amount = extractLineSum(trimmed);
    if (amount <= 0) continue;

    // 1. Recargas (evaluated early so 'recargas' does not trigger 'gas' in admin expenses)
    if (lower.includes("recarga") || lower.includes("tiempo aire") || lower.includes("tae")) {
      if (lower.includes("gasto") || lower.includes("compra") || lower.includes("costo") || lower.includes("casto") || lower.includes("saldo")) {
        result.expenses.mercancias += amount;
      } else {
        result.income.recargas += amount;
      }
    }
    // 2. Dinero entregado / Efectivo final reportado
    else if (lower.includes("entregad") || lower.includes("efectivo final") || lower.includes("corte final") || lower.includes("dinero en caja") || lower.includes("deje en caja") || lower.includes("quedo en caja") || lower.includes("caja final")) {
      result.cash.dineroEntregado = amount;
    }
    // 3. Rubro Fiesta (Ventas vs Gastos)
    else if (lower.includes("fiesta")) {
      if (lower.includes("gasto") || lower.includes("casto") || lower.includes("costo") || lower.includes("compra") || lower.includes("egreso") || lower.includes("salida") || lower.includes("mercancia") || lower.includes("producto")) {
        result.expenses.fiesta += amount;
      } else {
        result.income.fiesta += amount;
      }
    }
    // 4. Consumo de empleados (evaluated BEFORE general sueldos/empleados)
    else if (lower.includes("consumo") && (lower.includes("emplead") || lower.includes("trabajador"))) {
      result.expenses.consumoEmpleados += amount;
    }
    // 5. Sueldos / Nómina / Pago de empleados
    else if (lower.includes("sueldo") || lower.includes("salario") || lower.includes("nomina") || lower.includes("raya") || ((lower.includes("pago") || lower.includes("pagos")) && (lower.includes("emplead") || lower.includes("trabajador")))) {
      result.expenses.sueldos += amount;
    }
    // 6. Consumo personal / Gastos personales del dueño
    else if (lower.includes("personal") || lower.includes("dueno") || lower.includes("patron") || lower.includes("casa") || lower.includes("propio") || lower.includes("retiro")) {
      result.expenses.consumoPersonal += amount;
    }
    // 7. Pago de clientes / Cobros a clientes / Abonos CxC (evaluated BEFORE CxC credit sales!)
    else if ((lower.includes("pago") || lower.includes("pagaron") || lower.includes("cobro") || lower.includes("cobros") || lower.includes("abono") || lower.includes("abonos")) && (lower.includes("cliente") || lower.includes("clientes") || lower.includes("deuda") || lower.includes("cxc") || lower.includes("cuenta"))) {
      result.income.pagoClientes += amount;
    }
    // 8. Ventas a crédito / CxC (Crédito nuevo otorgado hoy)
    else if (lower.includes("credito") || lower.includes("cxc") || lower.includes("fiado") || lower.includes("fio") || lower.includes("se debio") || lower.includes("a cuenta") || lower.includes("a credito")) {
      result.income.cxc += amount;
    }
    // 9. Estancias
    else if (lower.includes("estancia")) {
      result.income.estancias += amount;
    }
    // 10. Gastos administrativos (Luz, agua, renta, internet, mantenimiento)
    else if (lower.includes("administrativ") || lower.includes("renta") || lower.includes("mantenimiento") || lower.includes("luz") || lower.includes("agua") || lower.includes("internet") || lower.includes("cfe") || /\bgas\b/.test(lower) || lower.includes("limpieza") || lower.includes("papeleria") || lower.includes("bolsa")) {
      result.expenses.gastosAdministrativos += amount;
    }
    // 11. Mercancías / Abarrotes / Proveedores (soporta typos comunes como 'Casto en abarrotes', 'Gasto', 'Costo', 'Compras')
    else if (lower.includes("abarrote") || lower.includes("mercancia") || lower.includes("proveedor") || lower.includes("compra") || lower.includes("surtido") || lower.includes("gasto") || lower.includes("casto") || lower.includes("costo") || lower.includes("egreso") || lower.includes("salida")) {
      result.expenses.mercancias += amount;
    }
    // 12. Ventas generales / Efectivo
    else if (lower.includes("venta") || lower.includes("efectivo") || lower.includes("tienda") || lower.includes("ingreso")) {
      result.income.ventas += amount;
    }
  }

  return result;
}

// Smart rule-based order parser for local fallback
export function parseOrderFallback(rawText: string): ParsedOrderResult {
  const lines = (rawText || '').split(/\r?\n/).map(l => l.trim()).filter(Boolean);
  const items: ParsedOrderItem[] = [];

  for (const line of lines) {
    const match = line.match(/^(\d+(?:\.\d+)?)\s*([a-zA-ZáéíóúÁÉÍÓÚñÑ]+)?\s*(?:de\s+)?(.+)$/i);
    let qty = 1;
    let unit = "pza";
    let rawName = line;

    if (match) {
      qty = parseFloat(match[1]) || 1;
      const potentialUnit = (match[2] || '').toLowerCase();
      const recognizedUnits = ['caja', 'cajas', 'kg', 'kilo', 'kilos', 'pza', 'pzas', 'pieza', 'piezas', 'bulto', 'bultos', 'paq', 'paquete', 'paquetes', 'l', 'litro', 'litros', 'reja', 'rejas', 'charola', 'charolas', 'costal', 'costales'];
      
      if (recognizedUnits.includes(potentialUnit)) {
        unit = potentialUnit;
        rawName = match[3].trim();
      } else {
        rawName = (match[2] ? match[2] + ' ' : '') + match[3].trim();
      }
    }

    const keywords = rawName
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9\s]/g, '')
      .split(/\s+/)
      .filter(w => w.length > 2 && !['de', 'del', 'la', 'el', 'los', 'las', 'para', 'con', 'sin', 'un', 'una'].includes(w));

    items.push({
      rawName,
      qty,
      unit,
      notes: [],
      searchKeywords: keywords.slice(0, 8),
    });
  }

  return { items };
}
