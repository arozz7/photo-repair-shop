import os
import pytest
from strategies.mcu_alignment import McuAlignmentStrategy
import tempfile

@pytest.fixture
def temp_files():
    # synthetic markers: 
    # SOS marker length is 2 bytes (big endian) + 2 bytes for FF DA itself
    # Let's create proper synthetic data
    # SOI (FF D8), APP0 (FF E0 00 10 ...), DQT, DHT, SOF, SOS (FF DA 00 0A ...)
    # SOS marker: FF DA 00 08 03 01 00 02 11 03 11 00 3F 00 (14 bytes total incl FF DA) -> length 0x000C
    # RST0 = FF D0, RST1 = FF D1
    
    header = bytes.fromhex("FFD8 FFE0 0010 4A46 4946 0001 0100 0001 0001 0000 FFC0 0011 0800 1000 1003 0122 0002 1101 0311 01 FFD0 FFDA 000C 0301 0002 1103 1100 3F00")
    
    # We purposefully add RST markers into the bitstream
    bitstream_ref = bytes.fromhex("11223344 FFD0 55667788 FFD1 99AABBCC")
    bitstream_corrupt = bytes.fromhex("11FFF044 FFD0 55667788 FFD1 99AABBCC") # Different pre-RST data to simulate corruption
    
    ref_data = header + bitstream_ref
    corrupt_data = header + bitstream_corrupt
    
    fd1, ref_path = tempfile.mkstemp(suffix=".jpg")
    fd2, corrupt_path = tempfile.mkstemp(suffix=".jpg")
    fd3, output_path = tempfile.mkstemp(suffix=".jpg")
    
    os.write(fd1, ref_data)
    os.write(fd2, corrupt_data)
    
    os.close(fd1)
    os.close(fd2)
    os.close(fd3)
    
    yield ref_path, corrupt_path, output_path
    
    os.unlink(ref_path)
    os.unlink(corrupt_path)
    os.unlink(output_path)

def test_mcu_alignment_strategy_name():
    strategy = McuAlignmentStrategy()
    assert strategy.name == "mcu-alignment"

def test_requires_reference():
    strategy = McuAlignmentStrategy()
    assert strategy.requires_reference is True

def test_can_repair():
    strategy = McuAlignmentStrategy()
    assert strategy.can_repair({"corruptionTypes": ["mcu_misalignment"]}) is True
    assert strategy.can_repair({"corruptionTypes": ["truncated"]}) is False

def test_repair_success(temp_files):
    ref_path, corrupt_path, output_path = temp_files
    strategy = McuAlignmentStrategy()
    
    result = strategy.repair(corrupt_path, output_path, reference_path=ref_path)
    
    assert result["success"] is True
    assert "metrics" in result
    assert result["metrics"]["patch_applied"] == "rst_sync"
    
    # Check output
    with open(output_path, "rb") as f:
        output_data = f.read()
        
    # Finally: header (55) + bitstream patch (4) from ref = 59
    # Then corrupt from FFD0 (12)
    # Total = 71 bytes
    assert b'\xFF\xD0' in output_data
    assert len(output_data) == 71
