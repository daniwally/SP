from fastapi import APIRouter

router = APIRouter()

@router.get("/stock/actual")
async def stock_actual():
    return {"status": "not implemented yet"}

@router.get("/facturas/mes")
async def facturas_mes():
    return {"status": "not implemented yet"}
