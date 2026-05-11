#!/usr/bin/env python3
"""Generate iq-leetbuddy macOS app icon (1024x1024).
Design: squircle background + coral planet with shading + orbital ring + satellite.
"""

from PIL import Image, ImageDraw, ImageFilter
import math

SIZE = 1024
CORNER_RADIUS = 230  # macOS-style rounded square

# Brand colors (mirrors src/renderer/styles.css)
BG_DARK = (15, 13, 11)
BG_ELEVATED = (21, 19, 15)
CORAL = (204, 120, 92)
CORAL_LIGHT = (220, 145, 120)
CORAL_DEEP = (138, 74, 54)
SATELLITE = (240, 235, 222)


def make_squircle_mask(size: int, radius: int) -> Image.Image:
    """Rounded square mask (approximates macOS squircle)."""
    mask = Image.new('L', (size, size), 0)
    ImageDraw.Draw(mask).rounded_rectangle(
        [0, 0, size - 1, size - 1], radius=radius, fill=255
    )
    return mask


def make_background(size: int) -> Image.Image:
    """Warm dark gradient background with subtle vignette."""
    bg = Image.new('RGB', (size, size), BG_DARK)
    pixels = bg.load()
    cx, cy = size / 2, size / 2
    max_d = (cx ** 2 + cy ** 2) ** 0.5
    for y in range(size):
        for x in range(size):
            # subtle radial gradient: center lighter, edges darker
            d = ((x - cx) ** 2 + (y - cy) ** 2) ** 0.5 / max_d
            r = int(BG_ELEVATED[0] + (BG_DARK[0] - BG_ELEVATED[0]) * d)
            g = int(BG_ELEVATED[1] + (BG_DARK[1] - BG_ELEVATED[1]) * d)
            b = int(BG_ELEVATED[2] + (BG_DARK[2] - BG_ELEVATED[2]) * d)
            pixels[x, y] = (r, g, b)
    return bg.convert('RGBA')


def draw_planet(img: Image.Image, cx: int, cy: int, radius: int):
    """Draw a shaded sphere — base coral with brighter upper-left highlight."""
    planet = Image.new('RGBA', img.size, (0, 0, 0, 0))
    pp = planet.load()

    # Light source: upper-left of planet
    light_x = cx - radius * 0.4
    light_y = cy - radius * 0.4

    for y in range(cy - radius - 3, cy + radius + 3):
        for x in range(cx - radius - 3, cx + radius + 3):
            dx = x - cx
            dy = y - cy
            dist = (dx * dx + dy * dy) ** 0.5
            if dist > radius:
                continue

            ldx = x - light_x
            ldy = y - light_y
            ldist = (ldx * ldx + ldy * ldy) ** 0.5

            # Light intensity: 1.0 near light source, fading to 0 at far edge
            light_t = max(0.0, 1.0 - ldist / (radius * 1.85))
            # Smoothstep for natural falloff
            light_t = light_t * light_t * (3 - 2 * light_t)

            # Interpolate between CORAL (base/dark side) and CORAL_LIGHT (highlight)
            r = int(CORAL[0] + (CORAL_LIGHT[0] - CORAL[0]) * light_t)
            g = int(CORAL[1] + (CORAL_LIGHT[1] - CORAL[1]) * light_t)
            b = int(CORAL[2] + (CORAL_LIGHT[2] - CORAL[2]) * light_t)

            # Subtle terminator (where lit and unlit meet at the edge)
            edge_t = dist / radius
            if edge_t > 0.88 and light_t < 0.3:
                fade = (edge_t - 0.88) / 0.12
                r = int(r * (1 - fade * 0.35))
                g = int(g * (1 - fade * 0.35))
                b = int(b * (1 - fade * 0.35))

            pp[x, y] = (r, g, b, 255)

    return Image.alpha_composite(img, planet)


def add_surface_texture(img: Image.Image, cx: int, cy: int, radius: int) -> Image.Image:
    """Subtle dark patches suggesting planet surface."""
    import random
    random.seed(7)

    tex = Image.new('RGBA', img.size, (0, 0, 0, 0))
    td = ImageDraw.Draw(tex)

    for _ in range(12):
        # Place patches in upper-light hemisphere mostly
        angle = random.uniform(0.2 * math.pi, 1.4 * math.pi)
        r_pos = random.uniform(radius * 0.15, radius * 0.70)
        px = cx + int(r_pos * math.cos(angle))
        py = cy + int(r_pos * math.sin(angle))
        patch_r = random.randint(20, 50)
        opacity = random.randint(30, 60)
        td.ellipse(
            [px - patch_r, py - patch_r, px + patch_r, py + patch_r],
            fill=(70, 35, 22, opacity),
        )

    tex = tex.filter(ImageFilter.GaussianBlur(radius=12))
    # NOTE: 별도 마스킹 없음. patches가 이미 planet radius 내부에 위치하고,
    # blur가 12px이라 거의 새어나가지 않음. putalpha를 쓰면 알파가 *교체*되어
    # 빈 영역이 (0,0,0,255)로 채워지는 버그 발생.
    return Image.alpha_composite(img, tex)


