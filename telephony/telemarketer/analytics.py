"""Analytics and reporting for the audit ledger.

Produces summary statistics on calls, conversion outcomes, and compliance metrics.
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import Any, Sequence

from .consent import AuditLedger, LedgerEntry


@dataclass(frozen=True)
class AnalyticsSummary:
    total_calls: int
    unique_contacts: int
    outcomes: dict[str, int]
    compliance_rate: float
    disclosure_rate: float
    notice_rate: float
    total_duration_s: float
    avg_duration_s: float

    def to_dict(self) -> dict[str, Any]:
        return {
            "total_calls": self.total_calls,
            "unique_contacts": self.unique_contacts,
            "outcomes": dict(self.outcomes),
            "compliance_rate": round(self.compliance_rate, 4),
            "disclosure_rate": round(self.disclosure_rate, 4),
            "notice_rate": round(self.notice_rate, 4),
            "total_duration_s": round(self.total_duration_s, 2),
            "avg_duration_s": round(self.avg_duration_s, 2),
        }

    def format_report(self) -> str:
        lines = [
            "================ TELEMARKETER AI ANALYTICS ================",
            f"Total calls:          {self.total_calls}",
            f"Unique contacts:      {self.unique_contacts}",
            f"Total talk time:      {self.total_duration_s:.1f}s (avg: {self.avg_duration_s:.1f}s)",
            "",
            "Compliance Metrics:",
            f"  Consent Verified:   {self.compliance_rate * 100:.1f}%",
            f"  AI Disclosure:      {self.disclosure_rate * 100:.1f}%",
            f"  Recording Notice:   {self.notice_rate * 100:.1f}%",
            "",
            "Call Outcomes:",
        ]
        if not self.outcomes:
            lines.append("  (none)")
        else:
            for outcome, count in sorted(self.outcomes.items(), key=lambda x: -x[1]):
                pct = (count / self.total_calls * 100) if self.total_calls else 0.0
                lines.append(f"  {outcome:<20} {count:>4} ({pct:>5.1f}%)")
        lines.append("===========================================================")
        return "\n".join(lines)


def generate_analytics(entries: Sequence[LedgerEntry] | AuditLedger) -> AnalyticsSummary:
    records = entries.entries if isinstance(entries, AuditLedger) else list(entries)
    total = len(records)
    if total == 0:
        return AnalyticsSummary(
            total_calls=0,
            unique_contacts=0,
            outcomes={},
            compliance_rate=1.0,
            disclosure_rate=1.0,
            notice_rate=1.0,
            total_duration_s=0.0,
            avg_duration_s=0.0,
        )

    unique_contacts = len({e.phone for e in records})
    outcomes: dict[str, int] = {}
    compliant_count = 0
    disclosure_count = 0
    notice_count = 0
    total_duration = 0.0

    for e in records:
        outcomes[e.outcome] = outcomes.get(e.outcome, 0) + 1
        if e.consent_check_passed:
            compliant_count += 1
        if e.disclosure_played:
            disclosure_count += 1
        if e.recording_notice_played:
            notice_count += 1
        total_duration += e.duration_s

    return AnalyticsSummary(
        total_calls=total,
        unique_contacts=unique_contacts,
        outcomes=outcomes,
        compliance_rate=compliant_count / total,
        disclosure_rate=disclosure_count / total,
        notice_rate=notice_count / total,
        total_duration_s=round(total_duration, 3),
        avg_duration_s=round(total_duration / total, 3),
    )
