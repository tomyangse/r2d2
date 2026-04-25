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

  const handleImageSelect = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file type and size
    if (!file.type.startsWith('image/')) {
      useStore.getState().showToast('error', '请选择图片文件');
      return;
    }
    if (file.size > 4 * 1024 * 1024) {
      useStore.getState().showToast('error', '图片不能超过 4MB');
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      const base64Full = reader.result; // data:image/xxx;base64,...
      const base64 = base64Full.split(',')[1]; // pure base64
      setImageData({
        base64,
        mimeType: file.type,
        preview: base64Full,
        name: file.name,
      });
    };
    reader.readAsDataURL(file);

    // Reset file input
    e.target.value = '';
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
          title="上传图片识别"
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
          placeholder={imageData ? "添加说明（可选）..." : "✨ 说点什么，然后不管了..."}
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
