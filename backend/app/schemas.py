"""Modelos Pydantic de entrada de la API."""

from pydantic import BaseModel, Field


class ParcelaInput(BaseModel):
    ID_POLIGONO: str
    Estado: str = Field(default="Puebla", description="Hidalgo, Puebla o Tlaxcala (define el margen de confianza)")
    features: dict = Field(description="Las 10 features del modelo -> ver GET /features")


class PredictRequest(BaseModel):
    parcelas: list[ParcelaInput]


class GeometryRequest(BaseModel):
    ID_POLIGONO: str = Field(min_length=1, max_length=80)
    Estado: str = Field(default="Puebla", description="Hidalgo, Puebla o Tlaxcala (define el margen de confianza)")
    geometry: dict = Field(description="GeoJSON Polygon en lng/lat (EPSG:4326)")
    anio: int = Field(default=2025, description="Año del ciclo abril–octubre. El modelo se entrenó con 2025.")
