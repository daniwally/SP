# BRIEF DE PRODUCTO — Centro de Control E-commerce + ERP

## 1. QUE ES EL PRODUCTO

Dashboard SaaS orientado a dueños y gerentes de empresas que venden por e-commerce (Mercado Libre, Tienda Nube, Shopify) y gestionan su operación con un ERP (Odoo, Xubio, Colppy, Alegra).

El producto consolida datos de múltiples canales de venta y sistemas de gestión en una sola pantalla, pensado para quien toma decisiones pero NO opera el día a día del e-commerce.

No es una herramienta para el operador. Es una herramienta para el que paga las cuentas.

---

## 2. PROBLEMA QUE RESUELVE

El dueño/gerente de una empresa que vende por e-commerce hoy tiene estos dolores:

- No sabe cuánto vendió hoy sin preguntar al operador
- No sabe si el stock de Mercado Libre coincide con el ERP (sobreventa)
- No se entera de preguntas sin responder que son ventas perdidas
- No puede comparar rendimiento entre canales (ML vs tienda propia vs retail)
- No tiene visibilidad de tendencias sin pedir reportes manuales
- Depende 100% del operador para tener información

El costo de NO tener esta información:
- Sobreventas por desincronización de stock
- Ventas perdidas por preguntas sin responder
- Decisiones tardías por falta de datos en tiempo real
- Horas de trabajo manual armando reportes

---

## 3. FUNCIONALIDAD ACTUAL (MVP FUNCIONANDO)

### Ya desarrollado y operativo:

**Ventas consolidadas E-commerce + Retail**
- Ventas del día, semana y mes acumulado
- Desglose por marca y por canal (ML + Odoo retail)
- Comparativo porcentual E-commerce vs Retail
- Consulta por rango de fechas personalizado
- Gráfico de variación diaria de ventas por marca
- Tooltip con importe + cantidad de artículos + total del día

**Comparador de Stock ML vs Odoo**
- Cruza stock publicado en Mercado Libre con stock real en Odoo
- Matching por SKU (exacto y por prefijo)
- Matching por nombre de producto cuando no hay SKU
- Indicadores visuales de productos sin SKU
- Alerta cuando hay diferencias de stock

**Monitor de Preguntas Sin Responder**
- Lista real de preguntas sin responder de los últimos 15 días
- Agrupadas por marca
- Tiempo promedio de respuesta por marca
- Actualización automática

**Reporte de Publicaciones**
- Listado de publicaciones activas por marca
- Estado de cada publicación

**Stack técnico:**
- Backend: Python FastAPI (async)
- Frontend: React + Chart.js
- APIs integradas: Mercado Libre API, Odoo XML-RPC
- Manejo de múltiples cuentas ML simultáneas
- Cache inteligente para optimizar llamadas API

---

## 4. ROADMAP DE FUNCIONALIDADES

### Fase 1 — Completar integraciones de canales de venta
- Integración Tienda Nube (API REST, OAuth) — ventas, pedidos, stock, productos
- Integración Shopify (REST + GraphQL, OAuth) — ventas, pedidos, stock, productos
- Dashboard unificado: ML + Tienda Nube + Shopify + Retail en una sola vista

### Fase 2 — Ampliar integraciones ERP
- Xubio (REST + OAuth2) — el más popular en pymes argentinas
- Colppy (REST) — segundo más popular en Argentina
- Alegra (REST + Token) — abre Colombia y México
- Contabilium (REST) — refuerza Argentina

### Fase 3 — Monitor Mode (TV Dashboard)
- Vista fullscreen para pantallas de monitoreo estilo bolsa/exchange
- Auto-refresh cada 2-5 minutos sin intervención
- Números grandes legibles a distancia
- Semáforo visual: verde (ok), amarillo (atención), rojo (urgente)
- Ticker animado tipo bolsa con ventas por marca en tiempo real
- Rotación automática de paneles
- Alertas visuales de stock bajo, preguntas sin responder, caídas de ventas

### Fase 4 — Plataforma multi-tenant
- Onboarding self-service: registro, conexión OAuth ML, carga de logos
- Base de datos por tenant (configuración, marcas, cuentas, cache)
- Panel de administración del cliente
- Sistema de pagos recurrentes (Mercado Pago + Stripe)
- Trial de 14 días con datos reales del cliente

