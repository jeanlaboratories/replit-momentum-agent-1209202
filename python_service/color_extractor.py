"""
Color Palette Extractor for Brand Soul
Extracts dominant colors from website screenshots
"""

import requests
from io import BytesIO
from PIL import Image
import numpy as np
from sklearn.cluster import KMeans
from typing import List, Dict
import logging

logger = logging.getLogger(__name__)


def extract_color_palette(screenshot_url: str, num_colors: int = 5) -> List[Dict]:
    """
    Extract dominant color palette from a screenshot URL
    
    Args:
        screenshot_url: URL of the screenshot image
        num_colors: Number of dominant colors to extract (default: 5)
    
    Returns:
        List of color dictionaries with hex, rgb, and proportion
    """
    try:
        # Download image
        response = requests.get(screenshot_url, timeout=15)
        response.raise_for_status()
        
        # Open image
        img = Image.open(BytesIO(response.content))
        
        # Convert to RGB if needed
        if img.mode != 'RGB':
            img = img.convert('RGB')
        
        # Resize for faster processing (max 800px width)
        max_width = 800
        if img.width > max_width:
            ratio = max_width / img.width
            new_size = (max_width, int(img.height * ratio))
            img = img.resize(new_size, Image.Resampling.LANCZOS)
        
        # Convert to numpy array
        pixels = np.array(img).reshape(-1, 3)
        
        # Filter out near-white and near-black pixels (noise reduction)
        # Remove white (RGB > 240)
        mask_white = ~((pixels[:, 0] > 240) & (pixels[:, 1] > 240) & (pixels[:, 2] > 240))
        # Remove black (RGB < 15)
        mask_black = ~((pixels[:, 0] < 15) & (pixels[:, 1] < 15) & (pixels[:, 2] < 15))
        # Remove grays (low variance)
        variance = np.var(pixels, axis=1)
        mask_gray = variance > 100  # Colors with variance < 100 are likely gray
        
        # Combine masks
        mask = mask_white & mask_black & mask_gray
        filtered_pixels = pixels[mask]
        
        # If too few pixels after filtering, use original
        if len(filtered_pixels) < 100:
            filtered_pixels = pixels
        
        # Sample pixels for faster K-means (max 10000 pixels)
        if len(filtered_pixels) > 10000:
            indices = np.random.choice(len(filtered_pixels), 10000, replace=False)
            filtered_pixels = filtered_pixels[indices]
        
        # Run K-means clustering
        kmeans = KMeans(n_clusters=num_colors, random_state=42, n_init=10)
        kmeans.fit(filtered_pixels)
        
        # Get colors and counts
        colors = kmeans.cluster_centers_.astype(int)
        labels = kmeans.labels_
        counts = np.bincount(labels)
        
        # Sort by frequency
        sorted_indices = np.argsort(counts)[::-1]
        palette = colors[sorted_indices]
        frequencies = counts[sorted_indices] / counts.sum()
        
        # Format output
        result = []
        for color, freq in zip(palette, frequencies):
            r, g, b = int(color[0]), int(color[1]), int(color[2])
            hex_color = f"#{r:02x}{g:02x}{b:02x}"
            
            result.append({
                'hex': hex_color,
                'rgb': [r, g, b],
                'proportion': round(float(freq), 3)
            })
        
        logger.info(f"Extracted {len(result)} colors from screenshot")
        return result
        
    except Exception as e:
        logger.error(f"Color extraction failed: {str(e)}")
        return []


def get_color_name(rgb: List[int]) -> str:
    """
    Get human-readable color name from RGB values
    
    Args:
        rgb: [R, G, B] values
    
    Returns:
        Color name (e.g., "Red", "Blue", "Green")
    """
    r, g, b = rgb
    
    # Simple heuristic color naming
    if r > 200 and g < 100 and b < 100:
        return "Red"
    elif r < 100 and g > 200 and b < 100:
        return "Green"
    elif r < 100 and g < 100 and b > 200:
        return "Blue"
    elif r > 200 and g > 200 and b < 100:
        return "Yellow"
    elif r > 200 and g < 100 and b > 200:
        return "Magenta"
    elif r < 100 and g > 200 and b > 200:
        return "Cyan"
    elif r > 200 and g > 150 and b < 100:
        return "Orange"
    elif r > 150 and g < 150 and b > 200:
        return "Purple"
    elif r > 180 and g > 180 and b > 180:
        return "Light Gray"
    elif r < 80 and g < 80 and b < 80:
        return "Dark Gray"
    elif r > 100 and g > 80 and b < 80:
        return "Brown"
    else:
        # Calculate brightness
        brightness = (r + g + b) / 3
        if brightness > 200:
            return "Light"
        elif brightness < 60:
            return "Dark"
        else:
            return "Neutral"


if __name__ == "__main__":
    # Test with a sample screenshot
    test_url = "https://example.com/screenshot.png"
    palette = extract_color_palette(test_url, num_colors=5)
    for color in palette:
        print(f"{color['hex']} - {color['proportion']*100:.1f}% - {get_color_name(color['rgb'])}")
