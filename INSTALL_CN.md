# NGenomeSyn Web Interface 安装指南

## 目录

- [Linux / macOS](#linux--macos)
- [Windows](#windows)
  - [1. 安装 Perl](#1-安装-perl)
  - [2. 安装 Python](#2-安装-python)
  - [3. 安装 Python 依赖包](#3-安装-python-依赖包)
  - [4. 验证安装](#4-验证安装)
  - [5. 启动](#5-启动)
- [故障排查](#故障排查)

---

## Linux / macOS

### 1. 安装 Perl

大多数 Linux/macOS 系统已预装 Perl。验证：

```bash
perl -v
```

如果没有，用包管理器安装：

```bash
# Debian/Ubuntu
sudo apt install perl

# Red Hat/CentOS
sudo yum install perl

# macOS (Homebrew)
brew install perl
```

### 2. 安装 Python

```bash
# Debian/Ubuntu
sudo apt install python3 python3-pip

# Red Hat/CentOS
sudo yum install python3 python3-pip

# macOS (Homebrew)
brew install python3
```

验证：

```bash
python3 --version
pip3 --version
```

### 3. 安装依赖包

```bash
cd NGenomeSynGUI/
pip3 install flask flask-cors
```

### 4. 启动

```bash
cd NGenomeSynGUI/
bash start.sh
```

浏览器打开 http://127.0.0.1:1688

---

## Windows

### 1. 安装 Perl

NGenomeSyn 需要 Perl 运行环境。推荐使用 **Strawberry Perl**。

#### 方式一：Strawberry Perl（推荐）

1. 访问 https://strawberryperl.com/
2. 点击 **Download**，下载 64-bit 版本（`strawberry-perl-*.msi`）
3. 双击运行安装程序
4. **关键步骤**：在安装向导中，确保勾选 **"Add Perl to PATH"**

   > 如果漏掉了，安装后手动添加：
   > - 右键"此电脑" → 属性 → 高级系统设置 → 环境变量
   > - 在"系统变量"中找到 `Path`，编辑添加：`C:\Strawberry\perl\bin`
   > - （如果安装在其他路径，请替换为实际路径）

5. 安装完成后，打开命令提示符（Win+R → 输入 `cmd` → 回车）验证：

   ```cmd
   perl -v
   ```

   应显示类似 `This is perl 5, version 32, subversion 1 (v5.32.1)` 的信息。

#### 方式二：ActivePerl

1. 访问 https://www.activestate.com/products/perl/
2. 注册账号后下载 ActivePerl
3. 安装时同样注意勾选 **Add to PATH**

### 2. 安装 Python

1. 访问 https://www.python.org/downloads/
2. 点击 **Download Python 3.x.x**（建议 3.8 或更高版本）
3. 运行下载的安装程序
4. **关键步骤**：**务必勾选底部的 "Add Python to PATH"**（非常重要）

   ![Add Python to PATH](https://docs.python.org/3/_images/win_installer.png)

   > 如果漏掉了，可以卸载重装，或者手动添加：
   > - 找到 Python 安装目录（如 `C:\Users\你的用户名\AppData\Local\Programs\Python\Python311\`）
   > - 将 `Python311\` 和 `Python311\Scripts\` 都加入系统 PATH

5. 安装完成后，打开新命令提示符验证：

   ```cmd
   python --version
   ```

   应显示 Python 版本号。

   验证 pip：

   ```cmd
   pip --version
   ```

   > 如果 `python` 命令找不到，试试 `py` 或 `python3`。
   > 如果 `pip` 命令找不到，使用：`python -m pip --version`

### 3. 安装 Python 依赖包

打开命令提示符，进入项目目录：

```cmd
cd C:\你的路径\NGenomeSynGUI
pip install flask flask-cors
```

> 如果 pip 安装慢，可以换国内镜像源：
> ```cmd
> pip install flask flask-cors -i https://pypi.tuna.tsinghua.edu.cn/simple
> ```

### 4. 验证安装

确保 Perl 和 Python 都已就绪：

```cmd
perl -v
python --version
pip list
```

`pip list` 应能看到 `flask` 和 `flask-cors`。

### 5. 启动

**方式一：双击 `start.bat`**

在文件资源管理器中找到 `NGenomeSynGUI\start.bat`，双击运行。

**方式二：命令行启动**

```cmd
cd NGenomeSynGUI
start.bat
```

**方式三：指定端口**

```cmd
cd NGenomeSynGUI\web
python app.py 8080
```

浏览器打开 http://127.0.0.1:1688

---

## 故障排查

### Perl 相关问题

| 问题 | 原因 | 解决 |
|------|------|------|
| `perl` 不是内部或外部命令 | Perl 未加入 PATH | 重装 Strawberry Perl，勾选 "Add to PATH"；或手动添加 PATH |
| `Can't locate NGenomeSyn` | NGenomeSyn 路径不对 | 确保项目完整下载，`NGenomeSyn-1.43/bin/NGenomeSyn` 存在且可执行 |

### Python 相关问题

| 问题 | 原因 | 解决 |
|------|------|------|
| `python` 不是内部或外部命令 | Python 未加入 PATH | 重装，勾选 "Add to PATH" |
| `pip` 不是内部或外部命令 | pip 未加入 PATH | 使用 `python -m pip install ...` 替代 |
| `ModuleNotFoundError: No module named 'flask'` | 未安装依赖 | 运行 `pip install flask flask-cors` |

### 端口问题

| 问题 | 解决 |
|------|------|
| `Address already in use` | 端口被占用。改用其他端口：`python app.py 8080` |
| 查找占用端口的进程 | `netstat -ano \| findstr :1688`（Windows）或 `lsof -i :1688`（Linux/macOS） |

### 运行 NGenomeSyn 失败

点击 **▶ Run NGenomeSyn** 后看到错误：

1. 检查 stderr 输出框中的错误信息
2. 确认 `NGenomeSyn-1.43/bin/NGenomeSyn` 文件存在
3. 确认 Perl 可以正常运行：`perl -v`
4. 上传的 .len 和 .link 文件格式是否正确
