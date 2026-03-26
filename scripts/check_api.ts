import { getPublicTemplates } from '../api';

async function check() {
  const res = await getPublicTemplates(0, 6, '', 'All', 'newest');
  console.log("Templates newest:", res.data.length);
  if (res.error) console.error("Error newest:", res.error);

  process.exit(0);
}

check().catch(console.error);
