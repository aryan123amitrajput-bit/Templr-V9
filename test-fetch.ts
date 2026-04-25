import axios from 'axios';
async function test() {
  const url = 'https://h.uguu.se/SFfikkZH.png';
  console.log('Fetching', url);
  try {
    const res = await axios.get(url, { responseType: 'arraybuffer' });
    console.log('Success:', res.data.length);
  } catch (e: any) {
    console.log('Error:', e.message);
  }
}
test();
