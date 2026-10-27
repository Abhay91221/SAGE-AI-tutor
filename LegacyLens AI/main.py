"""
LegacyLens AI: Main Command-Line Interface & Application Launcher
"""

from __future__ import annotations

import argparse
import os
import sys

CURRENT_DIR = os.path.dirname(os.path.abspath(__file__))
if CURRENT_DIR not in sys.path:
    sys.path.insert(0, CURRENT_DIR)

from engine import run_engine_demo
from pipeline import run_pipeline_demo


def main() -> None:
    parser = argparse.ArgumentParser(
        description="LegacyLens AI: Codebase Modernization & Documentation Engine"
    )
    parser.add_argument(
        "--mode",
        choices=["all", "engine", "pipeline", "web"],
        default="engine",
        help="Execution mode (default: engine)",
    )
    parser.add_argument(
        "--file",
        type=str,
        default=None,
        help="Path to custom source code file to analyze",
    )
    parser.add_argument(
        "--query",
        type=str,
        default=None,
        help="Query for AST-grounded RAG",
    )

    args = parser.parse_args()

    if args.mode == "web":
        import subprocess
        streamlit_bin = os.path.join(CURRENT_DIR, ".venv", "Scripts", "streamlit.exe")
        cmd = [streamlit_bin if os.path.exists(streamlit_bin) else "streamlit", "run", "app.py"]
        print(f"Launching Streamlit web app: {' '.join(cmd)}")
        subprocess.run(cmd)
    elif args.mode == "pipeline":
        run_pipeline_demo()
    else:
        run_engine_demo()


if __name__ == "__main__":
    main()
