# ADR-007: Internationalization (i18n) Strategy

## Status
Accepted

## Context
We need to support multiple languages and locales to serve a global customer base. Our requirements:
- Support 10+ languages at launch
- Right-to-left (RTL) language support (Arabic, Hebrew)
- Number, date, and currency formatting
- Locale-specific content
- Developer-friendly workflow
- No hardcoded strings (enforced by CI)
- Dynamic language switching without page reload

## Decision
We will use **react-i18next** for the frontend and **i18next** for the backend, with translation files managed in JSON format and strict CI enforcement against hardcoded strings.

## Supported Languages (Launch)

| Code | Language | Native Name | Status | RTL |
|------|----------|-------------|--------|-----|
| `en-US` | English (US) | English | ✅ Default | No |
| `es-ES` | Spanish (Spain) | Español | ✅ Launch | No |
| `fr-FR` | French (France) | Français | ✅ Launch | No |
| `de-DE` | German (Germany) | Deutsch | ✅ Launch | No |
| `pt-BR` | Portuguese (Brazil) | Português | ✅ Launch | No |
| `ja-JP` | Japanese | 日本語 | ✅ Launch | No |
| `zh-CN` | Chinese (Simplified) | 简体中文 | ✅ Launch | No |
| `ko-KR` | Korean | 한국어 | ✅ Launch | No |
| `ar-SA` | Arabic (Saudi Arabia) | العربية | ⏳ Q2 | Yes |
| `he-IL` | Hebrew (Israel) | עברית | ⏳ Q2 | Yes |

## Implementation

### Frontend (react-i18next)

#### Setup
```typescript
// apps/portal/src/i18n.ts
import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import LanguageDetector from 'i18next-browser-languagedetector';
import Backend from 'i18next-http-backend';

i18n
  .use(Backend)
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    fallbackLng: 'en-US',
    supportedLngs: ['en-US', 'es-ES', 'fr-FR', 'de-DE', 'pt-BR', 'ja-JP', 'zh-CN', 'ko-KR'],

    detection: {
      order: ['localStorage', 'navigator', 'htmlTag'],
      caches: ['localStorage'],
    },

    backend: {
      loadPath: '/locales/{{lng}}/{{ns}}.json',
    },

    interpolation: {
      escapeValue: false, // React already escapes
    },

    react: {
      useSuspense: true,
    },
  });

export default i18n;
```

#### Usage in Components
```typescript
import { useTranslation } from 'react-i18next';

function OrganizationList() {
  const { t } = useTranslation('organizations');

  return (
    <div>
      <h1>{t('title')}</h1>
      <p>{t('description', { count: organizations.length })}</p>
      <button>{t('actions.create')}</button>
    </div>
  );
}
```

#### Translation Files
```json
// public/locales/en-US/organizations.json
{
  "title": "Organizations",
  "description_one": "You have {{count}} organization",
  "description_other": "You have {{count}} organizations",
  "actions": {
    "create": "Create Organization",
    "edit": "Edit",
    "delete": "Delete"
  },
  "form": {
    "name": {
      "label": "Organization Name",
      "placeholder": "Enter name",
      "error": "Name is required"
    }
  }
}
```

```json
// public/locales/es-ES/organizations.json
{
  "title": "Organizaciones",
  "description_one": "Tienes {{count}} organización",
  "description_other": "Tienes {{count}} organizaciones",
  "actions": {
    "create": "Crear Organización",
    "edit": "Editar",
    "delete": "Eliminar"
  }
}
```

### Backend (i18next + email templates)

```typescript
// apps/api/src/i18n/i18n.service.ts
import i18next from 'i18next';
import Backend from 'i18next-fs-backend';

await i18next
  .use(Backend)
  .init({
    lng: 'en-US',
    fallbackLng: 'en-US',
    preload: ['en-US', 'es-ES', 'fr-FR'],

    backend: {
      loadPath: './locales/{{lng}}/{{ns}}.json',
    },
  });

// Usage in email templates
function sendWelcomeEmail(user: User) {
  const t = i18next.getFixedT(user.locale);

  return sendEmail({
    to: user.email,
    subject: t('emails:welcome.subject'),
    body: t('emails:welcome.body', { name: user.name }),
  });
}
```

