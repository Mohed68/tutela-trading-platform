# Security Headers Deployment Guide

## Overview

TUTELA platform implements comprehensive security headers to protect against common web vulnerabilities including XSS, clickjacking, CSRF, and other attacks.

## Implemented Security Headers

### Content Security Policy (CSP)
- **Purpose**: Prevents XSS attacks by controlling resource loading
- **Configuration**: See `server/security.ts`
- **Key Features**:
  - Restricts script sources to trusted domains
  - Allows necessary third-party services (Stripe, Google)
  - Prevents inline script execution (except where required)
  - Blocks object and embed tags

### HTTP Strict Transport Security (HSTS)
- **Purpose**: Enforces HTTPS connections
- **Settings**: 
  - Max age: 1 year
  - Include subdomains: Yes
  - Preload eligible: Yes

### X-Frame-Options
- **Purpose**: Prevents clickjacking attacks
- **Setting**: DENY (completely prevents framing)

### X-Content-Type-Options
- **Purpose**: Prevents MIME type sniffing
- **Setting**: nosniff

### Referrer Policy
- **Purpose**: Controls referrer information leakage
- **Setting**: strict-origin-when-cross-origin

### Permissions Policy
- **Purpose**: Controls browser feature access
- **Restrictions**:
  - Camera: Blocked
  - Microphone: Blocked
  - USB: Blocked
  - Geolocation: Self only
  - Payment: Self only

## Deployment Checklist

### Pre-Deployment
- [ ] Test all security headers in staging
- [ ] Verify CSP doesn't break functionality
- [ ] Check console for CSP violations
- [ ] Test payment flows with Stripe
- [ ] Verify third-party integrations work

### Production Deployment
- [ ] Ensure HTTPS is properly configured
- [ ] HSTS headers are active
- [ ] CSP is in enforcement mode (not report-only)
- [ ] Monitor error logs for security violations
- [ ] Set up CSP violation reporting endpoint

### Post-Deployment Monitoring
- [ ] Regular security header audits
- [ ] Monitor CSP violation reports
- [ ] Update CSP directives as needed
- [ ] Test new feature compatibility

## CSP Violation Troubleshooting

Common issues and solutions:

### Inline Scripts Blocked
- **Error**: "Refused to execute inline script"
- **Solution**: Move to external files or add nonce/hash

### Third-Party Resources Blocked
- **Error**: "Refused to load resource"
- **Solution**: Add domain to appropriate CSP directive

### WebSocket Connections Failed
- **Error**: WebSocket connection refused
- **Solution**: Add WebSocket URLs to connect-src

## Testing Security Headers

Use these tools to verify implementation:

```bash
# Check headers
curl -I https://your-domain.com

# Security header analysis
curl -s https://securityheaders.com/?q=your-domain.com

# CSP testing
curl -H "Content-Security-Policy-Report-Only: ..." https://your-domain.com
```

## Maintenance

### Regular Updates
- Review CSP directives quarterly
- Update HSTS max-age annually
- Monitor new security header standards
- Test with latest browser versions

### Security Audits
- Use Mozilla Observatory
- Check OWASP security guidelines
- Perform penetration testing
- Review third-party integrations

## Emergency Procedures

If security headers break production:

1. **Immediate**: Set CSP to report-only mode
2. **Analyze**: Check violation reports
3. **Fix**: Update CSP directives
4. **Test**: Verify in staging
5. **Deploy**: Re-enable enforcement mode

## Contact

For security-related issues:
- Security team: security@tutela.com
- On-call: +1-XXX-XXX-XXXX
- Emergency: security-emergency@tutela.com