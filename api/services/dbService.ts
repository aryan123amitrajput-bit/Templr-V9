import mysql from 'mysql2/promise';

const pool = mysql.createPool({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
});

export async function saveTemplate(template: { title: string, description: string, image_url: string }) {
  const [result] = await pool.execute(
    'INSERT INTO templates (title, description, image_url, created_at) VALUES (?, ?, ?, NOW())',
    [template.title, template.description, template.image_url]
  );
  return result;
}
