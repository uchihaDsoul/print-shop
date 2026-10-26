const multer = require("multer");

const ALLOWED = ["application/pdf", "image/jpeg", "image/png"];

const upload = multer({
  storage: multer.memoryStorage(), // keep file in RAM, then send to Cloudinary
  limits: { fileSize: 20 * 1024 * 1024 }, // 20 MB
  fileFilter: (req, file, cb) => {
    if (ALLOWED.includes(file.mimetype)) cb(null, true);
    else cb(new Error("Only PDF, JPG and PNG files are allowed"));
  },
});

// Middleware that turns upload errors into friendly JSON
function uploadOne(req, res, next) {
  upload.single("file")(req, res, (err) => {
    if (err) {
      const msg =
        err.code === "LIMIT_FILE_SIZE" ? "File is too large (max 20 MB)" : err.message;
      return res.status(400).json({ error: msg });
    }
    next();
  });
}

module.exports = { uploadOne };