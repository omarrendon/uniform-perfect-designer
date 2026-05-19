import React, { useRef, useState } from "react";
import { Type, Upload, X, Check, Trash2 } from "lucide-react";
import { useDesignerStore } from "../store/desingerStore";
import { loadUserFontFromDataUrl } from "../utils/fontLoader";
import type { UserFont } from "../types";

type FontFormat = "truetype" | "opentype" | "woff" | "woff2";

const EXT_TO_FORMAT: Record<string, FontFormat> = {
  ttf: "truetype",
  otf: "opentype",
  woff: "woff",
  woff2: "woff2",
};

const MAX_FONT_SIZE_BYTES = 2 * 1024 * 1024; // 2 MB

export const FontUploadButton: React.FC = () => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { userFonts, addUserFont, removeUserFont } = useDesignerStore();

  const [pending, setPending] = useState<{
    name: string;
    dataUrl: string;
    format: FontFormat;
  } | null>(null);
  const [pendingName, setPendingName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [showList, setShowList] = useState(false);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;

    setError(null);

    if (file.size > MAX_FONT_SIZE_BYTES) {
      setError("El archivo supera el límite de 2 MB.");
      return;
    }

    const ext = file.name.split(".").pop()?.toLowerCase() ?? "";
    const format = EXT_TO_FORMAT[ext];
    if (!format) {
      setError("Formato no soportado. Usa .ttf, .otf, .woff o .woff2");
      return;
    }

    const defaultName = file.name.replace(/\.[^.]+$/, "");

    const reader = new FileReader();
    reader.onload = () => {
      setPending({
        name: defaultName,
        dataUrl: reader.result as string,
        format,
      });
      setPendingName(defaultName);
    };
    reader.readAsDataURL(file);
  };

  const handleConfirm = async () => {
    if (!pending) return;

    const trimmedName = pendingName.trim();
    if (!trimmedName) {
      setError("El nombre no puede estar vacío.");
      return;
    }

    const duplicate = userFonts.some(
      f => f.name.toLowerCase() === trimmedName.toLowerCase()
    );
    if (duplicate) {
      setError(`Ya existe una fuente llamada "${trimmedName}".`);
      return;
    }

    setLoading(true);
    setError(null);
    try {
      await loadUserFontFromDataUrl(trimmedName, pending.dataUrl, pending.format);
      const font: UserFont = {
        name: trimmedName,
        dataUrl: pending.dataUrl,
        format: pending.format,
        uploadedAt: Date.now(),
      };
      addUserFont(font);
      setPending(null);
      setPendingName("");
    } catch {
      setError("No se pudo cargar la fuente. Verifica que el archivo sea válido.");
    } finally {
      setLoading(false);
    }
  };

  const handleCancel = () => {
    setPending(null);
    setPendingName("");
    setError(null);
  };

  return (
    <div className="space-y-2">
      <input
        ref={fileInputRef}
        type="file"
        accept=".ttf,.otf,.woff,.woff2"
        onChange={handleFileChange}
        style={{ display: "none" }}
      />

      {/* Botón principal */}
      {!pending && (
        <button
          onClick={() => fileInputRef.current?.click()}
          className="w-full group bg-gradient-to-r from-violet-50 to-purple-100 hover:from-violet-100 hover:to-purple-200 border border-violet-200 rounded-xl p-4 transition-all duration-200 hover:shadow-md"
        >
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-violet-600 group-hover:bg-violet-700 rounded-lg flex items-center justify-center transition-colors">
              <Type className="w-5 h-5 text-white" />
            </div>
            <div className="text-left flex-1">
              <p className="font-semibold text-gray-800">Cargar mi fuente</p>
              <p className="text-xs text-gray-600">.ttf, .otf, .woff, .woff2 — máx. 2 MB</p>
            </div>
            <Upload className="w-4 h-4 text-violet-500 group-hover:text-violet-700 transition-colors" />
          </div>
        </button>
      )}

      {/* Formulario de confirmación inline */}
      {pending && (
        <div className="border border-violet-300 bg-violet-50 rounded-xl p-4 space-y-3">
          <p className="text-xs font-bold text-violet-800 uppercase tracking-wider">
            Confirmar fuente
          </p>
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1">
              Nombre de la fuente
            </label>
            <input
              type="text"
              value={pendingName}
              onChange={e => {
                setPendingName(e.target.value);
                setError(null);
              }}
              className="w-full px-3 py-2 bg-white border border-gray-300 rounded-lg text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-violet-500 focus:border-transparent"
              autoFocus
            />
          </div>
          {error && (
            <p className="text-xs text-red-600 font-medium">{error}</p>
          )}
          <div className="flex gap-2">
            <button
              onClick={handleConfirm}
              disabled={loading}
              className="flex-1 flex items-center justify-center gap-2 py-2 bg-violet-600 hover:bg-violet-700 disabled:bg-violet-300 text-white rounded-lg text-sm font-semibold transition-colors"
            >
              <Check className="w-4 h-4" />
              {loading ? "Cargando..." : "Confirmar"}
            </button>
            <button
              onClick={handleCancel}
              disabled={loading}
              className="flex items-center justify-center gap-2 px-3 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg text-sm font-semibold transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* Error sin pending */}
      {error && !pending && (
        <p className="text-xs text-red-600 font-medium px-1">{error}</p>
      )}

      {/* Lista de fuentes cargadas */}
      {userFonts.length > 0 && (
        <div>
          <button
            onClick={() => setShowList(v => !v)}
            className="text-xs font-semibold text-violet-700 hover:text-violet-900 transition-colors"
          >
            {showList ? "Ocultar" : "Ver"} mis fuentes ({userFonts.length})
          </button>
          {showList && (
            <ul className="mt-2 space-y-1">
              {userFonts.map(f => (
                <li
                  key={f.name}
                  className="flex items-center justify-between px-3 py-1.5 bg-white border border-violet-100 rounded-lg"
                >
                  <span
                    className="text-sm text-gray-800 truncate"
                    style={{ fontFamily: f.name }}
                  >
                    {f.name}
                  </span>
                  <button
                    onClick={() => removeUserFont(f.name)}
                    className="ml-2 text-gray-400 hover:text-red-500 transition-colors flex-shrink-0"
                    title="Eliminar fuente"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
};
