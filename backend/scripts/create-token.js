// Print a personal access token for the local MCP server.
//   npm run mcp:token -- --email you@example.com [--scope wishlists|wishlists:read] [--name "My laptop"]
const path = require('path');
const mongoose = require('mongoose');
require('dotenv').config({ path: path.join(__dirname, '../../.env.development') });

const User = require('../models/User');
const { createPat } = require('../mcp/tokens');

function arg(name, fallback) {
  const i = process.argv.indexOf(`--${name}`);
  return i !== -1 && process.argv[i + 1] ? process.argv[i + 1] : fallback;
}

async function main() {
  const email = arg('email', process.env.DEV_USER_EMAIL);
  const scope = arg('scope', 'wishlists');
  const name = arg('name', 'Local dev token');
  if (!email) throw new Error('Pass --email');

  // Use localhost when running outside Docker, mongodb service name inside Docker
  const mongoUri = process.env.MONGODB_URI?.replace('mongodb://mongodb:', 'mongodb://localhost:')
    || 'mongodb://localhost:27017/wishlist';
  await mongoose.connect(mongoUri);

  const user = await User.findOne({ email: email.toLowerCase() });
  if (!user || user.isPending) throw new Error(`No active user with email ${email}. Run npm run seed first?`);

  const { token } = await createPat({ userId: user._id, name, scope });
  console.log(`PAT for ${user.email} (scope ${scope}). Shown once:\n\n${token}\n`);
}

main()
  .catch(err => {
    console.error(err.message);
    process.exitCode = 1;
  })
  .finally(() => mongoose.disconnect());
