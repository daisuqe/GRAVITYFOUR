"""Minimal RGB PSD layer reader for the 16 x 16 character source."""

from pathlib import Path
import hashlib
import struct
import zlib


class Reader:
    def __init__(self, raw):
        self.raw = raw
        self.pos = 0

    def take(self, size):
        chunk = self.raw[self.pos:self.pos + size]
        if len(chunk) != size:
            raise ValueError("Unexpected end of PSD")
        self.pos += size
        return chunk

    def number(self, fmt):
        return struct.unpack(">" + fmt, self.take(struct.calcsize(">" + fmt)))[0]


def decode_packbits(raw, width):
    out = bytearray()
    offset = 0
    while offset < len(raw):
        run = struct.unpack("b", raw[offset:offset + 1])[0]
        offset += 1
        if run >= 0:
            out.extend(raw[offset:offset + run + 1])
            offset += run + 1
        elif run != -128:
            out.extend(raw[offset:offset + 1] * (1 - run))
            offset += 1
    if len(out) != width:
        raise ValueError("Invalid PSD RLE row")
    return bytes(out)


def channel_pixels(raw, width, height):
    compression = struct.unpack_from(">H", raw)[0]
    content = raw[2:]
    if compression == 0:
        pixels = content
    elif compression == 1:
        row_sizes = struct.unpack_from(">" + "H" * height, content)
        offset = height * 2
        rows = []
        for size in row_sizes:
            rows.append(decode_packbits(content[offset:offset + size], width))
            offset += size
        pixels = b"".join(rows)
    elif compression in (2, 3):
        pixels = zlib.decompress(content)
        if compression == 3:
            decoded = bytearray(pixels)
            for row in range(height):
                start = row * width
                for x in range(1, width):
                    decoded[start + x] = (decoded[start + x] + decoded[start + x - 1]) & 255
            pixels = bytes(decoded)
    else:
        raise ValueError("Unsupported PSD compression: " + str(compression))
    if len(pixels) != width * height:
        raise ValueError("Invalid PSD channel size")
    return pixels


def load_psd(path):
    source = Path(path)
    r = Reader(source.read_bytes())
    if r.take(4) != b"8BPS" or r.number("H") != 1:
        raise ValueError("Expected a PSD file")
    r.take(6)
    channels = r.number("H")
    height, width = r.number("I"), r.number("I")
    depth, mode = r.number("H"), r.number("H")
    if depth != 8 or mode != 3:
        raise ValueError("Expected 8-bit RGB PSD")
    for _ in range(2):
        r.take(r.number("I"))
    section_size = r.number("I")
    section_end = r.pos + section_size
    layer_size = r.number("I")
    layer_end = r.pos + layer_size
    count = abs(r.number("h"))
    layers = []
    for index in range(count):
        top, left, bottom, right = (r.number("i") for _ in range(4))
        channel_specs = [(r.number("h"), r.number("I")) for _ in range(r.number("H"))]
        if r.take(4) != b"8BIM":
            raise ValueError("Invalid blend header")
        r.take(4)
        opacity, clipping, flags, filler = (r.number("B") for _ in range(4))
        extra_size = r.number("I")
        extra_end = r.pos + extra_size
        r.take(r.number("I"))
        r.take(r.number("I"))
        name_size = r.number("B")
        name = r.take(name_size).decode("mac_roman", "replace")
        r.take((4 - (name_size + 1) % 4) % 4)
        group_type = 0
        while r.pos < extra_end:
            signature, key, size = r.take(4), r.take(4), r.number("I")
            if signature not in (b"8BIM", b"8B64"):
                raise ValueError("Invalid layer extra")
            content = r.take(size)
            if size & 1:
                r.take(1)
            if key == b"luni":
                length = struct.unpack_from(">I", content)[0]
                name = content[4:4 + length * 2].decode("utf-16-be")
            elif key == b"lsct":
                group_type = struct.unpack_from(">I", content)[0]
        if r.pos != extra_end:
            raise ValueError(f"Invalid layer extra length at {index}: {r.pos} vs {extra_end}")
        layers.append({
            "index": index, "name": name, "group_type": group_type,
            "box": (left, top, right, bottom), "channels": channel_specs,
            "flags": flags, "opacity": opacity, "pixels": {},
        })
    for layer in layers:
        left, top, right, bottom = layer["box"]
        w, h = right - left, bottom - top
        for channel_id, length in layer["channels"]:
            raw = r.take(length)
            if w > 0 and h > 0:
                layer["pixels"][channel_id] = channel_pixels(raw, w, h)
    if r.pos != layer_end:
        if layer_end - r.pos == 1:
            r.take(1)
        else:
            raise ValueError(f"Invalid layer data length: {r.pos} vs {layer_end}")
    if section_end < r.pos:
        raise ValueError("Invalid layer section")
    return {"width": width, "height": height, "channels": channels,
            "sha256": hashlib.sha256(source.read_bytes()).hexdigest(), "layers": layers}


def rgba_pixels(psd, layer):
    """Return full-canvas RGBA bytes for a layer."""
    width, height = psd["width"], psd["height"]
    output = bytearray(width * height * 4)
    left, top, right, bottom = layer["box"]
    w = right - left
    channels = layer["pixels"]
    if w <= 0 or bottom <= top:
        return bytes(output)
    for y in range(bottom - top):
        for x in range(w):
            source = y * w + x
            target = ((top + y) * width + left + x) * 4
            if not (0 <= top + y < height and 0 <= left + x < width):
                continue
            output[target:target + 4] = bytes((
                channels.get(0, b"\0" * (w * (bottom - top)))[source],
                channels.get(1, b"\0" * (w * (bottom - top)))[source],
                channels.get(2, b"\0" * (w * (bottom - top)))[source],
                channels.get(-1, b"\xff" * (w * (bottom - top)))[source],
            ))
    return bytes(output)


def groups(psd):
    """Photoshop stores a group's closing marker above its children."""
    result = {}
    marker = -1
    for index, layer in enumerate(psd["layers"]):
        if layer["group_type"] == 3:
            marker = index
        elif layer["group_type"] in (1, 2):
            result[layer["name"]] = [
                child for child in psd["layers"][marker + 1:index]
                if child["group_type"] == 0
            ]
    return result


def palette(psd, name):
    layer = next(item for item in psd["layers"] if item["name"] == name)
    rgba = rgba_pixels(psd, layer)
    colors = []
    for index in range(psd["width"] * psd["height"]):
        red, green, blue, alpha = rgba[index * 4:index * 4 + 4]
        color = (red, green, blue)
        if alpha and color not in colors:
            colors.append(color)
    return colors


if __name__ == "__main__":
    import json
    import sys
    psd = load_psd(sys.argv[1])
    print("canvas", psd["width"], psd["height"], "layers", len(psd["layers"]), "sha256", psd["sha256"])
    for name, entries in groups(psd).items():
        hashes = [hashlib.sha256(rgba_pixels(psd, entry)).hexdigest() for entry in entries]
        print(name, "layers", len(entries), "unique images", len(set(hashes)),
              "names", json.dumps([entry["name"] for entry in entries], ensure_ascii=True))
    for name in ("hair color", "cloth color", "skin color"):
        print(name, json.dumps(palette(psd, name)))
