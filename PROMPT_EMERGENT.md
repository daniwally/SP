# Prompt para Emergent / Lovable / Bolt / v0

Copia y pega esto directamente en la plataforma:

---

## Prompt

Quiero construir un **dashboard SaaS de business intelligence para e-commerce** con las siguientes especificaciones:

### Concepto General
Dashboard ejecutivo para dueños y gerentes que venden en Mercado Libre + tienen un ERP (Odoo). Consolida datos de ventas e-commerce, ventas retail, stock, publicaciones y preguntas de clientes en un solo lugar. NO es para operadores, es para quien toma decisiones.

### Diseño Visual (MUY IMPORTANTE - respetar esto)
- **Dark theme total** — fondo negro (#000000) con transparencias
- **Paleta neon**: gradiente principal magenta (#d946ef) a cyan (#06b6d4)
- **Cards**: background rgba(0,0,0,0.5), border 1px solid rgba(217,70,239,0.2), border-radius 12px
- **Hover en cards**: lift sutil (translateY -4px), border más brillante, box-shadow magenta
- **Tipografía**: Inter (Google Fonts), weights 300-800
- **Números grandes**: gradient text (magenta → cyan) con -webkit-background-clip: text
- **Background**: imagen rotativa con fade cada 12 segundos, overlay gradient oscuro de izquierda a derecha, opacity 0.55
- **Glassmorphism**: backdrop-filter blur en el header
- **Sin emojis decorativos** en la UI principal, solo iconos sutiles donde sea necesario
- Mobile responsive con breakpoints en 768px, 480px y 375px

### Navegación — 7 Tabs horizontales
1. **Ventas E-commerce** (tab principal)
2. **Retail**
3. **Ventas** (consolidado e-commerce + retail)
4. **Publicaciones**
5. **Stock**
6. **Status** (salud del sistema)
7. **TV Monitor** (modo pantalla completa tipo exchange/bolsa)

---

### Tab 1: Ventas E-commerce

**Sección: Ventas del Día**
- Fecha en español (ej: "jueves 27 de marzo")
- Grid de cards por marca (SHAQ, STARTER, HYDRATE, TIMBERLAND, URBAN_FLOW, ELSYS)
- Cada card muestra: logo de marca, importe total (grande, gradient text), "X productos vendidos", lista top 5 productos con cantidad
- Barra de total al pie: "Total del día" con importe y cantidad

**Sección: Ventas de la Semana**
- Rango de fechas (ej: "20/03 - 27/03")
- Mismo layout que ventas del día pero con datos de 7 días
- Cards por marca con desglose
- Totales de la semana

**Sección: Acumulado Mensual**
- 4 KPI cards en fila horizontal:
  - Acumulado ($, grande gradient)
  - Promedio diario ($)
  - Productos vendidos (número)
  - Promedio prod/día (número)
- Solo número grande + subtítulo debajo, diseño limpio

**Sección: Consulta por Rango de Fechas**
- 2 date pickers (Desde / Hasta) con estilo dark
- Botón "Consultar"
- Resultados: cards por marca con importe + productos vendidos
- **Gráfico de líneas** (Chart.js) mostrando variación diaria por marca
  - Una línea por marca, colores asignados
  - Tooltip: marca, importe, artículos del día, total del día sumando todas las marcas
  - Ejes con formato moneda ($XXk, $X.XM)

**Sección: Top 3 Marcas del Mes**
- 3 cards grandes con badge de ranking (#1, #2, #3)
- Gradiente en el borde superior (magenta → cyan → amber)
- Datos: marca, importe, productos vendidos, % del total, top 5 productos

---

### Tab 2: Retail (Odoo ERP)

**Sub-tabs**: Resumen | Pedidos | Clientes

**Resumen:**
- 2 filas de KPI cards (8 cards total):
  - Fila 1: Pedidos, Total ventas $, Ticket promedio, Items vendidos
  - Fila 2: Pre-ventas, Total pre-ventas $, Total clientes, Recurrentes
- Cards de período: Ventas del Mes (con top 10 pedidos) + Pre Ventas
- Top Marcas con barras de progreso

**Pedidos:**
- Tabla expandible de pedidos con detalle de líneas
- Columnas: Pedido, Fecha, Cliente, Importe, Items, Estado
- Al expandir: tabla nested con Producto, Cant., P.Unit., Subtotal

**Clientes:**
- KPIs: Total clientes, Total facturado, Recurrentes, Ticket promedio
- Tabla: Cliente, Ciudad, Compras, Total, Última compra, Email
- Badge de recurrencia (ej: "x3")

---

### Tab 3: Ventas Consolidado (E-commerce + Retail)

- 2 cards lado a lado: "Últimos 7 Días" y "Acumulado del Mes"
- Cada card muestra:
  - Total combinado (gradient grande)
  - Split E-commerce (magenta) vs Retail (cyan) con importes y unidades
  - Barra comparativa de porcentaje (2 colores)
- Desglose por marca: 4 cards en grid 2x2
  - E-commerce semana, Retail mes, E-commerce mes, Comparativo dual-bar por marca

---

### Tab 4: Publicaciones

- Filtros: Por Marca / Todas, selector de marca, estado (Activa/Pausada/Cerrada), búsqueda por texto
- KPIs: Total publicaciones, Stock total, Vendidas, Precio promedio, Envío gratis %, Valor stock
- Tabla ordenable: Marca, Título, Estado, Precio, Salud %, Stock, Vendidas, Tipo, Envío, Condición, Fotos, Días, Link
- Botón exportar a Excel
- Sección "Preguntas sin responder" por marca (últimos 15 días)

---

### Tab 5: Stock
- Grid de cards por marca
- Cada card: logo, tabla de productos con SKU, stock ML, stock Odoo, diferencia
- Alertas de desincronización (stock ML ≠ stock Odoo)

---

### Tab 6: Status
- Estado de conexión con APIs (ML, Odoo)
- Tokens: estado, expiración, refresh automático
- Cards de salud del sistema

---

### Tab 7: TV Monitor (CLAVE - diseño tipo exchange/bolsa)

**Pantalla completa tipo trading floor:**
- Header: indicador verde pulsante "LIVE" + "E-Commerce Live Monitor" + fecha + reloj digital (cyan, monospace, grande) + botón "Pantalla completa"
- **3 KPI cards grandes**: Ventas Hoy (verde), Ventas Semana (cyan), Acumulado Mes (magenta) — cada uno con número de productos vendidos + importe debajo
- **4 paneles rotativos** (cambian cada 12 segundos con fade):
  - Panel 1: Ventas del día por marca (cards con logo, productos, importe, top 10 productos)
  - Panel 2: Ventas de la semana por marca
  - Panel 3: Acumulado mensual por marca
  - Panel 4: Gráfico de líneas de variación diaria
- **Dots de navegación** entre paneles (clickeables)
- **Status bar**: preguntas sin responder (rojo/verde), promedio diario, productos vendidos mes
- **Ticker bar animado** (scroll horizontal infinito tipo bolsa): marca | productos | importe | separador, repitiendo
- En fullscreen: background image con gradient overlay, auto-refresh cada 5 minutos
- Animaciones: pulse en indicador live, fadeIn en paneles, ticker scroll 30s linear infinite

### Marcas y Colores
```
SHAQ: #f59e0b (amber/naranja)
STARTER: #06b6d4 (cyan)
HYDRATE: #22c55e (verde)
TIMBERLAND: #a855f7 (purple)
URBAN_FLOW: #ef4444 (rojo)
ELSYS: #ec4899 (rosa)
```

### Elementos Globales
- **Botón refresh** circular (45px, borde magenta, ícono ↻ que rota 180° en hover)
- **Loading screen**: fondo con imagen, spinner de 3 segmentos rotativos (magenta/cyan/purple), título "Cargando datos" con shimmer gradient + dots animados
- **Moneda**: Peso argentino, formato sin centavos (ej: $1.234.567), locale es-AR
- **Responsive**: todo debe funcionar en mobile. Cards van de multi-columna a 1 columna, tabs se wrappean, fuentes se reducen

### Stack sugerido
- React + Vite
- Chart.js / react-chartjs-2 para gráficos
- Axios para API calls
- react-datepicker para selectores de fecha
- xlsx para exportación Excel

---

**IMPORTANTE**: El diseño debe verse premium y profesional, tipo fintech/trading platform. Nada de colores claros ni fondos blancos. Todo dark con acentos neon. Las cards deben tener profundidad con transparencias y bordes sutiles. Los números importantes siempre en gradient text grande.
