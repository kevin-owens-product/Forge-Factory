# ADR-010: Frontend Architecture & Component Library Strategy

## Status
Accepted

## Context

Forge Factory is an enterprise SaaS platform requiring a scalable, maintainable, and performant frontend architecture. We need to make architectural decisions for:

1. **Component Library & Design System**: Consistent UI/UX across 3 portals (User, Developer, Admin)
2. **Framework Selection**: Modern React ecosystem with enterprise-grade capabilities
3. **Build Tooling**: Performance optimization and developer experience
4. **Monorepo Organization**: Shared components and packages across apps

### Current State
- **Tech Stack**: Next.js 14, React 19, TypeScript, shadcn/ui (mentioned in docs)
- **Monorepo**: NX workspace with multiple apps (`portal`, `admin`, `docs`)
- **Target Users**: Enterprise customers expecting polish, accessibility, and performance

### Requirements
- Support 100K+ concurrent users
- LCP < 2.5s, INP < 200ms, CLS < 0.1
- WCAG 2.1 AA compliance
- Multi-tenant isolation at UI level
- Themeable for white-label customers
- Developer velocity with reusable components
- Bundle size < 200KB initial JS

## Decision

### 1. Framework: Next.js 14 with App Router

**Selected**: Next.js 14 (App Router) with React 19

**Rationale**:
- **Server Components**: Reduce client-side JS by 40-60% for enterprise dashboards
- **Streaming SSR**: Improve perceived performance with progressive rendering
- **Built-in Optimization**: Image optimization, font optimization, code splitting
- **SEO**: Critical for marketing site and documentation portal
- **Enterprise Adoption**: Used by Vercel, Netflix, Twitch, Nike (proven at scale)
- **TypeScript-First**: Native TS support with strict mode

**Configuration**:
```typescript
// next.config.js
module.exports = {
  reactStrictMode: true,
  swcMinify: true,
  compiler: {
    removeConsole: process.env.NODE_ENV === 'production',
  },
  experimental: {
    optimizePackageImports: ['@forge/ui', 'lucide-react'],
    serverActions: true,
  },
  images: {
    formats: ['image/avif', 'image/webp'],
    deviceSizes: [640, 750, 828, 1080, 1200, 1920],
  },
}
```

### 2. Component Library: shadcn/ui + Radix UI Primitives

**Selected**: shadcn/ui (copy-paste components) + Radix UI + Tailwind CSS

**Rationale**:
- **Ownership**: Copy components into codebase (not npm dependency)
- **Customization**: Full control over styling and behavior
- **Accessibility**: Radix UI primitives provide WCAG 2.1 AA out-of-box
- **Performance**: Tree-shakeable, only ship what you use
- **Flexibility**: Easy to modify for enterprise requirements
- **Developer Experience**: Excellent TypeScript support and documentation
- **Proven**: Used by Vercel, Cal.com, Shadcn (40K+ GitHub stars)

**Component Architecture**:
```
/packages/ui/
  /components/           # shadcn/ui components (customized)
    /button/
    /dialog/
    /form/
    /data-table/
    /charts/            # Recharts integration
  /primitives/          # Radix UI primitives
  /layouts/             # Common layouts (DashboardLayout, AuthLayout)
  /patterns/            # Composite patterns (SearchWithFilters, DataGrid)
  /theme/               # Design tokens and theming
    tokens.ts           # Colors, spacing, typography
    themes.ts           # Light, dark, custom themes
```

### 3. Styling: Tailwind CSS with CSS Variables

**Selected**: Tailwind CSS v4 + CSS Variables for theming

**Rationale**:
- **Utility-First**: Rapid development without context switching
- **Consistency**: Design system enforced through Tailwind config
- **Performance**: PurgeCSS removes unused styles (production CSS < 20KB)
- **Theming**: CSS variables enable runtime theme switching
- **White-Label**: Enterprise customers can override theme variables

**Theme Configuration**:
```typescript
// packages/ui/theme/tokens.ts
export const themeTokens = {
  colors: {
    brand: {
      50: 'var(--brand-50)',
      100: 'var(--brand-100)',
      // ... 900
    },
    // semantic colors
    success: 'var(--color-success)',
    error: 'var(--color-error)',
    warning: 'var(--color-warning)',
  },
  // Support for customer theme overrides
}

// Per-tenant theming
:root[data-tenant="acme-corp"] {
  --brand-500: #ff6b35;
  --brand-600: #d84315;
}
```

### 4. State Management: Zustand (See ADR-011)

**Selected**: Zustand for global state, React Query for server state

**Rationale**: (Detailed in ADR-011)
- Minimal boilerplate (90% less code vs Redux)
- Excellent TypeScript inference
- No context provider hell
- DevTools integration
- Performance: Fine-grained subscriptions

