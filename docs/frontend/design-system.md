# Design System Documentation

**Version:** 1.0
**Date:** 2026-01-19
**Status:** Draft

---

## Overview

The Forge Factory Design System is built on **shadcn/ui** (Radix UI primitives + Tailwind CSS), providing a consistent, accessible, and themeable component library.

---

## Color System

### Color Palette

```typescript
// colors.ts
export const colors = {
  // Brand
  primary: {
    50: '#F0F9FF',
    100: '#E0F2FE',
    200: '#BAE6FD',
    300: '#7DD3FC',
    400: '#38BDF8',
    500: '#0EA5E9', // Primary brand color
    600: '#0284C7',
    700: '#0369A1',
    800: '#075985',
    900: '#0C4A6E',
    950: '#082F49',
  },

  // Semantic colors
  success: {
    light: '#10B981', // Green-500
    DEFAULT: '#059669', // Green-600
    dark: '#047857', // Green-700
  },
  warning: {
    light: '#F59E0B', // Amber-500
    DEFAULT: '#D97706', // Amber-600
    dark: '#B45309', // Amber-700
  },
  error: {
    light: '#EF4444', // Red-500
    DEFAULT: '#DC2626', // Red-600
    dark: '#B91C1C', // Red-700
  },
  info: {
    light: '#3B82F6', // Blue-500
    DEFAULT: '#2563EB', // Blue-600
    dark: '#1D4ED8', // Blue-700
  },

  // Neutral (Zinc)
  neutral: {
    50: '#FAFAFA',
    100: '#F4F4F5',
    200: '#E4E4E7',
    300: '#D4D4D8',
    400: '#A1A1AA',
    500: '#71717A',
    600: '#52525B',
    700: '#3F3F46',
    800: '#27272A',
    900: '#18181B',
    950: '#09090B',
  },
};

// CSS Variables for theming
:root {
  --primary: 210 100% 46%;
  --primary-foreground: 0 0% 98%;

  --success: 142 71% 45%;
  --warning: 38 92% 50%;
  --error: 0 72% 51%;

  --background: 0 0% 100%;
  --foreground: 240 10% 3.9%;

  --muted: 240 4.8% 95.9%;
  --muted-foreground: 240 3.8% 46.1%;

  --border: 240 5.9% 90%;
  --input: 240 5.9% 90%;

  --radius: 0.5rem;
}

.dark {
  --primary: 210 100% 50%;
  --primary-foreground: 240 10% 3.9%;

  --background: 240 10% 3.9%;
  --foreground: 0 0% 98%;

  --muted: 240 3.7% 15.9%;
  --muted-foreground: 240 5% 64.9%;

  --border: 240 3.7% 15.9%;
  --input: 240 3.7% 15.9%;
}
```

### Color Usage Guidelines

```typescript
// Text
<p className="text-foreground">Primary text</p>
<p className="text-muted-foreground">Secondary text</p>

// Backgrounds
<div className="bg-background">Primary background</div>
<div className="bg-muted">Secondary background</div>

// States
<Badge variant="success">Success</Badge>
<Badge variant="warning">Warning</Badge>
<Badge variant="error">Error</Badge>

// AI-Readiness Score Colors
const getScoreColor = (score: number) => {
  if (score >= 80) return 'text-green-600';
  if (score >= 60) return 'text-yellow-600';
  if (score >= 40) return 'text-orange-600';
  return 'text-red-600';
};
```

---

## Typography

### Font Family

```typescript
// next.config.js - Using next/font
import { Inter } from 'next/font/google';

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-inter',
  display: 'swap',
});

// Monospace for code
import { JetBrains_Mono } from 'next/font/google';

const jetbrainsMono = JetBrains_Mono({
  subsets: ['latin'],
  variable: '--font-mono',
  display: 'swap',
});
```

### Type Scale

```typescript
// Text styles
export const typography = {
  h1: 'scroll-m-20 text-4xl font-extrabold tracking-tight lg:text-5xl',
  h2: 'scroll-m-20 border-b pb-2 text-3xl font-semibold tracking-tight first:mt-0',
  h3: 'scroll-m-20 text-2xl font-semibold tracking-tight',
  h4: 'scroll-m-20 text-xl font-semibold tracking-tight',
  p: 'leading-7 [&:not(:first-child)]:mt-6',
  lead: 'text-xl text-muted-foreground',
  large: 'text-lg font-semibold',
  small: 'text-sm font-medium leading-none',
  muted: 'text-sm text-muted-foreground',
  code: 'relative rounded bg-muted px-[0.3rem] py-[0.2rem] font-mono text-sm font-semibold',
};

// Usage
<h1 className={typography.h1}>Page Title</h1>
<p className={typography.p}>Body text</p>
<code className={typography.code}>const x = 10;</code>
```

