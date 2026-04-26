import { useMemo } from 'react';
import { Check, Trash2, ShoppingBag, MoreVertical } from 'lucide-react';
import { useStore } from '../store/useStore';

// Category taxonomy matching the Edge Function prompt
const GROCERY_CATEGORIES = [
  { key: '果蔬', emoji: '🥬', order: 1 },
  { key: '肉类', emoji: '🥩', order: 2 },
  { key: '鱼虾海鲜', emoji: '🐟', order: 3 },
  { key: '乳制品', emoji: '🥛', order: 4 },
  { key: '蛋类', emoji: '🥚', order: 5 },
  { key: '面包烘焙', emoji: '🍞', order: 6 },
  { key: '冷冻食品', emoji: '🧊', order: 7 },
  { key: '饮料', emoji: '🥤', order: 8 },
  { key: '零食', emoji: '🍿', order: 9 },
  { key: '调味品', emoji: '🧂', order: 10 },
  { key: '粮油干货', emoji: '🍚', order: 11 },
  { key: '家用日化', emoji: '🧴', order: 12 },
  { key: '个护', emoji: '🪥', order: 13 },
  { key: '婴幼儿', emoji: '🍼', order: 14 },
  { key: '宠物', emoji: '🐾', order: 15 },
];

const NON_GROCERY_CATEGORIES = [
  { key: '电子产品', emoji: '🔌', order: 1 },
  { key: '家具家居', emoji: '🏠', order: 2 },
  { key: '工具五金', emoji: '🔧', order: 3 },
  { key: '服装鞋帽', emoji: '👕', order: 4 },
  { key: '其他', emoji: '📦', order: 5 },
];

const GROCERY_KEYS = new Set(GROCERY_CATEGORIES.map(c => c.key));
const NON_GROCERY_KEYS = new Set(NON_GROCERY_CATEGORIES.map(c => c.key));

function getCategoryMeta(category) {
  const all = [...GROCERY_CATEGORIES, ...NON_GROCERY_CATEGORIES];
  return all.find(c => c.key === category) || { key: category || '其他', emoji: '📦', order: 99 };
}

function ShoppingItem({ item }) {
  const { toggleShoppingItem, deleteShoppingItem } = useStore();

  return (
    <div className={`shopping-item shopping-item--compact ${item.checked ? 'shopping-item--checked' : ''}`}>
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
      <button
        className="compact-item__delete"
        onClick={() => deleteShoppingItem(item.id)}
        aria-label={`Delete ${item.name}`}
      >
        <Trash2 size={12} />
      </button>
    </div>
  );
}

function CategoryGroup({ categoryKey, emoji, items }) {
  if (!items || items.length === 0) return null;

  return (
    <div className="category-group">
      <div className="category-group__header">
        <span className="category-group__emoji">{emoji}</span>
        <span className="category-group__name">{categoryKey}</span>
        <span className="category-group__count">{items.length}</span>
      </div>
      {items.map(item => (
        <ShoppingItem key={item.id} item={item} />
      ))}
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
              {getCategoryMeta(item.category).emoji}
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

  const unchecked = shoppingItems.filter(i => !i.checked);
  const checked = shoppingItems.filter(i => i.checked);
  const hasAny = shoppingItems.length > 0;

  // Group unchecked items by major category → sub-category
  const { groceryGroups, nonGroceryGroups } = useMemo(() => {
    const grocery = {};
    const nonGrocery = {};

    unchecked.forEach(item => {
      const cat = item.category || '其他';
      if (NON_GROCERY_KEYS.has(cat)) {
        if (!nonGrocery[cat]) nonGrocery[cat] = [];
        nonGrocery[cat].push(item);
      } else {
        // Default to grocery for anything else
        const normalizedCat = GROCERY_KEYS.has(cat) ? cat : '其他';
        const targetCat = GROCERY_KEYS.has(cat) ? cat : normalizedCat;
        if (!grocery[targetCat]) grocery[targetCat] = [];
        grocery[targetCat].push(item);
      }
    });

    // Sort by defined order
    const sortedGrocery = GROCERY_CATEGORIES
      .filter(c => grocery[c.key])
      .map(c => ({ ...c, items: grocery[c.key] }));

    // Add uncategorized grocery items to '其他' if they exist
    if (grocery['其他'] && !sortedGrocery.find(g => g.key === '其他')) {
      sortedGrocery.push({ key: '其他', emoji: '📦', order: 99, items: grocery['其他'] });
    }

    const sortedNonGrocery = NON_GROCERY_CATEGORIES
      .filter(c => nonGrocery[c.key])
      .map(c => ({ ...c, items: nonGrocery[c.key] }));

    return { groceryGroups: sortedGrocery, nonGroceryGroups: sortedNonGrocery };
  }, [unchecked]);

  // Derive frequently bought items from checked items
  const frequentlyBought = useMemo(() => {
    const nameCounts = {};
    checked.forEach(item => {
      const name = item.name;
      if (!nameCounts[name]) {
        nameCounts[name] = { name, category: item.category, count: 0 };
      }
      nameCounts[name].count++;
    });

    return Object.values(nameCounts)
      .sort((a, b) => b.count - a.count)
      .slice(0, 4)
      .filter(item => !unchecked.some(u => u.name === item.name));
  }, [checked, unchecked]);

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

  const hasGrocery = groceryGroups.length > 0;
  const hasNonGrocery = nonGroceryGroups.length > 0;

  return (
    <div className="animate-fade-in">

      {/* Grocery section */}
      {hasGrocery && (
        <div>
          <div className="section-header">
            <span className="section-header__title">🛒 日常超市</span>
            <div className="section-header__line" />
          </div>
          {groceryGroups.map(group => (
            <CategoryGroup
              key={group.key}
              categoryKey={group.key}
              emoji={group.emoji}
              items={group.items}
            />
          ))}
        </div>
      )}

      {/* Non-grocery section */}
      {hasNonGrocery && (
        <div>
          <div className="section-header">
            <span className="section-header__title">📦 非日常用品</span>
            <div className="section-header__line" />
          </div>
          {nonGroceryGroups.map(group => (
            <CategoryGroup
              key={group.key}
              categoryKey={group.key}
              emoji={group.emoji}
              items={group.items}
            />
          ))}
        </div>
      )}

      {/* Uncategorized fallback — items without a recognized category and no major group shown */}
      {!hasGrocery && !hasNonGrocery && unchecked.length > 0 && (
        <>
          <div className="section-header">
            <span className="section-header__title">待购 ({unchecked.length})</span>
            <div className="section-header__line" />
          </div>
          {unchecked.map(item => (
            <ShoppingItem key={item.id} item={item} />
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
