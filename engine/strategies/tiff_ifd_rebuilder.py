import os
import struct
from typing import Dict, Any, Optional, List, Tuple

from .base import BaseStrategy

# TIFF Tag IDs we care about for repairing a broken RAW
TAG_STRIP_OFFSETS = 0x0111       # StripOffsets
TAG_STRIP_BYTE_COUNTS = 0x0117   # StripByteCounts
TAG_TILE_OFFSETS = 0x0144        # TileOffsets
TAG_TILE_BYTE_COUNTS = 0x0145    # TileByteCounts
TAG_SUBFILE_TYPE = 0x00FE        # NewSubfileType (0 = full, 1 = thumbnail)

# TIFF type sizes in bytes
TYPE_SIZES = {1: 1, 2: 1, 3: 2, 4: 4, 5: 8, 6: 1, 7: 1, 8: 2, 9: 4, 10: 8, 11: 4, 12: 8}


def _struct_fmt(byte_order: str, fmt: str) -> str:
    return ('<' if byte_order == 'LE' else '>') + fmt


def _read_u16(data: bytes, offset: int, byte_order: str) -> int:
    fmt = _struct_fmt(byte_order, 'H')
    return struct.unpack_from(fmt, data, offset)[0]


def _read_u32(data: bytes, offset: int, byte_order: str) -> int:
    fmt = _struct_fmt(byte_order, 'I')
    return struct.unpack_from(fmt, data, offset)[0]


def _write_u32(value: int, byte_order: str) -> bytes:
    fmt = _struct_fmt(byte_order, 'I')
    return struct.pack(fmt, value)


def _detect_byte_order(data: bytes) -> Optional[str]:
    if len(data) < 4:
        return None
    mark = data[0:2]
    if mark == b'II':
        return 'LE'
    if mark == b'MM':
        return 'BE'
    return None


def _read_ifd_entries(data: bytes, ifd_offset: int, byte_order: str) -> List[Dict]:
    """Read all IFD entries at a given offset. Returns list of entry dicts."""
    entries = []
    if ifd_offset + 2 > len(data):
        return entries

    count = _read_u16(data, ifd_offset, byte_order)
    for i in range(count):
        base = ifd_offset + 2 + i * 12
        if base + 12 > len(data):
            break
        tag = _read_u16(data, base, byte_order)
        field_type = _read_u16(data, base + 2, byte_order)
        field_count = _read_u32(data, base + 4, byte_order)
        value_offset = _read_u32(data, base + 8, byte_order)
        entries.append({
            'tag': tag,
            'type': field_type,
            'count': field_count,
            'value_offset': value_offset,
            'entry_offset': base
        })
    return entries


def _get_entry_values(data: bytes, entry: Dict, byte_order: str) -> List[int]:
    """Read the actual integer values for an IFD entry (handles both inline and offset)."""
    field_type = entry['type']
    count = entry['count']
    type_size = TYPE_SIZES.get(field_type, 1)
    total = type_size * count

    if total <= 4:
        # Values are stored inline in the value_offset field
        raw = struct.pack('>I', entry['value_offset']) if byte_order == 'BE' else struct.pack('<I', entry['value_offset'])
        raw = raw[:total]
    else:
        offset = entry['value_offset']
        if offset + total > len(data):
            return []
        raw = data[offset: offset + total]

    fmt_char = {1: 'B', 2: 'B', 3: 'H', 4: 'I', 5: 'I'}
    fc = ('<' if byte_order == 'LE' else '>') + fmt_char.get(field_type, 'B') * count
    try:
        return list(struct.unpack(fc, raw[:count * type_size]))
    except struct.error:
        return []


