#!/usr/bin/env python3
"""Analyze CSS files and find unused selectors."""

import os
import re
from pathlib import Path
from collections import defaultdict

# Directories to search
CSS_DIR = Path('app/static/css')
TEMPLATES_DIR = Path('app/templates')
JS_DIR = Path('app/static/js')

def extract_css_selectors(css_file):
    """Extract all selectors from a CSS file."""
    with open(css_file, 'r', encoding='utf-8') as f:
        content = f.read()

    # Remove comments
    content = re.sub(r'/\*.*?\*/', '', content, flags=re.DOTALL)

    # Extract selectors (simplified - handles basic cases)
    selectors = []
    # Match patterns like .class-name, #id-name, element
    pattern = r'([.#]?[\w-]+(?:\s*[>+~]\s*[.#]?[\w-]+)*)\s*(?:,|\{)'

    matches = re.finditer(pattern, content)
    for match in matches:
        selector = match.group(1).strip()
        if selector and not selector.startswith('@'):
            # Clean up selector
            selector = selector.replace(' ', '').replace('>', '').replace('+', '').replace('~', '')
            selectors.append(selector)

    return selectors

def extract_classes_from_html(html_file):
    """Extract class names from HTML file."""
    with open(html_file, 'r', encoding='utf-8') as f:
        content = f.read()

    # Find all class attributes
    classes = set()
    class_matches = re.finditer(r'class=["\']([^"\']+)["\']', content)
    for match in class_matches:
        class_list = match.group(1).split()
        classes.update(class_list)

    # Find all id attributes
    ids = set()
    id_matches = re.finditer(r'id=["\']([^"\']+)["\']', content)
    for match in id_matches:
        ids.add(match.group(1))

    return classes, ids

def extract_classes_from_js(js_file):
    """Extract class names and IDs from JavaScript file."""
    with open(js_file, 'r', encoding='utf-8') as f:
        content = f.read()

    classes = set()
    ids = set()

    # Find classList operations
    class_matches = re.finditer(r'classList\.(add|remove|toggle)\(["\']([^"\']+)["\']\)', content)
    for match in class_matches:
        classes.add(match.group(2))

    # Find className assignments
    class_matches = re.finditer(r'className\s*=\s*["\']([^"\']+)["\']', content)
    for match in class_matches:
        class_list = match.group(1).split()
        classes.update(class_list)

    # Find getElementById
    id_matches = re.finditer(r'getElementById\(["\']([^"\']+)["\']\)', content)
    for match in id_matches:
        ids.add(match.group(1))

    # Find querySelector with ID
    id_matches = re.finditer(r'querySelector\(["\']#([^"\']+)["\']\)', content)
    for match in id_matches:
        ids.add(match.group(1))

    # Find querySelector with class
    class_matches = re.finditer(r'querySelector\(["\']\.([^"\']+)["\']\)', content)
    for match in class_matches:
        classes.add(match.group(1))

    return classes, ids

def main():
    """Main analysis function."""
    print("Analyzing CSS usage...\n")

    # Collect all CSS selectors
    css_selectors = defaultdict(list)
    for css_file in CSS_DIR.glob('*.css'):
        selectors = extract_css_selectors(css_file)
        for selector in selectors:
            css_selectors[css_file.name].append(selector)

    # Collect all used classes and IDs
    used_classes = set()
    used_ids = set()

    # From HTML files
    for html_file in TEMPLATES_DIR.glob('*.html'):
        classes, ids = extract_classes_from_html(html_file)
        used_classes.update(classes)
        used_ids.update(ids)
        print(f"HTML {html_file.name}: {len(classes)} classes, {len(ids)} IDs")

    # From JS files
    for js_file in JS_DIR.glob('*.js'):
        classes, ids = extract_classes_from_js(js_file)
        used_classes.update(classes)
        used_ids.update(ids)
        print(f"JS {js_file.name}: {len(classes)} classes, {len(ids)} IDs")

    print(f"\nTotal used classes: {len(used_classes)}")
    print(f"Total used IDs: {len(used_ids)}")

    # Analyze each CSS file
    print("\n" + "="*80)
    for css_file, selectors in css_selectors.items():
        print(f"\n{css_file}:")
        print(f"Total selectors: {len(selectors)}")

        # Check for unused selectors
        unused = []
        for selector in set(selectors):
            # Skip pseudo-classes, media queries, etc.
            if ':' in selector or '@' in selector:
                continue

            # Extract class or ID name
            if selector.startswith('.'):
                name = selector[1:]
                if name not in used_classes:
                    unused.append(selector)
            elif selector.startswith('#'):
                name = selector[1:]
                if name not in used_ids:
                    unused.append(selector)

        if unused:
            print(f"\nPotentially unused selectors ({len(unused)}):")
            for sel in sorted(unused):
                print(f"  - {sel}")
        else:
            print("  All selectors appear to be used!")

if __name__ == '__main__':
    main()
