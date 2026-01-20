# UI/UX Design Specification

**Version:** 1.0
**Date:** 2026-01-19
**Status:** Draft

---

## Overview

This document defines the user experience design, interaction patterns, and visual design specifications for Forge Factory. The design system follows modern SaaS B2B best practices with a focus on developer productivity and data-dense interfaces.

---

## Design Principles

### 1. **Developer-First**
```
Design for technical users who value:
- Efficiency over aesthetics
- Information density over whitespace
- Keyboard shortcuts over mouse clicks
- Dark mode by default
```

### 2. **Progressive Disclosure**
```
Show basic information upfront, allow drilling into details:
- Dashboard → Repository → Analysis → File Details
- Each level reveals more granular data
- Breadcrumbs for easy navigation back
```

### 3. **Data Visualization Priority**
```
Code metrics are visual, not just numbers:
- Charts for trends (AI-Readiness over time)
- Heatmaps for problem areas
- Progress bars for scores
- Color coding for severity
```

### 4. **Zero Empty States**
```
Every screen has content or clear next steps:
- No repositories? Show "Connect GitHub" CTA
- No analysis? Show "Run First Analysis" button
- No recommendations? Show "Great job!" celebration
```

### 5. **Instant Feedback**
```
Every action gets immediate visual response:
- Optimistic UI updates
- Loading skeletons (not spinners)
- Toast notifications for background tasks
- Real-time WebSocket updates
```

---

## Information Architecture

### Site Map

```
Public
├── / (Landing)
├── /pricing
├── /docs
└── /blog

Auth
├── /login
├── /register
├── /forgot-password
└── /sso

App
├── /dashboard
│   └── Overview of all repositories
├── /repositories
│   ├── /[id]
│   │   ├── /overview
│   │   ├── /analysis
│   │   │   ├── /[analysisId]
│   │   │   └── /history
│   │   ├── /refactorings
│   │   │   └── /[jobId]
│   │   ├── /pull-requests
│   │   └── /settings
│   └── /new (connect repository)
├── /settings
│   ├── /profile
│   ├── /organization
│   ├── /team
│   ├── /integrations
│   ├── /api-keys
│   └── /billing
└── /help
    ├── /documentation
    └── /support
```

---

## Layout System

### App Layout Structure

```
┌─────────────────────────────────────────────────────────────┐
│                        Header (64px)                         │
│  Logo │ Org Switcher │ Search ──────────── User │ Theme     │
├─────────────────────────────────────────────────────────────┤
│       │                                                      │
│       │                                                      │
│  Nav  │                  Main Content                       │
│ (240) │                                                      │
│       │                                                      │
│       │                                                      │
└───────┴──────────────────────────────────────────────────────┘
   Sidebar                    Workspace
   Fixed                      Flexible
```

### Component Hierarchy

```typescript
<AppLayout>
  <AppHeader>
    <Logo />
    <OrganizationSwitcher />
    <GlobalSearch />
    <Spacer />
    <NotificationBell />
    <ThemeToggle />
    <UserMenu />
  </AppHeader>

  <AppSidebar>
    <NavSection title="Main">
      <NavItem icon="dashboard">Dashboard</NavItem>
      <NavItem icon="folder">Repositories</NavItem>
    </NavSection>
    <NavSection title="Organization">
      <NavItem icon="settings">Settings</NavItem>
      <NavItem icon="users">Team</NavItem>
    </NavSection>
  </AppSidebar>

  <AppMain>
    {children}
  </AppMain>
</AppLayout>
```

---

## User Flows

### 1. Onboarding Flow

