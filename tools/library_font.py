"""Builds the Library's own copy of Inter, so every screen draws its words (and the labels in its pictures) in the same
font the screen tests measure, whatever font the reader's system would otherwise pick.

  python3 tools/library_font.py [/path/to/inter/otf/folder]

Run it again when a card brings a character outside the ranges below; the script adds every character index.html
uses. Source: Inter 4.0 by The Inter Project Authors (https://github.com/rsms/inter), SIL Open Font
License 1.1, no reserved font name; the OTF files come from the Debian/Ubuntu package fonts-inter (4.0+ds-1). The output
keeps three weights (400 text, 600 bold labels, 700 tokens and buttons; 800 falls back to 700), Inter's default
features (kerning among them, so widths match the installed font), and these characters: basic Latin, Latin-1, Latin
Extended-A, the Greek alphabet, punctuation, super- and subscripts, currency, fractions, and every other character
library/app/index.html uses that Inter has. Characters Inter doesn't have (☰ ✕ ⋮ ⋯) still come from the system font.
The files are WOFF (zlib), since this machine has no Brotli for WOFF2. Needs fontTools (pip install fonttools).
The licence travels with the files as library/app/fonts/OFL.txt.
"""
import os, re, sys
from fontTools import subset

HERE = os.path.dirname(os.path.abspath(__file__))
APP = os.path.join(HERE, '..', 'library', 'app')
RANGES = [(0x20, 0x7e), (0xa0, 0xff), (0x100, 0x17f), (0x391, 0x3c9), (0x2000, 0x206f), (0x2070, 0x209f), (0x20a0, 0x20cf),
          (0x2150, 0x218f)]
WEIGHTS = ['Regular', 'SemiBold', 'Bold']

def used():
    h = open(os.path.join(APP, 'index.html'), encoding='utf8').read()
    h = re.sub(r'\\u([0-9a-fA-F]{4})', lambda m: chr(int(m.group(1), 16)), h)
    return {ord(c) for c in h if ord(c) >= 0x20}

def main(src):
    out = os.path.join(APP, 'fonts'); os.makedirs(out, exist_ok=True)
    unicodes = sorted({c for a, b in RANGES for c in range(a, b + 1)} | used())
    for name in WEIGHTS:
        opts = subset.Options(); opts.flavor = 'woff'
        font = subset.load_font(os.path.join(src, f'Inter-{name}.otf'), opts)
        sub = subset.Subsetter(opts); sub.populate(unicodes=unicodes); sub.subset(font)
        dest = os.path.join(out, f'Inter-{name}.woff'); subset.save_font(font, dest, opts)
        print(os.path.relpath(dest), os.path.getsize(dest), 'bytes')

if __name__ == '__main__':
    main(sys.argv[1] if len(sys.argv) > 1 else '/usr/share/fonts/opentype/inter')
