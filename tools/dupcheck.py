#!/usr/bin/env python3
"""usage: dupcheck.py <new_vocab_file.json>  -> lists headwords of the file that already exist in other raw vocab files"""
import glob, json, os, sys
me = os.path.abspath(sys.argv[1]); raw = os.path.dirname(me)
have = {}
for f in glob.glob(os.path.join(raw, 'vocab_*.json')):
    if os.path.abspath(f) == me: continue
    for o in json.load(open(f, encoding='utf-8')): have.setdefault(o['w'].lower(), os.path.basename(f))
d = [o['w'] for o in json.load(open(me, encoding='utf-8')) if o['w'].lower() in have]
print('NO DUPLICATES' if not d else f'{len(d)} DUPLICATES (replace them with other words): ' + ', '.join(d))
sys.exit(1 if d else 0)
