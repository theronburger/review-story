#!/usr/bin/env python3
"""Validate review structure and pinned source before generating speech."""
import argparse
import subprocess
from build import validate_review

if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('review')
    args = parser.parse_args()
    try:
        review, sources, cards = validate_review(args.review)
    except (ValueError, KeyError, OSError, TypeError, subprocess.CalledProcessError) as error:
        parser.exit(1, f'Review invalid: {error}\n')
    print(f'Review valid: {len(sources)} source files, {len(cards)} cards.')
