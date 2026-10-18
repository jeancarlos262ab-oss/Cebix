from app.services.features import stac

def provider() -> str:
    return "stac"

def extract(geometry: dict, year: int) -> dict:
    return stac.extract_features_stac(geometry, year)

def status() -> dict:
    
    return stac.status()