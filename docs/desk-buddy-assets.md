# Desk Buddy office renders

The three images in `public/images/desk-buddy` are Blender/Cycles renders of the repaired concept-04 Desk Buddy CAD assembly in a procedural corporate office setting. They are product visualizations, not photographs. The full-scale assembly retains its 123.79 mm height, curved Perch support, enclosed display head, and concealed internal cable route. The scene props are generic, unbranded models; the flexible external cable is staged toward the rear of the desk.

The screen images come from the native AMOLED firmware UI with fictional example readings. They use the same example-data approach as the [AMOLED preview assets](amoled-assets.md). No private account records, API cache values, calendar subscriptions, credentials, or browser content were used in these marketing images. Dallas is an example weather location.

| Asset | Intended use | Finish and screen | Size |
| --- | --- | --- | --- |
| `daylight.webp` | Lead project image | Matte white, Clock | 49,560 bytes |
| `workspace.webp` | Wider desk context | Matte white, Runna | 68,070 bytes |
| `executive.webp` | Alternate finish comparison | Matte graphite, Weather | 60,632 bytes |

All images retain the original 2000 × 1333 composition, with no crop or resize. They were converted from the PNG masters using Pillow WebP quality 90, method 6, in RGB without copying metadata. Each output was reopened to verify its format and dimensions, and all three were visually inspected for finish quality, screen detail, and composition. The combined payload is 178,262 bytes, approximately 97% smaller than the PNG masters. Responsive delivery can use the site's existing Next.js image optimization.

Use a visible attribution such as **“CAD renders · Example screen data”** near the gallery. Describe matte white and graphite as rendered finish concepts; the images do not establish physical print quality, paint quality, or fit. The lead image is matte white, consistent with the selected product presentation. Retain the broader context views in the gallery rather than enlarging only the screen.

The source files are in the sibling `amoled-dashboard-216` repository under `hardware/desk-buddy/lifestyle/desk-buddy-{daylight,workspace,executive}.png`. Their JSON sidecars record CAD mesh, source renderer, and native screen texture hashes. That directory's `verification.json` confirms that all 24 CAD meshes and local transforms match the source assembly, the assembly remains at scale 1, and all used image textures are packed in the editable Blender scenes. The [web asset manifest](desk-buddy-assets-manifest.json) records the source checksums, verified CAD and texture provenance, conversion settings, output checksums, and dimensions.

To reproduce the WebP conversion from the website root with the source workspace installed:

```sh
python3 - <<'PY'
from pathlib import Path
from PIL import Image

source = Path('../amoled-dashboard-216/hardware/desk-buddy/lifestyle')
target = Path('public/images/desk-buddy')
target.mkdir(parents=True, exist_ok=True)
for scene in ('daylight', 'workspace', 'executive'):
    image = Image.open(source / f'desk-buddy-{scene}.png').convert('RGB')
    image.save(target / f'{scene}.webp', format='WEBP', quality=90, method=6)
PY
```

Rebuild and review the manifest whenever either source art or conversion settings change. Source render reproduction and the editable scene download are documented in the hardware repository's lifestyle README.
