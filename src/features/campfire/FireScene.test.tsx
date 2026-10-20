import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { FireScene } from './FireScene';

describe('FireScene motion', () => {
  it('shows embers with nothing logged and no sparks on open', () => {
    render(<FireScene logged={0} total={10} />);
    expect(screen.getByTestId('fire-embers')).toBeInTheDocument();
    expect(screen.queryByTestId('fire-sparks')).toBeNull();
  });

  it('opens with flames and no sparks when something is already logged', () => {
    render(<FireScene logged={4} total={10} />);
    expect(screen.getByTestId('fire-flames')).toBeInTheDocument();
    expect(screen.queryByTestId('fire-sparks')).toBeNull();
  });

  it('throws sparks when the count goes up, and not when it goes down', () => {
    const { rerender } = render(<FireScene logged={0} total={10} />);
    rerender(<FireScene logged={1} total={10} />);
    expect(screen.getByTestId('fire-flames')).toBeInTheDocument();
    const first = screen.getByTestId('fire-sparks');
    expect(first.children).toHaveLength(3);

    rerender(<FireScene logged={3} total={10} />);
    const second = screen.getByTestId('fire-sparks');
    expect(second).not.toBe(first); // a new burst restarts the animation
    expect(second.children).toHaveLength(4);

    rerender(<FireScene logged={2} total={10} />);
    expect(screen.getByTestId('fire-sparks')).toBe(second);
  });
});
