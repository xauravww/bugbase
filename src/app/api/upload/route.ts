import { NextRequest, NextResponse } from "next/server";
import { getAuthUser } from "@/lib/auth";

const ALLOWED_MIME_TYPES = [
  "image/jpeg",
  "image/png",
  "image/gif",
  "image/webp",
  "image/svg+xml",
];

const ALLOWED_EXTENSIONS = [".jpg", ".jpeg", ".png", ".gif", ".webp", ".svg"];

function getFileExtension(filename: string): string {
  return filename.toLowerCase().slice(filename.lastIndexOf("."));
}

function isValidImageType(mimeType: string, filename: string): boolean {
  const ext = getFileExtension(filename);
  return ALLOWED_MIME_TYPES.includes(mimeType) || ALLOWED_EXTENSIONS.includes(ext);
}

async function uploadToImgBB(image: File, apiKey: string) {
  const formData = new FormData();
  formData.append("key", apiKey);
  formData.append("image", image);

  const response = await fetch("https://api.imgbb.com/1/upload", {
    method: "POST",
    body: formData,
  });

  const data = await response.json();

  if (!data.success) {
    throw new Error("ImgBB upload failed");
  }

  return {
    url: data.data.url,
    deleteHash: data.data.delete_url,
    thumbnail: data.data.thumb?.url || data.data.url,
    provider: "imgbb",
  };
}

async function uploadToFreeImage(image: File, apiKey: string) {
  // FreeImage.host expects base64-encoded image as 'source'
  const arrayBuffer = await image.arrayBuffer();
  const base64 = Buffer.from(arrayBuffer).toString("base64");

  const formData = new FormData();
  formData.append("key", apiKey);
  formData.append("action", "upload");
  formData.append("source", base64);
  formData.append("format", "json");

  const response = await fetch("https://freeimage.host/api/1/upload", {
    method: "POST",
    body: formData,
  });

  const data = await response.json();

  if (data.status_code !== 200) {
    throw new Error("FreeImage upload failed");
  }

  // FreeImage may return HTTP URLs — upgrade to HTTPS to avoid mixed content
  const toHttps = (u: string) => u.replace(/^http:\/\//i, "https://");

  return {
    url: toHttps(data.image.url),
    deleteHash: data.image.url_viewer || null,
    thumbnail: toHttps(data.image.thumb?.url || data.image.display_url || data.image.url),
    provider: "freeimage",
  };
}

// POST /api/upload - Upload image to ImgBB (with FreeImage.host fallback)
export async function POST(request: NextRequest) {
  try {
    const authUser = getAuthUser(request);

    if (!authUser) {
      return NextResponse.json(
        { error: "Unauthorized", code: "UNAUTHORIZED" },
        { status: 401 }
      );
    }

    const imgbbKey = process.env.IMGBB_API_KEY;
    const freeimageKey = process.env.FREEIMAGE_API_KEY;

    if (!imgbbKey && !freeimageKey) {
      return NextResponse.json(
        { error: "Image upload not configured", code: "NOT_CONFIGURED" },
        { status: 500 }
      );
    }

    const formData = await request.formData();
    const image = formData.get("image");

    if (!image) {
      return NextResponse.json(
        { error: "No image provided", code: "VALIDATION_ERROR" },
        { status: 400 }
      );
    }

    // Validate file type
    if (!(image instanceof File)) {
      return NextResponse.json(
        { error: "Invalid file", code: "VALIDATION_ERROR" },
        { status: 400 }
      );
    }

    const mimeType = image.type;
    const filename = image.name;

    if (!isValidImageType(mimeType, filename)) {
      return NextResponse.json(
        { error: "Invalid file type. Only images (JPEG, PNG, GIF, WebP, SVG) are allowed", code: "INVALID_FILE_TYPE" },
        { status: 400 }
      );
    }

    // Try ImgBB first, fall back to FreeImage.host
    if (imgbbKey) {
      try {
        const result = await uploadToImgBB(image, imgbbKey);
        return NextResponse.json(result);
      } catch (imgbbError) {
        console.warn("ImgBB upload failed, trying FreeImage.host fallback:", imgbbError);
      }
    }

    // Fallback to FreeImage.host
    if (freeimageKey) {
      try {
        const result = await uploadToFreeImage(image, freeimageKey);
        return NextResponse.json(result);
      } catch (freeimageError) {
        console.error("FreeImage.host upload also failed:", freeimageError);
      }
    }

    return NextResponse.json(
      { error: "Failed to upload image", code: "UPLOAD_FAILED" },
      { status: 500 }
    );

  } catch (error) {
    console.error("Upload error:", error);
    return NextResponse.json(
      { error: "Internal server error", code: "INTERNAL_ERROR" },
      { status: 500 }
    );
  }
}
