import os
import sys
import unittest
import tempfile

sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from strategies.preview_extraction import PreviewExtractionStrategy

class TestPreviewExtractionStrategy(unittest.TestCase):
    def setUp(self):
        self.temp_dir = tempfile.TemporaryDirectory()
        self.input_path = os.path.join(self.temp_dir.name, "mock_raw.cr2")
        self.output_path = os.path.join(self.temp_dir.name, "output.jpg")
        self.strategy = PreviewExtractionStrategy()

    def tearDown(self):
        self.temp_dir.cleanup()

    def test_extract_largest_embedded_jpeg(self):
        # Create a mock RAW file containing noise, a small JPEG (thumbnail), more noise, and a large JPEG (preview)
        
        soi = b'\xff\xd8'
        eoi = b'\xff\xd9'
        
        noise = b'\x00\x01\x02' * 5000 # 15kb of noise
        
        small_jpeg = soi + b'\xAA' * 5000 + eoi # ~ 5kb "thumbnail"
        large_jpeg = soi + b'\xBB' * 20000 + eoi # ~ 20kb "preview"
        
        with open(self.input_path, 'wb') as f:
            f.write(noise)
            f.write(small_jpeg)
            f.write(noise)
            f.write(large_jpeg)
            f.write(noise)
            
        result = self.strategy.repair(self.input_path, self.output_path)
        
        self.assertTrue(result['success'])
        self.assertEqual(result['extracted_size_bytes'], len(large_jpeg))
        
        with open(self.output_path, 'rb') as f:
            extracted_data = f.read()
            self.assertEqual(extracted_data, large_jpeg)

    def test_no_jpeg_found(self):
        noise = b'\x00\x01\x02' * 5000
        with open(self.input_path, 'wb') as f:
            f.write(noise)
            
        result = self.strategy.repair(self.input_path, self.output_path)
        self.assertFalse(result['success'])
        self.assertEqual(result['error'], "No embedded JPEG images found in the file.")

if __name__ == '__main__':
    unittest.main()