### Fase 5 — Funcionalidades premium
- Alertas por email/WhatsApp (stock bajo, preguntas sin responder, caída de ventas)
- Reportes automáticos semanales/mensuales por email
- Múltiples usuarios por cuenta (gerente, operador, contador)
- Exportación de datos (Excel, PDF)
- API propia para que clientes integren con sus sistemas

---

## 5. MERCADO OBJETIVO

### Target primario
Dueños y gerentes de empresas argentinas que:
- Venden por Mercado Libre (1 o más cuentas)
- Tienen un ERP (Odoo, Xubio, Colppy)
- Manejan múltiples marcas o categorías
- NO operan el e-commerce ellos mismos
- Necesitan visibilidad sin complejidad

### Perfil típico
- Distribuidoras y mayoristas con presencia en ML
- Empresas de consumo masivo con venta directa
- Marcas con operación tercerizada
- Retailers con canal online + físico

### Tamaño del mercado
- Mercado Libre tiene +40 millones de vendedores en LATAM
- Los que manejan múltiples cuentas/marcas son miles
- El segmento de empresas con ERP + ML es creciente (solo 5.9% de pymes argentinas usa ERP en la nube, pero las que lo usan incrementan 40% sus ganancias)

### Geografía
- Fase 1: Argentina
- Fase 2: México, Colombia, Chile, Brasil (donde ML opera)

---

## 6. COMPETENCIA

### Competidores directos

**SmartSelling (smartselling.app)**
- Desde USD 15/mes
- 2,500+ vendedores
- Dashboard + IA preventa + calculadora + reportes
- Pensado para el OPERADOR, no para el gerente
- NO integra ERP

**Nubimetrics (nubimetrics.com)**
- Precio no público (estimado USD 30-200/mes)
- 4,000+ clientes (Samsung, Disney)
- Inteligencia de mercado y competencia
- NO muestra tus ventas consolidadas, NO integra ERP

**Smart Dashboard BI (smartdbi.com)**
- Precio por licencia (no público)
- BI genérico multi-canal (ML, Amazon, Shopify, etc.)
- NO integra ERP argentino, no está pensado para gerente

**VirtualSeller Analytics**
- Partner oficial ML México
- Inteligencia de mercado
- Foco investigación, no gestión operativa

### Diferencial competitivo (lo que NADIE tiene)

| Feature | SmartSelling | Nubimetrics | SmartDBI | NUESTRO PRODUCTO |
|---|---|---|---|---|
| Dashboard ventas | Si | No | Si | Si |
| Integra ERP | No | No | No | SI |
| Comparador stock ML vs ERP | No | No | No | SI |
| Preguntas sin responder | Si | No | No | Si |
| Vista gerencial (no operativa) | No | No | Parcial | SI |
| Multi-marca consolidado | Parcial | No | Parcial | SI |
| Monitor mode (TV) | No | No | No | SI (roadmap) |
| Multi-canal (ML+TN+Shopify) | No | No | Si | SI (roadmap) |
| Multi-ERP (Odoo+Xubio+Colppy) | No | No | No | SI (roadmap) |

---

## 7. MODELO DE PRICING

### Opción A — Tiers por funcionalidad

| Plan | Precio | Incluye |
|---|---|---|
| **Pro** | USD 89/mes | Hasta 3 cuentas ML + 1 ERP. Dashboard ventas, stock, preguntas |
| **Business** | USD 179/mes | Hasta 10 cuentas ML + 1 ERP + 1 canal extra (TN o Shopify). Todo Pro + gráficos avanzados |
| **Enterprise** | USD 349/mes | Cuentas ilimitadas + multi-ERP + todos los canales + Monitor Mode + múltiples usuarios |

### Opción B — Por cuenta ML conectada
- USD 25-30/mes por cuenta ML conectada (mínimo 2)
- Add-ons: integración ERP +USD 30/mes, Monitor Mode +USD 50/mes

### Justificación del precio
- SmartSelling cobra USD 15/mes por herramienta de operador
- Nuestro producto es de otra categoría: control gerencial + integración ERP
- El comparador de stock solo, evitando 1 sobreventa, paga meses de suscripción
- 1 pregunta sin responder = 1 venta perdida que puede valer más que la suscripción anual

### Modelo de cobro
- Argentina: Mercado Pago (ARS)
- Resto LATAM: Mercado Pago (moneda local) o Stripe (USD)
- Trial gratuito 14 días con datos reales del cliente
- Sin contratos, cancelación en cualquier momento

---

