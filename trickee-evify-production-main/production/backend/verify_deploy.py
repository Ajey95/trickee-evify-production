#!/usr/bin/env python3
"""
Trickee EV Intelligence - Deployment & WebSockets Verification Utility
This script performs verification checks on a deployed or local instance of the backend:
1. Pings the REST health check endpoint (/health).
2. Performs login and requests a short-lived WebSocket ticket (if credentials provided).
3. Executes a raw TCP/SSL WebSocket handshake (upgrade request) to verify wss:// routing and CORS rules.

Usage:
  python verify_deploy.py --url http://localhost:8000 --email admin@trickee.ai --password demo_pass
"""

import argparse
import base64
import json
import socket
import ssl
import sys
import urllib.parse
import urllib.request
from typing import Dict, Optional, Tuple


def log_success(msg: str):
    print(f"\033[92m[✓] {msg}\033[0m")


def log_info(msg: str):
    print(f"\033[94m[*] {msg}\033[0m")


def log_warn(msg: str):
    print(f"\033[93m[!] {msg}\033[0m")


def log_error(msg: str):
    print(f"\033[91m[✗] {msg}\033[0m")


def clean_base_url(url: str) -> str:
    """Strip trailing slash and /api/v1 if present."""
    url = url.rstrip("/")
    if url.endswith("/api/v1"):
        url = url[:-7]
    return url


def parse_http_status_and_headers(raw_response: bytes) -> Tuple[int, str, Dict[str, str]]:
    """Parse raw HTTP response bytes into status code, status message, and headers dictionary."""
    headers_part = raw_response.split(b"\r\n\r\n")[0].decode("utf-8", errors="ignore")
    lines = headers_part.split("\r\n")
    if not lines or not lines[0]:
        return 0, "", {}

    # Status line example: HTTP/1.1 101 Switching Protocols
    status_line = lines[0]
    parts = status_line.split(" ", 2)
    status_code = 0
    status_msg = ""
    if len(parts) >= 2:
        try:
            status_code = int(parts[1])
        except ValueError:
            pass
        if len(parts) > 2:
            status_msg = parts[2]

    headers = {}
    for line in lines[1:]:
        if ":" in line:
            key, val = line.split(":", 1)
            headers[key.strip().lower()] = val.strip()

    return status_code, status_msg, headers


def perform_raw_ws_handshake(
    ws_url: str,
    origin: Optional[str] = None
) -> Tuple[int, str, Dict[str, str], Optional[bytes]]:
    """Perform a raw TCP/SSL WebSocket handshake and return HTTP response parameters."""
    parsed = urllib.parse.urlparse(ws_url)
    host = parsed.hostname
    if not host:
        raise ValueError(f"Invalid host in WebSocket URL: {ws_url}")

    # Set default ports if not specified
    if parsed.scheme == "wss":
        port = parsed.port or 443
    elif parsed.scheme == "ws":
        port = parsed.port or 80
    else:
        raise ValueError(f"Unsupported scheme in WebSocket URL: {parsed.scheme}")

    path = parsed.path
    if not path:
        path = "/"
    if parsed.query:
        path += "?" + parsed.query

    # Create connection
    log_info(f"Establishing TCP connection to {host}:{port}...")
    sock = socket.create_connection((host, port), timeout=6)

    if parsed.scheme == "wss":
        log_info("Wrapping socket in SSL/TLS context...")
        context = ssl.create_default_context()
        sock = context.wrap_socket(sock, server_hostname=host)

    # Generate WebSocket Key
    ws_key = base64.b64encode(b"trickee-verify-sec-key-12345").decode("utf-8")

    # Form HTTP Upgrade Request
    req = (
        f"GET {path} HTTP/1.1\r\n"
        f"Host: {host}\r\n"
        f"Upgrade: websocket\r\n"
        f"Connection: Upgrade\r\n"
        f"Sec-WebSocket-Key: {ws_key}\r\n"
        f"Sec-WebSocket-Version: 13\r\n"
    )
    if origin:
        req += f"Origin: {origin}\r\n"
    req += "\r\n"

    log_info(f"Sending WebSocket Upgrade Handshake to {path}...")
    sock.sendall(req.encode("utf-8"))

    # Read response headers (look for \r\n\r\n boundary)
    response = b""
    while b"\r\n\r\n" not in response:
        chunk = sock.recv(1024)
        if not chunk:
            break
        response += chunk

    # Try to check if there is an immediate close code frame sent
    extra_data = None
    if b"\r\n\r\n" in response:
        parts = response.split(b"\r\n\r\n", 1)
        if len(parts) > 1 and len(parts[1]) > 0:
            extra_data = parts[1]
        else:
            # Try to read a bit more data in case of immediate socket closing frames
            sock.settimeout(0.5)
            try:
                extra_data = sock.recv(1024)
            except socket.timeout:
                pass

    sock.close()

    status_code, status_msg, headers = parse_http_status_and_headers(response)
    return status_code, status_msg, headers, extra_data


