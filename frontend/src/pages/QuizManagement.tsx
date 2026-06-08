import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import axios from 'axios';
import { Plus, Trash, UploadSimple, ArrowLeft, PlusCircle, Check, Shuffle, Database, MagnifyingGlass, Funnel, PlusIcon, UploadSimpleIcon, ShuffleIcon, TrashIcon } from '@phosphor-icons/react';
import { VPAExportPopup } from '../components/VPAExportPopup';

interface QuizManagementProps {
  user?: any;
  onNavigateBack: () => void;
}

const CATEGORIES = ['Chính trị', 'Quân sự', 'Truyền thống quân đội', 'Hậu cần - Kỹ thuật', 'Điều lệnh', 'Khác'];
const DIFFICULTIES = ['Dễ', 'Trung bình', 'Khó'];

export const QuizManagement: React.FC<QuizManagementProps> = ({ user, onNavigateBack }) => {
  const [quizzes, setQuizzes] = useState<any[]>([]);
  const [currentTab, setCurrentTab] = useState<'quizzes' | 'bank'>('quizzes');
  const [editingQuizId, setEditingQuizId] = useState<string | null>(null);
  const [viewingQuiz, setViewingQuiz] = useState<any | null>(null);

  // VPA Export configurations
  const [showExportPopup, setShowExportPopup] = useState(false);
  const [selectedQuizForExport, setSelectedQuizForExport] = useState<any>(null);
  const [printData, setPrintData] = useState<{
    upperUnit: string;
    currentUnit: string;
    province: string;
    position: string;
    showSignature: boolean;
    signerRank: string;
    signerName: string;
    quiz: any;
  } | null>(null);

  useEffect(() => {
    if (printData) {
      const originalTitle = document.title;
      const cleanTitle = (printData.quiz?.title || 'De_thi')
        .replace(/[^a-zA-Z0-9\s-_]/g, '')
        .trim()
        .replace(/\s+/g, '_');
      document.title = `De_thi_mon_${cleanTitle}`;

      const timer = setTimeout(() => {
        window.print();
        document.title = originalTitle;
        setPrintData(null);
      }, 500);
      return () => {
        clearTimeout(timer);
        document.title = originalTitle;
      };
    }
  }, [printData]);

  // View states
  const [isCreating, setIsCreating] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isAddingToBank, setIsAddingToBank] = useState(false);

  // Manual quiz state
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState('Khác');
  const [duration, setDuration] = useState(45);
  const [passingScore, setPassingScore] = useState(50);
  const [isPublic, setIsPublic] = useState(false);
  const [questions, setQuestions] = useState<any[]>([]);

  // Import state
  const [importTitle, setImportTitle] = useState('');
  const [importCategory, setImportCategory] = useState('Chính trị');
  const [importDuration, setImportDuration] = useState(45);
  const [importPassingScore, setImportPassingScore] = useState(50);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);

  // Question Bank state
  const [bankQuestions, setBankQuestions] = useState<any[]>([]);
  const [searchBank, setSearchBank] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [difficultyFilter, setDifficultyFilter] = useState('');

  // Single bank question state (for adding to bank)
  const [bankQText, setBankQText] = useState('');
  const [bankQType, setBankQType] = useState('multiple-choice');
  const [bankQOptions, setBankQOptions] = useState<string[]>(['', '', '', '']);
  const [bankQAnswers, setBankQAnswers] = useState<string[]>(['0']);
  const [bankQExplanation, setBankQExplanation] = useState('');
  const [bankQCategory, setBankQCategory] = useState('Chính trị');
  const [bankQDifficulty, setBankQDifficulty] = useState('Trung bình');

  // Auto-generation parameters
  const [genTitle, setGenTitle] = useState('');
  const [genDescription, setGenDescription] = useState('');
  const [genDuration, setGenDuration] = useState(45);
  const [genPassingScore, setGenPassingScore] = useState(50);
  const [genIsPublic, setGenIsPublic] = useState(false);
  const [genRules, setGenRules] = useState<any[]>([
    { category: 'Chính trị', difficulty: 'Dễ', count: 10 }
  ]);

  useEffect(() => {
    fetchQuizzes();
  }, []);

  useEffect(() => {
    if (currentTab === 'bank') {
      fetchBankQuestions();
    }
  }, [currentTab, categoryFilter, difficultyFilter, searchBank]);

  const fetchQuizzes = async () => {
    try {
      const res = await axios.get('/api/quizzes');
      setQuizzes(res.data);
    } catch (err) {
      console.error('Lỗi fetch đề thi:', err);
    }
  };

  const fetchBankQuestions = async () => {
    try {
      const res = await axios.get('/api/bank', {
        params: {
          category: categoryFilter || undefined,
          difficulty: difficultyFilter || undefined,
          search: searchBank || undefined
        }
      });
      setBankQuestions(res.data);
    } catch (err) {
      console.error('Lỗi fetch câu hỏi ngân hàng:', err);
    }
  };

  // Manual Quiz helper methods
  const handleAddQuestion = () => {
    setQuestions([
      ...questions,
      {
        questionType: 'multiple-choice',
        questionText: '',
        options: ['', '', '', ''],
        correctAnswers: ['0'],
        explanation: ''
      }
    ]);
  };

  const handleRemoveQuestion = (idx: number) => {
    setQuestions(questions.filter((_, i) => i !== idx));
  };

  const handleQuestionChange = (idx: number, field: string, val: any) => {
    const updated = [...questions];
    updated[idx] = { ...updated[idx], [field]: val };
    setQuestions(updated);
  };

  const handleOptionChange = (qIdx: number, optIdx: number, val: string) => {
    const updated = [...questions];
    const newOptions = [...updated[qIdx].options];
    newOptions[optIdx] = val;
    updated[qIdx].options = newOptions;
    setQuestions(updated);
  };

  const handleSaveManualQuiz = async (e: React.FormEvent) => {
    e.preventDefault();
    if (questions.length === 0) {
      await window.showAlert('Vui lòng thêm ít nhất một câu hỏi.', 'Yêu cầu câu hỏi');
      return;
    }

    try {
      const payload = {
        title,
        description,
        category,
        duration,
        passingScorePercent: passingScore,
        isPublic,
        questions
      };

      if (editingQuizId) {
        await axios.put(`/api/quizzes/${editingQuizId}`, payload);
        await window.showAlert('Cập nhật đề thi thành công!', 'Quản lý đề thi');
      } else {
        await axios.post('/api/quizzes', payload);
        await window.showAlert('Tạo đề thi thành công!', 'Quản lý đề thi');
      }

      setIsCreating(false);
      setEditingQuizId(null);
      resetManualForm();
      fetchQuizzes();
    } catch (err: any) {
      await window.showAlert(err.response?.data?.message || 'Lỗi lưu đề thi.', 'Lỗi lưu đề thi');
    }
  };

  const handleEditQuiz = (quiz: any) => {
    setEditingQuizId(quiz._id);
    setTitle(quiz.title);
    setDescription(quiz.description || '');
    setCategory(quiz.category);
    setDuration(quiz.duration);
    setPassingScore(quiz.passingScorePercent || 50);
    setIsPublic(quiz.isPublic || false);
    setQuestions(quiz.questions || []);
    setIsCreating(true);
  };

  const handleViewQuiz = (quiz: any) => {
    setViewingQuiz(quiz);
  };

  const handleExportConfirm = async (vpaData: {
    upperUnit: string;
    currentUnit: string;
    position: string;
    province: string;
    showSignature: boolean;
    signerRank: string;
    signerName: string;
    format: 'docx' | 'pdf' | 'xlsx' | 'csv';
  }) => {
    setShowExportPopup(false);
    if (!selectedQuizForExport) return;

    if (vpaData.format === 'pdf') {
      setPrintData({
        upperUnit: vpaData.upperUnit,
        currentUnit: vpaData.currentUnit,
        province: vpaData.province,
        position: vpaData.position,
        showSignature: vpaData.showSignature,
        signerRank: vpaData.signerRank,
        signerName: vpaData.signerName,
        quiz: selectedQuizForExport
      });
      return;
    }

    try {
      const response = await axios.get(`/api/quizzes/${selectedQuizForExport._id}/export`, {
        params: {
          upperUnit: vpaData.upperUnit,
          currentUnit: vpaData.currentUnit,
          province: vpaData.province,
          position: vpaData.position,
          showSignature: vpaData.showSignature,
          signerRank: vpaData.signerRank,
          signerName: vpaData.signerName
        },
        responseType: 'blob'
      });
      const blobUrl = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = blobUrl;
      link.setAttribute('download', `De_thi_${selectedQuizForExport.shareCode}.docx`);
      document.body.appendChild(link);
      link.click();
      link.parentNode?.removeChild(link);
    } catch (err) {
      await window.showAlert('Không thể tải tệp xuất bản đề thi.', 'Lỗi xuất đề thi');
    }
  };

  // Import handler
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      setSelectedFile(e.target.files[0]);
    }
  };

  const handleImportSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedFile) return;

    setLoading(true);
    const formData = new FormData();
    formData.append('file', selectedFile);
    formData.append('title', importTitle);
    formData.append('category', importCategory);
    formData.append('duration', importDuration.toString());
    formData.append('passingScorePercent', importPassingScore.toString());

    try {
      const res = await axios.post('/api/quizzes/import', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      await window.showAlert(res.data.message, 'Nhập đề thi');
      setIsImporting(false);
      setSelectedFile(null);
      fetchQuizzes();
    } catch (err: any) {
      await window.showAlert(err.response?.data?.message || 'Lỗi import đề thi.', 'Lỗi nhập đề thi');
    } finally {
      setLoading(false);
    }
  };

  // Question Bank operations
  const handleAddQuestionToBank = async (e: React.SubmitEvent) => {
    e.preventDefault();
    try {
      await axios.post('/api/bank', {
        questionType: bankQType,
        questionText: bankQText,
        options: bankQOptions,
        correctAnswers: bankQAnswers,
        explanation: bankQExplanation,
        category: bankQCategory,
        difficulty: bankQDifficulty
      });
      setIsAddingToBank(false);
      resetBankQForm();
      fetchBankQuestions();
      await window.showAlert('Đã thêm câu hỏi vào ngân hàng thành công!', 'Ngân hàng câu hỏi');
    } catch (err: any) {
      await window.showAlert(err.response?.data?.message || 'Lỗi lưu câu hỏi vào ngân hàng.', 'Lỗi thêm câu hỏi');
    }
  };

  const handleDeleteBankQ = async (id: string) => {
    const confirmDelete = await window.showConfirm('Đồng chí có chắc chắn muốn xóa câu hỏi này khỏi ngân hàng?', 'Xóa câu hỏi ngân hàng');
    if (!confirmDelete) return;
    try {
      await axios.delete(`/api/bank/${id}`);
      fetchBankQuestions();
    } catch (err: any) {
      await window.showAlert(err.response?.data?.message || 'Lỗi xóa câu hỏi ngân hàng.', 'Lỗi xóa câu hỏi');
    }
  };

  // Auto-generation controls
  const handleAddRule = () => {
    setGenRules([...genRules, { category: 'Chính trị', difficulty: 'Dễ', count: 5 }]);
  };

  const handleRemoveRule = (idx: number) => {
    setGenRules(genRules.filter((_, i) => i !== idx));
  };

  const handleRuleChange = (idx: number, field: string, val: any) => {
    const updated = [...genRules];
    updated[idx] = { ...updated[idx], [field]: val };
    setGenRules(updated);
  };

  const handleAutoGenerateSubmit = async (e: React.SubmitEvent) => {
    e.preventDefault();
    try {
      const response = await axios.post('/api/bank/generate', {
        title: genTitle,
        description: genDescription,
        duration: genDuration,
        passingScorePercent: genPassingScore,
        isPublic: genIsPublic,
        rules: genRules
      });
      await window.showAlert(response.data.message, 'Sinh đề tự động');
      setIsGenerating(false);
      resetGenForm();
      fetchQuizzes();
    } catch (err: any) {
      await window.showAlert(err.response?.data?.message || 'Lỗi tự động sinh đề thi.', 'Lỗi sinh đề');
    }
  };

  // Deletion
  const handleDeleteQuiz = async (id: string) => {
    const confirmDelete = await window.showConfirm('Đồng chí có chắc chắn muốn xóa đề thi này?', 'Xóa đề thi');
    if (!confirmDelete) return;
    try {
      await axios.delete(`/api/quizzes/${id}`);
      fetchQuizzes();
    } catch (err: any) {
      await window.showAlert(err.response?.data?.message || 'Không thể xóa đề thi.', 'Lỗi xóa đề thi');
    }
  };

  const resetManualForm = () => {
    setTitle('');
    setDescription('');
    setCategory('Khác');
    setDuration(45);
    setPassingScore(50);
    setIsPublic(false);
    setQuestions([]);
  };

  const resetBankQForm = () => {
    setBankQText('');
    setBankQType('multiple-choice');
    setBankQOptions(['', '', '', '']);
    setBankQAnswers(['0']);
    setBankQExplanation('');
    setBankQCategory('Chính trị');
    setBankQDifficulty('Trung bình');
  };

  const resetGenForm = () => {
    setGenTitle('');
    setGenDescription('');
    setGenDuration(45);
    setGenPassingScore(50);
    setGenIsPublic(false);
    setGenRules([{ category: 'Chính trị', difficulty: 'Dễ', count: 10 }]);
  };

  return (
    <div className="max-w-7xl mx-auto px-6 py-8">
      
      {/* Header Navigation */}
      <div className="flex items-center justify-between mb-8 pb-4 border-b border-vpa-olive-light/30">
        <div className="flex items-center space-x-4">
          <button
            onClick={onNavigateBack}
            className="p-2 border border-vpa-olive-light/30 hover:bg-vpa-olive-light/10 text-vpa-olive dark:text-vpa-sand transition-colors"
          >
            <ArrowLeft size={18} />
          </button>
          <div>
            <h1 className="text-lg font-bold uppercase tracking-wider text-vpa-olive dark:text-vpa-sand">
              Quản lý kho đề & ngân hàng câu hỏi
            </h1>
            <p className="text-[10px] text-gray-500 uppercase tracking-widest font-mono">
              Quản trị chuyên nghiệp hệ thống thi trắc nghiệm quân sự
            </p>
          </div>
        </div>

        {/* Global tab choices */}
        {!isCreating && !isImporting && !isGenerating && !isAddingToBank && (
          <div className="flex border border-vpa-olive-light/50 font-mono text-xs">
            <button
              onClick={() => setCurrentTab('quizzes')}
              className={`px-4 py-2 uppercase font-bold transition-colors ${
                currentTab === 'quizzes' 
                  ? 'bg-vpa-olive text-white dark:bg-vpa-gold dark:text-vpa-dark' 
                  : 'text-vpa-olive dark:text-vpa-sand hover:bg-vpa-olive-light/10'
              }`}
            >
              Kho đề thi ({quizzes.length})
            </button>
            <button
              onClick={() => setCurrentTab('bank')}
              className={`px-4 py-2 uppercase font-bold transition-colors ${
                currentTab === 'bank' 
                  ? 'bg-vpa-olive text-white dark:bg-vpa-gold dark:text-vpa-dark' 
                  : 'text-vpa-olive dark:text-vpa-sand hover:bg-vpa-olive-light/10'
              }`}
            >
              Ngân hàng câu hỏi
            </button>
          </div>
        )}
      </div>

      {/* VIEW CONDITIONAL RENDERS */}

      {/* --- A. QUIZZES TAB --- */}
      {currentTab === 'quizzes' && (
        <>
          {/* Main Quiz Actions Bar */}
          {!isCreating && !isImporting && !isGenerating && (
            <div className="flex justify-between items-center mb-6">
              <span className="text-[10px] font-mono uppercase tracking-wider text-gray-500">
                Các đề thi có sẵn trên hệ thống
              </span>
              <div className="flex space-x-3">
                <button
                  onClick={() => setIsGenerating(true)}
                  className="px-3 py-1.5 border border-vpa-gold text-vpa-gold-bright hover:bg-vpa-gold/10 text-xs font-bold uppercase tracking-wider flex items-center space-x-2"
                >
                  <ShuffleIcon size={16} />
                  <span>Rút đề ngẫu nhiên</span>
                </button>
                <button
                  onClick={() => setIsImporting(true)}
                  className="px-3 py-1.5 border border-vpa-olive-light text-vpa-olive dark:text-vpa-sand hover:bg-vpa-olive-light/10 text-xs font-bold uppercase tracking-wider flex items-center space-x-2"
                >
                  <UploadSimpleIcon size={16} />
                  <span>Import bộ đề</span>
                </button>
                <button
                  onClick={() => { setIsCreating(true); handleAddQuestion(); }}
                  className="px-3 py-1.5 bg-vpa-olive dark:bg-vpa-gold text-white dark:text-vpa-dark hover:bg-vpa-olive-light dark:hover:bg-vpa-gold-bright text-xs font-bold uppercase tracking-wider flex items-center space-x-2"
                >
                  <PlusIcon size={16} />
                  <span>Soạn đề thủ công</span>
                </button>
              </div>
            </div>
          )}

          {/* List Quizzes Table */}
          {!isCreating && !isImporting && !isGenerating && (
            <div className="border border-vpa-olive-light/50 bg-vpa-sand-light dark:bg-vpa-dark-card p-6 shadow-md rounded-none">
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="border-b border-vpa-olive-light/30 text-gray-500 font-mono uppercase text-[10px]">
                      <th className="py-3 px-4">Tên đề thi</th>
                      <th className="py-3 px-4">Chuyên ngành</th>
                      <th className="py-3 px-4">Thông tin đề</th>
                      <th className="py-3 px-4">Trạng thái</th>
                      <th className="py-3 px-4">Mã chia sẻ</th>
                      <th className="py-3 px-4 text-right">Thao tác</th>
                    </tr>
                  </thead>
                  <tbody>
                    {quizzes.map(quiz => (
                      <tr key={quiz._id} className="border-b border-vpa-olive-light/10 hover:bg-vpa-olive-light/5">
                        <td className="py-3 px-4 font-bold text-vpa-olive dark:text-vpa-sand uppercase">{quiz.title}</td>
                        <td className="py-3 px-4">{quiz.category}</td>
                        <td className="py-3 px-4">{quiz.questions.length} câu / {quiz.duration} phút ({quiz.passingScorePercent}% Đạt)</td>
                        <td className="py-3 px-4">
                          {quiz.isPublic ? (
                            <span className="text-green-600 font-bold">CÔNG KHAI</span>
                          ) : (
                            <span className="text-gray-400">NỘI BỘ</span>
                          )}
                        </td>
                        <td className="py-3 px-4 font-mono font-bold text-vpa-gold">{quiz.shareCode}</td>
                        <td className="py-3 px-4 text-right flex justify-end space-x-2">
                          <button
                            type="button"
                            onClick={() => handleViewQuiz(quiz)}
                            className="p-1.5 border border-vpa-olive-light/50 text-vpa-olive dark:text-vpa-sand hover:bg-vpa-olive hover:text-white dark:hover:bg-vpa-gold dark:hover:text-vpa-dark text-[10px] uppercase font-bold"
                          >
                            Xem đề
                          </button>
                          <button
                            type="button"
                            onClick={() => handleEditQuiz(quiz)}
                            className="p-1.5 border border-vpa-olive-light/50 text-vpa-olive dark:text-vpa-sand hover:bg-vpa-olive hover:text-white dark:hover:bg-vpa-gold dark:hover:text-vpa-dark text-[10px] uppercase font-bold"
                          >
                            Sửa đề
                          </button>
                          <button
                            type="button"
                            onClick={() => { setSelectedQuizForExport(quiz); setShowExportPopup(true); }}
                            className="p-1.5 border border-vpa-olive-light/50 text-vpa-olive dark:text-vpa-sand hover:bg-vpa-olive hover:text-white dark:hover:bg-vpa-gold dark:hover:text-vpa-dark text-[10px] uppercase font-bold"
                          >
                            Xuất bản
                          </button>
                          <button
                            onClick={() => handleDeleteQuiz(quiz._id)}
                            className="p-1.5 border border-vpa-red/30 text-vpa-red hover:bg-vpa-red hover:text-white"
                          >
                            <TrashIcon size={14} />
                          </button>
                        </td>
                      </tr>
                    ))}
                    {quizzes.length === 0 && (
                      <tr>
                        <td colSpan={6} className="text-center py-8 text-gray-400">Chưa có đề thi quân sự nào được xuất bản.</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Manual creation form */}
          {isCreating && (
            <form onSubmit={handleSaveManualQuiz} className="space-y-6">
              <div className="border border-vpa-olive-light/50 bg-vpa-sand-light dark:bg-vpa-dark-card p-6 shadow-md rounded-none space-y-4">
                <h3 className="text-sm font-bold uppercase text-vpa-olive dark:text-vpa-sand pb-2 border-b border-vpa-olive-light/30">
                  Thông tin soạn đề thi
                </h3>
                
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  <div>
                    <label className="block text-[10px] uppercase tracking-wider text-gray-500 mb-1">Tên đề thi</label>
                    <input
                      type="text"
                      required
                      value={title}
                      onChange={e => setTitle(e.target.value)}
                      placeholder="Kiểm tra lý luận chính trị năm 2026"
                      className="w-full text-xs p-2.5 bg-transparent border border-vpa-olive-light focus:outline-none focus:border-vpa-gold text-vpa-olive dark:text-vpa-sand"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] uppercase tracking-wider text-gray-500 mb-1">Chuyên ngành</label>
                    <select
                      value={category}
                      onChange={e => setCategory(e.target.value)}
                      className="w-full text-xs p-2.5 bg-transparent border border-vpa-olive-light focus:outline-none focus:border-vpa-gold dark:bg-vpa-dark-card text-vpa-olive dark:text-vpa-sand"
                    >
                      {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-[10px] uppercase tracking-wider text-gray-500 mb-1">Thời gian làm bài (Phút)</label>
                    <input
                      type="number"
                      required
                      min={1}
                      value={duration}
                      onChange={e => setDuration(parseInt(e.target.value))}
                      className="w-full text-xs p-2.5 bg-transparent border border-vpa-olive-light focus:outline-none focus:border-vpa-gold text-vpa-olive dark:text-vpa-sand"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  <div>
                    <label className="block text-[10px] uppercase tracking-wider text-gray-500 mb-1">Mô tả tóm tắt</label>
                    <input
                      type="text"
                      value={description}
                      onChange={e => setDescription(e.target.value)}
                      placeholder="Dành cho đối tượng sĩ quan cấp úy..."
                      className="w-full text-xs p-2.5 bg-transparent border border-vpa-olive-light focus:outline-none focus:border-vpa-gold text-vpa-olive dark:text-vpa-sand"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] uppercase tracking-wider text-gray-500 mb-1">Phần trăm đạt yêu cầu (%)</label>
                    <input
                      type="number"
                      required
                      min={1}
                      max={100}
                      value={passingScore}
                      onChange={e => setPassingScore(parseInt(e.target.value))}
                      className="w-full text-xs p-2.5 bg-transparent border border-vpa-olive-light focus:outline-none focus:border-vpa-gold text-vpa-olive dark:text-vpa-sand"
                    />
                  </div>
                  <div className="flex items-center pt-5">
                    <input
                      type="checkbox"
                      id="isPublic"
                      checked={isPublic}
                      onChange={e => setIsPublic(e.target.checked)}
                      className="w-4 h-4 border-vpa-olive-light accent-vpa-olive mr-2"
                    />
                    <label htmlFor="isPublic" className="text-xs font-semibold text-vpa-olive dark:text-vpa-sand">Công khai đề thi cho ôn luyện</label>
                  </div>
                </div>
              </div>

              {/* Soạn danh sách câu hỏi */}
              <div className="space-y-4">
                <div className="flex justify-between items-center">
                  <h3 className="text-sm font-bold uppercase text-vpa-olive dark:text-vpa-sand">Danh sách câu hỏi ({questions.length})</h3>
                  <button
                    type="button"
                    onClick={handleAddQuestion}
                    className="px-3 py-1 bg-vpa-olive dark:bg-vpa-gold text-white dark:text-vpa-dark text-xs uppercase font-bold flex items-center space-x-2"
                  >
                    <PlusCircle size={16} />
                    <span>Thêm câu hỏi</span>
                  </button>
                </div>

                {questions.map((q, qIdx) => (
                  <div
                    key={qIdx}
                    className="border border-vpa-olive-light/50 bg-vpa-sand-light dark:bg-vpa-dark-card p-6 shadow-md rounded-none space-y-4"
                  >
                    <div className="flex justify-between items-start">
                      <span className="font-mono text-xs font-bold text-vpa-gold">CÂU HỎI {qIdx + 1}</span>
                      <button
                        type="button"
                        onClick={() => handleRemoveQuestion(qIdx)}
                        className="text-vpa-red hover:underline text-xs uppercase font-bold"
                      >
                        Xóa câu
                      </button>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                      <div className="md:col-span-2">
                        <label className="block text-[10px] uppercase tracking-wider text-gray-500 mb-1">Nội dung câu hỏi</label>
                        <input
                          type="text"
                          required
                          value={q.questionText}
                          onChange={e => handleQuestionChange(qIdx, 'questionText', e.target.value)}
                          placeholder="Câu hỏi..."
                          className="w-full text-xs p-2.5 bg-transparent border border-vpa-olive-light focus:outline-none focus:border-vpa-gold text-vpa-olive dark:text-vpa-sand"
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] uppercase tracking-wider text-gray-500 mb-1">Dạng câu hỏi</label>
                        <select
                          value={q.questionType}
                          onChange={e => {
                            const type = e.target.value;
                            let options: string[] = [];
                            let correctAnswers: string[] = ['0'];
                            if (type === 'multiple-choice') options = ['', '', '', ''];
                            if (type === 'true-false') {
                              options = ['Đúng', 'Sai'];
                              correctAnswers = ['0'];
                            }
                            if (type === 'fill-in-the-blank') {
                              options = [];
                              correctAnswers = [''];
                            }
                            const updated = [...questions];
                            updated[qIdx] = { ...updated[qIdx], questionType: type, options, correctAnswers };
                            setQuestions(updated);
                          }}
                          className="w-full text-xs p-2.5 bg-transparent border border-vpa-olive-light focus:outline-none focus:border-vpa-gold dark:bg-vpa-dark-card text-vpa-olive dark:text-vpa-sand"
                        >
                          <option value="multiple-choice">Trắc nghiệm A, B, C, D</option>
                          <option value="true-false">Đúng / Sai</option>
                          <option value="fill-in-the-blank">Điền vào ô trống</option>
                        </select>
                      </div>
                    </div>

                    {q.questionType === 'multiple-choice' && (
                      <div className="space-y-3">
                        <label className="block text-[10px] uppercase tracking-wider text-gray-500">Các đáp án lựa chọn (Chọn đáp án đúng)</label>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          {q.options.map((opt: string, optIdx: number) => {
                            const letter = String.fromCharCode(65 + optIdx);
                            const isCorrect = q.correctAnswers.includes(optIdx.toString());

                            return (
                              <div key={optIdx} className="flex items-center space-x-2">
                                <button
                                  type="button"
                                  onClick={() => handleQuestionChange(qIdx, 'correctAnswers', [optIdx.toString()])}
                                  className={`w-6 h-6 border flex items-center justify-center font-bold text-xs ${
                                    isCorrect 
                                      ? 'bg-vpa-olive text-white dark:bg-vpa-gold dark:text-vpa-dark border-transparent' 
                                      : 'border-vpa-olive-light/50 text-gray-400'
                                  }`}
                                >
                                  {isCorrect ? <Check size={14} /> : letter}
                                </button>
                                <input
                                  type="text"
                                  required
                                  value={opt}
                                  onChange={e => handleOptionChange(qIdx, optIdx, e.target.value)}
                                  placeholder={`Lựa chọn ${letter}`}
                                  className="w-full text-xs p-2 bg-transparent border border-vpa-olive-light/50 focus:outline-none focus:border-vpa-gold text-vpa-olive dark:text-vpa-sand"
                                />
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}

                    {q.questionType === 'true-false' && (
                      <div className="flex space-x-6">
                        <button
                          type="button"
                          onClick={() => handleQuestionChange(qIdx, 'correctAnswers', ['0'])}
                          className={`px-4 py-2 border text-xs uppercase font-bold ${
                            q.correctAnswers.includes('0')
                              ? 'bg-vpa-olive text-white dark:bg-vpa-gold dark:text-vpa-dark border-transparent'
                              : 'border-vpa-olive-light/50 text-gray-400'
                          }`}
                        >
                          Đúng
                        </button>
                        <button
                          type="button"
                          onClick={() => handleQuestionChange(qIdx, 'correctAnswers', ['1'])}
                          className={`px-4 py-2 border text-xs uppercase font-bold ${
                            q.correctAnswers.includes('1')
                              ? 'bg-vpa-olive text-white dark:bg-vpa-gold dark:text-vpa-dark border-transparent'
                              : 'border-vpa-olive-light/50 text-gray-400'
                          }`}
                        >
                          Sai
                        </button>
                      </div>
                    )}

                    {q.questionType === 'fill-in-the-blank' && (
                      <div>
                        <label className="block text-[10px] uppercase tracking-wider text-gray-500 mb-1">Đáp án đúng chính xác</label>
                        <input
                          type="text"
                          required
                          value={q.correctAnswers[0] || ''}
                          onChange={e => handleQuestionChange(qIdx, 'correctAnswers', [e.target.value])}
                          placeholder="Cụm từ đáp án đúng..."
                          className="w-full text-xs p-2 bg-transparent border border-vpa-olive-light focus:outline-none focus:border-vpa-gold text-vpa-olive dark:text-vpa-sand"
                        />
                      </div>
                    )}

                    <div>
                      <label className="block text-[10px] uppercase tracking-wider text-gray-500 mb-1">Lời giải thích bổ sung</label>
                      <input
                        type="text"
                        value={q.explanation}
                        onChange={e => handleQuestionChange(qIdx, 'explanation', e.target.value)}
                        placeholder="Căn cứ pháp lý..."
                        className="w-full text-xs p-2 bg-transparent border border-vpa-olive-light/50 focus:outline-none focus:border-vpa-gold text-vpa-olive dark:text-vpa-sand"
                      />
                    </div>
                  </div>
                ))}
              </div>

              <div className="flex justify-end space-x-4 border-t border-vpa-olive-light/30 pt-6">
                <button
                  type="button"
                  onClick={() => { setIsCreating(false); resetManualForm(); }}
                  className="px-4 py-2 border border-vpa-olive-light text-xs uppercase tracking-wider text-vpa-olive dark:text-vpa-sand hover:bg-vpa-olive hover:text-white"
                >
                  Hủy bỏ
                </button>
                <button
                  type="submit"
                  className="px-6 py-2 bg-vpa-olive dark:bg-vpa-gold text-white dark:text-vpa-dark text-xs uppercase font-bold tracking-wider hover:bg-vpa-olive-light dark:hover:bg-vpa-gold-bright"
                >
                  Lưu đề thi quân sự
                </button>
              </div>
            </form>
          )}

          {/* Import file form */}
          {isImporting && (
            <form onSubmit={handleImportSubmit} className="space-y-6">
              <div className="border border-vpa-olive-light/50 bg-vpa-sand-light dark:bg-vpa-dark-card p-6 shadow-md rounded-none space-y-4">
                <h3 className="text-sm font-bold uppercase text-vpa-olive dark:text-vpa-sand pb-2 border-b border-vpa-olive-light/30">
                  Cài đặt bộ đề nhập tệp (Import)
                </h3>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <label className="block text-[10px] uppercase tracking-wider text-gray-500 mb-1">Tên đề thi sau khi nhập</label>
                    <input
                      type="text"
                      required
                      value={importTitle}
                      onChange={e => setImportTitle(e.target.value)}
                      placeholder="Đề thi trắc nghiệm quân sự tổng hợp"
                      className="w-full text-xs p-2 bg-transparent border border-vpa-olive-light focus:outline-none focus:border-vpa-gold text-vpa-olive dark:text-vpa-sand"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] uppercase tracking-wider text-gray-500 mb-1">Chuyên ngành</label>
                    <select
                      value={importCategory}
                      onChange={e => setImportCategory(e.target.value)}
                      className="w-full text-xs p-2 bg-transparent border border-vpa-olive-light focus:outline-none focus:border-vpa-gold dark:bg-vpa-dark-card text-vpa-olive dark:text-vpa-sand"
                    >
                      {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <label className="block text-[10px] uppercase tracking-wider text-gray-500 mb-1">Thời gian làm bài (Phút)</label>
                    <input
                      type="number"
                      required
                      min={1}
                      value={importDuration}
                      onChange={e => setImportDuration(parseInt(e.target.value))}
                      className="w-full text-xs p-2 bg-transparent border border-vpa-olive-light focus:outline-none focus:border-vpa-gold text-vpa-olive dark:text-vpa-sand"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] uppercase tracking-wider text-gray-500 mb-1">Điểm đạt (%)</label>
                    <input
                      type="number"
                      required
                      min={1}
                      max={100}
                      value={importPassingScore}
                      onChange={e => setImportPassingScore(parseInt(e.target.value))}
                      className="w-full text-xs p-2 bg-transparent border border-vpa-olive-light focus:outline-none focus:border-vpa-gold text-vpa-olive dark:text-vpa-sand"
                    />
                  </div>
                </div>

                <div className="border-2 border-dashed border-vpa-olive-light/50 p-8 text-center bg-vpa-sand/30 dark:bg-vpa-dark/30 hover:border-vpa-gold transition-colors relative cursor-pointer">
                  <input
                    type="file"
                    required
                    accept=".xlsx,.xls,.csv,.docx,.pdf"
                    onChange={handleFileChange}
                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                  />
                  <UploadSimple size={36} className="mx-auto mb-2 text-vpa-olive-light" />
                  <p className="text-xs text-vpa-olive dark:text-vpa-sand font-bold uppercase">
                    {selectedFile ? `File đã chọn: ${selectedFile.name}` : 'Kéo thả tệp tin hoặc click để chọn'}
                  </p>
                  <p className="text-[10px] text-gray-500 mt-1">Hỗ trợ các định dạng: .xlsx, .csv, .docx, .pdf</p>
                </div>
              </div>

              <div className="flex justify-end space-x-4 border-t border-vpa-olive-light/30 pt-6">
                <button
                  type="button"
                  onClick={() => { setIsImporting(false); setSelectedFile(null); }}
                  className="px-4 py-2 border border-vpa-olive-light text-xs uppercase tracking-wider text-vpa-olive dark:text-vpa-sand hover:bg-vpa-olive hover:text-white"
                >
                  Hủy bỏ
                </button>
                <button
                  type="submit"
                  disabled={loading || !selectedFile}
                  className="px-6 py-2 bg-vpa-olive dark:bg-vpa-gold text-white dark:text-vpa-dark text-xs uppercase font-bold tracking-wider hover:bg-vpa-olive-light dark:hover:bg-vpa-gold-bright disabled:opacity-50"
                >
                  {loading ? 'Đang phân tích cấu trúc đề thi...' : 'Kích hoạt nạp đề'}
                </button>
              </div>
            </form>
          )}

          {/* C. AUTO GENERATION FORM */}
          {isGenerating && (
            <form onSubmit={handleAutoGenerateSubmit} className="space-y-6">
              <div className="border border-vpa-olive-light/50 bg-vpa-sand-light dark:bg-vpa-dark-card p-6 shadow-md rounded-none space-y-4">
                <h3 className="text-sm font-bold uppercase text-vpa-olive dark:text-vpa-sand pb-2 border-b border-vpa-olive-light/30 flex items-center space-x-2">
                  <Shuffle size={18} className="text-vpa-gold" />
                  <span>Rút đề ngẫu nhiên từ Ngân hàng câu hỏi tập trung</span>
                </h3>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <label className="block text-[10px] uppercase tracking-wider text-gray-500 mb-1">Tên đề thi tự động</label>
                    <input
                      type="text"
                      required
                      value={genTitle}
                      onChange={e => setGenTitle(e.target.value)}
                      placeholder="Đề kiểm tra ngẫu nhiên chuyên ngành"
                      className="w-full text-xs p-2.5 bg-transparent border border-vpa-olive-light focus:outline-none focus:border-vpa-gold text-vpa-olive dark:text-vpa-sand"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] uppercase tracking-wider text-gray-500 mb-1">Mô tả tóm tắt</label>
                    <input
                      type="text"
                      value={genDescription}
                      onChange={e => setGenDescription(e.target.value)}
                      placeholder="Tự động rút đề khách quan dựa trên ngân hàng câu hỏi..."
                      className="w-full text-xs p-2.5 bg-transparent border border-vpa-olive-light focus:outline-none focus:border-vpa-gold text-vpa-olive dark:text-vpa-sand"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  <div>
                    <label className="block text-[10px] uppercase tracking-wider text-gray-500 mb-1">Thời gian làm bài (Phút)</label>
                    <input
                      type="number"
                      required
                      min={1}
                      value={genDuration}
                      onChange={e => setGenDuration(parseInt(e.target.value))}
                      className="w-full text-xs p-2.5 bg-transparent border border-vpa-olive-light focus:outline-none focus:border-vpa-gold text-vpa-olive dark:text-vpa-sand"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] uppercase tracking-wider text-gray-500 mb-1">Phần trăm đạt yêu cầu (%)</label>
                    <input
                      type="number"
                      required
                      min={1}
                      max={100}
                      value={genPassingScore}
                      onChange={e => setGenPassingScore(parseInt(e.target.value))}
                      className="w-full text-xs p-2.5 bg-transparent border border-vpa-olive-light focus:outline-none focus:border-vpa-gold text-vpa-olive dark:text-vpa-sand"
                    />
                  </div>
                  <div className="flex items-center pt-5">
                    <input
                      type="checkbox"
                      id="genIsPublic"
                      checked={genIsPublic}
                      onChange={e => setGenIsPublic(e.target.checked)}
                      className="w-4 h-4 border-vpa-olive-light accent-vpa-olive mr-2"
                    />
                    <label htmlFor="genIsPublic" className="text-xs font-semibold text-vpa-olive dark:text-vpa-sand">Công khai đề thi cho ôn luyện</label>
                  </div>
                </div>
              </div>

              {/* Rút đề criteria rules builder */}
              <div className="space-y-4 border border-vpa-olive-light/50 bg-vpa-sand-light dark:bg-vpa-dark-card p-6 shadow-md rounded-none">
                <div className="flex justify-between items-center border-b border-vpa-olive-light/20 pb-2 mb-4">
                  <h4 className="text-xs font-bold uppercase tracking-wider">Tiêu chí rút ngẫu nhiên câu hỏi</h4>
                  <button
                    type="button"
                    onClick={handleAddRule}
                    className="px-3 py-1 border border-vpa-olive-light hover:bg-vpa-olive-light/10 text-xs font-bold uppercase font-mono"
                  >
                    + Thêm chuyên ngành
                  </button>
                </div>

                <div className="space-y-3">
                  {genRules.map((rule, idx) => (
                    <div key={idx} className="flex items-center space-x-4">
                      <div className="w-1/3">
                        <label className="block text-[9px] uppercase text-gray-500 mb-1">Chuyên ngành</label>
                        <select
                          value={rule.category}
                          onChange={e => handleRuleChange(idx, 'category', e.target.value)}
                          className="w-full text-xs p-2 bg-transparent border border-vpa-olive-light dark:bg-vpa-dark-card text-vpa-olive dark:text-vpa-sand focus:outline-none"
                        >
                          {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                        </select>
                      </div>
                      <div className="w-1/3">
                        <label className="block text-[9px] uppercase text-gray-500 mb-1">Độ khó</label>
                        <select
                          value={rule.difficulty}
                          onChange={e => handleRuleChange(idx, 'difficulty', e.target.value)}
                          className="w-full text-xs p-2 bg-transparent border border-vpa-olive-light dark:bg-vpa-dark-card text-vpa-olive dark:text-vpa-sand focus:outline-none"
                        >
                          {DIFFICULTIES.map(d => <option key={d} value={d}>{d}</option>)}
                        </select>
                      </div>
                      <div className="w-1/4">
                        <label className="block text-[9px] uppercase text-gray-500 mb-1">Số lượng câu</label>
                        <input
                          type="number"
                          required
                          min={1}
                          value={rule.count}
                          onChange={e => handleRuleChange(idx, 'count', parseInt(e.target.value))}
                          className="w-full text-xs p-2 bg-transparent border border-vpa-olive-light text-vpa-olive dark:text-vpa-sand focus:outline-none"
                        />
                      </div>
                      <button
                        type="button"
                        onClick={() => handleRemoveRule(idx)}
                        disabled={genRules.length === 1}
                        className="text-vpa-red hover:underline text-xs uppercase font-bold pt-5 disabled:opacity-50"
                      >
                        Xóa
                      </button>
                    </div>
                  ))}
                </div>
              </div>

              <div className="flex justify-end space-x-4 border-t border-vpa-olive-light/30 pt-6">
                <button
                  type="button"
                  onClick={() => { setIsGenerating(false); resetGenForm(); }}
                  className="px-4 py-2 border border-vpa-olive-light text-xs uppercase tracking-wider text-vpa-olive dark:text-vpa-sand hover:bg-vpa-olive hover:text-white"
                >
                  Hủy bỏ
                </button>
                <button
                  type="submit"
                  className="px-6 py-2 bg-vpa-olive dark:bg-vpa-gold text-white dark:text-vpa-dark text-xs uppercase font-bold tracking-wider hover:bg-vpa-olive-light dark:hover:bg-vpa-gold-bright"
                >
                  Tiến hành rút đề ngẫu nhiên
                </button>
              </div>
            </form>
          )}
        </>
      )}

      {/* --- B. QUESTION BANK TAB --- */}
      {currentTab === 'bank' && (
        <>
          {/* Question Bank controls */}
          {!isAddingToBank && (
            <div className="border border-vpa-olive-light/50 bg-vpa-sand-light dark:bg-vpa-dark-card p-4 mb-6 shadow-sm flex flex-wrap gap-4 items-center justify-between">
              
              {/* Search Bank inputs */}
              <div className="flex flex-wrap gap-3 items-center w-full md:w-auto">
                <div className="relative">
                  <input
                    type="text"
                    value={searchBank}
                    onChange={e => setSearchBank(e.target.value)}
                    placeholder="Tìm câu hỏi..."
                    className="text-xs p-2 pl-8 bg-transparent border border-vpa-olive-light focus:outline-none focus:border-vpa-gold text-vpa-olive dark:text-vpa-sand w-48"
                  />
                  <MagnifyingGlass size={14} className="absolute left-2.5 top-3 text-gray-500" />
                </div>
                
                <div className="flex items-center space-x-1">
                  <Funnel size={14} className="text-vpa-gold" />
                  <select
                    value={categoryFilter}
                    onChange={e => setCategoryFilter(e.target.value)}
                    className="text-xs bg-transparent border-b border-vpa-olive-light text-vpa-olive dark:text-vpa-sand focus:outline-none dark:bg-vpa-dark-card"
                  >
                    <option value="">Tất cả chuyên ngành</option>
                    {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>

                <select
                  value={difficultyFilter}
                  onChange={e => setDifficultyFilter(e.target.value)}
                  className="text-xs bg-transparent border-b border-vpa-olive-light text-vpa-olive dark:text-vpa-sand focus:outline-none dark:bg-vpa-dark-card"
                >
                  <option value="">Tất cả độ khó</option>
                  {DIFFICULTIES.map(d => <option key={d} value={d}>{d}</option>)}
                </select>
              </div>

              <button
                onClick={() => setIsAddingToBank(true)}
                className="px-3 py-1.5 bg-vpa-olive dark:bg-vpa-gold text-white dark:text-vpa-dark text-xs uppercase font-bold flex items-center space-x-2 w-full md:w-auto justify-center"
              >
                <Plus size={16} />
                <span>Thêm câu hỏi vào ngân hàng</span>
              </button>
            </div>
          )}

          {/* List bank questions */}
          {!isAddingToBank && (
            <div className="border border-vpa-olive-light/50 bg-vpa-sand-light dark:bg-vpa-dark-card p-6 shadow-md rounded-none">
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="border-b border-vpa-olive-light/30 text-gray-500 font-mono uppercase text-[10px]">
                      <th className="py-3 px-4 w-1/2">Nội dung câu hỏi</th>
                      <th className="py-3 px-4">Chuyên ngành</th>
                      <th className="py-3 px-4">Độ khó</th>
                      <th className="py-3 px-4">Đồng chí soạn</th>
                      <th className="py-3 px-4 text-right">Thao tác</th>
                    </tr>
                  </thead>
                  <tbody>
                    {bankQuestions.map(q => (
                      <tr key={q._id} className="border-b border-vpa-olive-light/10 hover:bg-vpa-olive-light/5">
                        <td className="py-3 px-4 font-semibold text-vpa-olive dark:text-vpa-sand leading-relaxed">{q.questionText}</td>
                        <td className="py-3 px-4">{q.category}</td>
                        <td className="py-3 px-4">
                          <span className={`px-2 py-0.5 border text-[9px] font-mono font-bold ${
                            q.difficulty === 'Dễ' 
                              ? 'border-green-500/30 bg-green-500/10 text-green-600'
                              : q.difficulty === 'Trung bình'
                              ? 'border-yellow-500/30 bg-yellow-500/10 text-yellow-600'
                              : 'border-red-500/30 bg-red-500/10 text-red-600'
                          }`}>
                            {q.difficulty}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-gray-500">{q.creatorId?.fullName || ''}</td>
                        <td className="py-3 px-4 text-right flex justify-end space-x-2">
                          <button
                            onClick={() => handleDeleteBankQ(q._id)}
                            className="p-1.5 border border-vpa-red/30 text-vpa-red hover:bg-vpa-red hover:text-white"
                          >
                            <Trash size={14} />
                          </button>
                        </td>
                      </tr>
                    ))}
                    {bankQuestions.length === 0 && (
                      <tr>
                        <td colSpan={5} className="text-center py-8 text-gray-400">Ngân hàng câu hỏi trống hoặc không khớp bộ lọc.</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Add Question to Bank form */}
          {isAddingToBank && (
            <form onSubmit={handleAddQuestionToBank} className="space-y-6">
              <div className="border border-vpa-olive-light/50 bg-vpa-sand-light dark:bg-vpa-dark-card p-6 shadow-md rounded-none space-y-4">
                <h3 className="text-sm font-bold uppercase text-vpa-olive dark:text-vpa-sand pb-2 border-b border-vpa-olive-light/30 flex items-center space-x-2">
                  <Database size={18} className="text-vpa-gold" />
                  <span>Khai báo câu hỏi mới vào ngân hàng chung</span>
                </h3>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  <div className="md:col-span-2">
                    <label className="block text-[10px] uppercase tracking-wider text-gray-500 mb-1">Nội dung câu hỏi</label>
                    <input
                      type="text"
                      required
                      value={bankQText}
                      onChange={e => setBankQText(e.target.value)}
                      placeholder="VD: Ngày thành lập Quân đội nhân dân Việt Nam là ngày nào?"
                      className="w-full text-xs p-2.5 bg-transparent border border-vpa-olive-light focus:outline-none focus:border-vpa-gold text-vpa-olive dark:text-vpa-sand"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] uppercase tracking-wider text-gray-500 mb-1">Dạng câu hỏi</label>
                    <select
                      value={bankQType}
                      onChange={e => {
                        const type = e.target.value;
                        let options: string[] = [];
                        let correctAnswers: string[] = ['0'];
                        if (type === 'multiple-choice') options = ['', '', '', ''];
                        if (type === 'true-false') {
                          options = ['Đúng', 'Sai'];
                          correctAnswers = ['0'];
                        }
                        if (type === 'fill-in-the-blank') {
                          options = [];
                          correctAnswers = [''];
                        }
                        setBankQType(type);
                        setBankQOptions(options);
                        setBankQAnswers(correctAnswers);
                      }}
                      className="w-full text-xs p-2.5 bg-transparent border border-vpa-olive-light focus:outline-none focus:border-vpa-gold dark:bg-vpa-dark-card text-vpa-olive dark:text-vpa-sand"
                    >
                      <option value="multiple-choice">Trắc nghiệm A, B, C, D</option>
                      <option value="true-false">Đúng / Sai</option>
                      <option value="fill-in-the-blank">Điền vào ô trống</option>
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <label className="block text-[10px] uppercase tracking-wider text-gray-500 mb-1">Chuyên ngành</label>
                    <select
                      value={bankQCategory}
                      onChange={e => setBankQCategory(e.target.value)}
                      className="w-full text-xs p-2.5 bg-transparent border border-vpa-olive-light focus:outline-none focus:border-vpa-gold dark:bg-vpa-dark-card text-vpa-olive dark:text-vpa-sand"
                    >
                      {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-[10px] uppercase tracking-wider text-gray-500 mb-1">Độ khó của câu hỏi</label>
                    <select
                      value={bankQDifficulty}
                      onChange={e => setBankQDifficulty(e.target.value)}
                      className="w-full text-xs p-2.5 bg-transparent border border-vpa-olive-light focus:outline-none focus:border-vpa-gold dark:bg-vpa-dark-card text-vpa-olive dark:text-vpa-sand"
                    >
                      {DIFFICULTIES.map(d => <option key={d} value={d}>{d}</option>)}
                    </select>
                  </div>
                </div>

                {bankQType === 'multiple-choice' && (
                  <div className="space-y-3">
                    <label className="block text-[10px] uppercase tracking-wider text-gray-500">Các đáp án lựa chọn (Chọn đáp án đúng)</label>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {bankQOptions.map((opt: string, optIdx: number) => {
                        const letter = String.fromCharCode(65 + optIdx);
                        const isCorrect = bankQAnswers.includes(optIdx.toString());

                        return (
                          <div key={optIdx} className="flex items-center space-x-2">
                            <button
                              type="button"
                              onClick={() => setBankQAnswers([optIdx.toString()])}
                              className={`w-6 h-6 border flex items-center justify-center font-bold text-xs ${
                                isCorrect 
                                  ? 'bg-vpa-olive text-white dark:bg-vpa-gold dark:text-vpa-dark border-transparent' 
                                  : 'border-vpa-olive-light/50 text-gray-400'
                              }`}
                            >
                              {isCorrect ? <Check size={14} /> : letter}
                            </button>
                            <input
                              type="text"
                              required
                              value={opt}
                              onChange={e => {
                                const updated = [...bankQOptions];
                                updated[optIdx] = e.target.value;
                                setBankQOptions(updated);
                              }}
                              placeholder={`Lựa chọn ${letter}`}
                              className="w-full text-xs p-2 bg-transparent border border-vpa-olive-light/50 focus:outline-none focus:border-vpa-gold text-vpa-olive dark:text-vpa-sand"
                            />
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {bankQType === 'true-false' && (
                  <div className="flex space-x-6">
                    <button
                      type="button"
                      onClick={() => setBankQAnswers(['0'])}
                      className={`px-4 py-2 border text-xs uppercase font-bold ${
                        bankQAnswers.includes('0')
                          ? 'bg-vpa-olive text-white dark:bg-vpa-gold dark:text-vpa-dark border-transparent'
                          : 'border-vpa-olive-light/50 text-gray-400'
                      }`}
                    >
                      Đúng
                    </button>
                    <button
                      type="button"
                      onClick={() => setBankQAnswers(['1'])}
                      className={`px-4 py-2 border text-xs uppercase font-bold ${
                        bankQAnswers.includes('1')
                          ? 'bg-vpa-olive text-white dark:bg-vpa-gold dark:text-vpa-dark border-transparent'
                          : 'border-vpa-olive-light/50 text-gray-400'
                      }`}
                    >
                      Sai
                    </button>
                  </div>
                )}

                {bankQType === 'fill-in-the-blank' && (
                  <div>
                    <label className="block text-[10px] uppercase tracking-wider text-gray-500 mb-1">Cụm từ đáp án chính xác</label>
                    <input
                      type="text"
                      required
                      value={bankQAnswers[0] || ''}
                      onChange={e => setBankQAnswers([e.target.value])}
                      placeholder="Cụm từ chính xác..."
                      className="w-full text-xs p-2 bg-transparent border border-vpa-olive-light focus:outline-none focus:border-vpa-gold text-vpa-olive dark:text-vpa-sand"
                    />
                  </div>
                )}

                <div>
                  <label className="block text-[10px] uppercase tracking-wider text-gray-500 mb-1">Giải thích chi tiết</label>
                  <input
                    type="text"
                    value={bankQExplanation}
                    onChange={e => setBankQExplanation(e.target.value)}
                    placeholder="VD: Căn cứ Điều 1 Luật Nghĩa vụ Quân sự..."
                    className="w-full text-xs p-2.5 bg-transparent border border-vpa-olive-light/50 focus:outline-none focus:border-vpa-gold text-vpa-olive dark:text-vpa-sand"
                  />
                </div>
              </div>

              <div className="flex justify-end space-x-4 border-t border-vpa-olive-light/30 pt-6">
                <button
                  type="button"
                  onClick={() => { setIsAddingToBank(false); resetBankQForm(); }}
                  className="px-4 py-2 border border-vpa-olive-light text-xs uppercase tracking-wider text-vpa-olive dark:text-vpa-sand hover:bg-vpa-olive hover:text-white"
                >
                  Hủy bỏ
                </button>
                <button
                  type="submit"
                  className="px-6 py-2 bg-vpa-olive dark:bg-vpa-gold text-white dark:text-vpa-dark text-xs uppercase font-bold tracking-wider hover:bg-vpa-olive-light dark:hover:bg-vpa-gold-bright"
                >
                  Lưu vào ngân hàng
                </button>
              </div>
            </form>
          )}
        </>
      )}

      {/* --- C. VIEW QUIZ DETAILS MODAL --- */}
      {viewingQuiz && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
          <div className="w-full max-w-4xl border border-vpa-olive-light bg-vpa-sand-light dark:bg-vpa-dark-card p-6 shadow-2xl rounded-none max-h-[85vh] overflow-y-auto relative">
            
            {/* Header */}
            <div className="flex justify-between items-center border-b border-vpa-olive-light pb-3 mb-6">
              <div>
                <span className="text-[10px] font-mono text-vpa-gold uppercase font-bold mr-2">Chi tiết đề thi</span>
                <h3 className="text-sm font-bold uppercase text-vpa-olive dark:text-vpa-sand inline-block">
                  {viewingQuiz.title}
                </h3>
              </div>
              <button
                onClick={() => setViewingQuiz(null)}
                className="text-xs uppercase font-bold hover:underline text-vpa-red"
              >
                Đóng lại
              </button>
            </div>

            {/* General parameters */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6 pb-6 border-b border-dashed border-vpa-olive-light/30 text-xs">
              <div><span className="text-gray-500 uppercase">Chuyên ngành:</span> <span className="font-bold">{viewingQuiz.category}</span></div>
              <div><span className="text-gray-500 uppercase">Thời gian làm bài:</span> <span className="font-bold">{viewingQuiz.duration} phút</span></div>
              <div><span className="text-gray-500 uppercase">Điểm vượt qua:</span> <span className="font-bold">{viewingQuiz.passingScorePercent}%</span></div>
            </div>

            {/* Questions list */}
            <div className="space-y-6">
              {viewingQuiz.questions.map((q: any, qIdx: number) => (
                <div key={q._id || qIdx} className="border border-vpa-olive-light/30 bg-vpa-sand/35 dark:bg-vpa-dark/30 p-4">
                  <h4 className="text-xs font-bold text-vpa-olive dark:text-vpa-sand mb-3 leading-relaxed">
                    Câu {qIdx + 1}: {q.questionText}
                  </h4>

                  {q.questionType === 'multiple-choice' && (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pl-4 mb-3 text-xs">
                      {q.options.map((opt: string, oIdx: number) => {
                        const letter = String.fromCharCode(65 + oIdx);
                        const isCorrect = q.correctAnswers.includes(oIdx.toString());

                        return (
                          <div
                            key={oIdx}
                            className={`p-2 border ${
                              isCorrect 
                                ? 'border-green-500 bg-green-500/10 text-green-700 dark:text-green-400 font-bold' 
                                : 'border-vpa-olive-light/20 text-gray-500'
                            }`}
                          >
                            {letter}. {opt}
                          </div>
                        );
                      })}
                    </div>
                  )}

                  {q.questionType === 'true-false' && (
                    <div className="flex space-x-6 pl-4 mb-3 text-xs">
                      <div className={`p-2 px-4 border ${q.correctAnswers.includes('0') ? 'border-green-500 bg-green-500/10 text-green-700 dark:text-green-400 font-bold' : 'border-vpa-olive-light/20'}`}>Đúng</div>
                      <div className={`p-2 px-4 border ${q.correctAnswers.includes('1') ? 'border-green-500 bg-green-500/10 text-green-700 dark:text-green-400 font-bold' : 'border-vpa-olive-light/20'}`}>Sai</div>
                    </div>
                  )}

                  {q.questionType === 'fill-in-the-blank' && (
                    <div className="pl-4 mb-3 text-xs">
                      <span className="text-gray-500">Đáp án điền:</span> <span className="font-bold text-green-700 dark:text-green-400">{q.correctAnswers[0]}</span>
                    </div>
                  )}

                  {q.explanation && (
                    <div className="mt-2 text-[10px] text-gray-400 italic">
                      Giải thích: {q.explanation}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* VPA Output custom settings popup */}
      <VPAExportPopup
        isOpen={showExportPopup}
        defaultUnit={user?.unit}
        defaultPosition={user?.position}
        defaultRank={user?.rank}
        defaultName={user?.fullName}
        type="quiz"
        previewData={selectedQuizForExport}
        onCancel={() => { setShowExportPopup(false); setSelectedQuizForExport(null); }}
        onConfirm={handleExportConfirm}
      />

      {/* Printable VPA Quiz Document Container */}
      {printData && createPortal(
        <div className="print-area-only p-12 text-black bg-white leading-relaxed text-sm font-serif" style={{ fontFamily: "'Times New Roman', Times, serif" }}>
          {/* Header */}
          <div className="flex justify-between items-start text-xs leading-normal mb-8 font-serif">
            <div className="text-center w-[45%] font-serif">
              <p className="uppercase font-serif">{printData.upperUnit}</p>
              <p className="font-bold uppercase font-serif">{printData.currentUnit}</p>
              <p className="font-bold mt-0.5">---------</p>
            </div>
            <div className="text-center w-[50%] font-serif">
              <p className="font-bold text-[13px] font-serif">CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM</p>
              <p className="font-bold border-b border-black pb-1 inline-block mx-auto text-[13px] font-serif">
                Độc lập - Tự do - Hạnh phúc
              </p>
              <p className="italic mt-1.5 font-serif">
                {printData.province}, ngày {new Date().getDate()} tháng {new Date().getMonth() + 1} năm {new Date().getFullYear()}
              </p>
            </div>
          </div>

          {/* Title */}
          <div className="text-center my-6 font-serif">
            <h2 className="text-lg font-bold uppercase tracking-wide font-serif">ĐỀ THI TRẮC NGHIỆM</h2>
            <p className="font-bold mt-1 font-serif">
              MÔN: {printData.quiz?.title?.toUpperCase()}
            </p>
            <p className="italic mt-1 text-xs font-serif">
              Thời gian làm bài: {printData.quiz?.duration || 45} phút (Không kể thời gian giao đề)
            </p>
          </div>

          {/* Question List */}
          <div className="space-y-4 my-6 font-serif">
            {(printData.quiz?.questions || []).map((q: any, idx: number) => (
              <div key={idx} className="font-serif text-sm">
                <p className="font-bold font-serif">Câu {idx + 1}: {q.questionText}</p>
                {q.questionType === 'fill-in-the-blank' ? (
                  <p className="pl-8 italic text-gray-500 font-serif mt-1">
                    Đáp án: ................................................................................................................
                  </p>
                ) : (
                  <div className="grid grid-cols-2 gap-x-4 pl-8 mt-1 font-serif">
                    {(q.options || []).map((opt: string, oIdx: number) => (
                      <p key={oIdx} className="font-serif">
                        {String.fromCharCode(65 + oIdx)}. {opt}
                      </p>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>

          {/* Signatures */}
          {printData.showSignature && (
            <div className="flex justify-end mt-12 font-serif">
              <div className="text-center w-[45%] font-serif">
                <p className="font-bold uppercase font-serif text-sm">{printData.position}</p>
                <p className="italic text-xs text-gray-500 mb-16 font-serif">(Ký, ghi rõ họ tên)</p>
                <p className="font-bold text-sm font-serif">{printData.signerRank} {printData.signerName}</p>
              </div>
            </div>
          )}
        </div>,
        document.body
      )}
    </div>
  );
};
export default QuizManagement;
