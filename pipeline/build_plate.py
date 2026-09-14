"""
Build Plate Generator for Swedish Lighthouse Map (Svenska Fyrar).
Downloads AWS Open Data Terrarium elevation tiles for the full Nordic & Baltic basin
(Norway, Sweden, Denmark, Finland, Northern Germany) at Zoom 9,
decodes float32 elevation before resizing to eliminate Lanczos ringing,
rasterizes authoritative OpenStreetMap vector coastline polygons and Natural Earth lakes,
computes a narrow-band Signed Distance Field (SDF) in channel B,
ambient occlusion in channel A, and exports 4096x6144 master plate.png.
"""

import os
import math
import zipfile
import urllib.request
from concurrent.futures import ThreadPoolExecutor
import numpy as np
from PIL import Image, ImageDraw
import shapefile
import scipy.ndimage

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
CACHE_DIR = os.path.join(SCRIPT_DIR, "cache", "tiles_z9")
OUTPUT_PATH = os.path.join(SCRIPT_DIR, "..", "public", "data", "plate.png")

os.makedirs(CACHE_DIR, exist_ok=True)
os.makedirs(os.path.dirname(OUTPUT_PATH), exist_ok=True)

# Expanded Nordic & Baltic Basin Bounds
# dy / dx is exactly 1.50 (4096 x 6144 aspect ratio)
LON_MIN, LON_MAX = 4.24, 30.76
LAT_MIN, LAT_MAX = 53.50, 71.30

PLATE_WIDTH = 4096
PLATE_HEIGHT = 6144
MAX_ELEV_M = 2500.0  # Covers Galdhøpiggen (2469m) and Kebnekaise (2097m)

ZOOM = 9
# Tile ranges for Nordic basin at zoom 9
X_MIN, X_MAX = 262, 299  # 38 columns
Y_MIN, Y_MAX = 109, 165  # 57 rows
# Total: 2,166 tiles

CAISSON_LIGHTS = [
    {"name": "Almagrundet", "lat": 59.15469, "lon": 19.12553},
    {"name": "Ölands Södra Grund", "lat": 56.06963, "lon": 16.68062},
    {"name": "Sydostbrotten", "lat": 63.33693, "lon": 20.17332},
    {"name": "Gustav Dalén", "lat": 58.59417, "lon": 17.46733},
    {"name": "Revengegrundet", "lat": 59.25083, "lon": 19.01167},
]

def lat_lon_to_mercator(lat, lon):
    R = 6378137.0
    x = R * math.radians(lon)
    y = R * math.log(math.tan(math.pi / 4.0 + math.radians(lat) / 2.0))
    return x, y

def mercator_to_tile_fraction(x, y, zoom):
    R = 6378137.0
    initial_resolution = 2.0 * math.pi * R / 256.0
    origin_shift = 2.0 * math.pi * R / 2.0
    res = initial_resolution / (2 ** zoom)
    px = (x + origin_shift) / res
    py = (origin_shift - y) / res
    return px / 256.0, py / 256.0

def fetch_tile(x, y):
    tile_file = os.path.join(CACHE_DIR, f"{ZOOM}_{x}_{y}.png")
    if os.path.exists(tile_file):
        try:
            return x, y, Image.open(tile_file).convert("RGB")
        except Exception:
            pass

    url = f"https://s3.amazonaws.com/elevation-tiles-prod/terrarium/{ZOOM}/{x}/{y}.png"
    req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)"})
    try:
        with urllib.request.urlopen(req, timeout=12) as resp:
            data = resp.read()
            with open(tile_file, "wb") as f:
                f.write(data)
            return x, y, Image.open(tile_file).convert("RGB")
    except Exception:
        # Fallback ocean tile (RGB 128, 0, 0 = 0m)
        blank = Image.new("RGB", (256, 256), (128, 0, 0))
        return x, y, blank

def compute_ambient_occlusion(elev_arr, sample_radius=5):
    """
    Computes terrain ambient occlusion: ridges are exposed (1.0), deep valleys/fjords are shadowed.
    Uses numpy slicing for fast box filter.
    """
    h, w = elev_arr.shape
    r = sample_radius
    pad = np.pad(elev_arr, r, mode='edge')
    # 4-sample cross average for high-speed AO
    blurred = (pad[r:h+r, r-r:w+r-r] + pad[r:h+r, r+r:w+r+r] + pad[r-r:h+r-r, r:w+r] + pad[r+r:h+r+r, r:w+r]) * 0.25
    diff = elev_arr - blurred
    ao = np.clip(0.65 + (diff / 100.0) * 0.35, 0.2, 1.0)
    return (ao * 255.0).astype(np.uint8)

