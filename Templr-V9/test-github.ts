
import axios from 'axios';

async function test() {
  const urls = [
    'https://raw.githubusercontent.com/aryan123amitrajput-bit/Fluid-Fitness/main/registry.json',
    'https://raw.githubusercontent.com/aryan123amitrajput-bit/Fluid-Fitness/master/registry.json',
    'https://raw.githubusercontent.com/aryan123amitrajput-bit/Fluid-Fitness/main/templates/registry.json',
    'https://raw.githubusercontent.com/aryan123amitrajput-bit/Fluid-Fitness/master/templates/registry.json'
  ];

  for (const url of urls) {
    try {
      const res = await axios.get(url);
      console.log(`Success for ${url}:`, res.data.length, 'templates');
      return;
    } catch (e: any) {
      console.log(`Failed for ${url}: ${e.response?.status || e.message}`);
    }
  }
}

test();