def add_planet_glow(img: Image.Image, cx: int, cy: int, radius: int) -> Image.Image:
    """Outer halo around planet."""
    glow = Image.new('RGBA', img.size, (0, 0, 0, 0))
    gd = ImageDraw.Draw(glow)
    halo_r = radius + 80
    gd.ellipse(
        [cx - halo_r, cy - halo_r, cx + halo_r, cy + halo_r],
        fill=(*CORAL, 75),
    )
    glow = glow.filter(ImageFilter.GaussianBlur(radius=55))
    return Image.alpha_composite(img, glow)


def add_specular_highlight(img: Image.Image, cx: int, cy: int, radius: int) -> Image.Image:
    """Bright highlight on upper-left of planet (specular)."""
    from PIL import ImageChops

    spec = Image.new('RGBA', img.size, (0, 0, 0, 0))
    sd = ImageDraw.Draw(spec)
    spec_x = cx - int(radius * 0.4)
    spec_y = cy - int(radius * 0.45)
    spec_r = int(radius * 0.35)
    sd.ellipse(
        [spec_x - spec_r, spec_y - spec_r, spec_x + spec_r, spec_y + spec_r],
        fill=(255, 230, 215, 110),
    )
    spec = spec.filter(ImageFilter.GaussianBlur(radius=35))

    # 알파 *곱셈*으로 planet 외부만 잘라냄 (교체 X)
    planet_mask = Image.new('L', img.size, 0)
    ImageDraw.Draw(planet_mask).ellipse(
        [cx - radius, cy - radius, cx + radius, cy + radius], fill=255
    )
    spec_alpha = spec.split()[-1]
    new_alpha = ImageChops.multiply(spec_alpha, planet_mask)
    spec.putalpha(new_alpha)

    return Image.alpha_composite(img, spec)


def add_ring(img: Image.Image, cx: int, cy: int) -> Image.Image:
    """Tilted orbital ring."""
    ring = Image.new('RGBA', img.size, (0, 0, 0, 0))
    rd = ImageDraw.Draw(ring)
    ring_w = 460
    ring_h = 100
    rd.ellipse(
        [cx - ring_w, cy - ring_h, cx + ring_w, cy + ring_h],
        outline=(232, 230, 227, 170),
        width=5,
    )
    ring = ring.rotate(-20, resample=Image.BICUBIC, center=(cx, cy))
    return Image.alpha_composite(img, ring)


def add_satellite(img: Image.Image, cx: int, cy: int) -> Image.Image:
    """Small luminous moon on the upper-right."""
    sat = Image.new('RGBA', img.size, (0, 0, 0, 0))
    sd = ImageDraw.Draw(sat)
    # Place on ring trajectory (matches ring rotation)
    sx = cx + 380
    sy = cy - 220
    sat_r = 38
    # body
    sd.ellipse(
        [sx - sat_r, sy - sat_r, sx + sat_r, sy + sat_r],
        fill=SATELLITE + (255,),
    )

    # Halo
    halo = sat.filter(ImageFilter.GaussianBlur(radius=12))
    img = Image.alpha_composite(img, halo)
    return Image.alpha_composite(img, sat)


def make_icon() -> Image.Image:
    cx, cy = SIZE // 2, SIZE // 2
    planet_radius = 300

    # 1. Background
    img = make_background(SIZE)

    # 2. Planet glow (BEHIND planet)
    img = add_planet_glow(img, cx, cy, planet_radius)

    # 3. Planet body
    img = draw_planet(img, cx, cy, planet_radius)

    # 4. Surface texture
    img = add_surface_texture(img, cx, cy, planet_radius)

    # 5. Specular highlight
    img = add_specular_highlight(img, cx, cy, planet_radius)

    # 6. Orbital ring
    img = add_ring(img, cx, cy)

    # 7. Satellite
    img = add_satellite(img, cx, cy)

    # 8. Apply squircle mask
    mask = make_squircle_mask(SIZE, CORNER_RADIUS)
    final = Image.new('RGBA', (SIZE, SIZE), (0, 0, 0, 0))
    final.paste(img, (0, 0), mask)

    return final


def main():
    print('Generating app icon...')
    icon = make_icon()
    icon.save('build/icon.png', 'PNG')
    print(f'  ✓ build/icon.png  ({SIZE}x{SIZE})')

    # Also produce smaller sizes for reference / quick checks
    for sz in [512, 256, 128, 64]:
        s = icon.resize((sz, sz), Image.LANCZOS)
        s.save(f'build/icon-{sz}.png', 'PNG')
        print(f'  ✓ build/icon-{sz}.png')


if __name__ == '__main__':
    main()
