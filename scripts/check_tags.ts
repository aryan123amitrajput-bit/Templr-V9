import { getPublicTemplates } from '../api';

async function check() {
  const res = await getPublicTemplates(0, 1);
  console.log("Tags:", res.data[0].tags);
  console.log("Type of tags:", typeof res.data[0].tags);
  console.log("Is array:", Array.isArray(res.data[0].tags));
  process.exit(0);
}

check().catch(console.error);
