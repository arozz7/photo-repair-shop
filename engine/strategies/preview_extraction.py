import os
from typing import Dict, Any, Optional
from .base import BaseStrategy

class PreviewExtractionStrategy(BaseStrategy):
    @property
    def name(self) -> str:
        return "preview-extraction"
        
    @property
    def requires_reference(self) -> bool:
        return False
        
    def can_repair(self, analysis_result: Dict[str, Any]) -> bool:
        return analysis_result.get('embeddedPreviewAvailable', False)
        
    def repair(self, input_path: str, output_path: str, reference_path: Optional[str] = None) -> Dict[str, Any]:
        """
        Carves the largest embedded JPEG file from the given raw bitstream.
        We look for standard JPEG 0xFFD8 0xFFE1 (SOI + APP1) or 0xFFD8 0xFFE0
        and match it to the 0xFFD9 (EOI).
        """
        if not os.path.exists(input_path):
            raise FileNotFoundError(f"Input file not found: {input_path}")
            
        file_size = os.path.getsize(input_path)
        
        # Read the entire file if it's small enough, else we should chunk it,
        # but for typical RAWs (20-60mb) we can usually afford reading it into memory.
        # For memory safety in Electron, we'll stream chunks.
        
        CHUNK_SIZE = 1024 * 1024 * 5 # 5MB
        
        found_jpegs = []
        
        # 0xFFD8 is SOI (Start of Image)
        # 0xFFD9 is EOI (End of Image)
        soi_marker = b'\xff\xd8'
        eoi_marker = b'\xff\xd9'

        buffer = b''
        file_offset = 0

        with open(input_path, 'rb') as f:
            while chunk := f.read(CHUNK_SIZE):
                buffer += chunk
                
                # Search for all SOIs in this buffer
                # To handle SOIs spanning chunk boundaries, we keep the last few bytes
                search_idx = 0
                while True:
                    start_idx = buffer.find(soi_marker, search_idx)
                    if start_idx == -1:
                        break
                        
                    # Found an SOI. Let's find the corresponding EOI.
                    # We look for the NEXT EOI after this SOI.
                    end_idx = buffer.find(eoi_marker, start_idx + 2)
                    
                    if end_idx != -1:
                        end_pos = end_idx + 2
                    else:
                        # The EOI might be in the next chunk. Let's read more if possible.
                        extra_chunk = f.read(CHUNK_SIZE)
                        if not extra_chunk:
                            break # End of file, no EOI found for this SOI
                        buffer += extra_chunk
                        end_idx = buffer.find(eoi_marker, start_idx + 2)
                        if end_idx != -1:
                            end_pos = end_idx + 2
                        else:
                            # Still nothing, maybe a corrupted embedded preview? We'll skip it.
                            search_idx = start_idx + 2
                            continue
                            
                    length = end_pos - start_idx
                    # Only keep realistic image sizes (e.g., > 10KB to avoid thumbnails)
                    if length > 10 * 1024:
                        jpeg_data = buffer[start_idx:end_pos]
                        found_jpegs.append({
                            'data': jpeg_data,
                            'length': length
                        })
                    
                    search_idx = end_pos
                
                # Keep the last 1MB of the buffer in case a JPEG spans the boundary
                if len(buffer) > 1024 * 1024:
                    buffer = buffer[-(1024 * 1024):]

        if not found_jpegs:
            return {
                "success": False,
                "error": "No embedded JPEG images found in the file."
            }

        # Select the largest jpeg found (most likely the full resolution proxy)
        largest_jpeg = max(found_jpegs, key=lambda j: j['length'])
        
        with open(output_path, 'wb') as out_f:
            out_f.write(largest_jpeg['data'])
            
        return {
            "success": True,
            "output_path": output_path,
            "extracted_size_bytes": largest_jpeg['length']
        }
