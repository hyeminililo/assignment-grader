import { Trash2, UploadCloud } from "lucide-react";

interface Props {
  title?: string;
  description?: string;
  accept?: string;
  multiple?: boolean;
  files: File[];
  onChange: (files: File[]) => void;
}

export function FileUploader({ title = "학생 파일 업로드", description = "ZIP 또는 소스 파일 제출물을 그대로 올립니다", accept = ".zip,.java,.html,.htm,.css,.js,.jsp,.xml", multiple = true, files, onChange }: Props) {
  const addFiles = (selectedFiles: File[]) => {
    if (!multiple) {
      onChange(selectedFiles.slice(0, 1));
      return;
    }
    const merged = [...files];
    for (const file of selectedFiles) {
      const key = fileKey(file);
      if (!merged.some((item) => fileKey(item) === key)) merged.push(file);
    }
    onChange(merged);
  };

  const removeFile = (index: number) => onChange(files.filter((_, fileIndex) => fileIndex !== index));

  return (
    <section className="card p-4">
      <h3 className="mb-3 font-semibold">{title}</h3>
      <label className="flex min-h-36 cursor-pointer flex-col items-center justify-center rounded border border-dashed border-line bg-panel text-center">
        <UploadCloud size={28} />
        <span className="mt-2 text-sm font-medium">{multiple ? "파일 여러 개를 선택하세요" : "파일을 선택하세요"}</span>
        <span className="text-xs text-gray-500">{description}</span>
        <input
          className="hidden"
          type="file"
          multiple={multiple}
          accept={accept}
          onChange={(event) => {
            addFiles(Array.from(event.target.files ?? []));
            event.target.value = "";
          }}
        />
      </label>
      {files.length > 0 && (
        <div className="mt-3 space-y-2">
          <div className="text-sm text-gray-700">{files.length}개 파일 선택됨</div>
          <div className="max-h-40 overflow-auto rounded border border-line bg-white">
            {files.map((file, index) => (
              <div className="flex items-center justify-between gap-2 border-b border-line px-3 py-2 text-sm last:border-b-0" key={fileKey(file)}>
                <span className="min-w-0 truncate">{file.name}</span>
                <button type="button" className="quiet-button px-2 py-1" onClick={() => removeFile(index)} aria-label={`${file.name} 제거`}>
                  <Trash2 size={14} />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
    </section>
  );
}

function fileKey(file: File): string {
  return `${file.name}:${file.size}:${file.lastModified}`;
}
