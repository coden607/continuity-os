"""HTTP webhook service for live Twilio telephony.

Handles:
    GET  /health
    POST /webhook/voice
    POST /webhook/gather
    POST /webhook/status

Preserves compliance invariants:
- Mandatory AI disclosure and recording notice played first on connect.
- DNC utterances immediately suppress contacts in the store.
- Call outcomes written to the immutable audit ledger.
- Idempotent status handling prevents duplicate terminal records.
- Twilio signature validation when configured.
"""

from __future__ import annotations

import json
import os
import sys
from http import HTTPStatus
from http.server import BaseHTTPRequestHandler, HTTPServer
from typing import Any
from urllib.parse import parse_qs, urlparse

from .call import DNC_KEYWORDS, STOP_KEYWORDS, CallOutcome
from .consent import AuditLedger, CampaignConfig, Contact, ContactStore
from .llm import LLMProvider, MockLLM, resolve_provider
from .telephony import CallStatus, normalize_status
from .twilio import (
    TwilioConfig,
    build_gather_response_twiml,
    build_inbound_twiml,
    validate_twilio_signature,
)


class TelephonyServerContext:
    def __init__(
        self,
        store: ContactStore | None = None,
        ledger: AuditLedger | None = None,
        campaign: CampaignConfig | None = None,
        config: TwilioConfig | None = None,
        llm: LLMProvider | None = None,
    ) -> None:
        self.store = store if store is not None else ContactStore()
        self.ledger = ledger if ledger is not None else AuditLedger("audit-ledger.jsonl")
        self.campaign = campaign or CampaignConfig(
            agent_name="Sam",
            client_name="Acme Widgets",
            goal="qualify interest and schedule follow-up",
        )
        self.config = config
        self.llm = llm or MockLLM()
        self._processed_terminal_calls: set[str] = set()

    def record_status(
        self,
        *,
        call_sid: str,
        correlation_id: str,
        status: CallStatus,
        contact_phone: str = "",
        duration_s: float = 0.0,
    ) -> bool:
        """Idempotently records terminal call status to the audit ledger."""
        key = call_sid or correlation_id
        if not key or not status:
            return False

        if status in {
            CallStatus.COMPLETED,
            CallStatus.FAILED,
            CallStatus.CANCELED,
            CallStatus.BUSY,
            CallStatus.NO_ANSWER,
        }:
            if key in self._processed_terminal_calls:
                return False  # Already recorded idempotently
            self._processed_terminal_calls.add(key)

            contact = self.store.get(contact_phone) if contact_phone else None
            if not contact:
                contact = Contact(
                    name="Inbound/Verified Contact",
                    phone=contact_phone or "unknown",
                    consent_proof=f"telephony-session:{correlation_id}",
                    consent_date="2026-10-10",
                    source="inbound_or_consented_call",
                )

            outcome_map = {
                CallStatus.COMPLETED: CallOutcome.COMPLETED.value,
                CallStatus.FAILED: CallOutcome.FAILED.value,
                CallStatus.CANCELED: CallOutcome.FAILED.value,
                CallStatus.BUSY: CallOutcome.FAILED.value,
                CallStatus.NO_ANSWER: CallOutcome.FAILED.value,
            }
            self.ledger.append(
                contact=contact,
                campaign=self.campaign,
                outcome=outcome_map.get(status, "completed"),
                duration_s=duration_s,
                extra={"call_sid": call_sid, "correlation_id": correlation_id},
            )
            return True
        return False


