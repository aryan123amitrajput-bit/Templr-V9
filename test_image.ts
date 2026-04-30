import axios from 'axios';
async function run() {
  try {
    const res = await axios.head('https://i.imageupload.app/122654c4894fa2233eb4.jpeg');
    console.log(res.status);
  } catch (e) {
    if (e.response) {
      console.log(e.response.status);
    } else {
      console.log(e.message);
    }
  }
}
run();