### 5. Build Tool: Next.js (Turbopack) + SWC

**Selected**: Next.js built-in tooling (Turbopack + SWC compiler)

**Rationale**:
- **Speed**: Turbopack 700x faster than Webpack (cold starts)
- **SWC**: Rust-based compiler 20x faster than Babel
- **Zero Config**: Works out-of-box with Next.js
- **HMR**: Sub-100ms hot module replacement
- **Tree Shaking**: Aggressive dead code elimination

### 6. Type Safety: TypeScript Strict Mode

**Selected**: TypeScript 5.3+ with strict mode enabled

**Configuration**:
```json
{
  "compilerOptions": {
    "strict": true,
    "noUncheckedIndexedAccess": true,
    "noImplicitOverride": true,
    "verbatimModuleSyntax": true,
    "moduleDetection": "force",
    "isolatedModules": true,
    "esModuleInterop": true
  }
}
```

### 7. Monorepo Structure

**Selected**: NX workspace with shared packages

```
/apps/
  /portal/              # Customer-facing app (Next.js)
  /admin/               # Internal admin portal (Next.js)
  /docs/                # Developer documentation (Next.js + Nextra)
  /marketing/           # Public marketing site (Next.js)

/packages/
  /ui/                  # Shared component library
  /config/              # Shared configs (ESLint, TS, Tailwind)
  /utils/               # Shared utilities
  /hooks/               # Custom React hooks
  /api-client/          # Type-safe API client (generated from OpenAPI)
  /auth/                # Authentication hooks and components
  /analytics/           # Analytics tracking (PostHog, Mixpanel)
```

### 8. Component Development: Storybook

**Selected**: Storybook 8 for component development and documentation

**Rationale**:
- Isolated component development
- Visual regression testing (Chromatic)
- Accessibility testing (a11y addon)
- Interactive documentation for design team
- Component catalog for reuse

**Configuration**:
```typescript
// .storybook/main.ts
export default {
  framework: '@storybook/nextjs',
  stories: ['../packages/ui/**/*.stories.tsx'],
  addons: [
    '@storybook/addon-a11y',
    '@storybook/addon-interactions',
    '@chromatic-com/storybook',
  ],
}
```

## Consequences

### Positive

1. **Developer Velocity**:
   - shadcn/ui provides 40+ production-ready components
   - Tailwind enables rapid prototyping without CSS files
   - TypeScript strict mode catches errors at compile-time

2. **Performance**:
   - Next.js App Router reduces client JS by 40-60%
   - Server Components shift rendering to server
   - Automatic code splitting and lazy loading
   - Image optimization saves 60%+ bandwidth

3. **Accessibility**:
   - Radix UI primitives handle complex a11y patterns
   - Built-in keyboard navigation, ARIA attributes
   - Screen reader tested components

4. **Scalability**:
   - Monorepo enables code sharing across 4 apps
   - Component library ensures consistency
   - Type-safe API client prevents runtime errors

5. **Customization**:
   - Owned components (not npm packages) = full control
   - CSS variables enable white-label theming
   - Tailwind utilities allow one-off customizations

6. **Enterprise-Ready**:
   - React 19 and Next.js 14 have LTS support
   - Used by Fortune 500 companies (proven at scale)
   - Strong TypeScript support for large teams

### Negative

1. **Learning Curve**:
   - Next.js App Router is newer (team needs training)
   - Server Components require mental model shift
   - Tailwind has initial learning curve for CSS-in-JS developers

2. **Copy-Paste Overhead**:
   - shadcn/ui components copied into repo (not npm package)
   - Need to manually update when shadcn/ui releases fixes
   - Potential divergence across projects

3. **Bundle Size Risk**:
   - Tailwind can generate large CSS if not configured properly
   - Need strict purging and bundle analysis
   - Monitoring required to stay under 200KB budget

4. **Server Component Limitations**:
   - Cannot use browser APIs (useState, useEffect)
   - Increased complexity in hybrid Client/Server setup
   - Debugging can be challenging

### Mitigations

1. **Learning Curve**:
   - **Action**: 2-day Next.js 14 training workshop for team
   - **Resources**: Internal "Best Practices" wiki with examples
   - **Timeline**: Q1 2026

2. **Component Updates**:
   - **Action**: Monthly review of shadcn/ui changelog
   - **Automation**: Dependabot-like script to detect component updates
   - **Process**: Quarterly component update sprint

3. **Bundle Size**:
   - **Action**: Bundle analyzer in CI/CD (fail if > 200KB)
   - **Tool**: `@next/bundle-analyzer` + size-limit
   - **Monitoring**: Weekly bundle size dashboard

4. **Server Components**:
   - **Action**: Clear naming convention (`*.client.tsx`, `*.server.tsx`)
   - **Linting**: ESLint rules to enforce Server Component constraints
   - **Examples**: Starter templates in `/examples` directory

