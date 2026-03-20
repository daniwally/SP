"""
Centralized token manager for MercadoLibre API.
All routers should use get_token() from this module.
Uses refresh_tokens for auto-renewal, with hardcoded fallback.
"""
import httpx
from datetime import datetime, timedelta, timezone

ART = timezone(timedelta(hours=-3))

CUENTAS = {
    1: (2389178513, "SHAQ"),
    2: (2339108379, "STARTER"),
    3: (231953468, "HYDRATE"),
    4: (1434057904, "TIMBERLAND"),
    5: (1630806191, "URBAN_FLOW"),
}

# Reverse lookup: marca -> cuenta_num
MARCA_TO_CUENTA = {marca: num for num, (uid, marca) in CUENTAS.items()}

# Refresh tokens (valid 6 months from 15/03/2026)
REFRESH_TOKENS = {
    1: "TG-69b69f428dd1340001ad993d-2389178513",
    2: "TG-69b69f4247245b00016c6f22-2339108379",
    3: "TG-69b69f43f4cf8200013075bb-231953468",
    4: "TG-69b69f4386049a000185b420-1434057904",
    5: "TG-69b69f43c3ae1b00019ffc91-1630806191",
}

# Hardcoded fallback tokens
TOKENS_HARDCODED = {
    1: "APP_USR-7660452352870630-031400-50a338ae07bd2731123c716b20fa2269-2389178513",
    2: "APP_USR-7660452352870630-031400-8e3e08784d7d3c2a8ede4d6fed821db5-2339108379",
    3: "APP_USR-7660452352870630-031323-ad0383c9d33588f095546dff4059d22e-231953468",
    4: "APP_USR-7660452352870630-031400-f5bdd3f7cffbef04777fd2e48891fda0-1434057904",
    5: "APP_USR-7660452352870630-031400-a00b56f29940c93ae2d3c0d164761155-1630806191",
}

APP_ID = "7660452352870630"
APP_SECRET = "QEXEvr8roSZSrK0ujdccsADSqjjrgOpq"

# In-memory cache
_TOKEN_CACHE = {}


async def get_token(cuenta_num: int, force_refresh: bool = False) -> str:
    """Get access token: cache -> refresh_token -> hardcoded fallback"""

    # Check cache
    if cuenta_num in _TOKEN_CACHE and not force_refresh:
        cached = _TOKEN_CACHE[cuenta_num]
        if datetime.now(ART).timestamp() < cached.get("expires_at", 0):
            return cached["token"]

    # Try refresh
    refresh_token = REFRESH_TOKENS.get(cuenta_num)
    if refresh_token:
        try:
            async with httpx.AsyncClient() as client:
                resp = await client.post(
                    "https://api.mercadolibre.com/oauth/token",
                    data={
                        "grant_type": "refresh_token",
                        "client_id": APP_ID,
                        "client_secret": APP_SECRET,
                        "refresh_token": refresh_token,
                    },
                    timeout=10,
                )
                resp.raise_for_status()
                token_data = resp.json()

            access_token = token_data.get("access_token")
            expires_in = token_data.get("expires_in", 21600)
            expires_at = datetime.now(ART).timestamp() + expires_in - 300

            _TOKEN_CACHE[cuenta_num] = {
                "token": access_token,
                "expires_at": expires_at,
            }

            print(f"✅ Token {cuenta_num}: REFRESHED")
            return access_token

        except Exception as e:
            print(f"⚠️ Token {cuenta_num}: Refresh failed - {e}")

    # Fallback
    token = TOKENS_HARDCODED.get(cuenta_num)
    if token:
        print(f"⚠️ Token {cuenta_num}: Using hardcoded fallback")
    return token


async def get_token_by_marca(marca: str) -> str:
    """Get token by brand name"""
    cuenta_num = MARCA_TO_CUENTA.get(marca)
    if cuenta_num is None:
        return None
    return await get_token(cuenta_num)
