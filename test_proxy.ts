import axios from 'axios';
async function run() {
  try {
    const res = await axios.get('http://localhost:3000/api/proxy/image?url=' + encodeURIComponent('https://d.uguu.se/ewvnfyKM.jpg'));
    console.log(res.status);
    console.log(res.data.length);
  } catch (e) {
    console.error(e.response?.status || e.message);
  }
}
run();
