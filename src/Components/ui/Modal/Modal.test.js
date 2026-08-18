import { render, screen, fireEvent } from '@testing-library/react';
import Modal from './Modal';
import { set_language } from '../../../i18n';

// This suite describes the English rendering, so it pins the language rather
// than depending on the app default (Arabic).
beforeEach(() => {
  set_language('en');
});

test('renders nothing when isOpen is false', () => {
  render(<Modal isOpen={false} onClose={() => {}} title="Hidden">Content</Modal>);
  expect(screen.queryByText('Content')).not.toBeInTheDocument();
});

test('renders its title and children when open', () => {
  render(<Modal isOpen onClose={() => {}} title="My Modal">Content</Modal>);
  expect(screen.getByText('My Modal')).toBeInTheDocument();
  expect(screen.getByText('Content')).toBeInTheDocument();
});

test('calls onClose when the close button is clicked', () => {
  const handleClose = jest.fn();
  render(<Modal isOpen onClose={handleClose} title="My Modal">Content</Modal>);
  fireEvent.click(screen.getByRole('button', { name: 'Close' }));
  expect(handleClose).toHaveBeenCalledTimes(1);
});

test('does not call onClose when the dialog content is clicked', () => {
  const handleClose = jest.fn();
  render(<Modal isOpen onClose={handleClose} title="My Modal">Content</Modal>);

  fireEvent.click(screen.getByText('Content'));
  expect(handleClose).not.toHaveBeenCalled();

  fireEvent.click(screen.getByRole('dialog'));
  expect(handleClose).not.toHaveBeenCalled();
});

test('calls onClose when the overlay backdrop itself is clicked', () => {
  const handleClose = jest.fn();
  render(<Modal isOpen onClose={handleClose} title="My Modal">Content</Modal>);

  fireEvent.click(document.querySelector('.ui-modal-overlay'));
  expect(handleClose).toHaveBeenCalledTimes(1);
});

test('calls onClose when Escape is pressed', () => {
  const handleClose = jest.fn();
  render(<Modal isOpen onClose={handleClose} title="My Modal">Content</Modal>);
  fireEvent.keyDown(document, { key: 'Escape' });
  expect(handleClose).toHaveBeenCalledTimes(1);
});

test('renders the optional footer', () => {
  render(<Modal isOpen onClose={() => {}} title="My Modal" footer={<span>Footer content</span>}>Content</Modal>);
  expect(screen.getByText('Footer content')).toBeInTheDocument();
});
