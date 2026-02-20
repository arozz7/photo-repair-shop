import sys
from PIL import Image, ImageDraw

def make_transparent_and_convert():
    img = Image.open(r'C:\Users\arozz\.gemini\antigravity\brain\22e90702-e419-48af-aed9-2505e3af9f4a\icon_1771621361515.png').convert("RGBA")
    
    # Find the bounding box of the non-white area.
    width, height = img.size
    pixels = img.load()
    
    min_x = width
    min_y = height
    max_x = 0
    max_y = 0
    
    for y in range(height):
        for x in range(width):
            r, g, b, a = pixels[x, y]
            # Consider it non-background if it's sufficiently dark.
            # The halo is usually light gray. The dark edge of the icon is very dark.
            if r < 120 and g < 120 and b < 120:
                if x < min_x: min_x = x
                if x > max_x: max_x = x
                if y < min_y: min_y = y
                if y > max_y: max_y = y
                
    # Center of the dark region
    cx = (min_x + max_x) // 2
    cy = (min_y + max_y) // 2
    
    # Radius is half the width/height of the bounding box
    rx = (max_x - min_x) // 2
    ry = (max_y - min_y) // 2
    
    # We want a perfect circle, take average radius, shrink it by 5 pixels to be safe
    r = int((rx + ry) / 2) - 5
    
    print(f"Detected circle center: ({cx}, {cy}), radius: {r}")
    
    # Draw the mask on a 4x supersampled canvas for high-quality anti-aliasing
    scale = 4
    mask_hr = Image.new("L", (width * scale, height * scale), 0)
    draw_hr = ImageDraw.Draw(mask_hr)
    
    box = (
        (cx - r) * scale,
        (cy - r) * scale,
        (cx + r) * scale,
        (cy + r) * scale
    )
    draw_hr.ellipse(box, fill=255)
    
    mask = mask_hr.resize((width, height), Image.Resampling.LANCZOS)
    img.putalpha(mask)
    
    # Finally, resize to 256x256
    img = img.resize((256, 256), Image.Resampling.LANCZOS)
    
    img.save('public/icon.png', format='PNG')
    img.save('public/icon.ico', format='ICO', sizes=[(256, 256)])
    print("Fully masked and converted.")

if __name__ == "__main__":
    make_transparent_and_convert()
