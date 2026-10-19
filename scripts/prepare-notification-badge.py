"""Export the official Capibora art as an Android notification badge.

Optional asset-maintenance tool: requires Pillow. Production builds use the
committed PNG and do not need Python or Pillow. Original artwork is untouched.
"""
from pathlib import Path
from PIL import Image, ImageChops, ImageFilter

root = Path(__file__).resolve().parents[1]
source = Image.open(root / 'public/mascot/neutro.png').convert('RGBA')
alpha = source.getchannel('A').point(lambda value: 255 if value >= 128 else 0)
alpha = alpha.filter(ImageFilter.MedianFilter(3))
# Preserve the original facial strokes as transparent cut-outs, not new drawing.
ink = source.convert('L').point(lambda value: 0 if value < 55 else 255)
mask = ImageChops.multiply(alpha, ink).crop(alpha.getbbox())
mask.thumbnail((80, 80), Image.Resampling.LANCZOS)
padded = Image.new('L', (96, 96), 0)
padded.paste(mask, ((96 - mask.width) // 2, (96 - mask.height) // 2))
badge = Image.new('RGBA', (96, 96), (255, 255, 255, 0))
badge.putalpha(padded)
badge.save(root / 'public/icons/notification-badge.png', optimize=True)
print('Notification badge exported: 96x96, white, transparent, official artwork')
