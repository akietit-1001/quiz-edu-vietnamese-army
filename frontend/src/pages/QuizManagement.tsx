import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import axios from 'axios';
import { Plus, Trash, UploadSimple, ArrowLeft, PlusCircle, Check, Shuffle, Database, MagnifyingGlass, Funnel, PlusIcon, UploadSimpleIcon, ShuffleIcon, PencilSimple, Brain, MagnifyingGlassIcon, BrainIcon } from '@phosphor-icons/react';
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
  const [activeVersionTab, setActiveVersionTab] = useState<string>('parent');

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
    marginTop?: number;
    marginBottom?: number;
    marginLeft?: number;
    marginRight?: number;
    mirrorMargins?: boolean;
    orientation?: 'portrait' | 'landscape';
    quizzes: any[];
  } | null>(null);

  useEffect(() => {
    if (printData) {
      const originalTitle = document.title;
      const firstQuiz = printData.quizzes && printData.quizzes.length > 0 ? printData.quizzes[0] : null;
      const cleanTitle = (firstQuiz?.title || 'De_thi')
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
  const [isGeneratingAI, setIsGeneratingAI] = useState(false);

  // AI generation state
  const [aiCategory, setAiCategory] = useState('Khác');
  const [aiNumQuestions, setAiNumQuestions] = useState(10);
  const [aiFiles, setAiFiles] = useState<File[]>([]);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiProgressStep, setAiProgressStep] = useState(1);
  const [quizzesLoading, setQuizzesLoading] = useState(true);
  const [bankLoading, setBankLoading] = useState(true);

  // Manual quiz state
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState('Khác');
  const [duration, setDuration] = useState(45);
  const [passingScore, setPassingScore] = useState(50);
  const [isPublic, setIsPublic] = useState(false);
  const [questions, setQuestions] = useState<any[]>([]);
  const [documentHash, setDocumentHash] = useState<string | null>(null);
  const [numCodes, setNumCodes] = useState<number>(1);

  // Import state
  const [importTitle, setImportTitle] = useState('');
  const [importCategory, setImportCategory] = useState('Chính trị');
  const [importDuration, setImportDuration] = useState(45);
  const [importPassingScore, setImportPassingScore] = useState(50);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [activeDropdownQuizId, setActiveDropdownQuizId] = useState<string | null>(null);

  // Question Bank state
  const [bankQuestions, setBankQuestions] = useState<any[]>([]);
  const [searchBank, setSearchBank] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [difficultyFilter, setDifficultyFilter] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [bankPage, setBankPage] = useState(1);
  const bankPageSize = 10;

  // Sorting state for Question Bank
  const [bankSortField, setBankSortField] = useState<string>('createdAt');
  const [bankSortOrder, setBankSortOrder] = useState<'asc' | 'desc'>('desc');

  const handleBankSort = (field: string) => {
    if (bankSortField === field) {
      setBankSortOrder(bankSortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setBankSortField(field);
      setBankSortOrder('asc');
    }
  };

  // Total pages and counts state for server-side pagination
  const [totalBankPages, setTotalBankPages] = useState(1);
  const [totalBankCount, setTotalBankCount] = useState(0);
  const [totalQuizPages, setTotalQuizPages] = useState(1);
  const [totalQuizCount, setTotalQuizCount] = useState(0);

  // Quizzes list states for search and pagination
  const [searchQuiz, setSearchQuiz] = useState('');
  const [quizCategoryFilter, setQuizCategoryFilter] = useState('');
  const [quizPage, setQuizPage] = useState(1);
  const quizPageSize = 10;

  const displayedBankQuestions = bankQuestions;
  const startBankIndex = (bankPage - 1) * bankPageSize;
  const startQuizIndex = (quizPage - 1) * quizPageSize;
  const displayedQuizzes = quizzes;

  // Sorting state for Quizzes
  const [quizSortField, setQuizSortField] = useState<string>('createdAt');
  const [quizSortOrder, setQuizSortOrder] = useState<'asc' | 'desc'>('desc');

  const handleQuizSort = (field: string) => {
    if (quizSortField === field) {
      setQuizSortOrder(quizSortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setQuizSortField(field);
      setQuizSortOrder('asc');
    }
  };

  const renderSortIndicator = (field: string, currentField: string, order: 'asc' | 'desc') => {
    if (currentField !== field) {
      return <span className="inline-block ml-1 opacity-30 select-none cursor-pointer">↕</span>;
    }
    return (
      <span className="inline-block ml-1 text-vpa-gold font-bold select-none">
        {order === 'asc' ? '↑' : '↓'}
      </span>
    );
  };

  // Single bank question state (for adding to bank)
  const [bankQText, setBankQText] = useState('');
  const [bankQType, setBankQType] = useState('multiple-choice');
  const [bankQOptions, setBankQOptions] = useState<string[]>(['', '', '', '']);
  const [bankQAnswers, setBankQAnswers] = useState<string[]>(['0']);
  const [bankQExplanation, setBankQExplanation] = useState('');
  const [bankQCategory, setBankQCategory] = useState('Chính trị');
  const [bankQDifficulty, setBankQDifficulty] = useState('Trung bình');
  const [editingBankQId, setEditingBankQId] = useState<string | null>(null);

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
  }, [quizPage, searchQuiz, quizCategoryFilter, quizSortField, quizSortOrder]);

  useEffect(() => {
    if (currentTab === 'bank') {
      fetchBankQuestions();
    }
  }, [currentTab, bankPage, categoryFilter, difficultyFilter, typeFilter, searchBank, bankSortField, bankSortOrder]);

  useEffect(() => {
    setQuizPage(1);
  }, [searchQuiz, quizCategoryFilter]);

  useEffect(() => {
    setBankPage(1);
  }, [searchBank, categoryFilter, difficultyFilter, typeFilter]);

  useEffect(() => {
    let interval: any;
    if (aiLoading) {
      setAiProgressStep(1);
      interval = setInterval(() => {
        setAiProgressStep(prev => {
          if (prev < 3) return prev + 1;
          return prev;
        });
      }, 2500);
    } else {
      setAiProgressStep(1);
    }
    return () => clearInterval(interval);
  }, [aiLoading]);

  const fetchQuizzes = async () => {
    setQuizzesLoading(true);
    try {
      const res = await axios.get('/api/quizzes', {
        params: {
          page: quizPage,
          limit: quizPageSize,
          search: searchQuiz || undefined,
          category: quizCategoryFilter || undefined,
          sortField: quizSortField,
          sortOrder: quizSortOrder
        }
      });
      const data = res.data;
      if (Array.isArray(data)) {
        setQuizzes(data);
        setTotalQuizPages(1);
        setTotalQuizCount(data.length);
      } else {
        setQuizzes(data.quizzes || []);
        setTotalQuizPages(data.totalPages || 1);
        setTotalQuizCount(data.totalCount || 0);
      }
    } catch (err) {
      console.error('Lỗi fetch đề thi:', err);
    } finally {
      setQuizzesLoading(false);
    }
  };

  const fetchBankQuestions = async () => {
    setBankLoading(true);
    try {
      const res = await axios.get('/api/bank', {
        params: {
          page: bankPage,
          limit: bankPageSize,
          category: categoryFilter || undefined,
          difficulty: difficultyFilter || undefined,
          questionType: typeFilter || undefined,
          search: searchBank || undefined,
          sortField: bankSortField,
          sortOrder: bankSortOrder
        }
      });
      const data = res.data;
      if (Array.isArray(data)) {
        setBankQuestions(data);
        setTotalBankPages(1);
        setTotalBankCount(data.length);
      } else {
        setBankQuestions(data.questions || []);
        setTotalBankPages(data.totalPages || 1);
        setTotalBankCount(data.totalCount || 0);
      }
    } catch (err) {
      console.error('Lỗi fetch câu hỏi ngân hàng:', err);
    } finally {
      setBankLoading(false);
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
        questions,
        documentHash,
        numCodes: editingQuizId ? 1 : numCodes
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

  const handleEditQuiz = async (quiz: any) => {
    try {
      const res = await axios.get(`/api/quizzes/${quiz._id}`);
      const fullQuiz = res.data;
      setEditingQuizId(fullQuiz._id);
      setTitle(fullQuiz.title);
      setDescription(fullQuiz.description || '');
      setCategory(fullQuiz.category);
      setDuration(fullQuiz.duration);
      setPassingScore(fullQuiz.passingScorePercent || 50);
      setIsPublic(fullQuiz.isPublic || false);
      setQuestions(fullQuiz.questions || []);
      setDocumentHash(fullQuiz.documentHash || null);
      setIsCreating(true);
    } catch (err) {
      console.error(err);
      await window.showAlert('Không thể tải chi tiết đề thi để chỉnh sửa.', 'Lỗi tải đề thi');
    }
  };

  const handleViewQuiz = async (quiz: any) => {
    try {
      const res = await axios.get(`/api/quizzes/${quiz._id}`);
      setViewingQuiz(res.data);
      setActiveVersionTab('parent');
    } catch (err) {
      console.error(err);
      await window.showAlert('Không thể tải chi tiết đề thi để xem.', 'Lỗi tải đề thi');
    }
  };

  const handleOpenExportPopup = async (quiz: any) => {
    try {
      const res = await axios.get(`/api/quizzes/${quiz._id}?includeVariants=true`);
      setSelectedQuizForExport(res.data);
      setShowExportPopup(true);
    } catch (err) {
      console.error(err);
      await window.showAlert('Không thể tải thông tin đề thi và các mã đề để xuất bản.', 'Lỗi tải đề thi');
    }
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
    marginTop: number;
    marginBottom: number;
    marginLeft: number;
    marginRight: number;
    mirrorMargins: boolean;
    orientation?: 'portrait' | 'landscape';
    selectedQuizIds?: string[];
  }) => {
    setShowExportPopup(false);
    if (!selectedQuizForExport) return;

    // Resolve list of quizzes to export
    const targetIds = vpaData.selectedQuizIds && vpaData.selectedQuizIds.length > 0
      ? vpaData.selectedQuizIds
      : [selectedQuizForExport._id];

    // Find the actual quiz objects for each ID
    const quizListToExport = targetIds.map((id: string) => {
      if (id === selectedQuizForExport._id) return selectedQuizForExport;
      const foundVariant = (selectedQuizForExport.variants || []).find((q: any) => q._id === id);
      return foundVariant || null;
    }).filter(Boolean);

    if (quizListToExport.length === 0) return;

    if (vpaData.format === 'pdf') {
      setPrintData({
        upperUnit: vpaData.upperUnit,
        currentUnit: vpaData.currentUnit,
        province: vpaData.province,
        position: vpaData.position,
        showSignature: vpaData.showSignature,
        signerRank: vpaData.signerRank,
        signerName: vpaData.signerName,
        marginTop: vpaData.marginTop,
        marginBottom: vpaData.marginBottom,
        marginLeft: vpaData.marginLeft,
        marginRight: vpaData.marginRight,
        mirrorMargins: vpaData.mirrorMargins,
        orientation: vpaData.orientation,
        quizzes: quizListToExport
      });
      return;
    }

    try {
      const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));
      for (let i = 0; i < quizListToExport.length; i++) {
        const currentQuiz = quizListToExport[i];
        const response = await axios.get(`/api/quizzes/${currentQuiz._id}/export`, {
          params: {
            upperUnit: vpaData.upperUnit,
            currentUnit: vpaData.currentUnit,
            province: vpaData.province,
            position: vpaData.position,
            showSignature: vpaData.showSignature,
            signerRank: vpaData.signerRank,
            signerName: vpaData.signerName,
            marginTop: vpaData.marginTop,
            marginBottom: vpaData.marginBottom,
            marginLeft: vpaData.marginLeft,
            marginRight: vpaData.marginRight,
            orientation: vpaData.orientation
          },
          responseType: 'blob'
        });
        const blobUrl = window.URL.createObjectURL(new Blob([response.data]));
        const link = document.createElement('a');
        link.href = blobUrl;
        link.setAttribute('download', `De_thi_${currentQuiz.shareCode || currentQuiz.examCode || 'code'}.docx`);
        document.body.appendChild(link);
        link.click();
        link.parentNode?.removeChild(link);

        if (i < quizListToExport.length - 1) {
          await delay(600); // 600ms gap to prevent browser blocking multiple downloads
        }
      }
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

  // AI Generation Handlers
  const handleAIFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const newFiles = Array.from(e.target.files);
      
      setAiFiles(prev => {
        const combined = [...prev];
        newFiles.forEach(nf => {
          const isDuplicate = combined.some(f => f.name === nf.name && f.size === nf.size);
          if (!isDuplicate) {
            combined.push(nf);
          }
        });

        const totalSize = combined.reduce((acc, f) => acc + f.size, 0);
        const MAX_SIZE = 10 * 1024 * 1024; // 10MB limit
        if (totalSize > MAX_SIZE) {
          window.showAlert(`Tổng dung lượng các tệp tin đã chọn vượt quá giới hạn 10MB. Dung lượng sau khi thêm: ${(totalSize / (1024 * 1024)).toFixed(2)}MB.`, 'Lỗi chọn tệp');
          return prev;
        }

        return combined;
      });

      // Reset value to allow selecting the same file again if removed
      e.target.value = '';
    }
  };

  const handleRemoveFile = (indexToRemove: number) => {
    setAiFiles(prev => prev.filter((_, idx) => idx !== indexToRemove));
  };

  const formatBytes = (bytes: number, decimals = 2) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const dm = decimals < 0 ? 0 : decimals;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
  };

  const getFileIcon = (extension?: string) => {
    switch (extension) {
      case 'pdf':
        return (
          <div className="w-8 h-8 flex items-center justify-center bg-red-100 dark:bg-red-950/40 rounded text-red-600 dark:text-red-400 flex-shrink-0 font-bold text-[9px] border border-red-200 dark:border-red-900/50">
            PDF
          </div>
        );
      case 'doc':
      case 'docx':
        return (
          <div className="w-8 h-8 flex items-center justify-center bg-blue-100 dark:bg-blue-950/40 rounded text-blue-600 dark:text-blue-400 flex-shrink-0 font-bold text-[9px] border border-blue-200 dark:border-blue-900/50">
            DOC
          </div>
        );
      case 'xls':
      case 'xlsx':
      case 'csv':
        return (
          <div className="w-8 h-8 flex items-center justify-center bg-emerald-100 dark:bg-emerald-950/40 rounded text-emerald-600 dark:text-emerald-400 flex-shrink-0 font-bold text-[9px] border border-emerald-200 dark:border-emerald-900/50">
            EXCEL
          </div>
        );
      default:
        return (
          <div className="w-8 h-8 flex items-center justify-center bg-gray-100 dark:bg-gray-800 rounded text-gray-600 dark:text-gray-400 flex-shrink-0 font-bold text-[9px] border border-gray-200 dark:border-gray-700">
            TXT
          </div>
        );
    }
  };

  const populateQuizPreview = (quiz: any, originalFileName?: string) => {
    setTitle(quiz.title || `Đề thi AI - ${originalFileName ? originalFileName.split('.')[0] : 'Tài liệu'}`);
    setDescription(quiz.description || `Đề thi tự động sinh từ tài liệu ${originalFileName || ''}`);
    setCategory(quiz.category || aiCategory);
    setDuration(quiz.duration || (quiz.questions?.length ? quiz.questions.length * 2 : 20));
    setPassingScore(50);
    setIsPublic(false);
    setQuestions(quiz.questions || []);
    setDocumentHash(quiz.documentHash || null);

    // Switch to manual editing form
    setIsCreating(true);
    setIsGeneratingAI(false);
    setAiFiles([]);
  };

  const handleAIGenerateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (aiFiles.length === 0) return;

    setAiLoading(true);
    const originalName = aiFiles[0].name + (aiFiles.length > 1 ? ` (+ ${aiFiles.length - 1} tệp khác)` : '');
    const formData = new FormData();
    aiFiles.forEach(file => {
      formData.append('files', file);
    });
    formData.append('numQuestions', aiNumQuestions.toString());
    formData.append('category', aiCategory);

    try {
      const res = await axios.post('/api/quizzes/generate-from-file', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      
      // Cache hit / Direct response (Firebase / synchronous backend)
      if (res.status === 200) {
        const { message, quiz } = res.data;
        await window.showAlert(message || 'Đã sinh đề thi thành công bằng AI!', 'Sinh đề AI');
        populateQuizPreview(quiz, originalName);
        setAiLoading(false);
        return;
      }

      // Cache miss / Queue fallback (if running locally with Redis)
      const { jobId } = res.data;
      
      // Poll job status every 2 seconds
      const pollInterval = setInterval(async () => {
        try {
          const statusRes = await axios.get(`/api/quizzes/generate-status/${jobId}`);
          const { status, quiz, message } = statusRes.data;

          if (status === 'completed') {
            clearInterval(pollInterval);
            await window.showAlert('Đã sinh câu hỏi thành công bằng AI!', 'Sinh đề AI');
            populateQuizPreview(quiz, originalName);
            setAiLoading(false);
          } else if (status === 'failed') {
            clearInterval(pollInterval);
            await window.showAlert(message || 'Tiến trình sinh đề thi thất bại.', 'Lỗi sinh đề thi AI');
            setAiLoading(false);
          }
        } catch (pollErr: any) {
          clearInterval(pollInterval);
          const errMsg = pollErr.response?.data?.message || 'Lỗi kiểm tra tiến trình sinh đề AI.';
          await window.showAlert(errMsg, 'Lỗi sinh đề thi AI');
          setAiLoading(false);
        }
      }, 2000);

    } catch (err: any) {
      const errMsg = err.response?.data?.message || 'Lỗi sinh đề thi bằng AI.';
      await window.showAlert(errMsg, 'Lỗi sinh đề thi AI');
      setAiLoading(false);
    }
  };

  // Question Bank operations
  const handleAddQuestionToBank = async (e: any) => {
    e.preventDefault();
    try {
      if (editingBankQId) {
        await axios.put(`/api/bank/${editingBankQId}`, {
          questionType: bankQType,
          questionText: bankQText,
          options: bankQOptions,
          correctAnswers: bankQAnswers,
          explanation: bankQExplanation,
          category: bankQCategory,
          difficulty: bankQDifficulty
        });
      } else {
        await axios.post('/api/bank', {
          questionType: bankQType,
          questionText: bankQText,
          options: bankQOptions,
          correctAnswers: bankQAnswers,
          explanation: bankQExplanation,
          category: bankQCategory,
          difficulty: bankQDifficulty
        });
      }
      setIsAddingToBank(false);
      resetBankQForm();
      fetchBankQuestions();
      await window.showAlert(
        editingBankQId ? 'Đã cập nhật câu hỏi thành công!' : 'Đã thêm câu hỏi vào ngân hàng thành công!',
        'Ngân hàng câu hỏi'
      );
    } catch (err: any) {
      await window.showAlert(err.response?.data?.message || 'Lỗi lưu câu hỏi vào ngân hàng.', 'Lỗi lưu câu hỏi');
    }
  };

  const handleEditBankQ = (q: any) => {
    setEditingBankQId(q._id);
    setBankQText(q.questionText);
    setBankQType(q.questionType);
    setBankQOptions(q.options || []);
    setBankQAnswers(q.correctAnswers || []);
    setBankQExplanation(q.explanation || '');
    setBankQCategory(q.category);
    setBankQDifficulty(q.difficulty);
    setIsAddingToBank(true);
  };

  const handleDeleteBankQ = async (id: string) => {
    const confirmDelete = await window.showConfirm('Đồng chí có chắc chắn muốn xóa câu hỏi này khỏi ngân hàng?', 'Xóa câu hỏi ngân hàng');
    if (!confirmDelete) return;
    try {
      await axios.delete(`/api/bank/${id}`);
      fetchBankQuestions();
      await window.showAlert('Đã xóa câu hỏi khỏi ngân hàng thành công!', 'Xóa câu hỏi');
    } catch (err: any) {
      await window.showAlert(err.response?.data?.message || 'Lỗi xóa câu hỏi.', 'Lỗi xóa câu hỏi');
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
    setDocumentHash(null);
    setNumCodes(1);
  };

  const resetBankQForm = () => {
    setBankQText('');
    setBankQType('multiple-choice');
    setBankQOptions(['', '', '', '']);
    setBankQAnswers(['0']);
    setBankQExplanation('');
    setBankQCategory('Chính trị');
    setBankQDifficulty('Trung bình');
    setEditingBankQId(null);
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
        {!isCreating && !isImporting && !isGenerating && !isAddingToBank && !isGeneratingAI && (
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
          {!isCreating && !isImporting && !isGenerating && !isGeneratingAI && (
            <div className="flex justify-between items-center mb-6">
              {/* <span className="text-[10px] font-mono uppercase tracking-wider text-gray-500">
                Các đề thi có sẵn trên hệ thống
              </span> */}
              <div className="flex space-x-3 flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => setIsGeneratingAI(true)}
                  className="px-3 py-1.5 border border-vpa-gold text-vpa-gold hover:bg-vpa-gold/10 text-xs font-bold uppercase tracking-wider flex items-center space-x-2"
                >
                  <BrainIcon size={16} />
                  <span>Tạo đề bằng AI</span>
                </button>
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

          {/* Search & Filter Bar for Quizzes */}
          {!isCreating && !isImporting && !isGenerating && !isGeneratingAI && (
            <div className="border border-vpa-olive-light/50 bg-vpa-sand-light dark:bg-vpa-dark-card p-4 mb-6 shadow-sm flex flex-wrap gap-4 items-center">
              <div className="relative">
                <input
                  type="text"
                  value={searchQuiz}
                  onChange={e => setSearchQuiz(e.target.value)}
                  placeholder="Tìm kiếm đề thi..."
                  className="text-xs p-2 pl-8 bg-transparent border border-vpa-olive-light focus:outline-none focus:border-vpa-gold text-vpa-olive dark:text-vpa-sand w-64"
                />
                <MagnifyingGlassIcon size={14} className="absolute left-2.5 top-3 text-gray-500" />
              </div>
              
              <div className="flex items-center space-x-1">
                <Funnel size={14} className="text-vpa-gold" />
                <select
                  value={quizCategoryFilter}
                  onChange={e => setQuizCategoryFilter(e.target.value)}
                  className="text-xs bg-transparent border-b border-vpa-olive-light text-vpa-olive dark:text-vpa-sand focus:outline-none dark:bg-vpa-dark-card"
                >
                  <option value="">Tất cả chuyên ngành</option>
                  {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
            </div>
          )}

          {/* List Quizzes Table */}
          {!isCreating && !isImporting && !isGenerating && !isGeneratingAI && (
            <div className="border border-vpa-olive-light/50 bg-vpa-sand-light dark:bg-vpa-dark-card p-6 shadow-md rounded-none">
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="border-b border-vpa-olive-light/30 text-gray-500 font-mono uppercase text-[10px]">
                      <th className="py-3 px-4 cursor-pointer hover:text-vpa-gold transition-colors select-none" onClick={() => handleQuizSort('title')}>
                        Tên đề thi {renderSortIndicator('title', quizSortField, quizSortOrder)}
                      </th>
                      <th className="py-3 px-4 cursor-pointer hover:text-vpa-gold transition-colors select-none" onClick={() => handleQuizSort('category')}>
                        Chuyên ngành {renderSortIndicator('category', quizSortField, quizSortOrder)}
                      </th>
                      <th className="py-3 px-4 cursor-pointer hover:text-vpa-gold transition-colors select-none" onClick={() => handleQuizSort('duration')}>
                        Thông tin đề {renderSortIndicator('duration', quizSortField, quizSortOrder)}
                      </th>
                      <th className="py-3 px-4 cursor-pointer hover:text-vpa-gold transition-colors select-none" onClick={() => handleQuizSort('author')}>
                        Đồng chí soạn {renderSortIndicator('author', quizSortField, quizSortOrder)}
                      </th>
                      <th className="py-3 px-4 cursor-pointer hover:text-vpa-gold transition-colors select-none" onClick={() => handleQuizSort('createdAt')}>
                        Thời gian tạo {renderSortIndicator('createdAt', quizSortField, quizSortOrder)}
                      </th>
                      <th className="py-3 px-4 cursor-pointer hover:text-vpa-gold transition-colors select-none" onClick={() => handleQuizSort('isPublic')}>
                        Trạng thái {renderSortIndicator('isPublic', quizSortField, quizSortOrder)}
                      </th>
                      <th className="py-3 px-4 cursor-pointer hover:text-vpa-gold transition-colors select-none" onClick={() => handleQuizSort('shareCode')}>
                        Mã chia sẻ {renderSortIndicator('shareCode', quizSortField, quizSortOrder)}
                      </th>
                      <th className="py-3 px-4 text-right">Thao tác</th>
                    </tr>
                  </thead>
                  <tbody>
                    {quizzesLoading ? (
                      Array.from({ length: 5 }).map((_, idx) => (
                        <tr key={idx} className="border-b border-vpa-olive-light/10 animate-pulse">
                          <td className="py-4 px-4">
                            <div className="w-40 h-4 bg-vpa-olive-light/20 dark:bg-vpa-gold/15 rounded"></div>
                          </td>
                          <td className="py-4 px-4">
                            <div className="w-24 h-4 bg-vpa-olive-light/10 dark:bg-vpa-gold/10 rounded"></div>
                          </td>
                          <td className="py-4 px-4">
                            <div className="w-32 h-4 bg-vpa-olive-light/10 dark:bg-vpa-gold/10 rounded"></div>
                          </td>
                          <td className="py-4 px-4">
                            <div className="w-24 h-4 bg-vpa-olive-light/10 dark:bg-vpa-gold/10 rounded"></div>
                          </td>
                          <td className="py-4 px-4">
                            <div className="w-24 h-4 bg-vpa-olive-light/10 dark:bg-vpa-gold/10 rounded"></div>
                          </td>
                          <td className="py-4 px-4">
                            <div className="w-16 h-4 bg-vpa-olive-light/15 dark:bg-vpa-gold/10 rounded"></div>
                          </td>
                          <td className="py-4 px-4">
                            <div className="w-16 h-4 bg-vpa-olive-light/20 dark:bg-vpa-gold/15 rounded font-mono"></div>
                          </td>
                          <td className="py-4 px-4 text-right flex justify-end space-x-2">
                            <div className="w-12 h-6 bg-vpa-olive-light/10 dark:bg-vpa-gold/10 rounded"></div>
                            <div className="w-12 h-6 bg-vpa-olive-light/10 dark:bg-vpa-gold/10 rounded"></div>
                            <div className="w-12 h-6 bg-vpa-olive-light/10 dark:bg-vpa-gold/10 rounded"></div>
                          </td>
                        </tr>
                      ))
                    ) : (
                      displayedQuizzes.map(quiz => (
                        <tr key={quiz._id} className="border-b border-vpa-olive-light/10 hover:bg-vpa-olive-light/5">
                          <td className="py-3 px-4 font-bold text-vpa-olive dark:text-vpa-sand uppercase">{quiz.title}</td>
                          <td className="py-3 px-4">{quiz.category}</td>
                          <td className="py-3 px-4">{quiz.questions.length} câu / {quiz.duration} phút ({quiz.passingScorePercent}% Đạt)</td>
                          <td className="py-3 px-4 font-bold text-vpa-olive/80 dark:text-vpa-sand/80">{quiz.creatorId?.fullName || 'Hệ thống'}</td>
                          <td className="py-3 px-4 font-mono text-[11px]">
                            {quiz.createdAt ? new Date(quiz.createdAt).toLocaleString('vi-VN', {
                              hour: '2-digit',
                              minute: '2-digit',
                              day: '2-digit',
                              month: '2-digit',
                              year: 'numeric'
                            }) : 'N/A'}
                          </td>
                          <td className="py-3 px-4">
                            {quiz.isPublic ? (
                              <span className="text-green-600 font-bold">CÔNG KHAI</span>
                            ) : (
                              <span className="text-gray-400">NỘI BỘ</span>
                            )}
                          </td>
                          <td className="py-3 px-4 font-mono font-bold text-vpa-gold">{quiz.shareCode}</td>
                          <td className="py-3 px-4 text-right relative">
                            <div className="inline-block text-left">
                              <button
                                type="button"
                                onClick={() => setActiveDropdownQuizId(activeDropdownQuizId === quiz._id ? null : quiz._id)}
                                className="px-3 py-1.5 border border-vpa-olive-light/50 bg-vpa-sand-light dark:bg-vpa-dark-card text-vpa-olive dark:text-vpa-sand hover:bg-vpa-olive hover:text-white dark:hover:bg-vpa-gold dark:hover:text-vpa-dark text-[10px] uppercase font-mono font-bold tracking-wider transition-colors inline-flex items-center space-x-1"
                              >
                                <span>Thao tác</span>
                                <span className="text-[8px]">▼</span>
                              </button>
                              
                              {activeDropdownQuizId === quiz._id && (
                                <>
                                  {/* Transparent click catcher backdrop */}
                                  <div 
                                    className="fixed inset-0 z-10 cursor-default" 
                                    onClick={() => setActiveDropdownQuizId(null)}
                                  />
                                  
                                  {/* Dropdown Menu Box */}
                                  <div className="absolute right-0 mt-1.5 w-36 border border-vpa-olive-light bg-vpa-sand-light dark:bg-vpa-dark-card shadow-lg z-20 rounded-none flex flex-col py-1 animate-fadeIn">
                                    <button
                                      type="button"
                                      onClick={() => { setActiveDropdownQuizId(null); handleViewQuiz(quiz); }}
                                      className="w-full text-left px-3 py-2 text-[10px] font-bold uppercase text-vpa-olive dark:text-vpa-sand hover:bg-vpa-olive hover:text-white dark:hover:bg-vpa-gold dark:hover:text-vpa-dark transition-colors border-b border-vpa-olive-light/10"
                                    >
                                      Xem đề
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => { setActiveDropdownQuizId(null); handleEditQuiz(quiz); }}
                                      className="w-full text-left px-3 py-2 text-[10px] font-bold uppercase text-vpa-olive dark:text-vpa-sand hover:bg-vpa-olive hover:text-white dark:hover:bg-vpa-gold dark:hover:text-vpa-dark transition-colors border-b border-vpa-olive-light/10"
                                    >
                                      Sửa đề
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => { setActiveDropdownQuizId(null); handleOpenExportPopup(quiz); }}
                                      className="w-full text-left px-3 py-2 text-[10px] font-bold uppercase text-vpa-olive dark:text-vpa-sand hover:bg-vpa-olive hover:text-white dark:hover:bg-vpa-gold dark:hover:text-vpa-dark transition-colors border-b border-vpa-olive-light/10"
                                    >
                                      Xuất bản
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => { setActiveDropdownQuizId(null); handleDeleteQuiz(quiz._id); }}
                                      className="w-full text-left px-3 py-2 text-[10px] font-bold uppercase text-vpa-red hover:bg-vpa-red hover:text-white transition-colors"
                                    >
                                      Xóa đề
                                    </button>
                                  </div>
                                </>
                              )}
                            </div>
                          </td>
                        </tr>
                      ))
                    )}
                    {!quizzesLoading && displayedQuizzes.length === 0 && (
                      <tr>
                        <td colSpan={6} className="text-center py-8 text-gray-400">
                          {quizzes.length === 0
                            ? "Chưa có đề thi quân sự nào được xuất bản."
                            : "Không tìm thấy đề thi phù hợp với bộ lọc tìm kiếm."}
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>

              {/* Pagination controls */}
              {totalQuizPages > 1 && (
                <div className="flex flex-col sm:flex-row justify-between items-center mt-4 pt-4 border-t border-vpa-olive-light/20 text-xs font-mono gap-3">
                  <span className="text-gray-500 text-center sm:text-left">
                    Hiển thị {startQuizIndex + 1} - {Math.min(startQuizIndex + quizPageSize, totalQuizCount)} trong tổng số {totalQuizCount} đề thi
                  </span>
                  <div className="flex items-center space-x-1.5">
                    <button
                      type="button"
                      disabled={quizPage === 1}
                      onClick={() => setQuizPage(prev => Math.max(prev - 1, 1))}
                      className="px-2.5 py-1 border border-vpa-olive-light/30 text-vpa-olive dark:text-vpa-sand disabled:opacity-45 disabled:cursor-not-allowed hover:bg-vpa-olive-light/10 font-bold"
                    >
                      Trước
                    </button>
                    {Array.from({ length: totalQuizPages }).map((_, i) => {
                      const p = i + 1;
                      if (
                        totalQuizPages > 6 &&
                        p !== 1 &&
                        p !== totalQuizPages &&
                        Math.abs(p - quizPage) > 1
                      ) {
                        if (p === 2 && quizPage > 3) return <span key={p} className="px-1 text-gray-400 select-none">...</span>;
                        if (p === totalQuizPages - 1 && quizPage < totalQuizPages - 2) return <span key={p} className="px-1 text-gray-400 select-none">...</span>;
                        return null;
                      }
                      return (
                        <button
                          key={p}
                          type="button"
                          onClick={() => setQuizPage(p)}
                          className={`w-7 h-7 flex items-center justify-center border transition-all ${
                            quizPage === p
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
                      disabled={quizPage === totalQuizPages}
                      onClick={() => setQuizPage(prev => Math.min(prev + 1, totalQuizPages))}
                      className="px-2.5 py-1 border border-vpa-olive-light/30 text-vpa-olive dark:text-vpa-sand disabled:opacity-45 disabled:cursor-not-allowed hover:bg-vpa-olive-light/10 font-bold"
                    >
                      Sau
                    </button>
                  </div>
                </div>
              )}
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

                {!editingQuizId && (
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6 border-t border-vpa-olive-light/20 pt-4">
                    <div className="md:col-span-2">
                      <label className="block text-[10px] uppercase tracking-wider text-gray-500 mb-1">Xáo trộn và sinh nhiều mã đề thi (Tối đa 4 mã đề)</label>
                      <select
                        value={numCodes}
                        onChange={e => setNumCodes(parseInt(e.target.value))}
                        className="w-full text-xs p-2.5 bg-transparent border border-vpa-olive-light focus:outline-none focus:border-vpa-gold dark:bg-vpa-dark-card text-vpa-olive dark:text-vpa-sand font-bold"
                      >
                        <option value={1} className="dark:bg-vpa-dark">Không xáo trộn (Chỉ tạo 1 đề)</option>
                        <option value={2} className="dark:bg-vpa-dark">Tạo 2 mã đề</option>
                        <option value={3} className="dark:bg-vpa-dark">Tạo 3 mã đề</option>
                        <option value={4} className="dark:bg-vpa-dark">Tạo 4 mã đề</option>
                      </select>
                      <span className="text-[9px] text-gray-400 mt-1 block">Hệ thống sẽ tự động xáo trộn ngẫu nhiên thứ tự câu hỏi và thứ tự đáp án (A, B, C, D) cho từng mã đề thi khi đồng chí bấm Lưu.</span>
                    </div>
                  </div>
                )}
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
                  Lưu đề thi
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
                    accept=".xlsx,.xls,.csv,.doc,.docx,.pdf"
                    onChange={handleFileChange}
                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                  />
                  <UploadSimple size={36} className="mx-auto mb-2 text-vpa-olive-light" />
                  <p className="text-xs text-vpa-olive dark:text-vpa-sand font-bold uppercase">
                    {selectedFile ? `File đã chọn: ${selectedFile.name}` : 'Kéo thả tệp tin hoặc click để chọn'}
                  </p>
                  <p className="text-[10px] text-gray-500 mt-1">Hỗ trợ các định dạng: .xlsx, .xls, .csv, .doc, .docx, .pdf</p>
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

          

          {/* AI Quiz Generation Form */}
          {isGeneratingAI && (
            <div className="space-y-6">
              {aiLoading ? (
                <div className="border border-vpa-olive-light/50 bg-vpa-sand-light dark:bg-vpa-dark-card p-8 shadow-md rounded-none flex flex-col items-center justify-center min-h-[380px] space-y-6">
                  {/* Rotating AI/Brain Icon with pulsating light */}
                  <div className="relative">
                    <div className="absolute inset-0 animate-ping rounded-full bg-vpa-gold/15 filter blur-sm"></div>
                    <div className="w-16 h-16 rounded-full border border-vpa-gold/50 flex items-center justify-center bg-vpa-olive/5 dark:bg-vpa-gold/5 text-vpa-gold animate-pulse">
                      <Brain size={32} className="animate-bounce" />
                    </div>
                  </div>

                  <div className="text-center space-y-1">
                    <h4 className="text-sm font-bold uppercase text-vpa-olive dark:text-vpa-sand tracking-widest font-mono">
                      Hệ thống AI đang xử lý tài liệu & soạn đề
                    </h4>
                    <p className="text-[10px] text-gray-500 font-mono uppercase tracking-wider">
                      Vui lòng giữ kết nối, quá trình này có thể mất từ 10 - 20 giây
                    </p>
                  </div>

                  {/* Steps Progress Visualizer */}
                  <div className="w-full max-w-2xl pt-8 border-t border-vpa-olive-light/20">
                    <div className="relative flex items-center justify-between w-full">
                      {/* Connector Line Container */}
                      <div className="absolute left-[12.5%] right-[12.5%] top-5 h-1 bg-vpa-olive-light/25 dark:bg-vpa-olive-light/10 -translate-y-1/2 z-0 rounded-full" />
                      
                      {/* Active Progress Connector Line */}
                      <div 
                        className="absolute left-[12.5%] top-5 h-1 bg-vpa-gold -translate-y-1/2 z-0 transition-all duration-1000 ease-out shadow-[0_0_8px_rgba(229,169,59,0.5)] rounded-full" 
                        style={{ width: `${((Math.min(aiProgressStep, 4) - 1) / 3) * 100}%` }}
                      />
                      
                      {[
                        { step: 1, text: "Tiếp nhận tệp" },
                        { step: 2, text: "Tải lên & trích xuất" },
                        { step: 3, text: "Xử lý tạo đề thi" },
                        { step: 4, text: "Hoàn tất bản thảo" }
                      ].map((item) => {
                        const isActive = aiProgressStep === item.step;
                        const isCompleted = aiProgressStep > item.step;
                        
                        return (
                          <div key={item.step} className="flex flex-col items-center flex-1 relative z-10">
                            {/* Circle Indicator */}
                            <div className={`w-10 h-10 rounded-full border-2 flex items-center justify-center font-mono font-extrabold text-sm transition-all duration-500 ${
                              isCompleted 
                                ? 'bg-green-600 border-green-600 text-white shadow-[0_0_12px_rgba(22,163,74,0.45)]' 
                                : isActive 
                                ? 'border-vpa-gold bg-vpa-sand-light dark:bg-vpa-dark-card text-vpa-gold shadow-[0_0_15px_rgba(229,169,59,0.6)] scale-110 animate-pulse' 
                                : 'border-vpa-olive-light/35 bg-vpa-sand-light/50 dark:bg-vpa-dark/50 text-gray-400 dark:text-gray-600'
                            }`}>
                              {isCompleted ? '✓' : item.step}
                            </div>
                            
                            {/* Text label */}
                            <span className={`mt-3.5 font-mono text-[9px] sm:text-[10px] uppercase tracking-wider text-center max-w-[85px] sm:max-w-[130px] transition-all duration-500 leading-tight ${
                              isCompleted 
                                ? 'text-green-600 dark:text-green-500 font-bold' 
                                : isActive 
                                ? 'text-vpa-gold font-bold scale-105' 
                                : 'text-gray-400 dark:text-gray-600 font-semibold'
                            }`}>
                              {item.text}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
              ) : (
                <form onSubmit={handleAIGenerateSubmit} className="space-y-6">
                  <div className="border border-vpa-olive-light/50 bg-vpa-sand-light dark:bg-vpa-dark-card p-6 shadow-md rounded-none space-y-4">
                    <h3 className="text-sm font-bold uppercase text-vpa-olive dark:text-vpa-sand pb-2 border-b border-vpa-olive-light/30 flex items-center space-x-2">
                      <Brain size={18} className="text-vpa-gold" />
                      <span>Tạo đề trắc nghiệm bằng Trí tuệ Nhân tạo (AI)</span>
                    </h3>

                    <p className="text-xs text-gray-500 italic">
                      Hệ thống đọc tài liệu và tạo câu hỏi trắc nghiệm.
                    </p>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                      <div>
                        <label className="block text-[10px] uppercase tracking-wider text-gray-500 mb-1">Chuyên ngành học tập</label>
                        <select
                          value={aiCategory}
                          onChange={e => setAiCategory(e.target.value)}
                          className="w-full text-xs p-2 bg-transparent border border-vpa-olive-light focus:outline-none focus:border-vpa-gold dark:bg-vpa-dark-card text-vpa-olive dark:text-vpa-sand"
                        >
                          {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                        </select>
                      </div>
                      <div>
                        <label className="block text-[10px] uppercase tracking-wider text-gray-500 mb-1">Số lượng câu hỏi cần tạo</label>
                        <input
                          type="number"
                          required
                          min={5}
                          max={50}
                          value={aiNumQuestions}
                          onChange={e => setAiNumQuestions(parseInt(e.target.value))}
                          className="w-full text-xs p-2 bg-transparent border border-vpa-olive-light focus:outline-none focus:border-vpa-gold text-vpa-olive dark:text-vpa-sand"
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] uppercase tracking-wider text-gray-500 mb-1">Tạo nhiều mã đề thi</label>
                        <select
                          value={numCodes}
                          onChange={e => setNumCodes(parseInt(e.target.value))}
                          className="w-full text-xs p-2 bg-transparent border border-vpa-olive-light focus:outline-none focus:border-vpa-gold dark:bg-vpa-dark-card text-vpa-olive dark:text-vpa-sand font-bold"
                        >
                          <option value={1} className="dark:bg-vpa-dark">Không xáo trộn (Chỉ 1 đề)</option>
                          <option value={2} className="dark:bg-vpa-dark">Tạo 2 mã đề</option>
                          <option value={3} className="dark:bg-vpa-dark">Tạo 3 mã đề</option>
                          <option value={4} className="dark:bg-vpa-dark">Tạo 4 mã đề</option>
                        </select>
                      </div>
                  </div>

                  <div className="space-y-4">
                    {/* Upload Box */}
                    <div className="border-2 border-dashed border-vpa-olive-light/50 p-6 text-center bg-vpa-sand/30 dark:bg-vpa-dark/30 hover:border-vpa-gold transition-colors relative cursor-pointer">
                      <input
                        type="file"
                        required={aiFiles.length === 0}
                        multiple
                        accept=".xlsx,.xls,.csv,.doc,.docx,.pdf,.txt"
                        onChange={handleAIFileChange}
                        className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                      />
                      <UploadSimpleIcon size={32} className="mx-auto mb-2 text-vpa-olive-light" />
                      <p className="text-xs text-vpa-olive dark:text-vpa-sand font-bold uppercase">
                        {aiFiles.length > 0 ? 'Thêm tài liệu ôn luyện khác' : 'Kéo thả tài liệu ôn luyện hoặc click để chọn'}
                      </p>
                      <p className="text-[10px] text-gray-500 mt-1">Hỗ trợ: .pdf, .doc, .docx, .xlsx, .xls, .csv, .txt (Tổng tối đa 10MB)</p>
                    </div>

                    {/* Selected files list with thumbnails */}
                    {aiFiles.length > 0 && (
                      <div className="space-y-2 text-left">
                        <div className="flex justify-between items-center text-[10px] uppercase tracking-wider text-vpa-olive-light dark:text-vpa-sand font-bold">
                          <span>Tài liệu đã chọn ({aiFiles.length})</span>
                          <span>{formatBytes(aiFiles.reduce((acc, f) => acc + f.size, 0))} / 10 MB</span>
                        </div>

                        {/* Progress Bar */}
                        <div className="w-full bg-vpa-olive-light/20 h-1.5 rounded-full overflow-hidden">
                          <div
                            className={`h-full transition-all duration-300 ${
                              aiFiles.reduce((acc, f) => acc + f.size, 0) > 8 * 1024 * 1024 
                                ? 'bg-red-500' 
                                : 'bg-vpa-olive dark:bg-vpa-gold'
                            }`}
                            style={{ width: `${Math.min((aiFiles.reduce((acc, f) => acc + f.size, 0) / (10 * 1024 * 1024)) * 100, 100)}%` }}
                          />
                        </div>

                        {/* Cards Grid */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mt-2 max-h-48 overflow-y-auto pr-1">
                          {aiFiles.map((file, idx) => {
                            const ext = file.name.split('.').pop()?.toLowerCase();
                            return (
                              <div key={idx} className="flex items-center justify-between p-2 border border-vpa-olive-light/30 bg-vpa-sand/10 dark:bg-vpa-dark/40 rounded hover:border-vpa-gold transition-colors">
                                <div className="flex items-center space-x-2.5 overflow-hidden">
                                  {getFileIcon(ext)}
                                  <div className="overflow-hidden">
                                    <p className="text-[11px] font-bold text-vpa-olive dark:text-vpa-sand truncate max-w-[150px] sm:max-w-[200px]" title={file.name}>
                                      {file.name}
                                    </p>
                                    <p className="text-[9px] text-gray-500">{formatBytes(file.size)}</p>
                                  </div>
                                </div>
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.preventDefault();
                                    handleRemoveFile(idx);
                                  }}
                                  className="p-1 text-gray-400 hover:text-red-500 transition-colors cursor-pointer"
                                  title="Loại bỏ tài liệu này"
                                >
                                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" />
                                  </svg>
                                </button>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}
                  </div>
                  </div>

                  <div className="flex justify-end space-x-4 border-t border-vpa-olive-light/30 pt-6">
                    <button
                      type="button"
                      onClick={() => { setIsGeneratingAI(false); setAiFiles([]); }}
                      className="px-4 py-2 border border-vpa-olive-light text-xs uppercase tracking-wider text-vpa-olive dark:text-vpa-sand hover:bg-vpa-olive hover:text-white"
                    >
                      Hủy bỏ
                    </button>
                    <button
                      type="submit"
                      disabled={aiLoading || aiFiles.length === 0}
                      className="px-6 py-2 bg-vpa-olive dark:bg-vpa-gold text-white dark:text-vpa-dark text-xs uppercase font-bold tracking-wider hover:bg-vpa-olive-light dark:hover:bg-vpa-gold-bright disabled:opacity-50 flex items-center space-x-2"
                    >
                      <span>Bắt đầu tạo đề (AI)</span>
                    </button>
                  </div>
                </form>
              )}
            </div>
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

                <select
                  value={typeFilter}
                  onChange={e => setTypeFilter(e.target.value)}
                  className="text-xs bg-transparent border-b border-vpa-olive-light text-vpa-olive dark:text-vpa-sand focus:outline-none dark:bg-vpa-dark-card"
                >
                  <option value="">Tất cả dạng câu hỏi</option>
                  <option value="multiple-choice">Trắc nghiệm</option>
                  <option value="true-false">Đúng / Sai</option>
                  <option value="fill-in-the-blank">Điền vào ô trống</option>
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
                      <th className="py-3 px-4 w-1/2 cursor-pointer hover:text-vpa-gold transition-colors select-none" onClick={() => handleBankSort('questionText')}>
                        Nội dung câu hỏi {renderSortIndicator('questionText', bankSortField, bankSortOrder)}
                      </th>
                      <th className="py-3 px-4 cursor-pointer hover:text-vpa-gold transition-colors select-none" onClick={() => handleBankSort('category')}>
                        Chuyên ngành {renderSortIndicator('category', bankSortField, bankSortOrder)}
                      </th>
                      <th className="py-3 px-4 cursor-pointer hover:text-vpa-gold transition-colors select-none" onClick={() => handleBankSort('difficulty')}>
                        Độ khó {renderSortIndicator('difficulty', bankSortField, bankSortOrder)}
                      </th>
                      <th className="py-3 px-4 cursor-pointer hover:text-vpa-gold transition-colors select-none" onClick={() => handleBankSort('author')}>
                        Đồng chí soạn {renderSortIndicator('author', bankSortField, bankSortOrder)}
                      </th>
                      <th className="py-3 px-4 text-right">Thao tác</th>
                    </tr>
                  </thead>
                  <tbody>
                    {bankLoading ? (
                      Array.from({ length: 5 }).map((_, idx) => (
                        <tr key={idx} className="border-b border-vpa-olive-light/10 animate-pulse">
                          <td className="py-4 px-4 w-1/2">
                            <div className="w-full h-4 bg-vpa-olive-light/20 dark:bg-vpa-gold/15 rounded mb-2"></div>
                            <div className="w-2/3 h-3 bg-vpa-olive-light/10 dark:bg-vpa-gold/10 rounded"></div>
                          </td>
                          <td className="py-4 px-4">
                            <div className="w-24 h-4 bg-vpa-olive-light/10 dark:bg-vpa-gold/10 rounded"></div>
                          </td>
                          <td className="py-4 px-4">
                            <div className="w-16 h-4 bg-vpa-olive-light/15 dark:bg-vpa-gold/15 rounded"></div>
                          </td>
                          <td className="py-4 px-4">
                            <div className="w-20 h-4 bg-vpa-olive-light/10 dark:bg-vpa-gold/10 rounded"></div>
                          </td>
                          <td className="py-4 px-4 text-right flex justify-end space-x-2">
                            <div className="w-8 h-8 bg-vpa-olive-light/10 dark:bg-vpa-gold/10 rounded"></div>
                            <div className="w-8 h-8 bg-vpa-olive-light/10 dark:bg-vpa-gold/10 rounded"></div>
                          </td>
                        </tr>
                      ))
                    ) : (
                      displayedBankQuestions.map(q => (
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
                              type="button"
                              onClick={() => handleEditBankQ(q)}
                              className="p-1.5 border border-vpa-gold/30 text-vpa-gold hover:bg-vpa-gold hover:text-vpa-dark"
                            >
                              <PencilSimple size={14} />
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDeleteBankQ(q._id)}
                              className="p-1.5 border border-vpa-red/30 text-vpa-red hover:bg-vpa-red hover:text-white"
                            >
                              <Trash size={14} />
                            </button>
                          </td>
                        </tr>
                      ))
                    )}
                    {!bankLoading && bankQuestions.length === 0 && (
                      <tr>
                        <td colSpan={5} className="text-center py-8 text-gray-400">Ngân hàng câu hỏi trống hoặc không khớp bộ lọc.</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>

              {/* Pagination controls */}
              {totalBankPages > 1 && (
                <div className="flex flex-col sm:flex-row justify-between items-center mt-4 pt-4 border-t border-vpa-olive-light/20 text-xs font-mono gap-3">
                  <span className="text-gray-500 text-center sm:text-left">
                    Hiển thị {startBankIndex + 1} - {Math.min(startBankIndex + bankPageSize, totalBankCount)} trong tổng số {totalBankCount} câu hỏi
                  </span>
                  <div className="flex items-center space-x-1.5">
                    <button
                      type="button"
                      disabled={bankPage === 1}
                      onClick={() => setBankPage(prev => Math.max(prev - 1, 1))}
                      className="px-2.5 py-1 border border-vpa-olive-light/30 text-vpa-olive dark:text-vpa-sand disabled:opacity-45 disabled:cursor-not-allowed hover:bg-vpa-olive-light/10 font-bold"
                    >
                      Trước
                    </button>
                    {Array.from({ length: totalBankPages }).map((_, i) => {
                      const p = i + 1;
                      if (
                        totalBankPages > 6 &&
                        p !== 1 &&
                        p !== totalBankPages &&
                        Math.abs(p - bankPage) > 1
                      ) {
                        if (p === 2 && bankPage > 3) return <span key={p} className="px-1 text-gray-400 select-none">...</span>;
                        if (p === totalBankPages - 1 && bankPage < totalBankPages - 2) return <span key={p} className="px-1 text-gray-400 select-none">...</span>;
                        return null;
                      }
                      return (
                        <button
                          key={p}
                          type="button"
                          onClick={() => setBankPage(p)}
                          className={`w-7 h-7 flex items-center justify-center border transition-all ${
                            bankPage === p
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
                      disabled={bankPage === totalBankPages}
                      onClick={() => setBankPage(prev => Math.min(prev + 1, totalBankPages))}
                      className="px-2.5 py-1 border border-vpa-olive-light/30 text-vpa-olive dark:text-vpa-sand disabled:opacity-45 disabled:cursor-not-allowed hover:bg-vpa-olive-light/10 font-bold"
                    >
                      Sau
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Add/Edit Question to Bank form */}
          {isAddingToBank && (
            <form onSubmit={handleAddQuestionToBank} className="space-y-6">
              <div className="border border-vpa-olive-light/50 bg-vpa-sand-light dark:bg-vpa-dark-card p-6 shadow-md rounded-none space-y-4">
                <h3 className="text-sm font-bold uppercase text-vpa-olive dark:text-vpa-sand pb-2 border-b border-vpa-olive-light/30 flex items-center space-x-2">
                  <Database size={18} className="text-vpa-gold" />
                  <span>{editingBankQId ? 'Chỉnh sửa câu hỏi trong ngân hàng chung' : 'Khai báo câu hỏi mới vào ngân hàng chung'}</span>
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
      {viewingQuiz && (() => {
        const variants = quizzes.filter((q: any) => q.parentQuizId === viewingQuiz._id);
        const sortedVariants = [...variants].sort((a: any, b: any) => (a.examCode || '').localeCompare(b.examCode || ''));
        const allVersions = [
          { id: 'parent', label: viewingQuiz.examCode ? `Mã đề ${viewingQuiz.examCode}` : 'Đề gốc / 001', quiz: viewingQuiz },
          ...sortedVariants.map((v: any) => ({
            id: v._id,
            label: `Mã đề ${v.examCode || '001'}`,
            quiz: v
          }))
        ];
        const currentQuizToShow = allVersions.find(v => v.id === activeVersionTab)?.quiz || viewingQuiz;

        return (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
            <div className="w-full max-w-4xl h-[90vh] max-h-[900px] border border-vpa-olive-light bg-vpa-sand-light dark:bg-vpa-dark-card p-6 shadow-2xl rounded-none flex flex-col relative">
              
              {/* Header */}
              <div className="flex justify-between items-center border-b border-vpa-olive-light pb-3 mb-6 flex-shrink-0">
                <div>
                  <span className="text-[10px] font-mono text-vpa-gold uppercase font-bold mr-2">Chi tiết đề thi</span>
                  <h3 className="text-sm font-bold uppercase text-vpa-olive dark:text-vpa-sand inline-block">
                    {currentQuizToShow.title}
                  </h3>
                </div>
                <button
                  onClick={() => setViewingQuiz(null)}
                  className="text-xs uppercase font-bold hover:underline text-vpa-red"
                >
                  Đóng lại
                </button>
              </div>

              {/* Version Tabs Selection (Only if variants exist) */}
              {variants.length > 0 && (
                <div className="flex border-b border-vpa-olive-light/20 mb-6 bg-vpa-sand/20 dark:bg-vpa-dark/20 p-1.5 gap-2 flex-shrink-0">
                  {allVersions.map((ver) => (
                    <button
                      key={ver.id}
                      type="button"
                      onClick={() => setActiveVersionTab(ver.id)}
                      className={`px-4 py-1.5 text-xs font-bold transition-all uppercase rounded-none ${
                        activeVersionTab === ver.id
                          ? 'bg-vpa-olive text-white dark:bg-vpa-gold dark:text-vpa-dark shadow'
                          : 'text-vpa-olive-light dark:text-vpa-sand hover:bg-vpa-sand-light dark:hover:bg-vpa-dark-card/50'
                      }`}
                    >
                      {ver.label}
                    </button>
                  ))}
                </div>
              )}

              {/* General parameters */}
              <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-6 pb-6 border-b border-dashed border-vpa-olive-light/30 text-xs flex-shrink-0">
                <div><span className="text-gray-500 uppercase">Chuyên ngành:</span> <span className="font-bold">{currentQuizToShow.category}</span></div>
                <div><span className="text-gray-500 uppercase">Thời gian làm bài:</span> <span className="font-bold">{currentQuizToShow.duration} phút</span></div>
                <div><span className="text-gray-500 uppercase">Điểm vượt qua:</span> <span className="font-bold">{currentQuizToShow.passingScorePercent}%</span></div>
                {currentQuizToShow.examCode && (
                  <div><span className="text-gray-500 uppercase">Ký hiệu mã đề:</span> <span className="font-bold text-vpa-gold font-mono">{currentQuizToShow.examCode}</span></div>
                )}
              </div>

              {/* Questions list */}
              <div className="flex-1 overflow-y-auto space-y-6 pr-2">
                {currentQuizToShow.questions.map((q: any, qIdx: number) => (
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
        );
      })()}

      {/* VPA Output custom settings popup */}
      <VPAExportPopup
        isOpen={showExportPopup}
        defaultUnit={user?.unit}
        defaultPosition={user?.position}
        defaultRank={user?.rank}
        defaultName={user?.fullName}
        type="quiz"
        previewData={
          selectedQuizForExport
            ? {
                ...selectedQuizForExport,
                variants: quizzes.filter((q: any) => q.parentQuizId === selectedQuizForExport._id)
              }
            : null
        }
        onCancel={() => { setShowExportPopup(false); setSelectedQuizForExport(null); }}
        onConfirm={handleExportConfirm}
      />

      {/* Printable VPA Quiz Document Container */}
      {printData && createPortal(
        <div 
          className="print-area-only text-black bg-white leading-relaxed text-sm font-serif" 
          style={{ 
            fontFamily: "'Times New Roman', Times, serif",
            padding: `${printData.marginTop || 2.5}cm ${printData.marginRight || 1.5}cm ${printData.marginBottom || 2.0}cm ${printData.marginLeft || 3.0}cm`
          }}
        >
          <style dangerouslySetInnerHTML={{ __html: `
            @media print {
              @page {
                size: A4 ${printData.orientation === 'landscape' ? 'landscape' : 'portrait'};
              }
              
              ${printData.mirrorMargins ? `
                /* Mirrored margins for double-sided printing */
                @page :left {
                  margin-top: ${printData.marginTop || 2.5}cm;
                  margin-bottom: ${printData.marginBottom || 2.0}cm;
                  margin-left: ${printData.marginRight || 1.5}cm;
                  margin-right: ${printData.marginLeft || 3.0}cm;
                }
                @page :right {
                  margin-top: ${printData.marginTop || 2.5}cm;
                  margin-bottom: ${printData.marginBottom || 2.0}cm;
                  margin-left: ${printData.marginLeft || 3.0}cm;
                  margin-right: ${printData.marginRight || 1.5}cm;
                }
                @page :first {
                  margin-top: ${printData.marginTop || 2.5}cm;
                  margin-bottom: ${printData.marginBottom || 2.0}cm;
                  margin-left: ${printData.marginLeft || 3.0}cm;
                  margin-right: ${printData.marginRight || 1.5}cm;
                }
              ` : `
                /* Standard identical margins for all pages */
                @page {
                  margin-top: ${printData.marginTop || 2.5}cm;
                  margin-bottom: ${printData.marginBottom || 2.0}cm;
                  margin-left: ${printData.marginLeft || 3.0}cm;
                  margin-right: ${printData.marginRight || 1.5}cm;
                }
              `}

              .print-page-break {
                page-break-after: always;
                box-sizing: border-box;
                width: 100%;
              }

              .print-page-break:last-child {
                page-break-after: avoid;
              }

              body {
                background: white;
                color: black;
              }
            }
          `}} />

          {printData.quizzes.map((quizItem: any, quizIdx: number) => (
            <div key={quizItem._id || quizIdx} className="print-page-break">
              {/* Header */}
              <div className="flex justify-between items-start text-xs leading-normal mb-8 font-serif">
                <div className="text-center w-[38%] font-serif">
                  <p className="uppercase font-serif">{printData.upperUnit}</p>
                  <p className="font-bold uppercase font-serif">{printData.currentUnit}</p>
                  <p className="font-bold mt-0.5">---------</p>
                </div>
                <div className="text-center w-[58%] font-serif">
                  <p className="font-bold text-[13px] font-serif whitespace-nowrap">CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM</p>
                  <p className="font-bold border-b border-black pb-1 inline-block mx-auto text-[13px] font-serif whitespace-nowrap">
                    Độc lập - Tự do - Hạnh phúc
                  </p>
                  <p className="italic mt-1.5 font-serif">
                    {printData.province}, ngày {new Date().getDate()} tháng {new Date().getMonth() + 1} năm {new Date().getFullYear()}
                  </p>
                </div>
              </div>

              {/* Title & Exam Code */}
              <div className="text-center my-6 font-serif relative">
                <h2 className="text-lg font-bold uppercase tracking-wide font-serif">ĐỀ THI TRẮC NGHIỆM</h2>
                <p className="font-bold mt-1 font-serif">
                  MÔN: {quizItem.title?.toUpperCase()}
                </p>
                <p className="italic mt-1 text-xs font-serif">
                  Thời gian làm bài: {quizItem.duration || 45} phút (Không kể thời gian giao đề)
                </p>
                {quizItem.examCode && (
                  <div className="absolute right-0 top-0 border border-black px-3 py-1 font-bold text-sm font-serif">
                    Mã đề thi: {quizItem.examCode}
                  </div>
                )}
              </div>

              {/* Question List */}
              <div className="space-y-4 my-6 font-serif">
                {(quizItem.questions || []).map((q: any, idx: number) => (
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
            </div>
          ))}
        </div>,
        document.body
      )}
    </div>
  );
};
export default QuizManagement;
