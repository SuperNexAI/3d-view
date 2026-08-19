#!/usr/bin/env python3
import sys
import zipfile

CANDIDATES = [
    'Auxiliaries/.thumbnails/thumbnail_3mf.png',
    'Auxiliaries/.thumbnails/thumbnail_middle.png',
    'Auxiliaries/.thumbnails/thumbnail_small.png',
    'Metadata/plate_1.png',
    'Metadata/plate_1_small.png',
    'Metadata/top_1.png',
    'Metadata/plate_no_light_1.png',
    'Metadata/pick_1.png',
]


def main():
    if len(sys.argv) != 3:
        print('usage: extract_thumb.py <input.3mf> <output.png>', file=sys.stderr)
        return 2
    src, dst = sys.argv[1], sys.argv[2]
    try:
        with zipfile.ZipFile(src) as z:
            for name in CANDIDATES:
                try:
                    data = z.read(name)
                except KeyError:
                    continue
                if data:
                    with open(dst, 'wb') as f:
                        f.write(data)
                    return 0
        return 1
    except Exception as e:
        print(str(e), file=sys.stderr)
        return 1


if __name__ == '__main__':
    sys.exit(main())
