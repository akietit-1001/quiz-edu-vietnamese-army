import React, { useEffect, useState } from 'react';
import axios from 'axios';
import {
  ArrowLeft,
  MagnifyingGlass,
  Printer,
  Trash,
  Plus,
  FileArrowDown,
  Camera,
  Check,
  X
} from '../icons';
import { Pagination } from '../components/Pagination';
import { Tooltip } from '../components/Tooltip';
import { OmrPrintModal } from '../components/OmrPrintModal';
import { VPAExportPopup } from '../components/VPAExportPopup';

interface OmrManagementProps {
  user: any;
  onNavigateBack: () => void;
  onOpenOmrGrading: (roomId?: string, quizId?: string, sessionCode?: string) => void;
}

export const OmrManagement: React.FC<OmrManagementProps> = ({
  user,
  onNavigateBack,
  onOpenOmrGrading
}) => {
  const [exams, setExams] = useState<any[]>([]);
  const [summary, setSummary] = useState<any>({
    totalExams: 0,
    activeExams: 0,
    totalScanned: 0,
    overallAvgScore: 0,
    overallPassRate: 0
  });
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'active' | 'archived'>('ALL');
  const [page, setPage] = useState(1);
  const pageSize = 10;

  // Modals
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [selectedExamForPrint, setSelectedExamForPrint] = useState<any | null>(null);
  const [selectedExamForExport, setSelectedExamForExport] = useState<any | null>(null);

  // Form tạo phiếu mới
  const [quizzesList, setQuizzesList] = useState<any[]>([]);
  const [selectedQuizId, setSelectedQuizId] = useState('');
  const [examTitle, setExamTitle] = useState('');
  const [upperUnit, setUpperUnit] = useState('BỘ QUỐC PHÒNG');
  const [currentUnit, setCurrentUnit] = useState(user?.unit?.name || 'ĐƠN VỊ TỔ CHỨC THI');
  const [province, setProvince] = useState('Đồng Tháp');
  const [examCodesInput, setExamCodesInput] = useState('101, 102, 103, 104');
  const [description, setDescription] = useState('');
  const [createLoading, setCreateLoading] = useState(false);
  const [createError, setCreateError] = useState<any | null>(null);

  // 1. Tải danh sách phiếu OMR
  const fetchOmrExams = async () => {
    setLoading(true);
    try {
      const res = await axios.get('/api/omr/exams', {
        params: {
          search: searchTerm,
          status: statusFilter !== 'ALL' ? statusFilter : '',
          page,
          limit: pageSize
        }
      });
      setExams(res.data.exams || []);
      if (res.data.summary) {
        setSummary(res.data.summary);
      }
    } catch (err) {
      console.error('Lỗi tải danh sách phiếu OMR:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchOmrExams();
  }, [searchTerm, statusFilter, page]);

  // 2. Tải danh sách đề thi gốc khi mở modal tạo phiếu
  const fetchQuizzes = async () => {
    try {
      const res = await axios.get('/api/quizzes');
      const list = Array.isArray(res.data) ? res.data : (res.data.quizzes || []);
      setQuizzesList(list);
      if (list.length > 0 && !selectedQuizId) {
        setSelectedQuizId(list[0]._id);
        setExamTitle(`Phiếu kiểm tra: ${list[0].title}`);
      }
    } catch (err) {
      console.error('Lỗi tải đề thi:', err);
    }
  };

  const handleOpenCreateModal = () => {
    setCreateError(null);
    setShowCreateModal(true);
    fetchQuizzes();
  };

  // Tự động cập nhật tiêu đề khi đổi đề thi
  const handleSelectQuiz = (qId: string) => {
    setSelectedQuizId(qId);
    const found = quizzesList.find(q => q._id === qId);
    if (found) {
      setExamTitle(`Phiếu kiểm tra: ${found.title}`);
    }
  };

  // 3. Xử lý tạo mới Phiếu kiểm tra OMR (Kiểm tra ràng buộc chống trùng)
  const handleCreateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedQuizId) {
      await window.showAlert?.('Vui lòng chọn một đề thi để tạo phiếu làm bài.', 'Thông báo');
      return;
    }

    setCreateLoading(true);
    setCreateError(null);

    try {
      const parsedCodes = examCodesInput
        .split(',')
        .map(c => c.trim())
        .filter(Boolean);

      const res = await axios.post('/api/omr/exams', {
        quizId: selectedQuizId,
        title: examTitle,
        upperUnit,
        currentUnit,
        province,
        examCodes: parsedCodes.length > 0 ? parsedCodes : ['101'],
        description
      });

      setShowCreateModal(false);
      await window.showAlert?.(res.data.message || 'Tạo phiếu kiểm tra OMR thành công!', 'Thành công');
      fetchOmrExams();

      // Mở modal in phiếu ngay cho người dùng
      if (res.data.exam) {
        setSelectedExamForPrint(res.data.exam);
      }
    } catch (err: any) {
      const data = err.response?.data;
      if (data?.conflict && data?.existingExam) {
        setCreateError(data);
      } else {
        await window.showAlert?.(data?.message || 'Không thể tạo phiếu kiểm tra OMR.', 'Lỗi');
      }
    } finally {
      setCreateLoading(false);
    }
  };

  // 4. Xóa phiếu OMR
  const handleDeleteExam = async (exam: any) => {
    const confirm = await window.showConfirm?.(
      `Đồng chí có chắc chắn muốn XÓA phiếu làm bài "${exam.code}" (${exam.title}) không?\n\nCẢNH BÁO: Toàn bộ dữ liệu điểm số và bài thi đã quét (${exam.attemptCount || 0} bài) liên kết với phiếu này cũng sẽ bị xóa vĩnh viễn. Sau khi xóa, đồng chí có thể tạo phiếu mới cho đề thi này nếu cần.`,
      'XÁC NHẬN XÓA PHIẾU OMR'
    );
    if (!confirm) return;

    try {
      const res = await axios.delete(`/api/omr/exams/${exam._id}`);
      await window.showAlert?.(res.data.message || 'Đã xóa phiếu làm bài thành công.', 'Thông báo');
      fetchOmrExams();
    } catch (err: any) {
      await window.showAlert?.(err.response?.data?.message || 'Lỗi khi xóa phiếu kiểm tra.', 'Lỗi');
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8">
      {/* Header Navigation */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8 pb-4 border-b border-vpa-olive-light/30">
        <div className="flex items-center space-x-4">
          <button
            onClick={onNavigateBack}
            className="p-2 border border-vpa-olive-light/30 hover:bg-vpa-olive-light/10 text-vpa-olive dark:text-vpa-sand transition-colors rounded-lg"
            title="Quay lại"
          >
            <ArrowLeft size={18} />
          </button>
          <div>
            <h1 className="text-lg md:text-xl font-black uppercase tracking-wider text-vpa-olive dark:text-vpa-sand flex items-center space-x-2">
              <span className="w-3 h-3 bg-vpa-gold rounded-sm inline-block" />
              <span>Quản lý Phiếu kiểm tra OMR (Thi Offline)</span>
            </h1>
            <p className="text-[11px] text-gray-500 uppercase tracking-widest font-mono mt-0.5">
              Tổ chức thi trên giấy • In phiếu A4 máy quét • Chấm tự động qua Camera • Xuất bảng điểm
            </p>
          </div>
        </div>

        {/* Top Action Buttons */}
        <div className="flex items-center space-x-3 flex-wrap gap-y-2">
          <button
            onClick={() => onOpenOmrGrading()}
            className="px-4 py-2 bg-gradient-to-r from-emerald-800 to-vpa-olive text-white border border-emerald-600 font-bold uppercase tracking-wider text-xs rounded-lg shadow hover:opacity-95 transition-all flex items-center space-x-2"
          >
            <Camera size={16} weight="bold" />
            <span>Bàn Chấm OMR Chung</span>
          </button>

          <button
            onClick={handleOpenCreateModal}
            className="px-4 py-2 bg-vpa-olive dark:bg-vpa-gold text-white dark:text-vpa-dark font-extrabold uppercase tracking-wider text-xs rounded-lg shadow-md hover:bg-vpa-olive-light dark:hover:bg-vpa-gold-bright transition-all flex items-center space-x-2"
          >
            <Plus size={16} weight="bold" />
            <span>Tạo Phiếu Kiểm Tra Mới</span>
          </button>
        </div>
      </div>

      {/* Metric Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <div className="border border-vpa-olive-light/50 bg-vpa-sand-light dark:bg-vpa-dark-card p-4 rounded-lg shadow-sm">
          <span className="text-[10px] uppercase tracking-wider text-gray-500 font-mono block">Tổng số phiếu OMR</span>
          <div className="text-2xl font-black text-vpa-olive dark:text-vpa-gold mt-1 font-mono">
            {summary.totalExams || 0}
          </div>
          <span className="text-[10px] text-green-600 font-bold">Đang hoạt động: {summary.activeExams || 0}</span>
        </div>

        <div className="border border-vpa-olive-light/50 bg-vpa-sand-light dark:bg-vpa-dark-card p-4 rounded-lg shadow-sm">
          <span className="text-[10px] uppercase tracking-wider text-gray-500 font-mono block">Tổng số bài đã chấm</span>
          <div className="text-2xl font-black text-vpa-olive dark:text-vpa-sand mt-1 font-mono">
            {summary.totalScanned || 0}
          </div>
          <span className="text-[10px] text-gray-400 font-mono">Tự động bằng camera</span>
        </div>

        <div className="border border-vpa-olive-light/50 bg-vpa-sand-light dark:bg-vpa-dark-card p-4 rounded-lg shadow-sm">
          <span className="text-[10px] uppercase tracking-wider text-gray-500 font-mono block">Điểm trung bình toàn quân</span>
          <div className="text-2xl font-black text-yellow-600 dark:text-yellow-400 mt-1 font-mono">
            {summary.overallAvgScore || 0}
          </div>
          <span className="text-[10px] text-gray-400 font-mono">Thang điểm 40/60 câu</span>
        </div>

        <div className="border border-vpa-olive-light/50 bg-vpa-sand-light dark:bg-vpa-dark-card p-4 rounded-lg shadow-sm">
          <span className="text-[10px] uppercase tracking-wider text-gray-500 font-mono block">Tỷ lệ Đạt toàn quân</span>
          <div className="text-2xl font-black text-green-600 dark:text-green-400 mt-1 font-mono">
            {summary.overallPassRate || 0}%
          </div>
          <span className="text-[10px] text-green-600 font-bold">Đạt tiêu chuẩn huấn luyện</span>
        </div>
      </div>

      {/* Filter / Search Bar */}
      <div className="border border-vpa-olive-light/50 bg-vpa-sand-light dark:bg-vpa-dark-card mb-6 shadow-sm rounded-lg overflow-hidden">
        <div className="p-4 flex flex-col md:flex-row md:items-center gap-3">
          <div className="relative flex-1">
            <input
              type="text"
              placeholder="Tìm theo mã phiếu (OMR-...), tên đợt thi, tên đề thi hoặc đơn vị..."
              value={searchTerm}
              onChange={e => {
                setSearchTerm(e.target.value);
                setPage(1);
              }}
              className="w-full text-xs p-2.5 pl-9 bg-transparent border border-vpa-olive-light text-vpa-olive dark:text-vpa-sand focus:outline-none focus:border-vpa-gold font-mono rounded-lg"
            />
            <MagnifyingGlass size={16} className="absolute left-3 top-3 text-gray-400" />
          </div>

          <div className="flex items-center space-x-2">
            <span className="text-[10px] uppercase tracking-wider font-bold text-gray-500 font-mono">Trạng thái:</span>
            {(['ALL', 'active', 'archived'] as const).map(st => (
              <button
                key={st}
                onClick={() => {
                  setStatusFilter(st);
                  setPage(1);
                }}
                className={`px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider rounded-lg border transition-colors ${
                  statusFilter === st
                    ? 'bg-vpa-olive text-white border-vpa-olive dark:bg-vpa-gold dark:text-vpa-dark'
                    : 'border-vpa-olive-light/40 text-vpa-olive dark:text-vpa-sand hover:bg-vpa-olive-light/10'
                }`}
              >
                {st === 'ALL' ? 'Tất cả' : st === 'active' ? 'Đang hoạt động' : 'Đã lưu trữ'}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* OMR Exams Table */}
      <div className="border border-vpa-olive-light/50 bg-vpa-sand-light dark:bg-vpa-dark-card shadow-md rounded-lg overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="border-b border-vpa-olive-light/30 text-gray-500 font-mono uppercase text-[10px] bg-vpa-olive/5 dark:bg-vpa-gold/5">
                <th className="py-3 px-4 whitespace-nowrap">Mã phiếu</th>
                <th className="py-3 px-4">Tên đợt thi & Đề thi gốc</th>
                <th className="py-3 px-4 whitespace-nowrap">Đơn vị tổ chức</th>
                <th className="py-3 px-4 whitespace-nowrap">Mã đề / Số câu</th>
                <th className="py-3 px-4 whitespace-nowrap">Tiến độ chấm</th>
                <th className="py-3 px-4 whitespace-nowrap">Ngày tạo</th>
                <th className="py-3 px-4 whitespace-nowrap text-right">Hành động</th>
              </tr>
            </thead>
            <tbody>
              {loading && (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-gray-400 font-mono text-xs">
                    <div className="w-6 h-6 border-2 border-vpa-olive dark:border-vpa-gold border-t-transparent rounded-full animate-spin mx-auto mb-2" />
                    Đang tải danh sách phiếu kiểm tra OMR...
                  </td>
                </tr>
              )}

              {!loading && exams.map(exam => (
                <tr
                  key={exam._id}
                  className="border-b border-vpa-olive-light/10 hover:bg-vpa-olive-light/5 dark:hover:bg-vpa-gold/5 transition-colors align-top"
                >
                  {/* Mã phiếu */}
                  <td className="py-3 px-4 whitespace-nowrap">
                    <span className="text-xs font-mono font-bold tracking-wider text-white bg-vpa-olive dark:bg-vpa-gold dark:text-vpa-dark px-2.5 py-1 rounded">
                      {exam.code}
                    </span>
                    <div className="text-[9px] text-gray-500 font-mono mt-1">
                      {exam.status === 'active' ? (
                        <span className="text-green-600 font-bold">● Đang dùng</span>
                      ) : (
                        <span className="text-gray-400">● Lưu trữ</span>
                      )}
                    </div>
                  </td>

                  {/* Tên đợt thi & Đề thi */}
                  <td className="py-3 px-4 max-w-xs">
                    <span className="font-bold text-vpa-olive dark:text-vpa-sand text-xs block leading-tight mb-0.5">
                      {exam.title}
                    </span>
                    <Tooltip content={exam.quizId?.title || 'Đề thi trắc nghiệm'} className="block">
                      <span className="text-[11px] text-gray-500 dark:text-gray-400 font-mono truncate block">
                        Đề gốc: <span className="font-semibold text-gray-700 dark:text-gray-300">{exam.quizId?.title || '---'}</span>
                      </span>
                    </Tooltip>
                  </td>

                  {/* Đơn vị */}
                  <td className="py-3 px-4 whitespace-nowrap text-gray-600 dark:text-gray-300 font-mono text-[11px]">
                    <div className="font-bold text-vpa-olive dark:text-vpa-gold">{exam.currentUnit || '---'}</div>
                    <div className="text-[9px] text-gray-400">{exam.upperUnit || 'BỘ QUỐC PHÒNG'}</div>
                  </td>

                  {/* Mã đề / Số câu */}
                  <td className="py-3 px-4 whitespace-nowrap font-mono text-[11px]">
                    <div className="text-vpa-olive dark:text-vpa-sand font-bold">
                      {exam.totalQuestions || 40} câu
                    </div>
                    <div className="text-[9.5px] text-gray-500">
                      Mã: {Array.isArray(exam.examCodes) ? exam.examCodes.join(', ') : '101'}
                    </div>
                  </td>

                  {/* Tiến độ chấm */}
                  <td className="py-3 px-4 whitespace-nowrap font-mono">
                    <div className="flex items-center space-x-1">
                      <span className="font-bold text-xs text-vpa-olive dark:text-vpa-sand">
                        {exam.attemptCount || 0}
                      </span>
                      <span className="text-[10px] text-gray-400">bài đã chấm</span>
                    </div>
                    {exam.attemptCount > 0 && (
                      <div className="text-[10px] text-gray-500 mt-0.5">
                        Điểm TB: <strong className="text-yellow-600 dark:text-yellow-400">{exam.avgScore}</strong> • Đạt: <strong className="text-green-600">{exam.passRate}%</strong>
                      </div>
                    )}
                  </td>

                  {/* Ngày tạo */}
                  <td className="py-3 px-4 whitespace-nowrap text-gray-500 font-mono text-[11px]">
                    {exam.createdAt ? new Date(exam.createdAt).toLocaleDateString('vi-VN') : '—'}
                  </td>

                  {/* Action Buttons */}
                  <td className="py-3 px-4">
                    <div className="flex justify-end items-center gap-1.5 flex-wrap">
                      {/* Chấm thi OMR */}
                      <button
                        onClick={() => onOpenOmrGrading(undefined, exam.quizId?._id, exam.code)}
                        title="Mở Bàn Chấm thi OMR bằng Camera điện thoại cho phiếu này"
                        className="px-2.5 py-1.5 bg-gradient-to-r from-emerald-800 to-vpa-olive text-white text-[10px] uppercase font-bold tracking-wider hover:opacity-90 rounded transition-all flex items-center space-x-1 whitespace-nowrap shadow-sm cursor-pointer"
                      >
                        <Camera size={12} weight="bold" />
                        <span>Chấm thi</span>
                      </button>

                      {/* In lại phiếu A4 */}
                      <button
                        onClick={() => setSelectedExamForPrint(exam)}
                        title="In lại phiếu làm bài trắc nghiệm A4 chuẩn OMR"
                        className="px-2.5 py-1.5 border border-vpa-gold text-vpa-olive dark:text-vpa-gold hover:bg-vpa-gold/15 text-[10px] uppercase font-bold tracking-wider rounded transition-colors flex items-center space-x-1 whitespace-nowrap cursor-pointer"
                      >
                        <Printer size={12} weight="bold" />
                        <span>In phiếu</span>
                      </button>

                      {/* Xuất báo cáo */}
                      <button
                        onClick={() => setSelectedExamForExport(exam)}
                        title="Xuất bảng điểm kết quả thi chuẩn Quân đội (Word/Excel)"
                        className="px-2.5 py-1.5 border border-vpa-olive-light/60 hover:bg-vpa-olive-light/10 text-vpa-olive dark:text-vpa-sand text-[10px] uppercase font-bold tracking-wider rounded transition-colors flex items-center space-x-1 whitespace-nowrap cursor-pointer"
                      >
                        <FileArrowDown size={12} weight="bold" />
                        <span>Báo cáo</span>
                      </button>

                      {/* Xóa phiếu */}
                      <button
                        onClick={() => handleDeleteExam(exam)}
                        className="p-1.5 border border-vpa-red/30 hover:bg-vpa-red text-vpa-red hover:text-white rounded transition-colors flex items-center justify-center cursor-pointer"
                        title="Xóa phiếu kiểm tra và bài thi liên kết"
                      >
                        <Trash size={12} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}

              {!loading && exams.length === 0 && (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-gray-400 font-mono text-xs">
                    <p className="font-bold text-sm mb-1 text-gray-500">Chưa có phiếu kiểm tra OMR nào</p>
                    <p className="text-[11px]">Bấm vào nút "Tạo Phiếu Kiểm Tra Mới" phía trên để khởi tạo đợt thi Offline trên giấy.</p>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Phân trang */}
        <div className="p-4 border-t border-vpa-olive-light/20">
          <Pagination
            page={page}
            totalPages={Math.ceil(summary.totalExams / pageSize) || 1}
            totalCount={summary.totalExams || 0}
            pageSize={pageSize}
            onPageChange={setPage}
            itemLabel="phiếu OMR"
          />
        </div>
      </div>

      {/* ========================================================================= */}
      {/* MODAL TẠO PHIẾU KIỂM TRA OMR MỚI                                          */}
      {/* ========================================================================= */}
      {showCreateModal && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-fade-in font-sans">
          <div className="bg-vpa-sand-light dark:bg-vpa-dark-card border border-vpa-olive-light/50 w-full max-w-xl rounded-lg shadow-2xl overflow-hidden animate-scale-up">
            {/* Header Modal */}
            <div className="px-5 py-3 border-b border-vpa-olive-light/30 flex items-center justify-between bg-vpa-olive/10 dark:bg-vpa-gold/10">
              <div className="flex items-center space-x-2">
                <span className="w-3 h-3 bg-vpa-gold rounded-sm inline-block" />
                <h2 className="text-sm font-bold uppercase tracking-wider text-vpa-olive dark:text-vpa-gold">
                  Tạo Phiếu Kiểm Tra OMR Mới (Thi Offline)
                </h2>
              </div>
              <button
                onClick={() => setShowCreateModal(false)}
                className="p-1 rounded text-gray-500 hover:text-vpa-red hover:bg-black/10 transition-colors"
              >
                <X size={18} weight="bold" />
              </button>
            </div>

            {/* Content Form */}
            <form onSubmit={handleCreateSubmit} className="p-5 space-y-4 text-xs">
              {/* Cảnh báo trùng lặp (Conflict) */}
              {createError && (
                <div className="p-3.5 bg-red-500/10 border border-red-500/40 rounded text-vpa-red dark:text-red-300 leading-relaxed space-y-2">
                  <div className="flex items-start space-x-2">
                    <span className="text-base leading-none">⚠️</span>
                    <p className="font-bold text-xs">{createError.message}</p>
                  </div>
                  {createError.existingExam && (
                    <div className="pt-2 border-t border-red-500/20 flex items-center justify-end space-x-2">
                      <button
                        type="button"
                        onClick={() => {
                          setShowCreateModal(false);
                          setSelectedExamForPrint(createError.existingExam);
                        }}
                        className="px-3 py-1 bg-vpa-gold text-vpa-dark font-bold rounded hover:bg-yellow-500 text-[11px] flex items-center space-x-1"
                      >
                        <Printer size={12} weight="bold" />
                        <span>In lại phiếu đã có</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setShowCreateModal(false);
                          onOpenOmrGrading(undefined, createError.existingExam.quizId?._id, createError.existingExam.code);
                        }}
                        className="px-3 py-1 bg-vpa-olive text-white font-bold rounded hover:bg-vpa-olive-light text-[11px] flex items-center space-x-1"
                      >
                        <Camera size={12} weight="bold" />
                        <span>Vào chấm thi</span>
                      </button>
                    </div>
                  )}
                </div>
              )}

              {/* Chọn Đề thi */}
              <div>
                <label className="font-bold text-gray-700 dark:text-gray-300 block mb-1">
                  Chọn Đề thi gốc <span className="text-vpa-red">*</span>
                </label>
                <select
                  value={selectedQuizId}
                  onChange={(e) => handleSelectQuiz(e.target.value)}
                  required
                  className="w-full px-3 py-2 border border-vpa-olive-light/50 rounded bg-white dark:bg-vpa-dark text-vpa-dark dark:text-vpa-sand font-bold focus:outline-none focus:border-vpa-gold"
                >
                  <option value="">-- Chọn đề thi --</option>
                  {quizzesList.map(q => (
                    <option key={q._id} value={q._id}>
                      {q.title} ({q.questions?.length || q.totalQuestions || 40} câu | {q.duration || 45} phút)
                    </option>
                  ))}
                </select>
                <p className="text-[10px] text-gray-500 mt-1 italic font-mono">
                  * Mỗi đề thi chỉ được tạo 1 phiếu OMR hoạt động. Người dùng có thể in lại phiếu bất cứ lúc nào.
                </p>
              </div>

              {/* Tên đợt thi / Tiêu đề phiếu */}
              <div>
                <label className="font-bold text-gray-700 dark:text-gray-300 block mb-1">
                  Tên đợt thi / Tiêu đề phiếu <span className="text-vpa-red">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={examTitle}
                  onChange={(e) => setExamTitle(e.target.value)}
                  className="w-full px-3 py-2 border border-vpa-olive-light/50 rounded bg-white dark:bg-vpa-dark text-vpa-dark dark:text-vpa-sand font-semibold focus:outline-none focus:border-vpa-gold"
                  placeholder="VD: Kiểm tra chính trị đợt 1 năm 2026..."
                />
              </div>

              {/* Đơn vị cấp trên & Đơn vị tổ chức thi */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-bold text-gray-700 dark:text-gray-300 block mb-1">Đơn vị cấp trên</label>
                  <input
                    type="text"
                    value={upperUnit}
                    onChange={(e) => setUpperUnit(e.target.value)}
                    className="w-full px-3 py-2 border border-vpa-olive-light/50 rounded bg-white dark:bg-vpa-dark text-vpa-dark dark:text-vpa-sand font-mono uppercase"
                    placeholder="BỘ QUỐC PHÒNG..."
                  />
                </div>
                <div>
                  <label className="font-bold text-gray-700 dark:text-gray-300 block mb-1">Đơn vị tổ chức thi</label>
                  <input
                    type="text"
                    value={currentUnit}
                    onChange={(e) => setCurrentUnit(e.target.value)}
                    className="w-full px-3 py-2 border border-vpa-olive-light/50 rounded bg-white dark:bg-vpa-dark text-vpa-dark dark:text-vpa-sand font-mono uppercase"
                    placeholder="TRUNG ĐOÀN 1..."
                  />
                </div>
              </div>

              {/* Mã đề thi & Tỉnh thành */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-bold text-gray-700 dark:text-gray-300 block mb-1">
                    Các mã đề thi (cách nhau dấu phẩy)
                  </label>
                  <input
                    type="text"
                    value={examCodesInput}
                    onChange={(e) => setExamCodesInput(e.target.value)}
                    className="w-full px-3 py-2 border border-vpa-olive-light/50 rounded bg-white dark:bg-vpa-dark text-vpa-dark dark:text-vpa-sand font-mono"
                    placeholder="101, 102, 103, 104"
                  />
                </div>
                <div>
                  <label className="font-bold text-gray-700 dark:text-gray-300 block mb-1">Tỉnh / Thành phố</label>
                  <input
                    type="text"
                    value={province}
                    onChange={(e) => setProvince(e.target.value)}
                    className="w-full px-3 py-2 border border-vpa-olive-light/50 rounded bg-white dark:bg-vpa-dark text-vpa-dark dark:text-vpa-sand"
                    placeholder="Đồng Tháp"
                  />
                </div>
              </div>

              {/* Ghi chú */}
              <div>
                <label className="font-bold text-gray-700 dark:text-gray-300 block mb-1">Ghi chú / Hướng dẫn thêm</label>
                <textarea
                  rows={2}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="w-full px-3 py-2 border border-vpa-olive-light/50 rounded bg-white dark:bg-vpa-dark text-vpa-dark dark:text-vpa-sand focus:outline-none focus:border-vpa-gold"
                  placeholder="Ghi chú về đợt thi trên giấy..."
                />
              </div>

              {/* Footer Form */}
              <div className="pt-3 border-t border-vpa-olive-light/20 flex justify-end space-x-3">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="px-4 py-2 border border-gray-400 text-gray-700 dark:text-gray-300 rounded font-bold hover:bg-black/5"
                >
                  Hủy bỏ
                </button>
                <button
                  type="submit"
                  disabled={createLoading}
                  className="px-5 py-2 bg-vpa-olive dark:bg-vpa-gold text-white dark:text-vpa-dark font-extrabold uppercase rounded shadow hover:opacity-90 disabled:opacity-50 flex items-center space-x-2 cursor-pointer"
                >
                  {createLoading ? (
                    <span>Đang tạo...</span>
                  ) : (
                    <>
                      <Check size={16} weight="bold" />
                      <span>Tạo & In Phiếu OMR</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL IN LẠI PHIẾU OMR A4 (RE-PRINT / VIEW)                                */}
      {/* ========================================================================= */}
      {selectedExamForPrint && (
        <OmrPrintModal
          isOpen={!!selectedExamForPrint}
          onClose={() => setSelectedExamForPrint(null)}
          omrExam={selectedExamForPrint}
          quiz={selectedExamForPrint.quizId}
          defaultUnit={selectedExamForPrint.currentUnit}
          defaultUpperUnit={selectedExamForPrint.upperUnit}
        />
      )}

      {/* ========================================================================= */}
      {/* POPUP XUẤT BÁO CÁO KẾT QUẢ VPA (WORD / EXCEL / PDF)                       */}
      {/* ========================================================================= */}
      {selectedExamForExport && (
        <VPAExportPopup
          isOpen={!!selectedExamForExport}
          onCancel={() => setSelectedExamForExport(null)}
          onConfirm={(exportOptions) => {
            setSelectedExamForExport(null);
            const params = new URLSearchParams({
              format: exportOptions.format,
              omrExamId: selectedExamForExport._id,
              upperUnit: exportOptions.upperUnit || selectedExamForExport.upperUnit || '',
              currentUnit: exportOptions.currentUnit || selectedExamForExport.currentUnit || '',
              province: exportOptions.province || selectedExamForExport.province || 'Đồng Tháp',
              position: exportOptions.position || '',
              signerRank: exportOptions.signerRank || '',
              signerName: exportOptions.signerName || '',
              showSignature: String(exportOptions.showSignature),
              orientation: exportOptions.orientation || 'landscape'
            });
            window.location.href = `/api/omr/export/results?${params.toString()}`;
          }}
          type="results"
          previewData={[]}
          defaultUnit={selectedExamForExport.currentUnit}
          defaultUpperUnit={selectedExamForExport.upperUnit}
        />
      )}
    </div>
  );
};

export default OmrManagement;
