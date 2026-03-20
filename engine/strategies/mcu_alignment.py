from typing import Dict, Any, Optional
import os
from .base import BaseStrategy

class McuAlignmentStrategy(BaseStrategy):
    @property
    def name(self) -> str:
        return "mcu-alignment"
        
    @property
    def requires_reference(self) -> bool:
        return True
        
    def can_repair(self, analysis_result: Dict[str, Any]) -> bool:
        # Assuming we check for mcu misalignment flag
        corruption_types = analysis_result.get("corruptionTypes", [])
        return "mcu_misalignment" in corruption_types

    def _find_sos_offset(self, data: bytes) -> int:
        offset = 0
        while offset < len(data) - 1:
            if data[offset] == 0xFF and data[offset+1] == 0xDA:
                # SOS marker length
                if offset + 3 < len(data):
                    length = (data[offset+2] << 8) | data[offset+3]
                    return offset + 2 + length
            offset += 1
        return -1

    def _find_first_rst_marker(self, data: bytes, start_offset: int) -> int:
        offset = start_offset
        while offset < len(data) - 1:
            if data[offset] == 0xFF and 0xD0 <= data[offset+1] <= 0xD7:
                return offset
            offset += 1
        return -1

    def repair(self, input_path: str, output_path: str, reference_path: Optional[str] = None) -> Dict[str, Any]:
        if not reference_path or not os.path.exists(reference_path):
            return {"success": False, "error": "Reference file missing or invalid"}

        with open(input_path, "rb") as f:
            corrupt_data = f.read()

        with open(reference_path, "rb") as f:
            ref_data = f.read()

        corrupt_sos = self._find_sos_offset(corrupt_data)
        ref_sos = self._find_sos_offset(ref_data)

        if corrupt_sos == -1 or ref_sos == -1:
            return {"success": False, "error": "Could not find SOS marker"}

        # Find first RST marker in both
        corrupt_rst = self._find_first_rst_marker(corrupt_data, corrupt_sos)
        ref_rst = self._find_first_rst_marker(ref_data, ref_sos)

        # Huffman Pseudo-Decoding Logic (MVP):
        # We replace the corrupted top section of the image bitstream with the reference bitstream
        # up to the first valid synchronization point (RST marker).
        # This forces the decoder to reset its DC predictors and byte alignment.
        
        if corrupt_rst != -1 and ref_rst != -1:
            # We have RST markers in both files. Sync at the first RST.
            header_and_patch = ref_data[:ref_rst] # Header + bitstream up to first RST from reference
            rest_of_corrupt = corrupt_data[corrupt_rst:]
            final_data = header_and_patch + rest_of_corrupt
        else:
            # Fallback: Just splice 1024 bytes of bitstream
            patch_size = 1024
            header_limit = corrupt_sos
            out_buffer = bytearray()
            
            # Header from corrupt (or ref, depending on preference. using corrupt header for accurate metadata)
            out_buffer.extend(corrupt_data[:corrupt_sos])
            
            # Patch from ref
            if ref_sos + patch_size < len(ref_data):
                out_buffer.extend(ref_data[ref_sos:ref_sos+patch_size])
            else:
                out_buffer.extend(ref_data[ref_sos:])
                
            # Rest from corrupt
            if corrupt_sos + patch_size < len(corrupt_data):
                out_buffer.extend(corrupt_data[corrupt_sos+patch_size:])
                
            final_data = bytes(out_buffer)

        with open(output_path, "wb") as f:
            f.write(final_data)

        return {
            "success": True,
            "output_path": output_path,
            "metrics": {
                "patch_applied": "rst_sync" if corrupt_rst != -1 and ref_rst != -1 else "fixed_1024_bytes",
                "corrupt_rst_offset": corrupt_rst,
                "ref_rst_offset": ref_rst
            }
        }
