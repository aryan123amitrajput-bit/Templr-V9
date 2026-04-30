import axios from 'axios';
async function run() {
  try {
    const res = await axios.get('http://localhost:3000/api/proxy/image?url=' + encodeURIComponent('/api/proxy/image?url=something'));
    console.log(res.status);
  } catch (e) {
    console.error(e.response?.status || e.message);
  }
}
run();
