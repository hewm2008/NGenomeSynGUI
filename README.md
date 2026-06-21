# NGenomeSyn Web Interface

A cross-platform web interface for [NGenomeSyn](https://github.com/hewm2008/NGenomeSyn) — a Perl-based genome synteny visualization tool. Configure genome layout via structured parameter panels, drag/rotate/zoom on an interactive canvas, and generate SVG figures with one click.

## Project Structure

```
NGenomeSynGUI/
├── README.md               # This file
├── README_Chinese.md        # Chinese documentation
├── requirements.txt        # Python dependencies
├── start.sh                # Linux/macOS launcher
├── start.bat               # Windows launcher
├── web/                    # Flask web application
│   ├── app.py              # Backend (Flask)
│   └── static/             # Frontend files
└── NGenomeSyn-1.43/        # NGenomeSyn core
    ├── bin/NGenomeSyn       # Perl executable
    ├── Example/             # Example configs & RealData
    └── README.md
```

## Requirements

- Python 3.6+
- Flask + Flask-CORS
- Perl (NGenomeSyn at `NGenomeSyn-1.43/bin/NGenomeSyn`)

## Quick Start

```bash
cd NGenomeSynGUI/
pip install flask flask-cors
bash start.sh
# Open http://127.0.0.1:1688
```

Custom port: `bash start.sh 8080`

## Multi-User Support

Flask dev server runs with `threaded=True`, handling 2-5 concurrent users. For higher concurrency, install gunicorn (auto-detected by start.sh):

```bash
pip install gunicorn
bash start.sh  # automatically uses gunicorn -w 4
```

## Usage

### 1. Set Genome Count

Enter N (≥2) in the top bar and click **Apply**.

### 2. Configure Genomes

Each genome has the following parameters:

| Section | Parameters | Description |
|---------|-----------|-------------|
| Basic | File (.len) | Upload genome length file |
| | Name | Display name |
| | Color | 16 presets + native color picker |
| | Size (ChrWidth) | Chromosome bar width |
| | Opacity | Transparency |
| | Rotation | Rotation angle (degrees) |
| **▼ Move** | ShiftX / ShiftY | Canvas offset |
| **▼ Labels** | GenomeNameSizeRatio / Color / ShiftX/Y | Genome name style |
| | ChrNameShow / ShiftX/Y / Ratio / Color / Rotate | Chromosome name style |
| **▼ Scales** | ShowCoordinates / ScaleNum / ScaleUnit / ScaleUpDown / LabelUnit / Precision | Coordinate ruler |
| **▼ Region** | SpeRegionFile | Special region file (.bed) |
| | ZoomRegion | Zoom region (e.g. `chrI:1-1000`) |
| **▼ Others** | ZoomChr | Chromosome zoom ratio |
| | LinkWidth | Link line width |
| | NormScale | Normalized scale (checkbox) |

### 3. Add Links

Select Genome A → B pair, upload `.link` file. Multiple links per pair supported.

Each link has **▼ More** settings: StyleUpDown, Reverse, HeightRatio, fill/stroke colors, stroke-width, fill-opacity, stroke-opacity.

### 4. Global Parameters

| Parameter | Description |
|-----------|-------------|
| Chr Width | Global chromosome width |
| Chr Spacing | Chromosome spacing |
| **▼ Theme** | Main (legend title), MainRatioFontSize, MainColor, ShiftMainX/Y |
| **▼ Canvas** | body/up/down/left/right margins, CanvasHeightRitao, CanvasWidthRitao |

### 5. Canvas Interaction

| Action | Effect |
|--------|--------|
| **Left drag** genome | Move position |
| **Left click** genome | Select (highlight + sidebar sync) |
| **Right-click menu** | Name → rename/recolor; Chromosome → info/color/size/rotation; Track → full menu (name/color/size/opacity/rotation/reset) |
| **Scroll wheel** | Zoom canvas |
| **Drag empty area** | Pan view |
| **Fit** | Auto center |
| **Reset** | Restore default view |

### 6. Run

Click **▶ Run NGenomeSyn** to generate config and execute the Perl backend. On success, the SVG result is displayed inline.

- **Download SVG** — Save the result figure
- **Download Config** — Save the generated `.conf` file
- **Result zoom** — Scroll wheel to zoom result SVG (0.1x–10x), centered on cursor; double-click to reset

### 7. Demo

Click **📦 Demo** to load Example1 (yeast genome comparison).

## Design Architecture

### Data Flow

```
User Interface → STATE object → generate_conf_from_params()
→ .conf text → Perl NGenomeSyn → SVG file → Frontend display
```

### Frontend (Vanilla JS)

| Module | Description |
|--------|-------------|
| **STATE** | Single global state (genomes, links, canvas, result) |
| **renderGenomes()** | Renders genome parameter panels with 5 collapsible sections |
| **renderLinks()** | Renders link parameter panels |
| **setupCanvas()** | Canvas event bindings (mousedown/move/up/wheel/contextmenu) |
| **renderCanvas()** | Draws genome tracks, chromosomes, links, labels; HiDPI (DPR) aware |
| **getGenomeAt(x,y)** | Hit detection with expanded zones (track ±8/24px, chr ±4/12px) |
| **runNGenomeSyn()** | POST /api/run, sends params or conf_text, receives SVG |

Key canvas features:
- `<canvas>` 2D API with `ctx.scale(dpr, dpr)` for HiDPI displays
- Bezier curves for link arcs (`quadraticCurveTo`)
- 3px threshold separates click from drag
- Right-click context menu dynamically generated based on hit part
- Resizable splitter between canvas and run result (default 4.5:5.5)

### Backend (Flask)

| Module | Description |
|--------|-------------|
| **generate_conf_from_params()** | Converts structured params to .conf text, handles path resolution and color quoting |
| **parse_conf_text()** | Reverse-parse .conf to structured data (for Demo) |
| **resolve_path()** | Multi-level path resolution: session dir → Example → RealData |
| **run_ngenomesyn()** | Calls Perl NGenomeSyn, checks SVG existence (exit code 1 is also "success") |

#### API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/examples` | List 6 built-in examples |
| GET | `/api/example/<name>/<conf>` | Load example config |
| POST | `/api/upload` | Upload files (session-isolated) |
| GET | `/api/files` | List session files |
| GET | `/api/len/<path>` | Parse .len file |
| POST | `/api/run` | Execute NGenomeSyn, return SVG |
| GET | `/api/result/<name>` | Get result SVG |
| POST | `/api/download-conf` | Download .conf |
| POST | `/api/session/clear` | Clear session |
| POST | `/api/session/cleanup` | Clean all sessions |

### Key Technical Decisions

| Issue | Solution |
|-------|----------|
| NGenomeSyn exits with code 1 on success | Check SVG exists + size > 0, ignore returncode |
| `#hex` color truncated by conf parser | Quote colors: `fill="#e74c3c"` |
| HiDPI click offset | `ctx.scale(dpr, dpr)` aligns physical and CSS pixels |
| Drag delta vs Perl absolute position | Emit `ShiftX/ShiftY` (delta) instead of `MoveToX/Y` (absolute) |
| Color picker destroyed by re-render | Incremental `updateColorUI()` instead of full rebuild |
| NormScale checkbox not clickable | Skip `input/select/button` targets in slot click handler |
| ChrWidth/ChrSpacing not in SVG | Write per-genome (not global), propagate sliders to all genomes |
| Result SVG zoom | Mouse wheel (0.1x–10x) with cursor-centered zoom; double-click reset |

## Dependencies

- Python 3.6+ · Flask · Flask-CORS
- Perl · NGenomeSyn (`NGenomeSyn-1.43/bin/NGenomeSyn`)

## Known Issues

- NGenomeSyn Perl exits with code 1 on success (source line 3064) — does not affect output
- `#` in `.conf` is treated as comment; all hex colors must be quoted: `fill="#ff0000"`
- Each browser tab uses an independent session (files isolated by session ID)
- Session files are stored in `web/static/uploads/<sid>/`; refreshing creates a new session

## FAQ

**Q: Uploaded files not found?**
A: Files are stored per session in `web/static/uploads/<sid>/`. Refreshing the page creates a new session ID.

**Q: "NGenomeSyn execution failed" error?**
A: Verify Perl and `NGenomeSyn-1.43/bin/NGenomeSyn` exist and are executable. Check stderr output for details.

## Author

- **hewm2008**
- 📧 hewm2008@gmail.com / hewm2008@qq.com
- 💬 QQ Group: **125293663**
- GitHub: https://github.com/hewm2008/NGenomeSyn
