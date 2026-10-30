// Catches errors in async routes so the server answers with JSON instead of hanging.
module.exports = (fn) => (req, res, next) =>
  Promise.resolve(fn(req, res, next)).catch((err) => {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  });