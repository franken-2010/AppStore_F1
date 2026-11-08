# Abarrotes F1 — Copia completa para pruebas en AI Studio

**Rama:** `ai-studio-pruebas-2-locales` (no es `main`).

## Qué contiene
Esta rama es la **misma app React + Express original**, integrada con las modificaciones de ambos locales y los cuatro cambios de AI Studio sincronizados el 7 de noviembre de 2026. No es un panel HTML alterno.

- Local 1: Abarrotes, Fiesta, Recargas, Estancias.
- Local 2: Frutas y verduras, Pan y galletas, Comida preparada.
- Mantiene `Carga Manual` y `Pegar Corte`. El motor de IA clasifica automáticamente lo explícito y avisa si una VENTA se incluyó en la caja incorrecta.
- Diferencia/sobrante se calcula automáticamente al conciliar ingresos, egresos y dinero entregado; no se dicta.
- Historial recientemente añadido conservado; en esta rama **editar y eliminar están deshabilitados** hasta distinguir movimientos por local y evitar borrados por fecha de la caja incorrecta.
- **El guardado definitivo del Local 2 sigue deshabilitado** hasta completar la integración de cuentas Firestore.
- Los importes y balances de esta rama son para pruebas; no usar con datos reales.

## Paso 1. Aislar Firebase (OBLIGATORIO)
Crear un proyecto Firebase nuevo para pruebas en Firebase Console, diferente de `adminf1-2213b`. Crear aplicación web, habilitar autenticación Email/Password, Firestore y reglas apropiadas en **ese proyecto de pruebas**. Crear usuario de prueba. No copiar contraseñas ni tokens de producción.

La app **fallará intencionalmente antes de conectar** si faltan datos de staging o si el projectId coincide con `adminf1-2213b`.

Copiar los valores de configuración WEB (no service accounts) a las variables indicadas en `.env.staging.example`; el backend necesita `FIREBASE_PROJECT_ID` igual al proyecto de staging. `GEMINI_API_KEY` va exclusivamente en **Settings > Secrets** del servidor, nunca como `VITE_` ni en el repositorio. El navegador no debe recibir la clave Gemini.

## Paso 2. Importar SIN alterar tu proyecto original
La app operativa de AI Studio está sincronizada con la rama `main` de `franken-2010/AppStore_F1`; no modificar esa vinculación.

**Método seguro:** utilizar una NUEVA aplicación en Google AI Studio Build, mediante `+` -> `Import from GitHub`, con un **repositorio de pruebas separado**, p. ej. `AppStore_F1_Pruebas` (preferentemente privado). Su rama principal `main` debe contener el código de `ai-studio-pruebas-2-locales`; la app original permanece vinculada a `AppStore_F1/main`.

AI Studio se vincula normalmente con la rama predeterminada del repositorio; **no asumir que puede importar directamente otra rama**. Si su diálogo ofrece selector de rama, se puede evaluar; si no, crear primero el repositorio independiente en GitHub y copiar a él el código de pruebas. Después importa ese repositorio como una nueva app.

No unir `ai-studio-pruebas-2-locales` al `main` original ni cambiar la rama predeterminada del repositorio operativo.

No pulsar `Push changes to GitHub` ni `Merge` sobre la app original para realizar esta prueba.

## Paso 3. Configurar y verificar
1. En la copia de AI Studio, configurar los valores WEB de Firebase de pruebas; la clave Gemini se configura en secretos del backend.
2. Iniciar sesión con el usuario de prueba y revisar que la app cargue.
3. Probar **sin guardar en producción**:
   - Local 1: `Ventas 455+677+3343; Fiesta 100` => Ventas se entienden como Abarrotes.
   - Local 1: `Frutas y verduras 500` => alerta de Local 2 y no reetiqueta.
   - Local 2: `Frutas y verduras 500; Pan y galletas 180; Comida preparada 230; Dinero entregado 910` => identifica las 3 categorías, sin sobrante.
   - Pagos cruzados: compra de frutas pagada desde caja 1 debe señalar la categoría beneficiaria y el origen del efectivo, sin dobles egresos.
4. Validar pantalla manual en ambas cajas, historial solo lectura y borrado bloqueado.

## Qué FALTA antes de guardar en la versión real
- Crear el esquema contable definitivo para las nuevas categorías y el Local 2.
- Verificar permisos de Firestore en staging; comprobación de corte duplicado, conciliación de pagos cruzados e historial por caja.
- Prueba integral desde la app importada: API Gemini real + Firebase staging + revisión visual en celular.

**Estado:** source de la app completo preparado en esta rama; sin despliegue ni conexión a un Firebase de staging todavía. Main/producción intactos.
