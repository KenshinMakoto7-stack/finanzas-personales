## 🎨 Epic: Rediseño Visual & UX Experience - Gráficos

**Estado:** Pendiente de Implementación

**Prioridad:** Alta

**Objetivo:** Transformar los gráficos básicos en visualizaciones premium alineadas con el Design System del rediseño completo.

> **Nota:** Esta sección es parte del Epic completo de Rediseño Visual. Ver `EPIC_REDISENO_UX.md` para detalles completos del Design System.

### Transformación de Gráficos y Visualizaciones

**Estado Actual (Problemas Identificados):**
- ❌ Colores genéricos y poco sofisticados (#27ae60, #e74c3c, #667eea)
- ❌ Líneas de grid muy visibles que distraen
- ❌ Tooltips básicos sin jerarquía visual
- ❌ Sin gradientes o efectos de profundidad
- ❌ Pie charts con colores aleatorios sin coherencia
- ❌ Sin animaciones de entrada
- ❌ Sin interactividad avanzada
- ❌ Tipografía de ejes poco legible
- ❌ Sin área sombreada en gráficos de líneas

**Rediseño Propuesto (Nivel Premium - Alineado con Design System):**

#### Paleta de Colores para Gráficos (Coherente con el Rediseño)

**Sistema de Colores Semánticos:**
- **Ingresos:** `#059669` (Esmeralda 600) con gradiente a `#10B981` (Esmeralda 500)
- **Gastos:** `#B45309` (Ámbar 700) con gradiente a `#D97706` (Ámbar 600)
- **Balance Positivo:** `#059669` (Esmeralda 600)
- **Balance Negativo:** `#B45309` (Ámbar 700)
- **Series Adicionales:**
  - Serie 3: `#4F46E5` (Indigo 600) - Para comparaciones (coincide con Primary)
  - Serie 4: `#8B5CF6` (Violeta 500) - Para categorías especiales
  - Serie 5: `#06B6D4` (Cyan 500) - Para proyecciones
  - Serie 6: `#F59E0B` (Ámbar 500) - Para alertas

**Gradientes para Áreas:**
- **Área de Ingresos:** `linear-gradient(180deg, rgba(5, 150, 105, 0.2) 0%, rgba(5, 150, 105, 0.05) 100%)`
- **Área de Gastos:** `linear-gradient(180deg, rgba(180, 83, 9, 0.2) 0%, rgba(180, 83, 9, 0.05) 100%)`
- **Área de Balance:** `linear-gradient(180deg, rgba(79, 70, 229, 0.15) 0%, rgba(79, 70, 229, 0.02) 100%)`

#### Mejoras Principales

**Gráficos de Líneas:**
- Grosor 3px con rounded caps
- Áreas sombreadas con gradientes
- Puntos de datos con borde blanco y animación
- Grid sutil `#F3F4F6` (del Design System)
- Animación de dibujo progresivo (1200ms)
- Hover avanzado con líneas guía

**Gráficos de Barras:**
- Border-radius 6px superior
- Sombras sutiles por barra
- Gradientes verticales
- Animación de crecimiento desde abajo (800ms)
- Hover con elevación

**Gráficos de Pie/Donut:**
- Tipo donut (anillo) con espacio central
- Separación 2px entre segmentos
- Colores coordinados (no aleatorios)
- Labels externos con líneas guía
- Hover con expansión y separación

**Tooltips Premium:**
- Fondo `#111827` (gris oscuro del Design System)
- Estructura clara con header, valores y footer
- Animación fade-in + scale
- Posicionamiento inteligente

**Ejes y Labels:**
- Colores del Design System (`#6B7280`, `#E5E7EB`, `#F3F4F6`)
- Formato inteligente (abreviaciones, meses cortos)
- Grid solo horizontal, muy sutil

#### Nuevos Tipos de Visualizaciones

1. **Gráfico de Área Apilada:** Composición de gastos por categoría
2. **Gráfico de Radar:** Comparación de patrones de gasto
3. **Heatmap de Gastos:** Calendario visual con intensidad de color
4. **Gráfico de Progreso Circular:** Metas de ahorro animadas
5. **Mini Sparklines:** Tendencias rápidas en cards

### Archivos a Modificar

**Frontend:**
- `apps/web/app/dashboard/page.tsx` - Refactorizar gráficos
- `apps/web/app/savings/page.tsx` - Actualizar gráficos de ahorros
- `apps/web/app/statistics/page.tsx` - Actualizar visualizaciones
- Crear: `apps/web/components/charts/` - Componentes reutilizables

### Plan de Implementación

**Fase 1:** Design System Base (colores, tipografía)
**Fase 2:** Gráficos Base (refactorizar con nuevos colores)
**Fase 3:** Animaciones e Interactividad
**Fase 4:** Nuevos tipos de visualizaciones y pulido

### 📅 Fecha de Solicitud

2 de Diciembre 2025

