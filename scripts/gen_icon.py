#!/usr/bin/env python3
"""Generate iq-leetbuddy tray icon - clean coral planet."""

from PIL import Image, ImageDraw, ImageFilter

SIZE = 256

def make_icon():
    img = Image.new('RGBA', (SIZE, SIZE), (0, 0, 0, 0))

    center = SIZE // 2
    radius = 90

    # Outer glow
    glow = Image.new('RGBA', (SIZE, SIZE), (0, 0, 0, 0))
    glow_draw = ImageDraw.Draw(glow)
    glow_draw.ellipse(
        [center - radius - 16, center - radius - 16, center + radius + 16, center + radius + 16],
        fill=(204, 120, 92, 100)
    )
    glow = glow.filter(ImageFilter.GaussianBlur(radius=14))
    img = Image.alpha_composite(img, glow)

    # Planet with per-pixel gradient
    planet = Image.new('RGBA', (SIZE, SIZE), (0, 0, 0, 0))
    planet_pixels = planet.load()
    light_x, light_y = center - 30, center - 30

    for y in range(center - radius - 2, center + radius + 2):
        for x in range(center - radius - 2, center + radius + 2):
            dx = x - center
            dy = y - center
            dist = (dx * dx + dy * dy) ** 0.5
            if dist <= radius:
                ldx = x - light_x
                ldy = y - light_y
                ldist = (ldx * ldx + ldy * ldy) ** 0.5
                t = min(1.0, ldist / (radius * 1.4))
                r = int(230 - 100 * t)
                g = int(155 - 100 * t)
                b = int(128 - 95 * t)
                planet_pixels[x, y] = (r, g, b, 255)

    img = Image.alpha_composite(img, planet)

    # Small "satellite" — accent dot orbiting
    sat = Image.new('RGBA', (SIZE, SIZE), (0, 0, 0, 0))
    sat_draw = ImageDraw.Draw(sat)
    # Position: upper right, slightly outside planet
    sx, sy = center + 70, center - 60
    sat_draw.ellipse([sx - 10, sy - 10, sx + 10, sy + 10], fill=(232, 230, 227, 235))
    # subtle glow on satellite
    sat_glow = sat.filter(ImageFilter.GaussianBlur(radius=4))
    img = Image.alpha_composite(img, sat_glow)
    img = Image.alpha_composite(img, sat)

    img.save('assets/tray-icon.png', 'PNG')
    print('tray-icon.png 256x256 generated')

    for sz in (32, 18):
        small = img.resize((sz, sz), Image.LANCZOS)
        small.save(f'assets/tray-icon-{sz}.png', 'PNG')
        print(f'tray-icon-{sz}.png generated')

if __name__ == '__main__':
    make_icon()