def test_health_endpoint(base_url: str):
    health_url = f"{base_url}/health"
    log_info(f"Pinging health check endpoint at: {health_url}")
    try:
        req = urllib.request.Request(health_url, method="GET")
        with urllib.request.urlopen(req, timeout=5) as resp:
            status = resp.status
            body = resp.read().decode("utf-8")
            data = json.loads(body)
            
            if status == 200 and data.get("status") == "ok":
                log_success(f"Health check passed! Response: {data}")
                return True
            else:
                log_error(f"Health check failed (status={status}): {data}")
                return False
    except Exception as e:
        log_error(f"Failed to connect to health endpoint: {e}")
        return False


def attempt_login(base_url: str, email: str, password: str) -> Optional[str]:
    login_url = f"{base_url}/api/v1/auth/login"
    log_info(f"Attempting login for '{email}' at: {login_url}")
    payload = json.dumps({"email": email, "password": password}).encode("utf-8")
    req = urllib.request.Request(
        login_url,
        data=payload,
        headers={"Content-Type": "application/json"},
        method="POST"
    )
    try:
        with urllib.request.urlopen(req, timeout=5) as resp:
            data = json.loads(resp.read().decode("utf-8"))
            if data.get("success") and "access_token" in data.get("data", {}):
                token = data["data"]["access_token"]
                log_success("Login successful! Token acquired.")
                return token
            else:
                log_error(f"Login failed (response structure mismatch): {data}")
                return None
    except Exception as e:
        log_error(f"Login request failed: {e}")
        return None


def get_websocket_ticket(base_url: str, token: str) -> Optional[str]:
    ticket_url = f"{base_url}/api/v1/auth/ws-ticket"
    log_info(f"Requesting WebSocket ticket from: {ticket_url}")
    req = urllib.request.Request(
        ticket_url,
        headers={"Authorization": f"Bearer {token}"},
        method="GET"
    )
    try:
        with urllib.request.urlopen(req, timeout=5) as resp:
            data = json.loads(resp.read().decode("utf-8"))
            if data.get("success") and "ticket" in data.get("data", {}):
                ticket = data["data"]["ticket"]
                log_success(f"WebSocket ticket acquired: {ticket[:15]}...")
                return ticket
            else:
                log_error(f"Failed to acquire ticket (response structure mismatch): {data}")
                return None
    except Exception as e:
        log_error(f"Ticket request failed: {e}")
        return None


