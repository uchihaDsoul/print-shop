const cloudinary = require("cloudinary").v2;

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

// Upload a file held in memory. Returns the info we store in MongoDB.
function saveFile(buffer) {
  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      { folder: "printshop", resource_type: "auto" },
      (err, result) => {
        if (err) return reject(err);
        resolve({
          fileUrl: result.secure_url,
          filePublicId: result.public_id,
          fileResourceType: result.resource_type,
        });
      }
    );
    stream.end(buffer);
  });
}

async function deleteFile(publicId, resourceType) {
  await cloudinary.uploader.destroy(publicId, {
    resource_type: resourceType || "image",
  });
}

module.exports = { saveFile, deleteFile };