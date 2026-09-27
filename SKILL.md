---
name: zoetrope-slipmat-maker
description: Compose 54 transparent animation frames into a black 12-inch zoetrope slipmat with 54 outer poses for 33⅓ RPM and 40 inner poses for 45 RPM at 30 fps.
---

# Zoetrope Slipmat Maker

Create the disc with `scripts/compose_slipmat.py`. Do not use an image generator to place or redraw frames.

## Inputs and defaults

- Accept one ZIP containing `001.png` through `054.png` (a single enclosing folder is fine). Each image must have transparency, the same canvas dimensions, and a consistent character position within that canvas. Top is head, bottom is feet. Preserve transparent padding and the authored baseline.
- Default to a 12-inch (304.8 mm) circular black disc, 3600 × 3600 px, clockwise platter rotation viewed from above, fixed 30 fps capture. The outer row has 54 positions for 33⅓ RPM. The inner row samples 40 poses from the supplied 54 at equal time intervals for 45 RPM, with visible feet just outside the 7-inch record edge. Each row's printed positions progress **counterclockwise** for a clockwise platter.
- Figures face radially: head outward, feet inward. The script preserves source artwork and uses a consistent scale within each row. Its default reggae-color geometric pattern uses 40-fold symmetry inside the 7-inch radius and circular bands between rows. A real 7-inch record covers the inner printed pattern.

## Run

```bash
python3 scripts/compose_slipmat.py frames.zip slipmat.png --proof proof.png
```

Requires Pillow (`python3 -m pip install Pillow` if missing). Use `--size` to override 3600 px, `--rotation ccw` only when the platter truly turns counterclockwise. The two rows and pattern are enabled by default. Use `--help` for other options.

Check the script's validation report and view the clean PNG and numbered proof. Deliver the clean PNG and optionally the proof. If the ZIP has wrong/missing/duplicate numbers, mismatched canvases, opaque images, or no visible content, identify the issue and request corrected source frames. Confirm visual legibility with the actual print and camera setup before production.

## Capture and production limits

The outer 54-frame relationship assumes exactly 30 captured frames per second and exactly 33⅓ RPM; the inner 40-frame relationship assumes exactly 30 fps and 45 RPM. Auto frame-rate changes, 29.97 fps, speed drift, long exposure, rolling shutter, and lighting can produce drift or blur. Use fixed 30 fps and a sufficiently short exposure. The layout animates at a fixed image location in the recorded video; it need not animate to the unaided eye under steady light.

The PNG is circular artwork on a transparent square. It has no printed center-hole mark: apply the print shop's spindle-hole, bleed, color profile, and safe-area template before calling it press-ready.
