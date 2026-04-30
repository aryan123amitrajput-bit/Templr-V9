import axios from 'axios';

async function run() {
  try {
    const res = await axios.get('http://localhost:3000/api/templates');
    console.log(res.status);
    console.log(res.data.data?.length);
    console.log(res.data.data?.[0]);
  } catch (e) {
    console.error(e.message);
  }
}
run();
