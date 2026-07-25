import { renderWithProviders, screen } from '../test-utils';
import MailingAddressCard from './MailingAddressCard';

describe('MailingAddressCard', () => {
  it('renders nothing when there is no address', () => {
    const { container } = renderWithProviders(<MailingAddressCard address={null} />);
    expect(container).toBeEmptyDOMElement();
  });

  it('renders nothing when every address field is blank', () => {
    const { container } = renderWithProviders(
      <MailingAddressCard address={{ line1: '', city: '', state: '' }} />
    );
    expect(container).toBeEmptyDOMElement();
  });

  it('renders the formatted address lines when given a real address', () => {
    renderWithProviders(
      <MailingAddressCard
        address={{
          recipientName: 'Jamie Lee',
          line1: '123 Main St',
          city: 'Seattle',
          state: 'WA',
          postalCode: '98101',
        }}
      />
    );

    expect(screen.getByText('SHIP GIFTS TO')).toBeInTheDocument();
    expect(screen.getByText('Jamie Lee')).toBeInTheDocument();
    expect(screen.getByText('123 Main St')).toBeInTheDocument();
    expect(screen.getByText('Seattle, WA 98101')).toBeInTheDocument();
  });
});
