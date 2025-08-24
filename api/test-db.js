import { MongoClient } from 'mongodb'

export default async function handler(req, res) {
  const uri = process.env.MONGODB_URI
  if (!uri) return res.status(500).json({ error: 'Missing MONGODB_URI in env' })

  const client = new MongoClient(uri)

  try {
    await client.connect()
    const db = client.db('admin')
    const collections = await db.listCollections().toArray()
    res.status(200).json({ status: 'Connected', collections })
  } catch (err) {
    res.status(500).json({ error: 'Connection failed', details: err.message })
  } finally {
    await client.close()
  }
}
