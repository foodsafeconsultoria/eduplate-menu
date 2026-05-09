import React, { useRef, useState } from 'react';
import { Upload, X, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';

interface PhotoUploaderProps {
  photos: string[];
  onPhotosChange: (photos: string[]) => void;
  maxFiles?: number;
  maxSizeMB?: number;
}

export default function PhotoUploader({
  photos,
  onPhotosChange,
  maxFiles = 10,
  maxSizeMB = 5
}: PhotoUploaderProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);

  const processFiles = async (files: FileList | null) => {
    if (!files || files.length === 0) return;

    setIsProcessing(true);
    const newPhotos: string[] = [];
    let processedCount = 0;
    let errorCount = 0;

    for (let i = 0; i < files.length; i++) {
      const file = files[i];

      // Validar tipo
      if (!file.type.startsWith('image/')) {
        toast.error(`${file.name} não é uma imagem válida`);
        errorCount++;
        continue;
      }

      // Validar tamanho
      if (file.size > maxSizeMB * 1024 * 1024) {
        toast.error(`${file.name} excede ${maxSizeMB}MB`);
        errorCount++;
        continue;
      }

      // Validar limite de arquivos
      if (photos.length + newPhotos.length >= maxFiles) {
        toast.error(`Limite de ${maxFiles} fotos atingido`);
        break;
      }

      // Converter para base64
      try {
        const base64 = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => resolve(reader.result as string);
          reader.onerror = () => reject(new Error(`Erro ao ler ${file.name}`));
          reader.readAsDataURL(file);
        });

        newPhotos.push(base64);
        processedCount++;
      } catch (error) {
        toast.error(`Erro ao processar ${file.name}`);
        errorCount++;
      }
    }

    if (newPhotos.length > 0) {
      onPhotosChange([...photos, ...newPhotos]);
      toast.success(`${processedCount} foto(s) adicionada(s)`);
    }

    if (errorCount > 0) {
      toast.error(`${errorCount} arquivo(s) não puderam ser processados`);
    }

    setIsProcessing(false);

    // Limpar input
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    processFiles(e.dataTransfer.files);
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    processFiles(e.target.files);
  };

  const handleRemovePhoto = (index: number) => {
    onPhotosChange(photos.filter((_, i) => i !== index));
  };

  return (
    <div className="space-y-4">
      {/* Zona de upload */}
      <div
        className={`border-2 border-dashed rounded-lg p-8 text-center transition-all ${
          isDragging
            ? 'border-blue-500 bg-blue-50'
            : 'border-gray-300 hover:border-blue-400 hover:bg-gray-50'
        } ${isProcessing ? 'opacity-50 pointer-events-none' : ''}`}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
      >
        <div className="flex flex-col items-center gap-2">
          <Upload className="w-8 h-8 text-gray-400" />
          <p className="font-semibold text-gray-700">Clique ou arraste fotos aqui</p>
          <p className="text-sm text-gray-600">
            Formatos: JPG, PNG (máximo {maxSizeMB}MB cada)
          </p>
          <p className="text-xs text-gray-500 mt-2">
            {photos.length}/{maxFiles} fotos adicionadas
          </p>
        </div>

        <input
          ref={fileInputRef}
          type="file"
          multiple
          accept="image/jpeg,image/png,image/jpg"
          className="hidden"
          onChange={handleFileSelect}
          disabled={isProcessing || photos.length >= maxFiles}
        />

        <Button
          variant="outline"
          className="mt-4"
          onClick={() => fileInputRef.current?.click()}
          disabled={isProcessing || photos.length >= maxFiles}
          type="button"
        >
          {isProcessing ? 'Processando...' : 'Selecionar Fotos'}
        </Button>
      </div>

      {/* Preview de fotos */}
      {photos.length > 0 && (
        <div>
          <div className="flex items-center justify-between mb-3">
            <h4 className="font-semibold text-gray-700">
              Fotos Selecionadas ({photos.length}/{maxFiles})
            </h4>
            {photos.length > 0 && (
              <span className="flex items-center gap-1 text-sm text-green-600">
                <Check className="w-4 h-4" />
                Pronto para salvar
              </span>
            )}
          </div>

          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
            {photos.map((photo, index) => (
              <div key={index} className="relative group">
                <img
                  src={photo}
                  alt={`Foto ${index + 1}`}
                  className="w-full h-24 object-cover rounded-lg border-2 border-gray-200 hover:border-blue-400 transition"
                />
                <div className="absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-30 rounded-lg transition flex items-center justify-center">
                  <button
                    onClick={() => handleRemovePhoto(index)}
                    className="absolute top-1 right-1 bg-red-500 hover:bg-red-600 text-white p-1.5 rounded-full opacity-0 group-hover:opacity-100 transition shadow-lg"
                    type="button"
                    title="Remover foto"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
                <span className="absolute bottom-1 left-1 bg-gray-900 text-white text-xs px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition">
                  {index + 1}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Mensagem quando vazio */}
      {photos.length === 0 && (
        <div className="text-center py-4 text-gray-500 text-sm">
          Nenhuma foto adicionada ainda
        </div>
      )}
    </div>
  );
}
