import os
import struct
from typing import Dict, Any, Optional, List, Tuple

from .base import BaseStrategy


def _read_boxes(data: bytes) -> List[Dict[str, Any]]:
    """Walk a flat sequence of ISOBMFF boxes and return a list of dicts."""
    boxes = []
    offset = 0
    while offset + 8 <= len(data):
        size = struct.unpack_from('>I', data, offset)[0]
        if size < 8 or offset + size > len(data):
            break
        box_type = data[offset + 4: offset + 8].decode('latin-1')
        payload = data[offset + 8: offset + size]
        boxes.append({
            'type': box_type,
            'size': size,
            'offset': offset,
            'payload': payload
        })
        offset += size
    return boxes


def _find_box(boxes: List[Dict], box_type: str) -> Optional[Dict]:
    return next((b for b in boxes if b['type'] == box_type), None)


class HeicBoxRecoveryStrategy(BaseStrategy):
    @property
    def name(self) -> str:
        return "heic-box-recovery"

    @property
    def requires_reference(self) -> bool:
        return True  # We need a healthy HEIC shell to transplant the mdat payload into

    def can_repair(self, analysis_result: Dict[str, Any]) -> bool:
        corruptions = analysis_result.get('corruptionTypes', [])
        return any(c in corruptions for c in ['heic_missing_meta', 'heic_broken_mdat'])

    def repair(
        self,
        input_path: str,
        output_path: str,
        reference_path: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        Strategy: Extract the raw `mdat` payload from the corrupted HEIC, then
        transplant it into a healthy reference HEIC container. This preserves the
        HEVC bitstream (actual image data) while the ISO container metadata
        comes from a known-good reference shot on the same device model.

        If no reference is available, we attempt to rebuild minimum viable
        top-level boxes (ftyp + mdat) as a best-effort recovery.
        """
        if not os.path.exists(input_path):
            raise FileNotFoundError(f"Input file not found: {input_path}")

        with open(input_path, 'rb') as f:
            corrupted_data = f.read()

        corrupted_boxes = _read_boxes(corrupted_data)
        corrupted_mdat = _find_box(corrupted_boxes, 'mdat')

        if not corrupted_mdat:
            return {"success": False, "error": "No mdat box found in corrupted file. Cannot recover image payload."}

        mdat_payload = corrupted_mdat['payload']

        # --- Strategy A: Transplant into reference shell ---
        if reference_path and os.path.exists(reference_path):
            with open(reference_path, 'rb') as f:
                reference_data = f.read()

            ref_boxes = _read_boxes(reference_data)
            ref_mdat = _find_box(ref_boxes, 'mdat')

            if not ref_mdat:
                return {"success": False, "error": "Reference file has no mdat box."}

            # Build the output: copy all reference boxes, but replace mdat payload with corrupted file's payload
            out = bytearray()
            for box in ref_boxes:
                if box['type'] == 'mdat':
                    new_size = 8 + len(mdat_payload)
                    out += struct.pack('>I', new_size)
                    out += b'mdat'
                    out += mdat_payload
                else:
                    # Rebuild item location offsets would need a full iloc rewriter — that's Phase 4 depth.
                    # For now, copy the reference container metadata as-is with our transplanted payload.
                    out += struct.pack('>I', box['size'])
                    out += box['type'].encode('latin-1')
                    out += box['payload']

            with open(output_path, 'wb') as f:
                f.write(out)

            return {
                "success": True,
                "output_path": output_path,
                "mdat_bytes_recovered": len(mdat_payload),
                "method": "transplant"
            }

        # --- Strategy B: Best-effort minimal container (no reference) ---
        # Build: ftyp + mdat only. The file may not open in all viewers but
        # will preserve the raw HEVC bitstream for forensic extraction.
        ftyp_payload = (
            b'heic'   # major brand
            + b'\x00\x00\x00\x00'  # minor version
            + b'mif1'  # compatible brand
            + b'heic'  # compatible brand
        )
        ftyp_box = struct.pack('>I', 8 + len(ftyp_payload)) + b'ftyp' + ftyp_payload
        mdat_box = struct.pack('>I', 8 + len(mdat_payload)) + b'mdat' + mdat_payload

        with open(output_path, 'wb') as f:
            f.write(ftyp_box)
            f.write(mdat_box)

        return {
            "success": True,
            "output_path": output_path,
            "mdat_bytes_recovered": len(mdat_payload),
            "method": "minimal_container"
        }