```
┌─────────────────────────────────────────────────────────┐
│ Step 1: Sign Up                                         │
│                                                          │
│  Email: [________________]                              │
│  Password: [____________]                               │
│  [  ] I agree to Terms                                  │
│                                                          │
│  [Create Account]                                       │
│  Already have an account? [Sign in]                     │
└─────────────────────────────────────────────────────────┘
                          ↓
┌─────────────────────────────────────────────────────────┐
│ Step 2: Email Verification                              │
│                                                          │
│  📧 Check your email                                    │
│  We sent a verification link to:                        │
│  user@example.com                                       │
│                                                          │
│  [Resend Email]                                         │
└─────────────────────────────────────────────────────────┘
                          ↓
┌─────────────────────────────────────────────────────────┐
│ Step 3: Create Organization                             │
│                                                          │
│  Organization Name: [______________]                    │
│  Team Size: ( ) 1-10  (•) 11-50  ( ) 51-200  ( ) 200+  │
│  Use Case: [Dropdown ▼]                                │
│                                                          │
│  [Continue]  [Skip for now]                            │
└─────────────────────────────────────────────────────────┘
                          ↓
┌─────────────────────────────────────────────────────────┐
│ Step 4: Connect GitHub                                  │
│                                                          │
│  🚀 Let's connect your first repository                │
│                                                          │
│  [🔗 Connect GitHub]                                    │
│                                                          │
│  Or connect later and explore with demo data           │
│  [Continue with Demo]                                   │
└─────────────────────────────────────────────────────────┘
                          ↓
┌─────────────────────────────────────────────────────────┐
│ Step 5: Select Repositories                             │
│                                                          │
│  Select repositories to analyze:                        │
│                                                          │
│  [✓] owner/repo-1        ⭐ 1.2k  Updated 2 days ago   │
│  [ ] owner/repo-2        ⭐ 543   Updated 1 week ago   │
│  [✓] owner/repo-3        ⭐ 89    Updated 3 days ago   │
│                                                          │
│  [← Back]  [Connect 2 repositories →]                  │
└─────────────────────────────────────────────────────────┘
                          ↓
┌─────────────────────────────────────────────────────────┐
│ Step 6: First Analysis                                  │
│                                                          │
│  🎉 Repositories connected!                            │
│                                                          │
│  We're analyzing your code now.                         │
│  This typically takes 3-5 minutes.                      │
│                                                          │
│  [━━━━━━━━━━━━━━━░░░] 75%                              │
│  Analyzing owner/repo-1...                             │
│                                                          │
│  [View Dashboard]                                       │
└─────────────────────────────────────────────────────────┘
```

### 2. Repository Analysis Flow

```
Dashboard → Repositories List → Select Repository → View Overview
                                                          ↓
                              ┌─────────────────────────┴───────────────────────┐
                              ↓                                                 ↓
                    Analysis Tab                                      Refactorings Tab
                         ↓                                                     ↓
          ┌──────────────┼──────────────┐                    ┌───────────────┴────────────┐
          ↓              ↓               ↓                    ↓                            ↓
    AI-Readiness   Recommendations   File Details      Pending Jobs              Completed Jobs
       Score          List              View               ↓                              ↓
          ↓              ↓                                  ↓                              ↓
    Historical     Apply              Drill into       Review & Approve             View Changes
      Trends      Refactoring         Issues          Refactoring                   in PR
```

### 3. Refactoring Approval Flow

```
User Views Recommendation
          ↓
  [Apply Refactoring]
          ↓
┌───────────────────────────┐
│ Refactoring Preview       │
│                           │
│ Type: Split Large File    │
│ Files Affected: 3         │
│ LOC Changed: 450          │
│ Est. Time: 5 min          │
│                           │
│ Before:                   │
│ components/App.tsx (850)  │
│                           │
│ After:                    │
│ components/App.tsx (200)  │
│ components/Auth.tsx (250) │
│ components/UI.tsx (400)   │
│                           │
│ [Cancel] [Approve]        │
└───────────────────────────┘
          ↓
   Job Created & Running
          ↓
   ┌──Success──┐
   │           │
   ↓           ↓
PR Created   Failed
   ↓           ↓
Review PR   Rollback
   ↓       Available
Merge
```

---

## Wireframes

### Dashboard (Overview)

