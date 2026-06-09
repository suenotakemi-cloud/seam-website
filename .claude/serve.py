#!/usr/bin/env python3
"""Static file server bound to the SEAM site root."""
import os
import sys
import http.server
import socketserver

ROOT = "/Users/suenotakemi/Downloads/code_sandbox_light_a3728b14_1778910042"
PORT = int(sys.argv[1]) if len(sys.argv) > 1 else 8765

os.chdir(ROOT)

class Handler(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=ROOT, **kwargs)
    def log_message(self, format, *args):
        sys.stderr.write("%s - %s\n" % (self.address_string(), format % args))

with socketserver.TCPServer(("127.0.0.1", PORT), Handler) as httpd:
    print(f"SEAM site serving at http://127.0.0.1:{PORT}/", flush=True)
    httpd.serve_forever()
