import { useState } from "react";
import {
  BookOpen,
  FileText,
  Trash2,
  UploadCloud,
  CheckCircle2,
  Sparkles,
  AlertCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { StudyMaterial } from "@/lib/tutor.types";
import { uploadStudyMaterialServerFn, removeStudyMaterialServerFn } from "@/lib/tutor.functions";

interface StudyMaterialsViewProps {
  materials: StudyMaterial[];
  onRefreshMaterials: () => void;
  onSelectDocumentForChat: (docId: string, docName: string) => void;
  selectedDocumentId?: string;
}

export function StudyMaterialsView({
  materials,
  onRefreshMaterials,
  onSelectDocumentForChat,
  selectedDocumentId,
}: StudyMaterialsViewProps) {
  const [fileName, setFileName] = useState("");
  const [rawText, setRawText] = useState("");
  const [uploading, setUploading] = useState(false);
  const [successMsg, setSuccessMsg] = useState("");
  const [errorMsg, setErrorMsg] = useState("");

  async function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    setFileName(file.name);
    setUploading(true);
    setSuccessMsg("");
    setErrorMsg("");

    try {
      const text = await file.text();
      if (!text || text.trim().length < 10) {
        throw new Error(
          "The selected file contains insufficient plain text. Please select a text file or notes document.",
        );
      }

      await uploadStudyMaterialServerFn({
        data: { filename: file.name, rawText: text },
      });

      setSuccessMsg(`Successfully processed "${file.name}"! Created search chunks for RAG tutor.`);
      setRawText("");
      setFileName("");
      onRefreshMaterials();
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : "Failed to upload file.");
    } finally {
      setUploading(false);
    }
  }

  async function handleManualTextSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!rawText.trim() || !fileName.trim() || uploading) return;

    setUploading(true);
    setSuccessMsg("");
    setErrorMsg("");

    try {
      await uploadStudyMaterialServerFn({
        data: { filename: fileName.trim(), rawText: rawText.trim() },
      });

      setSuccessMsg(`Successfully processed note "${fileName}" for RAG context.`);
      setRawText("");
      setFileName("");
      onRefreshMaterials();
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : "Failed to ingest note.");
    } finally {
      setUploading(false);
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
          Upload lecture slides, notes, or chapter text to enable RAG-augmented answers with source
          citations.
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
                  placeholder="e.g. Chapter 4 - Neural Networks.txt"
                  value={fileName}
                  onChange={(e) => setFileName(e.target.value)}
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
                  Quick Upload Text / Markdown File
                </label>
                <div className="relative flex items-center justify-center border-2 border-dashed border-muted-foreground/30 rounded-md p-2 hover:border-primary transition-colors cursor-pointer bg-background/50">
                  <input
                    type="file"
                    accept=".txt,.md,.json,.csv"
                    onChange={handleFileUpload}
                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                  />
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <UploadCloud size={18} />
                    <span>Click or drag text file here</span>
                  </div>
                </div>
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
                Paste Academic Notes or Text (Alternative)
              </label>
              <textarea
                placeholder="Paste lecture content, definitions, or syllabus text here to chunk and index..."
                rows={4}
                value={rawText}
                onChange={(e) => setRawText(e.target.value)}
                className="w-full rounded-md border border-input bg-background p-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              />
            </div>

            <div className="flex items-center justify-between">
              <Button type="submit" disabled={!rawText.trim() || !fileName.trim() || uploading}>
                {uploading ? "Chunking & Indexing..." : "Process Note Content"}
              </Button>
              {successMsg && (
                <span className="text-xs text-emerald-600 dark:text-emerald-400 font-medium flex items-center gap-1">
                  <CheckCircle2 size={15} /> {successMsg}
                </span>
              )}
              {errorMsg && (
                <span className="text-xs text-destructive font-medium flex items-center gap-1">
                  <AlertCircle size={15} /> {errorMsg}
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
            return (
              <div
                key={mat.id}
                className={`starter-card transition-all p-4 flex flex-col justify-between ${
                  isSelected ? "border-primary ring-1 ring-primary" : ""
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
                          {mat.chunksCount} chunks • {Math.round(mat.size / 1024)} KB •{" "}
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
                </div>

                <div className="mt-4 pt-3 border-t border-border flex items-center justify-between">
                  <Button
                    variant={isSelected ? "default" : "outline"}
                    size="sm"
                    className="text-xs gap-1"
                    onClick={() => onSelectDocumentForChat(mat.id, mat.name)}
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
