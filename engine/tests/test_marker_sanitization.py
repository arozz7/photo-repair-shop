import os
import pytest
import tempfile
from strategies.marker_sanitization import MarkerSanitizationStrategy

class TestMarkerSanitizationStrategy:
    def setup_method(self):
        self.strategy = MarkerSanitizationStrategy()
        
    def test_basic_properties(self):
        assert self.strategy.name == "marker-sanitization"
        assert self.strategy.requires_reference is False
        
    def test_can_repair(self):
        analysis = {"suggestedStrategies": [{"strategy": "marker-sanitization"}]}
        assert self.strategy.can_repair(analysis) is True
        
        analysis_empty = {"suggestedStrategies": [{"strategy": "header-grafting"}]}
        assert self.strategy.can_repair(analysis_empty) is False

    def test_find_bitstream_offset(self):
        # Valid bitstream start after SOS
        # FFD8 (SOI) ... FFDA 000C [8 bytes of SOS data] ...
        data = bytearray([0xFF, 0xD8, 0xFF, 0xE0, 0x00, 0x10, b'J'[0], b'F'[0], b'I'[0], b'F'[0], 0x00, 0x01, 0x01, 0x01, 0x00, 0x48, 0x00, 0x48, 0x00, 0x00, 0xFF, 0xDA, 0x00, 0x08, 0x01, 0x02, 0x03, 0x04, 0x05, 0x06, 0x11, 0x22, 0x33])
        offset = self.strategy._find_bitstream_offset(data)
        assert offset == 30 # index of 0x11
        
    def test_sanitization(self):
        # Fake SOS header
        header = bytearray([0xFF, 0xD8, 0xFF, 0xDA, 0x00, 0x02]) 
        
        # Valid followers: 0x00, 0xD9, 0xD0
        # Invalid followers: 0xAA, 0x99
        bitstream = bytearray([
            0xFF, 0x00, # valid stuffing
            0x12, 0x34, 
            0xFF, 0xAA, # INVALID!
            0x56,
            0xFF, 0xD9 # EOF
        ])
        
        with tempfile.NamedTemporaryFile(suffix=".jpg", delete=False) as tf:
            tf.write(header + bitstream)
            input_path = tf.name
            
        with tempfile.NamedTemporaryFile(suffix=".jpg", delete=False) as off:
            output_path = off.name
            
        try:
            result = self.strategy.repair(input_path, output_path)
            
            assert result["success"] is True
            assert result["patch_count"] == 1
            
            with open(output_path, "rb") as f:
                output_data = bytearray(f.read())
                
            # Check the invalid marker was changed to 0x00
            # Header length = 6
            # bitstream index of FF AA is 4
            # Overall index in file = 6 + 4 = 10
            # The next byte should now be 0x00
            assert output_data[11] == 0x00
            
        finally:
            os.remove(input_path)
            os.remove(output_path)
