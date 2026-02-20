import os
from typing import Dict, Any, Optional
from .base import BaseStrategy

class HeaderGraftingStrategy(BaseStrategy):
    @property
    def name(self) -> str:
        return "header-grafting"
        
    @property
    def requires_reference(self) -> bool:
        return True
        
    def can_repair(self, analysis_result: Dict[str, Any]) -> bool:
        # If suggestedStrategies includes header-grafting it's possible
        strats = analysis_result.get('suggestedStrategies', [])
        return any(s.get('strategy') == 'header-grafting' for s in strats)
        
    def _find_sos(self, data: bytes, strict: bool = True) -> int:
        """
        Parses JPEG markers to find the MAIN Start of Scan (SOS) marker,
        skipping any thumbnails embedded in EXIF (APP1).
        Follows standard JPEG marker lengths.
        """
        length = len(data)
        if length < 2 or data[0] != 0xFF or data[1] != 0xD8:
            # Not a valid SOI start
            if strict: return -1
            
        idx = 2
        
        while idx < length - 1:
            if data[idx] != 0xFF:
                # We lost the marker stream. This implies deep corruption.
                break
                
            marker = data[idx + 1]
            
            # 0xFF padding byte
            if marker == 0xFF:
                idx += 1
                continue
                
            # Main Start of Scan
            if marker == 0xDA:
                if idx + 4 > length:
                    return idx + 2
                sos_len = (data[idx + 2] << 8) + data[idx + 3]
                return idx + 2 + sos_len
                
            # Markers with no length field
            if marker == 0xD8 or marker == 0xD9 or marker == 0x00 or (0xD0 <= marker <= 0xD7):
                idx += 2
                continue
                
            # Segment with a length field (like APP1, DQT, DHT, SOF)
            if idx + 4 > length:
                break
                
            seg_len = (data[idx + 2] << 8) + data[idx + 3]
            
            # Jump over the whole segment. If this is APP1 EXIF, it skips the 
            # embedded thumbnail and its internal FF DA markers completely!
            if idx + 2 + seg_len > length:
                break
                
            idx += 2 + seg_len
            
        # If traversal fails and we're not strict, fallback to naive find
        # Limit search to the first 128KB where a header is legally and physically allowed to exist.
        # It is guaranteed that random entropy in a 10MB huffman bitstream will contain FF DA, so
        # unbounded searching will ruin the crop offset. We also search for FF DA 00 (size prefix)
        # to ensure it's a real marker and not random compressed noise.
        if not strict:
            search_bound = min(131072, len(data))
            marker = b'\xff\xda\x00'
            f_idx = data.find(marker, idx, search_bound)
            if f_idx != -1 and f_idx + 4 <= len(data):
                sos_len = (data[f_idx + 2] << 8) + data[f_idx + 3]
                return f_idx + 2 + sos_len
                
        return -1

    def repair(self, input_path: str, output_path: str, reference_path: Optional[str] = None) -> Dict[str, Any]:
        """
        Splices the functional header of the reference file with the bitstream of the corrupt input file.
        """
        if not reference_path or not os.path.exists(reference_path):
            raise FileNotFoundError(f"Reference file is required and must exist: {reference_path}")
            
        if not os.path.exists(input_path):
            raise FileNotFoundError(f"Input file not found: {input_path}")
            
        with open(reference_path, 'rb') as f:
            ref_data = f.read()
            
        with open(input_path, 'rb') as f:
            target_data = f.read()
            
        # 1. Extract Header from Reference
        ref_sos_idx = self._find_sos(ref_data)
        if ref_sos_idx == -1:
            return {
                "success": False,
                "error": "Could not identify SOS marker in Reference File. Reference file is invalid."
            }
            
        healthy_header = ref_data[:ref_sos_idx]
        
        # 2. Extract Bitstream from Target
        target_sos_idx = self._find_sos(target_data, strict=False)
        
        if target_sos_idx == -1:
            # If target has NO recognizable SOS marker, or it's bizarrely deep (e.g. random 
            # noise in the middle of the file matching FF DA), it's completely destroyed or shifted. 
            # Safest fallback: Assume the target's bitstream starts at the exact same 
            # byte offset as the healthy reference file (since they are from the same camera)
            target_bitstream = target_data[ref_sos_idx:]
        else:
            target_bitstream = target_data[target_sos_idx:]
            
        # Make sure target bitstream ends with EOI (FF D9)
        if not target_bitstream.endswith(b'\xff\xd9'):
            # If it's corrupted at the end, append an EOI to satisfy the decoder
            target_bitstream += b'\xff\xd9'
            
        # 3. Graft them together
        grafted_data = healthy_header + target_bitstream
        
        with open(output_path, 'wb') as out_f:
            out_f.write(grafted_data)
            
        return {
            "success": True,
            "output_path": output_path,
            "grafted_size_bytes": len(grafted_data)
        }