---

## Components

### Button

```typescript
// components/ui/button.tsx
import { cva, type VariantProps } from 'class-variance-authority';

const buttonVariants = cva(
  'inline-flex items-center justify-center rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:opacity-50 disabled:pointer-events-none ring-offset-background',
  {
    variants: {
      variant: {
        default: 'bg-primary text-primary-foreground hover:bg-primary/90',
        destructive: 'bg-destructive text-destructive-foreground hover:bg-destructive/90',
        outline: 'border border-input hover:bg-accent hover:text-accent-foreground',
        secondary: 'bg-secondary text-secondary-foreground hover:bg-secondary/80',
        ghost: 'hover:bg-accent hover:text-accent-foreground',
        link: 'underline-offset-4 hover:underline text-primary',
      },
      size: {
        default: 'h-10 py-2 px-4',
        sm: 'h-9 px-3 rounded-md',
        lg: 'h-11 px-8 rounded-md',
        icon: 'h-10 w-10',
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'default',
    },
  }
);

interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

export function Button({ className, variant, size, asChild = false, ...props }: ButtonProps) {
  const Comp = asChild ? Slot : 'button';
  return <Comp className={cn(buttonVariants({ variant, size, className }))} {...props} />;
}

// Usage examples
<Button>Default Button</Button>
<Button variant="outline">Outline Button</Button>
<Button variant="destructive" size="sm">Delete</Button>
<Button variant="ghost" size="icon">
  <IconTrash />
</Button>
```

### Card

```typescript
// components/ui/card.tsx
export function Card({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        'rounded-lg border bg-card text-card-foreground shadow-sm',
        className
      )}
      {...props}
    />
  );
}

export function CardHeader({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn('flex flex-col space-y-1.5 p-6', className)} {...props} />;
}

export function CardTitle({ className, ...props }: React.HTMLAttributes<HTMLHeadingElement>) {
  return <h3 className={cn('text-2xl font-semibold leading-none tracking-tight', className)} {...props} />;
}

export function CardDescription({ className, ...props }: React.HTMLAttributes<HTMLParagraphElement>) {
  return <p className={cn('text-sm text-muted-foreground', className)} {...props} />;
}

export function CardContent({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn('p-6 pt-0', className)} {...props} />;
}

export function CardFooter({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn('flex items-center p-6 pt-0', className)} {...props} />;
}

// Usage
<Card>
  <CardHeader>
    <CardTitle>Repository Analysis</CardTitle>
    <CardDescription>AI-Readiness metrics and recommendations</CardDescription>
  </CardHeader>
  <CardContent>
    <AIReadinessScore score={75} />
  </CardContent>
  <CardFooter>
    <Button>View Details</Button>
  </CardFooter>
</Card>
```

### Badge

```typescript
// components/ui/badge.tsx
const badgeVariants = cva(
  'inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2',
  {
    variants: {
      variant: {
        default: 'border-transparent bg-primary text-primary-foreground hover:bg-primary/80',
        secondary: 'border-transparent bg-secondary text-secondary-foreground hover:bg-secondary/80',
        destructive: 'border-transparent bg-destructive text-destructive-foreground hover:bg-destructive/80',
        outline: 'text-foreground',
        success: 'border-transparent bg-green-500 text-white',
        warning: 'border-transparent bg-yellow-500 text-white',
        error: 'border-transparent bg-red-500 text-white',
      },
    },
    defaultVariants: {
      variant: 'default',
    },
  }
);

// Usage
<Badge variant="success">Completed</Badge>
<Badge variant="warning">Pending</Badge>
<Badge variant="error">Failed</Badge>
```

### Form Components

