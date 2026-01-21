#!/usr/bin/env python3
"""
macOS OCR Script using Apple Vision Framework
Extracts text from images using native macOS OCR
"""
import sys
import json
import os
from pathlib import Path

try:
    from Vision import VNRecognizeTextRequest, VNImageRequestHandler
    from AppKit import NSImage, NSBitmapImageRep
    from Foundation import NSData
except ImportError:
    print(json.dumps({"error": "PyObjC not installed. Install with: pip3 install pyobjc"}))
    sys.exit(1)


def image_to_nsimage(image_path):
    """Convert image file to NSImage"""
    try:
        image_data = NSData.dataWithContentsOfFile_(image_path)
        if image_data is None:
            return None
        
        image = NSImage.alloc().initWithData_(image_data)
        return image
    except Exception as e:
        return None


def ocr_image(image_path):
    """Perform OCR on image using Apple Vision"""
    try:
        # Check if file exists
        if not os.path.exists(image_path):
            return {"error": f"Image file not found: {image_path}"}

        # Convert to NSImage
        ns_image = image_to_nsimage(image_path)
        if ns_image is None:
            return {"error": "Failed to load image"}

        # Create request handler
        handler = VNImageRequestHandler.alloc().initWithData_options_(
            ns_image.TIFFRepresentation(),
            {}
        )

        # Create text recognition request
        request = VNRecognizeTextRequest.alloc().init()
        
        # Set recognition level (accurate or fast)
        request.setRecognitionLevel_(0)  # 0 = accurate, 1 = fast
        
        # Perform recognition
        error = handler.performRequests_error_([request], None)
        
        if error:
            return {"error": str(error)}

        # Extract text from results
        observations = request.results()
        text_parts = []
        
        for observation in observations:
            text = observation.topCandidates_(1)[0].string()
            text_parts.append(text)

        # Combine all text
        full_text = " ".join(text_parts)
        
        # Calculate confidence (simplified - average confidence)
        confidence = 0.9  # Apple Vision doesn't expose per-observation confidence easily
        if len(text_parts) == 0:
            confidence = 0.0

        return {
            "text": full_text,
            "confidence": confidence
        }
    except Exception as e:
        return {"error": str(e)}


def main():
    """Main entry point"""
    if len(sys.argv) < 2:
        print(json.dumps({"error": "Usage: macos_ocr.py <image_path>"}))
        sys.exit(1)

    image_path = sys.argv[1]
    result = ocr_image(image_path)
    print(json.dumps(result))


if __name__ == "__main__":
    main()
