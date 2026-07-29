import React, { useState } from 'react';
import { db, type TagConfig } from '../../db/schema';
import { Tag, Plus, Trash2 } from 'lucide-react';
import { useAuth } from '../../contexts/useAuth';
import { useConfirm } from '../../contexts/useConfirm';
import { useTagConfigs } from '../../hooks/useData';

export const TagsManagement: React.FC = () => {
  const { user } = useAuth();
  const { confirm } = useConfirm();
  const [tagName, setTagName] = useState('');
  const [selectedColor, setSelectedColor] = useState('#3b82f6');
  const [errorMsg, setErrorMsg] = useState('');

  // Curated premium tag colors palette
  const tagColors = [
    { value: '#3b82f6', label: '蓝色' },
    { value: '#22c55e', label: '绿色' },
    { value: '#eab308', label: '黄色' },
    { value: '#f97316', label: '橙色' },
    { value: '#8b5cf6', label: '紫色' },
    { value: '#ef4444', label: '红色' },
    { value: '#ec4899', label: '粉色' },
    { value: '#14b8a6', label: '青色' },
    { value: '#6b7280', label: '灰色' },
  ];

  // Reactively query tags
  const tags = useTagConfigs();

  const handleAddTag = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');
    const trimmedName = tagName.trim();

    if (!trimmedName) return;

    // Check duplicate in Dexie
    const exists = tags.some(t => t.name.toLowerCase() === trimmedName.toLowerCase());
    if (exists) {
      setErrorMsg('此标签名称已存在！');
      return;
    }

    try {
      // 1. Add locally to Dexie
      const localId = crypto.randomUUID();
      await db.tagConfigs.add({
        id: localId,
        userId: user?.id || 'offline',
        name: trimmedName,
        color: selectedColor
      });

      // 2. Synchronize to backend if connected
      const apiBaseUrl = localStorage.getItem('filmory_api_base_url');
      const accessToken = localStorage.getItem('filmory_access_token');

      if (apiBaseUrl && accessToken) {
        const response = await fetch(`${apiBaseUrl}/api/tags`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${accessToken}`,
          },
          body: JSON.stringify({ name: trimmedName, color: selectedColor }),
        });

        if (!response.ok) {
          const data = await response.json();
          console.warn('Backend sync failed:', data?.error?.message || data?.error);
        } else {
          const cloudTag = await response.json();
          // Update local ID to match cloud ID for consistent deletion references
          if (cloudTag.id) {
            // Delete local item and re-add with correct ID
            await db.tagConfigs.delete(localId);
            await db.tagConfigs.add({
              id: cloudTag.id,
              userId: user?.id || 'offline',
              name: trimmedName,
              color: selectedColor
            });
          }
        }
      }

      setTagName('');
      setSelectedColor('#3b82f6');
    } catch (err: any) {
      console.error('Failed to add tag:', err);
    }
  };

  const handleDeleteTag = async (tag: TagConfig) => {
    const confirmed = await confirm({
      title: '删除标签',
      message: `确认删除标签 [${tag.name}] 吗？删除后照片关联的此标签将被自动清除。`,
      confirmText: '确认删除',
      isDanger: true
    });
    if (!confirmed) return;

    try {
      // 1. Delete from Dexie
      if (tag.id) {
        await db.tagConfigs.delete(tag.id);
      }

      // Clean up tags inside photoAssets in Dexie
      const photos = user ? await db.photoAssets.where('userId').equals(user.id).toArray() : [];
      for (const p of photos) {
        if (p.tags) {
          const parsedTags = p.tags.split(',').filter((t: string) => t !== tag.name);
          const updatedTags = parsedTags.length > 0 ? parsedTags.join(',') : undefined;
          await db.photoAssets.update(p.id!, { tags: updatedTags });
        }
      }

      // 2. Delete from cloud if connected
      const apiBaseUrl = localStorage.getItem('filmory_api_base_url');
      const accessToken = localStorage.getItem('filmory_access_token');

      if (apiBaseUrl && accessToken) {
        await fetch(`${apiBaseUrl}/api/tags/${tag.id}`, {
          method: 'DELETE',
          headers: {
            'Authorization': `Bearer ${accessToken}`,
          }
        });
      }
    } catch (err: any) {
      console.error('Failed to delete tag:', err);
    }
  };

  return (
    <div className="tags-management-card">
      <div className="tags-list-container">
        <div className="tags-chips-grid">
          {tags.length === 0 ? (
            <p className="no-tags-prompt">暂无配置的标签，在下方表单中创建第一个标签吧。</p>
          ) : (
            tags.map(t => (
              <span 
                key={t.id} 
                className="premium-tag-pill"
                style={{ 
                  backgroundColor: `${t.color}18`, 
                  color: t.color, 
                  borderColor: t.color,
                  border: '1px solid',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                  padding: '6px 12px',
                  borderRadius: '100px',
                  fontSize: '12px',
                  fontWeight: 600,
                  transition: 'all 0.2s ease-in-out'
                }}
              >
                <Tag size={12} fill={`${t.color}22`} />
                {t.name}
                <button 
                  type="button" 
                  className="tag-delete-btn"
                  onClick={() => handleDeleteTag(t)}
                  style={{
                    background: 'transparent',
                    border: 'none',
                    color: 'inherit',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    padding: '2px',
                    borderRadius: '50%',
                    opacity: 0.7,
                    marginLeft: '2px'
                  }}
                  title="删除标签"
                >
                  <Trash2 size={10} />
                </button>
              </span>
            ))
          )}
        </div>
      </div>

      <form onSubmit={handleAddTag} className="tag-creation-form" style={{ marginTop: '20px', borderTop: '1px solid var(--border-color)', paddingTop: '20px' }}>
        <div className="tag-form-fields" style={{ display: 'flex', flexWrap: 'wrap', gap: '16px', alignItems: 'flex-end' }}>
          <div className="form-group" style={{ flex: '1', minWidth: '200px' }}>
            <label style={{ display: 'block', marginBottom: '8px', fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)' }}>标签名称</label>
            <input 
              type="text" 
              className="form-control" 
              placeholder="如：人像 / 黑白 / 旅拍" 
              value={tagName}
              onChange={e => setTagName(e.target.value)}
              required
            />
          </div>

          <div className="form-group" style={{ flex: '1.5', minWidth: '250px' }}>
            <label style={{ display: 'block', marginBottom: '8px', fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)' }}>标签色彩</label>
            <div className="color-palette-grid" style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
              {tagColors.map(color => (
                <button
                  key={color.value}
                  type="button"
                  onClick={() => setSelectedColor(color.value)}
                  style={{
                    width: '24px',
                    height: '24px',
                    borderRadius: '50%',
                    backgroundColor: color.value,
                    border: selectedColor === color.value ? '2px solid var(--text-primary)' : '1px solid rgba(255,255,255,0.2)',
                    cursor: 'pointer',
                    boxShadow: selectedColor === color.value ? '0 0 0 2px var(--bg-primary)' : 'none',
                    transform: selectedColor === color.value ? 'scale(1.1)' : 'scale(1)',
                    transition: 'all 0.15s ease'
                  }}
                  title={color.label}
                />
              ))}
            </div>
          </div>

          <button 
            type="submit" 
            className="primary" 
            style={{ width: 'auto', height: '38px', padding: '0 20px', display: 'inline-flex', alignItems: 'center', gap: '6px' }}
          >
            <Plus size={16} /> 创建标签
          </button>
        </div>
        {errorMsg && <div className="connection-error-alert" style={{ marginTop: '10px' }}>{errorMsg}</div>}
      </form>
    </div>
  );
};
