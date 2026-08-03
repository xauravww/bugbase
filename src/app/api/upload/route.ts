import { NextRequest, NextResponse } from "next/server";
import { getAuthUser } from "@/lib/auth";
import { z } from "zod";

const ALLOWED_MIME_TYPES = [
  "image/jpeg",
  "image/png",
  "image/gif",
  "image/webp",
  "image/svg+xml",
];

const ALLOWED_EXTENSIONS = [".jpg", ".jpeg", ".png", ".gif", ".webp", ".svg"];
const MAX_IMAGE_BYTES = 10 * 1024 * 1024;

const base64UploadSchema = z.object({
  imageBase64: z.string().min(1),
  filename: z.string().min(1).max(255),
  mimeType: z.string().min(1),
});

function getFileExtension(filename: string): string {
  return filename.toLowerCase().slice(filename.lastIndexOf("."));
}

function isValidImageType(mimeType: string, filename: string): boolean {
  const ext = getFileExtension(filename);
  return ALLOWED_MIME_TYPES.includes(mimeType) || ALLOWED_EXTENSIONS.includes(ext);
}

function decodeBase64Image(value: string): Buffer | null {
  const base64 = value.replace(/^data:[^;]+;base64,/i, "").replace(/\s/g, "");
  if (!base64 || !/^[A-Za-z0-9+/]*={0,2}$/.test(base64) || base64.length % 4 !== 0) return null;
  return Buffer.from(base64, "base64");
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

    let image: File | null = null;
    if (request.headers.get("content-type")?.includes("application/json")) {
      const parsed = base64UploadSchema.safeParse(await request.json());
      if (!parsed.success) {
        return NextResponse.json(
          { error: parsed.error.issues[0].message, code: "VALIDATION_ERROR" },
          { status: 400 }
        );
      }
      const bytes = decodeBase64Image(parsed.data.imageBase64);
      if (!bytes) {
        return NextResponse.json(
          { error: "imageBase64 must be valid base64 data", code: "VALIDATION_ERROR" },
          { status: 400 }
        );
      }
      image = new File([Uint8Array.from(bytes)], parsed.data.filename, { type: parsed.data.mimeType });
    } else {
      const formData = await request.formData();
      const formImage = formData.get("image");
      image = formImage instanceof File ? formImage : null;
    }

    if (!image) {
      return NextResponse.json(
        { error: "No image provided", code: "VALIDATION_ERROR" },
        { status: 400 }
      );
    }

    // Validate file type
    const mimeType = image.type;
    const filename = image.name;

    if (!isValidImageType(mimeType, filename)) {
      return NextResponse.json(
        { error: "Invalid file type. Only images (JPEG, PNG, GIF, WebP, SVG) are allowed", code: "INVALID_FILE_TYPE" },
        { status: 400 }
      );
    }

    if (image.size > MAX_IMAGE_BYTES) {
      return NextResponse.json(
        { error: "Image must be 10 MB or smaller", code: "FILE_TOO_LARGE" },
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
