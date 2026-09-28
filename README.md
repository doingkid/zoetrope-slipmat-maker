# Zoetrope Slipmat Maker

A deterministic compositor for a black 12-inch zoetrope slipmat. Supply 54 transparent animation frames. By default it places 54 poses in an outer ring for 33⅓ RPM and 40 poses in an inner ring for 45 RPM, both filmed at fixed 30 fps.

## Browser app

The mobile-friendly app in [`docs/`](docs/) runs entirely in the browser. It can make 54 frames from one image using whole-character sway/bounce motion, or read a ZIP of 54 transparent PNGs for a real pose-by-pose animation. Choose each ring's RPM, pattern theme, and background, view a simulated 30 fps rotating disc with an optional 7-inch record overlay, and download the 3600 × 3600 PNG, numbered proof, or frame ZIP. The initial settings match the Python script.

To host it for free, enable GitHub Pages in repository Settings → Pages, choose **Deploy from a branch**, `main`, `/docs`. No server, account, image API, or build step is needed for visitors. For local development, run `python3 -m http.server 8000 --directory docs` and visit `http://localhost:8000`. Newer Safari/Chrome is needed to extract compressed ZIPs. One-image motion transforms the entire picture; it does not separately animate its arms or legs. The preview samples an ideal 30 fps camera and cannot reproduce exposure blur, lighting, or actual platter-speed error. Browser image composition is a JavaScript port of the Python renderer, so check a final print with the desired source before production.

## Input

Create a ZIP containing `001.png` through `054.png`. Every frame needs the same transparent canvas size and consistent character placement. Draw the head toward the top and feet toward the bottom. Frame 54 should transition smoothly to frame 1.

## Run

Requires Python 3 and [Pillow](https://pypi.org/project/pillow/).

```bash
python3 -m pip install Pillow
python3 scripts/compose_slipmat.py frames.zip slipmat.png --proof proof.png
```

For an ink-saving home-printer test, use a white background. This produces an opaque white square with a thin black 12-inch circle outline and a black center pilot dot; the character frames and colored pattern remain in place:

```bash
python3 scripts/compose_slipmat.py frames.zip slipmat_white.png --proof proof_white.png --background white
```

Print at 100% size (304.8 mm circle diameter). The center dot marks the hole location, not the hole diameter. The white version is useful for alignment and animation tests; check character contrast before choosing it as final artwork.

The default 3600 × 3600 PNG contains:

- Outer 54 positions for a clockwise 33⅓ RPM platter, numbered counterclockwise from 12 o'clock.
- Inner 40 positions at the rim of a centered 7-inch record for 45 RPM. The script samples 40 evenly spaced poses from the 54 input frames, without generating new poses. Their visible feet sit about 12 px outside the 7-inch edge.
- Reggae-color green, gold, and red geometric artwork in the center, plus concentric bands between the rows. The inner geometry has 40-fold symmetry; the bands read consistently at either speed.
- A 1 mm white pilot dot at the exact center to locate the spindle hole. The dot is smaller than the spindle and disappears when the hole is cut. It is not a hole-size outline; use the cutter or printer's hole specification. Use `--center-mark-mm 0` to omit it.

The numbered proof marks the 7-inch edge. Only the clean PNG is artwork. A real 7-inch record covers the printed pattern inside its rim. Use `--inner-ring none` or `--inner-pattern none` to disable either default. Run `--help` for other options.

Choose each row's recording speed independently. At fixed 30 fps, `33.33` selects 54 positions (physical 33⅓ RPM) and `45` selects 40 positions. The ZIP still contains 54 frames; a 40-position row evenly samples the 54-pose cycle. The default remains outer 33⅓ RPM and inner 45 RPM.

```bash
python3 scripts/compose_slipmat.py frames.zip swapped.png --outer-rpm 45 --inner-rpm 33.33
python3 scripts/compose_slipmat.py frames.zip neon.png --theme neon
```

`--theme` offers `reggae` (default), `neon`, `ocean`, `sunset`, and `monochrome`. The theme changes the center geometry and the colored bands between rows; `--inner-pattern none` removes both. When both rows select the same speed, they animate together; when their speeds differ, only the matching row animates as intended at a given platter speed. The inner 33⅓ RPM setting fits 54 smaller poses outside the 7-inch rim.

The timing assumes true 33⅓ or 45 RPM and constant 30 fps. Test a print and recording with short exposure, and check the actual record diameter and spindle hole. Obtain the print shop's hole, bleed, and color requirements before production.
