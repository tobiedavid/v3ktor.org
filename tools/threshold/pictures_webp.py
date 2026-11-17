"""Threshold Log: the page pictures from tools/threshold/pictures.js, into threshold/img/ as WebP (quality 80).
Only a picture that changed is written: one whose pixels differ from the one there by more than 1 on average (PNG to WebP alone moves
them by less than that). Needs Pillow.   python3 tools/threshold/pictures_webp.py <folder with the PNGs>"""
import sys, os
from PIL import Image, ImageChops, ImageStat
SRC = sys.argv[1]; IMG = os.path.join(os.path.dirname(__file__), '..', '..', 'threshold', 'img')
for n in ['bars', 'home', 'nutrition', 'step']:
    for l in ['en', 'fr']:
        new = Image.open(os.path.join(SRC, f'{n}-{l}.png')).convert('RGB'); p = os.path.join(IMG, f'{n}-{l}.webp')
        old = Image.open(p).convert('RGB') if os.path.exists(p) else None
        d = 999 if old is None or old.size != new.size else sum(ImageStat.Stat(ImageChops.difference(old, new)).mean) / 3
        if d > 1: new.save(p, 'WEBP', quality=80, method=6)
        print(f'{n}-{l}: ' + ('written' if d > 1 else 'unchanged') + f' (difference {d:.2f})')
