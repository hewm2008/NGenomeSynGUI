# NGenomeSyn Web 交互界面

NGenomeSyn 的跨平台 Web 交互式界面。通过结构化参数面板配置基因组布局，在 Canvas 上拖拽/缩放/旋转，一键运行 Perl 后端生成 SVG 结果图。

## 目录结构

```
NGenomeSynGUI/
├── README.md               # 英文文档
├── README_Chinese.md        # 本文档
├── requirements.txt        # Python 依赖
├── start.sh                # Linux/macOS 启动脚本
├── start.bat               # Windows 启动脚本
├── web/                    # Flask Web 应用
│   ├── app.py              # Flask 后端
│   └── static/             # 前端文件
└── NGenomeSyn-1.43/        # NGenomeSyn 核心
    ├── bin/NGenomeSyn       # Perl 可执行脚本
    ├── Example/             # 示例配置和 RealData
    └── README.md
```

## 环境要求

- Python 3.6+
- Flask + Flask-CORS
- Perl（NGenomeSyn，位于 `NGenomeSyn-1.43/bin/NGenomeSyn`）

## 安装

```bash
cd NGenomeSynGUI/
pip install flask flask-cors
```

## 启动

```bash
cd NGenomeSynGUI/
bash start.sh
# 访问 http://127.0.0.1:1688
```

指定端口：`bash start.sh 8080`

## 多用户并发

Flask 开发服务器已开启 `threaded=True`，支持 2-5 人同时使用。如需更高并发，安装 gunicorn：

```bash
pip install gunicorn
bash start.sh  # 自动检测并使用 gunicorn -w 4
```

