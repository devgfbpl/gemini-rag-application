import { GoogleAIFileManager } from "@google/generative-ai/server";
import { NextResponse } from "next/server";
import { writeFile } from "fs/promises";
import { join } from "path";
import { tmpdir } from "os";

const fileManager = new GoogleAIFileManager(process.env.GEMINI_API_KEY!);

export async function POST(request: Request) {
    try {
        const formData = await request.formData();
        const file = formData.get("file") as File;

        if (!file) {
            return NextResponse.json({ error: "No file provided" }, { status: 400 });
        }

        const bytes = await file.arrayBuffer();
        const buffer = Buffer.from(bytes);

        // Save to temp file for upload
        const tempPath = join(tmpdir(), file.name);
        await writeFile(tempPath, buffer);

        const uploadResponse = await fileManager.uploadFile(tempPath, {
            mimeType: file.type,
            displayName: file.name,
        });

        console.log(`Uploaded file ${uploadResponse.file.displayName} as: ${uploadResponse.file.uri}`);

        // Wait for the file to be active
        let fileState = await fileManager.getFile(uploadResponse.file.name);
        while (fileState.state === "PROCESSING") {
            await new Promise((resolve) => setTimeout(resolve, 2000)); // Poll every 2s
            fileState = await fileManager.getFile(uploadResponse.file.name);
        }

        if (fileState.state === "FAILED") {
            return NextResponse.json({ error: "File processing failed" }, { status: 500 });
        }

        return NextResponse.json({
            uri: uploadResponse.file.uri,
            name: uploadResponse.file.displayName
        });

    } catch (error) {
        console.error("Upload error:", error);
        return NextResponse.json({ error: "Internal server error" }, { status: 500 });
    }
}