## Translation File Structure

```
tools/translations/
  source/                    # Source translations (en-US)
    common.json              # Common UI strings
    organizations.json
    users.json
    billing.json
    errors.json
    emails.json

  locales/                   # Generated translations
    en-US/
      common.json
      organizations.json
    es-ES/
      common.json
      organizations.json
    fr-FR/
      ...
```

## Translation Workflow

### 1. Developer Adds New String
```typescript
// In code
<button>{t('organizations:actions.archive')}</button>
```

### 2. Extract New Keys
```bash
pnpm i18n:extract
# Scans code for t() calls, adds missing keys to en-US/*.json
```

### 3. Send for Translation
```bash
pnpm i18n:export
# Creates CSV with untranslated strings
# Upload to translation service (Lokalise, Crowdin)
```

### 4. Import Translations
```bash
pnpm i18n:import
# Downloads translated CSV, updates locale files
```

### 5. CI Validation
```bash
pnpm i18n:validate
# Checks:
# - All keys exist in all languages
# - No hardcoded strings in code
# - Interpolation variables match
```

## Formatting

### Numbers
```typescript
// Format number with locale
const price = new Intl.NumberFormat(locale, {
  style: 'currency',
  currency: 'USD',
}).format(99.99);

// en-US: $99.99
// de-DE: 99,99 $
// fr-FR: 99,99 $US
```

### Dates
```typescript
// Format date with locale
const date = new Intl.DateTimeFormat(locale, {
  year: 'numeric',
  month: 'long',
  day: 'numeric',
}).format(new Date());

// en-US: January 15, 2024
// es-ES: 15 de enero de 2024
// ja-JP: 2024年1月15日
```

### Relative Time
```typescript
import { formatDistance } from 'date-fns';
import { enUS, es, fr, de } from 'date-fns/locale';

const locales = { 'en-US': enUS, 'es-ES': es, 'fr-FR': fr, 'de-DE': de };

const relativeTime = formatDistance(new Date(), pastDate, {
  locale: locales[currentLocale],
  addSuffix: true,
});

// en-US: 2 hours ago
// es-ES: hace 2 horas
```

## RTL Support

### CSS Direction
```css
/* Automatically switches based on locale */
html[dir="rtl"] {
  direction: rtl;
}

html[dir="ltr"] {
  direction: ltr;
}

/* Logical properties (direction-agnostic) */
.card {
  margin-inline-start: 1rem;  /* margin-left in LTR, margin-right in RTL */
  padding-inline: 2rem;        /* padding-left/right in LTR, reversed in RTL */
}
```

### React Component
```typescript
import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';

function App() {
  const { i18n } = useTranslation();

  useEffect(() => {
    const isRTL = ['ar-SA', 'he-IL'].includes(i18n.language);
    document.documentElement.setAttribute('dir', isRTL ? 'rtl' : 'ltr');
  }, [i18n.language]);

  return <div>...</div>;
}
```

## Pluralization

### English (2 forms)
```json
{
  "organizations_one": "{{count}} organization",
  "organizations_other": "{{count}} organizations"
}
```

### French (2 forms)
```json
{
  "organizations_one": "{{count}} organisation",
  "organizations_other": "{{count}} organisations"
}
```

### Polish (3 forms)
```json
{
  "organizations_one": "{{count}} organizacja",
  "organizations_few": "{{count}} organizacje",
  "organizations_many": "{{count}} organizacji"
}
```

### Arabic (6 forms!)
```json
{
  "organizations_zero": "لا توجد منظمات",
  "organizations_one": "منظمة واحدة",
  "organizations_two": "منظمتان",
  "organizations_few": "{{count}} منظمات",
  "organizations_many": "{{count}} منظمة",
  "organizations_other": "{{count}} منظمة"
}
```

## User Language Preference

### Detection Priority
1. **User setting** (stored in database)
2. **localStorage** (browser storage)
3. **Accept-Language header** (HTTP request)
4. **Browser language** (navigator.language)
5. **Default** (en-US)

