import os
import sys
import unittest
import tempfile

sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from strategies.header_grafting import HeaderGraftingStrategy

class TestHeaderGraftingStrategy(unittest.TestCase):
    def setUp(self):
        self.temp_dir = tempfile.TemporaryDirectory()
        self.input_path = os.path.join(self.temp_dir.name, "mock_corrupt.jpg")
        self.reference_path = os.path.join(self.temp_dir.name, "mock_reference.jpg")
        self.output_path = os.path.join(self.temp_dir.name, "output.jpg")
        self.strategy = HeaderGraftingStrategy()

    def tearDown(self):
        self.temp_dir.cleanup()
        
    def _create_mock_jpeg(self, path, header_data, bitstream_data):
        # SOS is FF DA [Length 00 03] [1 byte]
        sos_marker = b'\xff\xda\x00\x03\x01'
        eoi = b'\xff\xd9'
        with open(path, 'wb') as f:
            f.write(header_data)
            f.write(sos_marker)
            f.write(bitstream_data)
            f.write(eoi)

    def test_successful_graft(self):
        # Create Reference (Length 00 0e for 14 bytes: 2 length + 12 payload)
        ref_header = b'\xff\xd8\xff\xe1\x00\x0eEXIF_HEALTHY'
        ref_bitstream = b'\x11\x11\x11\x11'
        self._create_mock_jpeg(self.reference_path, ref_header, ref_bitstream)
        
        # Create Corrupt Target
        target_header = b'\xff\xd8\xff\xe1\x00\x0eEXIF_CORRUPT'
        target_bitstream = b'\x99\x99\x99\x99'
        self._create_mock_jpeg(self.input_path, target_header, target_bitstream)
        
        # Graft
        result = self.strategy.repair(self.input_path, self.output_path, self.reference_path)
        
        self.assertTrue(result['success'])
        
        with open(self.output_path, 'rb') as f:
            output_data = f.read()
            
        # The output should have the ref_header + SOS marker + target_bitstream + EOI
        sos_marker = b'\xff\xda\x00\x03\x01'
        expected_output = ref_header + sos_marker + target_bitstream + b'\xff\xd9'
        
        self.assertEqual(output_data, expected_output)

    def test_missing_reference(self):
        with self.assertRaises(FileNotFoundError):
            self.strategy.repair(self.input_path, self.output_path, None)

    def test_target_missing_sos(self):
        # Create Reference
        ref_header = b'\xff\xd8\xff\xe1\x00\x0eEXIF_HEALTHY'
        ref_bitstream = b'\x11\x11\x11\x11'
        self._create_mock_jpeg(self.reference_path, ref_header, ref_bitstream)
        
        # Create Corrupt Target (No SOS marker at all)
        # Just random bytes (long enough to survive the slice)
        target_data = b'\x00\x01\x02\x03' * 25 
        with open(self.input_path, 'wb') as f:
            f.write(target_data)
            
        # Graft
        result = self.strategy.repair(self.input_path, self.output_path, self.reference_path)
        self.assertTrue(result['success'])
        
        with open(self.output_path, 'rb') as f:
            output_data = f.read()
            
        # Ref header is 18 bytes length. SOS marker is 5 bytes. ref_sos_idx = 23.
        # Fallback uses target_data[ref_sos_idx:]
        ref_sos_idx = 23 
        target_bitstream = target_data[ref_sos_idx:]
        
        # The output should have the ref_header + SOS + sliced bitstream + EOI
        sos_marker = b'\xff\xda\x00\x03\x01'
        expected_output = ref_header + sos_marker + target_bitstream + b'\xff\xd9'
        
        self.assertEqual(output_data, expected_output)

if __name__ == '__main__':
    unittest.main()
