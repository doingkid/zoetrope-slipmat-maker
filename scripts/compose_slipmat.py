#!/usr/bin/env python3
"""Deterministically compose 54 transparent animation frames into a slipmat."""

import argparse
import io
import json
import math
import re
import zipfile
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont, UnidentifiedImageError

N = 54
DIAMETER_MM = 304.8
MAX_SOURCE_BYTES = 20_000_000
MAX_PIXELS = 16_000_000


def read_frames(path):
    with zipfile.ZipFile(path) as archive:
        members = [m for m in archive.infolist() if not m.is_dir()
                   and not m.filename.startswith('__MACOSX/')
                   and not Path(m.filename).name.startswith('.')]
        numbered = {}
        for member in members:
            name = Path(member.filename).name
            match = re.fullmatch(r'(\d{1,3})\.png', name, re.IGNORECASE)
            if not match:
                raise ValueError(f'Unexpected file in ZIP: {member.filename}; use 001.png through 054.png')
            number = int(match.group(1))
            if number in numbered:
                raise ValueError(f'Duplicate frame number: {number}')
            numbered[number] = member
        expected = set(range(1, N + 1))
        if set(numbered) != expected:
            raise ValueError(f'Expected frames 1–54; missing {sorted(expected - set(numbered))}; '
                             f'extra {sorted(set(numbered) - expected)}')
        frames = []
        canvas = None
        for number in range(1, N + 1):
            member = numbered[number]
            if member.file_size > MAX_SOURCE_BYTES:
                raise ValueError(f'Frame {number} exceeds {MAX_SOURCE_BYTES} bytes')
            raw = archive.read(member)
            try:
                with Image.open(io.BytesIO(raw)) as source:
                    if source.width * source.height > MAX_PIXELS:
                        raise ValueError(f'Frame {number} exceeds {MAX_PIXELS} pixels')
                    if 'A' not in source.getbands() and 'transparency' not in source.info:
                        raise ValueError(f'Frame {number} has no transparency')
                    frame = source.convert('RGBA')
            except UnidentifiedImageError as exc:
                raise ValueError(f'Frame {number} is not a usable PNG') from exc
            if frame.getchannel('A').getbbox() is None:
                raise ValueError(f'Frame {number} is entirely transparent')
            if canvas is None:
                canvas = frame.size
            elif frame.size != canvas:
                raise ValueError(f'Frame {number} has size {frame.size}; expected {canvas}')
            frames.append(frame)
        return frames


def dimensions(source_size, output_size, outer_margin_mm, max_height_mm):
    sw, sh = source_size
    outer = output_size / 2
    margin = outer_margin_mm / DIAMETER_MM * output_size
    max_h = max_height_mm / DIAMETER_MM * output_size
    cap = outer - margin
    if cap <= max_h or max_h <= 0:
        raise ValueError('Margins leave insufficient room for the frames')
    # Fit the entire canvas into 90% of its angular sector at its inner corners.
    lo, hi = 0.0, min(max_h / sh, (cap - 1) / sh)
    sector = (2 * math.pi / N) * 0.90
    for _ in range(80):
        scale = (lo + hi) / 2
        width, height = sw * scale, sh * scale
        half_angle = math.atan2(width / 2, cap - height)
        if 2 * half_angle <= sector:
            lo = scale
        else:
            hi = scale
    width, height = max(1, int(sw * lo)), max(1, int(sh * lo))
    radius = cap - height / 2
    return width, height, radius, cap


