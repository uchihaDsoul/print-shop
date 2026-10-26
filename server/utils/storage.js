const cloudinary = require("cloudinary").v2;

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

// Upload privately. Returns the info we store in MongoDB.
function saveFile(buffer) {
  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      { folder: "printshop", resource_type: "auto", type: "private" },
      (err, result) => {
        if (err) return reject(err);
        resolve({
          fileUrl: "", // no public link is stored any more
          filePublicId: result.public_id,
          fileResourceType: result.resource_type,
          fileFormat: result.format || "",
        });
      }
    );
    stream.end(buffer);
  });
}

// Short-lived download link (expires in 2 minutes)
function getTempUrl(publicId, resourceType, format) {
  const expires = Math.floor(Date.now() / 1000) + 120;
  return cloudinary.utils.private_download_url(publicId, format || "", {
    resource_type: resourceType || "image",
    type: "private",
    expires_at: expires,
  });
}

async function deleteFile(publicId, resourceType) {
  await cloudinary.uploader.destroy(publicId, {
    resource_type: resourceType || "image",
    type: "private",
  });
}

module.exports = { saveFile, getTempUrl, deleteFile };