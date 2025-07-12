#!/bin/bash

# 0tomait SSL Security Check Script
# Run this after deploying to verify SSL is working correctly

echo "🔒 0tomait SSL Security Check"
echo "=============================="

# Colors for output
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Your domain
DOMAIN="0tomait.com"

echo -e "\n📋 Checking SSL Configuration for $DOMAIN\n"

# Check if domain redirects to HTTPS
echo -n "1. Checking HTTP to HTTPS redirect... "
HTTP_STATUS=$(curl -s -o /dev/null -w "%{http_code}" -L http://$DOMAIN)
HTTPS_URL=$(curl -s -o /dev/null -w "%{url_effective}" -L http://$DOMAIN)

if [[ $HTTPS_URL == https://* ]]; then
    echo -e "${GREEN}✓ Pass${NC}"
else
    echo -e "${RED}✗ Fail${NC} - Not redirecting to HTTPS"
fi

# Check SSL certificate validity
echo -n "2. Checking SSL certificate validity... "
if openssl s_client -connect $DOMAIN:443 -servername $DOMAIN < /dev/null 2>/dev/null | openssl x509 -noout -checkend 0; then
    echo -e "${GREEN}✓ Pass${NC}"
else
    echo -e "${RED}✗ Fail${NC} - Certificate may be expired or invalid"
fi

# Check security headers
echo -n "3. Checking security headers... "
HEADERS=$(curl -s -I https://$DOMAIN)

if echo "$HEADERS" | grep -q "Strict-Transport-Security"; then
    echo -e "${GREEN}✓ HSTS enabled${NC}"
else
    echo -e "${YELLOW}⚠ HSTS not detected${NC}"
fi

# Check for mixed content
echo -n "4. Checking for mixed content issues... "
PAGE_CONTENT=$(curl -s https://$DOMAIN)
if echo "$PAGE_CONTENT" | grep -q "http://"; then
    echo -e "${YELLOW}⚠ Warning${NC} - Found HTTP references (check for mixed content)"
else
    echo -e "${GREEN}✓ Pass${NC}"
fi

echo -e "\n📊 SSL Test Results Summary:"
echo "================================"
echo "✅ Run full test at: https://www.ssllabs.com/ssltest/analyze.html?d=$DOMAIN"
echo "✅ Check security headers at: https://securityheaders.com/?q=$DOMAIN"
echo "✅ Monitor uptime at: https://uptimerobot.com/"

echo -e "\n🚀 Next Steps:"
echo "1. Update all internal links to use HTTPS"
echo "2. Submit HTTPS version to Google Search Console"
echo "3. Update social media profiles with HTTPS URL"
echo "4. Monitor SSL certificate expiration (set reminder)"

echo -e "\n✨ SSL Security Check Complete!"