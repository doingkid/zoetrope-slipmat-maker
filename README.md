# Zoetrope Slipmat Maker

A deterministic compositor for a black 12-inch zoetrope slipmat. Supply 54 transparent animation frames; it places them in one radial ring for a clockwise 33⅓ RPM turntable filmed at a fixed 30 fps.

## Input

Create a ZIP containing `001.png` through `054.png`. Every frame needs the same transparent canvas size and consistent character placement. Draw the head toward the top and feet toward the bottom. Frame 54 should transition smoothly to frame 1.

## Run

Requires Python 3 and [Pillow](https://pypi.org/project/pillow/).

```bash
python3 -m pip install Pillow
python3 scripts/compose_slipmat.py frames.zip slipmat.png --proof proof.png
```

For a dense geometric inner design, add `--inner-pattern psychedelic`:

```bash
python3 scripts/compose_slipmat.py frames.zip slipmat.png --proof proof.png --inner-pattern psychedelic
```

The pattern uses 54-fold symmetry and adapts to the inner edge of the supplied frame canvases, leaving a small gap. The spindle area stays clear. Omit the option for the original plain black center.

The output is a 3600 × 3600 PNG: black circular disc on a transparent square. The numbered proof helps check the sequence; only the clean PNG is artwork. Run `--help` for dimensions and platter direction.

Frame 1 is at 12 o'clock. Printed frame numbers proceed counterclockwise so a clockwise platter brings frames 1, 2, 3… through the top image position. The script validates the exact 54 distinct numbers, consistent canvas dimensions, transparency, radial placement, and one shared scale. It does not generate or alter poses.

The 54-frame timing depends on true 33⅓ RPM and constant 30 fps. Test a print and recording with a short exposure. Obtain the print shop's hole, bleed, and color requirements before production.

For use as a ChatGPT/Codex Agent Skill, load the repository folder containing `SKILL.md`; that file invokes the included script.