class TiffIfdRebuilderStrategy(BaseStrategy):
    @property
    def name(self) -> str:
        return "tiff-ifd-rebuilder"

    @property
    def requires_reference(self) -> bool:
        return True

    def can_repair(self, analysis_result: Dict[str, Any]) -> bool:
        corruptions = analysis_result.get('corruptionTypes', [])
        return any(c in corruptions for c in ['tiff_cyclic_ifd', 'tiff_invalid_offset'])

    def repair(
        self,
        input_path: str,
        output_path: str,
        reference_path: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        TIFF IFD rebuilder strategy.

        Core idea: a RAW/TIFF file's IFD directory acts as a table of contents. 
        When offsets to the sensor data are broken (pointing outside the file, 
        or cyclic), the image can't be decoded. If we have a reference file from
        the same camera model, its IFD entries (specifically strip/tile offsets
        and byte counts) can be transplanted into the corrupted file—but only
        if the actual raw sensor data bytes in the corrupted file are still intact
        at their original positions.

        Strategy:
        1. Read corrupted file's byte order and size.
        2. Identify the full-resolution IFD in the reference file.
        3. Copy the corrupted file's bytes as-is into the output.
        4. Overwrite just the IFD directory bytes from the reference into output,
           fixing all pointer chains without touching any sensor data.
        """
        if not os.path.exists(input_path):
            raise FileNotFoundError(f"Input file not found: {input_path}")
        if not reference_path or not os.path.exists(reference_path):
            return {"success": False, "error": "A reference RAW file from the same camera is required for IFD rebuilding."}

        with open(input_path, 'rb') as f:
            corrupted = bytearray(f.read())
        with open(reference_path, 'rb') as f:
            reference = f.read()

        byte_order = _detect_byte_order(corrupted)
        ref_byte_order = _detect_byte_order(reference)
        if not byte_order or not ref_byte_order:
            return {"success": False, "error": "Could not detect byte order. Files may not be valid TIFF/RAW."}

        # Find the first IFD offset in the reference
        ref_ifd_offset = _read_u32(reference, 4, ref_byte_order)

        # Walk reference IFDs to find the full-resolution one (SubfileType == 0)
        full_res_ifd_offset = ref_ifd_offset
        visited = set()
        next_offset = ref_ifd_offset
        while next_offset and next_offset not in visited and next_offset + 2 <= len(reference):
            visited.add(next_offset)
            entries = _read_ifd_entries(reference, next_offset, ref_byte_order)
            subfile_entry = next((e for e in entries if e['tag'] == TAG_SUBFILE_TYPE), None)
            if subfile_entry:
                vals = _get_entry_values(reference, subfile_entry, ref_byte_order)
                if vals and vals[0] == 0:
                    full_res_ifd_offset = next_offset
                    break
            # Move to next IFD
            count = _read_u16(reference, next_offset, ref_byte_order)
            next_link_offset = next_offset + 2 + count * 12
            next_offset = _read_u32(reference, next_link_offset, ref_byte_order)

        ref_entries = _read_ifd_entries(reference, full_res_ifd_offset, ref_byte_order)
        ref_count = _read_u16(reference, full_res_ifd_offset, ref_byte_order)

        # Find the same IFD in the corrupted file (same relative location)
        # We use the first IFD offset from the corrupted file
        if len(corrupted) < 8:
            return {"success": False, "error": "Corrupted file too small to be a valid TIFF."}

        corrupt_ifd_offset = _read_u32(bytes(corrupted), 4, byte_order)
        if corrupt_ifd_offset + 2 + ref_count * 12 > len(corrupted):
            # Corrupted IFD offset is completely invalid. Use reference IFD offset.
            corrupt_ifd_offset = full_res_ifd_offset
            # Write the new IFD offset into the header
            new_offset_bytes = _write_u32(corrupt_ifd_offset, byte_order)
            corrupted[4:8] = new_offset_bytes

        # Patch: overwrite the IFD directory block from reference into corrupted output
        # Only overwrite the IFD directory bytes, leaving all actual sensor data intact.
        ifd_block_size = 2 + ref_count * 12 + 4  # count + entries + next_ifd_pointer
        ref_ifd_block = reference[full_res_ifd_offset: full_res_ifd_offset + ifd_block_size]

        # Make room if needed, otherwise patch in-place
        if corrupt_ifd_offset + ifd_block_size <= len(corrupted):
            corrupted[corrupt_ifd_offset: corrupt_ifd_offset + ifd_block_size] = ref_ifd_block
        else:
            # Append at end and update header pointer
            new_ifd_offset = len(corrupted)
            corrupted.extend(ref_ifd_block)
            new_offset_bytes = _write_u32(new_ifd_offset, byte_order)
            corrupted[4:8] = new_offset_bytes

        with open(output_path, 'wb') as f:
            f.write(corrupted)

        return {
            "success": True,
            "output_path": output_path,
            "ifd_entries_patched": ref_count,
            "method": "ifd_transplant"
        }
