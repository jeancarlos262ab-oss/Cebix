import io, json, zipfile, sys
sys.path.insert(0, "/home/claude/backend")
import shapefile
from pyproj import Transformer, CRS
from fastapi import FastAPI
from fastapi.testclient import TestClient
from app.api import geo

app = FastAPI(); app.include_router(geo.router)
c = TestClient(app)

# Parcelas de prueba cerca de Cuautinchán, Puebla (lng, lat)
A = [(-98.43,19.28),(-98.428,19.28),(-98.428,19.282),(-98.43,19.282),(-98.43,19.28)]
B = [(-98.40,19.30),(-98.398,19.30),(-98.398,19.302),(-98.40,19.302),(-98.40,19.30)]

def post(files):
    return c.post("/parse-geometry", files=[("files",(n,d,"application/octet-stream")) for n,d in files])

def show(title, r):
    print(f"\n== {title}: HTTP {r.status_code}")
    j = r.json()
    if r.status_code != 200: print("  detail:", j.get("detail")); return j
    for p in j["poligonos"]:
        print("  ", p["ID_POLIGONO"], "|", p["nombre"], "|", p["Estado"], "|", p["Municipio"], "| ha", p["area_ha"], "| ctr", p["lat"], p["lng"], "| err:", p["error"])
    print("  advertencias:", j["advertencias"])
    return j

# 1) GeoJSON FeatureCollection + MultiPolygon
gj = {"type":"FeatureCollection","features":[
 {"type":"Feature","properties":{"ID_POLIGONO":"P1","Estado":"puebla","Municipio":"Cuautinchán"},"geometry":{"type":"Polygon","coordinates":[A]}},
 {"type":"Feature","properties":{"name":"Multi"},"geometry":{"type":"MultiPolygon","coordinates":[[B],[[(x+0.05,y) for x,y in B]]]}},
 {"type":"Feature","properties":{"name":"punto"},"geometry":{"type":"Point","coordinates":[-98.4,19.3]}},
]}
show("GeoJSON", post([("lote.geojson", json.dumps(gj).encode())]))

# 2) KML y KMZ (con altitud y huecos)
def kml(name, ring):
    coords = " ".join(f"{x},{y},2300" for x,y in ring)
    return f'''<?xml version="1.0"?><kml xmlns="http://www.opengis.net/kml/2.2"><Document><Folder>
<Placemark><name>{name}</name><ExtendedData><Data name="Municipio"><value>Tecali</value></Data></ExtendedData>
<Polygon><outerBoundaryIs><LinearRing><coordinates>{coords}</coordinates></LinearRing></outerBoundaryIs>
<innerBoundaryIs><LinearRing><coordinates>-98.4295,19.2805,0 -98.4290,19.2805,0 -98.4290,19.2810,0 -98.4295,19.2805,0</coordinates></LinearRing></innerBoundaryIs></Polygon></Placemark>
</Folder></Document></kml>'''.encode()
k = kml("Parcela KML", A)
show("KML", post([("p.kml", k)]))
buf = io.BytesIO(); zipfile.ZipFile(buf,"w").writestr("doc.kml", k)
show("KMZ", post([("p.kmz", buf.getvalue())]))

# 3) Shapefile en UTM 14N con .prj, suelto y en zip
utm = CRS.from_epsg(32614); tr = Transformer.from_crs(4326, utm, always_xy=True)
def make_shp(ring, crs_wkt=None, with_prj=True):
    shp, shx, dbf = io.BytesIO(), io.BytesIO(), io.BytesIO()
    w = shapefile.Writer(shp=shp, shx=shx, dbf=dbf, shapeType=shapefile.POLYGON)
    w.field("ID_POLIGON","C",20); w.field("ESTADO","C",20); w.field("NOM_MUN","C",30)
    w.poly([ring[::-1]]); w.record("AGC_900","Puebla","Tecamachalco"); w.close()
    files = {"parcelas.shp":shp.getvalue(),"parcelas.shx":shx.getvalue(),"parcelas.dbf":dbf.getvalue()}
    if with_prj and crs_wkt: files["parcelas.prj"] = crs_wkt.encode()
    return files
ring_utm = [tuple(round(v,2) for v in tr.transform(x,y)) for x,y in A]
f = make_shp(ring_utm, utm.to_wkt())
j = show("SHP UTM suelto (.shp+.shx+.dbf+.prj)", post(list(f.items())))
zb = io.BytesIO(); z = zipfile.ZipFile(zb,"w"); [z.writestr("carpeta/"+n,d) for n,d in f.items()]; z.close()
show("SHP UTM en .zip", post([("parcelas.zip", zb.getvalue())]))
show("SHP lat/lng sin .prj", post(list(make_shp(A, None, False).items())))
show("SHP UTM SIN .prj (debe fallar)", post(list(make_shp(ring_utm, None, False).items())))
show("solo .shp (sin dbf/shx)", post([("a.shp", f["parcelas.shp"]), ("a.prj", f["parcelas.prj"])]))

# 4) Errores
show("Formato no soportado", post([("datos.txt", b"hola")]))
show("Solo puntos", post([("p.geojson", json.dumps({"type":"Point","coordinates":[-98,19]}).encode())]))
show("Parcela diminuta/enorme/bowtie", post([("e.geojson", json.dumps({"type":"FeatureCollection","features":[
  {"type":"Feature","properties":{"name":"chica"},"geometry":{"type":"Polygon","coordinates":[[[-98.4,19.3],[-98.39999,19.3],[-98.39999,19.30001],[-98.4,19.30001],[-98.4,19.3]]]}},
  {"type":"Feature","properties":{"name":"enorme"},"geometry":{"type":"Polygon","coordinates":[[[-99,19],[-98,19],[-98,20],[-99,20],[-99,19]]]}},
  {"type":"Feature","properties":{"name":"moño"},"geometry":{"type":"Polygon","coordinates":[[[-98.4,19.3],[-98.39,19.31],[-98.39,19.3],[-98.4,19.31],[-98.4,19.3]]]}}]}).encode())]))
# muchos vértices (círculo de 3000 puntos) -> simplifica
import math
circ = [[-98.4+0.003*math.cos(t*2*math.pi/3000), 19.3+0.003*math.sin(t*2*math.pi/3000)] for t in range(3000)]; circ.append(circ[0])
j = show("3000 vértices", post([("c.geojson", json.dumps({"type":"Polygon","coordinates":[circ]}).encode())]))
print("  vértices tras simplificar:", j["poligonos"][0]["vertices"])
show("JSON roto", post([("x.geojson", b"{no es json")]))
