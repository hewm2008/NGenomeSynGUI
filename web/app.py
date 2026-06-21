#!/usr/bin/env python3
"""NGenomeSyn Web Interface - Flask Backend"""

import os
import re
import json
import uuid
import shutil
import subprocess
from pathlib import Path
from flask import Flask, request, jsonify, send_file, session, url_for
from flask_cors import CORS

app = Flask(__name__, static_folder='static')
app.secret_key = 'ngeneomesyn-web-secret-key'
CORS(app)

BASE_DIR = Path(__file__).parent.resolve()
STATIC_DIR = BASE_DIR / 'static'
UPLOAD_DIR = STATIC_DIR / 'uploads'
RESULT_DIR = STATIC_DIR / 'results'
PROJECT_DIR = BASE_DIR.parent / 'NGenomeSyn-1.43'
BIN_DIR = PROJECT_DIR / 'bin'
EXAMPLE_DIR = PROJECT_DIR / 'Example'
REALDATA_DIR = EXAMPLE_DIR / 'RealData'
NGENOMESYN = BIN_DIR / 'NGenomeSyn'

UPLOAD_DIR.mkdir(parents=True, exist_ok=True)
RESULT_DIR.mkdir(parents=True, exist_ok=True)

app.config['MAX_CONTENT_LENGTH'] = 50 * 1024 * 1024  # 50MB

SESSION_CONFIG = {}

def get_session_id():
    sid = session.get('sid')
    if not sid:
        sid = str(uuid.uuid4())[:8]
        session['sid'] = sid
    return sid

def session_dir():
    d = UPLOAD_DIR / get_session_id()
    d.mkdir(parents=True, exist_ok=True)
    return d

def result_file_path(name):
    return RESULT_DIR / f"{name}.svg"

def parse_conf_text(text):
    """Parse config text into structured data."""
    sections = []
    current_section = None
    current_items = []
    genomes = {}
    links = {}
    global_params = {}

    for line in text.splitlines():
        line = line.strip()
        if not line or line.startswith('#'):
            continue
        line = re.sub(r'"[^"]*"', lambda m: m.group(0).replace('#', '\x00'), line)
        if '##' in line:
            line = line.split('##')[0].strip()
        if '#' in line:
            line = line.split('#')[0].strip()
        line = line.replace('\x00', '#')
        if line.startswith('SetParaFor'):
            if current_section is not None:
                sections.append({
                    'section': current_section,
                    'params': current_items
                })
            m = re.match(r'SetParaFor\s*=\s*(\S+)', line)
            if m:
                current_section = m.group(1)
                current_items = []
        elif '=' in line and current_section:
            k, v = line.split('=', 1)
            k = k.strip()
            v = v.strip()
            current_items.append({'key': k, 'value': v})

            section_key = current_section.lower()
            if current_section == 'global':
                global_params[k] = v
            elif current_section.startswith('Genome') or re.match(r'^\d+$', current_section):
                gid = current_section.replace('Genome', '') if current_section != 'GenomeALL' else 'ALL'
                if gid not in genomes:
                    genomes[gid] = {}
                genomes[gid][k] = v
            elif current_section.startswith('Link') or current_section == 'LinkALL':
                lid = current_section.replace('Link', '') if current_section != 'LinkALL' else 'ALL'
                if lid not in links:
                    links[lid] = {}
                links[lid][k] = v

    if current_section is not None:
        sections.append({
            'section': current_section,
            'params': current_items
        })

    genome_count = 0
    for key in global_params:
        m = re.match(r'GenomeInfoFile(\d+)', key)
        if m:
            n = int(m.group(1))
            if n > genome_count:
                genome_count = n
    for key in global_params:
        m = re.match(r'LinkFileRef(\d+)VsRef(\d+)', key)
        if m:
            pass

    return {
        'sections': sections,
        'global': global_params,
        'genomes': genomes,
        'links': links,
        'genome_count': genome_count
    }