</br> The GUI as follows:
![GUI.png](https://github.com/hewm2008/NGenomeSynGUI/blob/main/doc/GUI.png)

## Windows 部署

### 1. 安装 Perl

| 分发版 | 下载 | 说明 |
|--------|------|------|
| **Strawberry Perl**（推荐） | https://strawberryperl.com/ | 自带包管理器，社区活跃 |
| **ActivePerl** | https://www.activestate.com/products/perl/ | 需注册下载 |

安装时勾选 **Add Perl to PATH**。验证：`perl -v`

### 2. 安装 Python

从 https://www.python.org/downloads/ 下载，**务必勾选 "Add Python to PATH"**。验证：`python --version`

### 3. 安装 Python 依赖

```cmd
cd NGenomeSynGUI
pip install flask flask-cors
```

### 4. 启动

- **双击 `start.bat`**（默认端口 1688）
- **命令行**：`python web\app.py 8080`
- **调试模式**：`set FLASK_DEBUG=1 && python web\app.py 1688`

### 5. 注意事项

| 问题 | 解决 |
|------|------|
| **perl 命令找不到** | 重装 Perl 勾选 "Add to PATH"，或手动将 Perl bin 目录加入 PATH |
| **python 命令找不到** | 重装 Python 勾选 "Add to PATH" |
| **端口被占用** | `python app.py 8080` 或 `netstat -ano \| findstr :1688` 查占用进程 |
| **浏览器无法访问** | 检查防火墙，或尝试 `http://localhost:1688` |

## 使用说明

### 1. 设置基因组数量

顶栏输入 N（≥2），点击 **Apply**。

### 2. 配置基因组

| 区域 | 参数 | 说明 |
|------|------|------|
| 基本信息 | File (.len) | 上传基因组长度文件 |
| | Name | 显示名称 |
| | Color | 16 色预设 + 原生取色器 |
| | Size (ChrWidth) | 染色体条宽度 |
| | Opacity | 透明度 |
| | Rotation | 旋转角度 |
| **▼ Move** | ShiftX / ShiftY | 画布偏移量 |
| **▼ Labels** | GenomeNameSizeRatio / Color / ShiftX/Y | 基因组名称样式 |
| | ChrNameShow / ShiftX/Y / Ratio / Color / Rotate | 染色体名称样式 |
| **▼ Scales** | ShowCoordinates / ScaleNum / ScaleUnit / ScaleUpDown / LabelUnit / Precision | 坐标尺 |
| **▼ Region** | SpeRegionFile | 特殊区域文件 (.bed) |
| | ZoomRegion | 缩放区域（如 `chrI:1-1000`） |
| **▼ Others** | ZoomChr / LinkWidth / NormScale | 其他参数 |

### 3. 添加 Link

选择 Genome A → B，上传 `.link` 文件。每个 Link 可展开 **▼ More** 设置连线样式。

### 4. 全局参数

Chr Width（染色体宽度）、Chr Spacing（间距）；**▼ Theme**（图例标题/颜色/偏移）；**▼ Canvas**（边距/比例）。

### 5. 画布交互

| 操作 | 效果 |
|------|------|
| **左键拖拽** 基因组 | 移动位置 |
| **左键单击** | 选中高亮，同步侧栏 |
| **右键菜单** | 名称 → 改名/改色；染色体 → 信息/改色/大小/旋转；轨道 → 完整菜单 |
| **滚轮** | 缩放画布 |
| **空白区拖拽** | 平移视角 |
| **Fit / Reset** | 自适应居中 / 恢复视角 |

### 6. 运行

点击 **▶ Run NGenomeSyn** 执行 Perl 后端，成功后显示 SVG 结果。
- **Download SVG** — 下载结果图
- **Download Config** — 下载 .conf 配置文件
- **结果图缩放** — 滚轮缩放（0.1x–10x），双击重置

### 7. Demo

点击 **📦 Demo** 自动加载 Example1（酵母双基因组对比）。

## 设计架构

### 整体流程

```
用户操作 → STATE 对象 → generate_conf_from_params()
→ .conf 文本 → Perl NGenomeSyn → SVG → 前端展示
```

### 前端（Vanilla JS）

| 模块 | 说明 |
|------|------|
| **STATE** | 全局状态对象 |
| **renderGenomes()** | 渲染 Genome 参数面板（5 个折叠区） |
| **renderCanvas()** | 绘制基因组轨道、染色体、连线；支持 HiDPI |
| **getGenomeAt()** | 点击检测（扩展命中区） |
| **runNGenomeSyn()** | 调用后端执行 Perl |

### 后端（Flask）

| 模块 | 说明 |
|------|------|
| **generate_conf_from_params()** | 结构化参数 → .conf 文本 |
| **parse_conf_text()** | .conf → 结构化数据 |
| **resolve_path()** | 多级路径解析 |
| **run_ngenomesyn()** | 调用 Perl，检查 SVG 文件 |

### 关键技术决策

| 问题 | 方案 |
|------|------|
| NGenomeSyn 成功时 exit code = 1 | 检测 SVG 文件存在且 > 0 字节 |
| 颜色 `#hex` 被 conf 解析器截断 | 加引号：`fill="#e74c3c"` |
| HiDPI 点击偏移 | `ctx.scale(dpr, dpr)` |
| 拖拽值 (delta) 与 Perl 期望 (absolute) 不匹配 | 输出 `ShiftX/ShiftY`（纯偏移） |
| ChrWidth/ChrSpacing 不影响 SVG | 写入 per-genome 段，全局滑块传播到所有 genome |

## 依赖

- Python 3.6+ · Flask · Flask-CORS
- Perl · NGenomeSyn（`NGenomeSyn-1.43/bin/NGenomeSyn`）

## 已知问题

- NGenomeSyn Perl 成功执行后返回 exit code 1（源码 line 3064），不影响结果
- `.conf` 中 `#` 被视为注释，颜色值必须加引号：`fill="#ff0000"`
- 每个浏览器标签页使用独立 session，文件互不干扰

## 常见问题

**Q: 上传文件后找不到？**
A: 文件按 session ID 存储在 `static/uploads/<sid>/`，刷新页面会生成新 session。

**Q: 点击 Run 后失败？**
A: 检查 Perl 和 `NGenomeSyn-1.43/bin/NGenomeSyn` 是否存在且可执行。查看 stderr 定位错误。

## 开发者

- **hewm2008**
- 📧 hewm2008@gmail.com / hewm2008@qq.com
- 💬 QQ 群：**125293663**
- GitHub: https://github.com/hewm2008/NGenomeSyn
