/**
 * @package @forge/design-system
 * @description Tests for components
 */

import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import {
  ThemeProvider,
  useTheme,
  Button,
  Input,
  Select,
  Card,
  CardHeader,
  CardBody,
  CardFooter,
  Modal,
  ModalHeader,
  ModalBody,
  ModalFooter,
  ToastProvider,
  useToast,
} from '../index';

// Wrapper component with ThemeProvider
function TestWrapper({ children }: { children: React.ReactNode }) {
  return <ThemeProvider>{children}</ThemeProvider>;
}

describe('Button', () => {
  it('should render button with text', () => {
    render(
      <TestWrapper>
        <Button>Click me</Button>
      </TestWrapper>
    );
    expect(screen.getByRole('button', { name: 'Click me' })).toBeInTheDocument();
  });

  it('should handle click events', () => {
    const handleClick = vi.fn();
    render(
      <TestWrapper>
        <Button onClick={handleClick}>Click me</Button>
      </TestWrapper>
    );
    fireEvent.click(screen.getByRole('button'));
    expect(handleClick).toHaveBeenCalledTimes(1);
  });

  it('should be disabled when disabled prop is true', () => {
    render(
      <TestWrapper>
        <Button disabled>Disabled</Button>
      </TestWrapper>
    );
    expect(screen.getByRole('button')).toBeDisabled();
  });

  it('should not call onClick when disabled', () => {
    const handleClick = vi.fn();
    render(
      <TestWrapper>
        <Button disabled onClick={handleClick}>
          Disabled
        </Button>
      </TestWrapper>
    );
    fireEvent.click(screen.getByRole('button'));
    expect(handleClick).not.toHaveBeenCalled();
  });

  it('should show loading state', () => {
    render(
      <TestWrapper>
        <Button loading>Loading</Button>
      </TestWrapper>
    );
    expect(screen.getByRole('button')).toHaveAttribute('aria-busy', 'true');
  });

  it('should apply testId', () => {
    render(
      <TestWrapper>
        <Button testId="test-button">Test</Button>
      </TestWrapper>
    );
    expect(screen.getByTestId('test-button')).toBeInTheDocument();
  });

  it('should render with different variants', () => {
    const { rerender } = render(
      <TestWrapper>
        <Button variant="solid">Solid</Button>
      </TestWrapper>
    );
    expect(screen.getByRole('button')).toBeInTheDocument();

    rerender(
      <TestWrapper>
        <Button variant="outline">Outline</Button>
      </TestWrapper>
    );
    expect(screen.getByRole('button')).toBeInTheDocument();

    rerender(
      <TestWrapper>
        <Button variant="ghost">Ghost</Button>
      </TestWrapper>
    );
    expect(screen.getByRole('button')).toBeInTheDocument();

    rerender(
      <TestWrapper>
        <Button variant="link">Link</Button>
      </TestWrapper>
    );
    expect(screen.getByRole('button')).toBeInTheDocument();
  });

  it('should render with different sizes', () => {
    const sizes = ['xs', 'sm', 'md', 'lg', 'xl'] as const;
    for (const size of sizes) {
      const { unmount } = render(
        <TestWrapper>
          <Button size={size}>{size}</Button>
        </TestWrapper>
      );
      expect(screen.getByRole('button')).toBeInTheDocument();
      unmount();
    }
  });

  it('should render with icons', () => {
    render(
      <TestWrapper>
        <Button leftIcon={<span data-testid="left-icon">L</span>}>With Icon</Button>
      </TestWrapper>
    );
    expect(screen.getByTestId('left-icon')).toBeInTheDocument();
  });

  it('should be full width when fullWidth is true', () => {
    render(
      <TestWrapper>
        <Button fullWidth>Full Width</Button>
      </TestWrapper>
    );
    expect(screen.getByRole('button')).toHaveStyle({ width: '100%' });
  });
});

