# 生成 LabMate 启动图标（无外部素材）
import os
from PIL import Image, ImageDraw, ImageFilter

S = 1024
OUT = os.path.dirname(os.path.abspath(__file__))

def lerp(a, b, t):
    return tuple(int(a[i] + (b[i] - a[i]) * t) for i in range(3))

def gradient(size, c1, c2, diagonal=True):
    img = Image.new("RGB", (size, size), c1)
    d = ImageDraw.Draw(img)
    for i in range(size):
        t = i / (size - 1)
        d.line([(0, i), (size, i)], fill=lerp(c1, c2, t if not diagonal else t))
    return img

def flask(draw, scale=1.0, ox=0, oy=0):
    def P(x, y):
        return (ox + x * scale, oy + y * scale)
    # 瓶颈
    draw.rounded_rectangle([P(430, 250), P(594, 400)], radius=int(26 * scale), fill=(255, 255, 255, 255))
    # 瓶口
    draw.rounded_rectangle([P(398, 214), P(626, 268)], radius=int(24 * scale), fill=(255, 255, 255, 255))
    # 瓶身（梯形 + 圆底）
    body = [P(430, 380), P(594, 380), P(742, 790), P(282, 790)]
    draw.polygon(body, fill=(255, 255, 255, 255))
    draw.ellipse([P(282, 660), P(742, 900)], fill=(255, 255, 255, 255))
    # 液面
    liquid = [P(350, 640), P(674, 640), P(742, 790), P(282, 790)]
    draw.polygon(liquid, fill=(94, 234, 212, 255))
    draw.ellipse([P(282, 660), P(742, 900)], fill=(94, 234, 212, 255))
    # 液面高光
    draw.ellipse([P(330, 646), P(694, 690)], fill=(153, 246, 228, 255))
    # 气泡
    for (cx, cy, r) in [(430, 830, 26), (540, 870, 20), (610, 800, 16), (480, 760, 12)]:
        draw.ellipse([P(cx - r, cy - r), P(cx + r, cy + r)], fill=(240, 253, 250, 255))
    # 刻度线
    for y in (560, 620):
        draw.line([P(452, y), P(500, y)], fill=(15, 118, 110, 190), width=int(7 * scale))

def build(round_icon=False):
    img = gradient(S, (13, 116, 110), (20, 184, 166)).convert("RGBA")
    mask = Image.new("L", (S, S), 0)
    md = ImageDraw.Draw(mask)
    if round_icon:
        md.ellipse([0, 0, S - 1, S - 1], fill=255)
    else:
        md.rounded_rectangle([0, 0, S - 1, S - 1], radius=228, fill=255)
    base = Image.new("RGBA", (S, S), (0, 0, 0, 0))
    base.paste(img, (0, 0), mask)

    layer = Image.new("RGBA", (S, S), (0, 0, 0, 0))
    d = ImageDraw.Draw(layer)
    flask(d, scale=0.94, ox=30, oy=20)
    # 柔和投影
    shadow = layer.filter(ImageFilter.GaussianBlur(18))
    dark = Image.new("RGBA", (S, S), (0, 0, 0, 0))
    dark.paste(shadow, (0, 26), shadow)
    base.alpha_composite(dark)
    base.alpha_composite(layer)
    return base

sizes = {"mdpi": 48, "hdpi": 72, "xhdpi": 96, "xxhdpi": 144, "xxxhdpi": 192}
for name, round_icon in (("ic_launcher", False), ("ic_launcher_round", True)):
    master = build(round_icon)
    for bucket, px in sizes.items():
        folder = os.path.join(OUT, "res", "mipmap-" + bucket)
        os.makedirs(folder, exist_ok=True)
        master.resize((px, px), Image.LANCZOS).save(os.path.join(folder, name + ".png"))

# 预览图（README 用）
master = build(False)
os.makedirs(os.path.join(OUT, "docs"), exist_ok=True)
master.resize((256, 256), Image.LANCZOS).save(os.path.join(OUT, "docs", "icon.png"))
print("icons generated")
