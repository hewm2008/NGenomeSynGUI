# AGENTS.md — NGenomeSyn Web Interface Session

## Overview
Built a cross-platform Web interactive interface for NGenomeSyn (Perl genome synteny visualization tool) with file upload, interactive genome layout canvas, config editor, and SVG result display.

## Tech Stack
- Python Flask backend (port 1688)
- Vanilla JS frontend (no framework)
- Dark theme CSS

## Project Structure
```
NGenomeSynGUI/
├── README.md / README_Chinese.md  # Project documentation
├── requirements.txt               # Python dependencies
├── start.sh                       # Linux/macOS launcher
├── start.bat                      # Windows launcher
├── NGenomeSyn-1.43/               # NGenomeSyn core (Perl + examples)
│   ├── bin/NGenomeSyn
│   ├── Example/
│   ├── README.md / README_Chinese.md
│   └── AGENTS.md                  # This file
└── web/                           # Flask web interface
    ├── app.py                     # Flask backend (~740 lines)
    └── static/
        ├── index.html             # Single-page UI (~114 lines)
        ├── style.css              # Dark theme (~465 lines)
        └── script.js              # Frontend logic (~1210 lines)
```

## Key Backend Endpoints
| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/examples` | List 6 built-in examples |
| GET | `/api/example/<name>/<conf>` | Load example config with path resolution |
| POST | `/api/upload` | Upload files (len/link/conf) |
| GET | `/api/files` | List session files |
| GET | `/api/len/<path>` | Parse .len file, return chromosome data |
| POST | `/api/run` | Accept `conf_text` (legacy) or `params` (structured) → generate conf → run Perl → return SVG |
| GET | `/api/result/<name>` | Serve result SVG files |

## Key Backend Functions
- `parse_conf_text()` — parse .conf into structured sections
- `generate_conf_from_params()` — convert structured params to .conf text
- `resolve_conf_paths_in_text()` / `resolve_path()` — resolve relative file paths to absolute
- `parse_len_file()` — parse .len genome info files
- `parse_link_file()` — parse .link files

## Frontend Architecture (script.js)
- **STATE** — single global state object with genomes, links, canvas, result
- **Genome slots** — dynamic DOM with file upload, name, color picker (16 presets + native), size/opacity/rotation sliders, **▼ More** expandable 5-category sections:
  - **Move**: ShiftX/Y, MoveToX/Y
  - **Labels**: Genome Name (NameRatio/Color/ShiftX/Y) + Chromosome Name (ChrNameShow/ShiftX/Y/Ratio/Color/Rotate)
  - **Scales**: ShowCoord, ScaleNum, ScaleUnit, ScaleUpDown, LabelUnit, Precision
  - **Region**: SpeRegionFile (file upload), ZoomRegion (text)
  - **Others**: ZoomChr (slider), LinkWidth (num), NormScale (checkbox)
- **Link slots** — dynamic DOM with genome A/B selectors + file upload, "+" to add, **▼ More** with:
  - StyleUpDown, Reverse, HeightRatio, fill, stroke, stroke-width, fill-opacity, stroke-opacity
- **Global Params** — ChrWidth, ChrSpacing + **▼ Theme** (Main, MainRatioFontSize, MainColor, ShiftMainX/Y) + **▼ Canvas** (body, up/down/left/right, CanvasHeightRitao, CanvasWidthRitao)
- **Canvas** — genome track rendering with:
  - Per-genome: position (drag), rotation, color, opacity, chrWidth
  - Per-chromosome: name labels, color
  - Link arcs between genomes
  - Pan/zoom (wheel), select (click), context menu (right-click)
  - **Hover cursor** — `pointer` on genome, `grab` elsewhere
  - **Expanded hit areas** — track ±8/24px, chr bar ±4/12px for easier clicking
- **Hit detection** — `getGenomeAt()` returns `{genome, part: 'name'|'chromosome'|'track', chrIdx}`
- **Context menu** — dynamically generated based on clicked part (name/chromosome/track)
- **Sidebar click** — clicking a genome slot in sidebar also selects it on canvas
- **Resizable splitter** — resizer handle between canvas and run section (default 4.5:5.5 ratio)
- **Dev badge** — `hewm2008` clickable badge in header, shows contact panel (email + QQ group)
- **Result zoom** — mouse wheel to zoom result SVG (0.1x–10x), centered on cursor; double-click to reset

## Key Fixes
1. **NGenomeSyn Perl script exits with 1 on success** (line 3064): Backend checks SVG exists + size > 0 instead of returncode. Passes `-NoPng` by default.
2. **Color picker destroys native popup**: `updateColorUI()` does targeted DOM updates instead of full `renderGenomes()` rebuild.
3. **Canvas click/drag separation**: Mouse movement tolerance (3px) distinguishes click vs drag; selection handled in `cmUp`, not via separate `click` listener.
4. **Color/Name not reflected in SVG**: `fill=#hex` value gets truncated at `#` (conf parser treats `#` as comment). Fix: emit `fill="#hex"` (quoted). `GenomeName1` should be `GenomeName` (no number suffix).
5. **Canvas state out of sync**: Property-change handlers now also update `STATE.canvasGenomes` so `renderCanvas()` reads fresh values.
6. **GenomeNameColor/ChrNameColor black in SVG**: Same `#` truncation issue. Fix: emit `GenomeNameColor="#hex"`, `ChrNameColor="#hex"`.
7. **MainCor not working**: Perl parameter is `MainColor`, not `MainCor`. Fix: corrected key name and added quotes for hex values.
8. **CanvasHeightRitao/CanvasWidthRitao slider display stuck at 1**: `updateGlobalParam()` missing span textContent updates. Fix: added `$('gl-chr-val')` / `$('gl-cwr-val')` / `$('gl-mrfs-val')` updates.
9. **Canvas hit area offset (DPR)**: Canvas buffer set to `rect.width * dpr`, but drawing used CSS pixel coords without `ctx.scale(dpr, dpr)`. On HiDPI displays (dpr>1), mouse hit area appeared below/right of visual graphics. Fix: added `ctx.scale(CANV.dpr, CANV.dpr)` in `renderCanvas()` and clear full physical buffer.
10. **SVG drag direction inverted**: Perl treats `MoveToY` as absolute position (`ShiftMainY += MoveToY - MainYY1`), so small `moveY` (delta) caused negative shift and upward movement. Fix: merge `moveX/moveY` + `shiftX/shiftY` into `ShiftX/ShiftY` (pure delta per `$ShiftMainY = ShiftY`).
11. **Others params (zoomChr/linkWidth/normalizedScale) not passed to backend**: Missing from `runNGenomeSyn()` params and `downloadConf()`. Fix: added to both.
12. **NormScale checkbox can't be clicked**: Genome-slot click handler (`renderGenomes()`) rebuilt DOM on every click, resetting checkbox state. Fix: skip `input/select/button` targets via `e.target.closest()`.
13. **ChrWidth/ChrSpacing not reflected in SVG**: Perl reads both from per-genome section (`Genome1`/`Genome2`), but `ChrSpacing` was written only in global section (unused), and `ChrWidth` global slider didn't propagate to per-genome `chrWidth`. Fix: `generate_conf_from_params()` skips both in global loop, writes `ChrSpacing` per-genome; `updateGlobalParam()` propagates `chrWidth`/`chrSpacing` to all genomes + canvasGenomes.

## Port
- Default: **1688**
- Configurable via CLI arg: `python3 app.py <port>`

## Start
```bash
cd NGenomeSynGUI && bash start.sh
# Open http://127.0.0.1:1688
```

## Dependencies
```bash
cd NGenomeSynGUI && pip install flask flask-cors
# Perl + NGenomeSyn (pre-installed at NGenomeSyn-1.43/bin/NGenomeSyn)
```

## Important Paths
- NGenomeSyn executable: `NGenomeSyn-1.43/bin/NGenomeSyn`
- RealData directory: `NGenomeSyn-1.43/Example/RealData/`
- Example configs: `NGenomeSyn-1.43/Example/example*/`