def generate_conf_text(genomes, links, global_params):
    lines = []
    lines.append('##################################### global parameters #######################################')
    lines.append('')
    lines.append('SetParaFor = global')
    lines.append('')

    gfiles = {}
    for k, v in global_params.items():
        if k.startswith('GenomeInfoFile'):
            m = re.match(r'GenomeInfoFile(\d+)', k)
            if m:
                gfiles[int(m.group(1))] = (k, v)
        elif k.startswith('LinkFileRef'):
            pass
        else:
            lines.append(f'{k}={v}')
    lines.append('')

    for gid in sorted(gfiles.keys()):
        k, v = gfiles[gid]
        lines.append(f'{k}={v}')
    lines.append('')

    for k, v in global_params.items():
        if k.startswith('LinkFileRef'):
            lines.append(f'{k}={v}')
    lines.append('')

    for gid in sorted(genomes.keys()):
        if gid == 'ALL':
            lines.append('SetParaFor = GenomeALL')
        else:
            lines.append(f'SetParaFor = Genome{gid}')
        for k, v in genomes[gid].items():
            lines.append(f'{k}={v}')
        lines.append('')

    for lid in sorted(links.keys()):
        if lid == 'ALL':
            lines.append('SetParaFor = LinkALL')
        else:
            lines.append(f'SetParaFor = Link{lid}')
        for k, v in links[lid].items():
            lines.append(f'{k}={v}')
        lines.append('')

    return '\n'.join(lines)

def parse_len_file(filepath):
    """Parse .len genome info file."""
    chromosomes = []
    with open(filepath) as f:
        for line in f:
            if line.startswith('#') or not line.strip():
                continue
            parts = line.strip().split()
            if len(parts) >= 3:
                chromosomes.append({
                    'name': parts[0],
                    'start': int(parts[1]),
                    'end': int(parts[2]),
                    'length': abs(int(parts[2]) - int(parts[1])) + 1,
                    'attrs': parts[3:] if len(parts) > 3 else []
                })
    return chromosomes

def parse_link_file(filepath, max_lines=5000):
    """Parse .link file, return first N lines for preview."""
    links = []
    with open(filepath) as f:
        for i, line in enumerate(f):
            if i >= max_lines:
                break
            if line.startswith('#') or not line.strip():
                continue
            parts = line.strip().split()
            if len(parts) >= 6:
                links.append({
                    'chrA': parts[0], 'startA': int(parts[1]), 'endA': int(parts[2]),
                    'chrB': parts[3], 'startB': int(parts[4]), 'endB': int(parts[5]),
                    'attrs': parts[6:] if len(parts) > 6 else []
                })
    return links

def get_example_dirs():
    """Discover available example directories."""
    examples = []
    for d in sorted(EXAMPLE_DIR.iterdir()):
        if d.is_dir() and d.name.startswith('example'):
            confs = list(d.glob('*.conf')) + list(d.glob('*.cofi'))
            if confs:
                examples.append({
                    'name': d.name,
                    'path': str(d),
                    'confs': [c.name for c in confs]
                })
    return examples

def copy_example_to_session(example_name, conf_name):
    sdir = session_dir()
    ex_path = EXAMPLE_DIR / example_name
    conf_path = ex_path / conf_name
    if not conf_path.exists():
        return None

    shutil.copytree(ex_path, sdir, dirs_exist_ok=True)

    realdata_link = REALDATA_DIR
    s_reald = sdir / 'RealData'
    if not s_reald.exists() and realdata_link.exists():
        try:
            os.symlink(str(realdata_link), str(s_reald))
        except:
            shutil.copytree(str(realdata_link), str(s_reald), dirs_exist_ok=True)

    conf_text = conf_path.read_text()
    parsed = parse_conf_text(conf_text)

    resolved = resolve_conf_paths(parsed, sdir)
    return {'conf_text': conf_text, 'parsed': resolved}

def resolve_conf_paths(parsed, sdir):
    """Resolve relative paths in config to absolute paths."""
    p = dict(parsed)
    gp = dict(p['global'])
    for k, v in list(gp.items()):
        if k.startswith('GenomeInfoFile') or k.startswith('LinkFileRef'):
            resolved = resolve_path(v, sdir)
            if resolved:
                gp[k] = {'path': resolved, 'exists': os.path.exists(resolved)}
            else:
                gp[k] = {'path': v, 'exists': os.path.exists(v)}
    p['global'] = gp
    return p

