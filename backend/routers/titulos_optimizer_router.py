"""
Router para optimización de títulos de publicaciones de MercadoLibre usando Claude AI.
Flujo: Obtener publicaciones por marca → Claude genera títulos optimizados → Aprobar y aplicar cambios via ML API.
"""

from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel
import httpx
import asyncio
import os
from datetime import datetime, timedelta, timezone
from typing import List, Optional
from routers.token_manager import get_token_by_marca
from routers.publicaciones_router import MARCAS, get_seller_items, get_items_batch, format_item

router = APIRouter(prefix="/api/titulos", tags=["titulos-optimizer"])

ART = timezone(timedelta(hours=-3))

ANTHROPIC_API_URL = "https://api.anthropic.com/v1/messages"


def _get_api_key():
    return os.environ.get("ANTHROPIC_API_KEY", "")


async def call_claude(titles_data: list[dict]) -> dict:
    """Llama a Claude API para optimizar títulos de MeLi"""
    ANTHROPIC_API_KEY = _get_api_key()
    if not ANTHROPIC_API_KEY:
        raise HTTPException(status_code=500, detail="ANTHROPIC_API_KEY no configurada. Setear variable de entorno.")

    items_text = "\n".join(
        f"- ID: {t['item_id']} | Título actual: \"{t['titulo']}\" | Precio: ${t['precio']} | Vendidas: {t['vendidas']} | Categoría: {t.get('category_id', 'N/A')}"
        for t in titles_data
    )

    prompt = f"""Sos un experto en SEO y posicionamiento en Mercado Libre Argentina.
Tu trabajo es optimizar títulos de publicaciones para maximizar visibilidad en búsquedas de MeLi.

REGLAS DE MERCADO LIBRE:
1. Máximo 60 caracteres (ESTRICTO - contá cada caracter, MeLi corta lo que exceda)
2. Estructura: [Tipo Producto] + [Marca] + [Modelo] + [Atributos Clave]
3. La PRIMERA PALABRA siempre es lo que la gente busca: Termo, Zapatillas, Botella, Bota, Remera, etc.
4. La marca va DESPUÉS del tipo de producto
5. Title Case (primera letra mayúscula de cada palabra)
6. PROHIBIDO: signos (! ? . , - _), palabras como "oferta", "envío gratis", "mejor precio", "original", "premium"
7. Incluir atributos de alto valor de búsqueda: material (Acero Inoxidable), capacidad (530ml), uso (Mate, Gym, Camping)
8. Incluir género si aplica (Hombre/Mujer/Unisex)
9. La marca del vendedor va al FINAL del título (ej: "...Doble Pared Hydrate")
10. Maximizar keywords de búsqueda relevantes dentro del límite de 60 chars

EJEMPLOS DE TÍTULOS BIEN OPTIMIZADOS:
- "Termo Botella Acero Inoxidable 530ml Frío Calor Hydrate"
- "Termo Mate Acero Inoxidable 915ml Pico Cebador Hydrate"
- "Zapatillas Basquet Hombre Shaq Posture Negras"
- "Botella Térmica Acero Inoxidable 355ml Café Hydrate"
- "Bota Timberland Hombre Cuero Premium Waterproof"

IMPORTANTE:
- No inventes información que no esté en el título original
- Podés agregar keywords relevantes que se deduzcan del producto (ej: si es un termo, agregar "Doble Pared" o "Frío Calor")
- Si el título actual ya está bien optimizado, devolvé exactamente el mismo
- CONTÁ LOS CARACTERES: no puede superar 60

Publicaciones a optimizar:

{items_text}

Respondé ÚNICAMENTE con un JSON array válido, sin markdown ni texto adicional:
[
  {{"item_id": "MLA...", "titulo_original": "...", "titulo_optimizado": "...", "cambios": "explicación de mejoras y keywords agregadas"}},
  ...
]"""

    async with httpx.AsyncClient(timeout=60) as client:
        resp = await client.post(
            ANTHROPIC_API_URL,
            headers={
                "x-api-key": ANTHROPIC_API_KEY,
                "anthropic-version": "2023-06-01",
                "content-type": "application/json",
            },
            json={
                "model": "claude-sonnet-4-6",
                "max_tokens": 4096,
                "temperature": 0,
                "messages": [{"role": "user", "content": prompt}],
            },
        )

        if resp.status_code != 200:
            try:
                err_data = resp.json()
                err_msg = err_data.get("error", {}).get("message", "")
                err_type = err_data.get("error", {}).get("type", "")
                detail = f"Status {resp.status_code} | {err_type}: {err_msg} | Full: {resp.text[:300]}"
            except Exception:
                detail = resp.text[:500]
            raise HTTPException(status_code=resp.status_code, detail=f"Error Claude API: {detail}")

        data = resp.json()
        text = data["content"][0]["text"]

        # Parsear JSON de la respuesta
        import json
        # Limpiar posible markdown wrapping
        clean = text.strip()
        if clean.startswith("```"):
            clean = clean.split("\n", 1)[1] if "\n" in clean else clean[3:]
            if clean.endswith("```"):
                clean = clean[:-3]
            clean = clean.strip()

        try:
            suggestions = json.loads(clean)
        except json.JSONDecodeError:
            raise HTTPException(status_code=500, detail=f"Claude devolvió respuesta no-JSON: {text[:300]}")

        return suggestions


