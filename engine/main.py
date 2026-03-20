import argparse
import sys
import json
import os

# Ensure the engine directory is in the Python path regardless of the working directory
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from strategies.preview_extraction import PreviewExtractionStrategy
from strategies.header_grafting import HeaderGraftingStrategy
from strategies.marker_sanitization import MarkerSanitizationStrategy
from strategies.mcu_alignment import McuAlignmentStrategy
from strategies.png_chunk_rebuilder import PngChunkRebuilderStrategy
from strategies.heic_box_recovery import HeicBoxRecoveryStrategy
from strategies.tiff_ifd_rebuilder import TiffIfdRebuilderStrategy

def send_progress(job_id: str, percent: int, stage: str, status: str = "running", error_message: str = None, repaired_path: str = None):
    # Sends a JSON message back to the Node backend via stdout
    msg = {
        "job_id": job_id,
        "percent": percent,
        "stage": stage,
        "status": status
    }
    if error_message:
        msg["error_message"] = error_message
    if repaired_path:
        msg["repaired_path"] = repaired_path
        
    print(json.dumps(msg))
    sys.stdout.flush()

def main():
    parser = argparse.ArgumentParser(description="Photo Repair Engine")
    parser.add_argument("--job-id", required=True, help="Job ID")
    parser.add_argument("--file-path", required=True, help="Path to the corrupted file")
    parser.add_argument("--strategy", required=True, help="Repair strategy name")
    parser.add_argument("--reference-path", required=False, help="Path to the reference file (if required by strategy)")
    parser.add_argument("--output-dir", required=False, help="Directory to save the output file")

    args = parser.parse_args()

    # Inform the backend that we've started
    send_progress(args.job_id, 5, f"Engine initialized for strategy: {args.strategy}")

    try:
        strategies_ext_map = {
            "preview-extraction": (".jpg", PreviewExtractionStrategy()),
            "header-grafting": (".jpg", HeaderGraftingStrategy()),
            "marker-sanitization": (".jpg", MarkerSanitizationStrategy()),
            "mcu-alignment": (".jpg", McuAlignmentStrategy()),
            "png-chunk-rebuilder": (".png", PngChunkRebuilderStrategy()),
            "heic-box-recovery": (".heic", HeicBoxRecoveryStrategy()),
            "tiff-ifd-rebuilder": (".tiff", TiffIfdRebuilderStrategy())
        }
        
        map_entry = strategies_ext_map.get(args.strategy)
        
        if not map_entry:
            raise ValueError(f"Unknown strategy requested: {args.strategy}")

        ext_to_use, strategy = map_entry

        # Compute a default output path
        directory = args.output_dir if args.output_dir else os.path.dirname(args.file_path)
        filename = os.path.basename(args.file_path)
        name, ext = os.path.splitext(filename)
        output_path = os.path.join(directory, f"{name}_repaired{ext_to_use}")

        send_progress(args.job_id, 25, f"Executing {strategy.name} repair logic...", "running")
        
        result = strategy.repair(input_path=args.file_path, output_path=output_path, reference_path=args.reference_path)
        
        if result.get("success"):
            send_progress(
                args.job_id, 
                100, 
                "Complete.", 
                status="done", 
                repaired_path=result.get("output_path", output_path)
            )
        else:
            send_progress(
                args.job_id, 
                0, 
                "Failed", 
                status="failed", 
                error_message=result.get("error", "Unknown error returned by strategy")
            )
            sys.exit(1)
            
    except Exception as e:
        send_progress(args.job_id, 0, "Failed", "failed", str(e))
        sys.exit(1)

if __name__ == "__main__":
    main()
