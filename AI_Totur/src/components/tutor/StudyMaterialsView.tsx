import { useState } from "react";
import {
  BookOpen,
  FileText,
  Trash2,
  UploadCloud,
  CheckCircle2,
  Sparkles,
  AlertCircle,
  Tag,
  Loader2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { StudyMaterial } from "@/lib/tutor.types";
import { uploadStudyMaterialServerFn, removeStudyMaterialServerFn } from "@/lib/tutor.functions";
import { parseDocumentFile } from "@/lib/document-parser";

interface StudyMaterialsViewProps {
  materials: StudyMaterial[];
  onRefreshMaterials: () => void;
  onSelectDocumentForChat: (docId: string, docName: string) => void;
  onSelectTopicForChat?: (topic: string, docId: string, docName: string) => void;
  selectedDocumentId?: string;
}

export function StudyMaterialsView({
  materials,
  onRefreshMaterials,
  onSelectDocumentForChat,
  onSelectTopicForChat,
  selectedDocumentId,
}: StudyMaterialsViewProps) {
  const [fileName, setFileName] = useState("");
  const [rawText, setRawText] = useState("");
  const [uploading, setUploading] = useState(false);
  const [statusText, setStatusText] = useState("");
  const [successMsg, setSuccessMsg] = useState("");
  const [errorMsg, setErrorMsg] = useState("");
  const [isDragging, setIsDragging] = useState(false);

  async function processSelectedFile(file: File) {
    setFileName(file.name);
    setUploading(true);
    setSuccessMsg("");
    setErrorMsg("");

    try {
      const isPdf = file.name.toLowerCase().endsWith(".pdf");
      setStatusText(isPdf ? "Extracting pages & text from PDF..." : "Reading document text...");

      const parsed = await parseDocumentFile(file);

      setStatusText("Chunking content & extracting topics...");
      const result = await uploadStudyMaterialServerFn({
        data: { filename: parsed.filename, rawText: parsed.rawText },
      });

      const extractedCount = result.topics?.length || 0;
      const topicsPreview =
        extractedCount > 0 ? ` Topics: ${result.topics?.slice(0, 4).join(", ")}.` : "";

      setSuccessMsg(
        `Successfully processed "${file.name}"! Created ${result.chunksCount} search chunks.${topicsPreview}`,
      );
      setRawText("");
      setFileName("");
      onRefreshMaterials();
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : "Failed to upload file.");
    } finally {
      setUploading(false);
      setStatusText("");
    }
  }

  async function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    await processSelectedFile(file);
    e.target.value = "";
  }

  function handleDrop(e: React.DragEvent<HTMLDivElement>) {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file) {
      void processSelectedFile(file);
    }
  }

  async function handleManualTextSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!rawText.trim() || !fileName.trim() || uploading) return;

    setUploading(true);
    setStatusText("Processing notes & discovering topics...");
    setSuccessMsg("");
    setErrorMsg("");

    try {
      const result = await uploadStudyMaterialServerFn({
        data: { filename: fileName.trim(), rawText: rawText.trim() },
      });

      const topicsPreview =
        result.topics && result.topics.length > 0
          ? ` Extracted topics: ${result.topics.slice(0, 4).join(", ")}.`
          : "";

      setSuccessMsg(
        `Successfully indexed "${fileName}" with ${result.chunksCount} chunks.${topicsPreview}`,
      );
      setRawText("");
      setFileName("");
      onRefreshMaterials();
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : "Failed to ingest note.");
    } finally {
      setUploading(false);
      setStatusText("");
    }
  }

  async function handleDelete(id: string) {
    try {
      await removeStudyMaterialServerFn({ data: { id } });
      onRefreshMaterials();
    } catch (err) {
      console.error(err);
    }
  }

  return (
    <div className="space-y-6">
      <div className="welcome">
        <div className="eyebrow">
          <span className="eyebrow-line" /> RAG KNOWLEDGE BASE
        </div>
        <h1>
          Study Materials & Uploaded Notes<span className="heading-period">.</span>
        </h1>
        <p>
          Upload PDF lecture notes, textbook chapters, or custom syllabus text. SAGE will extract
          topics, index chunks, and answer any conceptual question with exact citations.
        </p>
      </div>

      {/* Upload Box */}
      <section className="feature-panel" style={{ gridTemplateColumns: "1fr" }}>
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <span className="feature-tag">
              <span className="feature-tag-dot" /> DOCUMENT INGESTION PIPELINE
            </span>
          </div>

          <form onSubmit={handleManualTextSubmit} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
                  Document / Note Title
                </label>
                <input
                  type="text"
                  placeholder="e.g. Chapter 4 - Operating Systems.pdf"
                  value={fileName}
                  onChange={(e) => setFileName(e.target.value)}
                  className="w-full rounded-md border border-input bg-white px-3 py-2 text-sm text-black placeholder:text-gray-400 font-medium focus:outline-none focus:ring-2 focus:ring-ring shadow-sm"
                  style={{ color: "#000000", backgroundColor: "#ffffff" }}
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
                  Upload PDF, Markdown, or Text File
                </label>
                <div
                  onDragOver={(e) => {
                    e.preventDefault();
                    setIsDragging(true);
                  }}
                  onDragLeave={() => setIsDragging(false)}
                  onDrop={handleDrop}
                  className={`relative flex items-center justify-center border-2 border-dashed rounded-md p-3 transition-colors cursor-pointer bg-background/50 ${
                    isDragging
                      ? "border-primary bg-primary/5"
                      : "border-muted-foreground/30 hover:border-primary"
                  }`}
                >
                  <input
                    type="file"
                    accept=".pdf,.txt,.md,.json,.csv,.text"
                    onChange={handleFileUpload}
                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                    disabled={uploading}
                  />
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    {uploading ? (
                      <Loader2 size={18} className="animate-spin text-primary" />
                    ) : (
                      <UploadCloud size={18} className="text-primary" />
                    )}
                    <span>
                      {uploading
                        ? statusText || "Processing document..."
                        : "Click to upload or drag PDF / text file here"}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
                Paste Academic Notes or Text (Alternative)
              </label>
              <textarea
                placeholder="Paste lecture content, syllabus, definitions, or textbook paragraphs here..."
                rows={4}
                value={rawText}
                onChange={(e) => setRawText(e.target.value)}
                className="w-full rounded-md border border-input bg-white p-3 text-sm text-black placeholder:text-gray-400 font-medium focus:outline-none focus:ring-2 focus:ring-ring shadow-sm"
                style={{ color: "#000000", backgroundColor: "#ffffff" }}
              />
            </div>

            <div className="flex flex-wrap items-center justify-between gap-3">
              <Button type="submit" disabled={!rawText.trim() || !fileName.trim() || uploading}>
                {uploading ? (
                  <span className="flex items-center gap-1.5">
                    <Loader2 size={14} className="animate-spin" /> {statusText || "Processing..."}
                  </span>
                ) : (
                  "Process & Extract Topics"
                )}
              </Button>

              {successMsg && (
                <span className="text-xs text-emerald-600 dark:text-emerald-400 font-medium flex items-center gap-1.5 bg-emerald-500/10 px-3 py-1.5 rounded-md">
                  <CheckCircle2 size={16} /> {successMsg}
                </span>
              )}

              {errorMsg && (
                <span className="text-xs text-destructive font-medium flex items-center gap-1.5 bg-destructive/10 px-3 py-1.5 rounded-md">
                  <AlertCircle size={16} /> {errorMsg}
                </span>
              )}
            </div>
          </form>
        </div>
      </section>

      {/* Materials List */}
      <div className="section-heading">
        <div>
          <span className="section-kicker">ACTIVE KNOWLEDGE BASE</span>
          <h3>Your Uploaded Materials ({materials.length})</h3>
        </div>
      </div>

      {materials.length === 0 ? (
        <div className="empty-chat" style={{ padding: "3rem 1rem" }}>
          <div className="empty-icon">
            <BookOpen size={22} />
          </div>
          <strong>No study materials uploaded yet.</strong>
          <span>Upload notes above so SAGE AI Tutor can cite specific page numbers and facts!</span>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {materials.map((mat) => {
            const isSelected = selectedDocumentId === mat.id;
            const primaryTopic = mat.topics?.[0] || mat.name.replace(/\.[^/.]+$/, "");

            return (
              <div
                key={mat.id}
                className={`starter-card transition-all p-4 flex flex-col justify-between ${
                  isSelected ? "border-primary ring-1 ring-primary bg-primary/5" : ""
                }`}
                style={{ textAlign: "left", display: "flex", alignItems: "stretch" }}
              >
                <div>
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3">
                      <div className="p-2 rounded-lg bg-primary/10 text-primary">
                        <FileText size={20} />
                      </div>
                      <div>
                        <strong className="block text-sm font-semibold text-foreground">
                          {mat.name}
                        </strong>
                        <span className="text-xs text-muted-foreground">
                          {mat.chunksCount} chunks • {Math.round(mat.size / 1024) || 1} KB •{" "}
                          {new Date(mat.uploadDate).toLocaleDateString()}
                        </span>
                      </div>
                    </div>

                    <Button
                      variant="ghost"
                      size="icon"
                      className="text-muted-foreground hover:text-destructive"
                      onClick={() => handleDelete(mat.id)}
                      title="Delete material"
                    >
                      <Trash2 size={16} />
                    </Button>
                  </div>

                  {/* Summary snippet */}
                  {mat.summary && (
                    <p className="text-xs text-muted-foreground mt-3 line-clamp-2 italic">
                      "{mat.summary}"
                    </p>
                  )}

                  {/* Extracted Topics */}
                  {mat.topics && mat.topics.length > 0 && (
                    <div className="mt-3 pt-2.5 border-t border-border/40">
                      <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider block mb-1.5 flex items-center gap-1">
                        <Tag size={12} className="text-primary" /> Discovered Topics (
                        {mat.topics.length}):
                      </span>
                      <div className="flex flex-wrap gap-1.5">
                        {mat.topics.map((t) => (
                          <button
                            key={t}
                            type="button"
                            onClick={() => {
                              if (onSelectTopicForChat) {
                                onSelectTopicForChat(t, mat.id, mat.name);
                              } else {
                                onSelectDocumentForChat(mat.id, mat.name);
                              }
                            }}
                            className="text-[11px] px-2.5 py-1 rounded-md bg-primary/10 hover:bg-primary hover:text-primary-foreground text-primary font-medium transition-colors cursor-pointer border border-primary/20 flex items-center gap-1"
                            title={`Practice ${t} with SAGE`}
                          >
                            <span>🏷️</span> {t}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                <div className="mt-4 pt-3 border-t border-border flex items-center justify-between">
                  <Button
                    variant={isSelected ? "default" : "outline"}
                    size="sm"
                    className="text-xs gap-1.5"
                    onClick={() => {
                      if (onSelectTopicForChat) {
                        onSelectTopicForChat(primaryTopic, mat.id, mat.name);
                      } else {
                        onSelectDocumentForChat(mat.id, mat.name);
                      }
                    }}
                  >
                    <Sparkles size={14} />
                    {isSelected ? "Active RAG Source" : "Ask SAGE with this source"}
                  </Button>

                  {isSelected && (
                    <span className="text-xs text-primary font-medium flex items-center gap-1">
                      <CheckCircle2 size={14} /> Selected
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