```
┌──────────────────────────────────────────────────────────────────┐
│ Header                                                    [@User] │
├──────────────────────────────────────────────────────────────────┤
│                                                                   │
│  Dashboard                                                        │
│                                                                   │
│  ┌────────────┐  ┌────────────┐  ┌────────────┐  ┌──────────┐  │
│  │    12      │  │    89%     │  │     5      │  │   $450   │  │
│  │ Repos      │  │  Avg       │  │ Active     │  │  Saved   │  │
│  │            │  │  AI Score  │  │ Jobs       │  │  This Mo │  │
│  └────────────┘  └────────────┘  └────────────┘  └──────────┘  │
│                                                                   │
│  AI-Readiness Trends                                             │
│  ┌────────────────────────────────────────────────────────────┐ │
│  │ 100 ┤                                          ╭──╮         │ │
│  │  90 ┤                                  ╭──╮   │  │         │ │
│  │  80 ┤                          ╭──╮   │  │   │  │         │ │
│  │  70 ┤                  ╭──╮   │  │   │  │   │  │         │ │
│  │  60 ┤          ╭──╮   │  │   │  │   │  │   │  │         │ │
│  │  50 ┤  ╭──╮   │  │   │  │   │  │   │  │   │  │         │ │
│  │      └──┴──┴───┴──┴───┴──┴───┴──┴───┴──┴───┴──┴─────────│ │
│  │      Jan Feb  Mar Apr  May Jun  Jul Aug  Sep Oct        │ │
│  └────────────────────────────────────────────────────────────┘ │
│                                                                   │
│  Recent Activity                                                  │
│  ┌────────────────────────────────────────────────────────────┐ │
│  │ ✓ Analysis completed for my-repo            2 min ago      │ │
│  │ 🔧 Refactoring approved: Split App.tsx      15 min ago     │ │
│  │ 📝 CLAUDE.md generated for api-service      1 hour ago     │ │
│  │ 🎉 PR merged: Add type annotations          2 hours ago    │ │
│  └────────────────────────────────────────────────────────────┘ │
│                                                                   │
└───────────────────────────────────────────────────────────────────┘
```

### Repository Analysis Page

```
┌──────────────────────────────────────────────────────────────────┐
│ Header                                                    [@User] │
├──────────────────────────────────────────────────────────────────┤
│  Nav │                                                            │
│  ═══ │  owner/my-repo                           [Run Analysis]   │
│      │                                                            │
│  🏠  │  Overview | Analysis | Refactorings | Pull Requests       │
│      │  ────────                                                  │
│  📁  │                                                            │
│  Reps│  AI-Readiness Score                                       │
│      │  ┌──────────────────────────────────────────────────────┐│
│  ⚙  │  │                                                        ││
│  Sett│  │            ╭─────╮                                    ││
│      │  │            │     │                                    ││
│      │  │            │ 75  │                                    ││
│      │  │            │     │                                    ││
│      │  │            ╰─────╯                                    ││
│      │  │             Good                                      ││
│      │  │                                                        ││
│      │  │  [━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━░░░░░░░░░]           ││
│      │  │                                                        ││
│      │  │  Last analyzed: 5 min ago                             ││
│      │  └──────────────────────────────────────────────────────┘│
│      │                                                            │
│      │  Metrics Breakdown                                        │
│      │  ┌─────────────────────┐  ┌─────────────────────┐        │
│      │  │  Modularity      90 │  │  Complexity      80 │        │
│      │  │  [██████████████░░] │  │  [████████████░░░░] │        │
│      │  └─────────────────────┘  └─────────────────────┘        │
│      │  ┌─────────────────────┐  ┌─────────────────────┐        │
│      │  │  Test Coverage   65 │  │  Documentation   70 │        │
│      │  │  [███████████░░░░░] │  │  [██████████████░░] │        │
│      │  └─────────────────────┘  └─────────────────────┘        │
│      │                                                            │
│      │  Top Recommendations                                      │
│      │  ┌──────────────────────────────────────────────────────┐│
│      │  │ 🔴 CRITICAL   Split 12 large files                    ││
│      │  │               Files over 500 LOC are hard for AI...   ││
│      │  │               [Apply Refactoring]                     ││
│      │  ├──────────────────────────────────────────────────────┤│
│      │  │ 🟡 HIGH       Add type annotations                    ││
│      │  │               35% of functions lack type hints        ││
│      │  │               [Apply Refactoring]                     ││
│      │  ├──────────────────────────────────────────────────────┤│
│      │  │ 🟢 MEDIUM     Improve test coverage                   ││
│      │  │               Current coverage: 65%, Target: 80%      ││
│      │  │               [Generate Tests]                        ││
│      │  └──────────────────────────────────────────────────────┘│
│      │                                                            │
└──────┴────────────────────────────────────────────────────────────┘
```

