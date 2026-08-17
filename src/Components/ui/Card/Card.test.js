import { render, screen, fireEvent } from '@testing-library/react';
import Card, { CardMedia, CardBody, CardFooter } from './Card';

test('renders its children', () => {
  render(<Card>Hello card</Card>);
  expect(screen.getByText('Hello card')).toBeInTheDocument();
});

test('calls onClick when clicked and hoverable', () => {
  const handleClick = jest.fn();
  render(<Card hoverable onClick={handleClick}>Clickable</Card>);
  fireEvent.click(screen.getByText('Clickable'));
  expect(handleClick).toHaveBeenCalledTimes(1);
});

test('composes with CardMedia, CardBody and CardFooter', () => {
  render(
    <Card padding={false}>
      <CardMedia src="/img.jpg" alt="A trip" />
      <CardBody>Body content</CardBody>
      <CardFooter>Footer content</CardFooter>
    </Card>
  );

  expect(screen.getByRole('img', { name: 'A trip' })).toBeInTheDocument();
  expect(screen.getByText('Body content')).toBeInTheDocument();
  expect(screen.getByText('Footer content')).toBeInTheDocument();
});
