# Abarrotes F1 — Primer incremento multilocal (experimental)

Rama: `desarrollo-independiente`. No conectar directamente a Firebase de producción.

## Alcance implementado
- Identificadores estables para Local 1 (Abarrotes, Fiesta, Recargas, Estancias) y Local 2 (Frutas y verduras, Pan y galletas, Comida preparada).
- Función pura `calculateCashClosing` para cortes por local en efectivo, con venta a crédito opcional y cobranza de cartera diferenciada; no existen medios de pago electrónicos en esta versión.
- Diferencias positivas quedan como `surplusPendingIdentification`; negativas como `shortagePendingInvestigation`. El indicador `adjustedGeneralReceipts` sirve para control de efectivo, **no es una venta contable ni utilidad**.
- Función pura `allocateOverheadExpenses`: gastos directos por categoría, gastos de local distribuidos entre sus categorías y gastos de empresa repartidos por ingresos elegibles entre locales. Los cálculos se realizan en centavos y conservan los residuos de redondeo.
- Si no existen ingresos elegibles, los gastos comunes quedan pendientes, sin asignarse por defecto a Abarrotes.

## Alcance NO implementado
- No hay cambios en las rutas de `App.tsx`, `CortesScreen.tsx`, `AccountingService.ts`, Firestore ni sus reglas.
- No se importan ni alteran registros anteriores.
- No se previene aún el doble registro de un corte en base de datos.
- No se ha conectado el motor al dashboard ni a los reportes.
- No hay despliegue ni alojamiento configurado.
- No existe un sistema de inventarios físicos por artículo.

## Precauciones antes de conectar datos reales
1. Validar que un corte pueda ser guardado una sola vez por local, fecha y turno, o reemplazado exclusivamente mediante ajustes auditables.
2. Revisar `firestore.rules` y un esquema de migración compatible con datos históricos.
3. Separar caja física, compras, ventas, cuentas por cobrar y movimientos espejo para evitar sumas duplicadas.
4. Determinar bases de distribución para Recargas: comisión reconocida vs. monto bruto recargado; el motor exige que los ingresos elegibles lleguen calculados.
5. Distribuir gastos compartidos solo entre operaciones activas durante el periodo, no automáticamente entre locales sin actividad.
6. Agregar pruebas integradas con datos simulados de los servicios existentes.
7. Mantener intacta la rama `main` y realizar respaldos de Firestore antes de una activación.

## Prueba local
Compilar ambos archivos con TypeScript e iniciar el JavaScript de prueba:
```bash
tsc --strict --target ES2022 --module commonjs --skipLibCheck --outDir .test-output services/multiStoreAccounting.ts tests/multiStoreAccounting.test.ts
node .test-output/tests/multiStoreAccounting.test.js
```
