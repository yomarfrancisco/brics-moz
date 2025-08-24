export default function handler(req, res) {
  res.status(200).json({
    success: true,
    message: 'Simple serverless function is working!',
    timestamp: new Date().toISOString(),
    method: req.method,
    url: req.url
  });
}