def draw_inner_pattern(artwork, inner_limit):
    """Draw a 54-fold geometric pattern clear of the animation canvases."""
    size = artwork.width
    center = size / 2
    unit = size / 3600
    outer = inner_limit - 45 * unit
    if outer < 650 * unit:
        raise ValueError('Frames leave too little room for the inner pattern')
    layer = Image.new('RGBA', artwork.size)
    draw = ImageDraw.Draw(layer)
    green, red, gold = (42, 181, 83, 235), (221, 55, 54, 235), (247, 202, 67, 235)

    def point(radius, angle):
        angle = math.radians(angle - 90)
        return center + radius * math.cos(angle), center + radius * math.sin(angle)

    def ring(fraction, width, color):
        radius = outer * fraction
        draw.ellipse((center-radius, center-radius, center+radius, center+radius),
                     outline=color, width=max(2, round(width * unit)))

    for fraction, width, color in ((1, 13, green), (.955, 6, red),
                                   (.805, 12, gold), (.785, 6, green),
                                   (.625, 14, red), (.60, 5, gold),
                                   (.44, 13, green), (.42, 5, red),
                                   (.255, 11, gold), (.14, 9, red)):
        ring(fraction, width, color)
    for index in range(N):
        angle = index * 360 / N
        # Every ring repeats after one frame step, so it stays in place in
        # ideal 30 fps / 33⅓ RPM capture. Avoid fine radial lines.
        draw.polygon([point(outer*f, angle+a) for f, a in
                      ((.925, -2.35), (.99, 0), (.925, 2.35), (.955, 0))], fill=green)
        draw.polygon([point(outer*f, angle+a) for f, a in
                      ((.83, 0), (.865, 2.0), (.83, 4.0), (.795, 2.0))],
                     fill=red)
        draw.polygon([point(outer*f, angle+a) for f, a in
                      ((.715, -2.1), (.76, 0), (.715, 2.1), (.67, 0))], fill=green)
        draw.polygon([point(outer*f, angle+a) for f, a in
                      ((.545, 0), (.585, 2.0), (.545, 4.0), (.505, 2.0))],
                     fill=gold)
        for fraction, radius, color in ((.355, 12, green), (.185, 9, gold)):
            x, y = point(outer*fraction, angle)
            r = max(2, radius*unit)
            draw.ellipse((x-r, y-r, x+r, y+r), fill=color)
    artwork.alpha_composite(layer)


def inner_ring_dimensions(frames, size):
    """Fit a second row with visible feet just outside a 7-inch record."""
    sw, sh = frames[0].size
    edge = size * 7 / 24  # 7-inch diameter compared with a 12-inch disc.
    unit = size / 3600
    bottom = max(frame.getchannel('A').getbbox()[3] for frame in frames)
    # Keep each full canvas inside its angular sector at the inner edge.
    sector_width = 2 * edge * math.tan(math.pi / N) * .82
    scale = min(260*unit/sh, sector_width/sw)
    width, height = max(1, round(sw*scale)), max(1, round(sh*scale))
    # 12 px clearance from the 7-inch edge to the deepest visible foot.
    radius = edge + 12*unit + height*bottom/sh - height/2
    return width, height, radius, edge