def rasterize_vector_land_and_lakes(x_merc_min, y_merc_min, x_merc_max, y_merc_max):
    print("[plate] Rasterizing authoritative OpenStreetMap vector coastline & Natural Earth lakes...")
    land_img = Image.new("1", (PLATE_WIDTH, PLATE_HEIGHT), 0)
    draw = ImageDraw.Draw(land_img)

    # 1. Rasterize OSM Land Polygons (EPSG:3857)
    osm_zip_path = os.path.join(SCRIPT_DIR, "cache", "simplified-land-polygons-complete-3857.zip")
    if not os.path.exists(osm_zip_path):
        raise FileNotFoundError(
            f"Missing OSM vector land archive: {osm_zip_path}. "
            "Download it from https://osmdata.openstreetmap.de/download/simplified-land-polygons-complete-3857.zip"
        )
    with zipfile.ZipFile(osm_zip_path) as z:
        sf_land = shapefile.Reader(
            shp=z.open("simplified-land-polygons-complete-3857/simplified_land_polygons.shp"),
            dbf=z.open("simplified-land-polygons-complete-3857/simplified_land_polygons.dbf"),
            shx=z.open("simplified-land-polygons-complete-3857/simplified_land_polygons.shx"),
        )
        for s in sf_land.iterShapes():
            min_x, min_y, max_x, max_y = s.bbox
            if max_x < x_merc_min or min_x > x_merc_max or max_y < y_merc_min or min_y > y_merc_max:
                continue
            parts = list(s.parts) + [len(s.points)]
            for i in range(len(s.parts)):
                pts = s.points[parts[i]:parts[i+1]]
                if len(pts) < 3:
                    continue
                pix_pts = [
                    (
                        (pt[0] - x_merc_min) / (x_merc_max - x_merc_min) * PLATE_WIDTH,
                        (1.0 - (pt[1] - y_merc_min) / (y_merc_max - y_merc_min)) * PLATE_HEIGHT
                    )
                    for pt in pts
                ]
                draw.polygon(pix_pts, fill=1)

    # 2. Punch out Natural Earth Lakes (EPSG:4326)
    lakes_zip_path = os.path.join(SCRIPT_DIR, "cache", "ne_10m_lakes.zip")
    if not os.path.exists(lakes_zip_path):
        raise FileNotFoundError(
            f"Missing Natural Earth lakes archive: {lakes_zip_path}. "
            "Download it from https://naciscdn.org/naturalearth/10m/physical/ne_10m_lakes.zip"
        )
    with zipfile.ZipFile(lakes_zip_path) as z:
        sf_lakes = shapefile.Reader(
            shp=z.open("ne_10m_lakes.shp"),
            dbf=z.open("ne_10m_lakes.dbf"),
            shx=z.open("ne_10m_lakes.shx"),
        )
        for s in sf_lakes.iterShapes():
            min_lon, min_lat, max_lon, max_lat = s.bbox
            if max_lon < LON_MIN or min_lon > LON_MAX or max_lat < LAT_MIN or min_lat > LAT_MAX:
                continue
            parts = list(s.parts) + [len(s.points)]
            for i in range(len(s.parts)):
                pts = s.points[parts[i]:parts[i+1]]
                if len(pts) < 3:
                    continue
                pix_pts = []
                for pt in pts:
                    mx, my = lat_lon_to_mercator(pt[1], pt[0])
                    px = (mx - x_merc_min) / (x_merc_max - x_merc_min) * PLATE_WIDTH
                    py = (1.0 - (my - y_merc_min) / (y_merc_max - y_merc_min)) * PLATE_HEIGHT
                    pix_pts.append((px, py))
                draw.polygon(pix_pts, fill=0)

    is_land = np.array(land_img, dtype=bool)

    print("[plate] Computing narrow-band Signed Distance Field (SDF)...")
    dist_inside = scipy.ndimage.distance_transform_edt(is_land)
    dist_outside = scipy.ndimage.distance_transform_edt(~is_land)
    signed_dist = dist_inside - dist_outside

    band = 6.0
    sdf = np.clip((signed_dist / band) * 127.5 + 127.5, 0.0, 255.0).astype(np.uint8)
    return sdf, signed_dist

