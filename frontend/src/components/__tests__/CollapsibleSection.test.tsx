import { describe, it, expect, vi } from 'vitest';
import { render, fireEvent } from '@testing-library/react';

vi.mock('cesium', () => ({}));

vi.mock('lucide-react', () => ({
  ChevronDown: ({ style }: { style?: React.CSSProperties }) => (
    <svg data-testid="chevron-icon" style={style} />
  ),
}));

import { CollapsibleSection } from '../CollapsibleSection';

describe('CollapsibleSection', () => {
  it('renders title prop as visible text in the DOM', () => {
    const { getByText } = render(
      <CollapsibleSection title="Layers" open={true} onToggle={() => {}}>
        <div>child content</div>
      </CollapsibleSection>
    );
    expect(getByText('Layers')).toBeTruthy();
  });

  it('children are present in DOM when open=true', () => {
    const { getByText } = render(
      <CollapsibleSection title="Layers" open={true} onToggle={() => {}}>
        <div>child content</div>
      </CollapsibleSection>
    );
    expect(getByText('child content')).toBeTruthy();
  });

  it('gridTemplateRows style is "0fr" on the grid container when open=false', () => {
    const { getByTestId } = render(
      <CollapsibleSection title="Layers" open={false} onToggle={() => {}}>
        <div>child content</div>
      </CollapsibleSection>
    );
    const gridContainer = getByTestId('collapsible-grid');
    expect((gridContainer as HTMLElement).style.gridTemplateRows).toBe('0fr');
  });

  it('onToggle callback fires when header button is clicked', () => {
    const onToggle = vi.fn();
    const { getByRole } = render(
      <CollapsibleSection title="Layers" open={true} onToggle={onToggle}>
        <div>child content</div>
      </CollapsibleSection>
    );
    fireEvent.click(getByRole('button'));
    expect(onToggle).toHaveBeenCalledTimes(1);
  });
});
