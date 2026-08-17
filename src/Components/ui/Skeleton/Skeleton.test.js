import { render } from '@testing-library/react';
import Skeleton from './Skeleton';

test('renders with the requested width and height', () => {
  const { container } = render(<Skeleton width="120px" height="20px" />);
  const el = container.firstChild;
  expect(el).toHaveStyle({ width: '120px', height: '20px' });
});

test('is hidden from assistive tech since it is purely decorative', () => {
  const { container } = render(<Skeleton />);
  expect(container.firstChild).toHaveAttribute('aria-hidden', 'true');
});
