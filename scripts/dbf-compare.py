#!/usr/bin/env python3
"""
Compare our generated DBF bytes against the reference amdalnet template DBF
to find any structural difference that could cause amdalnet's parser to
read all KETERANGAN as identical.

Usage: python3 scripts/dbf-compare.py <our.dbf> <template.dbf>
"""
import sys
import struct

def read_dbf(path):
    data = open(path, 'rb').read()
    magic = data[0]
    year, month, day = struct.unpack('>BBB', data[1:4])
    num_rec, header_len, rec_len = struct.unpack('<IHH', data[4:12])
    
    fields = []
    off = 32
    while True:
        if data[off] == 0x0d:
            off += 1
            break
        if data[off] == 0x00:
            break
        name = data[off:off+11].decode('utf-8').rstrip('\x00').rstrip()
        ftype = chr(data[off+11])
        fdec = data[off+17]
        flen = data[off+16]
        fields.append({'name': name, 'type': ftype, 'len': flen, 'dec': fdec})
        off += 32
    
    data_start = header_len
    rows = []
    for r in range(num_rec):
        base = data_start + r * rec_len
        del_flag = data[base]
        pos = base + 1
        row = {}
        for f in fields:
            row[f['name']] = data[pos:pos+f['len']].decode('utf-8', errors='replace').strip()
            pos += f['len']
        rows.append(row)
    
    return {
        'magic': magic,
        'date': (year, month, day),
        'num_rec': num_rec,
        'header_len': header_len,
        'rec_len': rec_len,
        'fields': fields,
        'rows': rows,
        'eof': data[-1],
    }

if len(sys.argv) < 3:
    print("Usage: python3 dbf-compare.py <our.dbf> <template.dbf>")
    sys.exit(1)

ours = read_dbf(sys.argv[1])
theirs = read_dbf(sys.argv[2])

print("=" * 60)
print("OUR DBF")
print(f"  magic=0x{ours['magic']:02x} date={ours['date']} num_rec={ours['num_rec']} header_len={ours['header_len']} rec_len={ours['rec_len']} eof=0x{ours['eof']:02x}")
for f in ours['fields']:
    print(f"  {f['name']:12s} {f['type']}({f['len']},{f['dec']})")
for i, row in enumerate(ours['rows']):
    print(f"  row {i}: KODE={row.get('KODE','?')!r} KETERANGAN={row.get('KETERANGAN','?')!r}")

print()
print("TEMPLATE DBF")
print(f"  magic=0x{theirs['magic']:02x} date={theirs['date']} num_rec={theirs['num_rec']} header_len={theirs['header_len']} rec_len={theirs['rec_len']} eof=0x{theirs['eof']:02x}")
for f in theirs['fields']:
    print(f"  {f['name']:12s} {f['type']}({f['len']},{f['dec']})")
for i, row in enumerate(theirs['rows'][:3]):
    print(f"  row {i}: KODE={row.get('KODE','?')!r} KETERANGAN={row.get('KETERANGAN','?')!r}")

print()
print("=" * 60)
print("DIFFS")
diffs = 0
if ours['magic'] != theirs['magic']:
    print(f"  magic: 0x{ours['magic']:02x} vs 0x{theirs['magic']:02x}")
    diffs += 1
if ours['num_rec'] != theirs['num_rec']:
    print(f"  num_rec: {ours['num_rec']} vs {theirs['num_rec']}")
if ours['header_len'] != theirs['header_len']:
    print(f"  header_len: {ours['header_len']} vs {theirs['header_len']}")
    diffs += 1
if ours['rec_len'] != theirs['rec_len']:
    print(f"  rec_len: {ours['rec_len']} vs {theirs['rec_len']}")
    diffs += 1
if ours['fields'] != theirs['fields']:
    print("  field schema mismatch:")
    for i, (a, b) in enumerate(zip(ours['fields'], theirs['fields'])):
        if a != b:
            print(f"    field {i}: {a} vs {b}")
            diffs += 1
    if len(ours['fields']) != len(theirs['fields']):
        print(f"    field count: {len(ours['fields'])} vs {len(theirs['fields'])}")
        diffs += 1
if ours['eof'] != theirs['eof']:
    print(f"  eof: 0x{ours['eof']:02x} vs 0x{theirs['eof']:02x}")
    diffs += 1
if diffs == 0:
    print("  NO structural differences found.")