def resolve_conf_paths_in_text(conf_text, sdir):
    """Resolve relative file paths to absolute paths in config text."""
    lines = conf_text.splitlines()
    result = []
    for line in lines:
        stripped = line.strip()
        if '=' in stripped and not stripped.startswith('SetParaFor') and not stripped.startswith('#'):
            k, v = stripped.split('=', 1)
            k = k.strip()
            v = v.strip()
            if k.startswith('GenomeInfoFile') or k.startswith('LinkFileRef'):
                v_clean = v.split('#')[0].split('##')[0].strip()
                resolved = resolve_path(v_clean, sdir)
                if resolved:
                    result.append(f'{k}={resolved}')
                    continue
        result.append(line)
    return '\n'.join(result)

def resolve_path(rel_path, sdir):
    if os.path.isabs(rel_path):
        return os.path.realpath(rel_path)
    candidates = [
        sdir / rel_path,
        sdir / '..' / rel_path,
        sdir.parent / rel_path,
        PROJECT_DIR / rel_path,
    ]
    for ex in EXAMPLE_DIR.iterdir():
        if ex.is_dir():
            candidates.append(ex / rel_path)
    candidates.extend([
        EXAMPLE_DIR / rel_path,
        REALDATA_DIR / rel_path,
    ])
    for c in candidates:
        resolved = os.path.realpath(str(c))
        if os.path.exists(resolved):
            return resolved
    return os.path.realpath(str(sdir / rel_path))

@app.route('/')
def index():
    return app.send_static_file('index.html')

@app.route('/api/examples')
def list_examples():
    return jsonify(get_example_dirs())

@app.route('/api/example/<name>/<conf>')
def load_example(name, conf):
    sid = get_session_id()
    result = copy_example_to_session(name, conf)
    if result is None:
        return jsonify({'error': 'Example not found'}), 404
    return jsonify(result)

@app.route('/api/upload', methods=['POST'])
def upload_files():
    sid = get_session_id()
    sdir = session_dir()
    uploaded = []
    for fname in request.files:
        f = request.files[fname]
        if f and f.filename:
            dst = sdir / f.filename
            f.save(str(dst))
            uploaded.append({
                'name': f.filename,
                'size': dst.stat().st_size,
                'exists': True
            })
    return jsonify({'files': uploaded, 'session': sid})

@app.route('/api/files')
def list_files():
    sdir = session_dir()
    files = []
    for f in sorted(sdir.iterdir()):
        if f.is_file() and not f.name.startswith('.'):
            ftype = 'unknown'
            if f.suffix in ('.len', '.txt', '.info'):
                ftype = 'genome'
            elif f.suffix == '.link':
                ftype = 'link'
            elif f.suffix == '.conf':
                ftype = 'config'
            elif f.suffix == '.bed':
                ftype = 'region'
            elif f.suffix == '.gff':
                ftype = 'gff'
            files.append({
                'name': f.name,
                'size': f.stat().st_size,
                'type': ftype
            })
    return jsonify(files)

@app.route('/api/file/<name>')
def get_file_content(name):
    sdir = session_dir()
    fpath = sdir / name
    if not fpath.exists():
        return jsonify({'error': 'File not found'}), 404
    try:
        text = fpath.read_text()
    except:
        return jsonify({'error': 'Cannot read file (binary?)'}), 400
    return jsonify({'name': name, 'content': text})

@app.route('/api/file/<name>/preview')
def get_file_preview(name):
    sdir = session_dir()
    fpath = sdir / name
    if not fpath.exists():
        return jsonify({'error': 'File not found'}), 404
    try:
        text = fpath.read_text()
    except:
        return jsonify({'error': 'Cannot read file'}), 400
    lines = text.splitlines()
    preview_lines = lines[:200]
    return jsonify({
        'name': name,
        'preview': preview_lines,
        'total_lines': len(lines),
        'truncated': len(lines) > 200
    })

