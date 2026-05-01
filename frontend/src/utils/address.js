export const EMPTY_ADDRESS = {
  recipientName: '',
  line1: '',
  line2: '',
  city: '',
  state: '',
  postalCode: '',
  country: '',
};

export function hasMailingAddress(address) {
  if (!address) return false;
  return Object.values(address).some((v) => typeof v === 'string' && v.trim().length > 0);
}

export function formatMailingAddress(address) {
  if (!hasMailingAddress(address)) return null;

  const lines = [];
  const trim = (v) => (typeof v === 'string' ? v.trim() : '');

  if (trim(address.recipientName)) lines.push(trim(address.recipientName));
  if (trim(address.line1)) lines.push(trim(address.line1));
  if (trim(address.line2)) lines.push(trim(address.line2));

  const cityStateZip = [trim(address.city), trim(address.state)]
    .filter(Boolean)
    .join(', ');
  const withZip = [cityStateZip, trim(address.postalCode)].filter(Boolean).join(' ');
  if (withZip) lines.push(withZip);

  if (trim(address.country)) lines.push(trim(address.country));

  return lines;
}
