---
name: zoetrope-slipmat-maker
description: Compose 54 numbered transparent animation frames from a ZIP into a black radial 12-inch zoetrope slipmat PNG. Use when asked to lay out, make, or check a 33⅓ RPM slipmat for 30 fps video capture; preserve supplied artwork rather than generating new frames.
---

# Zoetrope Slipmat Maker

Create the disc with `scripts/compose_slipmat.py`. Do not use an image generator to place or redraw frames.

## Inputs and defaults

- Accept one ZIP containing `001.png` through `054.png` (a single enclosing folder is fine). Each image must have transparency, the same canvas dimensions, and a consistent character position within that canvas. Top is head, bottom is feet. Preserve transparent padding and the authored baseline.
- Default to a 12-inch (304.8 mm) circular black disc, 3600 × 3600 px, clockwise platter rotation viewed from above, 33⅓ RPM and fixed 30 fps capture. There are 54 equally spaced positions (6⅔°). Frame 1 sits at 12 o'clock. Printed frame numbers increase **counterclockwise** so that a clockwise platter brings frames 1, 2, 3… through the top viewing position. Reverse the spatial sequence for a counterclockwise platter.
- Figures face radially: head outward, feet inward. The script preserves aspect ratio, uses one shared scale, fits all within an outer margin, and prevents adjacent frame canvases from touching. Never duplicate, invent, trim, or change individual frames.

## Run

```bash
python3 scripts/compose_slipmat.py frames.zip slipmat.png --proof proof.png
```

Requires Pillow (`python3 -m pip install Pillow` if missing). Use `--size` to override 3600 px, `--rotation ccw` only when the platter truly turns counterclockwise. Use `--help` for other options.

Check the script's validation report and view the clean PNG and numbered proof. Deliver the clean PNG and optionally the proof. If the ZIP has wrong/missing/duplicate numbers, mismatched canvases, opaque images, or no visible content, identify the issue and request corrected source frames. Confirm visual legibility with the actual print and camera setup before production.

## Capture and production limits

The 54-frame relationship assumes exactly 30 captured frames per second and exactly 33⅓ RPM. Auto frame-rate changes, 29.97 fps, speed drift, long exposure, rolling shutter, and lighting can produce drift or blur. Use fixed 30 fps and a sufficiently short exposure. The layout animates at a fixed image location in the recorded video; it need not animate to the unaided eye under steady light.

The PNG is circular artwork on a transparent square. It has no printed center-hole mark: apply the print shop's spindle-hole, bleed, color profile, and safe-area template before calling it press-ready.
