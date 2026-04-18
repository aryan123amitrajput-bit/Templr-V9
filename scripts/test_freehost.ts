import 'dotenv/config';
import { freeHostService } from '../api/services/freeHostService';

async function testFreeHost() {
  console.log('--- Testing FreeHostService ---');
  await (freeHostService as any).ensureLoaded();
  const registry = await freeHostService.getRegistry();
  console.log('Registry state:', JSON.stringify(registry, null, 2));
  
  const templates = await freeHostService.getTemplates(0, 10);
  console.log('Templates returned:', templates.length);
  if (templates.length > 0) {
    console.log('First template:', JSON.stringify(templates[0], null, 2));
  }
}

testFreeHost().catch(console.error);
