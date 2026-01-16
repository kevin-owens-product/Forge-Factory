# Security Policy

## Supported Versions

| Version | Supported          |
| ------- | ------------------ |
| 1.x.x   | :white_check_mark: |

## Reporting a Vulnerability

**Please do not report security vulnerabilities through public GitHub issues.**

Instead, please report them via email to security@forge.io

Include the following information:

- Type of vulnerability
- Full paths of source file(s) related to the manifestation of the vulnerability
- Location of the affected source code (tag/branch/commit or direct URL)
- Step-by-step instructions to reproduce the issue
- Proof-of-concept or exploit code (if possible)
- Impact of the vulnerability

We will respond within 48 hours and provide regular updates.

## Security Measures

### Authentication & Authorization

- **JWT Tokens**: Short-lived access tokens (15 min) with refresh tokens
- **API Keys**: Scoped, revocable, with IP allowlisting
- **SSO**: SAML 2.0 support for enterprise customers
- **SCIM**: Automated user provisioning and deprovisioning
- **MFA**: Time-based one-time passwords (TOTP)
- **Session Management**: Secure, HttpOnly cookies with SameSite protection

### Data Protection

- **Encryption at Rest**: AES-256 for sensitive data
- **Encryption in Transit**: TLS 1.3 enforced
- **Database**: PostgreSQL with Row Level Security (RLS)
- **Tenant Isolation**: Database-level isolation with verified queries
- **PII Handling**: Marked fields with automatic compliance
- **Data Retention**: Configurable per data type

### Input Validation

- **Schema Validation**: Zod schemas for all inputs
- **SQL Injection**: Prevented via Prisma ORM
- **XSS**: Content Security Policy headers enforced
- **CSRF**: Tokens required for state-changing operations
- **File Uploads**: Malware scanning, type validation, size limits

### Network Security

- **WAF**: AWS WAF with OWASP rules
- **DDoS Protection**: CloudFront + AWS Shield
- **Rate Limiting**: Per-user and per-tenant limits
- **IP Allowlisting**: Enterprise feature for restricted access
- **CORS**: Strict origin policies

### Secrets Management

- **Environment Variables**: Never committed to source control
- **AWS Secrets Manager**: For production secrets
- **Key Rotation**: Automated quarterly rotation
- **Access Control**: Least privilege principle

### Audit & Monitoring

- **Audit Logs**: All security-relevant events logged
- **SIEM Integration**: Export to Splunk, DataDog, etc.
- **Alerting**: Real-time alerts for suspicious activity
- **Incident Response**: 24/7 monitoring for critical systems

### Dependency Security

- **Automated Scanning**: Snyk + Socket for vulnerabilities
- **Automated Updates**: Renovate bot for patches
- **License Compliance**: Tracked and validated
- **Supply Chain**: Verified packages only

### Secure Development

- **SAST**: Semgrep scans on every commit
- **Secret Scanning**: gitleaks prevents credential leaks
- **Code Review**: Required for all changes
- **Security Champions**: Dedicated security reviewers

### Compliance

- **SOC 2 Type II**: Annual audit
- **GDPR**: Data residency and privacy controls
- **HIPAA**: Business Associate Agreement available
- **CCPA**: California privacy compliance

### Penetration Testing

- **Frequency**: Annually by third-party
- **Scope**: Full application and infrastructure
- **Remediation**: All findings addressed within SLA

### Incident Response Plan

1. **Detection**: Automated monitoring + manual reports
2. **Triage**: Severity assessment within 15 minutes
3. **Containment**: Isolate affected systems
4. **Eradication**: Remove threat and patch vulnerability
5. **Recovery**: Restore systems and verify integrity
6. **Post-Mortem**: Document lessons learned

### Security Contact

- **Email**: security@forge.io
- **PGP Key**: Available at https://forge.io/.well-known/security.txt
- **Bug Bounty**: Available at https://forge.io/security/bug-bounty

### Security Updates

We will notify affected users of security updates via:

- Email to registered addresses
- In-app notifications
- Status page (https://status.forge.io)
- Security advisories (GitHub)

### Safe Harbor

We support safe harbor for security researchers who:

- Make a good faith effort to avoid privacy violations and service disruption
- Report vulnerabilities privately before public disclosure
- Give us reasonable time to address issues before publication

## Security Checklist for Contributors

Before submitting code:

- [ ] No secrets or credentials in code
- [ ] All inputs validated with Zod schemas
- [ ] SQL queries use Prisma (no raw SQL)
- [ ] File uploads scanned for malware
- [ ] Authentication required for protected routes
- [ ] Authorization checks present
- [ ] Audit logging for sensitive operations
- [ ] Error messages don't leak sensitive info
- [ ] HTTPS enforced
- [ ] CORS configured properly
- [ ] Rate limiting applied
- [ ] Tenant isolation verified
- [ ] Tests include security scenarios

## Security Headers

All HTTP responses include:

```
Strict-Transport-Security: max-age=31536000; includeSubDomains
Content-Security-Policy: default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval'; style-src 'self' 'unsafe-inline'
X-Frame-Options: DENY
X-Content-Type-Options: nosniff
X-XSS-Protection: 1; mode=block
Referrer-Policy: strict-origin-when-cross-origin
Permissions-Policy: geolocation=(), microphone=(), camera=()
```

## Secure Defaults

- Passwords: Minimum 12 characters, hashed with bcrypt
- Sessions: 15-minute idle timeout
- API Keys: 90-day expiration
- File Uploads: 10MB limit, restricted types
- Rate Limits: 100 requests/minute per user

## Known Limitations

None at this time.

## Security Resources

- [OWASP Top 10](https://owasp.org/www-project-top-ten/)
- [CWE Top 25](https://cwe.mitre.org/top25/)
- [NIST Cybersecurity Framework](https://www.nist.gov/cyberframework)
