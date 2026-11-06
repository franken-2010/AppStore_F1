# Abarrotes F1 — Desarrollo multilocal experimental

**Rama:** `desarrollo-independiente` — NO fusionar todavía con `main`.
**Producción:** no desplegada ni conectada a la base de datos real.

## Estructura

- Local 1: Abarrotes, Fiesta, Recargas y Estancias.
- Local 2: Frutas y verduras, Pan y galletas, Comida preparada.
- Dos cortes independientes; una única vista administrativa consolidada.
- Ventas en efectivo. No se incorporan transferencias bancarias ni tarjetas.
- Ventas a crédito, si las hay, deben separarse de la cobranza de créditos anteriores; no incrementar dos veces las ventas.

## Archivos de esta etapa

| Archivo | Propósito |
| --- | --- |
| `services/multiStoreAccounting.ts` | Motor puro de conciliación de caja, validación de categoría/local y reparto de gastos |
| `screens/MultiStorePreviewScreen.tsx` | Pantalla editable de prueba, sin Firebase |
| `tests/multiStoreAccounting.test.ts` | Casos de prueba de caja, sobrantes, faltantes y gastos |
| `App.tsx` | Ruta privada `/tools/multilocal-preview` |
| `screens/ToolsScreen.tsx` | Acceso al simulador desde Herramientas |
| `.github/workflows/verificar-desarrollo.yml` | Verificación automática sin despliegue |

## Criterios contables aplicados

1. **Caja:** efectivo esperado = fondo inicial + ventas en efectivo + cobranzas + traspasos de entrada − compras pagadas − gastos pagados − traspasos de salida − retiros.
2. **Sobrante:** diferencia positiva no identificada. Aumenta únicamente un indicador operacional de caja ajustada; NO se reconoce automáticamente como venta por categoría ni como utilidad.
3. **Faltante:** diferencia negativa que requiere investigación.
4. **Gastos compartidos:** distribuir proporcionalmente según ingresos elegibles entre las categorías de los locales beneficiados.
5. **Gastos de un solo local:** distribuir entre sus categorías, no contra todos los negocios.
6. **Gastos directos de una categoría:** imputar solo a esa categoría.
7. **Sin ingresos elegibles:** dejar gastos compartidos sin distribuir, nunca cargarlos automáticamente a Abarrotes.
8. **Recargas:** el simulador usa ventas brutas como base temporal; antes de producción validar si el ingreso elegible debe ser la comisión.
9. **Rotación:** no calcular existencias ni merma física por artículo sin conteos. La velocidad de ventas y la rentabilidad estimada son indicadores distintos.

## Uso del simulador

Entrar a `Herramientas > Simulador multilocal` en una compilación de la **rama experimental**. Cambiar de local, editar ventas por categoría y los importes de caja. En la parte inferior se observa el reparto de gastos y el consolidado.

**Esta pantalla no importa `services/firebase.ts`, no consulta, no escribe, no borra, y sus cálculos se pierden al recargar.** El corte real anterior sigue en `/cortes`; no está conectado al nuevo motor.

## Verificaciones

```bash
npm ci
npm run lint
npm run test:multilocal
npm run build
```

Se ha configurado un flujo GitHub Actions para estas comprobaciones en la rama de desarrollo, sin desplegar nada.

## Próximo incremento protegido: guardado de cortes reales

Antes de modificar `CortesScreen.tsx` o Firestore:

1. Crear un **respaldo comprobado** del proyecto Firestore de producción.
2. Crear y verificar reglas de acceso para `users/{uid}/stores`, `sales_categories` y cortes multilocales sin abrir permisos de otros usuarios.
3. Usar `makeDailyClosingId(storeId, dateKey)` para obtener un ID fijo por local y fecha. **El ID no impide por sí mismo duplicados**: el guardado debe comprobar existencia en una **transacción atómica** de Firestore y rechazar cortes duplicados; los cambios posteriores serán ajustes auditables.
4. Garantizar que el documento de corte y los movimientos de caja se registren con integridad. Si una operación requiere múltiples lotes, usar un protocolo de estados y reintentos idempotentes.
5. Incluir `storeId`, `categoryId`, `closingId`, `source`, `registeredAt`, `effectiveAt` en movimientos nuevos con tipos seguros.
6. No editar ni atribuir por defecto a Local 1 los registros históricos sin verificar su procedencia.
7. No aplicar el porcentaje fijo de costo del inventario antiguo al Local 2.
8. Probar cortes con sobrante/faltante, cero ingresos, compra en efectivo, cobranza, venta a crédito, periodos con un solo local y gastos compartidos.

El simulador **no calcula utilidad operativa**, porque todavía no hay costos de ventas completos, mermas ni sueldos/rentas reales asignados.
