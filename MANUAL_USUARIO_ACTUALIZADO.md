# 📖 Manual de Usuario - Aplicación de Finanzas Personales

**Versión:** 2.0  
**Fecha de Actualización:** Diciembre 2025  
**Última Revisión:** Diciembre 2025

---

## 📑 Índice

1. [Introducción](#introducción)
2. [Primeros Pasos](#primeros-pasos)
3. [Dashboard](#dashboard)
4. [Cuentas](#cuentas)
5. [Categorías](#categorías)
6. [Transacciones](#transacciones)
   - [Nueva Transacción](#nueva-transacción)
   - [Transferencias](#transferencias)
   - [Transacciones Recurrentes](#transacciones-recurrentes)
   - [Adjuntar Fotos](#adjuntar-fotos)
7. [Deudas](#deudas)
   - [Crear Deuda](#crear-deuda)
   - [Pagar Deuda con Conversión de Moneda](#pagar-deuda-con-conversión-de-moneda)
8. [Presupuestos](#presupuestos)
9. [Metas de Ahorro](#metas-de-ahorro)
10. [Calendario y Eventos Planificados](#calendario-y-eventos-planificados)
11. [Estadísticas](#estadísticas)
12. [Análisis Inteligente](#análisis-inteligente)
13. [Notificaciones](#notificaciones)
14. [Configuración de Usuario](#configuración-de-usuario)
15. [Mejores Prácticas](#mejores-prácticas)

---

## 🎯 Introducción

Bienvenido a la **Aplicación de Finanzas Personales**, una herramienta completa diseñada para ayudarte a gestionar tus finanzas de manera eficiente y organizada. Este manual te guiará a través de todas las funcionalidades disponibles.

### Características Principales

- ✅ **Dashboard en tiempo real** con métricas financieras clave
- ✅ **Gestión completa de transacciones** (ingresos, gastos, transferencias)
- ✅ **Sistema de deudas** con seguimiento de cuotas
- ✅ **Presupuestos y metas de ahorro**
- ✅ **Calendario de eventos planificados**
- ✅ **Análisis inteligente de patrones**
- ✅ **Adjuntar fotos a transacciones**
- ✅ **Conversión de moneda** (USD ↔ UYU)
- ✅ **Estadísticas avanzadas** con gráficos

---

## 🚀 Primeros Pasos

### Registro e Inicio de Sesión

1. **Registro:**
   - Accede a la página de registro
   - Completa tu email y contraseña (mínimo 6 caracteres)
   - Haz clic en "Registrarse"
   - Verifica tu email si es necesario

2. **Inicio de Sesión:**
   - Ingresa tu email y contraseña
   - Haz clic en "Iniciar Sesión"
   - Serás redirigido al Dashboard

### Configuración Inicial

Después de iniciar sesión por primera vez:

1. **Crea tu primera cuenta:**
   - Ve a "Cuentas" en el menú lateral
   - Haz clic en "Nueva Cuenta"
   - Completa: nombre, tipo (Efectivo, Banco, Crédito), moneda (USD o UYU)
   - Guarda la cuenta

2. **Crea categorías básicas:**
   - Ve a "Categorías" en el menú lateral
   - Crea categorías principales como "Alimentación", "Transporte", "Servicios"
   - Opcionalmente, crea subcategorías (ej: "Supermercado" dentro de "Alimentación")

---

## 📊 Dashboard

El Dashboard es tu centro de control financiero. Muestra:

### Métricas Principales

1. **Restante del Día:** Dinero disponible para gastar hoy
2. **Gasto Acumulado del Día:** Total gastado hoy
3. **Presupuesto del Día:** Presupuesto diario calculado
4. **Balance del Mes:** Ingresos - Gastos del mes actual
5. **Promedio Diario Disponible:** (Ingresos - Ahorros - Gastos) / Días restantes del mes
6. **Gastos del Mes:** Total de gastos del mes
7. **Comparativo Mes Pasado:** Comparación con el mes anterior
8. **Ingresos del Mes:** Total de ingresos del mes

### Balance por Cuenta

Si tienes múltiples cuentas, verás el balance individual de cada una.

### Gráficos

- **Gráfico de Ingresos vs Gastos:** Tendencias mensuales
- **Gráfico de Gastos por Categoría:** Distribución de gastos

---

## 💳 Cuentas

### Crear una Cuenta

1. Ve a "Cuentas" en el menú lateral
2. Haz clic en "Nueva Cuenta"
3. Completa:
   - **Nombre:** Ej: "Cuenta Principal", "Visa"
   - **Tipo:** 
     - **Efectivo:** Dinero en efectivo
     - **Banco:** Cuenta bancaria
     - **Crédito:** Tarjeta de crédito
   - **Moneda:** USD o UYU
4. Guarda la cuenta

### Editar o Eliminar

- Haz clic en "Editar" en la tarjeta de la cuenta
- O haz clic en "Eliminar" (solo si no tiene transacciones asociadas)

---

## 📁 Categorías

### Crear Categoría Principal

1. Ve a "Categorías"
2. Haz clic en "Crear Nueva Categoría"
3. Selecciona el tipo (Ingreso o Gasto)
4. Ingresa el nombre
5. Deja "Categoría Padre" vacío
6. Guarda

### Crear Subcategoría

1. Crea una categoría principal primero
2. Al crear una nueva categoría, selecciona la categoría principal en "Categoría Padre"
3. La subcategoría aparecerá agrupada bajo su padre

### Nota Importante

- **No puedes seleccionar directamente** una categoría padre que tenga hijos
- Si una categoría tiene subcategorías, debes seleccionar una de las subcategorías
- Esto asegura una organización clara y precisa

---

## 💰 Transacciones

### Nueva Transacción

1. Ve a "Nueva Transacción" en el menú
2. Completa los campos:
   - **Tipo:** Gasto, Ingreso o Transferencia
   - **Cuenta:** Selecciona la cuenta
   - **Categoría:** Selecciona una categoría (obligatorio excepto para transferencias)
   - **Monto:** Solo números enteros (sin decimales)
   - **Moneda:** USD o UYU
   - **Fecha y Hora:** Cuándo ocurrió la transacción
   - **Descripción:** Opcional
3. Guarda la transacción

### Transferencias

Las transferencias permiten mover dinero entre cuentas:

1. Selecciona "Transferencia" como tipo
2. Selecciona la **Cuenta Origen**
3. Selecciona la **Cuenta Destino** (debe ser diferente)
4. Ingresa el monto
5. La categoría es opcional para transferencias
6. El sistema creará automáticamente:
   - Una transacción **EXPENSE** desde la cuenta origen
   - Una transacción **INCOME** a la cuenta destino
   - Ambas vinculadas con el mismo `transferId`

**Nota:** Las transferencias no afectan el balance total, solo mueven dinero entre cuentas.

### Transacciones Recurrentes

Para crear una transacción que se repite automáticamente:

1. Al crear una transacción, marca "Es Recurrente"
2. Selecciona la frecuencia:
   - **Diaria:** Cada día
   - **Semanal:** Cada semana
   - **Mensual:** Cada mes
3. Indica si está pagada o no
4. Especifica ocurrencias:
   - **Indefinida:** Se repite sin fin
   - **Número específico:** Ej: 12 cuotas
5. Opcionalmente, programa notificaciones

### Adjuntar Fotos

Puedes adjuntar hasta **2 fotos** por transacción (comprobantes, facturas):

1. Al crear o editar una transacción, busca la sección "Adjuntar Fotos"
2. Haz clic en "📷 Seleccionar Fotos"
3. Selecciona hasta 2 imágenes (máximo 5 MB cada una)
4. Las fotos se comprimen automáticamente
5. Verás una vista previa antes de guardar

**Características:**
- Compresión automática para optimizar almacenamiento
- Thumbnails para visualización rápida
- Click en la foto para verla en tamaño completo
- Puedes eliminar fotos en cualquier momento

---

## 💸 Deudas

### Crear Deuda

1. Ve a "Deudas" en el menú
2. Haz clic en "Nueva Deuda"
3. Completa:
   - **Descripción:** Ej: "Préstamo Fede"
   - **Monto Total:** Monto total de la deuda
   - **Cuota Mensual:** Cuánto pagas por mes
   - **Total de Cuotas:** Número de cuotas
   - **Cuotas Pagadas:** Si ya pagaste algunas
   - **Mes de Inicio:** Cuándo comenzó la deuda
   - **Moneda:** USD o UYU
   - **Tipo:** Crédito u Otros
4. Guarda la deuda

### Pagar Deuda con Conversión de Moneda

Si tu deuda está en una moneda diferente a la cuenta de pago:

1. Haz clic en "Marcar como Pagada" en la deuda
2. Selecciona la cuenta de pago
3. Si las monedas son diferentes (USD ↔ UYU):
   - El sistema mostrará automáticamente el tipo de cambio
   - Puedes editarlo si conoces el valor real del día
   - Verás el monto original y el convertido lado a lado
4. Confirma el tipo de cambio
5. Confirma el pago

**Resultado:**
- La transacción se guarda en la moneda de la cuenta de pago (convertida)
- La deuda mantiene su moneda original
- El tipo de cambio usado se guarda para auditoría

### Gastos con Tarjeta de Crédito en Cuotas

Al crear un gasto con una cuenta de tipo "Crédito":

1. Selecciona la cuenta de crédito
2. Marca "Pagar en cuotas"
3. Indica:
   - **Cantidad de cuotas:** Ej: 12
   - **Monto total comprometido:** Ej: $1,200
4. El sistema creará automáticamente:
   - Una deuda en la sección "Deudas"
   - Transacciones recurrentes mensuales para cada cuota
   - Una subcategoría bajo "Deudas"

---

## 📅 Calendario y Eventos Planificados

### Ver Calendario

1. Ve a "Calendario" en el menú
2. Navega entre meses con las flechas
3. Verás:
   - Transacciones recurrentes programadas
   - Eventos planificados (marcados con 📅)

### Agregar Evento Planificado

Los eventos planificados son recordatorios que **no afectan tus balances** hasta que los confirmes:

1. Haz clic en cualquier día del calendario
2. Completa el formulario:
   - **Tipo:** Gasto o Ingreso
   - **Descripción:** Ej: "Factura de luz"
   - **Monto:** Monto esperado
   - **Cuenta y Categoría:** Opcionales
3. Guarda el evento

**Características:**
- Aparece en el calendario con un borde punteado
- Recibirás una notificación el día programado
- Puedes confirmar si se realizó o no
- Si confirmas, se crea una transacción real

---

## 📈 Estadísticas

### Ver Estadísticas

1. Ve a "Estadísticas" en el menú
2. Selecciona el período (Mes, Año, etc.)
3. Explora las pestañas:
   - **Gastos:** Distribución por categoría con gráficos
   - **Ingresos:** Análisis de ingresos
   - **Ahorros:** Progreso de ahorros

### Gráficos Mejorados

- **Gráfico de Pie:** Distribución visual con etiquetas compactas
- **Gráfico de Barras:** Comparación de montos
- **Lista Detallada:** Desglose completo con porcentajes

---

## 🤖 Análisis Inteligente

### Patrones de Comportamiento

1. Ve a "Patrones" en el menú
2. El sistema analiza automáticamente:
   - Frecuencia de transacciones
   - Días de la semana más comunes
   - Categorías más utilizadas

### Análisis Avanzado (Nuevo)

El sistema ahora incluye análisis inteligente:

- **Tendencias:** Detecta aumento/disminución de gastos por categoría
- **Anomalías:** Identifica gastos inusualmente altos
- **Predicciones:** Estima gastos futuros basados en patrones
- **Insights:** Sugerencias accionables para optimizar gastos

---

## 🔔 Notificaciones

### Ver Notificaciones

1. Haz clic en el ícono de campana 🔔 en el menú lateral (desktop) o superior (móvil)
2. Verás un resumen de notificaciones pendientes
3. Haz clic en "Ver todas" para ver el listado completo

### Tipos de Notificaciones

- **🔄 Pago Recurrente:** Recordatorio de pagos recurrentes
- **⚠️ Alerta de Presupuesto:** Cuando te acercas al límite
- **🚨 Presupuesto Excedido:** Cuando superas el presupuesto
- **📈 Progreso de Meta:** Actualizaciones de metas de ahorro
- **🎉 Meta Alcanzada:** Cuando completas una meta

### Gestionar Notificaciones

- **Marcar como Leída:** Haz clic en "Leído"
- **Eliminar:** Haz clic en "Borrar"
- **Eliminar Todas:** Opción disponible en la página de notificaciones

---

## ⚙️ Configuración de Usuario

### Cambiar Moneda

1. Ve a "Configuración" en el menú Usuario
2. Selecciona tu moneda preferida (USD, UYU, ARS, BRL)
3. Haz clic en "Actualizar Moneda"

### Cambiar Contraseña

1. En "Configuración", completa:
   - Nueva contraseña (mínimo 6 caracteres)
   - Confirmar nueva contraseña
2. Haz clic en "Solicitar Cambio de Contraseña"
3. Recibirás un email con instrucciones

### Cerrar Sesión

Haz clic en "Cerrar Sesión" en la página de Configuración.

---

## 💡 Mejores Prácticas

### Organización

1. **Crea categorías específicas:** En lugar de "Otros", crea categorías como "Entretenimiento", "Salud", etc.
2. **Usa subcategorías:** Para mayor detalle (ej: "Supermercado" dentro de "Alimentación")
3. **Registra transacciones regularmente:** No dejes pasar más de una semana
4. **Adjunta comprobantes:** Guarda fotos de facturas importantes

### Gestión de Deudas

1. **Registra todas las deudas:** Incluye préstamos, tarjetas de crédito, etc.
2. **Marca cuotas pagadas:** Mantén el seguimiento actualizado
3. **Usa conversión de moneda:** Si pagas en moneda diferente, aprovecha la función de conversión

### Planificación

1. **Usa eventos planificados:** Para facturas únicas que quieres recordar
2. **Configura transacciones recurrentes:** Para gastos fijos mensuales
3. **Revisa el calendario:** Planifica tus pagos con anticipación

### Análisis

1. **Revisa estadísticas mensualmente:** Identifica tendencias
2. **Presta atención a anomalías:** Gastos inusuales pueden indicar problemas
3. **Ajusta presupuestos:** Basándote en tus gastos reales

---

## 🆘 Solución de Problemas

### No puedo ver mis transacciones

- Verifica que estés en el período correcto
- Revisa los filtros aplicados
- Asegúrate de estar en la cuenta correcta

### Las notificaciones no aparecen

- Verifica que hayas dado permisos de notificaciones en tu navegador
- Revisa la configuración de notificaciones en la app
- Asegúrate de tener eventos o transacciones recurrentes configuradas

### No puedo adjuntar fotos

- Verifica que la foto sea menor a 5 MB
- Asegúrate de no tener ya 2 fotos adjuntas
- Intenta con otro formato de imagen (JPG, PNG)

### El tipo de cambio no se actualiza

- El tipo de cambio se actualiza automáticamente diariamente
- Puedes editarlo manualmente al pagar una deuda
- El valor se guarda para auditoría

---

## 📞 Soporte

Para más ayuda o reportar problemas, consulta la documentación del proyecto o contacta al equipo de desarrollo.

---

**¡Gracias por usar la Aplicación de Finanzas Personales!** 💰📊

