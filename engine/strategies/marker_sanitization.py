import os
from typing import Dict, Any, Optional
from .base import BaseStrategy

class MarkerSanitizationStrategy(BaseStrategy):
    @property
    def name(self) -> str:
        return "marker-sanitization"
        
    @property
    def requires_reference(self) -> bool:
        return False
        
    def can_repair(self, analysis_result: Dict[str, Any]) -> bool:
        strats = analysis_result.get('suggestedStrategies', [])
        return any(s.get('strategy') == 'marker-sanitization' for s in strats)
        
    def _find_bitstream_offset(self, data: bytes) -> int:
        length = len(data)
        if length < 2 or data[0] != 0xFF or data[1] != 0xD8:
            return -1
            
        idx = 2
        
        while idx < length - 1:
            if data[idx] != 0xFF:
                return -1
                
            marker = data[idx + 1]
            
            if marker == 0xFF:
                idx += 1
                continue
                
            if marker == 0xDA: # SOS
                if idx + 4 > length:
                    return -1
                sos_len = (data[idx + 2] << 8) + data[idx + 3]
                return idx + 2 + sos_len
                
            if marker == 0xD8 or marker == 0xD9 or marker == 0x00 or (0xD0 <= marker <= 0xD7):
                idx += 2
                continue
                
            if idx + 4 > length:
                return -1
                
            seg_len = (data[idx + 2] << 8) + data[idx + 3]
            idx += 2 + seg_len
            
        return -1

    def repair(self, input_path: str, output_path: str, reference_path: Optional[str] = None) -> Dict[str, Any]:
        if not os.path.exists(input_path):
            raise FileNotFoundError(f"Input file not found: {input_path}")
            
        with open(input_path, 'rb') as f:
            data = bytearray(f.read())
            
        bitstream_offset = self._find_bitstream_offset(data)
        
        if bitstream_offset == -1:
            return {
                "success": False,
                "error": "Could not identify SOS marker. Sanitization requires an intact header."
            }
            
        valid_followers = {0x00, 0xD9, 0xD0, 0xD1, 0xD2, 0xD3, 0xD4, 0xD5, 0xD6, 0xD7}
        
        i = bitstream_offset
        length = len(data)
        patch_count = 0
        
        while i < length - 1:
            if data[i] == 0xFF:
                next_byte = data[i + 1]
                if next_byte not in valid_followers:
                    # Invalid marker, patch it out
                    data[i + 1] = 0x00
                    patch_count += 1
                    i += 2
                else:
                    i += 1
                    if next_byte in {0x00, 0xD9, 0xD0, 0xD1, 0xD2, 0xD3, 0xD4, 0xD5, 0xD6, 0xD7}:
                        i += 1
            else:
                i += 1
                
        with open(output_path, 'wb') as f:
            f.write(data)
            
        return {
            "success": True,
            "output_path": output_path,
            "patch_count": patch_count,
            "processed_bytes": length
        }
