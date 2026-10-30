#!/usr/bin/env bash
#
# Compress screen-recording videos (e.g. macOS Screenshot app .mov files) into
# small, web-friendly, silent .mp4 files for the presentation.
#
# Usage:
#   ./compress-videos.sh [options] [file...]
#
# With no file arguments, every *.mov (and *.MOV) file found in --input-dir
# is processed. Pass explicit file paths to only process those files.
#
# Options:
#   -i, --input-dir DIR     Directory to scan for videos when no files are
#                            given (default: ../assets, relative to this script)
#   -o, --output-dir DIR    Where to write the compressed .mp4 files
#                            (default: same directory as the source file)
#   -e, --ext EXT            Source extension to look for in --input-dir,
#                            without the dot (default: mov)
#   -s, --scale FACTOR      Resolution scale factor applied to width & height,
#                            e.g. 0.5 = half resolution (default: 0.6)
#   -f, --fps FPS            Output frame rate cap (default: 24)
#   -c, --crf VALUE          x264 quality (lower = better/bigger, default: 28)
#   -p, --preset PRESET      x264 encoding preset (default: slow)
#       --delete-originals  Remove the source file after a successful,
#                            smaller conversion
#       --overwrite          Overwrite the destination .mp4 if it exists
#       --dry-run            Show what would be done without encoding
#   -h, --help                Show this help
#
# Examples:
#   ./compress-videos.sh
#   ./compress-videos.sh --scale 0.5 --fps 20 --crf 30
#   ./compress-videos.sh --delete-originals "../assets/video - demo.mov"

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

INPUT_DIR="$SCRIPT_DIR/../assets"
OUTPUT_DIR=""
SRC_EXT="mov"
SCALE="0.6"
FPS="24"
CRF="28"
PRESET="slow"
DELETE_ORIGINALS=0
OVERWRITE=0
DRY_RUN=0
FILES=()

usage() {
  sed -n '2,33p' "${BASH_SOURCE[0]}" | sed 's/^# \{0,1\}//'
}

human_size() {
  local bytes=$1
  if command -v numfmt >/dev/null 2>&1; then
    numfmt --to=iec-i --suffix=B --format="%.1f" "$bytes"
  else
    awk -v b="$bytes" 'BEGIN { printf "%.1fMB", b/1024/1024 }'
  fi
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    -i|--input-dir) INPUT_DIR="$2"; shift 2 ;;
    -o|--output-dir) OUTPUT_DIR="$2"; shift 2 ;;
    -e|--ext) SRC_EXT="$2"; shift 2 ;;
    -s|--scale) SCALE="$2"; shift 2 ;;
    -f|--fps) FPS="$2"; shift 2 ;;
    -c|--crf) CRF="$2"; shift 2 ;;
    -p|--preset) PRESET="$2"; shift 2 ;;
    --delete-originals) DELETE_ORIGINALS=1; shift ;;
    --overwrite) OVERWRITE=1; shift ;;
    --dry-run) DRY_RUN=1; shift ;;
    -h|--help) usage; exit 0 ;;
    --) shift; while [[ $# -gt 0 ]]; do FILES+=("$1"); shift; done ;;
    -*) echo "Unknown option: $1" >&2; usage; exit 1 ;;
    *) FILES+=("$1"); shift ;;
  esac
done

if ! command -v ffmpeg >/dev/null 2>&1; then
  echo "ffmpeg is required but was not found. Install it with: brew install ffmpeg" >&2
  exit 1
fi

if [[ ${#FILES[@]} -eq 0 ]]; then
  if [[ ! -d "$INPUT_DIR" ]]; then
    echo "Input directory not found: $INPUT_DIR" >&2
    exit 1
  fi
  while IFS= read -r -d '' f; do
    FILES+=("$f")
  done < <(find "$INPUT_DIR" -maxdepth 1 -type f -iname "*.${SRC_EXT}" -print0 | sort -z)
fi

if [[ ${#FILES[@]} -eq 0 ]]; then
  echo "No .$SRC_EXT files found in $INPUT_DIR"
  exit 0
fi

echo "Found ${#FILES[@]} video(s) to process"
echo "Settings: scale=${SCALE}x  fps=${FPS}  crf=${CRF}  preset=${PRESET}  audio=stripped"
echo

total_before=0
total_after=0
failed=()

for src in "${FILES[@]}"; do
  if [[ ! -f "$src" ]]; then
    echo "Skip (not found): $src" >&2
    failed+=("$src")
    continue
  fi

  src_dir="$(cd "$(dirname "$src")" && pwd)"
  base="$(basename "$src")"
  name="${base%.*}"

  dest_dir="${OUTPUT_DIR:-$src_dir}"
  mkdir -p "$dest_dir"
  dest="$dest_dir/$name.mp4"

  if [[ -e "$dest" && $OVERWRITE -eq 0 ]]; then
    echo "Skip (exists, use --overwrite): $dest"
    continue
  fi

  before_size=$(stat -f%z "$src" 2>/dev/null || stat -c%s "$src")

  echo "Compressing: $base"
  echo "  -> $dest"

  if [[ $DRY_RUN -eq 1 ]]; then
    echo "  (dry-run, skipped)"
    continue
  fi

  tmp_dest="$dest.tmp.mp4"

  if ! ffmpeg -y -hide_banner -loglevel error -i "$src" \
      -an \
      -vf "scale=trunc(iw*${SCALE}/2)*2:trunc(ih*${SCALE}/2)*2" \
      -r "$FPS" \
      -c:v libx264 -preset "$PRESET" -crf "$CRF" \
      -pix_fmt yuv420p \
      -movflags +faststart \
      "$tmp_dest"; then
    echo "  FAILED to encode $src" >&2
    rm -f "$tmp_dest"
    failed+=("$src")
    continue
  fi

  mv "$tmp_dest" "$dest"

  after_size=$(stat -f%z "$dest" 2>/dev/null || stat -c%s "$dest")
  total_before=$((total_before + before_size))
  total_after=$((total_after + after_size))

  pct=$(awk -v b="$before_size" -v a="$after_size" 'BEGIN { printf "%.0f", (1 - a/b) * 100 }')
  echo "  $(human_size "$before_size") -> $(human_size "$after_size")  (-${pct}%)"

  if [[ $DELETE_ORIGINALS -eq 1 && "$dest" != "$src" ]]; then
    if [[ $after_size -lt $before_size ]]; then
      rm -f "$src"
      echo "  Removed original: $src"
    else
      echo "  Kept original (compressed file is not smaller): $src"
    fi
  fi

  echo
done

if [[ $DRY_RUN -eq 0 && $total_before -gt 0 ]]; then
  total_pct=$(awk -v b="$total_before" -v a="$total_after" 'BEGIN { printf "%.0f", (1 - a/b) * 100 }')
  echo "Total: $(human_size "$total_before") -> $(human_size "$total_after")  (-${total_pct}%)"
fi

if [[ ${#failed[@]} -gt 0 ]]; then
  echo
  echo "Failed files:"
  printf '  %s\n' "${failed[@]}"
  exit 1
fi
