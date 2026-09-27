# Zoetrope Slipmat Maker

A deterministic compositor for a black 12-inch zoetrope slipmat. Supply 54 transparent animation frames. By default it places 54 poses in an outer ring for 33⅓ RPM and 40 poses in an inner ring for 45 RPM, both filmed at fixed 30 fps.

## Input

Create a ZIP containing `001.png` through `054.png`. Every frame needs the same transparent canvas size and consistent character placement. Draw the head toward the top and feet toward the bottom. Frame 54 should transition smoothly to frame 1.

## Run

Requires Python 3 and [Pillow](https://pypi.org/project/pillow/).

```bash
python3 -m pip install Pillow
python3 scripts/compose_slipmat.py frames.zip slipmat.png --proof proof.png
```

The default 3600 × 3600 PNG contains:

- Outer 54 positions for a clockwise 33⅓ RPM platter, numbered counterclockwise from 12 o'clock.
- Inner 40 positions at the rim of a centered 7-inch record for 45 RPM. The script samples 40 evenly spaced poses from the 54 input frames, without generating new poses. Their visible feet sit about 12 px outside the 7-inch edge.
- Reggae-color green, gold, and red geometric artwork in the center, plus concentric bands between the rows. The inner geometry has 40-fold symmetry; the bands read consistently at either speed.
- A 1 mm white pilot dot at the exact center to locate the spindle hole. The dot is smaller than the spindle and disappears when the hole is cut. It is not a hole-size outline; use the cutter or printer's hole specification. Use `--center-mark-mm 0` to omit it.

The numbered proof marks the 7-inch edge. Only the clean PNG is artwork. A real 7-inch record covers the printed pattern inside its rim. Use `--inner-ring none` or `--inner-pattern none` to disable either default. Run `--help` for other options.

The outer 54-frame timing depends on true 33⅓ RPM and constant 30 fps; the inner 40-frame timing depends on 45 RPM and constant 30 fps. The other row will not animate at its intended speed. Test a print and recording with short exposure, and check the actual record diameter and spindle hole. Obtain the print shop's hole, bleed, and color requirements before production.

For use as a ChatGPT/Codex Agent Skill, load the repository folder containing `SKILL.md`; that file invokes the included script.
