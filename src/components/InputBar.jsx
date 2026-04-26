import { useState, useRef, useEffect } from 'react';
import { Send, Loader, ImagePlus, X } from 'lucide-react';
import { useStore } from '../store/useStore';
import VoiceButton from './VoiceButton';

export default function InputBar() {
  const [value, setValue] = useState('');
  const [imageData, setImageData] = useState(null); // { base64, mimeType, preview }
  const textareaRef = useRef(null);
  const fileInputRef = useRef(null);
  const { sendMessage, isProcessing } = useStore();

  // Auto-resize textarea
  useEffect(() => {
    const ta = textareaRef.current;
    if (ta) {
      ta.style.height = 'auto';
      ta.style.height = Math.min(ta.scrollHeight, 120) + 'px';
    }
  }, [value]);

  // Keyboard shortcut: "/" to focus
  useEffect(() => {
    const handler = (e) => {
      if (e.key === '/' && document.activeElement !== textareaRef.current) {
        e.preventDefault();
        textareaRef.current?.focus();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  // Compress image using canvas before sending (max 800px, JPEG 0.7)
  const compressImage = (file) => {
    return new Promise((resolve) => {
      const img = new Image();
      const url = URL.createObjectURL(file);
      img.onload = () => {
        URL.revokeObjectURL(url);
        const MAX = 800;
        let { width, height } = img;
        if (width > MAX || height > MAX) {
          const ratio = Math.min(MAX / width, MAX / height);
          width = Math.round(width * ratio);
          height = Math.round(height * ratio);
        }
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, width, height);
        // Always output JPEG for smaller size
        const dataUrl = canvas.toDataURL('image/jpeg', 0.7);
        const base64 = dataUrl.split(',')[1];
        resolve({ base64, mimeType: 'image/jpeg', preview: dataUrl });
      };
      img.onerror = () => {
        URL.revokeObjectURL(url);
        resolve(null);
      };
      img.src = url;
    });
  };

  // Shared image processing logic
  const processImageFile = async (file, name) => {
    if (!file.type.startsWith('image/')) {
      useStore.getState().showToast('error', '请选择图片文件');
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      useStore.getState().showToast('error', '图片不能超过 10MB');
      return;
    }

    const compressed = await compressImage(file);
    if (!compressed) {
      useStore.getState().showToast('error', '图片处理失败');
      return;
    }

    setImageData({
      base64: compressed.base64,
      mimeType: compressed.mimeType,
      preview: compressed.preview,
      name: name || '粘贴的图片',
    });
  };

  const handleImageSelect = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    processImageFile(file, file.name);
    e.target.value = '';
  };

  // Paste image from clipboard (Ctrl+V / Cmd+V)
  const handlePaste = (e) => {
    const items = e.clipboardData?.items;
    if (!items) return;

    for (const item of items) {
      if (item.type.startsWith('image/')) {
        e.preventDefault();
        const file = item.getAsFile();
        if (file) {
          processImageFile(file, '粘贴的图片');
        }
        return;
      }
    }
    // If no image found, let the default paste (text) happen
  };

  const clearImage = () => {
    setImageData(null);
  };

  const handleSubmit = async () => {
    const text = value.trim();
    if ((!text && !imageData) || isProcessing) return;
    
    const inputText = text || (imageData ? '请识别这张图片中的信息' : '');
    const image = imageData ? { base64: imageData.base64, mimeType: imageData.mimeType } : null;
    
    setValue('');
    setImageData(null);
    await sendMessage(inputText, image ? 'image' : 'text', image);
  };

  const handleVoiceResult = async (transcript) => {
    setValue('');
    await sendMessage(transcript, 'voice');
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  const canSend = (value.trim() || imageData) && !isProcessing;

  return (
    <div className="input-bar">
      {imageData && (
        <div className="input-bar__image-preview">
          <img src={imageData.preview} alt="Preview" className="input-bar__image-thumb" />
          <span className="input-bar__image-name">{imageData.name}</span>
          <button className="input-bar__image-remove" onClick={clearImage} aria-label="Remove image">
            <X size={14} />
          </button>
        </div>
      )}
      <div className="input-bar__container">
        <button
          className="input-bar__image-btn"
          onClick={() => fileInputRef.current?.click()}
          disabled={isProcessing}
          aria-label="Upload image"
          title="上传图片识别 / 可直接粘贴"
        >
          <ImagePlus size={18} />
        </button>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          onChange={handleImageSelect}
          style={{ display: 'none' }}
        />
        <textarea
          ref={textareaRef}
          className="input-bar__input"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={handleKeyDown}
          onPaste={handlePaste}
          placeholder={imageData ? "添加说明（可选）..." : "说一句，我来安排…"}
          rows={1}
          disabled={isProcessing}
          aria-label="AI input"
        />
        <VoiceButton onResult={handleVoiceResult} disabled={isProcessing} />
        <button
          className={`input-bar__send ${isProcessing ? 'input-bar__send--loading' : ''}`}
          onClick={handleSubmit}
          disabled={!canSend}
          aria-label="Send"
        >
          {isProcessing ? <Loader size={16} /> : <Send size={16} />}
        </button>
      </div>
    </div>
  );
}
