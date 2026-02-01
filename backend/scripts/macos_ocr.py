#!/usr/bin/env python3
"""
macOS OCR Script using Apple Vision Framework
Extracts text from images using native macOS OCR
"""
import sys
import json
import os
import traceback
from pathlib import Path

try:
    from Vision import VNRecognizeTextRequest, VNImageRequestHandler
    from AppKit import NSImage, NSBitmapImageRep
    from Foundation import NSData
except ImportError as e:
    error_msg = {
        "error": "PyObjC not installed. Install with: pip3 install pyobjc",
        "details": str(e)
    }
    print(json.dumps(error_msg), file=sys.stderr)
    print(json.dumps(error_msg))
    sys.exit(1)


def image_to_nsimage(image_path):
    """Convert image file to NSImage"""
    try:
        if not os.path.exists(image_path):
            print(f"[OCR] Error: Image file does not exist: {image_path}", file=sys.stderr)
            return None
        
        image_data = NSData.dataWithContentsOfFile_(image_path)
        if image_data is None:
            print(f"[OCR] Error: Failed to read image data from: {image_path}", file=sys.stderr)
            return None
        
        image = NSImage.alloc().initWithData_(image_data)
        if image is None:
            print(f"[OCR] Error: Failed to create NSImage from data: {image_path}", file=sys.stderr)
            return None
        
        return image
    except Exception as e:
        print(f"[OCR] Error converting image to NSImage: {str(e)}", file=sys.stderr)
        print(f"[OCR] Traceback: {traceback.format_exc()}", file=sys.stderr)
        return None