def main():
    parser = argparse.ArgumentParser(description="Verify Trickee deployment and WebSockets configuration.")
    parser.add_argument("--url", default="http://localhost:8000", help="Base backend URL (e.g. https://trickee-backend.onrender.com)")
    parser.add_argument("--email", help="Account email address for testing WS ticket")
    parser.add_argument("--password", help="Account password for testing WS ticket")
    parser.add_argument("--origin", default="https://trickee-evify-live.vercel.app", help="CORS Origin header to verify")
    args = parser.parse_args()

    base_url = clean_base_url(args.url)
    print("=" * 60)
    print(f"VERIFYING DEPLOYMENT AT: {base_url}")
    print("=" * 60)

    # 1. Health check test
    health_ok = test_health_endpoint(base_url)
    if not health_ok:
        log_warn("Health check is not OK. Checks will continue, but verify routing/port configuration.")

    # Convert REST scheme to WebSocket scheme
    parsed_base = urllib.parse.urlparse(base_url)
    ws_scheme = "wss" if parsed_base.scheme == "https" else "ws"
    ws_base_url = f"{ws_scheme}://{parsed_base.netloc}"

    # 2. Authentication and Ticket Fetching
    ticket = None
    if args.email and args.password:
        token = attempt_login(base_url, args.email, args.password)
        if token:
            ticket = get_websocket_ticket(base_url, token)
    else:
        log_warn("No credentials provided via --email and --password. Authentic ticket-based handshake cannot be verified.")

    # 3. WebSocket Handshake Tests
    print("\n" + "-" * 50)
    print("RUNNING WEBSOCKET HANDSHAKE VERIFICATIONS")
    print("-" * 50)

    # Test 3a: Verification with required parameters (using ticket if available)
    if ticket:
        ws_test_url = f"{ws_base_url}/ws/live-map?ticket={ticket}"
        log_info(f"Test A: Handshake with active WebSocket ticket on: {ws_base_url}/ws/live-map")
        try:
            status, msg, headers, extra = perform_raw_ws_handshake(ws_test_url, args.origin)
            if status == 101:
                log_success(f"WebSocket upgrade handshake completed with code 101 (Switching Protocols)!")
                # Check if it was closed with code 4001 immediately (indicating ticket issues)
                if extra and len(extra) >= 2:
                    # WebSocket close frame format: first 2 bytes contains the close code
                    # Usually 0x88 is close opcode
                    if extra[0] == 0x88:
                        close_code = int.from_bytes(extra[2:4], byteorder='big')
                        if close_code == 4001:
                            log_error("Socket upgraded, but server immediately closed the connection with code 4001 (Unauthorized Ticket).")
                        else:
                            log_warn(f"Socket upgraded, but connection closed with code {close_code}.")
                    else:
                        log_success("Socket handshake succeeded and stream is active.")
                else:
                    log_success("Socket handshake succeeded and stream is active.")
            else:
                log_error(f"WebSocket upgrade handshake failed. Status code: {status} ({msg}). Headers: {headers}")
        except Exception as e:
            log_error(f"WebSocket handshake failed with connection exception: {e}")
    else:
        # Without credentials, let's run a ticket-less test (should be rejected with 422 or 4001)
        ws_test_url = f"{ws_base_url}/ws/live-map"
        log_info(f"Test A (Ticketless): Upgrading without query ticket on: {ws_base_url}/ws/live-map")
        try:
            status, msg, headers, _ = perform_raw_ws_handshake(ws_test_url, args.origin)
            if status == 422:
                log_success("Handshake correctly rejected with HTTP 422 Unprocessable Entity (Missing required ticket query parameters).")
            elif status == 101:
                log_warn("Handshake completed with 101 despite missing ticket. Check backend authentication middleware!")
            else:
                log_info(f"Handshake returned code {status} ({msg}). This indicates the WebSocket route is active.")
        except Exception as e:
            log_error(f"Ticketless handshake request failed: {e}")

    # Test 3b: Verification with invalid ticket (should upgrade but immediately close with 4001)
    ws_invalid_url = f"{ws_base_url}/ws/live-map?ticket=invalid_ticket_placeholder"
    log_info(f"\nTest B: Handshake with invalid ticket on: {ws_base_url}/ws/live-map?ticket=...")
    try:
        status, msg, headers, extra = perform_raw_ws_handshake(ws_invalid_url, args.origin)
        if status == 101:
            log_success("Upgrade request completed (101 Switching Protocols). Checking for subsequent close code...")
            # We expect the server to immediately close with 4001
            # Check response bytes for Close frame
            if extra:
                # Opcode 0x88 indicates close frame
                # A basic websocket frame: [fin/rsv/opcode] [mask/payload_len] [payload...]
                # Opcode is lower 4 bits of first byte. 8 = Close frame.
                is_close = (extra[0] & 0x0F) == 8
                if is_close:
                    payload_len = extra[1] & 0x7F
                    if payload_len >= 2:
                        close_code = int.from_bytes(extra[2:4], byteorder='big')
                        if close_code == 4001:
                            log_success("Verified: Server immediately closed the connection with close code 4001 (Unauthorized ticket)!")
                        else:
                            log_warn(f"Server closed connection with code {close_code} instead of 4001.")
                    else:
                        log_warn("Server closed connection immediately without payload close code.")
                else:
                    log_warn(f"Received unexpected non-close frame from server: {extra[:10]}")
            else:
                log_warn("Connection upgraded but no close frame was detected immediately in socket read buffer.")
        else:
            log_error(f"Upgrade failed with HTTP status code: {status} ({msg}). Expected 101 with immediate close.")
    except Exception as e:
        log_error(f"Invalid ticket test failed with exception: {e}")

    # Test 3c: Test Origin header (CORS check)
    log_info(f"\nTest C: Handshake with forbidden Origin (testing CORS origin policy)")
    forbidden_origin = "https://malicious-origin-check.com"
    try:
        # Fast API WebSockets don't reject handshakes automatically on origin mismatch unless explicitly configured,
        # but let's test if headers or upgrade works.
        status, msg, headers, _ = perform_raw_ws_handshake(ws_invalid_url, forbidden_origin)
        log_info(f"Handshake with forbidden origin returned HTTP status {status} ({msg}).")
        # In FastAPI, standard CORSMiddleware does not automatically intercept WebSocket handshakes unless done in route or custom middleware,
        # so check if CORS behaves as expected.
    except Exception as e:
        log_error(f"CORS Origin verification failed: {e}")

    print("\n" + "=" * 60)
    print("VERIFICATION COMPLETE")
    print("=" * 60)


if __name__ == "__main__":
    try:
        main()
    except KeyboardInterrupt:
        print("\nVerification cancelled.")
        sys.exit(1)
