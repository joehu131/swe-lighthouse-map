# Svenska Fyrar · Swedish Lighthouse Map

An interactive, real-time WebGPU visualization of Sweden's coastal and navigational lighthouses, sweeping light beams, and nautical sectors.

<p align="center">
  <img src="public/preview.png" alt="Svenska Fyrar · Swedish Lighthouse Map" width="680" style="max-width: 100%; border-radius: 8px;">
</p>

## System Architecture

```
                         DATA PIPELINE
                     
 ┌──────────────────────┐        ┌─────────────────────────┐
 │ OpenStreetMap        │        │ Copernicus DEM          │
 │ Seamark light data   │        │ Elevation tiles         │
 └──────────┬───────────┘        └────────────┬────────────┘
            │                                 │
            ▼                                 ▼
 ┌──────────────────────┐        ┌─────────────────────────┐
 │ parse_iala.js        │        │ build_plate.py          │
 │ - Flash rhythms      │        │ - Hillshade terrain     │
 │ - Sector angles      │        │ - Coastline water mask  │
 └──────────┬───────────┘        └────────────┬────────────┘
            │                                 │
            ▼                                 │
 ┌──────────────────────┐                     │
 │ generate_manifest.js │                     │
 │ - Coordinate checks  │                     │
 │ - Sector buffers     │                     │
 └──────────┬───────────┘                     │
            │                                 │
            ▼                                 ▼
       manifest.json                      plate.png
     (1,963 lights)                   (Terrain texture)
            │                                 │
            └────────────────┬────────────────┘
                             │
                             ▼
                    WEB APPLICATION
                     
                       index.html
             ┌───────────────────────────────┐
             │ WebGPU Renderer               │
             │ ├─ Rotating beams & sectors   │
             │ ├─ Terrain relief shading     │
             │ ├─ Compass rose diagram       │
             │ ├─ Solo light mode            │
             │ ├─ Warmth & brightness panel  │
             │ ├─ Beacon click / search      │
             │ └─ Language toggle (ENG / SWE)│
             └───────────────────────────────┘
```

---

## Maritime Dataset Coverage

The map covers the Swedish coast, archipelagos, and major inland lakes (Vänern, Vättern, and Mälaren), spanning from **55.3°N to 66.0°N**:

- **Total Lights**: 1,963 mapped and validated lights.
- **Sector Fairway Lights**: 736 lights with colored red, green, and white navigational sectors.
- **Major Coastal Lights**: 204 revolving coastal beacons.
- **Harbour & Leading Lights**: 1,023 channel entrance and alignment markers.

---

## Key Features

- **WebGPU Rendering**: Renders rotating light beams, flashing rhythms, and navigation sectors over shaded terrain.
- **Nautical Sector Diagrams**: Shows exact red, green, and white navigation arcs on an interactive compass rose.
- **Official IALA Characters**: Accurate light timing and patterns parsed from maritime data (e.g. `Fl(2) WRG 6s`, `Iso W 4s`).
- **Solo Mode**: Isolate any single lighthouse to clearly inspect its beam reach and sectors.
- **Light Adjustments**: Sliders to adjust color warmth, brightness, beam distance, and background lighting.
- **Bilingual**: Toggle between English and Swedish, keeping authentic Swedish lighthouse names.
- **Fast Search & Click**: Click any lighthouse on the map or search by name to inspect details.

---

## Lighthouse Categories

| Category | Typical Character | Description & Included Lights |
| :--- | :--- | :--- |
| **Coastal Lights** *(Kustfyrar)* | Revolving white beam (`Fl`, `LFl`) | Long-range landfall and coastal lights (Vinga, Långe Jan, Kullen, Pater Noster, Hoburg, Måseskär). |
| **Sector Lights** *(Ledfyrar)* | Multi-color arcs (`WRG`) | Channel navigation lights dividing the sea into safe white fairways flanked by red and green warning sectors. |
| **Leading Lights** *(Ensfyrar)* | Fixed or synchronized (`Iso`, `Oc`) | Paired lights (upper and lower) guiding vessels through narrow dredged channels. |
| **Harbour Lights** *(Hamnfyrar)* | Port/Starboard markers (`Q`, `Fl R/G`) | Breakwater and pierhead lights marking harbour entrances and marina approaches. |
| **Caisson Lights** *(Kassunfyrar)* | Open-sea concrete towers (`LFl`, `Fl(3)`) | Offshore towers anchored on submerged shoals (Almagrundet, Revengegrundet, Sydostbrotten). |

---

## Project Structure

```
swe-lighthouse-map/
├── index.html                 # Main HTML entry point
├── .github/workflows/
│   └── deploy.yml             # GitHub Actions automated Pages deployment
├── public/
│   └── data/                  # Precomputed terrain plate and lighthouse manifest
├── pipeline/                  # Data extraction and plate generation scripts
│   ├── extract_lighthouses.js # Fetches lights from OpenStreetMap
│   ├── parse_iala.js          # Parses light rhythms and sector arcs
│   ├── build_plate.py         # Generates terrain elevation texture
│   └── generate_manifest.js   # Combines data into manifest.json
├── src/
│   ├── main.ts                # App initialization and event handling
│   ├── components/            # UI components (Header, Controls, Inspector, Settings)
│   ├── lib/                   # WebGPU renderer, camera, spatial index, i18n
│   └── shaders/               # WGSL shaders for beams, sectors, and terrain
└── tests/                     # Unit tests (parsers, shaders, projections, data)
```

---

## Running Locally

### Prerequisites

- [Node.js](https://nodejs.org/) (version 18 or higher)
- A browser with WebGPU support:
  - Google Chrome / Chromium 113+
  - Microsoft Edge 113+
  - Safari 18+ (macOS Sonoma / iOS 17+)
  - Firefox Nightly (with `dom.webgpu.enabled` set to `true`)

### Installation & Setup

1. Clone the repository:
   ```bash
   git clone git@github.com:joehu131/swe-lighthouse-map.git
   cd swe-lighthouse-map
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Start the local development server:
   ```bash
   npm run dev
   ```

4. Open `http://localhost:5173/` in your browser.

---

## Running Automated Tests

Run the test suite with Vitest:

```bash
npm run test
```

This verifies:
- IALA character parsing and sector angle extraction.
- Web Mercator projection and camera math.
- WGSL shader syntax and struct layouts.
- Beacon coordinate bounds and sector integrity.
- English and Swedish translation parity.

---

## Building for Production

Compile TypeScript and bundle assets:

```bash
npm run build
```

The output bundle is written to `dist/`. You can preview it locally:

```bash
npm run preview
```

---

## Data Pipeline & Rebuilding

To rebuild or refresh the data from raw sources:

```bash
npm run pipeline:all
```

This runs three steps in sequence:
1. **Extract Seamarks** (`pipeline/extract_lighthouses.js` & `pipeline/parse_iala.js`): Fetches light data from OpenStreetMap.
2. **Build Terrain Plate** (`pipeline/build_plate.py`): Generates the 4096×6144 elevation and water plate from Copernicus DEM.
3. **Compile Manifest** (`pipeline/generate_manifest.js`): Validates coordinates and exports `public/data/manifest.json`.

---

## License

This project is licensed under the [GNU General Public License v3.0](LICENSE).