def ocr_image(image_path):
    """Perform OCR on image using Apple Vision"""
    try:
        # Check if file exists
        if not os.path.exists(image_path):
            error_msg = f"Image file not found: {image_path}"
            print(f"[OCR] Error: {error_msg}", file=sys.stderr)
            return {"error": error_msg}

        # Check file size
        file_size = os.path.getsize(image_path)
        # #region agent log
        import json
        log_path = "/Users/guljain/Desktop/Projects/FocusAI/.cursor/debug.log"
        with open(log_path, 'a') as f:
            f.write(json.dumps({"location":"macos_ocr.py:60","message":"Image file checked","data":{"fileSize":file_size,"imagePath":image_path,"fileExists":os.path.exists(image_path)},"timestamp":int(__import__('time').time()*1000),"sessionId":"debug-session","runId":"run1","hypothesisId":"E"})+"\n")
        # #endregion
        if file_size == 0:
            error_msg = f"Image file is empty: {image_path}"
            print(f"[OCR] Error: {error_msg}", file=sys.stderr)
            return {"error": error_msg}

        # Convert to NSImage
        ns_image = image_to_nsimage(image_path)
        # #region agent log
        import json
        log_path = "/Users/guljain/Desktop/Projects/FocusAI/.cursor/debug.log"
        with open(log_path, 'a') as f:
            f.write(json.dumps({"location":"macos_ocr.py:67","message":"NSImage created","data":{"nsImageIsNone":ns_image is None,"fileSize":file_size,"imagePath":image_path},"timestamp":int(__import__('time').time()*1000),"sessionId":"debug-session","runId":"run1","hypothesisId":"E"})+"\n")
        # #endregion
        if ns_image is None:
            error_msg = "Failed to load image"
            print(f"[OCR] Error: {error_msg} from {image_path}", file=sys.stderr)
            return {"error": error_msg}

        # Create request handler
        try:
            tiff_data = ns_image.TIFFRepresentation()
            # #region agent log
            import json
            log_path = "/Users/guljain/Desktop/Projects/FocusAI/.cursor/debug.log"
            with open(log_path, 'a') as f:
                f.write(json.dumps({"location":"macos_ocr.py:75","message":"TIFF representation","data":{"tiffDataIsNone":tiff_data is None,"tiffDataLength":len(tiff_data) if tiff_data else 0},"timestamp":int(__import__('time').time()*1000),"sessionId":"debug-session","runId":"run1","hypothesisId":"E"})+"\n")
            # #endregion
            if tiff_data is None:
                error_msg = "Failed to get TIFF representation from image"
                print(f"[OCR] Error: {error_msg}", file=sys.stderr)
                return {"error": error_msg}
            
            handler = VNImageRequestHandler.alloc().initWithData_options_(
                tiff_data,
                {}
            )
            # #region agent log
            with open(log_path, 'a') as f:
                f.write(json.dumps({"location":"macos_ocr.py:85","message":"VNImageRequestHandler created","data":{"handlerIsNone":handler is None},"timestamp":int(__import__('time').time()*1000),"sessionId":"debug-session","runId":"run1","hypothesisId":"E"})+"\n")
            # #endregion
            if handler is None:
                error_msg = "Failed to create VNImageRequestHandler"
                print(f"[OCR] Error: {error_msg}", file=sys.stderr)
                return {"error": error_msg}
        except Exception as e:
            error_msg = f"Failed to create request handler: {str(e)}"
            print(f"[OCR] Error: {error_msg}", file=sys.stderr)
            print(f"[OCR] Traceback: {traceback.format_exc()}", file=sys.stderr)
            return {"error": error_msg}

        # Create text recognition request
        try:
            request = VNRecognizeTextRequest.alloc().init()
            if request is None:
                error_msg = "Failed to create VNRecognizeTextRequest"
                print(f"[OCR] Error: {error_msg}", file=sys.stderr)
                return {"error": error_msg}
            
            # Set recognition level (accurate or fast)
            request.setRecognitionLevel_(0)  # 0 = accurate, 1 = fast
        except Exception as e:
            error_msg = f"Failed to create recognition request: {str(e)}"
            print(f"[OCR] Error: {error_msg}", file=sys.stderr)
            print(f"[OCR] Traceback: {traceback.format_exc()}", file=sys.stderr)
            return {"error": error_msg}
        
        # Perform recognition
        try:
            import json
            log_path = "/Users/guljain/Desktop/Projects/FocusAI/.cursor/debug.log"
            error = handler.performRequests_error_([request], None)
            # #region agent log
            with open(log_path, 'a') as f:
                f.write(json.dumps({"location":"macos_ocr.py:113","message":"performRequests_error_ result","data":{"error":str(error),"errorType":str(type(error)),"errorRepr":repr(error)},"timestamp":int(__import__('time').time()*1000),"sessionId":"debug-session","runId":"run1","hypothesisId":"E"})+"\n")
            # #endregion
            
            if error:
                error_msg = f"Vision framework error: {str(error)}"
                # #region agent log
                with open(log_path, 'a') as f:
                    f.write(json.dumps({"location":"macos_ocr.py:116","message":"Vision framework error detected","data":{"error":error_msg,"errorObj":str(error),"errorRepr":repr(error)},"timestamp":int(__import__('time').time()*1000),"sessionId":"debug-session","runId":"run1","hypothesisId":"E"})+"\n")
                # #endregion
                print(f"[OCR] Error: {error_msg}", file=sys.stderr)
                return {"error": error_msg}
        except Exception as e:
            error_msg = f"Failed to perform recognition: {str(e)}"
            print(f"[OCR] Error: {error_msg}", file=sys.stderr)
            print(f"[OCR] Traceback: {traceback.format_exc()}", file=sys.stderr)
            return {"error": error_msg}

        # Extract text from results
        try:
            observations = request.results()
            if observations is None:
                print("[OCR] Warning: No observations returned from recognition", file=sys.stderr)
                return {
                    "text": "",
                    "confidence": 0.0
                }
            
            text_parts = []
            
            for observation in observations:
                try:
                    candidates = observation.topCandidates_(1)
                    if candidates and len(candidates) > 0:
                        text = candidates[0].string()
                        text_parts.append(text)
                except Exception as e:
                    print(f"[OCR] Warning: Failed to extract text from observation: {str(e)}", file=sys.stderr)
                    continue

            # Combine all text
            full_text = " ".join(text_parts)
            
            # Calculate confidence (simplified - average confidence)
            confidence = 0.9  # Apple Vision doesn't expose per-observation confidence easily
            if len(text_parts) == 0:
                confidence = 0.0
                print("[OCR] Warning: No text extracted from image", file=sys.stderr)

            print(f"[OCR] Success: Extracted {len(text_parts)} text parts, total length: {len(full_text)}", file=sys.stderr)
            return {
                "text": full_text,
                "confidence": confidence
            }
        except Exception as e:
            error_msg = f"Failed to extract text from results: {str(e)}"
            print(f"[OCR] Error: {error_msg}", file=sys.stderr)
            print(f"[OCR] Traceback: {traceback.format_exc()}", file=sys.stderr)
            return {"error": error_msg}
    except Exception as e:
        error_msg = f"Unexpected error in ocr_image: {str(e)}"
        print(f"[OCR] Error: {error_msg}", file=sys.stderr)
        print(f"[OCR] Traceback: {traceback.format_exc()}", file=sys.stderr)
        return {"error": error_msg}


def main():
    """Main entry point"""
    try:
        if len(sys.argv) < 2:
            error_msg = "Usage: macos_ocr.py <image_path>"
            print(f"[OCR] Error: {error_msg}", file=sys.stderr)
            print(json.dumps({"error": error_msg}))
            sys.exit(1)

        image_path = sys.argv[1]
        
        # Validate image path
        if not isinstance(image_path, str) or len(image_path.strip()) == 0:
            error_msg = "Invalid image path provided"
            print(f"[OCR] Error: {error_msg}", file=sys.stderr)
            print(json.dumps({"error": error_msg}))
            sys.exit(1)
        
        result = ocr_image(image_path)
        print(json.dumps(result))
        
        # Exit with error code if OCR failed
        if "error" in result:
            sys.exit(1)
    except Exception as e:
        error_msg = f"Fatal error in main: {str(e)}"
        print(f"[OCR] Fatal Error: {error_msg}", file=sys.stderr)
        print(f"[OCR] Traceback: {traceback.format_exc()}", file=sys.stderr)
        print(json.dumps({"error": error_msg}))
        sys.exit(1)


if __name__ == "__main__":
    main()