### Refactoring Job Details

```
┌──────────────────────────────────────────────────────────────────┐
│  Refactoring Job #1234                            [Approve] [✕]  │
├──────────────────────────────────────────────────────────────────┤
│                                                                   │
│  Job Details                                                      │
│  Type:          Split Large File                                 │
│  Status:        ● Ready for Review                               │
│  Created:       5 min ago                                        │
│  Est. Impact:   +8 AI-Readiness Score                           │
│                                                                   │
│  ┌────────────────────────────────────────────────────────────┐ │
│  │ Files Changed (3)                                          ▼│ │
│  ├────────────────────────────────────────────────────────────┤ │
│  │ src/components/App.tsx                                      │ │
│  │ 850 lines → 200 lines (650 removed)                        │ │
│  │                                                              │ │
│  │ src/components/Auth.tsx                         [NEW FILE]  │ │
│  │ 0 lines → 250 lines (250 added)                            │ │
│  │                                                              │ │
│  │ src/components/UI.tsx                           [NEW FILE]  │ │
│  │ 0 lines → 400 lines (400 added)                            │ │
│  └────────────────────────────────────────────────────────────┘ │
│                                                                   │
│  ┌────────────────────────────────────────────────────────────┐ │
│  │ Changes Preview                                            ▼│ │
│  ├────────────────────────────────────────────────────────────┤ │
│  │ [Before]  [After]  [Diff]                                  │ │
│  │                                                              │ │
│  │  1  // src/components/App.tsx                               │ │
│  │  2  import React from 'react';                              │ │
│  │  3- import { login, logout } from './auth';                 │ │
│  │  4- import { Button, Input } from './ui';                   │ │
│  │  5+ import { AuthProvider } from './Auth';                  │ │
│  │  6+ import { UIComponents } from './UI';                    │ │
│  │  7                                                           │ │
│  │  8  export function App() {                                 │ │
│  │  9    return (                                               │ │
│  │ 10      <div>                                                │ │
│  │ 11-       <h1>My App</h1>                                    │ │
│  │ 12-       <LoginForm />                                      │ │
│  │ 13+       <AuthProvider>                                     │ │
│  │ 14+         <UIComponents />                                 │ │
│  │ 15+       </AuthProvider>                                    │ │
│  │                                                              │ │
│  └────────────────────────────────────────────────────────────┘ │
│                                                                   │
│  ┌────────────────────────────────────────────────────────────┐ │
│  │ Tests Status                                               ✓│ │
│  ├────────────────────────────────────────────────────────────┤ │
│  │ All tests passing (23/23)                                   │ │
│  │ Coverage: 85% (+2% from before)                             │ │
│  │ Build: ✓ Success                                            │ │
│  │ Lint: ✓ No issues                                           │ │
│  └────────────────────────────────────────────────────────────┘ │
│                                                                   │
│  [← Cancel]            [Create Pull Request →]                  │
│                                                                   │
└───────────────────────────────────────────────────────────────────┘
```

---

## Interaction Patterns

### Loading States