@router.get("/optimizar/{marca}")
async def optimizar_titulos_marca(
    marca: str,
    limit: int = Query(20, ge=1, le=50, description="Cantidad de publicaciones a analizar"),
):
    """Obtiene publicaciones de una marca y genera títulos optimizados con Claude AI"""
    marca = marca.upper()
    if marca not in MARCAS:
        raise HTTPException(status_code=400, detail=f"Marca no válida: {marca}")

    token = await get_token_by_marca(marca)
    if not token:
        raise HTTPException(status_code=401, detail=f"Sin autenticación para {marca}")

    uid = MARCAS[marca]
    item_ids = await get_seller_items(uid, token, "active")

    # Limitar para no exceder tokens de Claude
    item_ids = item_ids[:limit]
    items = await get_items_batch(item_ids, token)
    publicaciones = [format_item(item, marca) for item in items]

    # Preparar datos para Claude
    titles_data = [
        {
            "item_id": p["item_id"],
            "titulo": p["titulo"],
            "precio": p["precio"],
            "vendidas": p["vendidas"],
            "category_id": p.get("category_id", ""),
        }
        for p in publicaciones
    ]

    suggestions = await call_claude(titles_data)

    # Enriquecer con datos de la publicación
    suggestions_map = {s["item_id"]: s for s in suggestions}
    result = []
    for pub in publicaciones:
        sug = suggestions_map.get(pub["item_id"])
        if sug:
            changed = sug.get("titulo_optimizado", "") != pub["titulo"]
            result.append({
                "item_id": pub["item_id"],
                "titulo_actual": pub["titulo"],
                "titulo_optimizado": sug.get("titulo_optimizado", pub["titulo"]),
                "cambios": sug.get("cambios", ""),
                "tiene_cambio": changed,
                "precio": pub["precio"],
                "vendidas": pub["vendidas"],
                "stock": pub["stock"],
                "thumbnail": pub["thumbnail"],
                "permalink": pub["permalink"],
            })

    return {
        "marca": marca,
        "timestamp": datetime.now(ART).isoformat(),
        "total_analizadas": len(result),
        "con_cambios": sum(1 for r in result if r["tiene_cambio"]),
        "sugerencias": result,
    }


class AplicarTituloRequest(BaseModel):
    item_id: str
    nuevo_titulo: str


@router.put("/aplicar")
async def aplicar_titulo(req: AplicarTituloRequest):
    """Aplica un título optimizado a una publicación de MeLi"""
    if not req.nuevo_titulo or len(req.nuevo_titulo) > 60:
        raise HTTPException(status_code=400, detail="Título inválido o mayor a 60 caracteres")

    # Detectar marca del item
    marca_encontrada = None
    token = None
    for marca_name in MARCAS:
        t = await get_token_by_marca(marca_name)
        if t:
            # Verificar si el item pertenece a esta marca
            async with httpx.AsyncClient() as client:
                check = await client.get(
                    f"https://api.mercadolibre.com/items/{req.item_id}",
                    headers={"Authorization": f"Bearer {t}"},
                    timeout=10,
                )
                if check.status_code == 200:
                    item_data = check.json()
                    seller_id = item_data.get("seller_id")
                    if seller_id == MARCAS[marca_name]:
                        marca_encontrada = marca_name
                        token = t
                        break

    if not token:
        raise HTTPException(status_code=404, detail=f"No se encontró el item {req.item_id} en ninguna cuenta")

    # Aplicar cambio via ML API
    async with httpx.AsyncClient() as client:
        resp = await client.put(
            f"https://api.mercadolibre.com/items/{req.item_id}",
            headers={
                "Authorization": f"Bearer {token}",
                "Content-Type": "application/json",
            },
            json={"title": req.nuevo_titulo},
            timeout=15,
        )

        if resp.status_code != 200:
            detail = resp.text[:300]
            raise HTTPException(status_code=resp.status_code, detail=f"Error ML API: {detail}")

        return {
            "status": "ok",
            "item_id": req.item_id,
            "marca": marca_encontrada,
            "titulo_aplicado": req.nuevo_titulo,
            "timestamp": datetime.now(ART).isoformat(),
        }


class AplicarMultipleRequest(BaseModel):
    items: List[AplicarTituloRequest]


@router.put("/aplicar-multiple")
async def aplicar_titulos_multiple(req: AplicarMultipleRequest):
    """Aplica múltiples títulos optimizados en batch"""
    resultados = []
    for item in req.items:
        try:
            res = await aplicar_titulo(item)
            resultados.append({"item_id": item.item_id, "status": "ok", "titulo": item.nuevo_titulo})
        except HTTPException as e:
            resultados.append({"item_id": item.item_id, "status": "error", "error": e.detail})
        except Exception as e:
            resultados.append({"item_id": item.item_id, "status": "error", "error": str(e)})

    exitosos = sum(1 for r in resultados if r["status"] == "ok")
    return {
        "total": len(resultados),
        "exitosos": exitosos,
        "fallidos": len(resultados) - exitosos,
        "resultados": resultados,
        "timestamp": datetime.now(ART).isoformat(),
    }