@app.route('/api/len/<path:name>')
def parse_len(name):
    sdir = session_dir()
    fpath = sdir / name
    if not fpath.exists():
        resolved = resolve_path(name, sdir)
        if resolved and os.path.exists(resolved):
            fpath = Path(resolved)
        else:
            return jsonify({'error': f'File not found: {name}', 'resolved': resolved}), 404
    chrs = parse_len_file(str(fpath))
    return jsonify({'file': name, 'chromosomes': chrs})

@app.route('/api/parse-conf', methods=['POST'])
def parse_conf():
    data = request.get_json()
    text = data.get('text', '')
    if not text:
        return jsonify({'error': 'No config text'}), 400
    parsed = parse_conf_text(text)
    sdir = session_dir()
    resolved = resolve_conf_paths(parsed, sdir)
    return jsonify(resolved)

@app.route('/api/validate-conf', methods=['POST'])
def validate_conf():
    data = request.get_json()
    text = data.get('text', '')
    if not text:
        return jsonify({'error': 'No config text'}), 400
    parsed = parse_conf_text(text)
    gp = parsed['global']
    errors = []
    warnings = []
    for k, v in gp.items():
        if k.startswith('GenomeInfoFile') or k.startswith('LinkFileRef'):
            resolved = resolve_path(v, session_dir())
            if not os.path.exists(resolved):
                errors.append(f"File not found: {k}={v} (resolved: {resolved})")

    if not any(k.startswith('GenomeInfoFile') for k in gp):
        errors.append("No GenomeInfoFile defined")
    if not any(k.startswith('LinkFileRef') for k in gp):
        warnings.append("No LinkFile defined")

    return jsonify({'valid': len(errors) == 0, 'errors': errors, 'warnings': warnings})

