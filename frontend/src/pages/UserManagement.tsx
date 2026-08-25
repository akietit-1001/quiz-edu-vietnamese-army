import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { ArrowLeft, Trash, PencilSimple, UserPlus, MagnifyingGlass, ShieldCheck, Buildings, Plus, Funnel, CaretRight, Eye, X, ArrowsLeftRight, IdentificationBadge, DotsThreeVertical } from '../icons';
import { UnitTreeSelect, type UnitNode } from '../components/UnitTreeSelect';
import { compareUnitSiblings } from '../constants/unitSort';
import { useSubviewBack } from '../hooks/useSubviewBack';
import { DatePicker } from '../components/DatePicker';
import { Select } from '../components/Select';
import { Checkbox } from '../components/Checkbox';
import { Pagination } from '../components/Pagination';

interface UserManagementProps {
  user: any;
  onNavigateBack: () => void;
}

// Chiến sĩ: từ Binh nhì đến Thượng sĩ. Cán bộ: từ Thiếu úy trở lên (không có
// cấp bậc nào dùng chung cho cả 2 đối tượng).
const SOLDIER_RANKS = ['Binh nhì', 'Binh nhất', 'Hạ sĩ', 'Trung sĩ', 'Thượng sĩ'];
const OFFICER_RANKS = ['Thiếu úy', 'Trung úy', 'Thượng úy', 'Đại úy', 'Thiếu tá', 'Trung tá', 'Thượng tá', 'Đại tá', 'Thiếu tướng', 'Trung tướng', 'Thượng tướng', 'Đại tướng'];
const RANKS = [...SOLDIER_RANKS, ...OFFICER_RANKS];
const POSITIONS = ['Chiến sĩ', 'Tiểu đội trưởng', 'Phó Trung đội trưởng', 'Trung đội trưởng', 'Phó Đại đội trưởng', 'Đại đội trưởng', 'Phó Tiểu đoàn trưởng', 'Tiểu đoàn trưởng', 'Chính trị viên', 'Chính trị viên phó', 'Y tá', 'Học viên', 'Giảng viên', 'Khác'];