```typescript
// Form with React Hook Form + Zod
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';

const formSchema = z.object({
  name: z.string().min(1, 'Name is required').max(100),
  description: z.string().optional(),
  autoAnalyze: z.boolean().default(true),
});

function RepositoryForm() {
  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: '',
      description: '',
      autoAnalyze: true,
    },
  });

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
        <FormField
          control={form.control}
          name="name"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Repository Name</FormLabel>
              <FormControl>
                <Input placeholder="my-repo" {...field} />
              </FormControl>
              <FormDescription>
                The name of your repository
              </FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="autoAnalyze"
          render={({ field }) => (
            <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
              <div className="space-y-0.5">
                <FormLabel className="text-base">Auto-analyze on push</FormLabel>
                <FormDescription>
                  Automatically analyze code when new commits are pushed
                </FormDescription>
              </div>
              <FormControl>
                <Switch
                  checked={field.value}
                  onCheckedChange={field.onChange}
                />
              </FormControl>
            </FormItem>
          )}
        />

        <Button type="submit">Save</Button>
      </form>
    </Form>
  );
}
```

### Dialog

```typescript
// components/ui/dialog.tsx
<Dialog>
  <DialogTrigger asChild>
    <Button variant="outline">Open Dialog</Button>
  </DialogTrigger>
  <DialogContent>
    <DialogHeader>
      <DialogTitle>Confirm Refactoring</DialogTitle>
      <DialogDescription>
        This will create a pull request with the proposed changes.
        Are you sure you want to proceed?
      </DialogDescription>
    </DialogHeader>
    <DialogFooter>
      <Button variant="outline" onClick={() => setOpen(false)}>
        Cancel
      </Button>
      <Button onClick={handleConfirm}>
        Confirm
      </Button>
    </DialogFooter>
  </DialogContent>
</Dialog>
```

---

## Data Visualization Components

### AI-Readiness Score

```typescript
// components/features/analysis/ai-readiness-score.tsx
import { Progress } from '@/components/ui/progress';

interface AIReadinessScoreProps {
  score: number;
  size?: 'sm' | 'md' | 'lg';
  showLabel?: boolean;
}

export function AIReadinessScore({
  score,
  size = 'md',
  showLabel = true,
}: AIReadinessScoreProps) {
  const getScoreColor = () => {
    if (score >= 80) return 'text-green-600';
    if (score >= 60) return 'text-yellow-600';
    if (score >= 40) return 'text-orange-600';
    return 'text-red-600';
  };

  const getScoreLabel = () => {
    if (score >= 80) return 'Excellent';
    if (score >= 60) return 'Good';
    if (score >= 40) return 'Fair';
    return 'Needs Work';
  };

  const sizes = {
    sm: { text: 'text-2xl', label: 'text-sm', width: 100 },
    md: { text: 'text-4xl', label: 'text-base', width: 150 },
    lg: { text: 'text-6xl', label: 'text-lg', width: 200 },
  };

  return (
    <div className="flex flex-col items-center space-y-2">
      <div className={cn('font-bold', sizes[size].text, getScoreColor())}>
        {score}
      </div>
      {showLabel && (
        <div className={cn('text-muted-foreground', sizes[size].label)}>
          {getScoreLabel()}
        </div>
      )}
      <Progress value={score} className="w-full" style={{ maxWidth: sizes[size].width }} />
    </div>
  );
}
```

### Metrics Chart (Radar)

```typescript
// components/features/analysis/metrics-chart.tsx
import { RadarChart, PolarGrid, PolarAngleAxis, Radar, ResponsiveContainer } from 'recharts';

interface MetricsChartProps {
  metrics: {
    modularity: number;
    complexity: number;
    typeAnnotations: number;
    testCoverage: number;
    documentation: number;
    naming: number;
  };
}

export function MetricsChart({ metrics }: MetricsChartProps) {
  const data = [
    { metric: 'Modularity', score: metrics.modularity },
    { metric: 'Complexity', score: metrics.complexity },
    { metric: 'Types', score: metrics.typeAnnotations },
    { metric: 'Tests', score: metrics.testCoverage },
    { metric: 'Docs', score: metrics.documentation },
    { metric: 'Naming', score: metrics.naming },
  ];

  return (
    <ResponsiveContainer width="100%" height={300}>
      <RadarChart data={data}>
        <PolarGrid stroke="hsl(var(--border))" />
        <PolarAngleAxis
          dataKey="metric"
          tick={{ fill: 'hsl(var(--foreground))', fontSize: 12 }}
        />
        <Radar
          dataKey="score"
          stroke="hsl(var(--primary))"
          fill="hsl(var(--primary))"
          fillOpacity={0.6}
        />
      </RadarChart>
    </ResponsiveContainer>
  );
}
```

