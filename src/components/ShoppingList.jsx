import { useState, useMemo } from 'react';
import { Check, Trash2, ShoppingBag, MoreVertical, X } from 'lucide-react';
import { useStore } from '../store/useStore';

// Category emoji map for frequently bought items
const CATEGORY_ICONS = {
  '乳制品': '🥛',
  '蛋类': '🥚',
  '水果': '🍎',
  '蔬菜': '🥬',
  '肉类': '🥩',
  '面包': '🍞',
  '家用品': '🧴',
  '饮料': '🥤',
};

function getCategoryIcon(category) {
  if (!category) return '📦';
  for (const [key, emoji] of Object.entries(CATEGORY_ICONS)) {
    if (category.includes(key)) return emoji;
  }
  return '📦';
}

function ShoppingItem({ item }) {
  const { toggleShoppingItem, deleteShoppingItem } = useStore();

  return (
    <div className={`shopping-item ${item.checked ? 'shopping-item--checked' : ''}`}>
      <label className="shopping-item__checkbox">
        <input
          type="checkbox"
          checked={item.checked}
          onChange={() => toggleShoppingItem(item.id)}
          aria-label={`Toggle ${item.name}`}
        />
        <span className="checkmark">
          <Check size={12} />
        </span>
      </label>
      <span className="shopping-item__name">{item.name}</span>
      {item.category && (
        <span className="shopping-item__category">{item.category}</span>
      )}
      <button
        className="three-dot-btn"
        onClick={() => deleteShoppingItem(item.id)}
        aria-label={`Delete ${item.name}`}
      >
        <MoreVertical size={16} />
      </button>
    </div>
  );
}

function AISuggestionCard({ onDismiss }) {
  return (
    <div className="ai-suggestion-card">
      <button className="ai-suggestion-card__close" onClick={onDismiss} aria-label="Dismiss">
        <X size={14} />
      </button>
      <div className="ai-suggestion-card__label">
        <span>✨</span>
        <span>建议按分类整理购物清单</span>
      </div>
      <div className="ai-suggestion-card__text">
        分类后更清晰，采购更高效
      </div>
      <div className="ai-suggestion-card__decoration">🧺</div>
    </div>
  );
}

function FrequentlyBoughtSection({ items, onAdd }) {
  if (!items || items.length === 0) return null;

  return (
    <div className="freq-bought-section">
      <div className="freq-bought-section__title">常买推荐</div>
      <div className="freq-bought-section__list">
        {items.map((item) => (
          <button
            key={item.name}
            className="freq-bought-chip"
            onClick={() => onAdd(item.name)}
          >
            <span className="freq-bought-chip__icon">
              {getCategoryIcon(item.category)}
            </span>
            <span className="freq-bought-chip__name">{item.name}</span>
            <span className="freq-bought-chip__add">+</span>
          </button>
        ))}
      </div>
    </div>
  );
}

export default function ShoppingList() {
  const { shoppingItems, showCompleted, toggleShowCompleted, sendMessage } = useStore();
  const [showSuggestion, setShowSuggestion] = useState(() => {
    return localStorage.getItem('r2d-dismiss-shopping-suggestion') !== 'true';
  });

  const unchecked = shoppingItems.filter(i => !i.checked);
  const checked = shoppingItems.filter(i => i.checked);
  const hasAny = shoppingItems.length > 0;

  // Derive frequently bought items from checked items
  const frequentlyBought = useMemo(() => {
    // Count how many times each item name appears in the checked list
    const nameCounts = {};
    checked.forEach(item => {
      const name = item.name;
      if (!nameCounts[name]) {
        nameCounts[name] = { name, category: item.category, count: 0 };
      }
      nameCounts[name].count++;
    });

    // Return items that have been bought multiple times, or just show top checked items
    return Object.values(nameCounts)
      .sort((a, b) => b.count - a.count)
      .slice(0, 4)
      .filter(item => !unchecked.some(u => u.name === item.name)); // Don't suggest items already in the list
  }, [checked, unchecked]);

  const handleDismissSuggestion = () => {
    setShowSuggestion(false);
    localStorage.setItem('r2d-dismiss-shopping-suggestion', 'true');
  };

  const handleQuickAdd = (name) => {
    sendMessage(`买${name}`);
  };

  if (!hasAny) {
    return (
      <div className="empty-state">
        <ShoppingBag className="empty-state__icon" />
        <div className="empty-state__title">购物清单为空</div>
        <div className="empty-state__hint">
          告诉我你需要买什么
        </div>
        <div className="empty-state__examples">
          <button className="empty-state__example" onClick={() => useStore.getState().sendMessage('买牛奶、鸡蛋、面包')}>
            "买牛奶、鸡蛋、面包"
          </button>
          <button className="empty-state__example" onClick={() => useStore.getState().sendMessage('buy milk, eggs, and bread')}>
            "buy milk, eggs, and bread"
          </button>
          <button className="empty-state__example" onClick={() => useStore.getState().sendMessage('需要买洗衣液和牙膏')}>
            "需要买洗衣液和牙膏"
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="animate-fade-in">
      {/* AI Suggestion Card */}
      {showSuggestion && (
        <AISuggestionCard onDismiss={handleDismissSuggestion} />
      )}

      {/* Pending items */}
      {unchecked.length > 0 && (
        <>
          <div className="section-header">
            <span className="section-header__title">待购 ({unchecked.length})</span>
            <div className="section-header__line" />
          </div>
          {unchecked.map((item, i) => (
            <div key={item.id} style={{ animationDelay: `${i * 50}ms` }}>
              <ShoppingItem item={item} />
            </div>
          ))}
        </>
      )}

      {/* Frequently Bought */}
      <FrequentlyBoughtSection items={frequentlyBought} onAdd={handleQuickAdd} />

      {/* Checked items */}
      {checked.length > 0 && (
        <div className="completed-section">
          <button className="completed-toggle" onClick={toggleShowCompleted}>
            {showCompleted ? '隐藏' : '显示'} 已购买 ({checked.length})
          </button>
          {showCompleted && checked.map(item => (
            <ShoppingItem key={item.id} item={item} />
          ))}
        </div>
      )}
    </div>
  );
}
