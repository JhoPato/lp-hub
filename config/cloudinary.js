const cloudinary = require('cloudinary').v2;
const { CloudinaryStorage } = require('multer-storage-cloudinary');
const multer = require('multer');

cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key:    process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET,
});

function makeStorage(folder, maxSizeMB = 5) {
    const options = arguments[2] || {};
    const extraParams = options.params || {};
    const allowedMimeTypes = options.allowedMimeTypes || null;
    const storage = new CloudinaryStorage({
        cloudinary,
        params: async () => ({
            folder,
            ...extraParams,
        }),
    });
    const uploadOptions = {
        storage,
        limits: { fileSize: maxSizeMB * 1024 * 1024 },
    };

    if (allowedMimeTypes?.length) {
        uploadOptions.fileFilter = (_req, file, cb) => {
            if (allowedMimeTypes.includes(file.mimetype)) return cb(null, true);
            cb(new Error('Unsupported file type. Use WEBP, PNG or JPG/JPEG.'));
        };
    }

    return multer(uploadOptions);
}

const uploadProfile    = makeStorage('lp-hub/profiles', 2);
const uploadTeamLogo   = makeStorage('lp-hub/teams', 2);
const uploadScreenshot = makeStorage('lp-hub/pracc', 5);
const uploadGallery    = makeStorage('lp-hub/gallery', 5);
const uploadTaskFile   = makeStorage('lp-hub/tasks', 10);
const uploadSiteContent = makeStorage('lp-hub/site-content', 5, {
    allowedMimeTypes: ['image/webp', 'image/png', 'image/jpeg', 'image/jpg'],
    params: { resource_type: 'image' },
});

async function deleteImage(publicId) {
    if (!publicId) return;
    try {
        await cloudinary.uploader.destroy(publicId);
    } catch (err) {
        console.error('[Cloudinary] Delete failed:', err.message);
    }
}

module.exports = {
    cloudinary,
    uploadProfile,
    uploadTeamLogo,
    uploadScreenshot,
    uploadGallery,
    uploadTaskFile,
    uploadSiteContent,
    deleteImage,
};