```typescript
// Skeleton Loading (preferred over spinners)
<Card>
  <Skeleton className="h-8 w-48 mb-4" />
  <Skeleton className="h-4 w-full mb-2" />
  <Skeleton className="h-4 w-3/4" />
</Card>

// Progress indicators for long operations
<div>
  <Progress value={progress} />
  <p className="text-sm text-muted-foreground">
    Analyzing repository... {progress}%
  </p>
</div>

// Optimistic UI updates
const updateRepository = async (data) => {
  // Immediately update UI
  setRepository({ ...repository, ...data });

  try {
    // Make API call in background
    await api.repositories.update(repository.id, data);
  } catch (error) {
    // Revert on error
    setRepository(repository);
    toast.error('Failed to update repository');
  }
};
```

### Empty States

```typescript
// Repositories List - Empty State
function EmptyRepositories() {
  return (
    <div className="flex flex-col items-center justify-center min-h-[400px] space-y-4">
      <div className="w-24 h-24 rounded-full bg-muted flex items-center justify-center">
        <FolderIcon className="w-12 h-12 text-muted-foreground" />
      </div>
      <div className="text-center space-y-2">
        <h3 className="text-xl font-semibold">No repositories yet</h3>
        <p className="text-muted-foreground max-w-md">
          Connect your first repository to start analyzing code and improving AI-readiness
        </p>
      </div>
      <Button size="lg">
        <GitBranchIcon className="mr-2" />
        Connect GitHub
      </Button>
    </div>
  );
}

// Analysis - No Recommendations (Success State)
function NoRecommendations() {
  return (
    <div className="flex flex-col items-center justify-center min-h-[300px] space-y-4">
      <div className="w-16 h-16 rounded-full bg-green-100 flex items-center justify-center">
        <CheckIcon className="w-8 h-8 text-green-600" />
      </div>
      <div className="text-center space-y-2">
        <h3 className="text-lg font-semibold">Excellent work! 🎉</h3>
        <p className="text-muted-foreground">
          No critical recommendations. Your codebase is highly AI-ready.
        </p>
      </div>
    </div>
  );
}
```

### Notifications & Feedback

```typescript
// Toast Notifications (using sonner)
import { toast } from 'sonner';

// Success
toast.success('Analysis completed', {
  description: 'AI-Readiness Score: 85/100',
  action: {
    label: 'View Results',
    onClick: () => router.push('/analysis/123'),
  },
});

// Error
toast.error('Failed to analyze repository', {
  description: error.message,
  action: {
    label: 'Retry',
    onClick: () => retryAnalysis(),
  },
});

// Loading (with promise)
toast.promise(analyzeRepository(), {
  loading: 'Analyzing repository...',
  success: 'Analysis completed',
  error: 'Analysis failed',
});

// In-line validation
<Input
  error={errors.name?.message}
  {...register('name')}
/>
{errors.name && (
  <p className="text-sm text-destructive mt-1">
    {errors.name.message}
  </p>
)}
```

### Keyboard Shortcuts

```typescript
// Global keyboard shortcuts
const shortcuts = {
  '⌘K': 'Open command palette',
  '⌘/': 'Open keyboard shortcuts',
  '⌘B': 'Toggle sidebar',
  'G then D': 'Go to dashboard',
  'G then R': 'Go to repositories',
  'C': 'Create new (contextual)',
  'ESC': 'Close modal/dialog',
  '?': 'Show help',
};

// Implementation
import { useHotkeys } from 'react-hotkeys-hook';

function useGlobalShortcuts() {
  useHotkeys('mod+k', () => openCommandPalette());
  useHotkeys('mod+b', () => toggleSidebar());
  useHotkeys('g,d', () => router.push('/dashboard'));
  useHotkeys('g,r', () => router.push('/repositories'));
  useHotkeys('?', () => openShortcutsModal());
}

// Command Palette (⌘K)
<CommandPalette>
  <CommandInput placeholder="Type a command or search..." />
  <CommandList>
    <CommandGroup heading="Suggestions">
      <CommandItem onSelect={() => router.push('/dashboard')}>
        <HomeIcon className="mr-2" />
        Dashboard
      </CommandItem>
      <CommandItem onSelect={() => router.push('/repositories')}>
        <FolderIcon className="mr-2" />
        Repositories
      </CommandItem>
    </CommandGroup>
    <CommandGroup heading="Recent">
      {recentRepositories.map(repo => (
        <CommandItem key={repo.id} onSelect={() => router.push(`/repositories/${repo.id}`)}>
          <FileIcon className="mr-2" />
          {repo.name}
        </CommandItem>
      ))}
    </CommandGroup>
  </CommandList>
</CommandPalette>
```