### Trend Chart (Line)

```typescript
// components/features/analysis/trend-chart.tsx
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

interface TrendChartProps {
  data: Array<{
    date: string;
    score: number;
  }>;
}

export function TrendChart({ data }: TrendChartProps) {
  return (
    <ResponsiveContainer width="100%" height={300}>
      <LineChart data={data}>
        <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
        <XAxis
          dataKey="date"
          stroke="hsl(var(--foreground))"
          fontSize={12}
          tickFormatter={(value) => new Date(value).toLocaleDateString()}
        />
        <YAxis
          stroke="hsl(var(--foreground))"
          fontSize={12}
          domain={[0, 100]}
        />
        <Tooltip
          contentStyle={{
            backgroundColor: 'hsl(var(--background))',
            border: '1px solid hsl(var(--border))',
            borderRadius: '6px',
          }}
        />
        <Line
          type="monotone"
          dataKey="score"
          stroke="hsl(var(--primary))"
          strokeWidth={2}
          dot={{ fill: 'hsl(var(--primary))' }}
        />
      </LineChart>
    </ResponsiveContainer>
  );
}
```

---

## Layout Components

### Page Header

```typescript
// components/layouts/page-header.tsx
interface PageHeaderProps {
  title: string;
  description?: string;
  action?: React.ReactNode;
}

export function PageHeader({ title, description, action }: PageHeaderProps) {
  return (
    <div className="flex items-center justify-between pb-6 border-b">
      <div className="space-y-1">
        <h1 className="text-3xl font-bold tracking-tight">{title}</h1>
        {description && (
          <p className="text-muted-foreground">{description}</p>
        )}
      </div>
      {action && <div>{action}</div>}
    </div>
  );
}

// Usage
<PageHeader
  title="Repositories"
  description="Manage and analyze your repositories"
  action={<Button>Connect Repository</Button>}
/>
```

### Empty State

```typescript
// components/layouts/empty-state.tsx
interface EmptyStateProps {
  icon: React.ReactNode;
  title: string;
  description: string;
  action?: React.ReactNode;
}

export function EmptyState({ icon, title, description, action }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center min-h-[400px] space-y-4 text-center">
      <div className="w-24 h-24 rounded-full bg-muted flex items-center justify-center">
        {icon}
      </div>
      <div className="space-y-2 max-w-md">
        <h3 className="text-xl font-semibold">{title}</h3>
        <p className="text-muted-foreground">{description}</p>
      </div>
      {action && <div className="pt-2">{action}</div>}
    </div>
  );
}

// Usage
<EmptyState
  icon={<FolderIcon className="w-12 h-12 text-muted-foreground" />}
  title="No repositories yet"
  description="Connect your first repository to start analyzing code"
  action={<Button>Connect GitHub</Button>}
/>
```

---

## Icons

### Icon Library (Lucide React)

```typescript
import {
  // Navigation
  Home,
  Folder,
  Settings,
  Users,
  HelpCircle,

  // Actions
  Plus,
  Trash2,
  Edit,
  Copy,
  Download,
  Upload,
  RefreshCw,
  Search,

  // Status
  Check,
  X,
  AlertCircle,
  AlertTriangle,
  Info,

  // Code
  Code2,
  GitBranch,
  GitPullRequest,
  FileCode,

  // UI
  ChevronDown,
  ChevronRight,
  Menu,
  MoreVertical,
  Loader2,
} from 'lucide-react';

// Usage
<Button>
  <Plus className="mr-2 h-4 w-4" />
  Add Repository
</Button>

// Loading spinner
<Loader2 className="h-4 w-4 animate-spin" />
```

---

## Spacing & Layout

### Spacing System

```typescript
// Based on 4px increments
const spacing = {
  0: '0px',
  1: '4px',
  2: '8px',
  3: '12px',
  4: '16px',  // Base unit
  5: '20px',
  6: '24px',
  8: '32px',
  10: '40px',
  12: '48px',
  16: '64px',
  20: '80px',
  24: '96px',
};

// Usage in Tailwind
<div className="p-4">Padding: 16px</div>
<div className="space-y-6">Gap: 24px between children</div>
<div className="mb-8">Margin bottom: 32px</div>
```

