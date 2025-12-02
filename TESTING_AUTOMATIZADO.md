# Testing Automatizado - Guía de Implementación

## Resumen

Para automatizar pruebas E2E (End-to-End) que simulen el comportamiento de un usuario, se recomienda usar **Playwright** o **Cypress**. Estas herramientas pueden detectar errores como:
- Transacciones que no aparecen en el dashboard después de crearlas
- Errores 500 en endpoints de estadísticas
- Problemas de sincronización de datos
- Errores de UI/UX

## Opción 1: Playwright (Recomendado)

### Ventajas
- ✅ Más rápido y moderno
- ✅ Mejor soporte para múltiples navegadores
- ✅ Excelente para CI/CD
- ✅ Genera videos y screenshots automáticamente

### Instalación

```bash
cd apps/web
npm install -D @playwright/test
npx playwright install
```

### Ejemplo de Test Básico

Crear `apps/web/e2e/dashboard.spec.ts`:

```typescript
import { test, expect } from '@playwright/test';

test.describe('Dashboard', () => {
  test.beforeEach(async ({ page }) => {
    // Navegar a login
    await page.goto('http://localhost:3000/login');
    
    // Login (ajustar credenciales)
    await page.fill('input[type="email"]', 'test@example.com');
    await page.fill('input[type="password"]', 'password123');
    await page.click('button[type="submit"]');
    
    // Esperar a que cargue el dashboard
    await page.waitForURL('**/dashboard');
  });

  test('debe mostrar transacciones después de crearlas', async ({ page }) => {
    // 1. Ir a crear transacción
    await page.click('text=Nueva Transacción');
    
    // 2. Llenar formulario
    await page.selectOption('select[name="type"]', 'EXPENSE');
    await page.fill('input[name="amount"]', '100');
    await page.fill('input[name="description"]', 'Test Transaction');
    await page.fill('input[name="occurredAt"]', new Date().toISOString().slice(0, 16));
    
    // 3. Seleccionar cuenta y categoría (ajustar según tu UI)
    // await page.selectOption('select[name="accountId"]', 'account-id');
    // await page.selectOption('select[name="categoryId"]', 'category-id');
    
    // 4. Guardar
    await page.click('button:has-text("Guardar")');
    
    // 5. Esperar redirección
    await page.waitForURL('**/dashboard');
    
    // 6. Verificar que la transacción aparece en "Gastos del Mes"
    const gastosText = await page.textContent('text=Gastos del Mes');
    expect(gastosText).toContain('$1.00'); // Ajustar formato
    
    // 7. Verificar que aparece en historial
    await page.click('text=Historial');
    await expect(page.locator('text=Test Transaction')).toBeVisible();
  });

  test('debe mostrar presupuesto diario restante', async ({ page }) => {
    await page.goto('http://localhost:3000/dashboard');
    
    // Verificar que el chip de "Presupuesto Diario Restante" existe
    await expect(page.locator('text=Presupuesto Diario Restante')).toBeVisible();
    
    // Verificar que muestra un monto
    const presupuestoText = await page.textContent('text=Presupuesto Diario Restante');
    expect(presupuestoText).not.toBe('...');
  });

  test('no debe tener errores 500 en estadísticas', async ({ page }) => {
    await page.goto('http://localhost:3000/dashboard');
    
    // Interceptar requests a estadísticas
    const errors: string[] = [];
    page.on('response', response => {
      if (response.status() === 500 && response.url().includes('/statistics/')) {
        errors.push(response.url());
      }
    });
    
    // Esperar a que carguen todas las estadísticas
    await page.waitForTimeout(3000);
    
    // Verificar que no hay errores 500
    expect(errors).toHaveLength(0);
  });
});
```

### Ejecutar Tests

```bash
# Ejecutar todos los tests
npx playwright test

# Ejecutar en modo UI (interactivo)
npx playwright test --ui

# Ejecutar en modo debug
npx playwright test --debug

# Ejecutar solo tests de dashboard
npx playwright test dashboard
```

## Opción 2: Cypress

### Instalación

```bash
cd apps/web
npm install -D cypress
```

### Ejemplo de Test Básico

Crear `apps/web/cypress/e2e/dashboard.cy.ts`:

```typescript
describe('Dashboard', () => {
  beforeEach(() => {
    cy.visit('/login');
    cy.get('input[type="email"]').type('test@example.com');
    cy.get('input[type="password"]').type('password123');
    cy.get('button[type="submit"]').click();
    cy.url().should('include', '/dashboard');
  });

  it('debe mostrar transacciones después de crearlas', () => {
    // Crear transacción
    cy.contains('Nueva Transacción').click();
    cy.get('select[name="type"]').select('EXPENSE');
    cy.get('input[name="amount"]').type('100');
    cy.get('input[name="description"]').type('Test Transaction');
    cy.get('button:contains("Guardar")').click();
    
    // Verificar en dashboard
    cy.url().should('include', '/dashboard');
    cy.contains('Gastos del Mes').should('be.visible');
    
    // Verificar en historial
    cy.contains('Historial').click();
    cy.contains('Test Transaction').should('be.visible');
  });
});
```

## Tests Recomendados

### 1. Flujo Completo de Transacción
- ✅ Crear transacción
- ✅ Verificar que aparece en dashboard
- ✅ Verificar que aparece en historial
- ✅ Editar transacción
- ✅ Eliminar transacción

### 2. Estadísticas
- ✅ Verificar que no hay errores 500
- ✅ Verificar que los cálculos son correctos
- ✅ Verificar que se actualizan después de crear transacciones

### 3. Dashboard
- ✅ Verificar que todos los chips se muestran
- ✅ Verificar que el presupuesto diario se calcula correctamente
- ✅ Verificar que los datos se recargan al volver de otra página

### 4. Autenticación
- ✅ Login exitoso
- ✅ Logout
- ✅ Protección de rutas

### 5. Responsive
- ✅ Verificar que funciona en móvil
- ✅ Verificar que el menú hamburguesa funciona

## Integración con CI/CD

### GitHub Actions (Playwright)

Crear `.github/workflows/e2e.yml`:

```yaml
name: E2E Tests
on: [push, pull_request]
jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: '20'
      - run: cd apps/web && npm install
      - run: cd apps/web && npx playwright install --with-deps
      - run: cd apps/web && npx playwright test
      - uses: actions/upload-artifact@v3
        if: always()
        with:
          name: playwright-report
          path: apps/web/playwright-report/
```

## Notas Importantes

1. **Variables de Entorno**: Configurar `NEXT_PUBLIC_API_URL` para apuntar al backend de testing
2. **Datos de Prueba**: Crear un usuario de prueba específico para los tests
3. **Limpieza**: Limpiar datos de prueba después de cada test
4. **Timeouts**: Ajustar timeouts según la velocidad de la aplicación

## Próximos Pasos

1. Instalar Playwright o Cypress
2. Crear tests básicos para los flujos críticos
3. Integrar con CI/CD
4. Ejecutar tests antes de cada deploy