### Storing Preference
```typescript
async function setUserLanguage(userId: UserId, locale: string) {
  await prisma.user.update({
    where: { id: userId },
    data: { locale },
  });

  // Update session context
  ctx.locale = locale;

  // Client updates
  i18n.changeLanguage(locale);
  localStorage.setItem('locale', locale);
}
```

## CI Enforcement

### ESLint Rule: No Hardcoded Strings
```typescript
// .eslintrc.js
module.exports = {
  rules: {
    'i18n/no-hardcoded-strings': ['error', {
      ignoreAttributes: ['data-testid', 'aria-label'],
      ignoreCallee: ['console.log', 'console.error'],
      ignoreComponents: [],
    }],
  },
};

// ❌ FAIL
<button>Create Organization</button>

// ✅ PASS
<button>{t('organizations:actions.create')}</button>
```

### Missing Translation Check
```bash
# CI pipeline
pnpm i18n:validate

# Checks:
# - All keys in en-US exist in other languages
# - No missing interpolation variables
# - No empty translation values
```

### Type Safety
```typescript
// Generate TypeScript types from en-US translations
// @generated by i18n-json-to-typescript
export interface Translations {
  common: {
    save: string;
    cancel: string;
    delete: string;
  };
  organizations: {
    title: string;
    'actions.create': string;
  };
}

// Usage with autocomplete
const { t } = useTranslation<Translations>();
t('organizations:actions.create'); // ✅ Type-safe
t('organizations:actions.invalid'); // ❌ Type error
```

## Performance

### Code Splitting
```typescript
// Load translations on-demand
import('../../locales/es-ES/organizations.json')
  .then((translations) => {
    i18n.addResourceBundle('es-ES', 'organizations', translations);
  });
```

### Bundle Size
```
en-US: 120 KB
es-ES: 125 KB
fr-FR: 130 KB
de-DE: 128 KB
ja-JP: 145 KB (larger due to character set)
zh-CN: 140 KB
```

Only load active language + fallback (en-US).

## Translation Coverage

### Required Coverage
- All features: 100% (enforced by CI)
- Documentation: 80% (manual)
- Marketing pages: 100% (manual)

### Translation Quality
- Professional translations (not machine-translated)
- Native speaker review
- Context provided to translators

## Consequences

### Positive
- **Global reach**: Serve customers in their language
- **Better UX**: Native language = better comprehension
- **Compliance**: Some regions require local language
- **Competitive advantage**: Many competitors US-only
- **No hardcoded strings**: Enforced by CI

### Negative
- **Complexity**: More files to maintain
- **Cost**: Professional translation services
- **Testing burden**: Must test in all languages
- **Bundle size**: Larger initial download

### Mitigations
- **Automated extraction**: Reduce manual work
- **Code splitting**: Load only needed languages
- **Translation memory**: Reuse translations across projects
- **Community contributions**: Allow user-contributed translations

## Alternatives Considered

### 1. Client-Side Translation (Google Translate Widget)
**Rejected**: Poor quality, no control, breaks React

### 2. Polyglot.js
**Rejected**: Less features than i18next

### 3. FormatJS (React Intl)
**Rejected**: More complex API, less ecosystem

## Future Enhancements

### 1. In-Context Editing
Allow translators to edit directly in UI:
```typescript
<Trans i18nKey="welcome" components={{ bold: <strong /> }}>
  Welcome, <bold>{{name}}</bold>!
</Trans>
```

### 2. A/B Testing Translations
Test different phrasings:
```typescript
const variant = getExperimentVariant('welcome-text');
const key = variant === 'A' ? 'welcome' : 'welcome.variant';
t(key);
```

### 3. Machine Translation Fallback
For less critical text:
```typescript
if (!translations[locale]) {
  translations[locale] = await translateWithAI(translations['en-US'], locale);
}
```

## References
- [i18next Documentation](https://www.i18next.com/)
- [react-i18next Documentation](https://react.i18next.com/)
- [Unicode CLDR](https://cldr.unicode.org/)
- [RTL Best Practices](https://rtlstyling.com/)

## Review Date
2024-04-16 (3 months)
