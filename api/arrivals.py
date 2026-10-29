"""Explicit Vercel HTTP entrypoint; shared-budget absence blocks all BIS calls."""
from http.server import BaseHTTPRequestHandler
from server.hosted_api import handler as HostedHandler


class handler(BaseHTTPRequestHandler):
    log_message = HostedHandler.log_message
    respond = HostedHandler.respond

    def do_GET(self):
        return HostedHandler.do_GET(self)

    def do_POST(self):
        return HostedHandler.do_POST(self)
