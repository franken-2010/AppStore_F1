# F1 — Guardado seguro multilocal: fase de pruebas (no productiva)

## Regla definitiva de sobrante/faltante (actualizada)

No existe captura manual de sobrante. F1-AI calcula la diferencia entre dinero entregado y efectivo esperado (fondo inicial + ingresos en efectivo + cobranza − egresos en efectivo). Diferencia positiva = sobrante; diferencia negativa = faltante. Nunca se dicta el sobrante ni se suma como venta.

## Estado y límites

La versión V3 de dictado → auditoría rápida continúa siendo la entrada principal.
Este incremento solamente habilita simulación de registro, sin escritura de Firebase.
Las cuentas históricas y la rama main siguen intactas.

- Código de dominio: services/multiStoreClosingRepository.ts
- Repositorio de ensayos: MemoryClosingRepository (solo en memoria, sin persistencia tras recargar).
- Adaptador Firestore NO ACTIVADO: services/multiStoreFirestoreRepository.ts
- Interfaz de ensayo: components/TrialClosingControls.tsx, visible solamente en la V3 cuando demoMode es verdadero.
- Pruebas automatizadas: tests/multiStoreClosingRepository.test.ts
- Colección NUEVA: /users/{uid}/multistoreClosings/{cut_local_XX_YYYY-MM-DD}
  y subcolección revisions/rev_0001, rev_0002, etc. No usar la colección antigua /users/{uid}/cortes.

## Reglas de negocio

1. Un corte diario por caja física: cut_local_01_2026-11-06 es distinto de cut_local_02_2026-11-06.
2. Prevención de duplicados: crear documento con ID determinista en transacción, solo si no existe.
   Un reintento no genera otra venta ni otro movimiento.
3. Todas las operaciones en el mismo snapshot: ventas, cobranzas, compras, gastos, retiros,
   consumos sin efectivo y efectivo contado se embeben en el documento.
   No se actualizan balances de las cuentas históricas.
4. Atribución contable separada de la caja pagadora: una compra de frutas es Frutas y verduras
   aunque haya salido de la caja del Local 1. Un pago declarado desde otra caja, diferente
   a la caja que se está cerrando, se bloquea hasta conciliarlo en el corte correspondiente.
5. Cobranzas no generan nuevas ventas. Consumo de mercancía no reduce el efectivo.
   Los sobrantes manuales se contrastan con el cálculo pero no se suman a ventas ni a resultados.
6. Verificaciones obligatorias: fecha válida, importe positivo con dos decimales, categoría
   conocida, ventas del local correspondiente, IDs únicos, efectivo contado presente
   y ninguna operación pendiente de revisión. Si la IA emitió advertencias, aceptación explícita.
7. Correcciones sin borrar el pasado: nueva revisión, motivo obligatorio, snapshot anterior
   y posterior; comparación de versión para impedir pisar el trabajo de otro operador.
8. Anticipos: se reclasifica el movimiento existente conservando su identidad y sin
   volver a descontar el efectivo.
9. Fondo inicial y diferencia: se conserva sobrante/faltante pero no se permite
   registrar si falta el efectivo contado.

## Nota de seguridad

El archivo firestore.rules de producción NO contiene permisos para multistoreClosings.
Su denegación por defecto es deliberada: el adaptador Firestore está escrito, pero aún
NO podrá escribir hasta que se cree y pruebe un proyecto Firebase de staging independiente
con sus propias reglas y autenticación.

NO desplegar reglas directamente en el proyecto Firebase de producción.
No basta con cambiar una variable de entorno: services/firebase.ts contiene la
configuración productiva integrada en el código original.
Para una prueba real habrá que inyectar configuración de staging,
revisar el origen autorizado de Auth, definir reglas de dueño/campos/invariantes,
probar en emulador y verificar respaldo.

El adaptador FirestoreMultiStoreClosingRepository utiliza runTransaction para tratar
el documento principal y la revisión como una sola operación: una falla no debe
dejar un corte parcialmente registrado.
ESTE comportamiento todavía NO ha sido comprobado contra el emulador de Firestore.
La implementación en memoria simula concurrencia, pero no sustituye las pruebas de reglas,
red, autenticación y transacciones reales.

## Casos de aceptación

- Dos cortes del mismo día para locales distintos.
- Doble clic y envíos concurrentes: solo un registro; los demás son duplicados.
- Compra de Frutas pagada desde caja de Local 1.
- Cobros de clientes, venta a crédito, sobrantes manuales y consumos sin efectivo.
- Validación de faltantes de caja sin ocultarlos.
- Anticipo reclasificado como compra en revisión; efectivo sin doble descuento.
- Corrección con motivo e historial, protegiendo versión anterior y rechazando conflictos.
- Rechazo de importes cero, categorías inválidas, efectivo contado ausente, pagador
  inconsistente, advertencias no aceptadas e IDs repetidos.
- Aislamiento por UID.

## Fases siguientes

1. Crear proyecto Firebase de staging separado de producción y respaldo verificado.
2. Implementar y probar reglas limitadas al UID para multistoreClosings y revisions,
   con invariantes de versión, campos permitidos y prohibición de borrado.
3. Probar en emulador Firestore: transacciones concurrentes, fallo de red,
   autorización, corrección atómica, traspasos y tamaño de documentos.
4. Conciliar movimientos nuevos con reportes y libro mayor antiguo sin duplicados.
5. Activar registro real solo tras aprobación y validación conjunta.

Esta fase es de ensayo en memoria. No modifica Firestore productivo.
