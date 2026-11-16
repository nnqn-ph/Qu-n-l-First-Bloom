import { PGlite } from '@electric-sql/pglite';
// @ts-ignore
import { createServer } from 'pglite-server';
import path from 'path';

async function startDevDb() {
  const dataDir = path.resolve(__dirname, '../dev-postgres-data');
  console.log(`🐘 [Dev Database] Đang khởi động PostgreSQL cục bộ tại: ${dataDir}...`);

  const db = new PGlite(dataDir);
  await db.waitReady;

  const PORT = 5432;
  const pgServer = createServer(db);

  pgServer.listen(PORT, () => {
    console.log(`🐘 [Dev Database] PostgreSQL server đang lắng nghe tại cổng TCP: ${PORT}`);
    console.log(`🔗 DATABASE_URL="postgresql://postgres:postgres@localhost:5432/first_bloom?schema=public"`);
  });
}

startDevDb().catch(console.error);