def build_plate():
    total_tiles = (X_MAX - X_MIN + 1) * (Y_MAX - Y_MIN + 1)
    print(f"[plate] Fetching {total_tiles} Terrarium elevation tiles at zoom {ZOOM} for full Nordic region...")

    tasks = []
    with ThreadPoolExecutor(max_workers=32) as executor:
        for y in range(Y_MIN, Y_MAX + 1):
            for x in range(X_MIN, X_MAX + 1):
                tasks.append(executor.submit(fetch_tile, x, y))

        results = []
        completed = 0
        for t in tasks:
            results.append(t.result())
            completed += 1
            if completed % 400 == 0 or completed == total_tiles:
                print(f"[plate] Download progress: {completed}/{total_tiles} tiles ({completed/total_tiles*100:.1f}%)")

    tile_dict = {(x, y): img for x, y, img in results}

    cols = X_MAX - X_MIN + 1
    rows = Y_MAX - Y_MIN + 1
    mosaic_w = cols * 256
    mosaic_h = rows * 256

    print(f"[plate] Assembling {mosaic_w}x{mosaic_h} raw mosaic...")
    mosaic = Image.new("RGB", (mosaic_w, mosaic_h))
    for (x, y), img in tile_dict.items():
        pos_x = (x - X_MIN) * 256
        pos_y = (y - Y_MIN) * 256
        mosaic.paste(img, (pos_x, pos_y))

    # Exact Nordic bounding box in Mercator
    x_merc_min, y_merc_min = lat_lon_to_mercator(LAT_MIN, LON_MIN)
    x_merc_max, y_merc_max = lat_lon_to_mercator(LAT_MAX, LON_MAX)

    tf_x_min, tf_y_max = mercator_to_tile_fraction(x_merc_min, y_merc_min, ZOOM)
    tf_x_max, tf_y_min = mercator_to_tile_fraction(x_merc_max, y_merc_max, ZOOM)

    pixel_crop_x0 = int(round((tf_x_min - X_MIN) * 256.0))
    pixel_crop_x1 = int(round((tf_x_max - X_MIN) * 256.0))
    pixel_crop_y0 = int(round((tf_y_min - Y_MIN) * 256.0))
    pixel_crop_y1 = int(round((tf_y_max - Y_MIN) * 256.0))

    print(f"[plate] Cropping exact Nordic bounds: [{pixel_crop_x0}, {pixel_crop_y0}] to [{pixel_crop_x1}, {pixel_crop_y1}]...")
    cropped = mosaic.crop((pixel_crop_x0, pixel_crop_y0, pixel_crop_x1, pixel_crop_y1))

    print("[plate] Decoding raw Terrarium tiles directly into float32 elevation meters...")
    crop_rgb = np.array(cropped, dtype=np.float32)
    # Decode Terrarium elevation: (R * 256 + G + B / 256) - 32768
    crop_elev = (crop_rgb[:, :, 0] * 256.0 + crop_rgb[:, :, 1] + crop_rgb[:, :, 2] / 256.0) - 32768.0

    print(f"[plate] Resampling float32 elevation directly to {PLATE_WIDTH}x{PLATE_HEIGHT} via bilinear filtering...")
    elev_img = Image.fromarray(crop_elev, mode="F")
    elev_resized = np.array(elev_img.resize((PLATE_WIDTH, PLATE_HEIGHT), Image.Resampling.BILINEAR))

    # Rasterize vector coastline and lakes to Signed Distance Field
    sdf, signed_dist = rasterize_vector_land_and_lakes(x_merc_min, y_merc_min, x_merc_max, y_merc_max)

    # Flatten open sea: where signed distance is into open water (< -1.0 pixel) and elevation is near sea level (< 10.0m).
    # This preserves inland lake elevations (Lake Vänern +44m, Lake Vättern +88m) without false shoreline cliffs.
    print("[plate] Flattening open sea elevation to exact 0.0m (preserving inland lakes)...")
    is_open_sea = (signed_dist < -1.0) & (elev_resized < 10.0)
    elev_resized[is_open_sea] = 0.0

    # Ensure caisson lights have 0m elevation and water mask
    for c in CAISSON_LIGHTS:
        cx, cy = lat_lon_to_mercator(c["lat"], c["lon"])
        cu = int((cx - x_merc_min) / (x_merc_max - x_merc_min) * PLATE_WIDTH)
        cv = int((1.0 - (cy - y_merc_min) / (y_merc_max - y_merc_min)) * PLATE_HEIGHT)
        r = 4
        v_min, v_max = max(0, cv - r), min(PLATE_HEIGHT, cv + r + 1)
        u_min, u_max = max(0, cu - r), min(PLATE_WIDTH, cu + r + 1)
        sdf[v_min:v_max, u_min:u_max] = 0
        elev_resized[v_min:v_max, u_min:u_max] = 0.0

    print("[plate] Computing terrain ambient occlusion...")
    chan_a = compute_ambient_occlusion(elev_resized, sample_radius=5)

    # Pack 16-bit elevation into Channels R and G
    elev_clamped = np.clip(np.maximum(elev_resized, 0.0), 0.0, MAX_ELEV_M)
    scaled_16 = (elev_clamped / MAX_ELEV_M * 65535.0).astype(np.uint16)

    chan_r = (scaled_16 // 256).astype(np.uint8)
    chan_g = (scaled_16 % 256).astype(np.uint8)
    chan_b = sdf

    plate_arr = np.stack([chan_r, chan_g, chan_b, chan_a], axis=-1)
    plate_img = Image.fromarray(plate_arr, mode="RGBA")

    print(f"[plate] Saving {OUTPUT_PATH}...")
    plate_img.save(OUTPUT_PATH, format="PNG", optimize=True)
    file_size_mb = os.path.getsize(OUTPUT_PATH) / (1024 * 1024)
    print(f"[plate] Success! Master Nordic plate generated: {PLATE_WIDTH}x{PLATE_HEIGHT} ({file_size_mb:.2f} MB)")

if __name__ == "__main__":
    build_plate()
