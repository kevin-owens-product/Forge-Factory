# ADR-016: Accessibility & Internationalization Strategy

## Status
Accepted

## Context

Enterprise customers require:
- **Accessibility (a11y)**: WCAG 2.1 AA compliance (legal requirement for enterprises)
- **Internationalization (i18n)**: Multi-language support (global customers)

### Target Markets
- **US/Canada**: English (primary)
- **Europe**: French, German, Spanish
- **Asia-Pacific**: Japanese, Korean (future)

### Legal Requirements
- **ADA**: Americans with Disabilities Act
- **Section 508**: US Federal accessibility standard
- **EN 301 549**: European accessibility standard

## Decision

### 1. Accessibility: WCAG 2.1 AA Compliance

**Approach**:
- **Component Library**: Radix UI (built-in a11y)
- **Testing**: axe-core automated testing
- **Manual Testing**: Screen reader testing (NVDA, JAWS, VoiceOver)
- **Keyboard Navigation**: All features accessible via keyboard

**Implementation**:
```typescript
// All components use semantic HTML
<button> instead of <div onClick>
<nav>, <main>, <aside> for landmarks
<label> for form inputs

// ARIA attributes where needed
<button aria-label="Close dialog" aria-expanded={isOpen}>
  <X />
</button>

// Skip to main content
<a href="#main-content" className="sr-only focus:not-sr-only">
  Skip to main content
</a>

// Focus management
import { FocusTrap } from '@radix-ui/react-focus-trap'

<Dialog>
  <FocusTrap>
    <DialogContent>
      {/* Focus trapped within dialog */}
    </DialogContent>
  </FocusTrap>
</Dialog>
```

**Automated Testing**:
```typescript
// playwright.config.ts
import { injectAxe, checkA11y } from 'axe-playwright'

test('dashboard is accessible', async ({ page }) => {
  await page.goto('/dashboard')
  await injectAxe(page)
  await checkA11y(page)
})
```

**CI/CD Integration**:
```yaml
# .github/workflows/a11y.yml
name: Accessibility Audit
on: [pull_request]

jobs:
  a11y:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - name: Run axe-core
        run: npm run test:a11y
      - name: Lighthouse CI
        run: lhci autorun
```

### 2. Internationalization: next-intl

**Selected**: next-intl (for Next.js App Router)

**Directory Structure**:
```
/apps/portal/
  /messages/
    en.json
    fr.json
    de.json
    es.json
  /app/
    /[locale]/
      layout.tsx
      page.tsx
```

**Implementation**:
```typescript
// apps/portal/messages/en.json
{
  "common": {
    "cancel": "Cancel",
    "save": "Save",
    "delete": "Delete"
  },
  "dashboard": {
    "title": "Dashboard",
    "aiReadinessScore": "AI-Readiness Score",
    "repositories": "{count, plural, =0 {No repositories} =1 {1 repository} other {# repositories}}"
  }
}

// apps/portal/app/[locale]/layout.tsx
import { NextIntlClientProvider } from 'next-intl'
import { getMessages } from 'next-intl/server'

export default async function LocaleLayout({
  children,
  params: { locale },
}: {
  children: React.ReactNode
  params: { locale: string }
}) {
  const messages = await getMessages()

  return (
    <html lang={locale}>
      <body>
        <NextIntlClientProvider messages={messages}>
          {children}
        </NextIntlClientProvider>
      </body>
    </html>
  )
}

// Usage
import { useTranslations } from 'next-intl'

export function Dashboard() {
  const t = useTranslations('dashboard')

  return (
    <div>
      <h1>{t('title')}</h1>
      <p>{t('aiReadinessScore')}</p>
      <p>{t('repositories', { count: 5 })}</p>
    </div>
  )
}
```

**Language Switcher**:
```typescript
// apps/portal/components/language-switcher.tsx
export function LanguageSwitcher() {
  const locale = useLocale()
  const router = useRouter()
  const pathname = usePathname()

  const changeLanguage = (newLocale: string) => {
    router.replace(pathname, { locale: newLocale })
  }

  return (
    <Select value={locale} onValueChange={changeLanguage}>
      <option value="en">English</option>
      <option value="fr">Français</option>
      <option value="de">Deutsch</option>
      <option value="es">Español</option>
    </Select>
  )
}
```

## Consequences

### Positive
- **Compliance**: WCAG 2.1 AA compliant (legal requirement met)
- **Market Expansion**: Support for European customers
- **User Experience**: Screen reader users can navigate effectively

### Negative
- **Translation Cost**: $0.10/word × 10K words = $1K per language
- **Maintenance**: Keep translations in sync with features
- **Testing Overhead**: Manual screen reader testing required

### Mitigations
- Use translation management platform (Lokalise, Phrase)
- Automate translation sync in CI/CD
- Hire accessibility consultant for annual audit

## Metrics
- **WCAG Score**: 100% AA compliance (0 critical violations)
- **Lighthouse Accessibility**: 95+ score
- **Screen Reader**: 100% of features usable with NVDA/JAWS
- **Translation Coverage**: 95%+ strings translated

## References
- [WCAG 2.1 Guidelines](https://www.w3.org/WAI/WCAG21/quickref/)
- [next-intl Documentation](https://next-intl-docs.vercel.app/)

---

**Document Version**: 1.0
**Last Updated**: 2026-01-20