## Alternatives Considered

### 1. Material UI (MUI)
- **Pros**: Mature, comprehensive components, Google Design
- **Cons**: Large bundle size (150KB+), opinionated styles, harder to customize
- **Rejected**: Bundle size exceeds budget, doesn't fit brand aesthetic

### 2. Ant Design
- **Pros**: Enterprise-focused, 60+ components, great for admin UIs
- **Cons**: Bundle size (200KB+), Chinese design language, less flexible
- **Rejected**: Bundle too large, design doesn't match target market

### 3. Chakra UI
- **Pros**: Excellent accessibility, theming system, TypeScript support
- **Cons**: Runtime CSS-in-JS (performance overhead), not composable enough
- **Rejected**: Runtime CSS-in-JS impacts performance at scale

### 4. Mantine
- **Pros**: Modern, well-documented, 100+ hooks
- **Cons**: Smaller community, less enterprise adoption
- **Rejected**: Lower confidence in long-term support

### 5. Build Custom from Scratch
- **Pros**: Full control, perfect brand match
- **Cons**: 6-12 months to build, high maintenance, accessibility hard
- **Rejected**: Time-to-market too long, opportunity cost too high

### 6. Vite instead of Next.js
- **Pros**: Faster dev server, simpler config
- **Cons**: No built-in SSR, routing, API routes, image optimization
- **Rejected**: SSR critical for SEO and performance, too much custom work

## Implementation Plan

### Phase 1: Foundation (Weeks 1-2)
- [ ] Set up NX monorepo structure
- [ ] Configure Tailwind with design tokens
- [ ] Install and configure shadcn/ui (20 core components)
- [ ] Create theme system with CSS variables
- [ ] Set up Storybook 8

### Phase 2: Core Components (Weeks 3-4)
- [ ] Build Layout components (DashboardLayout, AuthLayout)
- [ ] Create Form components with react-hook-form integration
- [ ] Build DataTable with sorting, filtering, pagination
- [ ] Create Chart components (Recharts wrapper)
- [ ] Accessibility audit with axe-core

### Phase 3: Patterns & Documentation (Weeks 5-6)
- [ ] Create composite patterns (SearchFilters, CommandPalette)
- [ ] Document component API in Storybook
- [ ] Write usage guidelines for team
- [ ] Create starter templates for common pages
- [ ] Set up Chromatic for visual regression

### Phase 4: Integration (Weeks 7-8)
- [ ] Migrate `/apps/portal` to new components
- [ ] Migrate `/apps/admin` to new components
- [ ] Migrate `/apps/docs` to new components
- [ ] Performance audit and optimization
- [ ] Final accessibility audit

## Metrics & Success Criteria

### Performance Targets
- **LCP**: < 2.5s (currently 3.2s)
- **INP**: < 200ms (currently 280ms)
- **CLS**: < 0.1 (currently 0.15)
- **Bundle Size**: < 200KB initial JS (currently 340KB)
- **Lighthouse Score**: 95+ on all categories

### Developer Experience
- **Component Reuse**: 80%+ of UI from shared library
- **Development Speed**: 30% faster page creation (measured via velocity)
- **Bug Rate**: 40% reduction in UI bugs (via Sentry tracking)
- **Accessibility Issues**: 0 critical a11y errors in production

### Business Impact
- **Time to Interactive**: Reduce by 35% → improve activation rate
- **Mobile Performance**: Achieve parity with desktop experience
- **White-Label Customization**: Enable in < 2 hours (vs 2 days currently)

## References

### Documentation
- [Next.js 14 Documentation](https://nextjs.org/docs)
- [shadcn/ui Components](https://ui.shadcn.com/)
- [Radix UI Primitives](https://www.radix-ui.com/)
- [Tailwind CSS v4](https://tailwindcss.com/docs)

### Research Sources
- [Frontend Design Patterns 2026](https://www.netguru.com/blog/frontend-design-patterns)
- [SaaS Development Frameworks 2026](https://www.thefrontendcompany.com/posts/saas-development-framework)
- [Enterprise UI Framework Benchmark](https://www.sencha.com/blog/react-angular-or-ext-js-benchmarking-enterprise-ui-frameworks-for-2026/)

### Internal References
- [Architecture Overview](/docs/technical/architecture.md)
- [Product Specification](/docs/product/product-spec.md)
- ADR-002: Tenant Isolation Strategy
- ADR-011: State Management Strategy (Zustand)

## Review Date
April 2026 (3 months)

**Reviewers**: Engineering Lead, Design Lead, Principal Architect

---

**Document Version**: 1.0
**Last Updated**: 2026-01-20
**Authors**: Architecture Team
**Approved By**: CTO
