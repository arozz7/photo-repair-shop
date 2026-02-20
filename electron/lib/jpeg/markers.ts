export const JPEG_MARKERS = {
    SOI: 0xFFD8,   // Start of Image
    EOI: 0xFFD9,   // End of Image
    SOS: 0xFFDA,   // Start of Scan
    DQT: 0xFFDB,   // Quantization Table
    DHT: 0xFFC4,   // Huffman Table
    SOF0: 0xFFC0,   // Start of Frame (Baseline DCT)
    SOF2: 0xFFC2,   // Start of Frame (Progressive DCT)
    APP0: 0xFFE0,   // JFIF
    APP1: 0xFFE1,   // EXIF
    RST0: 0xFFD0,   // Restart Markers RST0–RST7
} as const;

export const VALID_BITSTREAM_FOLLOWERS = new Set([
    0x00,                           // Byte stuffing
    0xD9,                           // EOI
    0xD0, 0xD1, 0xD2, 0xD3,         // RST0–RST3
    0xD4, 0xD5, 0xD6, 0xD7,         // RST4–RST7
]);