def generate_conf_from_params(params, sdir):
    genomes = params.get('genomes', [])
    links = params.get('links', [])
    global_params = params.get('global', {})

    lines = ['SetParaFor = global', '']

    for i, g in enumerate(genomes):
        gid = i + 1
        fpath = g['file']
        if not os.path.isabs(fpath):
            resolved = resolve_path(fpath, sdir)
            if resolved:
                fpath = resolved
        lines.append(f'GenomeInfoFile{gid}={fpath}')
    lines.append('')

    for i, l in enumerate(links):
        lid = i + 1
        ga = int(l.get('genomeA', 0)) + 1
        gb = int(l.get('genomeB', 1)) + 1
        fpath = l['file']
        if not os.path.isabs(fpath):
            resolved = resolve_path(fpath, sdir)
            if resolved:
                fpath = resolved
        lines.append(f'LinkFileRef{ga}VsRef{gb}={fpath}')
    lines.append('')

    for k, v in global_params.items():
        if not k.startswith('GenomeInfoFile') and not k.startswith('LinkFileRef') and k not in ('ChrWidth','ChrSpacing'):
            if isinstance(v, str) and v.startswith('#'):
                lines.append(f'{k}="{v}"')
            else:
                lines.append(f'{k}={v}')
    lines.append('')

    for i, g in enumerate(genomes):
        gid = i + 1
        lines.append(f'SetParaFor = Genome{gid}')
        r = g.get('rotation', 0)
        if r:
            lines.append(f'RotateChr={r}')
        sx = g.get('shiftX', 0) + g.get('moveX', 0)
        if sx:
            lines.append(f'ShiftX={sx}')
        sy = g.get('shiftY', 0) + g.get('moveY', 0)
        if sy:
            lines.append(f'ShiftY={sy}')
        c = g.get('color', '')
        if c:
            if c.startswith('#'):
                lines.append(f'fill="{c}"')
                lines.append(f'stroke="{c}"')
            else:
                lines.append(f'fill={c}')
                lines.append(f'stroke={c}')
        n = g.get('name', '')
        if n:
            lines.append(f'GenomeName={n}')
        w = g.get('chrWidth', 0)
        if w:
            lines.append(f'ChrWidth={w}')
        cs = g.get('chrSpacing', 0) or global_params.get('ChrSpacing', 0)
        if cs:
            lines.append(f'ChrSpacing={cs}')
        o = g.get('opacity', 0)
        if o and o != 1:
            lines.append(f'fill-opacity={o}')
            lines.append(f'stroke-opacity={o}')

        gnr = g.get('genomeNameSizeRatio', 0)
        if gnr and gnr != 1:
            lines.append(f'GenomeNameSizeRatio={gnr}')
        gnc = g.get('genomeNameColor', '')
        if gnc:
            if gnc.startswith('#'):
                lines.append(f'GenomeNameColor="{gnc}"')
            else:
                lines.append(f'GenomeNameColor={gnc}')
        gnx = g.get('genomeNameShiftX', 0)
        if gnx:
            lines.append(f'GenomeNameShiftX={gnx}')
        gny = g.get('genomeNameShiftY', 0)
        if gny:
            lines.append(f'GenomeNameShiftY={gny}')

        cns = g.get('chrNameShow', 0)
        if cns:
            lines.append('ChrNameShow=1')
        cnx = g.get('chrNameShiftX', 0)
        if cnx:
            lines.append(f'ChrNameShiftX={cnx}')
        cny = g.get('chrNameShiftY', 0)
        if cny:
            lines.append(f'ChrNameShiftY={cny}')
        cnr = g.get('chrNameSizeRatio', 0)
        if cnr and cnr != 1:
            lines.append(f'ChrNameSizeRatio={cnr}')
        cnc = g.get('chrNameColor', '')
        if cnc:
            if cnc.startswith('#'):
                lines.append(f'ChrNameColor="{cnc}"')
            else:
                lines.append(f'ChrNameColor={cnc}')
        cnrot = g.get('chrNameRotate', 0)
        if cnrot:
            lines.append(f'ChrNameRotate={cnrot}')

        sc = g.get('showCoordinates', 0)
        if sc:
            lines.append('ShowCoordinates=1')
        sn = g.get('scaleNum', 0)
        if sn and sn != 10:
            lines.append(f'ScaleNum={sn}')
        sud = g.get('scaleUpDown', '')
        if sud:
            lines.append(f'ScaleUpDown={sud}')
        su = g.get('scaleUnit', '')
        if su != '' and su is not None:
            lines.append(f'ScaleUnit={su}')
        lu = g.get('labelUnit', '')
        if lu:
            lines.append(f'LabelUnit={lu}')
        lp = g.get('lablePrecision', 0)
        if lp and lp != 1:
            lines.append(f'LablePrecision={lp}')

        zc = g.get('zoomChr', 0)
        if zc and zc != 1:
            lines.append(f'ZoomChr={zc}')
        lw = g.get('linkWidth', 0)
        if lw and lw != 180:
            lines.append(f'LinkWidth={lw}')
        ns = g.get('normalizedScale', 0)
        if ns:
            lines.append('NormalizedScale=1')

        srf = g.get('speRegionFile', '')
        if srf:
            fpath = srf
            if not os.path.isabs(fpath):
                resolved = resolve_path(fpath, sdir)
                if resolved:
                    fpath = resolved
            lines.append(f'SpeRegionFile={fpath}')
        zr = g.get('zoomRegion', '')
        if zr:
            lines.append(f'ZoomRegion={zr}')

        lines.append('')

    for i, l in enumerate(links):
        lid = i + 1
        lines.append(f'SetParaFor = Link{lid}')

        sud = l.get('styleUpDown', '')
        if sud:
            lines.append(f'StyleUpDown={sud}')
        rev = l.get('reverse', 0)
        if rev:
            lines.append('Reverse=1')
        hr = l.get('heightRatio', 0)
        if hr and hr != 1:
            lines.append(f'HeightRatio={hr}')

        lf = l.get('linkFill', '')
        if lf:
            if lf.startswith('#'):
                lines.append(f'fill="{lf}"')
            else:
                lines.append(f'fill={lf}')
        ls = l.get('linkStroke', '')
        if ls:
            if ls.startswith('#'):
                lines.append(f'stroke="{ls}"')
            else:
                lines.append(f'stroke={ls}')
        lsw = l.get('linkStrokeWidth', 0)
        if lsw and lsw != 1:
            lines.append(f'stroke-width={lsw}')
        lfo = l.get('linkFillOpacity', 0)
        if lfo and lfo != 1:
            lines.append(f'fill-opacity={lfo}')
        lso = l.get('linkStrokeOpacity', 0)
        if lso and lso != 1:
            lines.append(f'stroke-opacity={lso}')

        lines.append('')

    return '\n'.join(lines)

