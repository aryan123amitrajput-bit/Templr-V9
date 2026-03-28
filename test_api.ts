import 'dotenv/config';

async function test() {
  try {
    const res = await fetch('http://localhost:3000/api/templates?limit=100');
    const json = await res.json();
    console.log('Total returned:', json.data?.length);
    console.log('First few:', json.data?.slice(0, 3).map((d: any) => d.title));
  } catch (e: any) {
    console.error(e.message);
  }
}

test();