---

## Responsive Design

### Breakpoints

```typescript
// tailwind.config.ts
export default {
  theme: {
    screens: {
      'sm': '640px',   // Mobile landscape
      'md': '768px',   // Tablet portrait
      'lg': '1024px',  // Tablet landscape / Desktop
      'xl': '1280px',  // Desktop
      '2xl': '1536px', // Large desktop
    },
  },
};
```

### Mobile Adaptations

```
Desktop (1280px+)                    Mobile (< 768px)
┌─────────────────────────┐          ┌───────────────┐
│ Header + Sidebar + Main │          │    Header     │
└─────────────────────────┘          ├───────────────┤
                                     │               │
Tablet (768-1024px)                  │     Main      │
┌─────────────────────────┐          │   Content     │
│ Header                  │          │               │
├─────────────────────────┤          ├───────────────┤
│ Collapsible Sidebar     │          │  Bottom Nav   │
│ + Main Content          │          └───────────────┘
└─────────────────────────┘
```

```typescript
// Responsive navigation
function AppLayout() {
  const isMobile = useMediaQuery('(max-width: 768px)');

  return (
    <>
      <AppHeader />

      {isMobile ? (
        // Mobile: Bottom navigation
        <main className="pb-16">{children}</main>
        <BottomNav />
      ) : (
        // Desktop: Sidebar navigation
        <>
          <AppSidebar />
          <main>{children}</main>
        </>
      )}
    </>
  );
}

// Mobile-friendly tables become cards
function RepositoriesTable({ repositories }) {
  const isMobile = useMediaQuery('(max-width: 768px)');

  if (isMobile) {
    return (
      <div className="space-y-4">
        {repositories.map(repo => (
          <RepositoryCard key={repo.id} repository={repo} />
        ))}
      </div>
    );
  }

  return (
    <Table>
      {/* Desktop table view */}
    </Table>
  );
}
```

---

## Accessibility (a11y)

### ARIA Landmarks

```typescript
<div role="main" aria-label="Main content">
  <nav aria-label="Primary navigation">
    {/* Navigation items */}
  </nav>

  <main>
    <article aria-labelledby="page-title">
      <h1 id="page-title">Repository Analysis</h1>
      {/* Content */}
    </article>
  </main>

  <aside aria-label="Related information">
    {/* Sidebar content */}
  </aside>
</div>
```

### Focus Management

```typescript
// Trap focus in modals
import { FocusTrap } from '@radix-ui/react-focus-scope';

function Modal({ children }) {
  return (
    <Dialog>
      <FocusTrap asChild>
        <DialogContent>
          {children}
        </DialogContent>
      </FocusTrap>
    </Dialog>
  );
}

// Return focus after modal closes
function DeleteConfirmation({ onConfirm, onCancel }) {
  const triggerRef = useRef<HTMLButtonElement>(null);

  return (
    <Dialog
      onOpenChange={(open) => {
        if (!open) {
          // Return focus to trigger button
          triggerRef.current?.focus();
        }
      }}
    >
      {/* Dialog content */}
    </Dialog>
  );
}
```

### Screen Reader Announcements

```typescript
// Live regions for dynamic content
<div aria-live="polite" aria-atomic="true" className="sr-only">
  {message}
</div>

// Example: Analysis progress
function AnalysisProgress({ progress }) {
  return (
    <>
      <Progress value={progress} aria-label="Analysis progress" />
      <div aria-live="polite" className="sr-only">
        Analysis is {progress}% complete
      </div>
    </>
  );
}

// Status updates
function RefactoringJob({ job }) {
  return (
    <div>
      <Badge>{job.status}</Badge>
      <span className="sr-only">
        Refactoring job status: {job.status}
      </span>
    </div>
  );
}
```

