import React, { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, type Camera, type Lens, type FilmStock, type OtherEquipment } from '../../db/schema';
import { Plus, Trash2, SlidersHorizontal, BookOpen, Layers } from 'lucide-react';
import { LensSvgAvatar } from '../../components/LensSvgAvatar';
import './GearView.css';

interface GearViewProps {
  enableFilmMode: boolean;
}

type SubTab = 'cameras' | 'lenses' | 'filmStocks' | 'otherEquipments';

export const GearView: React.FC<GearViewProps> = ({ enableFilmMode }) => {
  const [subTab, setSubTab] = useState<SubTab>('cameras');
  const [isCameraModalOpen, setIsCameraModalOpen] = useState(false);
  const [isLensModalOpen, setIsLensModalOpen] = useState(false);
  const [isFilmModalOpen, setIsFilmModalOpen] = useState(false);
  const [isEquipmentModalOpen, setIsEquipmentModalOpen] = useState(false);

  // Forms state
  const [newCamera, setNewCamera] = useState<Partial<Camera>>({ name: '', type: 'film', format: '135' });
  const [newLens, setNewLens] = useState<Partial<Lens>>({ name: '', focalLength: 50, maxAperture: 'f/1.8', type: 'prime' });
  const [newFilm, setNewFilm] = useState<Partial<FilmStock>>({ brand: '', name: '', iso: 400, colorType: 'color', format: '135' });
  const [newEquipment, setNewEquipment] = useState<Partial<OtherEquipment>>({ name: '', type: 'chemical', notes: '', purchaseDate: undefined, expiryDate: undefined });

  // Live queries from IndexedDB
  const cameras = useLiveQuery(() => db.cameras.toArray()) || [];
  const lenses = useLiveQuery(() => db.lenses.toArray()) || [];
  
  // Filter out system placeholders (like digital) from the film stock list
  const filmStocks = useLiveQuery(() => 
    db.filmStocks.filter(f => f.isSystem === 0).toArray()
  ) || [];

  const otherEquipments = useLiveQuery(() => db.otherEquipments.toArray()) || [];

  // Actions
  const handleAddCamera = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCamera.name) return;
    await db.cameras.add({
      name: newCamera.name,
      type: newCamera.type as 'film' | 'digital',
      format: newCamera.format || '135',
      addedAt: Date.now()
    });
    setNewCamera({ name: '', type: 'film', format: '135' });
    setIsCameraModalOpen(false);
  };

  const handleAddLens = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newLens.name) return;
    await db.lenses.add({
      name: newLens.name,
      focalLength: Number(newLens.focalLength) || 50,
      maxAperture: newLens.maxAperture || 'f/1.8',
      type: newLens.type || 'prime',
      addedAt: Date.now()
    });
    setNewLens({ name: '', focalLength: 50, maxAperture: 'f/1.8', type: 'prime' });
    setIsLensModalOpen(false);
  };

  const handleAddFilm = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newFilm.brand || !newFilm.name) return;
    await db.filmStocks.add({
      brand: newFilm.brand,
      name: newFilm.name,
      iso: Number(newFilm.iso) || 400,
      colorType: newFilm.colorType as 'color' | 'bw',
      format: newFilm.format || '135',
      isSystem: 0,
      addedAt: Date.now()
    });
    setNewFilm({ brand: '', name: '', iso: 400, colorType: 'color', format: '135' });
    setIsFilmModalOpen(false);
  };

  const handleAddEquipment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newEquipment.name || !newEquipment.type) return;
    await db.otherEquipments.add({
      name: newEquipment.name,
      type: newEquipment.type as any,
      notes: newEquipment.notes || '',
      purchaseDate: newEquipment.purchaseDate,
      expiryDate: newEquipment.expiryDate,
      addedAt: Date.now()
    });
    setNewEquipment({ name: '', type: 'chemical', notes: '', purchaseDate: undefined, expiryDate: undefined });
    setIsEquipmentModalOpen(false);
  };

  const handleDeleteCamera = async (id: number) => {
    if (confirm('确认删除这台相机吗？删除后关联数据可能受影响。')) {
      await db.cameras.delete(id);
    }
  };

  const handleDeleteLens = async (id: number) => {
    if (confirm('确认删除这支镜头吗？')) {
      await db.lenses.delete(id);
    }
  };

  const handleDeleteFilm = async (id: number) => {
    if (confirm('确认删除这款胶卷吗？')) {
      await db.filmStocks.delete(id);
    }
  };

  const handleDeleteEquipment = async (id: number) => {
    if (confirm('确认删除这个器材吗？')) {
      await db.otherEquipments.delete(id);
    }
  };

  return (
    <div className="main-content">
      <header className="view-header">
        <h1>器材库</h1>
        <div className="view-header-actions">
          {subTab === 'cameras' && (
            <button className="primary" onClick={() => setIsCameraModalOpen(true)}>
              <Plus size={16} /> 添加相机
            </button>
          )}
          {subTab === 'lenses' && (
            <button className="primary" onClick={() => setIsLensModalOpen(true)}>
              <Plus size={16} /> 添加镜头
            </button>
          )}
          {subTab === 'filmStocks' && enableFilmMode && (
            <button className="primary" onClick={() => setIsFilmModalOpen(true)}>
              <Plus size={16} /> 添加胶卷
            </button>
          )}
          {subTab === 'otherEquipments' && (
            <button className="primary" onClick={() => setIsEquipmentModalOpen(true)}>
              <Plus size={16} /> 添加器材
            </button>
          )}
        </div>
      </header>

      <div className="view-body">
        <div className="tab-container">
          <button 
            className={`tab-btn ${subTab === 'cameras' ? 'active' : ''}`}
            onClick={() => setSubTab('cameras')}
          >
            相机库 ({cameras.length})
          </button>
          <button 
            className={`tab-btn ${subTab === 'lenses' ? 'active' : ''}`}
            onClick={() => setSubTab('lenses')}
          >
            镜头库 ({lenses.length})
          </button>
          {enableFilmMode && (
            <button 
              className={`tab-btn ${subTab === 'filmStocks' ? 'active' : ''}`}
              onClick={() => setSubTab('filmStocks')}
            >
              胶卷库存 ({filmStocks.length})
            </button>
          )}
          <button 
            className={`tab-btn ${subTab === 'otherEquipments' ? 'active' : ''}`}
            onClick={() => setSubTab('otherEquipments')}
          >
            其他器材 ({otherEquipments.length})
          </button>
        </div>

        {/* 1. CAMERAS TAB */}
        {subTab === 'cameras' && (
          <div className="grid-layout">
            {cameras.length === 0 ? (
              <div className="empty-state">
                <BookOpen size={48} />
                <p>相机库为空，添加第一台相机开始记录拍摄吧！</p>
              </div>
            ) : (
              cameras.map(camera => (
                <div key={camera.id} className="gear-card">
                  <div className="gear-card-header">
                    <span className={`tag ${camera.type}`}>{camera.type === 'film' ? '胶片' : '数码'}</span>
                    <button className="danger icon-btn" onClick={() => handleDeleteCamera(camera.id!)}>
                      <Trash2 size={14} />
                    </button>
                  </div>
                  <h3>{camera.name}</h3>
                  <div className="gear-details">
                    <div><strong>画幅：</strong>{camera.format}</div>
                  </div>
                </div>
              ))
            )}
          </div>
        )}

        {/* 2. LENSES TAB */}
        {subTab === 'lenses' && (
          <div className="lenses-grid-layout">
            {lenses.length === 0 ? (
              <div className="empty-state">
                <SlidersHorizontal size={48} />
                <p>镜头库为空，快来登记你的镜头吧！</p>
              </div>
            ) : (
              lenses.map(lens => (
                <div key={lens.id} className="gear-card lens-card-horizontal">
                  <div className="lens-card-avatar">
                    <LensSvgAvatar focalLength={lens.focalLength} type={lens.type || 'prime'} size={72} />
                  </div>
                  <div className="lens-card-content">
                    <div className="gear-card-header">
                      <span className={`tag lens-${lens.type || 'prime'}`}>
                        {lens.type === 'prime' ? '定焦' : '变焦'}
                      </span>
                      <button className="danger icon-btn" onClick={() => handleDeleteLens(lens.id!)}>
                        <Trash2 size={14} />
                      </button>
                    </div>
                    <h3>{lens.name}</h3>
                    <div className="gear-details">
                      <div><strong>焦段：</strong>{lens.focalLength}mm</div>
                      <div><strong>最大光圈：</strong>{lens.maxAperture}</div>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        )}

        {/* 3. FILM STOCKS TAB */}
        {subTab === 'filmStocks' && enableFilmMode && (
          <div className="grid-layout">
            {filmStocks.length === 0 ? (
              <div className="empty-state">
                <Layers size={48} />
                <p>胶卷型号库为空，添加胶卷可以更好地汇总每卷成本哦！</p>
              </div>
            ) : (
              filmStocks.map(film => (
                <div key={film.id} className="gear-card">
                  <div className="gear-card-header">
                    <span className={`tag ${film.colorType === 'color' ? 'color' : 'bw'}`}>
                      {film.colorType === 'color' ? '彩色' : '黑白'}
                    </span>
                    <button className="danger icon-btn" onClick={() => handleDeleteFilm(film.id!)}>
                      <Trash2 size={14} />
                    </button>
                  </div>
                  <h3>{film.brand} {film.name}</h3>
                  <div className="gear-details">
                    <div><strong>ISO：</strong>{film.iso}</div>
                    <div><strong>画幅：</strong>{film.format}</div>
                  </div>
                </div>
              ))
            )}
          </div>
        )}

        {/* 4. OTHER EQUIPMENTS TAB */}
        {subTab === 'otherEquipments' && (
          <div className="grid-layout">
            {otherEquipments.length === 0 ? (
              <div className="empty-state">
                <SlidersHorizontal size={48} />
                <p>其他器材库为空，添加你的药水、三脚架或清洁工具吧！</p>
              </div>
            ) : (
              otherEquipments.map(eq => {
                const isExpired = eq.type === 'chemical' && eq.expiryDate && eq.expiryDate < Date.now();
                return (
                  <div key={eq.id} className={`gear-card equipment-card ${isExpired ? 'expired-alert' : ''}`}>
                    <div className="gear-card-header">
                      <span className={`tag eq-${eq.type}`}>
                        {eq.type === 'chemical' ? '药水' :
                         eq.type === 'tripod' ? '三脚架' :
                         eq.type === 'cleaner' ? '清洁工具' : '其它'}
                      </span>
                      {isExpired && <span className="tag expired-tag">已过期</span>}
                      <button className="danger icon-btn" onClick={() => handleDeleteEquipment(eq.id!)}>
                        <Trash2 size={14} />
                      </button>
                    </div>
                    <h3>{eq.name}</h3>
                    <div className="gear-details">
                      {eq.purchaseDate && (
                        <div><strong>购买日期：</strong>{new Date(eq.purchaseDate).toLocaleDateString()}</div>
                      )}
                      {eq.type === 'chemical' && eq.expiryDate && (
                        <div className={isExpired ? 'expired-text' : ''}>
                          <strong>过期日期：</strong>{new Date(eq.expiryDate).toLocaleDateString()}
                        </div>
                      )}
                      {eq.notes && <div><strong>备注：</strong>{eq.notes}</div>}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        )}
      </div>

      {/* --- MODALS --- */}
      {isCameraModalOpen && (
        <div className="modal-overlay">
          <div className="modal-content">
            <h3>添加新相机</h3>
            <form onSubmit={handleAddCamera}>
              <div className="form-group">
                <label>相机名称</label>
                <input 
                  type="text" 
                  className="form-control" 
                  placeholder="例如: Minolta X-700" 
                  value={newCamera.name}
                  onChange={e => setNewCamera({...newCamera, name: e.target.value})}
                  required 
                />
              </div>
              <div className="form-group">
                <label>相机类型</label>
                <select 
                  className="form-control"
                  value={newCamera.type}
                  onChange={e => setNewCamera({...newCamera, type: e.target.value as any})}
                >
                  <option value="film">胶片相机</option>
                  <option value="digital">数码相机</option>
                </select>
              </div>
              <div className="form-group">
                <label>画幅格式</label>
                <select 
                  className="form-control"
                  value={newCamera.format}
                  onChange={e => setNewCamera({...newCamera, format: e.target.value})}
                >
                  <option value="135">135 画幅</option>
                  <option value="120">120 画幅</option>
                  <option value="largeFormat">大画幅</option>
                  <option value="digital">数码全画幅/残幅</option>
                </select>
              </div>
              <div className="modal-actions">
                <button type="button" onClick={() => setIsCameraModalOpen(false)}>取消</button>
                <button type="submit" className="primary">添加</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {isLensModalOpen && (
        <div className="modal-overlay">
          <div className="modal-content">
            <h3>添加新镜头</h3>
            <form onSubmit={handleAddLens}>
              <div className="form-group">
                <label>镜头型号</label>
                <input 
                  type="text" 
                  className="form-control" 
                  placeholder="例如: MD 50mm f/1.7" 
                  value={newLens.name}
                  onChange={e => setNewLens({...newLens, name: e.target.value})}
                  required 
                />
              </div>
              <div className="form-group">
                <label>焦段 (mm)</label>
                <input 
                  type="number" 
                  className="form-control" 
                  value={newLens.focalLength}
                  onChange={e => setNewLens({...newLens, focalLength: parseInt(e.target.value, 10)})}
                  required 
                />
              </div>
              <div className="form-group">
                <label>最大光圈</label>
                <input 
                  type="text" 
                  className="form-control" 
                  placeholder="例如: f/1.4"
                  value={newLens.maxAperture}
                  onChange={e => setNewLens({...newLens, maxAperture: e.target.value})}
                  required 
                />
              </div>
              <div className="form-group">
                <label>镜头类型</label>
                <select 
                  className="form-control"
                  value={newLens.type}
                  onChange={e => setNewLens({...newLens, type: e.target.value})}
                >
                  <option value="prime">定焦镜头</option>
                  <option value="zoom">变焦镜头</option>
                </select>
              </div>
              <div className="modal-actions">
                <button type="button" onClick={() => setIsLensModalOpen(false)}>取消</button>
                <button type="submit" className="primary">添加</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {isFilmModalOpen && (
        <div className="modal-overlay">
          <div className="modal-content">
            <h3>添加新胶卷</h3>
            <form onSubmit={handleAddFilm}>
              <div className="form-group">
                <label>品牌/厂商</label>
                <input 
                  type="text" 
                  className="form-control" 
                  placeholder="例如: Kodak" 
                  value={newFilm.brand}
                  onChange={e => setNewFilm({...newFilm, brand: e.target.value})}
                  required 
                />
              </div>
              <div className="form-group">
                <label>型号名称</label>
                <input 
                  type="text" 
                  className="form-control" 
                  placeholder="例如: Gold 200" 
                  value={newFilm.name}
                  onChange={e => setNewFilm({...newFilm, name: e.target.value})}
                  required 
                />
              </div>
              <div className="form-group">
                <label>ISO 速度</label>
                <input 
                  type="number" 
                  className="form-control" 
                  value={newFilm.iso}
                  onChange={e => setNewFilm({...newFilm, iso: parseInt(e.target.value, 10)})}
                  required 
                />
              </div>
              <div className="form-group">
                <label>色彩类别</label>
                <select 
                  className="form-control"
                  value={newFilm.colorType}
                  onChange={e => setNewFilm({...newFilm, colorType: e.target.value as any})}
                >
                  <option value="color">彩色胶片</option>
                  <option value="bw">黑白胶片</option>
                </select>
              </div>
              <div className="form-group">
                <label>画幅大小</label>
                <select 
                  className="form-control"
                  value={newFilm.format}
                  onChange={e => setNewFilm({...newFilm, format: e.target.value})}
                >
                  <option value="135">135 (35mm)</option>
                  <option value="120">120 中画幅</option>
                </select>
              </div>
              <div className="modal-actions">
                <button type="button" onClick={() => setIsFilmModalOpen(false)}>取消</button>
                <button type="submit" className="primary">添加</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* --- OTHER EQUIPMENT MODAL --- */}
      {isEquipmentModalOpen && (
        <div className="modal-overlay">
          <div className="modal-content">
            <h3>添加新器材</h3>
            <form onSubmit={handleAddEquipment}>
              <div className="form-group">
                <label>器材名称</label>
                <input 
                  type="text" 
                  className="form-control" 
                  placeholder="例如: D-76 显影粉 / 捷信三脚架" 
                  value={newEquipment.name}
                  onChange={e => setNewEquipment({...newEquipment, name: e.target.value})}
                  required 
                />
              </div>
              <div className="form-group">
                <label>器材类型</label>
                <select 
                  className="form-control"
                  value={newEquipment.type}
                  onChange={e => setNewEquipment({...newEquipment, type: e.target.value as any})}
                  required
                >
                  <option value="chemical">药水 / 化学品</option>
                  <option value="tripod">三脚架</option>
                  <option value="cleaner">清洁工具</option>
                  <option value="other">其它</option>
                </select>
              </div>
              <div className="form-group">
                <label>购买时间</label>
                <input 
                  type="date" 
                  className="form-control" 
                  value={newEquipment.purchaseDate ? new Date(newEquipment.purchaseDate).toISOString().substring(0, 10) : ''}
                  onChange={e => setNewEquipment({...newEquipment, purchaseDate: e.target.value ? new Date(e.target.value).getTime() : undefined})}
                />
              </div>
              {newEquipment.type === 'chemical' && (
                <div className="form-group">
                  <label>药水保质期 / 过期日期</label>
                  <input 
                    type="date" 
                    className="form-control" 
                    value={newEquipment.expiryDate ? new Date(newEquipment.expiryDate).toISOString().substring(0, 10) : ''}
                    onChange={e => setNewEquipment({...newEquipment, expiryDate: e.target.value ? new Date(e.target.value).getTime() : undefined})}
                    required
                  />
                </div>
              )}
              <div className="form-group">
                <label>备注 / 说明</label>
                <textarea 
                  className="form-control" 
                  rows={2} 
                  placeholder="关于该器材的额外备注..."
                  value={newEquipment.notes}
                  onChange={e => setNewEquipment({...newEquipment, notes: e.target.value})}
                />
              </div>
              <div className="modal-actions">
                <button type="button" onClick={() => setIsEquipmentModalOpen(false)}>取消</button>
                <button type="submit" className="primary">添加</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
