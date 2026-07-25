// Manual mock for services/api.js. Opt in per test file with
// `jest.mock('../../services/api')` (path relative to the test file), then
// configure return values with e.g. `fetchListItems.mockResolvedValue(...)`.
// Keep this in sync with the named exports in the real module.

export const api = {
  get: jest.fn(() => Promise.resolve({ data: null })),
  post: jest.fn(() => Promise.resolve({ data: null })),
  put: jest.fn(() => Promise.resolve({ data: null })),
  delete: jest.fn(() => Promise.resolve({ data: null })),
};

export const createWishlistItem = jest.fn();
export const updateWishlistItem = jest.fn();
export const deleteWishlistItem = jest.fn();
export const fetchLists = jest.fn();
export const createList = jest.fn();
export const updateList = jest.fn();
export const deleteList = jest.fn();
export const fetchListItems = jest.fn();
export const shareList = jest.fn();
export const getSharedUsers = jest.fn();
export const unshareList = jest.fn();
export const getSharedWithMe = jest.fn();
export const claimItem = jest.fn();
export const getPublicList = jest.fn();
export const joinListViaInvite = jest.fn();
export const claimItemPublic = jest.fn();
export const getInviteLinkStatus = jest.fn();
export const generateInviteLink = jest.fn();
export const disableInviteLink = jest.fn();
export const setAnonymousClaims = jest.fn();
