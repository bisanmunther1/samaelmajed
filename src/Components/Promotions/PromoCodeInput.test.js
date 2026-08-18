jest.mock('./promotionsApi');

import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import PromoCodeInput from './PromoCodeInput';
import { promo_error_message, validate_promo_code } from './promotionsApi';

const QUOTE = {
  valid: true, code: 'SAVE10', description: 'خصم ترحيبي',
  discount_amount: '20.00', final_amount: '180.00',
};

function renderInput(props = {}) {
  return render(
    <PromoCodeInput
      tripName="Cairo Trip"
      amount={200}
      applied={null}
      onApplied={jest.fn()}
      onRemoved={jest.fn()}
      {...props}
    />
  );
}

beforeEach(() => {
  jest.clearAllMocks();
  promo_error_message.mockReturnValue('تعذّر تطبيق الكود، حاول مرة أخرى.');
});

test('applying a code sends it with the trip and amount', async () => {
  validate_promo_code.mockResolvedValue(QUOTE);
  const handleApplied = jest.fn();
  renderInput({ onApplied: handleApplied });

  fireEvent.change(screen.getByLabelText('كود الخصم'), { target: { value: 'save10' } });
  fireEvent.click(screen.getByRole('button', { name: 'تطبيق' }));

  await waitFor(() => expect(validate_promo_code).toHaveBeenCalledWith({
    code: 'save10', trip: 'Cairo Trip', amount: 200,
  }));
  await waitFor(() => expect(handleApplied).toHaveBeenCalledWith(QUOTE));
});

test('an empty code is refused without calling the API', async () => {
  renderInput();

  fireEvent.click(screen.getByRole('button', { name: 'تطبيق' }));

  expect(await screen.findByRole('alert')).toHaveTextContent('الرجاء إدخال كود الخصم.');
  expect(validate_promo_code).not.toHaveBeenCalled();
});

test('an invalid code shows the server message inline', async () => {
  validate_promo_code.mockRejectedValue({
    response: { status: 400, data: { code: 'promo_not_found' } },
  });
  promo_error_message.mockReturnValue('كود الخصم غير صحيح.');
  renderInput();

  fireEvent.change(screen.getByLabelText('كود الخصم'), { target: { value: 'GHOST' } });
  fireEvent.click(screen.getByRole('button', { name: 'تطبيق' }));

  expect(await screen.findByRole('alert')).toHaveTextContent('كود الخصم غير صحيح.');
});

test('the apply button is disabled while the request is in flight', async () => {
  let resolve_validate;
  validate_promo_code.mockReturnValue(new Promise((resolve) => { resolve_validate = resolve; }));
  renderInput();

  fireEvent.change(screen.getByLabelText('كود الخصم'), { target: { value: 'SAVE10' } });
  const apply = screen.getByRole('button', { name: 'تطبيق' });
  fireEvent.click(apply);

  await waitFor(() => expect(apply).toBeDisabled());

  resolve_validate(QUOTE);
  await waitFor(() => expect(validate_promo_code).toHaveBeenCalled());
});

test('an applied code shows its name and a remove link instead of the field', () => {
  renderInput({ applied: QUOTE });

  expect(screen.getByText('تم تطبيق الكود SAVE10')).toBeInTheDocument();
  expect(screen.getByText('خصم ترحيبي')).toBeInTheDocument();
  expect(screen.queryByLabelText('كود الخصم')).not.toBeInTheDocument();
});

test('remove clears the applied code', () => {
  const handleRemoved = jest.fn();
  renderInput({ applied: QUOTE, onRemoved: handleRemoved });

  fireEvent.click(screen.getByRole('button', { name: 'إزالة' }));

  expect(handleRemoved).toHaveBeenCalled();
});

test('a 401 prompts for login rather than crashing', async () => {
  const unauthorised = new Error('login required');
  unauthorised.requires_login = true;
  validate_promo_code.mockRejectedValue(unauthorised);
  promo_error_message.mockReturnValue('يرجى تسجيل الدخول لاستخدام كود الخصم.');
  renderInput();

  fireEvent.change(screen.getByLabelText('كود الخصم'), { target: { value: 'SAVE10' } });
  fireEvent.click(screen.getByRole('button', { name: 'تطبيق' }));

  expect(await screen.findByRole('alert')).toHaveTextContent('يرجى تسجيل الدخول لاستخدام كود الخصم.');
});
