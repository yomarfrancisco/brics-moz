export default function handler(req, res) {
  res.status(200).json({ 
    message: 'Minimal test works!',
    timestamp: new Date().toISOString()
  });
}
