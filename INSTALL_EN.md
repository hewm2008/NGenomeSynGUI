# NGenomeSyn Web Interface Installation Guide

## Table of Contents

- [Linux / macOS](#linux--macos)
- [Windows](#windows)
  - [1. Install Perl](#1-install-perl)
  - [2. Install Python](#2-install-python)
  - [3. Install Python Dependencies](#3-install-python-dependencies)
  - [4. Verify Installation](#4-verify-installation)
  - [5. Start](#5-start)
- [Troubleshooting](#troubleshooting)

---

## Linux / macOS

### 1. Install Perl

Most Linux/macOS systems come with Perl pre-installed. Verify:

```bash
perl -v
```

If not found, install via package manager:

```bash
# Debian/Ubuntu
sudo apt install perl

# Red Hat/CentOS
sudo yum install perl

# macOS (Homebrew)
brew install perl
```

### 2. Install Python

```bash
# Debian/Ubuntu
sudo apt install python3 python3-pip

# Red Hat/CentOS
sudo yum install python3 python3-pip

# macOS (Homebrew)
brew install python3
```

Verify:

```bash
python3 --version
pip3 --version
```

### 3. Install Python Dependencies

```bash
cd NGenomeSynGUI/
pip3 install flask flask-cors
```

### 4. Start

```bash
cd NGenomeSynGUI/
bash start.sh
```

Open http://127.0.0.1:1688 in your browser.

---

## Windows

### 1. Install Perl

NGenomeSyn requires a Perl runtime. **Strawberry Perl** is recommended.

#### Option A: Strawberry Perl (Recommended)

1. Visit https://strawberryperl.com/
2. Click **Download** and choose the 64-bit version (`strawberry-perl-*.msi`)
3. Run the installer
4. **Critical**: Check **"Add Perl to PATH"** during installation

   > If you missed it, add manually after installation:
   > - Right-click "This PC" → Properties → Advanced system settings → Environment Variables
   > - Under "System variables", find `Path`, click Edit, and add: `C:\Strawberry\perl\bin`
   > - (If installed elsewhere, replace with the actual path)

5. Open Command Prompt (Win+R → `cmd` → Enter) to verify:

   ```cmd
   perl -v
   ```

   Should display something like `This is perl 5, version 32, subversion 1 (v5.32.1)`.

#### Option B: ActivePerl

1. Visit https://www.activestate.com/products/perl/
2. Register and download ActivePerl
3. Ensure **Add to PATH** is checked during installation

### 2. Install Python

1. Visit https://www.python.org/downloads/
2. Click **Download Python 3.x.x** (3.8 or newer recommended)
3. Run the installer
4. **Critical**: **Check "Add Python to PATH"** at the bottom of the installer

   > If you missed it, either reinstall or manually add:
   > - Locate Python install directory (e.g. `C:\Users\YourName\AppData\Local\Programs\Python\Python311\`)
   > - Add both `Python311\` and `Python311\Scripts\` to system PATH

5. Open a new Command Prompt to verify:

   ```cmd
   python --version
   ```

   Verify pip:

   ```cmd
   pip --version
   ```

   > If `python` is not found, try `py` or `python3`.
   > If `pip` is not found, use: `python -m pip --version`

### 3. Install Python Dependencies

Open Command Prompt, navigate to the project directory:

```cmd
cd C:\path\to\NGenomeSynGUI
pip install flask flask-cors
```

> If pip download is slow, use a mirror:
> ```cmd
> pip install flask flask-cors -i https://pypi.tuna.tsinghua.edu.cn/simple
> ```

### 4. Verify Installation

Ensure Perl and Python are both ready:

```cmd
perl -v
python --version
pip list
```

The `pip list` output should include `flask` and `flask-cors`.

### 5. Start

**Option 1: Double-click `start.bat`**

Open Windows Explorer, go to `NGenomeSynGUI\start.bat`, double-click.

**Option 2: Command line**

```cmd
cd NGenomeSynGUI
start.bat
```

**Option 3: Custom port**

```cmd
cd NGenomeSynGUI\web
python app.py 8080
```

Open http://127.0.0.1:1688 in your browser.

---

## Troubleshooting

### Perl Issues

| Problem | Cause | Solution |
|---------|-------|----------|
| `perl` is not recognized | Perl not in PATH | Reinstall Strawberry Perl with "Add to PATH"; or manually add PATH |
| `Can't locate NGenomeSyn` | Wrong NGenomeSyn path | Ensure `NGenomeSyn-1.43/bin/NGenomeSyn` exists and is executable |

### Python Issues

| Problem | Cause | Solution |
|---------|-------|----------|
| `python` is not recognized | Python not in PATH | Reinstall with "Add to PATH" checked |
| `pip` is not recognized | pip not in PATH | Use `python -m pip install ...` instead |
| `ModuleNotFoundError: No module named 'flask'` | Dependencies not installed | Run `pip install flask flask-cors` |

### Port Issues

| Problem | Solution |
|---------|----------|
| `Address already in use` | Port is occupied. Use another port: `python app.py 8080` |
| Find which process uses the port | `netstat -ano \| findstr :1688` (Windows) or `lsof -i :1688` (Linux/macOS) |

### "NGenomeSyn execution failed"

When clicking **▶ Run NGenomeSyn** shows an error:

1. Check the stderr output for error details
2. Verify `NGenomeSyn-1.43/bin/NGenomeSyn` exists
3. Verify Perl works: `perl -v`
4. Verify .len and .link files have correct format
