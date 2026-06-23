#!/usr/bin/env python3
"""Generate the PocketBirds splash wordmark at every native density.

Renders a single-line "PocketBirds" wordmark in the brand display font
(Bricolage Grotesque 700 Bold), ink on transparent, sized so the whole word
fits inside the Android 12 splash safe-circle (the system masks
windowSplashScreenAnimatedIcon to the center ~2/3 of the canvas). We fit by the
text block's DIAGONAL, not just its width, because the corners of a wide line
are what the circle would clip. One square asset works on both platforms: iOS
aspect-fits it in a 200pt box (no mask); Android shows the inscribed circle.
"""
import os
import math
from PIL import Image, ImageDraw, ImageFont

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
FONT = os.path.join(ROOT, "node_modules/@expo-google-fonts/bricolage-grotesque/700Bold/BricolageGrotesque_700Bold.ttf")
INK = (26, 36, 23, 255)  # palette.ink #1a2417
LINES = ["PocketBirds"]
# The text block's bounding-box diagonal targets 62% of the canvas, sitting
# safely inside the Android center safe-circle (diameter ~66% of canvas).
TARGET_DIAG_FRAC = 0.62

ANDROID = {
    "drawable-mdpi": 288,
    "drawable-hdpi": 432,
    "drawable-xhdpi": 576,
    "drawable-xxhdpi": 864,
    "drawable-xxxhdpi": 1152,
}
IOS = {"image.png": 200, "image@2x.png": 400, "image@3x.png": 600}


def _block(draw, f):
    """Visual bounding boxes, per-line heights, gap, and total block w/h."""
    boxes = [draw.textbbox((0, 0), t, font=f) for t in LINES]
    heights = [b[3] - b[1] for b in boxes]
    gap = int(max(heights) * 0.16) if len(LINES) > 1 else 0
    total_w = max(b[2] - b[0] for b in boxes)
    total_h = sum(heights) + gap * (len(LINES) - 1)
    return boxes, heights, gap, total_w, total_h


def render(size):
    img = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    draw = ImageDraw.Draw(img)
    target_diag = TARGET_DIAG_FRAC * size

    # Binary-search the font size so the text block's diagonal hits the target.
    lo, hi, best = 4, size, 4
    while lo <= hi:
        mid = (lo + hi) // 2
        f = ImageFont.truetype(FONT, mid)
        _, _, _, w, h = _block(draw, f)
        if math.hypot(w, h) <= target_diag:
            best, lo = mid, mid + 1
        else:
            hi = mid - 1
    f = ImageFont.truetype(FONT, best)

    boxes, heights, gap, _, total_h = _block(draw, f)
    y = (size - total_h) / 2
    for t, b, h in zip(LINES, boxes, heights):
        w = b[2] - b[0]
        x = (size - w) / 2 - b[0]
        draw.text((x, y - b[1]), t, font=f, fill=INK)
        y += h + gap
    return img


def main():
    for folder, size in ANDROID.items():
        out = os.path.join(ROOT, "android/app/src/main/res", folder, "splashscreen_logo.png")
        render(size).save(out)
        print("wrote", out, size)
    for name, size in IOS.items():
        out = os.path.join(ROOT, "ios/PocketBirds4/Images.xcassets/SplashScreenLogo.imageset", name)
        render(size).save(out)
        print("wrote", out, size)

    # Verification composite: cream bg + circle-mask overlay at xxxhdpi.
    size = 1152
    mark = render(size)
    cream = Image.new("RGBA", (size, size), (253, 246, 230, 255))
    cream.alpha_composite(mark)
    d = ImageDraw.Draw(cream)
    r = int(size * 0.66 / 2)  # Android safe-circle radius
    d.ellipse([size//2 - r, size//2 - r, size//2 + r, size//2 + r], outline=(220, 70, 70, 255), width=4)
    cream.convert("RGB").save(os.path.join(ROOT, "scripts/_splash_preview.png"))
    print("wrote preview")


if __name__ == "__main__":
    main()
