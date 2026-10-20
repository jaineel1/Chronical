/** The only writes the web explorer makes: deleting a node together with every edge that touches it. */
import { db } from '@/data/db';

export async function deleteWebNode(id: string): Promise<void> {
  await db.transaction('rw', db.webNodes, db.webEdges, async () => {
    await db.webEdges.where('from').equals(id).delete();
    await db.webEdges.where('to').equals(id).delete();
    await db.webNodes.delete(id);
  });
}