describe('Input', () => {
  it('should render input', () => {
    render(
      <TestWrapper>
        <Input placeholder="Enter text" testId="test-input" />
      </TestWrapper>
    );
    expect(screen.getByPlaceholderText('Enter text')).toBeInTheDocument();
  });

  it('should render with label', () => {
    render(
      <TestWrapper>
        <Input label="Username" />
      </TestWrapper>
    );
    expect(screen.getByText('Username')).toBeInTheDocument();
  });

  it('should handle value changes', () => {
    const handleChange = vi.fn();
    render(
      <TestWrapper>
        <Input onChange={handleChange} testId="test-input" />
      </TestWrapper>
    );
    fireEvent.change(screen.getByTestId('test-input'), { target: { value: 'test' } });
    expect(handleChange).toHaveBeenCalled();
  });

  it('should show error state', () => {
    render(
      <TestWrapper>
        <Input error errorMessage="Error message" testId="test-input" />
      </TestWrapper>
    );
    expect(screen.getByText('Error message')).toBeInTheDocument();
    expect(screen.getByTestId('test-input')).toHaveAttribute('aria-invalid', 'true');
  });

  it('should show helper text', () => {
    render(
      <TestWrapper>
        <Input helperText="Helper text" />
      </TestWrapper>
    );
    expect(screen.getByText('Helper text')).toBeInTheDocument();
  });

  it('should be disabled', () => {
    render(
      <TestWrapper>
        <Input disabled testId="test-input" />
      </TestWrapper>
    );
    expect(screen.getByTestId('test-input')).toBeDisabled();
  });

  it('should show required indicator', () => {
    render(
      <TestWrapper>
        <Input label="Required Field" required />
      </TestWrapper>
    );
    expect(screen.getByText('*')).toBeInTheDocument();
  });

  it('should render with different sizes', () => {
    const sizes = ['xs', 'sm', 'md', 'lg', 'xl'] as const;
    for (const size of sizes) {
      const { unmount } = render(
        <TestWrapper>
          <Input size={size} testId="test-input" />
        </TestWrapper>
      );
      expect(screen.getByTestId('test-input')).toBeInTheDocument();
      unmount();
    }
  });
});

describe('Select', () => {
  const options = [
    { value: 'option1', label: 'Option 1' },
    { value: 'option2', label: 'Option 2' },
    { value: 'option3', label: 'Option 3', disabled: true },
  ];

  it('should render select', () => {
    render(
      <TestWrapper>
        <Select options={options} testId="test-select" />
      </TestWrapper>
    );
    expect(screen.getByTestId('test-select')).toBeInTheDocument();
  });

  it('should render with label', () => {
    render(
      <TestWrapper>
        <Select options={options} label="Select Option" />
      </TestWrapper>
    );
    expect(screen.getByText('Select Option')).toBeInTheDocument();
  });

  it('should render with placeholder', () => {
    render(
      <TestWrapper>
        <Select options={options} placeholder="Choose..." testId="test-select" />
      </TestWrapper>
    );
    expect(screen.getByRole('option', { name: 'Choose...' })).toBeInTheDocument();
  });

  it('should handle value changes', () => {
    const handleChange = vi.fn();
    render(
      <TestWrapper>
        <Select options={options} onChange={handleChange} testId="test-select" />
      </TestWrapper>
    );
    fireEvent.change(screen.getByTestId('test-select'), { target: { value: 'option2' } });
    expect(handleChange).toHaveBeenCalledWith('option2');
  });

  it('should show error state', () => {
    render(
      <TestWrapper>
        <Select options={options} error errorMessage="Error message" testId="test-select" />
      </TestWrapper>
    );
    expect(screen.getByText('Error message')).toBeInTheDocument();
  });

  it('should be disabled', () => {
    render(
      <TestWrapper>
        <Select options={options} disabled testId="test-select" />
      </TestWrapper>
    );
    expect(screen.getByTestId('test-select')).toBeDisabled();
  });
});

describe('Card', () => {
  it('should render card', () => {
    render(
      <TestWrapper>
        <Card testId="test-card">Card content</Card>
      </TestWrapper>
    );
    expect(screen.getByTestId('test-card')).toBeInTheDocument();
  });

  it('should render with header, body, and footer', () => {
    render(
      <TestWrapper>
        <Card>
          <CardHeader title="Title" subtitle="Subtitle" testId="card-header" />
          <CardBody testId="card-body">Content</CardBody>
          <CardFooter testId="card-footer">Footer</CardFooter>
        </Card>
      </TestWrapper>
    );
    expect(screen.getByText('Title')).toBeInTheDocument();
    expect(screen.getByText('Subtitle')).toBeInTheDocument();
    expect(screen.getByText('Content')).toBeInTheDocument();
    expect(screen.getByText('Footer')).toBeInTheDocument();
  });

  it('should be clickable', () => {
    const handleClick = vi.fn();
    render(
      <TestWrapper>
        <Card clickable onClick={handleClick} testId="test-card">
          Clickable
        </Card>
      </TestWrapper>
    );
    fireEvent.click(screen.getByTestId('test-card'));
    expect(handleClick).toHaveBeenCalled();
  });

  it('should render with different variants', () => {
    const variants = ['elevated', 'outlined', 'filled'] as const;
    for (const variant of variants) {
      const { unmount } = render(
        <TestWrapper>
          <Card variant={variant} testId="test-card">
            {variant}
          </Card>
        </TestWrapper>
      );
      expect(screen.getByTestId('test-card')).toBeInTheDocument();
      unmount();
    }
  });
});