def compose(frames, size, margin, max_height, rotation, proof_path=None,
            inner_pattern='none', inner_ring='none'):
    width, height, radius, cap = dimensions(frames[0].size, size, margin, max_height)
    center = size / 2
    artwork = Image.new('RGBA', (size, size), (0, 0, 0, 0))
    ImageDraw.Draw(artwork).ellipse((0, 0, size - 1, size - 1), fill=(0, 0, 0, 255))
    inner_dims = inner_ring_dimensions(frames, size) if inner_ring == 'seven-inch' else None
    if inner_pattern == 'psychedelic':
        draw_inner_pattern(artwork, inner_dims[3] - 8*size/3600 if inner_dims
                           else cap - height)
    step = 360 / N
    # Printed order is opposite the platter rotation: next pose moves into top.
    sign = -1 if rotation == 'cw' else 1
    positions = []
    for index, source in enumerate(frames):
        bearing = sign * index * step  # degrees clockwise from 12 o'clock
        theta = math.radians(-90 + bearing)
        x = center + radius * math.cos(theta)
        y = center + radius * math.sin(theta)
        resized = source.resize((width, height), Image.Resampling.LANCZOS)
        rotated = resized.rotate(-bearing, resample=Image.Resampling.BICUBIC, expand=True)
        left = round(x - rotated.width / 2)
        top = round(y - rotated.height / 2)
        artwork.alpha_composite(rotated, (left, top))
        positions.append((index + 1, bearing))
    if inner_dims:
        iw, ih, ir, edge = inner_dims
        for index, source in enumerate(frames):
            bearing = sign * index * step
            theta = math.radians(-90 + bearing)
            x = center + ir * math.cos(theta)
            y = center + ir * math.sin(theta)
            resized = source.resize((iw, ih), Image.Resampling.LANCZOS)
            rotated = resized.rotate(-bearing, resample=Image.Resampling.BICUBIC, expand=True)
            artwork.alpha_composite(rotated, (round(x-rotated.width/2),
                                              round(y-rotated.height/2)))

    # Clip to the circular print boundary after compositing.
    mask = Image.new('L', (size, size))
    ImageDraw.Draw(mask).ellipse((0, 0, size - 1, size - 1), fill=255)
    artwork.putalpha(mask)

    if proof_path:
        proof = artwork.copy()
        labels = ImageDraw.Draw(proof)
        font = ImageFont.truetype('DejaVuSans.ttf', max(12, size // 105))
        label_radius = cap - height - max(25, size // 80)
        for number, bearing in positions:
            theta = math.radians(-90 + bearing)
            point = (center + label_radius * math.cos(theta),
                     center + label_radius * math.sin(theta))
            labels.text(point, str(number), font=font, anchor='mm', fill='yellow')
        if inner_dims:
            labels.ellipse((center-edge, center-edge, center+edge, center+edge),
                           outline='yellow', width=max(2, size//900))
        proof.save(proof_path)

    return artwork, {'frames': N, 'angular_spacing_degrees': step,
                     'printed_frame_order': 'counterclockwise' if rotation == 'cw' else 'clockwise',
                     'platter_rotation': rotation, 'source_canvas': frames[0].size,
                     'rendered_canvas': [width, height], 'anchor_radius_px': radius,
                     'disc_px': size, 'outer_margin_mm': margin,
                     'inner_ring': inner_ring,
                     'seven_inch_edge_px': inner_dims[3] if inner_dims else None,
                     'inner_rendered_canvas': list(inner_dims[:2]) if inner_dims else None}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('frames_zip', type=Path)
    parser.add_argument('output', type=Path)
    parser.add_argument('--proof', type=Path)
    parser.add_argument('--size', type=int, default=3600, help='square output pixels (default: 3600)')
    parser.add_argument('--rotation', choices=('cw', 'ccw'), default='cw',
                        help='physical platter rotation viewed from above (default: cw)')
    parser.add_argument('--margin-mm', type=float, default=3.0)
    parser.add_argument('--max-height-mm', type=float, default=42.0)
    parser.add_argument('--inner-pattern', choices=('none', 'psychedelic'), default='none',
                        help='optional geometric 54-fold inner artwork')
    parser.add_argument('--inner-ring', choices=('none', 'seven-inch'), default='none',
                        help='duplicate the 54 frames with feet just outside a 7-inch record')
    args = parser.parse_args()
    try:
        if args.size < 540 or args.size > 12000:
            raise ValueError('--size must be between 540 and 12000')
        if args.margin_mm < 1 or args.max_height_mm <= 0:
            raise ValueError('Margin must be at least 1 mm; maximum height must be positive')
        if args.output == args.proof or args.output.suffix.lower() != '.png':
            raise ValueError('Output must be a PNG and differ from proof path')
        if args.proof and args.proof.suffix.lower() != '.png':
            raise ValueError('Proof must be a PNG')
        frames = read_frames(args.frames_zip)
        artwork, report = compose(frames, args.size, args.margin_mm,
                                  args.max_height_mm, args.rotation, args.proof,
                                  args.inner_pattern, args.inner_ring)
        report['inner_pattern'] = args.inner_pattern
        artwork.save(args.output)
        print(json.dumps(report, ensure_ascii=False, indent=2))
    except (ValueError, OSError, zipfile.BadZipFile) as exc:
        parser.exit(2, f'Error: {exc}\n')


if __name__ == '__main__':
    main()
