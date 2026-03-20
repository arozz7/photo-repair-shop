import os
import struct
import binascii
from typing import Dict, Any, Optional, List
from .base import BaseStrategy

def calculate_crc(data: bytes) -> int:
    return binascii.crc32(data) & 0xFFFFFFFF

class PngChunkRebuilderStrategy(BaseStrategy):
    @property
    def name(self) -> str:
        return "png-chunk-rebuilder"
        
    @property
    def requires_reference(self) -> bool:
        return False # Can be true for IHDR grafting, but IDAT rebuilding doesn't strictly need one. We'll handle both.
        
    def can_repair(self, analysis_result: Dict[str, Any]) -> bool:
        corruptions = analysis_result.get('corruptionTypes', [])
        return any(c in corruptions for c in ['png_missing_ihdr', 'png_broken_idat', 'png_crc_mismatch'])
        
    def _read_chunks(self, filepath: str) -> List[Dict[str, Any]]:
        chunks = []
        with open(filepath, 'rb') as f:
            signature = f.read(8)
            if signature != b'\x89PNG\r\n\x1a\n':
                return chunks
            
            while True:
                length_bytes = f.read(4)
                if not length_bytes or len(length_bytes) < 4:
                    break
                length = struct.unpack('>I', length_bytes)[0]
                
                type_bytes = f.read(4)
                if len(type_bytes) < 4:
                    break
                
                data = f.read(length)
                
                crc_bytes = f.read(4)
                if len(crc_bytes) < 4:
                    expected_crc = 0
                else:
                    expected_crc = struct.unpack('>I', crc_bytes)[0]
                    
                chunks.append({
                    'type': type_bytes,
                    'data': data,
                    'expected_crc': expected_crc
                })
        return chunks

    def repair(self, input_path: str, output_path: str, reference_path: Optional[str] = None) -> Dict[str, Any]:
        """
        Rebuilds PNG chunks. 
        If IHDR is missing and a reference is provided, it grafts the IHDR.
        If IEND is missing, it appends one.
        If CRC is invalid, it re-calculates it.
        """
        if not os.path.exists(input_path):
            raise FileNotFoundError(f"Input file not found: {input_path}")
            
        chunks = self._read_chunks(input_path)
        ref_chunks = []
        if reference_path and os.path.exists(reference_path):
            ref_chunks = self._read_chunks(reference_path)
            
        new_chunks = []
        has_ihdr = any(c['type'] == b'IHDR' for c in chunks)
        
        # 1. Graft IHDR if missing
        if not has_ihdr:
            ref_ihdr = next((c for c in ref_chunks if c['type'] == b'IHDR'), None)
            if ref_ihdr:
                new_chunks.append(ref_ihdr)
            else:
                return {"success": False, "error": "IHDR missing and no valid reference provided."}
                
        # 2. Add remaining valid chunks
        for chunk in chunks:
            if chunk['type'] == b'IEND':
                continue # We will append this safely later
                
            # If IDAT CRC is wrong, we recalculate it to trick viewers into reading it anyway
            new_chunks.append(chunk)
            
        # 3. Always append valid IEND
        new_chunks.append({
            'type': b'IEND',
            'data': b'',
            'expected_crc': calculate_crc(b'IEND')
        })
        
        # Write output
        with open(output_path, 'wb') as f:
            f.write(b'\x89PNG\r\n\x1a\n') # Signature
            
            for c in new_chunks:
                f.write(struct.pack('>I', len(c['data'])))
                f.write(c['type'])
                f.write(c['data'])
                # Recalculate CRC for all chunks to ensure valid container
                chunk_crc = calculate_crc(c['type'] + c['data'])
                f.write(struct.pack('>I', chunk_crc))
                
        return {
            "success": True,
            "output_path": output_path,
            "chunks_processed": len(new_chunks)
        }
