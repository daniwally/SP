"""
Router para optimización de títulos de publicaciones de MercadoLibre usando Claude AI.
Flujo: Obtener publicaciones por marca → Claude genera títulos optimizados → Aprobar y aplicar cambios via ML API.
"""

from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel
import httpx
import asyncio
import os
import json
from pathlib import Path
from datetime import datetime, timedelta, timezone
from typing import List, Optional
from routers.token_manager import get_token_by_marca
from routers.publicaciones_router import MARCAS, get_seller_items, get_items_batch, format_item

router = APIRouter(prefix="/api/titulos", tags=["titulos-optimizer"])

ART = timezone(timedelta(hours=-3))

# --- Historial de títulos aplicados (JSON local) ---
HISTORIAL_PATH = Path(__file__).parent.parent / "titulos_historial.json"


def _load_historial() -> list:
    if HISTORIAL_PATH.exists():
        try:
            return json.loads(HISTORIAL_PATH.read_text(encoding="utf-8"))
        except (json.JSONDecodeError, OSError):
            return []
    return []


def _save_historial(historial: list):
    HISTORIAL_PATH.write_text(json.dumps(historial, ensure_ascii=False, indent=2), encoding="utf-8")

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

    prompt = f"""Sos un experto en SEO, posicionamiento y research de búsquedas en Mercado Libre Argentina.
Tu trabajo tiene DOS partes:

PARTE 1 - RESEARCH DE KEYWORDS GANADORAS:
Antes de optimizar, pensá en qué palabras usa la gente REAL cuando busca estos productos en MeLi Argentina.
Las keywords ganadoras son las que tienen mayor volumen de búsqueda y conversión. Ejemplos reales:
- "Acero Inoxidable" pierde contra "Doble Acero" o "Acero 304" (la gente busca más específico)
- "Botella" pierde contra "Botella Térmica" (más intención de compra)
- "Frio Calor" pierde contra "Frío 24hs Calor 12hs" (dato concreto convierte más)
- "Zapatillas Basquet" gana sobre "Zapatillas Basketball" (español > inglés en MeLi AR)
- "Termo Mate" gana sobre "Termo Matero" (más volumen de búsqueda)
- "Sin BPA" es keyword ganadora para productos infantiles
- "Doble Pared" es keyword ganadora para termos (implica calidad)
- "Pico Cebador" es keyword ganadora para termos materos
- "Suela Antideslizante" gana en calzado
- "Impermeable" o "Waterproof" gana en botas
- "Aislamiento Vacío" es keyword premium para termos
- Capacidades exactas: "500ml", "1L", "1.9L" son keywords de búsqueda directa

Pensá: ¿qué pondría YO en el buscador de MeLi si quisiera comprar este producto?

PARTE 2 - REGLAS DE TÍTULOS MELI:
1. Máximo 60 caracteres (ESTRICTO - contá cada caracter incluyendo espacios)
2. USÁ LOS 60 CARACTERES AL MÁXIMO. Cada caracter libre es una oportunidad perdida de posicionamiento. Si te sobran caracteres, agregá: color (Negro, Blanco, Gris), material, uso (Gym, Oficina, Camping, Running), género, o atributo diferenciador.
3. Estructura: [Producto] + [Keywords Ganadoras] + [Capacidad/Talle] + [Color/Atributo Extra] + [Marca]
4. Primera palabra = lo que la gente busca (Termo, Zapatillas, Botella, Bota)
5. La marca del vendedor va al FINAL
6. Title Case (Cada Palabra Con Mayúscula)
7. PROHIBIDO: signos (! ? . , - _), "oferta", "envío gratis", "mejor precio", "nuevo", "original"
8. Priorizar keywords ganadoras de la categoría sobre palabras genéricas
9. Incluir género si aplica (Hombre/Mujer/Unisex)
10. Si el título actual ya tiene las mejores keywords posibles Y usa los 60 chars, devolvé el mismo
11. SIEMPRE sumá el color del producto si se puede deducir del título original o es un atributo relevante
12. Cada keyword extra que sumes = más búsquedas donde aparece el producto = más ventas

EJEMPLOS (notar que todos usan cerca de 60 chars):
- ANTES: "Termo Hydrate Acero Inoxidable Botella Frio Calor 530 ml"
  DESPUÉS: "Termo Botella Térmica Doble Pared 530ml Frío 24hs Hydrate" (57 chars - keywords: Doble Pared, Térmica, 24hs)
- ANTES: "Termo Mate Hydrate 915ml Acero Inoxidable"
  DESPUÉS: "Termo Mate Doble Acero 915ml Pico Cebador Negro Hydrate" (55 chars - keywords: Doble Acero, Pico Cebador, Negro)
- ANTES: "Zapatillas Basquet SHAQ Posture Negras"
  DESPUÉS: "Zapatillas Basquet Hombre Caña Alta Negras Shaq Posture" (55 chars - keywords: Hombre, Caña Alta, Negras)
- ANTES: "Botella Hydrate 620ml"
  DESPUÉS: "Botella Térmica Deportiva Acero 620ml Sin BPA Gym Hydrate" (57 chars - llenó con keywords de alto valor)

Publicaciones a optimizar:

{items_text}

Respondé ÚNICAMENTE con un JSON array válido, sin markdown ni texto adicional:
[
  {{"item_id": "MLA...", "titulo_original": "...", "titulo_optimizado": "...", "cambios": "keywords ganadoras agregadas y por qué mejoran el posicionamiento"}},
  ...
]"""

    async with httpx.AsyncClient(timeout=120) as client:
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
    limit: int = Query(10, ge=1, le=50, description="Cantidad de publicaciones a analizar"),
):
    """Obtiene publicaciones de una marca y genera títulos optimizados con Claude AI"""
    marca = marca.upper()
    if marca not in MARCAS:
        raise HTTPException(status_code=400, detail=f"Marca no válida: {marca}")

    token = await get_token_by_marca(marca)
    if not token:
        raise HTTPException(status_code=401, detail=f"Sin autenticación para {marca}")

    try:
        uid = MARCAS[marca]
        item_ids = await get_seller_items(uid, token, "active")
        items = await get_items_batch(item_ids, token)
        publicaciones = [format_item(item, marca) for item in items]

        # Separar editables (sin ventas) de no editables
        editables = [p for p in publicaciones if p.get("vendidas", 0) == 0]
        no_editables = [p for p in publicaciones if p.get("vendidas", 0) > 0]

        # Limitar solo los editables para Claude
        editables = editables[:limit]
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error obteniendo publicaciones de MeLi: {str(e)[:200]}")

    if not editables:
        return {
            "marca": marca,
            "timestamp": datetime.now(ART).isoformat(),
            "total_analizadas": 0,
            "con_cambios": 0,
            "no_editables": len(no_editables),
            "sugerencias": [],
            "mensaje": f"No hay publicaciones sin ventas para optimizar. {len(no_editables)} publicaciones tienen ventas y MeLi no permite modificar su título.",
        }

    # Preparar datos para Claude (solo editables)
    titles_data = [
        {
            "item_id": p["item_id"],
            "titulo": p["titulo"],
            "precio": p["precio"],
            "vendidas": p["vendidas"],
            "category_id": p.get("category_id", ""),
        }
        for p in editables
    ]

    try:
        suggestions = await call_claude(titles_data)
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error procesando con Claude AI: {str(e)[:200]}")

    # Enriquecer con datos de la publicación
    suggestions_map = {s["item_id"]: s for s in suggestions}
    result = []
    for pub in editables:
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
        "no_editables": len(no_editables),
        "sugerencias": result,
    }


