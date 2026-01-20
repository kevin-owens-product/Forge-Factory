# Incident Response Runbooks

**Last Updated**: 2026-01-20

## Quick Reference

| Symptom | Runbook | Severity |
|---------|---------|----------|
| Analysis timeouts (> 5 min) | #1 Analysis Timeout | Critical |
| LLM API failures | #2 LLM Provider Outage | Critical |
| Database connection errors | #3 DB Connection Exhaustion | Critical |
| Rate limiting issues | #4 Rate Limit Exceeded | High |
| Webhook failures | #5 Webhook Failures | Medium |

## On-Call Procedures

**PagerDuty**: Primary escalation tool
**Slack**: #incidents channel for coordination
**Status Page**: Update every 30 minutes during incidents

For detailed runbooks for each failure mode, see individual sections above.

---

**Version**: 1.0
**Maintained By**: DevOps Team
