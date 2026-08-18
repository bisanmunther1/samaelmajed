import { fireEvent, render, screen } from '@testing-library/react';
import StarRating from './StarRating';

// FR-44 puts a real `dir` on <html>, which StarRating now inherits. These
// tests describe LTR behaviour, so they state that rather than relying on
// whatever the document happens to be set to.
beforeEach(() => {
  document.documentElement.setAttribute('dir', 'ltr');
});

test('renders a read-only rating as an image with the value in its label', () => {
  render(<StarRating value={4} />);

  expect(screen.getByRole('img', { name: '4 من 5' })).toBeInTheDocument();
  expect(screen.queryAllByRole('radio')).toHaveLength(0);
});

test('rounds a decimal average to the nearest half star', () => {
  render(<StarRating value={4.3} showValue />);

  expect(screen.getByRole('img', { name: '4.5 من 5' })).toBeInTheDocument();
  expect(screen.getByText('4.5')).toBeInTheDocument();
});

test('becomes an interactive radiogroup when onChange is given', () => {
  render(<StarRating value={0} onChange={jest.fn()} />);

  expect(screen.getByRole('radiogroup', { name: 'التقييم بالنجوم' })).toBeInTheDocument();
  expect(screen.getAllByRole('radio')).toHaveLength(5);
});

test('clicking a star reports its value', () => {
  const handleChange = jest.fn();
  render(<StarRating value={0} onChange={handleChange} />);

  fireEvent.click(screen.getByRole('radio', { name: '3 من 5 نجوم' }));

  expect(handleChange).toHaveBeenCalledWith(3);
});

test('marks only the selected star as checked', () => {
  render(<StarRating value={2} onChange={jest.fn()} />);

  expect(screen.getByRole('radio', { name: '2 من 5 نجوم' })).toBeChecked();
  expect(screen.getByRole('radio', { name: '3 من 5 نجوم' })).not.toBeChecked();
});

test('arrow keys move the rating in LTR', () => {
  const handleChange = jest.fn();
  render(<StarRating value={3} onChange={handleChange} />);
  const group = screen.getByRole('radiogroup');

  fireEvent.keyDown(group, { key: 'ArrowRight' });
  expect(handleChange).toHaveBeenLastCalledWith(4);

  fireEvent.keyDown(group, { key: 'ArrowLeft' });
  expect(handleChange).toHaveBeenLastCalledWith(2);
});

test('horizontal arrow keys are mirrored inside an RTL container', () => {
  const handleChange = jest.fn();
  render(
    <div dir="rtl">
      <StarRating value={3} onChange={handleChange} />
    </div>
  );
  const group = screen.getByRole('radiogroup');

  fireEvent.keyDown(group, { key: 'ArrowLeft' });
  expect(handleChange).toHaveBeenLastCalledWith(4);

  fireEvent.keyDown(group, { key: 'ArrowRight' });
  expect(handleChange).toHaveBeenLastCalledWith(2);
});

test('Enter confirms the current value', () => {
  const handleChange = jest.fn();
  render(<StarRating value={5} onChange={handleChange} />);

  fireEvent.keyDown(screen.getByRole('radiogroup'), { key: 'Enter' });

  expect(handleChange).toHaveBeenCalledWith(5);
});

test('Home and End jump to the ends of the scale', () => {
  const handleChange = jest.fn();
  render(<StarRating value={3} onChange={handleChange} />);
  const group = screen.getByRole('radiogroup');

  fireEvent.keyDown(group, { key: 'End' });
  expect(handleChange).toHaveBeenLastCalledWith(5);

  fireEvent.keyDown(group, { key: 'Home' });
  expect(handleChange).toHaveBeenLastCalledWith(1);
});

test('the rating never leaves the 1-5 range', () => {
  const handleChange = jest.fn();
  const { rerender } = render(<StarRating value={5} onChange={handleChange} />);

  fireEvent.keyDown(screen.getByRole('radiogroup'), { key: 'ArrowRight' });
  expect(handleChange).toHaveBeenLastCalledWith(5);

  rerender(<StarRating value={1} onChange={handleChange} />);
  fireEvent.keyDown(screen.getByRole('radiogroup'), { key: 'ArrowLeft' });
  expect(handleChange).toHaveBeenLastCalledWith(1);
});

test('only the selected star is reachable with Tab', () => {
  render(<StarRating value={4} onChange={jest.fn()} />);

  const tabbable = screen.getAllByRole('radio').filter((star) => star.tabIndex === 0);
  expect(tabbable).toHaveLength(1);
  expect(tabbable[0]).toHaveAccessibleName('4 من 5 نجوم');
});