export const UserManagement: React.FC<UserManagementProps> = ({ user, onNavigateBack }) => {
  const [users, setUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  // Filtering/Searching
  const [searchTerm, setSearchTerm] = useState('');
  const [rankFilter, setRankFilter] = useState('');
  const [page, setPage] = useState(1);
  const pageSize = 10;

  // Advanced filter panel — 1 field per column trong bảng quân nhân
  const [showUserAdvancedFilter, setShowUserAdvancedFilter] = useState(false);
  const [positionFilter, setPositionFilter] = useState('');
  const [unitFilter, setUnitFilter] = useState('');
  const [roleFilter, setRoleFilter] = useState('');
  const [personnelTypeFilter, setPersonnelTypeFilter] = useState(''); // '' | 'soldier' | 'officer'

  const userAdvancedFilterCount = [rankFilter, positionFilter, unitFilter, roleFilter, personnelTypeFilter].filter(Boolean).length;

  const handleClearUserAdvancedFilters = () => {
    setRankFilter('');
    setPositionFilter('');
    setUnitFilter('');
    setRoleFilter('');
    setPersonnelTypeFilter('');
  };

  // Sorting
  const [userSortField, setUserSortField] = useState<string>('fullName');
  const [userSortOrder, setUserSortOrder] = useState<'asc' | 'desc'>('asc');

  const handleUserSort = (field: string) => {
    if (userSortField === field) {
      setUserSortOrder(userSortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setUserSortField(field);
      setUserSortOrder('asc');
    }
  };

  const renderSortIndicator = (field: string) => {
    if (userSortField !== field) {
      return <span className="inline-block ml-1 opacity-30 select-none cursor-pointer">↕</span>;
    }
    return (
      <span className="inline-block ml-1 text-vpa-gold font-bold select-none">
        {userSortOrder === 'asc' ? '↑' : '↓'}
      </span>
    );
  };

  // Table Column Resizing — kéo mép cột để đổi độ rộng, giống bảng đề thi/
  // ngân hàng câu hỏi ở QuizManagement.
  const [userColWidths, setUserColWidths] = useState<{ [key: string]: number }>({
    fullName: 180,
    rank: 110,
    position: 130,
    unit: 160,
    email: 200,
    role: 120,
    actions: 90
  });
  const [userResized, setUserResized] = useState(false);
  const activeUserCol = React.useRef<string | null>(null);
  const userStartX = React.useRef<number>(0);
  const userStartWidth = React.useRef<number>(0);

  const handleUserResizeMouseDown = (colKey: string, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();

    const thElement = e.currentTarget.parentElement;
    const trElement = thElement?.parentElement;
    if (trElement) {
      const ths = Array.from(trElement.children) as HTMLTableHeaderCellElement[];
      const widths: { [key: string]: number } = {
        fullName: ths[0]?.getBoundingClientRect().width || userColWidths.fullName,
        rank: ths[1]?.getBoundingClientRect().width || userColWidths.rank,
        position: ths[2]?.getBoundingClientRect().width || userColWidths.position,
        unit: ths[3]?.getBoundingClientRect().width || userColWidths.unit,
        email: ths[4]?.getBoundingClientRect().width || userColWidths.email,
        role: ths[5]?.getBoundingClientRect().width || userColWidths.role,
        actions: ths[6]?.getBoundingClientRect().width || userColWidths.actions,
      };
      setUserColWidths(widths);
      setUserResized(true);
      userStartWidth.current = widths[colKey];
    } else {
      userStartWidth.current = userColWidths[colKey];
    }

    activeUserCol.current = colKey;
    userStartX.current = e.clientX;

    document.addEventListener('mousemove', handleUserResizeMouseMove);
    document.addEventListener('mouseup', handleUserResizeMouseUp);
  };

  const handleUserResizeMouseMove = (e: MouseEvent) => {
    if (!activeUserCol.current) return;
    const diff = e.clientX - userStartX.current;
    const newWidth = Math.max(60, userStartWidth.current + diff);
    setUserColWidths(prev => ({ ...prev, [activeUserCol.current as string]: newWidth }));
  };

  const handleUserResizeMouseUp = () => {
    activeUserCol.current = null;
    document.removeEventListener('mousemove', handleUserResizeMouseMove);
    document.removeEventListener('mouseup', handleUserResizeMouseUp);
  };

  useEffect(() => {
    return () => {
      document.removeEventListener('mousemove', handleUserResizeMouseMove);
      document.removeEventListener('mouseup', handleUserResizeMouseUp);
    };
  }, []);

  // Modal / Form state
  const [showFormModal, setShowFormModal] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);

  // Form Fields
  const [personnelType, setPersonnelType] = useState<'soldier' | 'officer'>('officer');
  const [email, setEmail] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [dateOfBirth, setDateOfBirth] = useState('');
  const [rank, setRank] = useState('Binh nhì');
  const [position, setPosition] = useState('Chiến sĩ');
  const [unitId, setUnitId] = useState(user?.unit?.id || '');
  const [address, setAddress] = useState('');
  const [role, setRole] = useState('user');

  // Unit tree (for the picker + the "Quản lý đơn vị" tab)
  const [activeTab, setActiveTab] = useState<'users' | 'units'>('users');
  const [units, setUnits] = useState<UnitNode[]>([]);
  const [unitsLoading, setUnitsLoading] = useState(true);
  const [newUnitName, setNewUnitName] = useState('');
  const [newUnitParentId, setNewUnitParentId] = useState('');
  const [unitError, setUnitError] = useState('');
  const [unitSuccessMsg, setUnitSuccessMsg] = useState('');
  const [renamingUnitId, setRenamingUnitId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState('');
  const [showAddUnitModal, setShowAddUnitModal] = useState(false);
  const [expandedUnitIds, setExpandedUnitIds] = useState<Set<string>>(new Set());
  const [viewingUnit, setViewingUnit] = useState<UnitNode | null>(null);
  const [unitDetailIncludeSubUnits, setUnitDetailIncludeSubUnits] = useState(false);
  const [unitDetailPage, setUnitDetailPage] = useState(1);
  const unitDetailPageSize = 10;
  // Mở đơn vị khác, hoặc bật/tắt "gồm cả đơn vị con", đổi hẳn tập bản ghi —
  // về trang 1 để khỏi kẹt ở 1 trang trống nếu trang cũ vượt quá tổng mới.
  useEffect(() => {
    setUnitDetailPage(1);
  }, [viewingUnit?._id, unitDetailIncludeSubUnits]);

  // Di chuyển đơn vị sang cha khác (qua modal, hoặc kéo-thả trực tiếp trên cây)
  const [movingUnit, setMovingUnit] = useState<UnitNode | null>(null);
  const [moveTargetParentId, setMoveTargetParentId] = useState('');
  const [moveError, setMoveError] = useState('');
  // Danh sách đơn vị đang được kéo — kéo 1 đơn vị đã tick chọn (khi đang
  // chọn nhiều) thì cả nhóm đã chọn cùng di chuyển; kéo 1 đơn vị chưa chọn
  // thì chỉ mình nó di chuyển, không đụng tới lựa chọn hiện có.
  const [draggedUnitIds, setDraggedUnitIds] = useState<string[]>([]);
  const [dragOverUnitId, setDragOverUnitId] = useState<string | null>(null);
  // 'before'/'after' = thả vào rìa trên/dưới dòng đích để SẮP XẾP làm anh em
  // (giữ nguyên cha, chỉ đổi vị trí hiển thị); 'inside' = thả vào giữa dòng
  // để DI CHUYỂN thành con của đích (đổi cha, như trước giờ).
  const [dragOverZone, setDragOverZone] = useState<'before' | 'after' | 'inside' | null>(null);
  const [selectedUnitIds, setSelectedUnitIds] = useState<Set<string>>(new Set());

  // Menu "..." gộp các thao tác ít dùng (đổi tên/thêm con/di chuyển/chức
  // vụ/xoá) lại 1 chỗ thay vì xếp 6 icon liền nhau trên mỗi dòng.
  const [openMenuUnitId, setOpenMenuUnitId] = useState<string | null>(null);

  // Xoá đơn vị — hỗ trợ xoá cả cây con, yêu cầu gõ đúng tên để xác nhận
  const [deletingUnit, setDeletingUnit] = useState<UnitNode | null>(null);
  const [deleteCascade, setDeleteCascade] = useState(false);
  const [deleteConfirmName, setDeleteConfirmName] = useState('');
  const [deleteError, setDeleteError] = useState('');

  // Quản lý danh sách chức vụ riêng của 1 đơn vị
  const [managingPositionsUnit, setManagingPositionsUnit] = useState<UnitNode | null>(null);
  const [positionsDraft, setPositionsDraft] = useState<string[]>([]);
  const [newPositionInput, setNewPositionInput] = useState('');
  const [positionsSaveError, setPositionsSaveError] = useState('');

  // Units this commander is allowed to assign people/sub-units into:
  // master-admin sees the whole tree, everyone else only their own branch.
  const assignableUnits = React.useMemo(() => {
    const byId = new Map(units.map(u => [u._id, u]));
    const result: UnitNode[] = [];
    const collect = (id: string) => {
      const node = byId.get(id);
      if (!node) return;
      result.push(node);
      units
        .filter(u => u.parentId === id)
        .sort(compareUnitSiblings)
        .forEach(child => collect(child._id));
    };

    if (user?.role === 'master-admin') {
      units
        .filter(u => !u.parentId)
        .sort(compareUnitSiblings)
        .forEach(root => collect(root._id));
      return result;
    }

    const ownUnitId = user?.unit?.id;
    if (!ownUnitId) return [];
    collect(ownUnitId);
    return result;
  }, [units, user]);

  // Chức vụ hợp lệ cho đơn vị đang chọn trong form thêm/sửa quân nhân — mỗi
  // đơn vị tự quản lý danh sách chức vụ riêng (field `positions` trên chính
  // Unit đó, sửa qua modal "Quản lý chức vụ"), chỉ hiện đúng chức vụ của
  // đơn vị đó thay vì xổ ra toàn bộ chức vụ toàn hệ thống. Đơn vị chưa có
  // chức vụ nào tự khai báo thì tạm dùng danh sách dự phòng chung.
  const positionsForSelectedUnit = React.useMemo(() => {
    const unit = units.find(u => u._id === unitId);
    if (!unit) return [];
    return unit.positions && unit.positions.length > 0 ? unit.positions : POSITIONS;
  }, [units, unitId]);

  // Danh sách chức vụ thực sự hiển thị trong dropdown của form — thêm chức
  // vụ hiện tại của quân nhân vào nếu nó không nằm trong danh sách của đơn
  // vị (VD: dữ liệu cũ, hoặc đơn vị chưa khai báo đúng), để dropdown luôn
  // phản ánh đúng giá trị thật thay vì lặng lẽ hiện sai/trống.
  const positionOptionsForForm = React.useMemo(() => {
    const base = positionsForSelectedUnit.length > 0 ? positionsForSelectedUnit : POSITIONS;
    return base.includes(position) || !position ? base : [...base, position];
  }, [positionsForSelectedUnit, position]);

  // Hợp nhất chức vụ của MỌI đơn vị (dùng cho ô "Bộ lọc nâng cao" — không
  // gắn với 1 đơn vị cụ thể) — luôn khớp đúng dữ liệu DB hiện tại thay vì
  // 1 danh sách tĩnh cố định.
  const allKnownPositions = React.useMemo(() => {
    const fromUnits = units.flatMap(u => u.positions || []);
    return Array.from(new Set([...POSITIONS, ...fromUnits])).sort();
  }, [units]);

  // Chỉ tự chuyển chức vụ khi đơn vị THỰC SỰ đổi do người dùng bấm chọn lại
  // trong form — mọi lần setUnitId "lập trình" (mở form thêm/sửa quân nhân,
  // đổi đơn vị từ popup chi tiết đơn vị) phải bật cờ này trước để effect bỏ
  // qua, tránh vừa mở form sửa đã âm thầm đổi mất chức vụ thật đang lưu của
  // quân nhân đó chỉ vì đơn vị của họ có danh sách chức vụ riêng không chứa
  // đúng chức vụ hiện tại (VD: "Chiến sĩ" không nằm trong danh sách của đơn
  // vị đó). So sánh giá trị unitId cũ/mới KHÔNG đủ để phân biệt 2 trường hợp
  // này vì mở form sửa cũng luôn khiến unitId "đổi" từ giá trị mặc định.
  const skipNextPositionAutoResetRef = React.useRef(true); // bỏ qua lần chạy đầu tiên lúc mount
  useEffect(() => {
    if (skipNextPositionAutoResetRef.current) {
      skipNextPositionAutoResetRef.current = false;
      return;
    }
    if (positionsForSelectedUnit.length > 0 && !positionsForSelectedUnit.includes(position)) {
      setPosition(positionsForSelectedUnit[0]);
    }
  }, [unitId, positionsForSelectedUnit]);

  // Group assignableUnits by parent so the tree can be rendered collapsed —
  // only direct children of an expanded node are ever shown.
  const unitChildrenMap = React.useMemo(() => {
    const map = new Map<string, UnitNode[]>();
    assignableUnits.forEach(u => {
      const key = u.parentId || '';
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(u);
    });
    return map;
  }, [assignableUnits]);

  const rootUnitNodes = React.useMemo(() => {
    const scopedIds = new Set(assignableUnits.map(u => u._id));
    return assignableUnits.filter(u => !u.parentId || !scopedIds.has(u.parentId));
  }, [assignableUnits]);

  // Full lookup (không giới hạn theo phạm vi quản lý) để dựng breadcrumb —
  // GET /api/units trả về toàn bộ cây cho mọi người dùng đã đăng nhập.
  const unitsById = React.useMemo(() => new Map(units.map(u => [u._id, u])), [units]);

  const getUnitBreadcrumb = (unitId: string): UnitNode[] => {
    const chain: UnitNode[] = [];
    let current = unitsById.get(unitId);
    while (current) {
      chain.unshift(current);
      current = current.parentId ? unitsById.get(current.parentId) : undefined;
    }
    return chain;
  };

  const getUnitAndDescendantIds = (unitId: string): string[] => {
    const ids = [unitId];
    (unitChildrenMap.get(unitId) || []).forEach(child => {
      ids.push(...getUnitAndDescendantIds(child._id));
    });
    return ids;
  };

  const handleViewUnit = (unitToView: UnitNode) => {
    setUnitDetailIncludeSubUnits(false);
    setViewingUnit(unitToView);
  };

  // Default "Đơn vị" khi mở popup thêm mới: master-admin -> đơn vị gốc duy nhất
  // của toàn hệ thống; chỉ huy cấp dưới -> đơn vị của chính họ (chỉ được thêm
  // đơn vị con trong phạm vi quản lý).
  const defaultNewUnitParentId = user?.role === 'master-admin'
    ? (rootUnitNodes[0]?._id || '')
    : (user?.unit?.id || '');

  const toggleUnitExpand = (id: string) => {
    setExpandedUnitIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  // Cây đơn vị thu gọn theo mặc định — chỉ xổ ra đơn vị trực thuộc khi
  // bấm vào, tránh liệt kê hết mọi cấp khi số lượng đơn vị tăng lên.
  const renderUnitNode = (nodeUnit: UnitNode, depth: number): React.ReactNode => {
    const children = unitChildrenMap.get(nodeUnit._id) || [];
    const hasChildren = children.length > 0;
    const isExpanded = expandedUnitIds.has(nodeUnit._id);

    const isDragging = draggedUnitIds.includes(nodeUnit._id);
    const isDropTarget = dragOverUnitId === nodeUnit._id;
    const activeZone = isDropTarget ? dragOverZone : null;
    const isSelected = selectedUnitIds.has(nodeUnit._id);
    const isMenuOpen = openMenuUnitId === nodeUnit._id;

    return (
      <React.Fragment key={nodeUnit._id}>
        <li
          style={{ marginLeft: `${depth * 24}px` }}
          draggable={!!nodeUnit.parentId && renamingUnitId !== nodeUnit._id}
          onDragStart={e => {
            e.dataTransfer.effectAllowed = 'move';
            const ids = isSelected && selectedUnitIds.size > 1 ? Array.from(selectedUnitIds) : [nodeUnit._id];
            setDraggedUnitIds(ids);
          }}
          onDragEnd={() => { setDraggedUnitIds([]); setDragOverUnitId(null); setDragOverZone(null); }}
          onDragOver={e => {
            if (draggedUnitIds.length === 0 || draggedUnitIds.includes(nodeUnit._id)) return;
            e.preventDefault();
            e.dataTransfer.dropEffect = 'move';
            // Rìa trên/dưới (25% đầu/cuối chiều cao dòng) = sắp xếp làm anh
            // em; vùng giữa = thả vào bên trong để đổi cha (như trước giờ).
            const rect = e.currentTarget.getBoundingClientRect();
            const relativeY = (e.clientY - rect.top) / rect.height;
            const zone: 'before' | 'after' | 'inside' = relativeY < 0.25 ? 'before' : relativeY > 0.75 ? 'after' : 'inside';
            setDragOverUnitId(nodeUnit._id);
            setDragOverZone(zone);
          }}
          onDragLeave={() => setDragOverUnitId(prev => (prev === nodeUnit._id ? null : prev))}
          onDrop={e => {
            e.preventDefault();
            if (draggedUnitIds.length > 0) handleDropOnUnit(draggedUnitIds, nodeUnit, dragOverZone || 'inside');
          }}
          className={`flex items-center justify-between py-2 px-3 border-b-2 text-xs transition-colors ${nodeUnit.parentId ? 'cursor-grab active:cursor-grabbing' : ''} ${isDragging ? 'opacity-40' : ''} ${activeZone === 'inside' ? 'bg-vpa-gold/10 ring-1 ring-vpa-gold border-vpa-olive-light/10' : activeZone === 'before' ? 'border-t-2 border-t-vpa-gold border-b-vpa-olive-light/10' : activeZone === 'after' ? 'border-b-vpa-gold' : 'border-vpa-olive-light/10'} ${isSelected ? 'bg-vpa-gold/5' : ''}`}
        >
          <div className="flex items-center space-x-2 flex-1 min-w-0">
            {nodeUnit.parentId && (
              <Checkbox
                checked={isSelected}
                onChange={() => toggleUnitSelected(nodeUnit._id)}
                title="Chọn để di chuyển hàng loạt"
              />
            )}

            {renamingUnitId === nodeUnit._id ? (
              <div className="flex items-center space-x-2 flex-1">
                <input
                  autoFocus
                  type="text"
                  value={renameValue}
                  onChange={e => setRenameValue(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') handleConfirmRenameUnit(); if (e.key === 'Escape') setRenamingUnitId(null); }}
                  className="text-xs p-1 bg-transparent border border-vpa-gold text-vpa-olive dark:text-vpa-sand focus:outline-none font-mono"
                />
                <button type="button" onClick={handleConfirmRenameUnit} className="text-vpa-gold text-[10px] font-bold uppercase">Lưu</button>
                <button type="button" onClick={() => setRenamingUnitId(null)} className="text-gray-400 text-[10px] font-bold uppercase">Hủy</button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => hasChildren && toggleUnitExpand(nodeUnit._id)}
                className={`flex items-center space-x-2 text-left min-w-0 ${hasChildren ? 'cursor-pointer' : 'cursor-default'}`}
              >
                <CaretRight
                  size={10}
                  weight="bold"
                  className={`text-gray-400 transition-transform shrink-0 ${hasChildren ? '' : 'opacity-0'} ${isExpanded ? 'rotate-90' : ''}`}
                />
                <Buildings size={12} className="text-vpa-gold shrink-0" />
                <span className="font-bold text-vpa-olive dark:text-vpa-sand uppercase truncate">{nodeUnit.name}</span>
              </button>
            )}
          </div>

          {renamingUnitId !== nodeUnit._id && (
            <div className="flex items-center space-x-2 relative shrink-0">
              <button
                type="button"
                onClick={() => handleViewUnit(nodeUnit)}
                className="p-1.5 border border-vpa-olive-light/50 text-vpa-olive dark:text-vpa-sand hover:bg-vpa-olive hover:text-white dark:hover:bg-vpa-gold dark:hover:text-vpa-dark transition-colors rounded-lg"
                title="Xem chi tiết"
              >
                <Eye size={12} />
              </button>
              <button
                type="button"
                data-menu-trigger={nodeUnit._id}
                onClick={() => setOpenMenuUnitId(isMenuOpen ? null : nodeUnit._id)}
                className={`p-1.5 border transition-colors rounded-lg ${isMenuOpen ? 'bg-vpa-olive text-white dark:bg-vpa-gold dark:text-vpa-dark border-transparent' : 'border-vpa-olive-light/50 text-vpa-olive dark:text-vpa-sand hover:bg-vpa-olive hover:text-white dark:hover:bg-vpa-gold dark:hover:text-vpa-dark'}`}
                title="Thao tác khác"
              >
                <DotsThreeVertical size={12} weight="bold" />
              </button>

              {isMenuOpen && (
                <div
                  data-unit-menu={nodeUnit._id}
                  className="absolute right-0 top-full mt-1 z-20 w-48 border border-vpa-olive-light bg-vpa-sand-light dark:bg-vpa-dark-card shadow-xl rounded-lg overflow-hidden animate-fadeIn"
                >
                  <button
                    type="button"
                    onClick={() => { setOpenMenuUnitId(null); handleStartRenameUnit(nodeUnit); }}
                    className="w-full flex items-center gap-2 px-3 py-2 text-left text-[11px] uppercase tracking-wide text-vpa-olive dark:text-vpa-sand hover:bg-vpa-olive/10 dark:hover:bg-vpa-gold/10"
                  >
                    <PencilSimple size={12} /> <span>Đổi tên</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => { setOpenMenuUnitId(null); handleOpenAddUnitModalForParent(nodeUnit._id); }}
                    className="w-full flex items-center gap-2 px-3 py-2 text-left text-[11px] uppercase tracking-wide text-vpa-olive dark:text-vpa-sand hover:bg-vpa-olive/10 dark:hover:bg-vpa-gold/10"
                  >
                    <Plus size={12} /> <span>Thêm đơn vị con</span>
                  </button>
                  {nodeUnit.parentId && (
                    <button
                      type="button"
                      onClick={() => { setOpenMenuUnitId(null); handleOpenMoveUnit(nodeUnit); }}
                      className="w-full flex items-center gap-2 px-3 py-2 text-left text-[11px] uppercase tracking-wide text-vpa-olive dark:text-vpa-sand hover:bg-vpa-olive/10 dark:hover:bg-vpa-gold/10"
                    >
                      <ArrowsLeftRight size={12} /> <span>Di chuyển</span>
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => { setOpenMenuUnitId(null); handleOpenManagePositions(nodeUnit); }}
                    className="w-full flex items-center gap-2 px-3 py-2 text-left text-[11px] uppercase tracking-wide text-vpa-olive dark:text-vpa-sand hover:bg-vpa-olive/10 dark:hover:bg-vpa-gold/10"
                  >
                    <IdentificationBadge size={12} /> <span>Quản lý chức vụ</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => { setOpenMenuUnitId(null); handleDeleteUnit(nodeUnit); }}
                    className="w-full flex items-center gap-2 px-3 py-2 text-left text-[11px] uppercase tracking-wide text-vpa-red hover:bg-vpa-red/10 border-t border-vpa-olive-light/20"
                  >
                    <Trash size={12} /> <span>Xoá</span>
                  </button>
                </div>
              )}
            </div>
          )}
        </li>
        {hasChildren && isExpanded && children.map(child => renderUnitNode(child, depth + 1))}
      </React.Fragment>
    );
  };

  // Chỉ hiện "Đang tải cây đơn vị..." (thay hẳn danh sách) ở lần tải ĐẦU
  // TIÊN — các lần gọi lại sau (sau khi thêm/sửa/xoá/di chuyển/đổi chức vụ)
  // âm thầm thay dữ liệu mới vào chỗ cũ, không unmount rồi mount lại cả cây,
  // tránh cảm giác trang bị chớp/giật như đang load lại từ đầu.
  const fetchUnits = async () => {
    const isFirstLoad = units.length === 0;
    try {
      if (isFirstLoad) setUnitsLoading(true);
      const res = await axios.get('/api/units');
      setUnits(res.data);
    } catch (err: any) {
      setUnitError('Không thể tải cây đơn vị.');
    } finally {
      if (isFirstLoad) setUnitsLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers();
    fetchUnits();
  }, []);

  // Đóng menu "..." của 1 dòng đơn vị khi bấm ra ngoài (cả nút mở lẫn menu).
  useEffect(() => {
    if (!openMenuUnitId) return;
    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      const insideMenu = target.closest(`[data-unit-menu="${openMenuUnitId}"]`);
      const onTrigger = target.closest(`[data-menu-trigger="${openMenuUnitId}"]`);
      if (!insideMenu && !onTrigger) setOpenMenuUnitId(null);
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [openMenuUnitId]);

  useEffect(() => {
    setPage(1);
  }, [searchTerm, rankFilter, positionFilter, unitFilter, roleFilter, personnelTypeFilter]);

  const fetchUsers = async () => {
    try {
      setLoading(true);
      const res = await axios.get('/api/users');
      setUsers(res.data);
      setLoading(false);
    } catch (err: any) {
      setError('Không thể tải danh sách quân nhân.');
      setLoading(false);
    }
  };

  const handleOpenCreateModal = () => {
    setIsEditing(false);
    setSelectedUserId(null);
    setPersonnelType('officer');
    setEmail('');
    setUsername('');
    setPassword('');
    setFullName('');
    setDateOfBirth('');
    setRank(OFFICER_RANKS[0]);
    setPosition('Chiến sĩ');
    skipNextPositionAutoResetRef.current = true;
    setUnitId(user?.role === 'master-admin' ? '' : user?.unit?.id || '');
    setAddress('');
    setRole('user');
    setError('');
    setSuccessMsg('');
    setShowFormModal(true);
  };

  // Mở form thêm quân nhân với đơn vị đã chốt sẵn (dùng từ popup chi tiết
  // đơn vị) — gọi lại handleOpenCreateModal() rồi ghi đè unitId mặc định.
  const handleOpenCreateModalForUnit = (presetUnitId: string) => {
    handleOpenCreateModal();
    skipNextPositionAutoResetRef.current = true;
    setUnitId(presetUnitId);
  };

  const handleOpenEditModal = (targetUser: any) => {
    setIsEditing(true);
    setSelectedUserId(targetUser._id);
    setPersonnelType(targetUser.personnelType === 'soldier' ? 'soldier' : 'officer');
    setEmail(targetUser.email || '');
    setUsername(targetUser.username || '');
    setPassword(''); // Don't show password
    setFullName(targetUser.fullName);
    setDateOfBirth(targetUser.dateOfBirth ? new Date(targetUser.dateOfBirth).toISOString().split('T')[0] : '');
    setRank(targetUser.rank || 'Binh nhì');
    setPosition(targetUser.position || 'Chiến sĩ');
    skipNextPositionAutoResetRef.current = true;
    setUnitId(targetUser.unit?.id || '');
    setAddress(targetUser.address || '');
    setRole(targetUser.role || 'user');
    setError('');
    setSuccessMsg('');
    setShowFormModal(true);
  };

  const handleFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccessMsg('');

    const payload: any = {
      fullName,
      dateOfBirth,
      rank,
      position,
      unitId,
      address,
      role
    };

    if (!isEditing) {
      payload.personnelType = personnelType;
      payload.password = password;
      if (personnelType === 'soldier') {
        payload.username = username;
        if (!username || !password || !fullName || !unitId) {
          setError('Vui lòng điền đầy đủ các thông tin bắt buộc (Tên đăng nhập, Mật khẩu, Họ tên, Đơn vị)');
          return;
        }
      } else {
        payload.email = email;
        if (!email || !password || !fullName || !unitId) {
          setError('Vui lòng điền đầy đủ các thông tin bắt buộc (Email, Mật khẩu, Họ tên, Đơn vị)');
          return;
        }
      }
    } else {
      if (!fullName || !unitId) {
        setError('Vui lòng điền đầy đủ các thông tin bắt buộc (Họ tên, Đơn vị)');
        return;
      }
    }

    try {
      if (isEditing && selectedUserId) {
        await axios.put(`/api/users/${selectedUserId}`, payload);
        setSuccessMsg('Cập nhật thông tin quân nhân thành công!');
      } else {
        await axios.post('/api/users', payload);
        setSuccessMsg('Thêm quân nhân mới vào đơn vị thành công!');
      }

      setTimeout(() => {
        setShowFormModal(false);
        fetchUsers();
      }, 1000);
    } catch (err: any) {
      setError(err.response?.data?.message || 'Đã xảy ra lỗi khi lưu thông tin.');
    }
  };

  const handleDeleteUser = async (targetId: string, name: string) => {
    const confirmDelete = await window.showConfirm(`Đồng chí có chắc chắn muốn xóa tài khoản của quân nhân ${name} khỏi hệ thống?`, 'Xác nhận xóa tài khoản');
    if (!confirmDelete) {
      return;
    }

    try {
      await axios.delete(`/api/users/${targetId}`);
      setSuccessMsg('Đã xóa quân nhân thành công.');
      fetchUsers();
      setTimeout(() => setSuccessMsg(''), 3000);
    } catch (err: any) {
      setError(err.response?.data?.message || 'Không thể xóa quân nhân.');
      setTimeout(() => setError(''), 3000);
    }
  };

  const handleOpenAddUnitModal = () => {
    setUnitError('');
    setNewUnitName('');
    setNewUnitParentId(defaultNewUnitParentId);
    setShowAddUnitModal(true);
  };

  // Thêm nhanh 1 đơn vị con ngay từ dòng của đơn vị cha trong cây, thay vì
  // phải mở "+ Thêm đơn vị" ở đầu trang rồi tự chọn cha trong dropdown.
  const handleOpenAddUnitModalForParent = (parentId: string) => {
    setUnitError('');
    setNewUnitName('');
    setNewUnitParentId(parentId);
    setShowAddUnitModal(true);
  };

  const handleCreateUnit = async (e: React.FormEvent) => {
    e.preventDefault();
    setUnitError('');
    setUnitSuccessMsg('');
    if (!newUnitName.trim()) {
      setUnitError('Vui lòng nhập tên đơn vị mới.');
      return;
    }
    try {
      await axios.post('/api/units', {
        name: newUnitName.trim(),
        parentId: newUnitParentId || null
      });
      setUnitSuccessMsg('Đã thêm đơn vị mới thành công.');
      setNewUnitName('');
      setShowAddUnitModal(false);
      if (newUnitParentId) {
        setExpandedUnitIds(prev => new Set(prev).add(newUnitParentId));
      }
      fetchUnits();
      setTimeout(() => setUnitSuccessMsg(''), 3000);
    } catch (err: any) {
      setUnitError(err.response?.data?.message || 'Không thể tạo đơn vị mới.');
    }
  };

  const handleStartRenameUnit = (unitToRename: UnitNode) => {
    setRenamingUnitId(unitToRename._id);
    setRenameValue(unitToRename.name);
  };

  const handleConfirmRenameUnit = async () => {
    if (!renamingUnitId || !renameValue.trim()) {
      setRenamingUnitId(null);
      return;
    }
    try {
      await axios.put(`/api/units/${renamingUnitId}`, { name: renameValue.trim() });
      setRenamingUnitId(null);
      fetchUnits();
    } catch (err: any) {
      setUnitError(err.response?.data?.message || 'Không thể đổi tên đơn vị.');
      setTimeout(() => setUnitError(''), 3000);
    }
  };

  const handleDeleteUnit = (unitToDelete: UnitNode) => {
    setDeletingUnit(unitToDelete);
    setDeleteCascade(false);
    setDeleteConfirmName('');
    setDeleteError('');
  };

  const handleConfirmDeleteUnit = async () => {
    if (!deletingUnit) return;
    if (deleteCascade && deleteConfirmName.trim() !== deletingUnit.name) {
      setDeleteError('Tên gõ vào chưa khớp — hãy gõ đúng tên đơn vị để xác nhận.');
      return;
    }
    try {
      await axios.delete(`/api/units/${deletingUnit._id}${deleteCascade ? '?cascade=true' : ''}`);
      setUnitSuccessMsg('Đã xóa đơn vị thành công.');
      setDeletingUnit(null);
      fetchUnits();
      setTimeout(() => setUnitSuccessMsg(''), 3000);
    } catch (err: any) {
      setDeleteError(err.response?.data?.message || 'Không thể xóa đơn vị (có thể còn đơn vị con hoặc quân nhân trực thuộc).');
    }
  };

  // Danh sách đơn vị hợp lệ để chọn làm cha mới khi di chuyển — loại trừ
  // chính đơn vị đang di chuyển và toàn bộ hậu duệ của nó (tránh vòng lặp).
  const getMoveTargetOptions = (unitToMove: UnitNode): UnitNode[] => {
    const excludedIds = new Set(getUnitAndDescendantIds(unitToMove._id));
    return assignableUnits.filter(u => !excludedIds.has(u._id));
  };

  const handleOpenMoveUnit = (unitToMove: UnitNode) => {
    setMovingUnit(unitToMove);
    setMoveTargetParentId('');
    setMoveError('');
  };

  // Gọi API di chuyển thật sự — dùng chung cho cả modal "Di chuyển" (chọn
  // cha từ dropdown) lẫn kéo-thả trực tiếp trên cây.
  const performMoveUnit = async (unitId: string, newParentId: string): Promise<{ ok: true } | { ok: false; message: string }> => {
    try {
      await axios.patch(`/api/units/${unitId}/move`, { newParentId });
      fetchUnits();
      return { ok: true };
    } catch (err: any) {
      return { ok: false, message: err.response?.data?.message || 'Không thể di chuyển đơn vị.' };
    }
  };

  const handleConfirmMoveUnit = async () => {
    if (!movingUnit || !moveTargetParentId) return;
    const result = await performMoveUnit(movingUnit._id, moveTargetParentId);
    if (result.ok) {
      setUnitSuccessMsg('Đã di chuyển đơn vị thành công.');
      setMovingUnit(null);
      setTimeout(() => setUnitSuccessMsg(''), 3000);
    } else {
      setMoveError(result.message);
    }
  };

  // Gọi API sắp xếp thật sự — thả 1 đơn vị vào rìa trên/dưới 1 đơn vị anh em
  // khác (cùng cha) để đổi thứ tự hiển thị, không đổi cha.
  const performReorderUnit = async (unitId: string, targetId: string, position: 'before' | 'after'): Promise<{ ok: true } | { ok: false; message: string }> => {
    try {
      await axios.patch(`/api/units/${unitId}/reorder`, { targetId, position });
      fetchUnits();
      return { ok: true };
    } catch (err: any) {
      return { ok: false, message: err.response?.data?.message || 'Không thể sắp xếp đơn vị.' };
    }
  };

  // Kéo-thả 1 hoặc nhiều đơn vị (đã tick chọn) vào dòng của đơn vị khác để
  // di chuyển nhanh, không cần mở modal. Nếu trong nhóm kéo có cả 1 đơn vị
  // VÀ hậu duệ của chính nó (cả 2 cùng được tick), chỉ di chuyển đơn vị tổ
  // tiên — hậu duệ tự đi theo, gọi API riêng cho nó nữa sẽ kéo nó ra khỏi
  // cha thật của nó một cách sai ý người dùng.
  const handleMoveDropUnit = async (draggedIds: string[], targetParentId: string) => {
    const idsToMove = draggedIds.filter(id => {
      if (id === targetParentId) return false;
      const unit = units.find(u => u._id === id);
      if (!unit || !unit.parentId) return false; // không cho kéo đơn vị gốc
      const isDescendantOfAnotherDragged = draggedIds.some(
        otherId => otherId !== id && getUnitAndDescendantIds(otherId).includes(id)
      );
      return !isDescendantOfAnotherDragged;
    });
    if (idsToMove.length === 0) return;

    const blockedByCycle = idsToMove.filter(id => getUnitAndDescendantIds(id).includes(targetParentId));
    if (blockedByCycle.length > 0) {
      setUnitError('Không thể di chuyển 1 đơn vị vào chính hậu duệ của nó.');
      setTimeout(() => setUnitError(''), 3000);
      return;
    }

    const results = await Promise.all(idsToMove.map(id => performMoveUnit(id, targetParentId)));
    const failures = results.filter(r => !r.ok) as { ok: false; message: string }[];
    setSelectedUnitIds(new Set());
    if (failures.length === 0) {
      setUnitSuccessMsg(idsToMove.length > 1 ? `Đã di chuyển ${idsToMove.length} đơn vị thành công.` : 'Đã di chuyển đơn vị thành công.');
      setTimeout(() => setUnitSuccessMsg(''), 3000);
    } else {
      setUnitError(failures[0].message);
      setTimeout(() => setUnitError(''), 3000);
    }
  };

  // Điều phối khi thả — thả vào rìa trên/dưới 1 đơn vị ANH EM (cùng cha) thì
  // sắp xếp lại vị trí; mọi trường hợp khác (thả vào giữa dòng, thả nhiều
  // đơn vị cùng lúc, hoặc khác cha) vẫn xử lý như di chuyển/đổi cha như cũ.
  const handleDropOnUnit = async (draggedIds: string[], targetUnit: UnitNode, zone: 'before' | 'after' | 'inside') => {
    setDragOverUnitId(null);
    setDragOverZone(null);
    setDraggedUnitIds([]);

    if (zone !== 'inside' && draggedIds.length === 1) {
      const draggedUnit = units.find(u => u._id === draggedIds[0]);
      if (draggedUnit && draggedUnit.parentId === targetUnit.parentId && draggedUnit._id !== targetUnit._id) {
        const result = await performReorderUnit(draggedUnit._id, targetUnit._id, zone);
        if (result.ok) {
          setUnitSuccessMsg('Đã sắp xếp lại thứ tự đơn vị.');
          setTimeout(() => setUnitSuccessMsg(''), 3000);
        } else {
          setUnitError(result.message);
          setTimeout(() => setUnitError(''), 3000);
        }
        return;
      }
    }

    await handleMoveDropUnit(draggedIds, targetUnit._id);
  };

  const toggleUnitSelected = (id: string) => {
    setSelectedUnitIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const handleOpenManagePositions = (unitToManage: UnitNode) => {
    setManagingPositionsUnit(unitToManage);
    setPositionsDraft(unitToManage.positions || []);
    setNewPositionInput('');
    setPositionsSaveError('');
  };

  const handleAddPositionDraft = () => {
    const trimmed = newPositionInput.trim();
    if (!trimmed || positionsDraft.includes(trimmed)) {
      setNewPositionInput('');
      return;
    }
    setPositionsDraft(prev => [...prev, trimmed]);
    setNewPositionInput('');
  };

  const handleRemovePositionDraft = (pos: string) => {
    setPositionsDraft(prev => prev.filter(p => p !== pos));
  };

  const handleSavePositions = async () => {
    if (!managingPositionsUnit) return;
    try {
      const res = await axios.put(`/api/units/${managingPositionsUnit._id}/positions`, { positions: positionsDraft });
      setUnitSuccessMsg('Đã lưu danh sách chức vụ.');
      setManagingPositionsUnit(null);
      setUnits(prev => prev.map(u => (u._id === res.data._id ? { ...u, positions: res.data.positions } : u)));
      setTimeout(() => setUnitSuccessMsg(''), 3000);
    } catch (err: any) {
      setPositionsSaveError(err.response?.data?.message || 'Không thể lưu danh sách chức vụ.');
    }
  };

  const filteredUsers = users.filter(u => {
    const matchSearch =
      u.fullName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (u.email || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
      (u.username || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
      (u.position || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
      (u.unit?.name || '').toLowerCase().includes(searchTerm.toLowerCase());

    const matchRank = rankFilter ? u.rank === rankFilter : true;
    const matchPosition = positionFilter ? u.position === positionFilter : true;
    const matchUnit = unitFilter ? u.unit?.id === unitFilter : true;
    const matchRole = roleFilter ? u.role === roleFilter : true;
    const matchPersonnelType = personnelTypeFilter
      ? (personnelTypeFilter === 'soldier' ? u.personnelType === 'soldier' : u.personnelType !== 'soldier')
      : true;

    return matchSearch && matchRank && matchPosition && matchUnit && matchRole && matchPersonnelType;
  });

  const sortedUsers = [...filteredUsers].sort((a, b) => {
    let aVal: any = a[userSortField];
    let bVal: any = b[userSortField];

    if (userSortField === 'unit') {
      aVal = a.unit?.name;
      bVal = b.unit?.name;
    }

    if (userSortField === 'rank') {
      const rankOrder = [
        'Binh nhì', 'Binh nhất', 'Hạ sĩ', 'Trung sĩ', 'Thượng sĩ', 
        'Thiếu úy', 'Trung úy', 'Thượng úy', 'Đại úy', 
        'Thiếu tá', 'Trung tá', 'Thượng tá', 'Đại tá', 
        'Thiếu tướng', 'Trung tướng', 'Thượng tướng', 'Đại tướng'
      ];
      aVal = rankOrder.indexOf(a.rank);
      bVal = rankOrder.indexOf(b.rank);
    }

    if (aVal === undefined || aVal === null) aVal = '';
    if (bVal === undefined || bVal === null) bVal = '';

    if (typeof aVal === 'string') {
      return userSortOrder === 'asc' 
        ? aVal.localeCompare(bVal)
        : bVal.localeCompare(aVal);
    } else {
      return userSortOrder === 'asc'
        ? (aVal > bVal ? 1 : -1)
        : (bVal > aVal ? 1 : -1);
    }
  });

  const totalPages = Math.ceil(sortedUsers.length / pageSize);
  const startIndex = (page - 1) * pageSize;
  const displayedUsers = sortedUsers.slice(startIndex, startIndex + pageSize);

  // fetchUsers() không xoá `users` trước khi gọi lại (thêm/sửa/xoá quân nhân,
  // đổi trang...), nên filteredUsers vẫn giữ số liệu cũ trong lúc loading =
  // true — dùng luôn số đó để đoán số dòng skeleton cho khớp trang hiện tại.
  const userSkeletonRowCount = filteredUsers.length > 0
    ? Math.max(1, Math.min(pageSize, filteredUsers.length - startIndex))
    : pageSize;

  // Role hierarchy restrictions
  const getAvailableRoles = () => {
    if (user?.role === 'master-admin') {
      return [
        { value: 'user', label: 'Quân nhân (User)' },
        { value: 'sub-admin', label: 'Chỉ huy trung đội/đại đội (Sub-Admin)' },
        { value: 'admin', label: 'Quản trị viên đơn vị (Admin)' }
      ];
    }
    if (user?.role === 'admin') {
      return [
        { value: 'user', label: 'Quân nhân (User)' },
        { value: 'sub-admin', label: 'Chỉ huy trung đội/đại đội (Sub-Admin)' }
      ];
    }
    return [
      { value: 'user', label: 'Quân nhân (User)' }
    ];
  };

  // Cho phép nút Back trình duyệt đóng từng modal thay vì thoát thẳng ra
  // trang trước đó (VD: Dashboard) — xem chi tiết trong useSubviewBack.
  useSubviewBack(showFormModal, () => setShowFormModal(false));
  useSubviewBack(showAddUnitModal, () => setShowAddUnitModal(false));
  useSubviewBack(!!viewingUnit, () => setViewingUnit(null));
  useSubviewBack(!!movingUnit, () => setMovingUnit(null));
  useSubviewBack(!!deletingUnit, () => setDeletingUnit(null));
  useSubviewBack(!!managingPositionsUnit, () => setManagingPositionsUnit(null));

  return (
    <div className="max-w-7xl mx-auto px-6 py-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-8 pb-4 border-b border-vpa-olive-light/30">
        <div className="flex items-center space-x-4">
          <button
            onClick={() => {
              if (showFormModal) { setShowFormModal(false); return; }
              if (showAddUnitModal) { setShowAddUnitModal(false); return; }
              if (movingUnit) { setMovingUnit(null); return; }
              if (deletingUnit) { setDeletingUnit(null); return; }
              if (managingPositionsUnit) { setManagingPositionsUnit(null); return; }
              if (viewingUnit) { setViewingUnit(null); return; }
              onNavigateBack();
            }}
            className="p-2 border border-vpa-olive-light/30 hover:bg-vpa-olive-light/10 text-vpa-olive dark:text-vpa-sand transition-colors"
          >
            <ArrowLeft size={18} />
          </button>
          <div>
            <h1 className="text-lg font-bold uppercase tracking-wider text-vpa-olive dark:text-vpa-sand">
              Quản lý Quân nhân Đơn vị
            </h1>
            <p className="text-[10px] text-gray-500 uppercase tracking-widest font-mono">
              Đơn vị: {user?.role === 'master-admin' ? 'TẤT CẢ ĐƠN VỊ' : user?.unit?.name} | Cấp chỉ huy: {user?.fullName}
            </p>
          </div>
        </div>

        {activeTab === 'users' && (
          <button
            onClick={handleOpenCreateModal}
            className="px-4 py-2 bg-vpa-olive dark:bg-vpa-gold text-white dark:text-vpa-dark text-xs font-bold uppercase tracking-wider flex items-center space-x-2 hover:bg-vpa-olive-light dark:hover:bg-vpa-gold-bright transition-colors"
          >
            <UserPlus size={16} />
            <span>Thêm Quân nhân</span>
          </button>
        )}
      </div>

      {/* Tab switcher */}
      <div className="flex space-x-1 mb-6 border-b border-vpa-olive-light/30">
        <button
          type="button"
          onClick={() => setActiveTab('users')}
          className={`px-4 py-2 text-xs font-bold uppercase tracking-wider transition-colors border-b-2 ${
            activeTab === 'users'
              ? 'border-vpa-gold text-vpa-olive dark:text-vpa-sand'
              : 'border-transparent text-gray-400 hover:text-vpa-olive dark:hover:text-vpa-sand'
          }`}
        >
          Quân nhân
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('units')}
          className={`px-4 py-2 text-xs font-bold uppercase tracking-wider transition-colors border-b-2 flex items-center space-x-1.5 ${
            activeTab === 'units'
              ? 'border-vpa-gold text-vpa-olive dark:text-vpa-sand'
              : 'border-transparent text-gray-400 hover:text-vpa-olive dark:hover:text-vpa-sand'
          }`}
        >
          <Buildings size={14} />
          <span>Quản lý đơn vị</span>
        </button>
      </div>

      {activeTab === 'users' && successMsg && (
        <div className="mb-6 p-4 bg-green-500/10 border border-green-500/30 text-green-600 text-xs font-bold uppercase tracking-wider flex items-center space-x-2">
          <ShieldCheck size={18} />
          <span>{successMsg}</span>
        </div>
      )}

      {activeTab === 'users' && error && (
        <div className="mb-6 p-4 bg-vpa-red/10 border border-vpa-red/30 text-vpa-red text-xs font-bold uppercase tracking-wider">
          {error}
        </div>
      )}

      {activeTab === 'units' && unitSuccessMsg && (
        <div className="mb-6 p-4 bg-green-500/10 border border-green-500/30 text-green-600 text-xs font-bold uppercase tracking-wider flex items-center space-x-2">
          <ShieldCheck size={18} />
          <span>{unitSuccessMsg}</span>
        </div>
      )}

      {activeTab === 'units' && unitError && (
        <div className="mb-6 p-4 bg-vpa-red/10 border border-vpa-red/30 text-vpa-red text-xs font-bold uppercase tracking-wider">
          {unitError}
        </div>
      )}

      {activeTab === 'users' && (
      <>
      {/* Filter / Search Bar */}
      <div className="border border-vpa-olive-light/50 bg-vpa-sand-light dark:bg-vpa-dark-card mb-6 shadow-sm rounded-lg overflow-hidden">
        <div className="p-4 flex flex-col gap-3 md:grid md:grid-cols-3 md:gap-4 md:items-center">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center md:contents">
            <div className="relative flex-1 min-w-0">
              <input
                type="text"
                placeholder="Tìm theo họ tên, email, chức vụ..."
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
                className="w-full text-xs p-2.5 pl-9 bg-transparent border border-vpa-olive-light text-vpa-olive dark:text-vpa-sand focus:outline-none focus:border-vpa-gold font-mono"
              />
              <MagnifyingGlass size={16} className="absolute left-3 top-3 text-gray-400" />
            </div>

            <button
              type="button"
              onClick={() => setShowUserAdvancedFilter(prev => !prev)}
              className={`shrink-0 flex items-center space-x-1.5 px-2.5 py-2 border text-xs font-bold uppercase tracking-wider transition-colors justify-center ${
                showUserAdvancedFilter || userAdvancedFilterCount > 0
                  ? 'bg-vpa-olive text-white border-transparent dark:bg-vpa-gold dark:text-vpa-dark'
                  : 'border-vpa-olive-light text-vpa-olive dark:text-vpa-sand hover:bg-vpa-olive-light/10'
              }`}
            >
              <Funnel size={14} />
              <span>Bộ lọc nâng cao</span>
              {userAdvancedFilterCount > 0 && (
                <span className="w-4 h-4 rounded-full bg-vpa-red text-white text-[9px] flex items-center justify-center font-mono">
                  {userAdvancedFilterCount}
                </span>
              )}
            </button>
          </div>

          <div className="flex items-center justify-end text-[10px] text-gray-500 uppercase tracking-widest font-mono">
            Số lượng quân nhân: {filteredUsers.length} / {users.length}
          </div>
        </div>

        {/* Advanced filter panel — trượt xuống thay vì popup */}
        <div className={`grid transition-all duration-300 ease-in-out ${showUserAdvancedFilter ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0'}`}>
          <div className="overflow-hidden">
            <div className="p-4 border-t border-vpa-olive-light/30 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
              <div>
                <label className="block text-[9px] uppercase tracking-wider font-semibold text-gray-500 mb-1">Cấp bậc</label>
                <Select
                  value={rankFilter}
                  onChange={setRankFilter}
                  className="w-full text-xs p-2 bg-transparent border border-vpa-olive-light text-vpa-olive dark:text-vpa-sand focus:outline-none focus:border-vpa-gold font-mono rounded-lg flex items-center justify-between gap-2"
                >
                  <option value="">Tất cả</option>
                  {RANKS.map(rk => (
                    <option key={rk} value={rk}>{rk}</option>
                  ))}
                </Select>
              </div>
              <div>
                <label className="block text-[9px] uppercase tracking-wider font-semibold text-gray-500 mb-1">Chức vụ</label>
                <Select
                  value={positionFilter}
                  onChange={setPositionFilter}
                  className="w-full text-xs p-2 bg-transparent border border-vpa-olive-light text-vpa-olive dark:text-vpa-sand focus:outline-none focus:border-vpa-gold font-mono rounded-lg flex items-center justify-between gap-2"
                >
                  <option value="">Tất cả</option>
                  {allKnownPositions.map(ps => (
                    <option key={ps} value={ps}>{ps}</option>
                  ))}
                </Select>
              </div>
              <div>
                <label className="block text-[9px] uppercase tracking-wider font-semibold text-gray-500 mb-1">Đơn vị</label>
                <Select
                  value={unitFilter}
                  onChange={setUnitFilter}
                  className="w-full text-xs p-2 bg-transparent border border-vpa-olive-light text-vpa-olive dark:text-vpa-sand focus:outline-none focus:border-vpa-gold font-mono rounded-lg flex items-center justify-between gap-2"
                >
                  <option value="">Tất cả</option>
                  {assignableUnits.map(u => (
                    <option key={u._id} value={u._id}>{u.name}</option>
                  ))}
                </Select>
              </div>
              <div>
                <label className="block text-[9px] uppercase tracking-wider font-semibold text-gray-500 mb-1">Quyền hạn</label>
                <Select
                  value={roleFilter}
                  onChange={setRoleFilter}
                  className="w-full text-xs p-2 bg-transparent border border-vpa-olive-light text-vpa-olive dark:text-vpa-sand focus:outline-none focus:border-vpa-gold font-mono rounded-lg flex items-center justify-between gap-2"
                >
                  <option value="">Tất cả</option>
                  <option value="user">User</option>
                  <option value="sub-admin">Sub-Admin</option>
                  <option value="admin">Admin</option>
                  <option value="master-admin">Master-Admin</option>
                </Select>
              </div>
              <div>
                <label className="block text-[9px] uppercase tracking-wider font-semibold text-gray-500 mb-1">Đối tượng</label>
                <Select
                  value={personnelTypeFilter}
                  onChange={setPersonnelTypeFilter}
                  className="w-full text-xs p-2 bg-transparent border border-vpa-olive-light text-vpa-olive dark:text-vpa-sand focus:outline-none focus:border-vpa-gold font-mono rounded-lg flex items-center justify-between gap-2"
                >
                  <option value="">Tất cả</option>
                  <option value="soldier">Chiến sĩ</option>
                  <option value="officer">Cán bộ</option>
                </Select>
              </div>
              <div className="sm:col-span-2 lg:col-span-5 flex justify-end">
                <button
                  type="button"
                  onClick={handleClearUserAdvancedFilters}
                  disabled={userAdvancedFilterCount === 0}
                  className="text-[10px] uppercase tracking-wider font-bold text-vpa-red hover:underline disabled:opacity-40 disabled:no-underline disabled:cursor-not-allowed"
                >
                  Xóa bộ lọc nâng cao
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Users Table */}
      <div className="border border-vpa-olive-light/50 bg-vpa-sand-light dark:bg-vpa-dark-card shadow-md rounded-lg overflow-hidden">
        <div className="hidden md:block overflow-x-auto">
          <table className={`w-full text-left border-collapse text-xs ${userResized ? 'table-fixed' : ''}`}>
            <thead>
              <tr className="border-b border-vpa-olive-light/30 text-gray-500 font-mono uppercase text-[10px]">
                <th
                  className="relative py-3 px-4 cursor-pointer hover:text-vpa-gold transition-colors select-none pr-6 whitespace-nowrap"
                  style={userResized ? { width: userColWidths.fullName, minWidth: userColWidths.fullName } : undefined}
                  onClick={() => handleUserSort('fullName')}
                >
                  Họ và tên {renderSortIndicator('fullName')}
                  <div
                    className="absolute right-0 top-0 bottom-0 w-3 cursor-col-resize z-10 group"
                    onMouseDown={(e) => handleUserResizeMouseDown('fullName', e)}
                    onClick={(e) => { e.preventDefault(); e.stopPropagation(); }}
                  >
                    <div className="absolute right-0 top-0 bottom-0 w-[2px] group-hover:w-[6px] bg-vpa-olive-light/30 dark:bg-vpa-gold/20 group-hover:bg-vpa-gold transition-all duration-200" />
                  </div>
                </th>
                <th
                  className="relative py-3 px-4 cursor-pointer hover:text-vpa-gold transition-colors select-none pr-6 whitespace-nowrap"
                  style={userResized ? { width: userColWidths.rank, minWidth: userColWidths.rank } : undefined}
                  onClick={() => handleUserSort('rank')}
                >
                  Cấp bậc {renderSortIndicator('rank')}
                  <div
                    className="absolute right-0 top-0 bottom-0 w-3 cursor-col-resize z-10 group"
                    onMouseDown={(e) => handleUserResizeMouseDown('rank', e)}
                    onClick={(e) => { e.preventDefault(); e.stopPropagation(); }}
                  >
                    <div className="absolute right-0 top-0 bottom-0 w-[2px] group-hover:w-[6px] bg-vpa-olive-light/30 dark:bg-vpa-gold/20 group-hover:bg-vpa-gold transition-all duration-200" />
                  </div>
                </th>
                <th
                  className="relative py-3 px-4 cursor-pointer hover:text-vpa-gold transition-colors select-none pr-6 whitespace-nowrap"
                  style={userResized ? { width: userColWidths.position, minWidth: userColWidths.position } : undefined}
                  onClick={() => handleUserSort('position')}
                >
                  Chức vụ {renderSortIndicator('position')}
                  <div
                    className="absolute right-0 top-0 bottom-0 w-3 cursor-col-resize z-10 group"
                    onMouseDown={(e) => handleUserResizeMouseDown('position', e)}
                    onClick={(e) => { e.preventDefault(); e.stopPropagation(); }}
                  >
                    <div className="absolute right-0 top-0 bottom-0 w-[2px] group-hover:w-[6px] bg-vpa-olive-light/30 dark:bg-vpa-gold/20 group-hover:bg-vpa-gold transition-all duration-200" />
                  </div>
                </th>
                <th
                  className="relative py-3 px-4 cursor-pointer hover:text-vpa-gold transition-colors select-none pr-6 whitespace-nowrap"
                  style={userResized ? { width: userColWidths.unit, minWidth: userColWidths.unit } : undefined}
                  onClick={() => handleUserSort('unit')}
                >
                  Đơn vị {renderSortIndicator('unit')}
                  <div
                    className="absolute right-0 top-0 bottom-0 w-3 cursor-col-resize z-10 group"
                    onMouseDown={(e) => handleUserResizeMouseDown('unit', e)}
                    onClick={(e) => { e.preventDefault(); e.stopPropagation(); }}
                  >
                    <div className="absolute right-0 top-0 bottom-0 w-[2px] group-hover:w-[6px] bg-vpa-olive-light/30 dark:bg-vpa-gold/20 group-hover:bg-vpa-gold transition-all duration-200" />
                  </div>
                </th>
                <th
                  className="relative py-3 px-4 cursor-pointer hover:text-vpa-gold transition-colors select-none pr-6 whitespace-nowrap"
                  style={userResized ? { width: userColWidths.email, minWidth: userColWidths.email } : undefined}
                  onClick={() => handleUserSort('email')}
                >
                  Email / Tên đăng nhập {renderSortIndicator('email')}
                  <div
                    className="absolute right-0 top-0 bottom-0 w-3 cursor-col-resize z-10 group"
                    onMouseDown={(e) => handleUserResizeMouseDown('email', e)}
                    onClick={(e) => { e.preventDefault(); e.stopPropagation(); }}
                  >
                    <div className="absolute right-0 top-0 bottom-0 w-[2px] group-hover:w-[6px] bg-vpa-olive-light/30 dark:bg-vpa-gold/20 group-hover:bg-vpa-gold transition-all duration-200" />
                  </div>
                </th>
                <th
                  className="relative py-3 px-4 cursor-pointer hover:text-vpa-gold transition-colors select-none pr-6 whitespace-nowrap"
                  style={userResized ? { width: userColWidths.role, minWidth: userColWidths.role } : undefined}
                  onClick={() => handleUserSort('role')}
                >
                  Quyền hạn {renderSortIndicator('role')}
                  <div
                    className="absolute right-0 top-0 bottom-0 w-3 cursor-col-resize z-10 group"
                    onMouseDown={(e) => handleUserResizeMouseDown('role', e)}
                    onClick={(e) => { e.preventDefault(); e.stopPropagation(); }}
                  >
                    <div className="absolute right-0 top-0 bottom-0 w-[2px] group-hover:w-[6px] bg-vpa-olive-light/30 dark:bg-vpa-gold/20 group-hover:bg-vpa-gold transition-all duration-200" />
                  </div>
                </th>
                <th
                  className="py-3 px-4 text-right select-none"
                  style={userResized ? { width: userColWidths.actions, minWidth: userColWidths.actions } : undefined}
                >
                  Thao tác
                </th>
              </tr>
            </thead>
            <tbody>
              {loading ?
                Array.from({ length: userSkeletonRowCount }).map((_, idx) => (
                  <tr key={idx} className="border-b border-vpa-olive-light/10 animate-pulse">
                    <td className="py-4 px-4">
                      <div className="w-32 h-4 bg-vpa-olive-light/20 dark:bg-vpa-gold/15 rounded"></div>
                    </td>
                    <td className="py-4 px-4">
                      <div className="w-20 h-4 bg-vpa-olive-light/10 dark:bg-vpa-gold/10 rounded"></div>
                    </td>
                    <td className="py-4 px-4">
                      <div className="w-24 h-4 bg-vpa-olive-light/10 dark:bg-vpa-gold/10 rounded"></div>
                    </td>
                    <td className="py-4 px-4">
                      <div className="w-28 h-4 bg-vpa-olive-light/15 dark:bg-vpa-gold/15 rounded"></div>
                    </td>
                    <td className="py-4 px-4">
                      <div className="w-36 h-4 bg-vpa-olive-light/10 dark:bg-vpa-gold/10 rounded font-mono"></div>
                    </td>
                    <td className="py-4 px-4">
                      <div className="w-16 h-5 bg-vpa-olive-light/15 dark:bg-vpa-gold/15 rounded"></div>
                    </td>
                    <td className="py-4 px-4 text-right flex justify-end space-x-2">
                      <div className="w-7 h-7 bg-vpa-olive-light/10 dark:bg-vpa-gold/10 rounded"></div>
                      <div className="w-7 h-7 bg-vpa-olive-light/10 dark:bg-vpa-gold/10 rounded"></div>
                    </td>
                  </tr>
                ))
              :
                displayedUsers.map(u => (
                  <tr key={u._id} className="border-b border-vpa-olive-light/10 hover:bg-vpa-olive-light/5">
                    <td className="py-3 px-4 font-bold text-vpa-olive dark:text-vpa-sand uppercase">{u.fullName}</td>
                    <td className="py-3 px-4">{u.rank || 'Chưa cập nhật'}</td>
                    <td className="py-3 px-4">{u.position || 'Chưa cập nhật'}</td>
                    <td className="py-3 px-4 uppercase font-bold text-vpa-olive/75 dark:text-vpa-sand/75">{u.unit?.name || ''}</td>
                    <td className="py-3 px-4 font-mono">{u.email || u.username}</td>
                    <td className="py-3 px-4">
                      {u.role === 'master-admin' && <span className="bg-red-600/10 text-red-600 border border-red-600/35 px-2 py-0.5 font-bold font-mono text-[9px] uppercase">Master-Admin</span>}
                      {u.role === 'admin' && <span className="bg-vpa-gold/10 text-vpa-gold border border-vpa-gold/35 px-2 py-0.5 font-bold font-mono text-[9px] uppercase">Admin</span>}
                      {u.role === 'sub-admin' && <span className="bg-blue-600/10 text-blue-600 border border-blue-600/35 px-2 py-0.5 font-bold font-mono text-[9px] uppercase">Sub-Admin</span>}
                      {u.role === 'user' && <span className="bg-green-600/10 text-green-600 border border-green-600/35 px-2 py-0.5 font-bold font-mono text-[9px] uppercase">User</span>}
                    </td>
                    <td className="py-3 px-4 text-right flex justify-end space-x-2">
                      <button
                        type="button"
                        onClick={() => handleOpenEditModal(u)}
                        className="p-1.5 border border-vpa-olive-light/50 text-vpa-olive dark:text-vpa-sand hover:bg-vpa-olive hover:text-white dark:hover:bg-vpa-gold dark:hover:text-vpa-dark transition-colors rounded-lg"
                      >
                        <PencilSimple size={14} />
                      </button>
                      
                      {/* Can only delete if user is below commander's level */}
                      {((user?.role === 'master-admin' && u.role !== 'master-admin') ||
                        (user?.role === 'admin' && u.role !== 'admin' && u.role !== 'master-admin') ||
                        (user?.role === 'sub-admin' && u.role === 'user')) && (
                        <button
                          type="button"
                          onClick={() => handleDeleteUser(u._id, u.fullName)}
                          className="p-1.5 border border-vpa-red/30 text-vpa-red hover:bg-vpa-red hover:text-white transition-colors rounded-lg"
                        >
                          <Trash size={14} />
                        </button>
                      )}
                    </td>
                  </tr>
                ))
              }
              </tbody>
            </table>
          </div>

          {/* Mobile card list */}
          <div className="md:hidden divide-y divide-vpa-olive-light/10">
            {loading ?
              Array.from({ length: userSkeletonRowCount }).map((_, idx) => (
                <div key={idx} className="p-4 animate-pulse space-y-2">
                  <div className="w-32 h-4 bg-vpa-olive-light/20 dark:bg-vpa-gold/15 rounded"></div>
                  <div className="flex gap-1.5">
                    <div className="w-14 h-4 bg-vpa-olive-light/10 dark:bg-vpa-gold/10 rounded"></div>
                    <div className="w-20 h-4 bg-vpa-olive-light/10 dark:bg-vpa-gold/10 rounded"></div>
                  </div>
                  <div className="w-40 h-3 bg-vpa-olive-light/10 dark:bg-vpa-gold/10 rounded"></div>
                </div>
              ))
            :
              displayedUsers.map(u => (
                <div key={u._id} className="p-4">
                  <div className="flex justify-between items-start gap-2 mb-2">
                    <h4 className="text-xs font-bold uppercase text-vpa-olive dark:text-vpa-sand">{u.fullName}</h4>
                    {u.role === 'master-admin' && <span className="shrink-0 bg-red-600/10 text-red-600 border border-red-600/35 px-2 py-0.5 font-bold font-mono text-[9px] uppercase">Master-Admin</span>}
                    {u.role === 'admin' && <span className="shrink-0 bg-vpa-gold/10 text-vpa-gold border border-vpa-gold/35 px-2 py-0.5 font-bold font-mono text-[9px] uppercase">Admin</span>}
                    {u.role === 'sub-admin' && <span className="shrink-0 bg-blue-600/10 text-blue-600 border border-blue-600/35 px-2 py-0.5 font-bold font-mono text-[9px] uppercase">Sub-Admin</span>}
                    {u.role === 'user' && <span className="shrink-0 bg-green-600/10 text-green-600 border border-green-600/35 px-2 py-0.5 font-bold font-mono text-[9px] uppercase">User</span>}
                  </div>

                  <div className="flex flex-wrap gap-1.5 mb-2">
                    <span className="px-2 py-0.5 bg-vpa-olive-light/10 text-vpa-olive dark:text-vpa-sand text-[9px] font-mono uppercase">{u.rank || 'Chưa cập nhật'}</span>
                    <span className="px-2 py-0.5 bg-vpa-olive-light/10 text-vpa-olive dark:text-vpa-sand text-[9px] font-mono uppercase">{u.position || 'Chưa cập nhật'}</span>
                    {u.unit?.name && (
                      <span className="px-2 py-0.5 bg-vpa-olive-light/10 text-vpa-olive dark:text-vpa-sand text-[9px] font-mono uppercase font-bold">{u.unit.name}</span>
                    )}
                  </div>

                  <p className="text-[10px] font-mono text-gray-500 mb-3">{u.email || u.username}</p>

                  <div className="flex justify-end gap-2 border-t border-vpa-olive-light/10 pt-2.5">
                    <button
                      type="button"
                      onClick={() => handleOpenEditModal(u)}
                      className="p-1.5 border border-vpa-olive-light/50 text-vpa-olive dark:text-vpa-sand hover:bg-vpa-olive hover:text-white dark:hover:bg-vpa-gold dark:hover:text-vpa-dark transition-colors rounded-lg"
                    >
                      <PencilSimple size={14} />
                    </button>
                    {((user?.role === 'master-admin' && u.role !== 'master-admin') ||
                      (user?.role === 'admin' && u.role !== 'admin' && u.role !== 'master-admin') ||
                      (user?.role === 'sub-admin' && u.role === 'user')) && (
                      <button
                        type="button"
                        onClick={() => handleDeleteUser(u._id, u.fullName)}
                        className="p-1.5 border border-vpa-red/30 text-vpa-red hover:bg-vpa-red hover:text-white transition-colors rounded-lg"
                      >
                        <Trash size={14} />
                      </button>
                    )}
                  </div>
                </div>
              ))
            }
          </div>

          {/* Pagination controls */}
          <Pagination
            page={page}
            totalPages={totalPages}
            totalCount={filteredUsers.length}
            pageSize={pageSize}
            onPageChange={setPage}
            itemLabel="quân nhân"
            className="mt-4 p-4 bg-vpa-sand-light dark:bg-vpa-dark-card"
          />
        </div>

      {/* Create / Edit Form Modal */}
      {showFormModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <div className="w-full max-w-lg border border-vpa-olive-light bg-vpa-sand-light dark:bg-vpa-dark-card p-6 shadow-2xl rounded-lg animate-fadeIn max-h-[90vh] overflow-y-auto">
            {/* Header decoration */}
            <div className="flex items-center space-x-2 border-b border-vpa-olive-light pb-3 mb-4">
              <div className="w-3 h-3 bg-vpa-gold dark:bg-vpa-gold-bright rounded-lg" />
              <h3 className="text-sm font-bold tracking-wide uppercase text-vpa-olive dark:text-vpa-sand">
                {isEditing ? 'Cập nhật thông tin quân nhân' : 'Thêm quân nhân mới vào đơn vị'}
              </h3>
            </div>

            <form onSubmit={handleFormSubmit} className="space-y-4">
              {!isEditing && (
                <div>
                  <label className="block text-[9px] uppercase tracking-wider font-semibold text-gray-500 mb-1">Đối tượng</label>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => { setPersonnelType('soldier'); if (!SOLDIER_RANKS.includes(rank)) setRank(SOLDIER_RANKS[0]); }}
                      className={`text-xs p-2 border uppercase tracking-wider font-bold transition-colors ${
                        personnelType === 'soldier'
                          ? 'bg-vpa-olive dark:bg-vpa-gold text-white dark:text-vpa-dark border-transparent'
                          : 'border-vpa-olive-light text-vpa-olive dark:text-vpa-sand hover:bg-vpa-olive-light/10'
                      }`}
                    >
                      Chiến sĩ
                    </button>
                    <button
                      type="button"
                      onClick={() => { setPersonnelType('officer'); if (!OFFICER_RANKS.includes(rank)) setRank(OFFICER_RANKS[0]); }}
                      className={`text-xs p-2 border uppercase tracking-wider font-bold transition-colors ${
                        personnelType === 'officer'
                          ? 'bg-vpa-olive dark:bg-vpa-gold text-white dark:text-vpa-dark border-transparent'
                          : 'border-vpa-olive-light text-vpa-olive dark:text-vpa-sand hover:bg-vpa-olive-light/10'
                      }`}
                    >
                      Cán bộ
                    </button>
                  </div>
                </div>
              )}

              {isEditing ? (
                <div>
                  <label className="block text-[9px] uppercase tracking-wider font-semibold text-gray-500 mb-1">Email / Tên đăng nhập</label>
                  <input
                    type="text"
                    value={email || username}
                    disabled
                    className="w-full text-xs p-2 bg-transparent border border-vpa-olive-light text-vpa-olive dark:text-vpa-sand focus:outline-none disabled:opacity-50 font-mono"
                  />
                </div>
              ) : personnelType === 'soldier' ? (
                <div>
                  <label className="block text-[9px] uppercase tracking-wider font-semibold text-gray-500 mb-1">Tên đăng nhập (Bắt buộc)</label>
                  <input
                    type="text"
                    value={username}
                    onChange={e => setUsername(e.target.value)}
                    required
                    className="w-full text-xs p-2 bg-transparent border border-vpa-olive-light text-vpa-olive dark:text-vpa-sand focus:outline-none focus:border-vpa-gold font-mono rounded-lg"
                  />
                </div>
              ) : (
                <div>
                  <label className="block text-[9px] uppercase tracking-wider font-semibold text-gray-500 mb-1">Email / Tài khoản đăng nhập (Bắt buộc)</label>
                  <input
                    type="email"
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                    required
                    className="w-full text-xs p-2 bg-transparent border border-vpa-olive-light text-vpa-olive dark:text-vpa-sand focus:outline-none focus:border-vpa-gold font-mono rounded-lg"
                  />
                </div>
              )}

              {!isEditing && (
                <div>
                  <label className="block text-[9px] uppercase tracking-wider font-semibold text-gray-500 mb-1">Mật khẩu khởi tạo (Bắt buộc)</label>
                  <input
                    type="password"
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    required
                    className="w-full text-xs p-2 bg-transparent border border-vpa-olive-light text-vpa-olive dark:text-vpa-sand focus:outline-none focus:border-vpa-gold rounded-lg"
                  />
                </div>
              )}

              <div>
                <label className="block text-[9px] uppercase tracking-wider font-semibold text-gray-500 mb-1">Họ và tên quân nhân (Bắt buộc)</label>
                <input
                  type="text"
                  value={fullName}
                  onChange={e => setFullName(e.target.value)}
                  required
                  className="w-full text-xs p-2 bg-transparent border border-vpa-olive-light text-vpa-olive dark:text-vpa-sand focus:outline-none focus:border-vpa-gold uppercase rounded-lg"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-[9px] uppercase tracking-wider font-semibold text-gray-500 mb-1">Cấp bậc</label>
                  <Select
                    value={rank}
                    onChange={setRank}
                    className="w-full text-xs p-2 bg-transparent border border-vpa-olive-light text-vpa-olive dark:text-vpa-sand focus:outline-none focus:border-vpa-gold font-mono rounded-lg flex items-center justify-between gap-2"
                  >
                    {(personnelType === 'soldier' ? SOLDIER_RANKS : OFFICER_RANKS).map(rk => (
                      <option key={rk} value={rk}>{rk}</option>
                    ))}
                  </Select>
                </div>

                <div>
                  <label className="block text-[9px] uppercase tracking-wider font-semibold text-gray-500 mb-1">Chức vụ</label>
                  <Select
                    value={position}
                    onChange={setPosition}
                    className="w-full text-xs p-2 bg-transparent border border-vpa-olive-light text-vpa-olive dark:text-vpa-sand focus:outline-none focus:border-vpa-gold font-mono rounded-lg flex items-center justify-between gap-2"
                  >
                    {positionOptionsForForm.map(ps => (
                      <option key={ps} value={ps}>{ps}</option>
                    ))}
                  </Select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-[9px] uppercase tracking-wider font-semibold text-gray-500 mb-1">Đơn vị (Khóa theo Đơn vị Chỉ huy)</label>
                  <UnitTreeSelect
                    units={assignableUnits}
                    value={unitId}
                    onChange={setUnitId}
                  />
                </div>

                <div>
                  <label className="block text-[9px] uppercase tracking-wider font-semibold text-gray-500 mb-1">Quyền truy cập hệ thống</label>
                  <Select
                    value={role}
                    onChange={setRole}
                    className="w-full text-xs p-2 bg-transparent border border-vpa-olive-light text-vpa-olive dark:text-vpa-sand focus:outline-none focus:border-vpa-gold font-mono rounded-lg flex items-center justify-between gap-2"
                  >
                    {getAvailableRoles().map(rl => (
                      <option key={rl.value} value={rl.value}>{rl.label}</option>
                    ))}
                  </Select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-[9px] uppercase tracking-wider font-semibold text-gray-500 mb-1">Ngày sinh</label>
                  <DatePicker
                    value={dateOfBirth}
                    onChange={setDateOfBirth}
                    className="w-full text-xs p-2 pr-9 bg-transparent border border-vpa-olive-light text-vpa-olive dark:text-vpa-sand focus:outline-none focus:border-vpa-gold font-mono text-left rounded-lg"
                  />
                </div>

                <div>
                  <label className="block text-[9px] uppercase tracking-wider font-semibold text-gray-500 mb-1">Quê quán</label>
                  <input
                    type="text"
                    value={address}
                    onChange={e => setAddress(e.target.value)}
                    className="w-full text-xs p-2 bg-transparent border border-vpa-olive-light text-vpa-olive dark:text-vpa-sand focus:outline-none focus:border-vpa-gold rounded-lg"
                  />
                </div>
              </div>

              {error && (
                <p className="text-vpa-red text-[10px] font-bold uppercase tracking-wider bg-vpa-red/10 p-2 border border-vpa-red/20">{error}</p>
              )}

              <div className="flex justify-end space-x-3 border-t border-vpa-olive-light/20 pt-4 mt-6">
                <button
                  type="button"
                  onClick={() => setShowFormModal(false)}
                  className="px-4 py-2 border border-vpa-olive-light text-xs uppercase tracking-wider text-vpa-olive dark:text-vpa-sand hover:bg-vpa-olive hover:text-white dark:hover:bg-vpa-sand dark:hover:text-vpa-dark transition-colors rounded-lg"
                >
                  Hủy bỏ
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 text-xs uppercase tracking-wider text-white bg-vpa-olive dark:bg-vpa-gold hover:bg-vpa-olive-light dark:hover:bg-vpa-gold-bright transition-colors rounded-lg font-bold"
                >
                  Xác nhận lưu
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      </>
      )}

      {activeTab === 'units' && (
        <div className="border border-vpa-olive-light/50 bg-vpa-sand-light dark:bg-vpa-dark-card shadow-md rounded-lg p-6">
          <div className="flex items-center justify-between gap-3 mb-6 pb-6 border-b border-vpa-olive-light/20">
            {/* <p className="text-[10px] text-gray-400 uppercase tracking-wider">Bấm vào một đơn vị để xem các đơn vị trực thuộc</p> */}
            <button
              type="button"
              onClick={handleOpenAddUnitModal}
              className="px-4 py-2 bg-vpa-olive dark:bg-vpa-gold text-white dark:text-vpa-dark text-xs font-bold uppercase tracking-wider flex items-center space-x-2 hover:bg-vpa-olive-light dark:hover:bg-vpa-gold-bright transition-colors whitespace-nowrap"
            >
              <Plus size={14} />
              <span>Thêm đơn vị</span>
            </button>
          </div>

          {selectedUnitIds.size > 0 && (
            <div className="flex items-center justify-between gap-3 mb-3 px-3 py-2 bg-vpa-gold/10 border border-vpa-gold/40 rounded-lg text-[11px] uppercase tracking-wide text-vpa-olive dark:text-vpa-sand">
              <span>Đã chọn {selectedUnitIds.size} đơn vị — kéo 1 trong số đó vào đơn vị cha mới để di chuyển cả nhóm</span>
              <button
                type="button"
                onClick={() => setSelectedUnitIds(new Set())}
                className="text-vpa-red font-bold shrink-0"
              >
                Bỏ chọn
              </button>
            </div>
          )}

          {unitsLoading ? (
            <p className="text-xs text-gray-400 uppercase tracking-wider">Đang tải cây đơn vị...</p>
          ) : (
            <ul className="space-y-1">
              {rootUnitNodes.map(root => renderUnitNode(root, 0))}
              {assignableUnits.length === 0 && (
                <p className="text-xs text-gray-400 uppercase tracking-wider py-4 text-center">Chưa có đơn vị nào.</p>
              )}
            </ul>
          )}
        </div>
      )}

      {/* Add Unit Modal */}
      {showAddUnitModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-sm">
          <div className="w-full max-w-md border border-vpa-olive-light bg-vpa-sand-light dark:bg-vpa-dark-card p-6 shadow-2xl rounded-lg animate-fadeIn">
            <div className="flex items-center space-x-2 border-b border-vpa-olive-light pb-3 mb-4">
              <div className="w-3 h-3 bg-vpa-gold dark:bg-vpa-gold-bright rounded-lg" />
              <h3 className="text-sm font-bold tracking-wide uppercase text-vpa-olive dark:text-vpa-sand font-mono">
                Thêm đơn vị mới
              </h3>
            </div>

            <form onSubmit={handleCreateUnit} className="space-y-4">
              <div>
                <label className="block text-[9px] uppercase tracking-wider font-semibold text-gray-500 mb-1">Đơn vị</label>
                <Select
                  value={newUnitParentId}
                  onChange={setNewUnitParentId}
                  className="w-full text-xs p-2 bg-transparent border border-vpa-olive-light text-vpa-olive dark:text-vpa-sand focus:outline-none focus:border-vpa-gold font-mono rounded-lg flex items-center justify-between gap-2"
                >
                  {assignableUnits.map(u => (
                    <option key={u._id} value={u._id}>
                      {'—'.repeat(u.level - 1)} {u.name}
                    </option>
                  ))}
                </Select>
              </div>
              <div>
                <label className="block text-[9px] uppercase tracking-wider font-semibold text-gray-500 mb-1">Tên đơn vị mới</label>
                <input
                  autoFocus
                  type="text"
                  value={newUnitName}
                  onChange={e => setNewUnitName(e.target.value)}
                  placeholder="Đại đội Thông tin 3"
                  className="w-full text-xs p-2 bg-transparent border border-vpa-olive-light text-vpa-olive dark:text-vpa-sand focus:outline-none focus:border-vpa-gold font-mono rounded-lg"
                />
              </div>

              {unitError && (
                <p className="text-vpa-red text-[10px] font-bold uppercase tracking-wider bg-vpa-red/10 p-2 border border-vpa-red/20">{unitError}</p>
              )}

              <div className="flex justify-end space-x-3 border-t border-vpa-olive-light/20 pt-4 mt-2">
                <button
                  type="button"
                  onClick={() => setShowAddUnitModal(false)}
                  className="px-4 py-2 border border-vpa-olive-light text-xs uppercase tracking-wider text-vpa-olive dark:text-vpa-sand hover:bg-vpa-olive hover:text-white dark:hover:bg-vpa-sand dark:hover:text-vpa-dark transition-colors rounded-lg"
                >
                  Hủy bỏ
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 text-xs uppercase tracking-wider text-white bg-vpa-olive dark:bg-vpa-gold hover:bg-vpa-olive-light dark:hover:bg-vpa-gold-bright transition-colors rounded-lg font-bold"
                >
                  Thêm đơn vị
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Move Unit Modal */}
      {movingUnit && (() => {
        const targetOptions = getMoveTargetOptions(movingUnit);
        return (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-sm">
            <div className="w-full max-w-md border border-vpa-olive-light bg-vpa-sand-light dark:bg-vpa-dark-card p-6 shadow-2xl rounded-lg animate-fadeIn">
              <div className="flex items-center space-x-2 border-b border-vpa-olive-light pb-3 mb-4">
                <div className="w-3 h-3 bg-vpa-gold dark:bg-vpa-gold-bright rounded-lg" />
                <h3 className="text-sm font-bold tracking-wide uppercase text-vpa-olive dark:text-vpa-sand font-mono">
                  Di chuyển "{movingUnit.name}"
                </h3>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-[9px] uppercase tracking-wider font-semibold text-gray-500 mb-1">Đơn vị cha mới</label>
                  {targetOptions.length === 0 ? (
                    <p className="text-xs text-gray-400">Không còn đơn vị nào hợp lệ để chọn làm cha mới.</p>
                  ) : (
                    <Select
                      value={moveTargetParentId}
                      onChange={setMoveTargetParentId}
                      className="w-full text-xs p-2 bg-transparent border border-vpa-olive-light text-vpa-olive dark:text-vpa-sand focus:outline-none focus:border-vpa-gold font-mono rounded-lg flex items-center justify-between gap-2"
                    >
                      <option value="">— Chọn đơn vị cha mới —</option>
                      {targetOptions.map(u => (
                        <option key={u._id} value={u._id}>
                          {'—'.repeat(u.level - 1)} {u.name}
                        </option>
                      ))}
                    </Select>
                  )}
                </div>

                {moveError && (
                  <p className="text-vpa-red text-[10px] font-bold uppercase tracking-wider bg-vpa-red/10 p-2 border border-vpa-red/20">{moveError}</p>
                )}

                <div className="flex justify-end space-x-3 border-t border-vpa-olive-light/20 pt-4 mt-2">
                  <button
                    type="button"
                    onClick={() => setMovingUnit(null)}
                    className="px-4 py-2 border border-vpa-olive-light text-xs uppercase tracking-wider text-vpa-olive dark:text-vpa-sand hover:bg-vpa-olive hover:text-white dark:hover:bg-vpa-sand dark:hover:text-vpa-dark transition-colors rounded-lg"
                  >
                    Hủy bỏ
                  </button>
                  <button
                    type="button"
                    onClick={handleConfirmMoveUnit}
                    disabled={!moveTargetParentId}
                    className="px-5 py-2 text-xs uppercase tracking-wider text-white bg-vpa-olive dark:bg-vpa-gold hover:bg-vpa-olive-light dark:hover:bg-vpa-gold-bright disabled:opacity-40 disabled:cursor-not-allowed transition-colors rounded-lg font-bold"
                  >
                    Di chuyển
                  </button>
                </div>
              </div>
            </div>
          </div>
        );
      })()}

      {/* Delete Unit Modal */}
      {deletingUnit && (() => {
        const childCount = (unitChildrenMap.get(deletingUnit._id) || []).length;
        return (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-sm">
            <div className="w-full max-w-md border border-vpa-olive-light bg-vpa-sand-light dark:bg-vpa-dark-card p-6 shadow-2xl rounded-lg animate-fadeIn">
              <div className="flex items-center space-x-2 border-b border-vpa-olive-light pb-3 mb-4">
                <div className="w-3 h-3 bg-vpa-red rounded-lg" />
                <h3 className="text-sm font-bold tracking-wide uppercase text-vpa-olive dark:text-vpa-sand font-mono">
                  Xoá "{deletingUnit.name}"
                </h3>
              </div>

              <div className="space-y-4">
                <p className="text-xs text-vpa-olive dark:text-vpa-sand">
                  Đồng chí có chắc chắn muốn xóa đơn vị này? Đơn vị còn quân nhân trực thuộc (kể cả trong cây con) sẽ không xoá được.
                </p>

                {childCount > 0 && (
                  <label className="flex items-center space-x-2 text-[10px] uppercase tracking-wider text-vpa-red cursor-pointer">
                    <input
                      type="checkbox"
                      checked={deleteCascade}
                      onChange={e => { setDeleteCascade(e.target.checked); setDeleteConfirmName(''); setDeleteError(''); }}
                      className="w-3.5 h-3.5 accent-vpa-red"
                    />
                    <span>Xoá luôn {childCount} đơn vị con bên trong</span>
                  </label>
                )}

                {deleteCascade && (
                  <div>
                    <label className="block text-[9px] uppercase tracking-wider font-semibold text-gray-500 mb-1">
                      Gõ đúng tên "{deletingUnit.name}" để xác nhận
                    </label>
                    <input
                      autoFocus
                      type="text"
                      value={deleteConfirmName}
                      onChange={e => setDeleteConfirmName(e.target.value)}
                      className="w-full text-xs p-2 bg-transparent border border-vpa-red text-vpa-olive dark:text-vpa-sand focus:outline-none font-mono rounded-lg"
                    />
                  </div>
                )}

                {deleteError && (
                  <p className="text-vpa-red text-[10px] font-bold uppercase tracking-wider bg-vpa-red/10 p-2 border border-vpa-red/20">{deleteError}</p>
                )}

                <div className="flex justify-end space-x-3 border-t border-vpa-olive-light/20 pt-4 mt-2">
                  <button
                    type="button"
                    onClick={() => setDeletingUnit(null)}
                    className="px-4 py-2 border border-vpa-olive-light text-xs uppercase tracking-wider text-vpa-olive dark:text-vpa-sand hover:bg-vpa-olive hover:text-white dark:hover:bg-vpa-sand dark:hover:text-vpa-dark transition-colors rounded-lg"
                  >
                    Hủy bỏ
                  </button>
                  <button
                    type="button"
                    onClick={handleConfirmDeleteUnit}
                    disabled={deleteCascade && deleteConfirmName.trim() !== deletingUnit.name}
                    className="px-5 py-2 text-xs uppercase tracking-wider text-white bg-vpa-red hover:bg-vpa-red/80 disabled:opacity-40 disabled:cursor-not-allowed transition-colors rounded-lg font-bold"
                  >
                    Xoá đơn vị
                  </button>
                </div>
              </div>
            </div>
          </div>
        );
      })()}

      {/* Manage Positions Modal */}
      {managingPositionsUnit && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-sm">
          <div className="w-full max-w-md border border-vpa-olive-light bg-vpa-sand-light dark:bg-vpa-dark-card p-6 shadow-2xl rounded-lg animate-fadeIn">
            <div className="flex items-center space-x-2 border-b border-vpa-olive-light pb-3 mb-4">
              <div className="w-3 h-3 bg-vpa-gold dark:bg-vpa-gold-bright rounded-lg" />
              <h3 className="text-sm font-bold tracking-wide uppercase text-vpa-olive dark:text-vpa-sand font-mono">
                Chức vụ của "{managingPositionsUnit.name}"
              </h3>
            </div>

            <div className="space-y-4">
              <div className="flex flex-wrap gap-2">
                {positionsDraft.length === 0 && (
                  <p className="text-xs text-gray-400">Chưa có chức vụ nào — form thêm/sửa quân nhân sẽ tạm dùng danh sách dự phòng chung.</p>
                )}
                {positionsDraft.map(pos => (
                  <span
                    key={pos}
                    className="inline-flex items-center gap-1.5 text-[10px] uppercase font-mono px-2.5 py-1 border border-vpa-olive-light text-vpa-olive dark:text-vpa-sand"
                  >
                    {pos}
                    <button
                      type="button"
                      onClick={() => handleRemovePositionDraft(pos)}
                      className="text-vpa-red hover:text-vpa-red/70"
                    >
                      <X size={10} />
                    </button>
                  </span>
                ))}
              </div>

              <div className="flex items-center space-x-2">
                <input
                  type="text"
                  value={newPositionInput}
                  onChange={e => setNewPositionInput(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); handleAddPositionDraft(); } }}
                  placeholder="VD: Trưởng ban"
                  className="flex-1 text-xs p-2 bg-transparent border border-vpa-olive-light text-vpa-olive dark:text-vpa-sand focus:outline-none focus:border-vpa-gold font-mono rounded-lg"
                />
                <button
                  type="button"
                  onClick={handleAddPositionDraft}
                  className="px-3 py-2 border border-vpa-olive-light text-xs uppercase tracking-wider text-vpa-olive dark:text-vpa-sand hover:bg-vpa-olive hover:text-white dark:hover:bg-vpa-gold dark:hover:text-vpa-dark transition-colors rounded-lg"
                >
                  Thêm
                </button>
              </div>

              {positionsSaveError && (
                <p className="text-vpa-red text-[10px] font-bold uppercase tracking-wider bg-vpa-red/10 p-2 border border-vpa-red/20">{positionsSaveError}</p>
              )}

              <div className="flex justify-end space-x-3 border-t border-vpa-olive-light/20 pt-4 mt-2">
                <button
                  type="button"
                  onClick={() => setManagingPositionsUnit(null)}
                  className="px-4 py-2 border border-vpa-olive-light text-xs uppercase tracking-wider text-vpa-olive dark:text-vpa-sand hover:bg-vpa-olive hover:text-white dark:hover:bg-vpa-sand dark:hover:text-vpa-dark transition-colors rounded-lg"
                >
                  Hủy bỏ
                </button>
                <button
                  type="button"
                  onClick={handleSavePositions}
                  className="px-5 py-2 text-xs uppercase tracking-wider text-white bg-vpa-olive dark:bg-vpa-gold hover:bg-vpa-olive-light dark:hover:bg-vpa-gold-bright transition-colors rounded-lg font-bold"
                >
                  Lưu
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Unit Detail Modal */}
      {viewingUnit && (() => {
        const breadcrumb = getUnitBreadcrumb(viewingUnit._id);
        const childCount = (unitChildrenMap.get(viewingUnit._id) || []).length;
        const scopeIds = new Set(
          unitDetailIncludeSubUnits ? getUnitAndDescendantIds(viewingUnit._id) : [viewingUnit._id]
        );
        const unitPersonnel = users.filter(u => u.unit?.id && scopeIds.has(u.unit.id));
        const unitDetailTotalPages = Math.max(1, Math.ceil(unitPersonnel.length / unitDetailPageSize));
        const displayedUnitPersonnel = unitPersonnel.slice(
          (unitDetailPage - 1) * unitDetailPageSize,
          unitDetailPage * unitDetailPageSize
        );

        return (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-sm">
            <div className="w-full max-w-4xl max-h-[90vh] overflow-y-auto border border-vpa-olive-light bg-vpa-sand-light dark:bg-vpa-dark-card p-6 shadow-2xl rounded-lg animate-fadeIn">
              <div className="flex items-start justify-between border-b border-vpa-olive-light pb-4 mb-4">
                <div>
                  <p className="text-[9px] uppercase tracking-wider text-gray-400 font-mono mb-1">
                    {breadcrumb.map((u, i) => (
                      <React.Fragment key={u._id}>
                        {i > 0 && <span className="mx-1">›</span>}
                        <span className={i === breadcrumb.length - 1 ? 'text-vpa-gold font-bold' : ''}>{u.name}</span>
                      </React.Fragment>
                    ))}
                  </p>
                  <h3 className="text-base font-bold tracking-wide uppercase text-vpa-olive dark:text-vpa-sand flex items-center space-x-2">
                    <Buildings size={18} className="text-vpa-gold" />
                    <span>{viewingUnit.name}</span>
                  </h3>
                </div>
                <button
                  type="button"
                  onClick={() => setViewingUnit(null)}
                  className="p-1.5 border border-vpa-olive-light/50 text-vpa-olive dark:text-vpa-sand hover:bg-vpa-olive hover:text-white dark:hover:bg-vpa-gold dark:hover:text-vpa-dark transition-colors rounded-lg"
                >
                  <X size={14} />
                </button>
              </div>

              <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
                <div className="flex items-center gap-3">
                  <span className="text-[10px] uppercase font-mono px-2.5 py-1 border border-vpa-olive-light text-vpa-olive dark:text-vpa-sand">
                    {unitPersonnel.length} quân nhân
                  </span>
                  {childCount > 0 && (
                    <span className="text-[10px] uppercase font-mono px-2.5 py-1 border border-vpa-olive-light text-gray-500">
                      {childCount} đơn vị con
                    </span>
                  )}
                </div>

                {childCount > 0 && (
                  <label className="flex items-center space-x-2 text-[10px] uppercase tracking-wider text-gray-500 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={unitDetailIncludeSubUnits}
                      onChange={e => setUnitDetailIncludeSubUnits(e.target.checked)}
                      className="w-3.5 h-3.5 accent-vpa-gold"
                    />
                    <span>Gồm cả đơn vị con</span>
                  </label>
                )}
              </div>

              <div className="flex justify-end mb-3">
                <button
                  type="button"
                  onClick={() => { const uid = viewingUnit._id; setViewingUnit(null); handleOpenCreateModalForUnit(uid); }}
                  className="px-3 py-1.5 bg-vpa-olive dark:bg-vpa-gold text-white dark:text-vpa-dark text-xs font-bold uppercase tracking-wider flex items-center space-x-2 hover:bg-vpa-olive-light dark:hover:bg-vpa-gold-bright transition-colors"
                >
                  <Plus size={14} />
                  <span>Thêm quân nhân</span>
                </button>
              </div>

              <div className="border border-vpa-olive-light/50 hidden md:block overflow-x-auto">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="border-b border-vpa-olive-light/30 text-gray-500 font-mono uppercase text-[10px]">
                      <th className="py-2.5 px-3 whitespace-nowrap">Họ và tên</th>
                      <th className="py-2.5 px-3 whitespace-nowrap">Cấp bậc</th>
                      <th className="py-2.5 px-3 whitespace-nowrap">Chức vụ</th>
                      {unitDetailIncludeSubUnits && <th className="py-2.5 px-3 whitespace-nowrap">Đơn vị</th>}
                      <th className="py-2.5 px-3 whitespace-nowrap">Quyền hạn</th>
                      <th className="py-2.5 px-3 text-right whitespace-nowrap">Thao tác</th>
                    </tr>
                  </thead>
                  <tbody>
                    {displayedUnitPersonnel.map(u => (
                      <tr key={u._id} className="border-b border-vpa-olive-light/10 hover:bg-vpa-olive-light/5">
                        <td className="py-2.5 px-3 font-bold text-vpa-olive dark:text-vpa-sand uppercase">{u.fullName}</td>
                        <td className="py-2.5 px-3">{u.rank}</td>
                        <td className="py-2.5 px-3">{u.position}</td>
                        {unitDetailIncludeSubUnits && <td className="py-2.5 px-3">{u.unit?.name}</td>}
                        <td className="py-2.5 px-3">
                          {u.role === 'master-admin' && <span className="bg-red-600/10 text-red-600 border border-red-600/35 px-2 py-0.5 font-bold font-mono text-[9px] uppercase">Master-Admin</span>}
                          {u.role === 'admin' && <span className="bg-vpa-gold/10 text-vpa-gold border border-vpa-gold/35 px-2 py-0.5 font-bold font-mono text-[9px] uppercase">Admin</span>}
                          {u.role === 'sub-admin' && <span className="bg-blue-600/10 text-blue-600 border border-blue-600/35 px-2 py-0.5 font-bold font-mono text-[9px] uppercase">Sub-Admin</span>}
                          {u.role === 'user' && <span className="bg-green-600/10 text-green-600 border border-green-600/35 px-2 py-0.5 font-bold font-mono text-[9px] uppercase">User</span>}
                        </td>
                        <td className="py-2.5 px-3 text-right">
                          <div className="flex justify-end space-x-2">
                            <button
                              type="button"
                              onClick={() => { setViewingUnit(null); handleOpenEditModal(u); }}
                              className="p-1.5 border border-vpa-olive-light/50 text-vpa-olive dark:text-vpa-sand hover:bg-vpa-olive hover:text-white dark:hover:bg-vpa-gold dark:hover:text-vpa-dark transition-colors rounded-lg"
                            >
                              <PencilSimple size={12} />
                            </button>
                            {((user?.role === 'master-admin' && u.role !== 'master-admin') ||
                              (user?.role === 'admin' && u.role !== 'admin' && u.role !== 'master-admin') ||
                              (user?.role === 'sub-admin' && u.role === 'user')) && (
                              <button
                                type="button"
                                onClick={() => handleDeleteUser(u._id, u.fullName)}
                                className="p-1.5 border border-vpa-red/30 text-vpa-red hover:bg-vpa-red hover:text-white transition-colors rounded-lg"
                              >
                                <Trash size={12} />
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                    {unitPersonnel.length === 0 && (
                      <tr>
                        <td colSpan={unitDetailIncludeSubUnits ? 6 : 5} className="text-center py-8 text-gray-400 text-xs uppercase tracking-wider">
                          Chưa có quân nhân nào trực thuộc.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>

              {/* Mobile card list */}
              <div className="md:hidden border border-vpa-olive-light/50 divide-y divide-vpa-olive-light/10">
                {displayedUnitPersonnel.map(u => (
                  <div key={u._id} className="p-3">
                    <div className="flex justify-between items-start gap-2 mb-2">
                      <h4 className="text-xs font-bold uppercase text-vpa-olive dark:text-vpa-sand">{u.fullName}</h4>
                      {u.role === 'master-admin' && <span className="shrink-0 bg-red-600/10 text-red-600 border border-red-600/35 px-2 py-0.5 font-bold font-mono text-[9px] uppercase">Master-Admin</span>}
                      {u.role === 'admin' && <span className="shrink-0 bg-vpa-gold/10 text-vpa-gold border border-vpa-gold/35 px-2 py-0.5 font-bold font-mono text-[9px] uppercase">Admin</span>}
                      {u.role === 'sub-admin' && <span className="shrink-0 bg-blue-600/10 text-blue-600 border border-blue-600/35 px-2 py-0.5 font-bold font-mono text-[9px] uppercase">Sub-Admin</span>}
                      {u.role === 'user' && <span className="shrink-0 bg-green-600/10 text-green-600 border border-green-600/35 px-2 py-0.5 font-bold font-mono text-[9px] uppercase">User</span>}
                    </div>

                    <div className="flex flex-wrap gap-1.5 mb-2.5">
                      <span className="px-2 py-0.5 bg-vpa-olive-light/10 text-vpa-olive dark:text-vpa-sand text-[9px] font-mono uppercase">{u.rank || 'Chưa cập nhật'}</span>
                      <span className="px-2 py-0.5 bg-vpa-olive-light/10 text-vpa-olive dark:text-vpa-sand text-[9px] font-mono uppercase">{u.position || 'Chưa cập nhật'}</span>
                      {unitDetailIncludeSubUnits && u.unit?.name && (
                        <span className="px-2 py-0.5 bg-vpa-olive-light/10 text-vpa-olive dark:text-vpa-sand text-[9px] font-mono uppercase font-bold">{u.unit.name}</span>
                      )}
                    </div>

                    <div className="flex justify-end gap-2 border-t border-vpa-olive-light/10 pt-2">
                      <button
                        type="button"
                        onClick={() => { setViewingUnit(null); handleOpenEditModal(u); }}
                        className="p-1.5 border border-vpa-olive-light/50 text-vpa-olive dark:text-vpa-sand hover:bg-vpa-olive hover:text-white dark:hover:bg-vpa-gold dark:hover:text-vpa-dark transition-colors rounded-lg"
                      >
                        <PencilSimple size={12} />
                      </button>
                      {((user?.role === 'master-admin' && u.role !== 'master-admin') ||
                        (user?.role === 'admin' && u.role !== 'admin' && u.role !== 'master-admin') ||
                        (user?.role === 'sub-admin' && u.role === 'user')) && (
                        <button
                          type="button"
                          onClick={() => handleDeleteUser(u._id, u.fullName)}
                          className="p-1.5 border border-vpa-red/30 text-vpa-red hover:bg-vpa-red hover:text-white transition-colors rounded-lg"
                        >
                          <Trash size={12} />
                        </button>
                      )}
                    </div>
                  </div>
                ))}
                {unitPersonnel.length === 0 && (
                  <div className="text-center py-8 text-gray-400 text-xs uppercase tracking-wider">
                    Chưa có quân nhân nào trực thuộc.
                  </div>
                )}
              </div>

              <Pagination
                page={unitDetailPage}
                totalPages={unitDetailTotalPages}
                totalCount={unitPersonnel.length}
                pageSize={unitDetailPageSize}
                onPageChange={setUnitDetailPage}
                itemLabel="quân nhân"
                className="mt-4"
              />
            </div>
          </div>
        );
      })()}
    </div>
  );
};

export default UserManagement;