@app.route('/api/run', methods=['POST'])
def run_ngenomesyn():
    data = request.get_json()
    output_name = data.get('output', 'result')
    sdir = session_dir()

    if 'params' in data:
        conf_text = generate_conf_from_params(data['params'], sdir)
    else:
        conf_text = data.get('conf_text', '')
        if not conf_text:
            return jsonify({'error': 'No config text or params provided'}), 400
        conf_text = resolve_conf_paths_in_text(conf_text, sdir)

    conf_path = sdir / '_web_run.conf'
    conf_path.write_text(conf_text)

    svg_path = RESULT_DIR / f"{output_name}.svg"

    cmd = ['perl', str(NGENOMESYN), '-InConf', str(conf_path), '-OutPut', str(svg_path.with_suffix('')), '-NoPng']

    try:
        proc = subprocess.run(
            cmd,
            capture_output=True,
            text=True,
            timeout=120,
            cwd=str(sdir)
        )
        success = svg_path.exists() and svg_path.stat().st_size > 0

        if success:
            svg_content = svg_path.read_text()
            return jsonify({
                'success': True,
                'svg': svg_content,
                'output': f"{output_name}.svg",
                'stdout': proc.stdout,
                'stderr': proc.stderr
            })
        else:
            return jsonify({
                'success': False,
                'error': 'NGenomeSyn execution failed',
                'stdout': proc.stdout,
                'stderr': proc.stderr,
                'returncode': proc.returncode
            }), 500
    except subprocess.TimeoutExpired:
        return jsonify({'success': False, 'error': 'Execution timed out'}), 500
    except FileNotFoundError:
        return jsonify({'success': False, 'error': 'NGenomeSyn not found. Is Perl installed?'}), 500
    except Exception as e:
        import traceback
        tb = traceback.format_exc()
        print(f"ERROR in run_ngenomesyn: {e}\n{tb}")
        return jsonify({'success': False, 'error': str(e), 'traceback': tb}), 500

@app.route('/api/result/<name>')
def get_result(name):
    svg_path = RESULT_DIR / name
    if not svg_path.exists():
        return jsonify({'error': 'Result not found'}), 404
    return send_file(str(svg_path), mimetype='image/svg+xml')

@app.route('/api/download/<name>')
def download_result(name):
    svg_path = RESULT_DIR / name
    if not svg_path.exists():
        return jsonify({'error': 'File not found'}), 404
    return send_file(str(svg_path), as_attachment=True)

@app.route('/api/download-conf', methods=['POST'])
def download_conf():
    data = request.get_json()
    text = data.get('text', '')
    if not text:
        return jsonify({'error': 'No content'}), 400
    from flask import Response
    return Response(
        text,
        mimetype='text/plain',
        headers={'Content-Disposition': 'attachment; filename=in.conf'}
    )

@app.route('/api/session/clear', methods=['POST'])
def clear_session():
    sid = get_session_id()
    sdir = session_dir()
    if sdir.exists():
        shutil.rmtree(str(sdir))
    return jsonify({'cleared': True})

@app.route('/api/session/cleanup', methods=['POST'])
def cleanup_old_sessions():
    count = 0
    for d in UPLOAD_DIR.iterdir():
        if d.is_dir():
            shutil.rmtree(str(d))
            count += 1
    return jsonify({'cleaned': count})

if __name__ == '__main__':
    import sys
    port = int(sys.argv[1]) if len(sys.argv) > 1 else 1688
    print(f"  NGenomeSyn Web Interface")
    print(f"  NGenomeSyn: {NGENOMESYN}")
    print(f"  Open http://127.0.0.1:{port}")
    app.run(debug=True, host='0.0.0.0', port=port, threaded=True)