class AplicarTituloRequest(BaseModel):
    item_id: str
    nuevo_titulo: str
    marca: Optional[str] = None


@router.put("/aplicar")
async def aplicar_titulo(req: AplicarTituloRequest):
    """Aplica un título optimizado a una publicación de MeLi"""
    if not req.nuevo_titulo:
        raise HTTPException(status_code=400, detail="Título vacío")
    # Truncar a 60 chars si Claude se pasó
    titulo_final = req.nuevo_titulo[:60]

    # Si viene la marca, usarla directo (evita iterar por todas)
    marca_encontrada = None
    token = None
    item_data = None

    if req.marca and req.marca.upper() in MARCAS:
        marca_encontrada = req.marca.upper()
        token = await get_token_by_marca(marca_encontrada)

    # Fallback: detectar marca del item
    if not token:
        for marca_name in MARCAS:
            t = await get_token_by_marca(marca_name)
            if t:
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

    # Obtener título anterior si no lo tenemos
    if not item_data:
        async with httpx.AsyncClient() as client:
            check = await client.get(
                f"https://api.mercadolibre.com/items/{req.item_id}",
                headers={"Authorization": f"Bearer {token}"},
                timeout=10,
            )
            item_data = check.json() if check.status_code == 200 else {}

    # Aplicar cambio via ML API
    async with httpx.AsyncClient() as client:
        resp = await client.put(
            f"https://api.mercadolibre.com/items/{req.item_id}",
            headers={
                "Authorization": f"Bearer {token}",
                "Content-Type": "application/json",
            },
            json={"title": titulo_final},
            timeout=15,
        )

        if resp.status_code not in (200, 201):
            detail = resp.text[:500]
            print(f"[TITULO ERROR] item={req.item_id} marca={marca_encontrada} status={resp.status_code} titulo='{titulo_final}' response={detail}")
            raise HTTPException(status_code=resp.status_code, detail=f"Error ML API ({resp.status_code}): {detail}")

        ts = datetime.now(ART).isoformat()

        # Guardar en historial
        titulo_anterior = item_data.get("title", "")
        historial = _load_historial()
        historial.append({
            "item_id": req.item_id,
            "marca": marca_encontrada,
            "titulo_anterior": titulo_anterior,
            "titulo_nuevo": titulo_final,
            "chars_anterior": len(titulo_anterior),
            "chars_nuevo": len(titulo_final),
            "timestamp": ts,
        })
        _save_historial(historial)

        return {
            "status": "ok",
            "item_id": req.item_id,
            "marca": marca_encontrada,
            "titulo_aplicado": titulo_final,
            "timestamp": ts,
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


@router.get("/historial")
async def obtener_historial(marca: Optional[str] = None, limit: int = Query(50, ge=1, le=500)):
    """Devuelve el historial de títulos aplicados, más recientes primero"""
    historial = _load_historial()
    if marca:
        historial = [h for h in historial if h.get("marca", "").lower() == marca.lower()]
    # Más recientes primero
    historial.reverse()
    return {
        "total": len(historial),
        "historial": historial[:limit],
    }
