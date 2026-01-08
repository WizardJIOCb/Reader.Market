import React, { useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Paperclip } from 'lucide-react';
import { fileUploadManager } from '@/lib/fileUploadManager';
import { useToast } from '@/hooks/use-toast';

interface AttachmentButtonProps {
  onFilesSelected: (files: File[]) => void;
  disabled?: boolean;
  maxFiles?: number;
  className?: string;
}

export function AttachmentButton({ 
  onFilesSelected, 
  disabled = false,
  maxFiles = 5,
  className = '' 
}: AttachmentButtonProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  const handleButtonClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files || []);
    
    if (files.length === 0) return;

    if (files.length > maxFiles) {
      toast({
        title: "Too many files",
        description: `You can only attach up to ${maxFiles} files at once.`,
        variant: "destructive"
      });
      return;
    }

    // Validate each file
    const invalidFiles: string[] = [];
    const validFiles: File[] = [];

    files.forEach(file => {
      const validation = fileUploadManager.validateFile(file);
      if (validation.valid) {
        validFiles.push(file);
      } else {
        invalidFiles.push(`${file.name}: ${validation.error}`);
      }
    });

    if (invalidFiles.length > 0) {
      toast({
        title: "Invalid files",
        description: invalidFiles.join('\n'),
        variant: "destructive"
      });
    }

    if (validFiles.length > 0) {
      onFilesSelected(validFiles);
    }

    // Reset input
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  return (
    <>
      <Button
        type="button"
        variant="ghost"
        size="icon"
        onClick={handleButtonClick}
        disabled={disabled}
        className={className}
        title="Attach files"
      >
        <Paperclip className="h-5 w-5" />
      </Button>
      <input
        ref={fileInputRef}
        type="file"
        multiple
        accept="image/jpeg,image/png,image/gif,image/webp,application/pdf,.doc,.docx,text/plain"
        onChange={handleFileChange}
        className="hidden"
      />
    </>
  );
}
