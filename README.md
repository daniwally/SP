# Sobrepatas Dashboard

Dashboard interactivo para visualizar ventas de MercadoLibre y stock de Odoo.

## Stack
- **Backend**: Python FastAPI
- **Frontend**: React + Vite  
- **Database**: PostgreSQL en Railway
- **Deployment**: Railway (CI/CD desde GitHub)

## Quick Start

### Backend
```bash
cd backend
pip install -r requirements.txt
python -m uvicorn main:app --reload
```

### Frontend
```bash
cd frontend
npm install
npm run dev
```

## Deployment en Railway
1. Conectar repo a Railway
2. Variables de entorno en Railway
3. Auto-deploy en cada push

## API Endpoints
- GET `/api/ml/ventas/hoy` - Ventas de hoy
- GET `/api/ml/ventas/7dias` - Últimos 7 días
- GET `/api/odoo/stock/actual` - Stock actual
- GET `/api/odoo/facturas/mes` - Facturas del mes
