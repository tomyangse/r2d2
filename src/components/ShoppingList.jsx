import { Check, Trash2, ShoppingBag } from 'lucide-react';
import { useStore } from '../store/useStore';

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
        className="action-btn action-btn--danger shopping-item__delete"
        onClick={() => deleteShoppingItem(item.id)}
        aria-label={`Delete ${item.name}`}
      >
        <Trash2 size={14} />
      </button>
    </div>
  );
}

export default function ShoppingList() {
  const { shoppingItems, showCompleted, toggleShowCompleted } = useStore();

  const unchecked = shoppingItems.filter(i => !i.checked);
  const checked = shoppingItems.filter(i => i.checked);
  const hasAny = shoppingItems.length > 0;

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