describe('Modal', () => {
  it('should not render when closed', () => {
    render(
      <TestWrapper>
        <Modal isOpen={false} onClose={() => {}}>
          <ModalBody>Content</ModalBody>
        </Modal>
      </TestWrapper>
    );
    expect(screen.queryByText('Content')).not.toBeInTheDocument();
  });

  it('should render when open', () => {
    render(
      <TestWrapper>
        <Modal isOpen={true} onClose={() => {}} testId="test-modal">
          <ModalBody>Content</ModalBody>
        </Modal>
      </TestWrapper>
    );
    expect(screen.getByText('Content')).toBeInTheDocument();
  });

  it('should call onClose when close button is clicked', () => {
    const handleClose = vi.fn();
    render(
      <TestWrapper>
        <Modal isOpen={true} onClose={handleClose}>
          <ModalHeader>Title</ModalHeader>
          <ModalBody>Content</ModalBody>
        </Modal>
      </TestWrapper>
    );
    fireEvent.click(screen.getByLabelText('Close modal'));
    expect(handleClose).toHaveBeenCalled();
  });

  it('should render with header, body, and footer', () => {
    render(
      <TestWrapper>
        <Modal isOpen={true} onClose={() => {}}>
          <ModalHeader>Modal Title</ModalHeader>
          <ModalBody>Modal Content</ModalBody>
          <ModalFooter>Modal Footer</ModalFooter>
        </Modal>
      </TestWrapper>
    );
    expect(screen.getByText('Modal Title')).toBeInTheDocument();
    expect(screen.getByText('Modal Content')).toBeInTheDocument();
    expect(screen.getByText('Modal Footer')).toBeInTheDocument();
  });

  it('should hide close button when showCloseButton is false', () => {
    render(
      <TestWrapper>
        <Modal isOpen={true} onClose={() => {}} showCloseButton={false}>
          <ModalHeader>Title</ModalHeader>
          <ModalBody>Content</ModalBody>
        </Modal>
      </TestWrapper>
    );
    expect(screen.queryByLabelText('Close modal')).not.toBeInTheDocument();
  });
});

describe('Toast', () => {
  // Test component that uses useToast
  function ToastTester() {
    const { toast, closeAll } = useToast();

    return (
      <div>
        <button onClick={() => toast({ title: 'Test Toast', status: 'success' })}>
          Show Toast
        </button>
        <button onClick={() => toast({ title: 'Error Toast', status: 'error' })}>
          Show Error
        </button>
        <button onClick={closeAll}>Close All</button>
      </div>
    );
  }

  it('should show toast when triggered', async () => {
    render(
      <TestWrapper>
        <ToastProvider>
          <ToastTester />
        </ToastProvider>
      </TestWrapper>
    );

    fireEvent.click(screen.getByText('Show Toast'));
    await waitFor(() => {
      expect(screen.getByText('Test Toast')).toBeInTheDocument();
    });
  });

  it('should show toast with different status', async () => {
    render(
      <TestWrapper>
        <ToastProvider>
          <ToastTester />
        </ToastProvider>
      </TestWrapper>
    );

    fireEvent.click(screen.getByText('Show Error'));
    await waitFor(() => {
      expect(screen.getByText('Error Toast')).toBeInTheDocument();
    });
  });

  it('should close all toasts', async () => {
    render(
      <TestWrapper>
        <ToastProvider>
          <ToastTester />
        </ToastProvider>
      </TestWrapper>
    );

    fireEvent.click(screen.getByText('Show Toast'));
    await waitFor(() => {
      expect(screen.getByText('Test Toast')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText('Close All'));
    await waitFor(() => {
      expect(screen.queryByText('Test Toast')).not.toBeInTheDocument();
    });
  });
});

describe('ThemeProvider', () => {
  it('should provide theme context', () => {
    function ThemeConsumer() {
      const { mode, resolvedMode } = useTheme();
      return (
        <div>
          <span data-testid="mode">{mode}</span>
          <span data-testid="resolved">{resolvedMode}</span>
        </div>
      );
    }

    render(
      <ThemeProvider defaultMode="light" disablePersistence>
        <ThemeConsumer />
      </ThemeProvider>
    );

    expect(screen.getByTestId('mode')).toHaveTextContent('light');
    expect(screen.getByTestId('resolved')).toHaveTextContent('light');
  });

  it('should toggle theme mode', () => {
    function ThemeToggler() {
      const { mode, toggleMode } = useTheme();
      return (
        <div>
          <span data-testid="mode">{mode}</span>
          <button onClick={toggleMode}>Toggle</button>
        </div>
      );
    }

    render(
      <ThemeProvider defaultMode="light" disablePersistence>
        <ThemeToggler />
      </ThemeProvider>
    );

    expect(screen.getByTestId('mode')).toHaveTextContent('light');
    fireEvent.click(screen.getByText('Toggle'));
    expect(screen.getByTestId('mode')).toHaveTextContent('dark');
  });
});