---

## Animation & Motion

### Principles

```
1. Functional, not decorative
   - Animations should provide feedback or guide attention
   - Avoid animations that don't serve a purpose

2. Fast and subtle
   - Duration: 150-300ms for most transitions
   - Easing: ease-in-out for natural feel

3. Respect user preferences
   - Honor prefers-reduced-motion
   - Provide instant alternatives
```

### Implementation

```typescript
// Tailwind classes
<div className="transition-opacity duration-200 hover:opacity-80">
  Fade on hover
</div>

<div className="transition-transform duration-150 hover:scale-105">
  Scale on hover
</div>

// Framer Motion for complex animations
import { motion, AnimatePresence } from 'framer-motion';

function RepositoryList({ repositories }) {
  return (
    <AnimatePresence>
      {repositories.map(repo => (
        <motion.div
          key={repo.id}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, x: -100 }}
          transition={{ duration: 0.2 }}
        >
          <RepositoryCard repository={repo} />
        </motion.div>
      ))}
    </AnimatePresence>
  );
}

// Respect reduced motion preference
const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

const transition = prefersReducedMotion
  ? { duration: 0 }
  : { duration: 0.2, ease: 'easeInOut' };
```

---

## Dark Mode

### Color System

```typescript
// CSS Variables (auto-switched based on theme)
:root {
  --background: 0 0% 100%;
  --foreground: 240 10% 3.9%;
  --primary: 240 5.9% 10%;
  --primary-foreground: 0 0% 98%;
}

.dark {
  --background: 240 10% 3.9%;
  --foreground: 0 0% 98%;
  --primary: 0 0% 98%;
  --primary-foreground: 240 5.9% 10%;
}

// Tailwind classes automatically adapt
<div className="bg-background text-foreground">
  Content (white background in light, dark in dark mode)
</div>

// Theme toggle
function ThemeToggle() {
  const { theme, setTheme } = useTheme();

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon">
          <SunIcon className="h-5 w-5 rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0" />
          <MoonIcon className="absolute h-5 w-5 rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent>
        <DropdownMenuItem onClick={() => setTheme('light')}>
          Light
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => setTheme('dark')}>
          Dark
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => setTheme('system')}>
          System
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
```

---

## Performance Considerations

### Images

```typescript
// Use Next.js Image for optimization
import Image from 'next/image';

<Image
  src="/dashboard-preview.png"
  alt="Dashboard"
  width={1200}
  height={800}
  priority // Above fold
  placeholder="blur"
/>

// Lazy load below-fold images
<Image
  src="/feature.png"
  alt="Feature"
  width={600}
  height={400}
  loading="lazy"
/>
```

### Code Splitting

```typescript
// Lazy load heavy components
const MonacoEditor = dynamic(() => import('@monaco-editor/react'), {
  loading: () => <Skeleton className="h-[400px]" />,
  ssr: false,
});

// Route-based splitting (automatic in Next.js)
// Each page in app/ is automatically code-split
```

---

## Design Tokens

### Spacing Scale

```
0:   0px      (0)
1:   4px      (0.25rem)
2:   8px      (0.5rem)
3:   12px     (0.75rem)
4:   16px     (1rem)      ← Base unit
5:   20px     (1.25rem)
6:   24px     (1.5rem)
8:   32px     (2rem)
10:  40px     (2.5rem)
12:  48px     (3rem)
16:  64px     (4rem)
20:  80px     (5rem)
24:  96px     (6rem)
```

### Typography Scale

```
text-xs:    12px / 16px   (0.75rem)
text-sm:    14px / 20px   (0.875rem)
text-base:  16px / 24px   (1rem)      ← Base
text-lg:    18px / 28px   (1.125rem)
text-xl:    20px / 28px   (1.25rem)
text-2xl:   24px / 32px   (1.5rem)
text-3xl:   30px / 36px   (1.875rem)
text-4xl:   36px / 40px   (2.25rem)
```

---

**Status:** Living document - update as design evolves
