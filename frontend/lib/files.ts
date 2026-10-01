/** "Slides", "Video"…: the attachment kinds the upload route accepts (idea attachments' `type`). */
export function fileKind(type?: string) {
  return ({ presentation: "Slides", video: "Video", audio: "Audio", document: "Document" } as Record<string, string>)[type ?? ""] ?? ""
}
