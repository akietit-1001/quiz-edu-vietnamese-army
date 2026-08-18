import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { ArrowLeft, Trash, PencilSimple, UserPlus, MagnifyingGlass, ShieldCheck, Buildings, Plus, Funnel, CaretRight, Eye, X } from '@phosphor-icons/react';
import { UnitTreeSelect, type UnitNode } from '../components/UnitTreeSelect';
import { useSubviewBack } from '../hooks/useSubviewBack';
import { DatePicker } from '../components/DatePicker';
import { Select } from '../components/Select';

interface UserManagementProps {
  user: any;
  onNavigateBack: () => void;
}

const RANKS = ['Binh nhì', 'Binh nhất', 'Hạ sĩ', 'Trung sĩ', 'Thượng sĩ', 'Thiếu úy', 'Trung úy', 'Thượng úy', 'Đại úy', 'Thiếu tá', 'Trung tá', 'Thượng tá', 'Đại tá', 'Thiếu tướng', 'Trung tướng', 'Thượng tướng', 'Đại tướng'];
const POSITIONS = ['Chiến sĩ', 'Tiểu đội trưởng', 'Trung đội phó', 'Trung đội trưởng', 'Đại đội phó', 'Đại đội trưởng', 'Tiểu đoàn phó', 'Tiểu đoàn trưởng', 'Chính trị viên', 'Học viên', 'Giảng viên', 'Khác'];

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
        .sort((a, b) => a.name.localeCompare(b.name))
        .forEach(child => collect(child._id));
    };

    if (user?.role === 'master-admin') {
      units
        .filter(u => !u.parentId)
        .sort((a, b) => a.name.localeCompare(b.name))
        .forEach(root => collect(root._id));
      return result;
    }

    const ownUnitId = user?.unit?.id;
    if (!ownUnitId) return [];
    collect(ownUnitId);
    return result;
  }, [units, user]);

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

    return (
      <React.Fragment key={nodeUnit._id}>
        <li
          style={{ marginLeft: `${depth * 24}px` }}
          className="flex items-center justify-between py-2 px-3 border-b border-vpa-olive-light/10 text-xs"
        >
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
              className={`flex items-center space-x-2 text-left ${hasChildren ? 'cursor-pointer' : 'cursor-default'}`}
            >
              <CaretRight
                size={10}
                weight="bold"
                className={`text-gray-400 transition-transform shrink-0 ${hasChildren ? '' : 'opacity-0'} ${isExpanded ? 'rotate-90' : ''}`}
              />
              <Buildings size={12} className="text-vpa-gold shrink-0" />
              <span className="font-bold text-vpa-olive dark:text-vpa-sand uppercase">{nodeUnit.name}</span>
            </button>
          )}

          {renamingUnitId !== nodeUnit._id && (
            <div className="flex items-center space-x-2">
              <button
                type="button"
                onClick={() => handleViewUnit(nodeUnit)}
                className="p-1.5 border border-vpa-olive-light/50 text-vpa-olive dark:text-vpa-sand hover:bg-vpa-olive hover:text-white dark:hover:bg-vpa-gold dark:hover:text-vpa-dark transition-colors rounded-lg"
              >
                <Eye size={12} />
              </button>
              <button
                type="button"
                onClick={() => handleStartRenameUnit(nodeUnit)}
                className="p-1.5 border border-vpa-olive-light/50 text-vpa-olive dark:text-vpa-sand hover:bg-vpa-olive hover:text-white dark:hover:bg-vpa-gold dark:hover:text-vpa-dark transition-colors rounded-lg"
              >
                <PencilSimple size={12} />
              </button>
              <button
                type="button"
                onClick={() => handleDeleteUnit(nodeUnit)}
                className="p-1.5 border border-vpa-red/30 text-vpa-red hover:bg-vpa-red hover:text-white transition-colors rounded-lg"
              >
                <Trash size={12} />
              </button>
            </div>
          )}
        </li>
        {hasChildren && isExpanded && children.map(child => renderUnitNode(child, depth + 1))}
      </React.Fragment>
    );
  };

  const fetchUnits = async () => {
    try {
      setUnitsLoading(true);
      const res = await axios.get('/api/units');
      setUnits(res.data);
    } catch (err: any) {
      setUnitError('Không thể tải cây đơn vị.');
    } finally {
      setUnitsLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers();
    fetchUnits();
  }, []);

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
    setRank('Binh nhì');
    setPosition('Chiến sĩ');
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

  const handleDeleteUnit = async (unitToDelete: UnitNode) => {
    const confirmDelete = await window.showConfirm(`Đồng chí có chắc chắn muốn xóa đơn vị "${unitToDelete.name}"?`, 'Xác nhận xóa đơn vị');
    if (!confirmDelete) return;
    try {
      await axios.delete(`/api/units/${unitToDelete._id}`);
      setUnitSuccessMsg('Đã xóa đơn vị thành công.');
      fetchUnits();
      setTimeout(() => setUnitSuccessMsg(''), 3000);
    } catch (err: any) {
      setUnitError(err.response?.data?.message || 'Không thể xóa đơn vị (có thể còn đơn vị con hoặc quân nhân trực thuộc).');
      setTimeout(() => setUnitError(''), 3000);
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

  return (
    <div className="max-w-7xl mx-auto px-6 py-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-8 pb-4 border-b border-vpa-olive-light/30">
        <div className="flex items-center space-x-4">
          <button
            onClick={() => {
              if (showFormModal) { setShowFormModal(false); return; }
              if (showAddUnitModal) { setShowAddUnitModal(false); return; }
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
        <div className="p-4 grid grid-cols-1 md:grid-cols-3 gap-4 items-center">
          <div className="relative">
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
            className={`flex items-center space-x-1.5 px-2.5 py-2 border text-xs font-bold uppercase tracking-wider transition-colors justify-center ${
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
                  {POSITIONS.map(ps => (
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
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="border-b border-vpa-olive-light/30 text-gray-500 font-mono uppercase text-[10px]">
                <th className="py-3 px-4 cursor-pointer hover:text-vpa-gold transition-colors select-none whitespace-nowrap" onClick={() => handleUserSort('fullName')}>
                  Họ và tên {renderSortIndicator('fullName')}
                </th>
                <th className="py-3 px-4 cursor-pointer hover:text-vpa-gold transition-colors select-none whitespace-nowrap" onClick={() => handleUserSort('rank')}>
                  Cấp bậc {renderSortIndicator('rank')}
                </th>
                <th className="py-3 px-4 cursor-pointer hover:text-vpa-gold transition-colors select-none whitespace-nowrap" onClick={() => handleUserSort('position')}>
                  Chức vụ {renderSortIndicator('position')}
                </th>
                <th className="py-3 px-4 cursor-pointer hover:text-vpa-gold transition-colors select-none whitespace-nowrap" onClick={() => handleUserSort('unit')}>
                  Đơn vị {renderSortIndicator('unit')}
                </th>
                <th className="py-3 px-4 cursor-pointer hover:text-vpa-gold transition-colors select-none whitespace-nowrap" onClick={() => handleUserSort('email')}>
                  Email / Tên đăng nhập {renderSortIndicator('email')}
                </th>
                <th className="py-3 px-4 cursor-pointer hover:text-vpa-gold transition-colors select-none whitespace-nowrap" onClick={() => handleUserSort('role')}>
                  Quyền hạn {renderSortIndicator('role')}
                </th>
                <th className="py-3 px-4 text-right">Thao tác</th>
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

          {/* Pagination controls */}
          {totalPages > 1 && (
            <div className="flex flex-col sm:flex-row justify-between items-center mt-4 pt-4 border-t border-vpa-olive-light/20 text-xs font-mono gap-3 p-4 bg-vpa-sand-light dark:bg-vpa-dark-card border-t border-vpa-olive-light/10">
              <span className="text-gray-500 text-center sm:text-left">
                Hiển thị {startIndex + 1} - {Math.min(startIndex + pageSize, filteredUsers.length)} trong tổng số {filteredUsers.length} quân nhân
              </span>
              <div className="flex items-center space-x-1.5">
                <button
                  type="button"
                  disabled={page === 1}
                  onClick={() => setPage(prev => Math.max(prev - 1, 1))}
                  className="px-2.5 py-1 border border-vpa-olive-light/30 text-vpa-olive dark:text-vpa-sand disabled:opacity-45 disabled:cursor-not-allowed hover:bg-vpa-olive-light/10 font-bold"
                >
                  Trước
                </button>
                {Array.from({ length: totalPages }).map((_, i) => {
                  const p = i + 1;
                  if (
                    totalPages > 6 &&
                    p !== 1 &&
                    p !== totalPages &&
                    Math.abs(p - page) > 1
                  ) {
                    if (p === 2 && page > 3) return <span key={p} className="px-1 text-gray-400 select-none">...</span>;
                    if (p === totalPages - 1 && page < totalPages - 2) return <span key={p} className="px-1 text-gray-400 select-none">...</span>;
                    return null;
                  }
                  return (
                    <button
                      key={p}
                      type="button"
                      onClick={() => setPage(p)}
                      className={`w-7 h-7 flex items-center justify-center border transition-all ${
                        page === p
                          ? 'bg-vpa-olive text-white border-transparent dark:bg-vpa-gold dark:text-vpa-dark font-black shadow-sm'
                          : 'border-vpa-olive-light/30 text-vpa-olive dark:text-vpa-sand hover:bg-vpa-olive-light/10'
                      }`}
                    >
                      {p}
                    </button>
                  );
                })}
                <button
                  type="button"
                  disabled={page === totalPages}
                  onClick={() => setPage(prev => Math.min(prev + 1, totalPages))}
                  className="px-2.5 py-1 border border-vpa-olive-light/30 text-vpa-olive dark:text-vpa-sand disabled:opacity-45 disabled:cursor-not-allowed hover:bg-vpa-olive-light/10 font-bold"
                >
                  Sau
                </button>
              </div>
            </div>
          )}
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
                      onClick={() => setPersonnelType('soldier')}
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
                      onClick={() => setPersonnelType('officer')}
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
                    {RANKS.map(rk => (
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
                    {POSITIONS.map(ps => (
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
            <p className="text-[10px] text-gray-400 uppercase tracking-wider">Bấm vào một đơn vị để xem các đơn vị trực thuộc</p>
            <button
              type="button"
              onClick={handleOpenAddUnitModal}
              className="px-4 py-2 bg-vpa-olive dark:bg-vpa-gold text-white dark:text-vpa-dark text-xs font-bold uppercase tracking-wider flex items-center space-x-2 hover:bg-vpa-olive-light dark:hover:bg-vpa-gold-bright transition-colors whitespace-nowrap"
            >
              <Plus size={14} />
              <span>Thêm đơn vị</span>
            </button>
          </div>

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

      {/* Unit Detail Modal */}
      {viewingUnit && (() => {
        const breadcrumb = getUnitBreadcrumb(viewingUnit._id);
        const childCount = (unitChildrenMap.get(viewingUnit._id) || []).length;
        const scopeIds = new Set(
          unitDetailIncludeSubUnits ? getUnitAndDescendantIds(viewingUnit._id) : [viewingUnit._id]
        );
        const unitPersonnel = users.filter(u => u.unit?.id && scopeIds.has(u.unit.id));

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

              <div className="border border-vpa-olive-light/50 overflow-x-auto">
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
                    {unitPersonnel.map(u => (
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
            </div>
          </div>
        );
      })()}
    </div>
  );
};

export default UserManagement;
