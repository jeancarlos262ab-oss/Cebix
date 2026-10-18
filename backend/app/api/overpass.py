import hashlib
import json
import os
import threading
import urllib.error
import urllib.parse
import urllib.request
from collections import OrderedDict
from concurrent.futures import FIRST_COMPLETED, ThreadPoolExecutor, wait

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field

router = APIRouter(tags=["overpass"])

ENDPOINTS = [
    e.strip()
    for e in os.environ.get(
        "OVERPASS_ENDPOINTS",
        "https://overpass-api.de/api/interpreter,https://overpass.kumi.systems/api/interpreter,"
        "https://maps.mail.ru/osm/tools/overpass/api/interpreter",
    ).split(",")
    if e.strip()
]
TIMEOUT_S = float(os.environ.get("OVERPASS_TIMEOUT_S", "20"))
CACHE_MAX = 256

_cache: "OrderedDict[str, dict]" = OrderedDict()
_lock = threading.Lock()

class OverpassRequest(BaseModel):
    query: str = Field(min_length=1, max_length=20000)

def _ask(url: str, query: str) -> dict:
    req = urllib.request.Request(
        url,
        data=urllib.parse.urlencode({"data": query}).encode(),
        headers={"Content-Type": "application/x-www-form-urlencoded", "User-Agent": "cebix-backend/1.0"},
    )
    with urllib.request.urlopen(req, timeout=TIMEOUT_S) as res:  
        data = json.loads(res.read())
    remark = str(data.get("remark", ""))
    if remark and not data.get("elements") and any(k in remark.lower() for k in ("error", "timed out", "out of memory")):
        raise RuntimeError(remark)
    return data

@router.post("/overpass")
def overpass(payload: OverpassRequest):
    
    key = hashlib.sha1(payload.query.encode()).hexdigest()
    with _lock:
        if key in _cache:
            _cache.move_to_end(key)
            return _cache[key]

    pool = ThreadPoolExecutor(len(ENDPOINTS))
    try:
        pending = {pool.submit(_ask, url, payload.query) for url in ENDPOINTS}
        errors: list[str] = []
        while pending:
            done, pending = wait(pending, return_when=FIRST_COMPLETED)
            for f in done:
                try:
                    data = f.result()
                except (urllib.error.URLError, OSError, ValueError, RuntimeError) as e:
                    errors.append(str(e)[:120])
                    continue
                with _lock:
                    _cache[key] = data
                    while len(_cache) > CACHE_MAX:
                        _cache.popitem(last=False)
                return data
    finally:
        pool.shutdown(wait=False, cancel_futures=True)
    raise HTTPException(status_code=502, detail="Ningún servidor de Overpass respondió: " + " | ".join(errors[:3]))