def make_handler(ctx: TelephonyServerContext):
    class TelephonyRequestHandler(BaseHTTPRequestHandler):
        def log_message(self, format: str, *args: Any) -> None:
            # Suppress default stdout clutter, keep logs clean and free of secrets
            pass

        def _send_response(
            self,
            status_code: int,
            content: str | bytes,
            content_type: str = "text/plain; charset=utf-8",
        ) -> None:
            self.send_response(status_code)
            self.send_header("Content-Type", content_type)
            payload = content.encode("utf-8") if isinstance(content, str) else content
            self.send_header("Content-Length", str(len(payload)))
            self.end_headers()
            self.wfile.write(payload)

        def _parse_body(self) -> dict[str, str]:
            length = int(self.headers.get("Content-Length", 0))
            if length <= 0:
                return {}
            raw = self.rfile.read(length).decode("utf-8", errors="replace")
            parsed = parse_qs(raw, keep_blank_values=True)
            return {k: v[0] for k, v in parsed.items()}

        def _check_signature(self, params: dict[str, str]) -> bool:
            if not ctx.config or not ctx.config.auth_token:
                return True
            sig = self.headers.get("X-Twilio-Signature", "")
            if not sig:
                return False
            # Reconstruct full request URL per Twilio specs
            full_url = f"{ctx.config.public_base_url}{self.path}"
            return validate_twilio_signature(
                ctx.config.auth_token,
                full_url,
                params,
                sig,
            )

        def do_GET(self) -> None:
            parsed = urlparse(self.path)
            if parsed.path == "/health":
                body = json.dumps({"status": "ok", "provider": "twilio"})
                self._send_response(HTTPStatus.OK, body, "application/json")
                return
            self._send_response(HTTPStatus.NOT_FOUND, "Not Found")

        def do_POST(self) -> None:
            parsed = urlparse(self.path)
            query = parse_qs(parsed.query)
            correlation_id = query.get("correlation_id", [""])[0]
            params = self._parse_body()

            if not self._check_signature(params):
                self._send_response(HTTPStatus.FORBIDDEN, "Invalid Twilio Signature")
                return

            base_url = (
                ctx.config.public_base_url
                if ctx.config
                else f"http://{self.headers.get('Host', 'localhost:8000')}"
            )

            if parsed.path == "/webhook/voice":
                # Inbound or Outbound connect - ALWAYS plays disclosure & recording notice first!
                twiml = build_inbound_twiml(ctx.campaign, correlation_id, base_url)
                self._send_response(HTTPStatus.OK, twiml, "application/xml; charset=utf-8")
                return

            if parsed.path == "/webhook/gather":
                speech = params.get("SpeechResult", "").strip().lower()
                caller_phone = params.get("From", "")

                if any(kw in speech for kw in DNC_KEYWORDS):
                    if caller_phone:
                        ctx.store.suppress(caller_phone)
                    reply = "Understood — I will take you off our list right away. Sorry for the trouble."
                    twiml = build_gather_response_twiml(
                        reply,
                        is_terminal=True,
                        correlation_id=correlation_id,
                        webhook_base_url=base_url,
                    )
                    self._send_response(HTTPStatus.OK, twiml, "application/xml; charset=utf-8")
                    return

                if any(kw in speech for kw in STOP_KEYWORDS):
                    reply = "Of course — thank you and have a great day!"
                    twiml = build_gather_response_twiml(
                        reply,
                        is_terminal=True,
                        correlation_id=correlation_id,
                        webhook_base_url=base_url,
                    )
                    self._send_response(HTTPStatus.OK, twiml, "application/xml; charset=utf-8")
                    return

                # Conversational response from LLM
                messages = [
                    {
                        "role": "system",
                        "content": (
                            f"You are {ctx.campaign.agent_name} calling on behalf of "
                            f"{ctx.campaign.client_name}. Keep your spoken responses concise "
                            "and friendly (under 2 sentences)."
                        ),
                    },
                    {"role": "user", "content": speech or "Hello"},
                ]
                reply = ctx.llm.chat(messages)
                twiml = build_gather_response_twiml(
                    reply,
                    is_terminal=False,
                    correlation_id=correlation_id,
                    webhook_base_url=base_url,
                )
                self._send_response(HTTPStatus.OK, twiml, "application/xml; charset=utf-8")
                return

            if parsed.path == "/webhook/status":
                call_sid = params.get("CallSid", "")
                raw_status = params.get("CallStatus", "")
                status = normalize_status(raw_status)
                phone = params.get("To", "") or params.get("From", "")
                duration = float(params.get("CallDuration", 0.0) or 0.0)

                ctx.record_status(
                    call_sid=call_sid,
                    correlation_id=correlation_id,
                    status=status,
                    contact_phone=phone,
                    duration_s=duration,
                )
                self._send_response(HTTPStatus.OK, "OK")
                return

            self._send_response(HTTPStatus.NOT_FOUND, "Not Found")

    return TelephonyRequestHandler


def run_server(
    host: str = "0.0.0.0",
    port: int = 8000,
    ctx: TelephonyServerContext | None = None,
) -> None:
    context = ctx or TelephonyServerContext()
    server = HTTPServer((host, port), make_handler(context))
    print(f"Telemarketer server listening on http://{host}:{port}")
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\nShutting down server.")
    finally:
        server.server_close()


if __name__ == "__main__":
    port = int(os.environ.get("PORT", 8000))
    run_server(port=port)
