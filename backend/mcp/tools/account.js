const User = require('../../models/User');
const { NotFoundError } = require('../../services/errors');

module.exports = [
  {
    name: 'whoami',
    title: 'Who am I',
    description: 'Return the Gift Guru account this connection acts as (name, email) and the granted scopes. '
      + 'Scope "wishlists" allows every tool; "wishlists:read" allows read-only tools only.',
    annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true },
    inputSchema: {},
    async handler(_args, ctx) {
      const user = await User.findById(ctx.userId).select('name email');
      if (!user) throw new NotFoundError('User not found');
      const data = {
        id: user._id.toString(),
        name: user.name,
        email: user.email,
        scopes: ctx.scopes,
        client: ctx.clientName
      };
      return {
        text: `Signed in as ${user.name || user.email} <${user.email}> with scope: ${ctx.scopes.join(' ')}`,
        data
      };
    }
  }
];
