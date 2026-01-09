import { NextResponse } from "next/server";
import { vectorStore } from "@/lib/app/runtime";
import { removeDocument } from "@/lib/app/documents";

export async function DELETE(
  _request: Request,
  context: { params: Promise<{ docId: string }> }
) {
  try {
    const { docId } = await context.params;
    if (!docId) {
      return NextResponse.json({ error: "docId is required" }, { status: 400 });
    }

    await vectorStore.deleteByDocId(docId);
    await removeDocument(docId);
    return NextResponse.json({ ok: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
