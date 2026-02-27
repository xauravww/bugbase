import { NextRequest, NextResponse } from "next/server";
import { getAuthUser } from "@/lib/auth";

// POST /api/upload - Upload image to ImgBB
export async function POST(request: NextRequest) {
  try {
    const authUser = getAuthUser(request);
    
    if (!authUser) {
      return NextResponse.json(
        { error: "Unauthorized", code: "UNAUTHORIZED" },
        { status: 401 }
      );
    }

    const apiKey = process.env.IMGBB_API_KEY;
    
    if (!apiKey) {
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

    // Create form data for ImgBB
    const imgbbFormData = new FormData();
    imgbbFormData.append("key", apiKey);
    imgbbFormData.append("image", image);

    const response = await fetch("https://api.imgbb.com/1/upload", {
      method: "POST",
      body: imgbbFormData,
    });

    const data = await response.json();

    if (!data.success) {
      return NextResponse.json(
        { error: "Failed to upload image", code: "UPLOAD_FAILED" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      url: data.data.url,
      deleteHash: data.data.delete_url,
      thumbnail: data.data.thumb?.url || data.data.url,
    });
    
  } catch (error) {
    console.error("Upload error:", error);
    return NextResponse.json(
      { error: "Internal server error", code: "INTERNAL_ERROR" },
      { status: 500 }
    );
  }
}