## 8. INFRAESTRUCTURA Y COSTOS TÉCNICOS

### Plataforma recomendada: Railway
- Backend (FastAPI) + Frontend (React) + Base de datos (PostgreSQL) en un solo lugar
- Deploy directo desde GitHub
- Escala bien de 0 a 500+ clientes
- Costo estimado: USD 15-25/mes para empezar, escala con uso

### Costos operativos estimados (mensual)

| Concepto | 0-50 clientes | 50-200 clientes | 200-500 clientes |
|---|---|---|---|
| Railway (hosting) | USD 15-25 | USD 50-100 | USD 150-300 |
| Dominio + SSL | USD 2 | USD 2 | USD 2 |
| Email transaccional (Resend/SendGrid) | USD 0 (free tier) | USD 20 | USD 50 |
| Mercado Pago / Stripe comisiones | ~4-5% del revenue | ~4-5% | ~4-5% |
| **Total infra** | **~USD 20-30** | **~USD 75-125** | **~USD 200-350** |

---

## 9. PROYECCIÓN DE REVENUE

### Escenario conservador (precio promedio USD 130/mes/cliente)

| Mes | Clientes | MRR (USD) | Costos (USD) | Neto (USD) |
|---|---|---|---|---|
| 1-3 | 5 | 650 | 50 | 600 |
| 4-6 | 15 | 1,950 | 80 | 1,870 |
| 7-9 | 35 | 4,550 | 120 | 4,430 |
| 10-12 | 60 | 7,800 | 180 | 7,620 |
| 13-18 | 120 | 15,600 | 350 | 15,250 |
| 19-24 | 250 | 32,500 | 600 | 31,900 |

### ARR (Annual Recurring Revenue) proyectado
- Año 1: ~USD 50,000-90,000
- Año 2: ~USD 200,000-400,000

---

## 10. INVERSIÓN NECESARIA

### Para llegar a producto vendible (multi-tenant)

| Concepto | Estimado |
|---|---|
| Desarrollo multi-tenant + auth + pagos | 2-3 meses de trabajo |
| Integración Tienda Nube | 2-3 semanas |
| Integración Shopify | 2-3 semanas |
| Integración Xubio | 2-3 semanas |
| Monitor Mode | 1-2 semanas |
| Landing page + onboarding | 1-2 semanas |
| Infraestructura primer año | USD 300-500 |
| Dominio + branding | USD 100-200 |
| Marketing inicial (ads, contenido) | USD 500-2,000 |
| **Total estimado inversión inicial** | **USD 1,000-3,000 + 4-5 meses de desarrollo** |

### Lo que NO necesitás
- No necesitás inversores para arrancar
- No necesitás equipo — es un solo founder con el producto ya construido
- No necesitás oficina — es SaaS 100% remoto
- No necesitás stock ni logística — margen bruto ~90%+

---

## 11. ESTRATEGIA DE GO-TO-MARKET

### Fase 1 — Validación (mes 1-3)
- 5-10 clientes por contacto directo (red personal, grupos ML)
- Trial gratuito 14 días
- Feedback intensivo para ajustar producto
- Precio de early adopter (50% descuento permanente)

### Fase 2 — Tracción (mes 4-8)
- Landing page con SEO
- Contenido en LinkedIn (target: gerentes, dueños)
- Participación en grupos de vendedores ML (Facebook, WhatsApp)
- Referidos: descuento por traer clientes

### Fase 3 — Escala (mes 9+)
- Ads en Google/Meta apuntando a "dashboard mercado libre", "control stock ecommerce"
- Partners: consultoras de e-commerce, implementadores de ERP
- Webinars / demos en vivo
- Expansión a México y Colombia

---

## 12. RESUMEN EJECUTIVO

**Producto:** Dashboard SaaS de control gerencial para e-commerce + ERP
**Target:** Dueños y gerentes que supervisan e-commerce pero no lo operan
**Diferencial:** Único producto que integra ML + Tienda Nube + Shopify con ERPs argentinos (Odoo, Xubio, Colppy) en una vista gerencial
**Precio:** USD 89-349/mes según plan
**Inversión:** USD 1,000-3,000 + 4-5 meses de desarrollo
**Break-even:** ~15-20 clientes
**Margen bruto:** ~90%+
**Mercado:** Desatendido — competidores apuntan al operador, no al gerente
**Estado:** MVP funcionando con ML + Odoo. Falta multi-tenant y canales adicionales