### Container Widths

```typescript
// Container max-widths
const containers = {
  sm: '640px',
  md: '768px',
  lg: '1024px',
  xl: '1280px',
  '2xl': '1536px',
};

// Usage
<div className="container mx-auto px-4">
  Content constrained to max-width
</div>
```

---

## Shadows

```typescript
// Shadow scale
const shadows = {
  sm: '0 1px 2px 0 rgb(0 0 0 / 0.05)',
  DEFAULT: '0 1px 3px 0 rgb(0 0 0 / 0.1), 0 1px 2px -1px rgb(0 0 0 / 0.1)',
  md: '0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1)',
  lg: '0 10px 15px -3px rgb(0 0 0 / 0.1), 0 4px 6px -4px rgb(0 0 0 / 0.1)',
  xl: '0 20px 25px -5px rgb(0 0 0 / 0.1), 0 8px 10px -6px rgb(0 0 0 / 0.1)',
  '2xl': '0 25px 50px -12px rgb(0 0 0 / 0.25)',
};

// Usage
<Card className="shadow-md">Content</Card>
```

---

## Border Radius

```typescript
// Border radius scale
const borderRadius = {
  none: '0px',
  sm: '0.125rem',  // 2px
  DEFAULT: '0.25rem',  // 4px
  md: '0.375rem',  // 6px
  lg: '0.5rem',  // 8px
  xl: '0.75rem',  // 12px
  '2xl': '1rem',  // 16px
  '3xl': '1.5rem',  // 24px
  full: '9999px',
};

// Usage
<Button className="rounded-lg">Button</Button>
<Avatar className="rounded-full">Avatar</Avatar>
```

---

## Component Composition Examples

### Repository Card

```typescript
export function RepositoryCard({ repository }: { repository: Repository }) {
  return (
    <Card className="hover:shadow-lg transition-shadow">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
              <FolderIcon className="w-5 h-5 text-primary" />
            </div>
            <div>
              <CardTitle className="text-lg">{repository.name}</CardTitle>
              <CardDescription>{repository.owner}</CardDescription>
            </div>
          </div>
          <Badge variant={repository.status === 'active' ? 'success' : 'secondary'}>
            {repository.status}
          </Badge>
        </div>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <p className="text-sm text-muted-foreground">AI-Readiness</p>
            <AIReadinessScore score={repository.aiReadinessScore} size="sm" />
          </div>
          <div>
            <p className="text-sm text-muted-foreground">Last Analyzed</p>
            <p className="text-sm font-medium">
              {formatDistanceToNow(repository.lastAnalyzedAt)} ago
            </p>
          </div>
        </div>
      </CardContent>
      <CardFooter>
        <Button variant="outline" className="w-full">
          View Details
        </Button>
      </CardFooter>
    </Card>
  );
}
```

---

## Storybook Integration

```typescript
// .storybook/main.ts
import type { StorybookConfig } from '@storybook/nextjs';

const config: StorybookConfig = {
  stories: ['../components/**/*.stories.@(js|jsx|ts|tsx)'],
  addons: [
    '@storybook/addon-links',
    '@storybook/addon-essentials',
    '@storybook/addon-interactions',
    '@storybook/addon-a11y',
  ],
  framework: {
    name: '@storybook/nextjs',
    options: {},
  },
};

export default config;

// button.stories.tsx
import type { Meta, StoryObj } from '@storybook/react';
import { Button } from './button';

const meta: Meta<typeof Button> = {
  title: 'UI/Button',
  component: Button,
  tags: ['autodocs'],
  argTypes: {
    variant: {
      control: 'select',
      options: ['default', 'destructive', 'outline', 'secondary', 'ghost', 'link'],
    },
    size: {
      control: 'select',
      options: ['default', 'sm', 'lg', 'icon'],
    },
  },
};

export default meta;
type Story = StoryObj<typeof Button>;

export const Default: Story = {
  args: {
    children: 'Button',
  },
};

export const Outline: Story = {
  args: {
    variant: 'outline',
    children: 'Outline Button',
  },
};

export const WithIcon: Story = {
  args: {
    children: (
      <>
        <Plus className="mr-2 h-4 w-4" />
        Add Item
      </>
    ),
  },
};
```

---

**Status:** Living document - update as design system evolves
