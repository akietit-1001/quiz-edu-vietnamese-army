import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import axios from 'axios';
import { Plus, Trash, UploadSimple, ArrowLeft, PlusCircle, Check, Shuffle, Database, MagnifyingGlass, Funnel, PlusIcon, UploadSimpleIcon, ShuffleIcon, PencilSimple, Brain, MagnifyingGlassIcon, BrainIcon, X } from '../icons';
import { VPAExportPopup } from '../components/VPAExportPopup';
import { type QuizPrintData, type PageNumberPosition, type PaperSize, QuizPrintPortalContent, sanitizeFilenamePart } from '../utils/quizPrintTemplate';
import { useSubviewBack } from '../hooks/useSubviewBack';
import { DatePicker } from '../components/DatePicker';
import { NumberStepper } from '../components/NumberStepper';
import { Select } from '../components/Select';
import { Pagination } from '../components/Pagination';
import { useDebouncedValue } from '../hooks/useDebouncedValue';
import { Tooltip } from '../components/Tooltip';
import { CreateRoomModal } from '../components/CreateRoomModal';
import { ShareQuizModal } from '../components/ShareQuizModal';

interface QuizManagementProps {
  user?: any;
  onNavigateBack: () => void;
  onJoinRoom: (roomCode: string) => void;
}

const CATEGORIES = ['Chính trị', 'Quân sự', 'Truyền thống quân đội', 'Hậu cần - Kỹ thuật', 'Điều lệnh', 'Khác'];
const DIFFICULTIES = ['Dễ', 'Trung bình', 'Khó'];

export const QuizManagement: React.FC<QuizManagementProps> = ({ user, onNavigateBack, onJoinRoom }) => {
  // Đề thi được chọn để tạo phòng thi ngay từ kho đề thi (null = modal đang đóng).
  const [createRoomQuizId, setCreateRoomQuizId] = useState<string | null>(null);
  const [shareQuizTarget, setShareQuizTarget] = useState<{ _id: string; title: string } | null>(null);
  const canCreateRoom = user?.role === 'admin' || user?.role === 'master-admin';

  // Quyền sửa/xóa/chia sẻ theo TỪNG đề — chỉ chủ đề hoặc master-admin quản lý
  // toàn quyền; "Sửa" có thể được cấp riêng qua chia sẻ (kể cả cho role user).
  const getQuizPermission = (quiz: any) => {
    const isOwner = quiz.creatorId?._id === user?.id;
    const isMasterAdmin = user?.role === 'master-admin';
    const shareEntry = quiz.sharedWith?.find((s: any) => s.userId === user?.id);
    return {
      canEdit: isOwner || isMasterAdmin || shareEntry?.permission === 'edit',
      canDelete: isOwner || isMasterAdmin,
      canShare: isOwner || isMasterAdmin
    };
  };
  const [quizzes, setQuizzes] = useState<any[]>([]);
  const [currentTab, setCurrentTab] = useState<'quizzes' | 'bank'>('quizzes');
  const [editingQuizId, setEditingQuizId] = useState<string | null>(null);
  const [editingExamCode, setEditingExamCode] = useState<string | null>(null);
  const [editingSiblingCount, setEditingSiblingCount] = useState(0);
  const [viewingQuiz, setViewingQuiz] = useState<any | null>(null);
  const [activeVersionTab, setActiveVersionTab] = useState<string>('parent');

  // VPA Export configurations
  const [showExportPopup, setShowExportPopup] = useState(false);
  const [selectedQuizForExport, setSelectedQuizForExport] = useState<any>(null);
  const [printData, setPrintData] = useState<QuizPrintData | null>(null);
  const [defaultUpperUnit, setDefaultUpperUnit] = useState('');

  useEffect(() => {
    axios.get('/api/units/my-parent')
      .then(res => setDefaultUpperUnit(res.data?.name || ''))
      .catch(() => {});
  }, []);

  // In ngay khi portal báo đã đo/ngắt trang xong (thay vì đoán 1 khoảng chờ
  // cố định bằng setTimeout) — đề dài/nhiều mã đề đo lâu hơn đề ngắn, một
  // con số cố định luôn có nguy cơ in "trắng" (chưa render kịp) hoặc chờ
  // thừa không cần thiết.
  const printOriginalTitleRef = React.useRef<string>('');

  useEffect(() => {
    if (printData) {
      printOriginalTitleRef.current = document.title;
      const firstQuiz = printData.quizzes && printData.quizzes.length > 0 ? printData.quizzes[0] : null;
      document.title = `De_thi_${sanitizeFilenamePart(firstQuiz?.title)}`;
      return () => {
        document.title = printOriginalTitleRef.current;
      };
    }
  }, [printData]);

  const handlePrintReady = () => {
    window.print();
    document.title = printOriginalTitleRef.current;
    setPrintData(null);
  };

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
  const [aiProgressPercent, setAiProgressPercent] = useState(0);
  const [quizzesLoading, setQuizzesLoading] = useState(true);
  const [quizFetchError, setQuizFetchError] = useState('');
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
  const [dropdownPos, setDropdownPos] = useState<{ top: number; left: number } | null>(null);

  // Question Bank state
  const [bankQuestions, setBankQuestions] = useState<any[]>([]);
  const [searchBank, setSearchBank] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [difficultyFilter, setDifficultyFilter] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [bankAuthorFilter, setBankAuthorFilter] = useState('');
  const [bankPage, setBankPage] = useState(1);
  const bankPageSize = 10;

  // Advanced filter panel cho ngân hàng câu hỏi
  const [showBankAdvancedFilter, setShowBankAdvancedFilter] = useState(false);
  const bankAdvancedFilterCount = [categoryFilter, difficultyFilter, typeFilter, bankAuthorFilter].filter(Boolean).length;
  const handleClearBankAdvancedFilters = () => {
    setCategoryFilter('');
    setDifficultyFilter('');
    setTypeFilter('');
    setBankAuthorFilter('');
  };

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

  // Advanced filter panel — 1 field per column trong bảng đề thi
  const [showQuizAdvancedFilter, setShowQuizAdvancedFilter] = useState(false);
  const [quizStatusFilter, setQuizStatusFilter] = useState(''); // '' | 'true' | 'false'
  const [quizCreatorFilter, setQuizCreatorFilter] = useState('');
  const [quizShareCodeFilter, setQuizShareCodeFilter] = useState('');
  const [quizCreatedFrom, setQuizCreatedFrom] = useState('');
  const [quizCreatedTo, setQuizCreatedTo] = useState('');
  const [quizDurationMin, setQuizDurationMin] = useState('');
  const [quizDurationMax, setQuizDurationMax] = useState('');

  const quizAdvancedFilterCount = [
    quizCategoryFilter, quizStatusFilter, quizCreatorFilter, quizShareCodeFilter,
    quizCreatedFrom, quizCreatedTo, quizDurationMin, quizDurationMax
  ].filter(Boolean).length;

  const handleClearQuizAdvancedFilters = () => {
    setQuizCategoryFilter('');
    setQuizStatusFilter('');
    setQuizCreatorFilter('');
    setQuizShareCodeFilter('');
    setQuizCreatedFrom('');
    setQuizCreatedTo('');
    setQuizDurationMin('');
    setQuizDurationMax('');
  };

  const displayedBankQuestions = bankQuestions;
  const startBankIndex = (bankPage - 1) * bankPageSize;
  const startQuizIndex = (quizPage - 1) * quizPageSize;
  const displayedQuizzes = quizzes;

  // Số dòng skeleton nên khớp với số dòng thực tế của trang hiện tại. Ngay
  // sau lần fetch đầu tiên, totalQuizCount/totalBankCount đã có giá trị thật
  // và KHÔNG bị reset khi loading bật lại (chỉ cập nhật khi fetch thành công),
  // nên các lần load sau (đổi trang, lọc, tìm kiếm) sẽ đoán đúng số dòng.
  const quizSkeletonRowCount = totalQuizCount > 0
    ? Math.max(1, Math.min(quizPageSize, totalQuizCount - startQuizIndex))
    : quizPageSize;
  const bankSkeletonRowCount = totalBankCount > 0
    ? Math.max(1, Math.min(bankPageSize, totalBankCount - startBankIndex))
    : bankPageSize;

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

  // Table Column Resizing States
  const [quizColWidths, setQuizColWidths] = useState<{ [key: string]: number }>({
    title: 400,
    category: 90,
    info: 50,
    author: 130,
    createdAt: 140,
    status: 100,
    shareCode: 60,
    actions: 120
  });

  const [bankColWidths, setBankColWidths] = useState<{ [key: string]: number }>({
    questionText: 350,
    category: 90,
    difficulty: 100,
    author: 130,
    actions: 100
  });

  const [quizResized, setQuizResized] = useState(false);
  const [bankResized, setBankResized] = useState(false);

  const activeCol = React.useRef<{ table: 'quiz' | 'bank', col: string } | null>(null);
  const startX = React.useRef<number>(0);
  const startWidth = React.useRef<number>(0);

  const handleResizeMouseDown = (table: 'quiz' | 'bank', colKey: string, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    
    // Dynamically measure current column widths from DOM
    const thElement = e.currentTarget.parentElement;
    const trElement = thElement?.parentElement;
    if (trElement) {
      const ths = Array.from(trElement.children) as HTMLTableHeaderCellElement[];
      if (table === 'quiz') {
        const widths: { [key: string]: number } = {
          title: ths[0]?.getBoundingClientRect().width || quizColWidths.title,
          category: ths[1]?.getBoundingClientRect().width || quizColWidths.category,
          info: ths[2]?.getBoundingClientRect().width || quizColWidths.info,
          author: ths[3]?.getBoundingClientRect().width || quizColWidths.author,
          createdAt: ths[4]?.getBoundingClientRect().width || quizColWidths.createdAt,
          status: ths[5]?.getBoundingClientRect().width || quizColWidths.status,
          shareCode: ths[6]?.getBoundingClientRect().width || quizColWidths.shareCode,
          actions: ths[7]?.getBoundingClientRect().width || quizColWidths.actions,
        };
        setQuizColWidths(widths);
        setQuizResized(true);
        startWidth.current = widths[colKey];
      } else {
        const widths: { [key: string]: number } = {
          questionText: ths[0]?.getBoundingClientRect().width || bankColWidths.questionText,
          category: ths[1]?.getBoundingClientRect().width || bankColWidths.category,
          difficulty: ths[2]?.getBoundingClientRect().width || bankColWidths.difficulty,
          author: ths[3]?.getBoundingClientRect().width || bankColWidths.author,
          actions: ths[4]?.getBoundingClientRect().width || bankColWidths.actions,
        };
        setBankColWidths(widths);
        setBankResized(true);
        startWidth.current = widths[colKey];
      }
    } else {
      startWidth.current = table === 'quiz' ? quizColWidths[colKey] : bankColWidths[colKey];
    }

    activeCol.current = { table, col: colKey };
    startX.current = e.clientX;

    document.addEventListener('mousemove', handleResizeMouseMove);
    document.addEventListener('mouseup', handleResizeMouseUp);
  };

  const handleResizeMouseMove = (e: MouseEvent) => {
    if (!activeCol.current) return;
    const { table, col } = activeCol.current;
    const diff = e.clientX - startX.current;
    const newWidth = Math.max(60, startWidth.current + diff);

    if (table === 'quiz') {
      setQuizColWidths(prev => ({ ...prev, [col]: newWidth }));
    } else {
      setBankColWidths(prev => ({ ...prev, [col]: newWidth }));
    }
  };

  const handleResizeMouseUp = () => {
    activeCol.current = null;
    document.removeEventListener('mousemove', handleResizeMouseMove);
    document.removeEventListener('mouseup', handleResizeMouseUp);
  };

  useEffect(() => {
    return () => {
      document.removeEventListener('mousemove', handleResizeMouseMove);
      document.removeEventListener('mouseup', handleResizeMouseUp);
    };
  }, []);

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

  // Debounce các ô gõ chữ tự do — tránh bắn 1 request server cho mỗi phím
  // gõ (VD: gõ "quân sự" trước đây bắn liền 6 request chồng nhau, không có
  // AbortController nên response có thể về sai thứ tự, nháy kết quả cũ).
  const debouncedSearchQuiz = useDebouncedValue(searchQuiz, 350);
  const debouncedQuizCreatorFilter = useDebouncedValue(quizCreatorFilter, 350);
  const debouncedQuizShareCodeFilter = useDebouncedValue(quizShareCodeFilter, 350);
  const debouncedSearchBank = useDebouncedValue(searchBank, 350);
  const debouncedBankAuthorFilter = useDebouncedValue(bankAuthorFilter, 350);

  useEffect(() => {
    fetchQuizzes();
  }, [
    quizPage, debouncedSearchQuiz, quizCategoryFilter, quizSortField, quizSortOrder,
    quizStatusFilter, debouncedQuizCreatorFilter, debouncedQuizShareCodeFilter, quizCreatedFrom, quizCreatedTo, quizDurationMin, quizDurationMax
  ]);

  useEffect(() => {
    if (currentTab === 'bank') {
      fetchBankQuestions();
    }
  }, [currentTab, bankPage, categoryFilter, difficultyFilter, typeFilter, debouncedBankAuthorFilter, debouncedSearchBank, bankSortField, bankSortOrder]);

  useEffect(() => {
    setQuizPage(1);
  }, [debouncedSearchQuiz, quizCategoryFilter, quizStatusFilter, debouncedQuizCreatorFilter, debouncedQuizShareCodeFilter, quizCreatedFrom, quizCreatedTo, quizDurationMin, quizDurationMax]);

  useEffect(() => {
    setBankPage(1);
  }, [debouncedSearchBank, categoryFilter, difficultyFilter, typeFilter, debouncedBankAuthorFilter]);

  // Backend chỉ báo % thật ở vài mốc rời rạc (VD 15/30/90/100 — AI sinh câu hỏi
  // không có tiến trình chi tiết hơn để báo về), nếu hiển thị thẳng số đó thanh
  // sẽ "nhảy cóc" và đứng hình rất lâu giữa các mốc (nhất là lúc chờ AI sinh
  // câu hỏi, có thể mất hàng chục giây không có cập nhật nào). aiProgressTargetRef
  // giữ mốc THẬT mới nhất; aiProgressCeilingRef tự nhích dần lên (luôn thấp hơn
  // mốc thật kế tiếp) trong lúc chờ, để thanh luôn trông như đang chạy liên tục.
  const aiProgressTargetRef = React.useRef(0);
  const aiProgressCeilingRef = React.useRef(0);
  const setAiProgressTarget = (value: number) => {
    aiProgressTargetRef.current = value;
    aiProgressCeilingRef.current = Math.max(aiProgressCeilingRef.current, value);
  };

  useEffect(() => {
    if (!aiLoading) {
      setAiProgressStep(1);
      setAiProgressPercent(0);
      aiProgressTargetRef.current = 0;
      aiProgressCeilingRef.current = 0;
      return;
    }
    const smoothInterval = setInterval(() => {
      setAiProgressPercent(prev => {
        aiProgressCeilingRef.current = Math.min(94, aiProgressCeilingRef.current + 0.15);
        const cap = Math.max(aiProgressTargetRef.current, aiProgressCeilingRef.current);
        if (prev >= cap) return prev;
        const step = Math.max(0.25, (cap - prev) * 0.06);
        return Math.min(cap, prev + step);
      });
    }, 150);
    return () => clearInterval(smoothInterval);
  }, [aiLoading]);

  const fetchQuizzes = async () => {
    setQuizzesLoading(true);
    try {
      const res = await axios.get('/api/quizzes', {
        params: {
          page: quizPage,
          limit: quizPageSize,
          search: debouncedSearchQuiz || undefined,
          category: quizCategoryFilter || undefined,
          sortField: quizSortField,
          sortOrder: quizSortOrder,
          isPublic: quizStatusFilter || undefined,
          creatorName: debouncedQuizCreatorFilter || undefined,
          shareCode: debouncedQuizShareCodeFilter || undefined,
          createdFrom: quizCreatedFrom || undefined,
          createdTo: quizCreatedTo || undefined,
          durationMin: quizDurationMin || undefined,
          durationMax: quizDurationMax || undefined
        }
      });
      const data = res.data;
      setQuizFetchError('');
      if (Array.isArray(data)) {
        setQuizzes(data);
        setTotalQuizPages(1);
        setTotalQuizCount(data.length);
      } else {
        setQuizzes(data.quizzes || []);
        setTotalQuizPages(data.totalPages || 1);
        setTotalQuizCount(data.totalCount || 0);
      }
    } catch (err: any) {
      console.error('Lỗi fetch đề thi:', err);
      setQuizzes([]);
      setQuizFetchError(
        err.response?.status === 401
          ? 'Phiên đăng nhập đã hết hạn. Vui lòng tải lại trang hoặc đăng nhập lại.'
          : (err.response?.data?.message || 'Không thể tải danh sách đề thi. Vui lòng thử lại.')
      );
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
          authorName: debouncedBankAuthorFilter || undefined,
          search: debouncedSearchBank || undefined,
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

  const [regeneratingQIdx, setRegeneratingQIdx] = useState<number | null>(null);

  const handleRegenerateQuestion = async (idx: number) => {
    const q = questions[idx];
    if (!q?.questionText) return;
    setRegeneratingQIdx(idx);
    try {
      const res = await axios.post('/api/quizzes/regenerate-question', {
        questionText: q.questionText,
        questionType: q.questionType,
        category,
        documentHash: documentHash || undefined
      });
      const newQuestion = res.data.question;
      setQuestions(prev => prev.map((item, i) => (i === idx ? { ...item, ...newQuestion } : item)));
    } catch (err: any) {
      await window.showAlert(err.response?.data?.message || 'Không thể sinh lại câu hỏi bằng AI.', 'Lỗi sinh lại câu hỏi');
    } finally {
      setRegeneratingQIdx(null);
    }
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
      resetManualForm();
      fetchQuizzes();
    } catch (err: any) {
      await window.showAlert(err.response?.data?.message || 'Lỗi lưu đề thi.', 'Lỗi lưu đề thi');
    }
  };

  const handleEditQuiz = async (quiz: any) => {
    try {
      // includeVariants=true chỉ có tác dụng khi quiz._id là đề gốc — cần biết số
      // mã đề anh em để cảnh báo rõ phạm vi ảnh hưởng của lần sửa này.
      const res = await axios.get(`/api/quizzes/${quiz._id}?includeVariants=true`);
      const fullQuiz = res.data;
      setEditingQuizId(fullQuiz._id);
      setEditingExamCode(fullQuiz.examCode || (fullQuiz.parentQuizId ? null : (fullQuiz.variants?.length > 0 ? '001' : null)));
      setEditingSiblingCount(fullQuiz.parentQuizId ? 0 : (fullQuiz.variants?.length || 0));
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
      const res = await axios.get(`/api/quizzes/${quiz._id}?includeVariants=true`);
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
    includeAnswers?: boolean;
    showPageNumber?: boolean;
    pageNumberPosition?: PageNumberPosition;
    pageNumberShowLabel?: boolean;
    pageNumberShowTotal?: boolean;
    paperSize?: PaperSize;
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
      // In thẳng luôn — bản xem trước riêng của app không cần nữa vì bản
      // xem trước in thật của trình duyệt giờ đã sạch (không còn header/
      // footer mặc định) nên tự nó đã là bản xem trước rồi.
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
        includeAnswers: vpaData.includeAnswers,
        showPageNumber: vpaData.showPageNumber,
        pageNumberPosition: vpaData.pageNumberPosition,
        pageNumberShowLabel: vpaData.pageNumberShowLabel,
        pageNumberShowTotal: vpaData.pageNumberShowTotal,
        paperSize: vpaData.paperSize,
        quizzes: quizListToExport
      });
      return;
    }

    const exportParams = {
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
      orientation: vpaData.orientation,
      includeAnswers: vpaData.includeAnswers,
      showPageNumber: vpaData.showPageNumber,
      pageNumberPosition: vpaData.pageNumberPosition,
      pageNumberShowLabel: vpaData.pageNumberShowLabel,
      pageNumberShowTotal: vpaData.pageNumberShowTotal,
      paperSize: vpaData.paperSize
    };

    try {
      if (quizListToExport.length > 1) {
        // Gộp nhiều mã đề thành 1 file .zip duy nhất thay vì tải rời từng file
        const response = await axios.post('/api/quizzes/export-bulk', {
          quizIds: quizListToExport.map((q: any) => q._id),
          ...exportParams
        }, { responseType: 'blob' });

        const zipName = quizListToExport.length === 1 ? sanitizeFilenamePart(quizListToExport[0].title) : 'bo_de';
        const blobUrl = window.URL.createObjectURL(new Blob([response.data]));
        const link = document.createElement('a');
        link.href = blobUrl;
        link.setAttribute('download', `De_thi_${zipName}.zip`);
        document.body.appendChild(link);
        link.click();
        link.parentNode?.removeChild(link);
        window.URL.revokeObjectURL(blobUrl);
      } else {
        const currentQuiz = quizListToExport[0];
        const response = await axios.get(`/api/quizzes/${currentQuiz._id}/export`, {
          params: exportParams,
          responseType: 'blob'
        });
        const blobUrl = window.URL.createObjectURL(new Blob([response.data]));
        const link = document.createElement('a');
        link.href = blobUrl;
        link.setAttribute('download', `De_thi_${sanitizeFilenamePart(currentQuiz.title)}${vpaData.includeAnswers ? '_DapAn' : ''}.docx`);
        document.body.appendChild(link);
        link.click();
        link.parentNode?.removeChild(link);
        window.URL.revokeObjectURL(blobUrl);
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
    // Đây luôn là một đề MỚI (từ AI) — đảm bảo không kế thừa editingQuizId của
    // một phiên sửa đề trước đó, nếu không lần lưu sẽ đè nhầm lên đề cũ.
    setEditingQuizId(null);
    setEditingExamCode(null);
    setEditingSiblingCount(0);
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
    setAiProgressStep(1); // Tiếp nhận tệp
    setAiProgressTarget(5);
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
      // Tại đây server đã trích xuất xong văn bản (dù kết quả trả về ngay hay qua hàng đợi)
      setAiProgressStep(2); // Tải lên & trích xuất
      setAiProgressTarget(20);

      // Direct synchronous response — lấy từ cache, không qua hàng đợi
      if (res.status === 200) {
        const { message, quiz } = res.data;
        setAiProgressStep(4);
        setAiProgressTarget(100);
        await window.showAlert(message || 'Đã sinh đề thi thành công bằng AI!', 'Sinh đề AI');
        populateQuizPreview(quiz, originalName);
        setAiLoading(false);
        return;
      }

      // Đã đẩy vào hàng đợi BullMQ — theo dõi tiến trình thật qua polling
      const { jobId } = res.data;
      setAiProgressStep(3); // Xử lý tạo đề thi

      const pollInterval = setInterval(async () => {
        try {
          const statusRes = await axios.get(`/api/quizzes/generate-status/${jobId}`);
          const { status, quiz, message, progress } = statusRes.data;

          if (status === 'completed') {
            clearInterval(pollInterval);
            setAiProgressStep(4);
            setAiProgressTarget(100);
            await window.showAlert('Đã sinh câu hỏi thành công bằng AI!', 'Sinh đề AI');
            populateQuizPreview(quiz, originalName);
            setAiLoading(false);
          } else if (status === 'failed') {
            clearInterval(pollInterval);
            await window.showAlert(message || 'Tiến trình sinh đề thi thất bại.', 'Lỗi sinh đề thi AI');
            setAiLoading(false);
          } else if (typeof progress === 'number' && progress > 0) {
            // 'active' / 'waiting': cập nhật % thật lấy từ job.progress trên BullMQ
            setAiProgressTarget(Math.max(aiProgressTargetRef.current, Math.min(progress, 99)));
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

  // Deletion. Xóa đề gốc (parentQuizId rỗng) sẽ xóa cascade toàn bộ mã đề biến
  // thể liên quan ở backend — cảnh báo rõ khi biết trước variantCount; xóa một
  // mã đề biến thể cụ thể (parentQuizId có giá trị) chỉ xóa đúng mã đề đó.
  const handleDeleteQuiz = async (quiz: { _id: string; parentQuizId?: string | null; examCode?: string }, variantCount?: number) => {
    const isVariant = !!quiz.parentQuizId;
    let message = 'Đồng chí có chắc chắn muốn xóa đề thi này?';
    if (isVariant) {
      message = `Xóa mã đề ${quiz.examCode || ''} này? Các mã đề khác trong cùng bộ đề sẽ không bị ảnh hưởng.`;
    } else if (variantCount && variantCount > 0) {
      message = `Đây là đề gốc, xóa sẽ xóa LUÔN cả ${variantCount} mã đề biến thể liên quan. Hành động này không thể hoàn tác. Tiếp tục?`;
    } else if (variantCount === undefined) {
      message = 'Xóa đề thi này (và tất cả mã đề biến thể liên quan nếu có) khỏi hệ thống? Hành động này không thể hoàn tác.';
    }

    const confirmDelete = await window.showConfirm(message, 'Xóa đề thi');
    if (!confirmDelete) return;
    try {
      await axios.delete(`/api/quizzes/${quiz._id}`);
      setViewingQuiz(null);
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
    // Quan trọng: nếu không xóa editingQuizId ở đây, lần lưu tiếp theo (kể cả
    // một đề hoàn toàn mới) sẽ vô tình PUT đè lên đề đang sửa dở trước đó.
    setEditingQuizId(null);
    setEditingExamCode(null);
    setEditingSiblingCount(0);
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

  // Đóng bất kỳ sub-view (form tạo/sửa, import, rút đề, sinh AI, xem chi
  // tiết...) nào đang mở, kèm reset state tương ứng — dùng chung cho cả nút
  // "Hủy bỏ"/"Đóng lại" lẫn khi nút Back trình duyệt được bấm.
  const closeQuizSubview = () => {
    if (isCreating) { setIsCreating(false); resetManualForm(); }
    if (isGenerating) { setIsGenerating(false); resetGenForm(); }
    if (isImporting) { setIsImporting(false); setSelectedFile(null); }
    if (isGeneratingAI) { setIsGeneratingAI(false); setAiFiles([]); }
    if (isAddingToBank) { setIsAddingToBank(false); resetBankQForm(); }
    if (viewingQuiz) setViewingQuiz(null);
  };

  const isQuizSubviewOpen = isCreating || isGenerating || isImporting || isGeneratingAI || isAddingToBank || !!viewingQuiz;
  useSubviewBack(isQuizSubviewOpen, closeQuizSubview);


  return (
    <div className="max-w-7xl mx-auto px-6 py-8">
      
      {/* Header Navigation */}
      <div className="flex items-center justify-between mb-8 pb-4 border-b border-vpa-olive-light/30">
        <div className="flex items-center space-x-4">
          <button
            onClick={() => (isQuizSubviewOpen ? closeQuizSubview() : onNavigateBack())}
            className="p-2 border border-vpa-olive-light/30 hover:bg-vpa-olive-light/10 text-vpa-olive dark:text-vpa-sand transition-colors"
          >
            <ArrowLeft size={18} />
          </button>
          <div>
            <h1 className="text-lg font-bold uppercase tracking-wider text-vpa-olive dark:text-vpa-sand">
              Quản lý kho đề & ngân hàng câu hỏi
            </h1>
            <p className="text-[10px] text-gray-500 uppercase tracking-widest font-mono">
              Quản trị hệ thống thi trắc nghiệm
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
              Kho đề thi
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
                  className="px-3 py-1.5 border border-vpa-gold text-vpa-gold dark:text-vpa-gold-bright hover:bg-vpa-gold/10 text-xs font-bold uppercase tracking-wider flex items-center space-x-2"
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
                  onClick={() => { resetManualForm(); setIsCreating(true); handleAddQuestion(); }}
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
            <div className="border border-vpa-olive-light/50 bg-vpa-sand-light dark:bg-vpa-dark-card mb-6 shadow-sm rounded-lg overflow-hidden">
              <div className="p-4 flex flex-col gap-3 sm:flex-row sm:items-center">
                <div className="relative flex-1 min-w-0">
                  <input
                    type="text"
                    value={searchQuiz}
                    onChange={e => setSearchQuiz(e.target.value)}
                    placeholder="Tìm kiếm đề thi..."
                    className="w-full text-xs p-2 pl-8 bg-transparent border border-vpa-olive-light focus:outline-none focus:border-vpa-gold text-vpa-olive dark:text-vpa-sand"
                  />
                  <MagnifyingGlassIcon size={14} className="absolute left-2.5 top-2.5 text-gray-500" />
                </div>

                <button
                  type="button"
                  onClick={() => setShowQuizAdvancedFilter(prev => !prev)}
                  className={`shrink-0 flex items-center space-x-1.5 px-2.5 py-1.5 border text-xs font-bold uppercase tracking-wider transition-colors ${
                    showQuizAdvancedFilter || quizAdvancedFilterCount > 0
                      ? 'bg-vpa-olive text-white border-transparent dark:bg-vpa-gold dark:text-vpa-dark'
                      : 'border-vpa-olive-light text-vpa-olive dark:text-vpa-sand hover:bg-vpa-olive-light/10'
                  }`}
                >
                  <Funnel size={14} />
                  <span>Bộ lọc nâng cao</span>
                  {quizAdvancedFilterCount > 0 && (
                    <span className="w-4 h-4 rounded-full bg-vpa-red text-white text-[9px] flex items-center justify-center font-mono">
                      {quizAdvancedFilterCount}
                    </span>
                  )}
                </button>
              </div>

              {/* Advanced filter panel — trượt xuống thay vì popup, gồm mọi thuộc tính có trong bảng */}
              <div className={`grid transition-all duration-300 ease-in-out ${showQuizAdvancedFilter ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0'}`}>
                <div className="overflow-hidden">
                  <div className="p-4 border-t border-vpa-olive-light/30 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                    <div>
                      <label className="block text-[9px] uppercase tracking-wider font-semibold text-gray-500 mb-1">Chuyên ngành</label>
                      <Select
                        value={quizCategoryFilter}
                        onChange={setQuizCategoryFilter}
                        className="w-full text-xs p-2 bg-transparent border border-vpa-olive-light text-vpa-olive dark:text-vpa-sand focus:outline-none focus:border-vpa-gold rounded-lg flex items-center justify-between gap-2"
                      >
                        <option value="">Tất cả</option>
                        {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                      </Select>
                    </div>
                    <div>
                      <label className="block text-[9px] uppercase tracking-wider font-semibold text-gray-500 mb-1">Trạng thái</label>
                      <Select
                        value={quizStatusFilter}
                        onChange={setQuizStatusFilter}
                        className="w-full text-xs p-2 bg-transparent border border-vpa-olive-light text-vpa-olive dark:text-vpa-sand focus:outline-none focus:border-vpa-gold rounded-lg flex items-center justify-between gap-2"
                      >
                        <option value="">Tất cả</option>
                        <option value="true">Công khai</option>
                        <option value="false">Nội bộ</option>
                      </Select>
                    </div>
                    <div>
                      <label className="block text-[9px] uppercase tracking-wider font-semibold text-gray-500 mb-1">Đồng chí soạn</label>
                      <input
                        type="text"
                        value={quizCreatorFilter}
                        onChange={e => setQuizCreatorFilter(e.target.value)}
                        placeholder="Tên người soạn..."
                        className="w-full text-xs p-2 bg-transparent border border-vpa-olive-light text-vpa-olive dark:text-vpa-sand focus:outline-none focus:border-vpa-gold rounded-lg"
                      />
                    </div>
                    <div>
                      <label className="block text-[9px] uppercase tracking-wider font-semibold text-gray-500 mb-1">Mã chia sẻ</label>
                      <input
                        type="text"
                        value={quizShareCodeFilter}
                        onChange={e => setQuizShareCodeFilter(e.target.value)}
                        placeholder="VD: A1B2C3"
                        className="w-full text-xs p-2 bg-transparent border border-vpa-olive-light text-vpa-olive dark:text-vpa-sand focus:outline-none focus:border-vpa-gold font-mono uppercase rounded-lg"
                      />
                    </div>
                    <div>
                      <label className="block text-[9px] uppercase tracking-wider font-semibold text-gray-500 mb-1">Thời gian làm bài (phút)</label>
                      <div className="flex items-center space-x-2">
                        <input
                          type="number"
                          min={0}
                          value={quizDurationMin}
                          onChange={e => setQuizDurationMin(e.target.value)}
                          placeholder="Từ"
                          className="w-full text-xs p-2 bg-transparent border border-vpa-olive-light text-vpa-olive dark:text-vpa-sand focus:outline-none focus:border-vpa-gold rounded-lg"
                        />
                        <span className="text-gray-400">-</span>
                        <input
                          type="number"
                          min={0}
                          value={quizDurationMax}
                          onChange={e => setQuizDurationMax(e.target.value)}
                          placeholder="Đến"
                          className="w-full text-xs p-2 bg-transparent border border-vpa-olive-light text-vpa-olive dark:text-vpa-sand focus:outline-none focus:border-vpa-gold rounded-lg"
                        />
                      </div>
                    </div>
                    <div>
                      <label className="block text-[9px] uppercase tracking-wider font-semibold text-gray-500 mb-1">Tạo từ ngày</label>
                      <DatePicker
                        value={quizCreatedFrom}
                        onChange={setQuizCreatedFrom}
                        className="w-full text-xs p-2 pr-9 bg-transparent border border-vpa-olive-light text-vpa-olive dark:text-vpa-sand focus:outline-none focus:border-vpa-gold text-left rounded-lg"
                      />
                    </div>
                    <div>
                      <label className="block text-[9px] uppercase tracking-wider font-semibold text-gray-500 mb-1">Đến ngày</label>
                      <DatePicker
                        value={quizCreatedTo}
                        onChange={setQuizCreatedTo}
                        className="w-full text-xs p-2 pr-9 bg-transparent border border-vpa-olive-light text-vpa-olive dark:text-vpa-sand focus:outline-none focus:border-vpa-gold text-left rounded-lg"
                      />
                    </div>
                    <div className="sm:col-span-2 lg:col-span-4 flex justify-end">
                      <button
                        type="button"
                        onClick={handleClearQuizAdvancedFilters}
                        disabled={quizAdvancedFilterCount === 0}
                        className="text-[10px] uppercase tracking-wider font-bold text-vpa-red hover:underline disabled:opacity-40 disabled:no-underline disabled:cursor-not-allowed"
                      >
                        Xóa bộ lọc nâng cao
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* List Quizzes Table */}
          {!isCreating && !isImporting && !isGenerating && !isGeneratingAI && (
            <div className="border border-vpa-olive-light/50 bg-vpa-sand-light dark:bg-vpa-dark-card p-6 shadow-md rounded-lg">
              <div className="hidden md:block overflow-x-auto">
                <table className={`w-full text-left border-collapse text-xs ${quizResized ? 'table-fixed' : ''}`}>
                  <thead>
                    <tr className="border-b border-vpa-olive-light/30 text-gray-500 font-mono uppercase text-[10px]">
                      <th 
                        className="relative py-3 px-4 cursor-pointer hover:text-vpa-gold transition-colors select-none pr-6 whitespace-nowrap"
                        style={quizResized ? { width: quizColWidths.title, minWidth: quizColWidths.title } : undefined}
                        onClick={() => handleQuizSort('title')}
                      >
                        Tên đề thi {renderSortIndicator('title', quizSortField, quizSortOrder)}
                        <div 
                          className="absolute right-0 top-0 bottom-0 w-3 cursor-col-resize z-10 group"
                          onMouseDown={(e) => handleResizeMouseDown('quiz', 'title', e)}
                          onClick={(e) => { e.preventDefault(); e.stopPropagation(); }}
                        >
                          <div className="absolute right-0 top-0 bottom-0 w-[2px] group-hover:w-[6px] bg-vpa-olive-light/30 dark:bg-vpa-gold/20 group-hover:bg-vpa-gold transition-all duration-200" />
                        </div>
                      </th>
                      <th 
                        className="relative py-3 px-4 cursor-pointer hover:text-vpa-gold transition-colors select-none pr-6 whitespace-nowrap"
                        style={quizResized ? { width: quizColWidths.category, minWidth: quizColWidths.category } : undefined}
                        onClick={() => handleQuizSort('category')}
                      >
                        Chuyên ngành {renderSortIndicator('category', quizSortField, quizSortOrder)}
                        <div 
                          className="absolute right-0 top-0 bottom-0 w-3 cursor-col-resize z-10 group"
                          onMouseDown={(e) => handleResizeMouseDown('quiz', 'category', e)}
                          onClick={(e) => { e.preventDefault(); e.stopPropagation(); }}
                        >
                          <div className="absolute right-0 top-0 bottom-0 w-[2px] group-hover:w-[6px] bg-vpa-olive-light/30 dark:bg-vpa-gold/20 group-hover:bg-vpa-gold transition-all duration-200" />
                        </div>
                      </th>
                      <th 
                        className="relative py-3 px-4 cursor-pointer hover:text-vpa-gold transition-colors select-none pr-6 whitespace-nowrap"
                        style={quizResized ? { width: quizColWidths.info, minWidth: quizColWidths.info } : undefined}
                        onClick={() => handleQuizSort('duration')}
                      >
                        Thông tin đề {renderSortIndicator('duration', quizSortField, quizSortOrder)}
                        <div 
                          className="absolute right-0 top-0 bottom-0 w-3 cursor-col-resize z-10 group"
                          onMouseDown={(e) => handleResizeMouseDown('quiz', 'info', e)}
                          onClick={(e) => { e.preventDefault(); e.stopPropagation(); }}
                        >
                          <div className="absolute right-0 top-0 bottom-0 w-[2px] group-hover:w-[6px] bg-vpa-olive-light/30 dark:bg-vpa-gold/20 group-hover:bg-vpa-gold transition-all duration-200" />
                        </div>
                      </th>
                      <th 
                        className="relative py-3 px-4 cursor-pointer hover:text-vpa-gold transition-colors select-none pr-6 whitespace-nowrap"
                        style={quizResized ? { width: quizColWidths.author, minWidth: quizColWidths.author } : undefined}
                        onClick={() => handleQuizSort('author')}
                      >
                        Đồng chí soạn {renderSortIndicator('author', quizSortField, quizSortOrder)}
                        <div 
                          className="absolute right-0 top-0 bottom-0 w-3 cursor-col-resize z-10 group"
                          onMouseDown={(e) => handleResizeMouseDown('quiz', 'author', e)}
                          onClick={(e) => { e.preventDefault(); e.stopPropagation(); }}
                        >
                          <div className="absolute right-0 top-0 bottom-0 w-[2px] group-hover:w-[6px] bg-vpa-olive-light/30 dark:bg-vpa-gold/20 group-hover:bg-vpa-gold transition-all duration-200" />
                        </div>
                      </th>
                      <th 
                        className="relative py-3 px-4 cursor-pointer hover:text-vpa-gold transition-colors select-none pr-6 whitespace-nowrap"
                        style={quizResized ? { width: quizColWidths.createdAt, minWidth: quizColWidths.createdAt } : undefined}
                        onClick={() => handleQuizSort('createdAt')}
                      >
                        Thời gian tạo {renderSortIndicator('createdAt', quizSortField, quizSortOrder)}
                        <div 
                          className="absolute right-0 top-0 bottom-0 w-3 cursor-col-resize z-10 group"
                          onMouseDown={(e) => handleResizeMouseDown('quiz', 'createdAt', e)}
                          onClick={(e) => { e.preventDefault(); e.stopPropagation(); }}
                        >
                          <div className="absolute right-0 top-0 bottom-0 w-[2px] group-hover:w-[6px] bg-vpa-olive-light/30 dark:bg-vpa-gold/20 group-hover:bg-vpa-gold transition-all duration-200" />
                        </div>
                      </th>
                      <th 
                        className="relative py-3 px-4 cursor-pointer hover:text-vpa-gold transition-colors select-none pr-6 whitespace-nowrap"
                        style={quizResized ? { width: quizColWidths.status, minWidth: quizColWidths.status } : undefined}
                        onClick={() => handleQuizSort('isPublic')}
                      >
                        Trạng thái {renderSortIndicator('isPublic', quizSortField, quizSortOrder)}
                        <div 
                          className="absolute right-0 top-0 bottom-0 w-3 cursor-col-resize z-10 group"
                          onMouseDown={(e) => handleResizeMouseDown('quiz', 'status', e)}
                          onClick={(e) => { e.preventDefault(); e.stopPropagation(); }}
                        >
                          <div className="absolute right-0 top-0 bottom-0 w-[2px] group-hover:w-[6px] bg-vpa-olive-light/30 dark:bg-vpa-gold/20 group-hover:bg-vpa-gold transition-all duration-200" />
                        </div>
                      </th>
                      <th 
                        className="relative py-3 px-4 cursor-pointer hover:text-vpa-gold transition-colors select-none pr-6 whitespace-nowrap"
                        style={quizResized ? { width: quizColWidths.shareCode, minWidth: quizColWidths.shareCode } : undefined}
                        onClick={() => handleQuizSort('shareCode')}
                      >
                        Mã chia sẻ {renderSortIndicator('shareCode', quizSortField, quizSortOrder)}
                        <div 
                          className="absolute right-0 top-0 bottom-0 w-3 cursor-col-resize z-10 group"
                          onMouseDown={(e) => handleResizeMouseDown('quiz', 'shareCode', e)}
                          onClick={(e) => { e.preventDefault(); e.stopPropagation(); }}
                        >
                          <div className="absolute right-0 top-0 bottom-0 w-[2px] group-hover:w-[6px] bg-vpa-olive-light/30 dark:bg-vpa-gold/20 group-hover:bg-vpa-gold transition-all duration-200" />
                        </div>
                      </th>
                      <th 
                        className="py-3 px-4 text-right select-none"
                        style={quizResized ? { width: quizColWidths.actions, minWidth: quizColWidths.actions } : undefined}
                      >
                        Thao tác
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {quizzesLoading ? (
                      Array.from({ length: quizSkeletonRowCount }).map((_, idx) => (
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
                          <td className="py-4 px-4 text-right">
                            <div className="inline-flex justify-end space-x-2">
                              <div className="w-12 h-6 bg-vpa-olive-light/10 dark:bg-vpa-gold/10 rounded"></div>
                              <div className="w-12 h-6 bg-vpa-olive-light/10 dark:bg-vpa-gold/10 rounded"></div>
                              <div className="w-12 h-6 bg-vpa-olive-light/10 dark:bg-vpa-gold/10 rounded"></div>
                            </div>
                          </td>
                        </tr>
                      ))
                    ) : (
                      displayedQuizzes.map(quiz => {
                        const perm = getQuizPermission(quiz);
                        return (
                        <tr key={quiz._id} className="border-b border-vpa-olive-light/10 hover:bg-vpa-olive-light/5">
                          <td className="py-3 px-4 font-bold text-vpa-olive dark:text-vpa-sand uppercase">
                            <Tooltip content={quiz.title} className="block">
                              <div
                                style={{ maxWidth: quizResized ? quizColWidths.title - 32 : 250 }}
                                className="truncate"
                              >
                                {quiz.title}
                              </div>
                            </Tooltip>
                          </td>
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
                                onClick={(e) => {
                                  if (activeDropdownQuizId === quiz._id) {
                                    setActiveDropdownQuizId(null);
                                  } else {
                                    const rect = e.currentTarget.getBoundingClientRect();
                                    setDropdownPos({ top: rect.bottom + 6, left: rect.right - 144 });
                                    setActiveDropdownQuizId(quiz._id);
                                  }
                                }}
                                className="px-3 py-1.5 border border-vpa-olive-light/50 bg-vpa-sand-light dark:bg-vpa-dark-card text-vpa-olive dark:text-vpa-sand hover:bg-vpa-olive hover:text-white dark:hover:bg-vpa-gold dark:hover:text-vpa-dark text-[10px] uppercase font-mono font-bold tracking-wider transition-colors inline-flex items-center space-x-1 rounded-lg"
                              >
                                <span>Thao tác</span>
                                <span className="text-[8px]">▼</span>
                              </button>

                              {activeDropdownQuizId === quiz._id && dropdownPos && createPortal(
                                <>
                                  {/* Transparent click catcher backdrop */}
                                  <div
                                    className="fixed inset-0 z-40 cursor-default"
                                    onClick={() => setActiveDropdownQuizId(null)}
                                  />

                                  {/* Dropdown Menu Box — rendered via portal so the table's overflow-x-auto wrapper can't clip it */}
                                  <div
                                    className="fixed w-36 border border-vpa-olive-light bg-vpa-sand-light dark:bg-vpa-dark-card shadow-lg z-50 rounded-lg overflow-hidden flex flex-col animate-fadeIn"
                                    style={{ top: dropdownPos.top, left: dropdownPos.left }}
                                  >
                                    <button
                                      type="button"
                                      onClick={() => { setActiveDropdownQuizId(null); handleViewQuiz(quiz); }}
                                      className="w-full text-left px-3 py-2 text-[10px] font-bold uppercase text-vpa-olive dark:text-vpa-sand hover:bg-vpa-olive hover:text-white dark:hover:bg-vpa-gold dark:hover:text-vpa-dark transition-colors border-b border-vpa-olive-light/10"
                                    >
                                      Xem đề
                                    </button>
                                    {canCreateRoom && (
                                      <button
                                        type="button"
                                        onClick={() => { setActiveDropdownQuizId(null); setCreateRoomQuizId(quiz._id); }}
                                        className="w-full text-left px-3 py-2 text-[10px] font-bold uppercase text-vpa-olive dark:text-vpa-sand hover:bg-vpa-olive hover:text-white dark:hover:bg-vpa-gold dark:hover:text-vpa-dark transition-colors border-b border-vpa-olive-light/10"
                                      >
                                        Tạo phòng thi
                                      </button>
                                    )}
                                    {perm.canEdit && (
                                      <button
                                        type="button"
                                        onClick={() => { setActiveDropdownQuizId(null); handleEditQuiz(quiz); }}
                                        className="w-full text-left px-3 py-2 text-[10px] font-bold uppercase text-vpa-olive dark:text-vpa-sand hover:bg-vpa-olive hover:text-white dark:hover:bg-vpa-gold dark:hover:text-vpa-dark transition-colors border-b border-vpa-olive-light/10"
                                      >
                                        Sửa đề
                                      </button>
                                    )}
                                    <button
                                      type="button"
                                      onClick={() => { setActiveDropdownQuizId(null); handleOpenExportPopup(quiz); }}
                                      className="w-full text-left px-3 py-2 text-[10px] font-bold uppercase text-vpa-olive dark:text-vpa-sand hover:bg-vpa-olive hover:text-white dark:hover:bg-vpa-gold dark:hover:text-vpa-dark transition-colors border-b border-vpa-olive-light/10"
                                    >
                                      Xuất bản
                                    </button>
                                    {perm.canShare && (
                                      <button
                                        type="button"
                                        onClick={() => { setActiveDropdownQuizId(null); setShareQuizTarget(quiz); }}
                                        className="w-full text-left px-3 py-2 text-[10px] font-bold uppercase text-vpa-olive dark:text-vpa-sand hover:bg-vpa-olive hover:text-white dark:hover:bg-vpa-gold dark:hover:text-vpa-dark transition-colors border-b border-vpa-olive-light/10"
                                      >
                                        Chia sẻ
                                      </button>
                                    )}
                                    {perm.canDelete && (
                                      <button
                                        type="button"
                                        onClick={() => { setActiveDropdownQuizId(null); handleDeleteQuiz(quiz); }}
                                        className="w-full text-left px-3 py-2 text-[10px] font-bold uppercase text-vpa-red hover:bg-vpa-red hover:text-white transition-colors"
                                      >
                                        Xóa đề
                                      </button>
                                    )}
                                  </div>
                                </>,
                                document.body
                              )}
                            </div>
                          </td>
                        </tr>
                        );
                      })
                    )}
                    {!quizzesLoading && displayedQuizzes.length === 0 && (
                      <tr>
                        <td colSpan={6} className={`text-center py-8 ${quizFetchError ? 'text-vpa-red font-bold' : 'text-gray-400'}`}>
                          {quizFetchError
                            ? quizFetchError
                            : quizzes.length === 0
                            ? "Chưa có đề thi quân sự nào được xuất bản."
                            : "Không tìm thấy đề thi phù hợp với bộ lọc tìm kiếm."}
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>

              {/* Mobile card list */}
              <div className="md:hidden divide-y divide-vpa-olive-light/10">
                {quizzesLoading ?
                  Array.from({ length: quizSkeletonRowCount }).map((_, idx) => (
                    <div key={idx} className="py-4 animate-pulse space-y-2">
                      <div className="w-40 h-4 bg-vpa-olive-light/20 dark:bg-vpa-gold/15 rounded"></div>
                      <div className="flex gap-1.5">
                        <div className="w-20 h-4 bg-vpa-olive-light/10 dark:bg-vpa-gold/10 rounded"></div>
                        <div className="w-16 h-4 bg-vpa-olive-light/10 dark:bg-vpa-gold/10 rounded"></div>
                      </div>
                      <div className="w-48 h-3 bg-vpa-olive-light/10 dark:bg-vpa-gold/10 rounded"></div>
                    </div>
                  ))
                :
                  displayedQuizzes.map(quiz => {
                    const perm = getQuizPermission(quiz);
                    return (
                    <div key={quiz._id} className="py-4">
                      <div className="flex justify-between items-start gap-2 mb-2">
                        <Tooltip content={quiz.title} className="min-w-0 flex-1 block">
                          <h4 className="text-xs font-bold uppercase text-vpa-olive dark:text-vpa-sand line-clamp-2">{quiz.title}</h4>
                        </Tooltip>
                        {quiz.isPublic ? (
                          <span className="shrink-0 text-[9px] font-bold text-green-600 uppercase">Công khai</span>
                        ) : (
                          <span className="shrink-0 text-[9px] text-gray-400 uppercase">Nội bộ</span>
                        )}
                      </div>

                      <div className="flex flex-wrap gap-1.5 mb-2">
                        <span className="px-2 py-0.5 bg-vpa-olive-light/10 text-vpa-olive dark:text-vpa-sand text-[9px] font-mono uppercase">{quiz.category}</span>
                        <span className="px-2 py-0.5 bg-vpa-olive-light/10 text-vpa-olive dark:text-vpa-sand text-[9px] font-mono uppercase font-bold">{quiz.shareCode}</span>
                      </div>

                      <p className="text-[10px] text-gray-500 mb-1">
                        {quiz.questions.length} câu / {quiz.duration} phút ({quiz.passingScorePercent}% Đạt)
                      </p>
                      <p className="text-[10px] text-gray-500 mb-3">
                        {quiz.creatorId?.fullName || 'Hệ thống'} · {quiz.createdAt ? new Date(quiz.createdAt).toLocaleString('vi-VN', {
                          hour: '2-digit',
                          minute: '2-digit',
                          day: '2-digit',
                          month: '2-digit',
                          year: 'numeric'
                        }) : 'N/A'}
                      </p>

                      <div className="flex justify-end border-t border-vpa-olive-light/10 pt-2.5">
                        <button
                          type="button"
                          onClick={(e) => {
                            if (activeDropdownQuizId === quiz._id) {
                              setActiveDropdownQuizId(null);
                            } else {
                              const rect = e.currentTarget.getBoundingClientRect();
                              setDropdownPos({ top: rect.bottom + 6, left: rect.right - 144 });
                              setActiveDropdownQuizId(quiz._id);
                            }
                          }}
                          className="px-3 py-1.5 border border-vpa-olive-light/50 bg-vpa-sand-light dark:bg-vpa-dark-card text-vpa-olive dark:text-vpa-sand hover:bg-vpa-olive hover:text-white dark:hover:bg-vpa-gold dark:hover:text-vpa-dark text-[10px] uppercase font-mono font-bold tracking-wider transition-colors inline-flex items-center space-x-1 rounded-lg"
                        >
                          <span>Thao tác</span>
                          <span className="text-[8px]">▼</span>
                        </button>

                        {activeDropdownQuizId === quiz._id && dropdownPos && createPortal(
                          <>
                            <div
                              className="fixed inset-0 z-40 cursor-default"
                              onClick={() => setActiveDropdownQuizId(null)}
                            />
                            <div
                              className="fixed w-36 border border-vpa-olive-light bg-vpa-sand-light dark:bg-vpa-dark-card shadow-lg z-50 rounded-lg overflow-hidden flex flex-col animate-fadeIn"
                              style={{ top: dropdownPos.top, left: dropdownPos.left }}
                            >
                              <button
                                type="button"
                                onClick={() => { setActiveDropdownQuizId(null); handleViewQuiz(quiz); }}
                                className="w-full text-left px-3 py-2 text-[10px] font-bold uppercase text-vpa-olive dark:text-vpa-sand hover:bg-vpa-olive hover:text-white dark:hover:bg-vpa-gold dark:hover:text-vpa-dark transition-colors border-b border-vpa-olive-light/10"
                              >
                                Xem đề
                              </button>
                              {canCreateRoom && (
                                <button
                                  type="button"
                                  onClick={() => { setActiveDropdownQuizId(null); setCreateRoomQuizId(quiz._id); }}
                                  className="w-full text-left px-3 py-2 text-[10px] font-bold uppercase text-vpa-olive dark:text-vpa-sand hover:bg-vpa-olive hover:text-white dark:hover:bg-vpa-gold dark:hover:text-vpa-dark transition-colors border-b border-vpa-olive-light/10"
                                >
                                  Tạo phòng thi
                                </button>
                              )}
                              {perm.canEdit && (
                                <button
                                  type="button"
                                  onClick={() => { setActiveDropdownQuizId(null); handleEditQuiz(quiz); }}
                                  className="w-full text-left px-3 py-2 text-[10px] font-bold uppercase text-vpa-olive dark:text-vpa-sand hover:bg-vpa-olive hover:text-white dark:hover:bg-vpa-gold dark:hover:text-vpa-dark transition-colors border-b border-vpa-olive-light/10"
                                >
                                  Sửa đề
                                </button>
                              )}
                              <button
                                type="button"
                                onClick={() => { setActiveDropdownQuizId(null); handleOpenExportPopup(quiz); }}
                                className="w-full text-left px-3 py-2 text-[10px] font-bold uppercase text-vpa-olive dark:text-vpa-sand hover:bg-vpa-olive hover:text-white dark:hover:bg-vpa-gold dark:hover:text-vpa-dark transition-colors border-b border-vpa-olive-light/10"
                              >
                                Xuất bản
                              </button>
                              {perm.canShare && (
                                <button
                                  type="button"
                                  onClick={() => { setActiveDropdownQuizId(null); setShareQuizTarget(quiz); }}
                                  className="w-full text-left px-3 py-2 text-[10px] font-bold uppercase text-vpa-olive dark:text-vpa-sand hover:bg-vpa-olive hover:text-white dark:hover:bg-vpa-gold dark:hover:text-vpa-dark transition-colors border-b border-vpa-olive-light/10"
                                >
                                  Chia sẻ
                                </button>
                              )}
                              {perm.canDelete && (
                                <button
                                  type="button"
                                  onClick={() => { setActiveDropdownQuizId(null); handleDeleteQuiz(quiz); }}
                                  className="w-full text-left px-3 py-2 text-[10px] font-bold uppercase text-vpa-red hover:bg-vpa-red hover:text-white transition-colors"
                                >
                                  Xóa đề
                                </button>
                              )}
                            </div>
                          </>,
                          document.body
                        )}
                      </div>
                    </div>
                    );
                  })
                }
                {!quizzesLoading && displayedQuizzes.length === 0 && (
                  <div className={`text-center py-8 ${quizFetchError ? 'text-vpa-red font-bold' : 'text-gray-400'}`}>
                    {quizFetchError
                      ? quizFetchError
                      : quizzes.length === 0
                      ? "Chưa có đề thi quân sự nào được xuất bản."
                      : "Không tìm thấy đề thi phù hợp với bộ lọc tìm kiếm."}
                  </div>
                )}
              </div>

              {/* Pagination controls */}
              <Pagination
                page={quizPage}
                totalPages={totalQuizPages}
                totalCount={totalQuizCount}
                pageSize={quizPageSize}
                onPageChange={setQuizPage}
                itemLabel="đề thi"
                className="mt-4"
              />
            </div>
          )}

          {/* Manual creation form */}
          {isCreating && (
            <form onSubmit={handleSaveManualQuiz} className="space-y-6">
              <div className="border border-vpa-olive-light/50 bg-vpa-sand-light dark:bg-vpa-dark-card p-6 shadow-md rounded-lg space-y-4">
                <h3 className="text-sm font-bold uppercase text-vpa-olive dark:text-vpa-sand pb-2 border-b border-vpa-olive-light/30">
                  Thông tin soạn đề thi
                </h3>

                {editingQuizId && editingSiblingCount > 0 && (
                  <div className="p-2.5 bg-vpa-gold/10 border-l-4 border-vpa-gold text-[11px] text-vpa-olive dark:text-vpa-sand">
                    Đang sửa <span className="font-bold">Mã đề {editingExamCode || '001'} (đề gốc)</span> — thay đổi này KHÔNG áp dụng cho {editingSiblingCount} mã đề biến thể khác trong cùng bộ đề. Để sửa riêng từng mã đề, vào "Xem đề" và chọn tab tương ứng.
                  </div>
                )}
                {editingQuizId && !editingSiblingCount && editingExamCode && (
                  <div className="p-2.5 bg-vpa-gold/10 border-l-4 border-vpa-gold text-[11px] text-vpa-olive dark:text-vpa-sand">
                    Đang sửa riêng <span className="font-bold">Mã đề {editingExamCode}</span> — các mã đề khác trong cùng bộ đề không bị ảnh hưởng.
                  </div>
                )}

                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  <div>
                    <label className="block text-[10px] uppercase tracking-wider text-gray-500 mb-1">Tên đề thi</label>
                    <Tooltip content={title} className="block">
                      <input
                        type="text"
                        required
                        value={title}
                        onChange={e => setTitle(e.target.value)}
                        placeholder="Kiểm tra lý luận chính trị năm 2026"
                        className="w-full text-xs p-2.5 bg-transparent border border-vpa-olive-light focus:outline-none focus:border-vpa-gold text-vpa-olive dark:text-vpa-sand rounded-lg"
                      />
                    </Tooltip>
                  </div>
                  <div>
                    <label className="block text-[10px] uppercase tracking-wider text-gray-500 mb-1">Chuyên ngành</label>
                    <Select
                      value={category}
                      onChange={setCategory}
                      className="w-full text-xs p-2.5 bg-transparent border border-vpa-olive-light focus:outline-none focus:border-vpa-gold text-vpa-olive dark:text-vpa-sand rounded-lg flex items-center justify-between gap-2"
                    >
                      {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                    </Select>
                  </div>
                  <div>
                    <label className="block text-[10px] uppercase tracking-wider text-gray-500 mb-1">Thời gian làm bài (Phút)</label>
                    <NumberStepper
                      required
                      min={1}
                      value={duration}
                      onChange={setDuration}
                      className="flex items-stretch w-full border border-vpa-olive-light bg-transparent focus-within:border-vpa-gold rounded-lg overflow-hidden"
                      inputClassName="w-full min-w-0 text-xs p-2.5 bg-transparent text-vpa-olive dark:text-vpa-sand focus:outline-none"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  <div>
                    <label className="block text-[10px] uppercase tracking-wider text-gray-500 mb-1">Mô tả tóm tắt</label>
                    <Tooltip content={description} className="block">
                      <input
                        type="text"
                        value={description}
                        onChange={e => setDescription(e.target.value)}
                        placeholder="Dành cho Chiến sĩ, Hạ sĩ quan"
                        className="w-full text-xs p-2.5 bg-transparent border border-vpa-olive-light focus:outline-none focus:border-vpa-gold text-vpa-olive dark:text-vpa-sand rounded-lg"
                      />
                    </Tooltip>
                  </div>
                  <div>
                    <label className="block text-[10px] uppercase tracking-wider text-gray-500 mb-1">Phần trăm đạt yêu cầu (%)</label>
                    <NumberStepper
                      required
                      min={1}
                      max={100}
                      value={passingScore}
                      onChange={setPassingScore}
                      className="flex items-stretch w-full border border-vpa-olive-light bg-transparent focus-within:border-vpa-gold rounded-lg overflow-hidden"
                      inputClassName="w-full min-w-0 text-xs p-2.5 bg-transparent text-vpa-olive dark:text-vpa-sand focus:outline-none"
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
                      <Select
                        value={String(numCodes)}
                        onChange={v => setNumCodes(parseInt(v))}
                        className="w-full text-xs p-2.5 bg-transparent border border-vpa-olive-light focus:outline-none focus:border-vpa-gold text-vpa-olive dark:text-vpa-sand font-bold rounded-lg flex items-center justify-between gap-2"
                      >
                        <option value="1">Không xáo trộn (Chỉ tạo 1 đề)</option>
                        <option value="2">Tạo 2 mã đề</option>
                        <option value="3">Tạo 3 mã đề</option>
                        <option value="4">Tạo 4 mã đề</option>
                      </Select>
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
                    className="border border-vpa-olive-light/50 bg-vpa-sand-light dark:bg-vpa-dark-card p-6 shadow-md rounded-lg space-y-4"
                  >
                    <div className="flex justify-between items-start">
                      <span className="font-mono text-xs font-bold text-vpa-gold">CÂU HỎI {qIdx + 1}</span>
                      <div className="flex items-center space-x-4">
                        <button
                          type="button"
                          onClick={() => handleRegenerateQuestion(qIdx)}
                          disabled={regeneratingQIdx !== null || !q.questionText}
                          className="text-vpa-olive dark:text-vpa-gold hover:underline text-xs uppercase font-bold flex items-center space-x-1 disabled:opacity-50 disabled:no-underline"
                        >
                          <Brain size={13} className={regeneratingQIdx === qIdx ? 'animate-pulse' : ''} />
                          <span>{regeneratingQIdx === qIdx ? 'Đang sinh lại...' : 'Sinh lại câu này bằng AI'}</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => handleRemoveQuestion(qIdx)}
                          className="text-vpa-red hover:underline text-xs uppercase font-bold"
                        >
                          Xóa câu
                        </button>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                      <div className="md:col-span-2">
                        <label className="block text-[10px] uppercase tracking-wider text-gray-500 mb-1">Nội dung câu hỏi</label>
                        <Tooltip content={q.questionText} className="block">
                          <input
                            type="text"
                            required
                            value={q.questionText}
                            onChange={e => handleQuestionChange(qIdx, 'questionText', e.target.value)}
                            placeholder="Câu hỏi..."
                            className="w-full text-xs p-2.5 bg-transparent border border-vpa-olive-light focus:outline-none focus:border-vpa-gold text-vpa-olive dark:text-vpa-sand rounded-lg"
                          />
                        </Tooltip>
                      </div>
                      <div>
                        <label className="block text-[10px] uppercase tracking-wider text-gray-500 mb-1">Dạng câu hỏi</label>
                        <Select
                          value={q.questionType}
                          onChange={(type: string) => {
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
                          className="w-full text-xs p-2.5 bg-transparent border border-vpa-olive-light focus:outline-none focus:border-vpa-gold text-vpa-olive dark:text-vpa-sand rounded-lg flex items-center justify-between gap-2"
                        >
                          <option value="multiple-choice">Trắc nghiệm A, B, C, D</option>
                          <option value="true-false">Đúng / Sai</option>
                          <option value="fill-in-the-blank">Điền vào ô trống</option>
                        </Select>
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
                                <Tooltip content={opt} className="block flex-1 min-w-0">
                                  <input
                                    type="text"
                                    required
                                    value={opt}
                                    onChange={e => handleOptionChange(qIdx, optIdx, e.target.value)}
                                    placeholder={`Lựa chọn ${letter}`}
                                    className="w-full text-xs p-2 bg-transparent border border-vpa-olive-light/50 focus:outline-none focus:border-vpa-gold text-vpa-olive dark:text-vpa-sand rounded-lg"
                                  />
                                </Tooltip>
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
                        <Tooltip content={q.correctAnswers[0]} className="block">
                          <input
                            type="text"
                            required
                            value={q.correctAnswers[0] || ''}
                            onChange={e => handleQuestionChange(qIdx, 'correctAnswers', [e.target.value])}
                            placeholder="Cụm từ đáp án đúng..."
                            className="w-full text-xs p-2 bg-transparent border border-vpa-olive-light focus:outline-none focus:border-vpa-gold text-vpa-olive dark:text-vpa-sand rounded-lg"
                          />
                        </Tooltip>
                      </div>
                    )}

                    <div>
                      <label className="block text-[10px] uppercase tracking-wider text-gray-500 mb-1">Lời giải thích bổ sung</label>
                      <Tooltip content={q.explanation} className="block">
                        <input
                          type="text"
                          value={q.explanation}
                          onChange={e => handleQuestionChange(qIdx, 'explanation', e.target.value)}
                          placeholder="Căn cứ pháp lý..."
                          className="w-full text-xs p-2 bg-transparent border border-vpa-olive-light/50 focus:outline-none focus:border-vpa-gold text-vpa-olive dark:text-vpa-sand rounded-lg"
                        />
                      </Tooltip>
                    </div>
                  </div>
                ))}
              </div>

              <div className="flex justify-end space-x-4 border-t border-vpa-olive-light/30 pt-6">
                <button
                  type="button"
                  onClick={() => { setIsCreating(false); resetManualForm(); }}
                  className="px-4 py-2 border border-vpa-olive-light text-xs uppercase tracking-wider text-vpa-olive dark:text-vpa-sand hover:bg-vpa-olive hover:text-white rounded-lg"
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
              <div className="border border-vpa-olive-light/50 bg-vpa-sand-light dark:bg-vpa-dark-card p-6 shadow-md rounded-lg space-y-4">
                <h3 className="text-sm font-bold uppercase text-vpa-olive dark:text-vpa-sand pb-2 border-b border-vpa-olive-light/30 flex items-center space-x-2">
                  <Shuffle size={18} className="text-vpa-gold" />
                  <span>Rút đề ngẫu nhiên từ Ngân hàng câu hỏi tập trung</span>
                </h3>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <label className="block text-[10px] uppercase tracking-wider text-gray-500 mb-1">Tên đề thi tự động</label>
                    <Tooltip content={genTitle} className="block">
                      <input
                        type="text"
                        required
                        value={genTitle}
                        onChange={e => setGenTitle(e.target.value)}
                        placeholder="Đề kiểm tra ngẫu nhiên chuyên ngành"
                        className="w-full text-xs p-2.5 bg-transparent border border-vpa-olive-light focus:outline-none focus:border-vpa-gold text-vpa-olive dark:text-vpa-sand rounded-lg"
                      />
                    </Tooltip>
                  </div>
                  <div>
                    <label className="block text-[10px] uppercase tracking-wider text-gray-500 mb-1">Mô tả tóm tắt</label>
                    <Tooltip content={genDescription} className="block">
                      <input
                        type="text"
                        value={genDescription}
                        onChange={e => setGenDescription(e.target.value)}
                        placeholder="Tự động rút đề khách quan dựa trên ngân hàng câu hỏi..."
                        className="w-full text-xs p-2.5 bg-transparent border border-vpa-olive-light focus:outline-none focus:border-vpa-gold text-vpa-olive dark:text-vpa-sand rounded-lg"
                      />
                    </Tooltip>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  <div>
                    <label className="block text-[10px] uppercase tracking-wider text-gray-500 mb-1">Thời gian làm bài (Phút)</label>
                    <NumberStepper
                      required
                      min={1}
                      value={genDuration}
                      onChange={setGenDuration}
                      className="flex items-stretch w-full border border-vpa-olive-light bg-transparent focus-within:border-vpa-gold rounded-lg overflow-hidden"
                      inputClassName="w-full min-w-0 text-xs p-2.5 bg-transparent text-vpa-olive dark:text-vpa-sand focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] uppercase tracking-wider text-gray-500 mb-1">Phần trăm đạt yêu cầu (%)</label>
                    <NumberStepper
                      required
                      min={1}
                      max={100}
                      value={genPassingScore}
                      onChange={setGenPassingScore}
                      className="flex items-stretch w-full border border-vpa-olive-light bg-transparent focus-within:border-vpa-gold rounded-lg overflow-hidden"
                      inputClassName="w-full min-w-0 text-xs p-2.5 bg-transparent text-vpa-olive dark:text-vpa-sand focus:outline-none"
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
              <div className="space-y-4 border border-vpa-olive-light/50 bg-vpa-sand-light dark:bg-vpa-dark-card p-6 shadow-md rounded-lg">
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
                        <Select
                          value={rule.category}
                          onChange={v => handleRuleChange(idx, 'category', v)}
                          className="w-full text-xs p-2 bg-transparent border border-vpa-olive-light text-vpa-olive dark:text-vpa-sand focus:outline-none rounded-lg flex items-center justify-between gap-2"
                        >
                          {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                        </Select>
                      </div>
                      <div className="w-1/3">
                        <label className="block text-[9px] uppercase text-gray-500 mb-1">Độ khó</label>
                        <Select
                          value={rule.difficulty}
                          onChange={v => handleRuleChange(idx, 'difficulty', v)}
                          className="w-full text-xs p-2 bg-transparent border border-vpa-olive-light text-vpa-olive dark:text-vpa-sand focus:outline-none rounded-lg flex items-center justify-between gap-2"
                        >
                          {DIFFICULTIES.map(d => <option key={d} value={d}>{d}</option>)}
                        </Select>
                      </div>
                      <div className="w-1/4">
                        <label className="block text-[9px] uppercase text-gray-500 mb-1">Số lượng câu</label>
                        <NumberStepper
                          required
                          min={1}
                          value={rule.count}
                          onChange={v => handleRuleChange(idx, 'count', v)}
                          className="flex items-stretch w-full border border-vpa-olive-light bg-transparent focus-within:border-vpa-gold rounded-lg overflow-hidden"
                          inputClassName="w-full min-w-0 text-xs p-2 bg-transparent text-vpa-olive dark:text-vpa-sand focus:outline-none"
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
                  className="px-4 py-2 border border-vpa-olive-light text-xs uppercase tracking-wider text-vpa-olive dark:text-vpa-sand hover:bg-vpa-olive hover:text-white rounded-lg"
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
              <div className="border border-vpa-olive-light/50 bg-vpa-sand-light dark:bg-vpa-dark-card p-6 shadow-md rounded-lg space-y-4">
                <h3 className="text-sm font-bold uppercase text-vpa-olive dark:text-vpa-sand pb-2 border-b border-vpa-olive-light/30">
                  Cài đặt bộ đề nhập tệp (Import)
                </h3>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <label className="block text-[10px] uppercase tracking-wider text-gray-500 mb-1">Tên đề thi sau khi nhập</label>
                    <Tooltip content={importTitle} className="block">
                      <input
                        type="text"
                        required
                        value={importTitle}
                        onChange={e => setImportTitle(e.target.value)}
                        placeholder="Đề thi trắc nghiệm quân sự tổng hợp"
                        className="w-full text-xs p-2 bg-transparent border border-vpa-olive-light focus:outline-none focus:border-vpa-gold text-vpa-olive dark:text-vpa-sand rounded-lg"
                      />
                    </Tooltip>
                  </div>
                  <div>
                    <label className="block text-[10px] uppercase tracking-wider text-gray-500 mb-1">Chuyên ngành</label>
                    <Select
                      value={importCategory}
                      onChange={setImportCategory}
                      className="w-full text-xs p-2 bg-transparent border border-vpa-olive-light focus:outline-none focus:border-vpa-gold text-vpa-olive dark:text-vpa-sand rounded-lg flex items-center justify-between gap-2"
                    >
                      {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                    </Select>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <label className="block text-[10px] uppercase tracking-wider text-gray-500 mb-1">Thời gian làm bài (Phút)</label>
                    <NumberStepper
                      required
                      min={1}
                      value={importDuration}
                      onChange={setImportDuration}
                      className="flex items-stretch w-full border border-vpa-olive-light bg-transparent focus-within:border-vpa-gold rounded-lg overflow-hidden"
                      inputClassName="w-full min-w-0 text-xs p-2 bg-transparent text-vpa-olive dark:text-vpa-sand focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] uppercase tracking-wider text-gray-500 mb-1">Điểm đạt (%)</label>
                    <NumberStepper
                      required
                      min={1}
                      max={100}
                      value={importPassingScore}
                      onChange={setImportPassingScore}
                      className="flex items-stretch w-full border border-vpa-olive-light bg-transparent focus-within:border-vpa-gold rounded-lg overflow-hidden"
                      inputClassName="w-full min-w-0 text-xs p-2 bg-transparent text-vpa-olive dark:text-vpa-sand focus:outline-none"
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
                  className="px-4 py-2 border border-vpa-olive-light text-xs uppercase tracking-wider text-vpa-olive dark:text-vpa-sand hover:bg-vpa-olive hover:text-white rounded-lg"
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
                <div className="border border-vpa-olive-light/50 bg-vpa-sand-light dark:bg-vpa-dark-card p-8 shadow-md rounded-lg flex flex-col items-center justify-center min-h-[380px] space-y-6">
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
                    <p className="text-2xl font-black text-vpa-gold font-mono tracking-wider">
                      {Math.round(aiProgressPercent)}%
                    </p>
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
                  <div className="border border-vpa-olive-light/50 bg-vpa-sand-light dark:bg-vpa-dark-card p-6 shadow-md rounded-lg space-y-4">
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
                        <Select
                          value={aiCategory}
                          onChange={setAiCategory}
                          className="w-full text-xs p-2 bg-transparent border border-vpa-olive-light focus:outline-none focus:border-vpa-gold text-vpa-olive dark:text-vpa-sand rounded-lg flex items-center justify-between gap-2"
                        >
                          {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                        </Select>
                      </div>
                      <div>
                        <label className="block text-[10px] uppercase tracking-wider text-gray-500 mb-1">Số lượng câu hỏi cần tạo</label>
                        <NumberStepper
                          required
                          min={5}
                          max={50}
                          value={aiNumQuestions}
                          onChange={setAiNumQuestions}
                          className="flex items-stretch w-full border border-vpa-olive-light bg-transparent focus-within:border-vpa-gold rounded-lg overflow-hidden"
                          inputClassName="w-full min-w-0 text-xs p-2 bg-transparent text-vpa-olive dark:text-vpa-sand focus:outline-none"
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] uppercase tracking-wider text-gray-500 mb-1">Tạo nhiều mã đề thi</label>
                        <Select
                          value={String(numCodes)}
                          onChange={v => setNumCodes(parseInt(v))}
                          className="w-full text-xs p-2 bg-transparent border border-vpa-olive-light focus:outline-none focus:border-vpa-gold text-vpa-olive dark:text-vpa-sand font-bold rounded-lg flex items-center justify-between gap-2"
                        >
                          <option value="1">Không xáo trộn (Chỉ 1 đề)</option>
                          <option value="2">Tạo 2 mã đề</option>
                          <option value="3">Tạo 3 mã đề</option>
                          <option value="4">Tạo 4 mã đề</option>
                        </Select>
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
                                    <Tooltip content={file.name} className="block">
                                      <p className="text-[11px] font-bold text-vpa-olive dark:text-vpa-sand truncate max-w-[150px] sm:max-w-[200px]">
                                        {file.name}
                                      </p>
                                    </Tooltip>
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
                      className="px-4 py-2 border border-vpa-olive-light text-xs uppercase tracking-wider text-vpa-olive dark:text-vpa-sand hover:bg-vpa-olive hover:text-white rounded-lg"
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
            <div className="border border-vpa-olive-light/50 bg-vpa-sand-light dark:bg-vpa-dark-card mb-6 shadow-sm rounded-lg overflow-hidden">
              <div className="p-4 flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                  <div className="relative flex-1 min-w-0 sm:flex-initial">
                    <input
                      type="text"
                      value={searchBank}
                      onChange={e => setSearchBank(e.target.value)}
                      placeholder="Tìm câu hỏi..."
                      className="w-full sm:w-48 text-xs p-2 pl-8 bg-transparent border border-vpa-olive-light focus:outline-none focus:border-vpa-gold text-vpa-olive dark:text-vpa-sand"
                    />
                    <MagnifyingGlass size={14} className="absolute left-2.5 top-3 text-gray-500" />
                  </div>

                  <button
                    type="button"
                    onClick={() => setShowBankAdvancedFilter(prev => !prev)}
                    className={`shrink-0 flex items-center space-x-1.5 px-2.5 py-1.5 border text-xs font-bold uppercase tracking-wider transition-colors ${
                      showBankAdvancedFilter || bankAdvancedFilterCount > 0
                        ? 'bg-vpa-olive text-white border-transparent dark:bg-vpa-gold dark:text-vpa-dark'
                        : 'border-vpa-olive-light text-vpa-olive dark:text-vpa-sand hover:bg-vpa-olive-light/10'
                    }`}
                  >
                    <Funnel size={14} />
                    <span>Bộ lọc nâng cao</span>
                    {bankAdvancedFilterCount > 0 && (
                      <span className="w-4 h-4 rounded-full bg-vpa-red text-white text-[9px] flex items-center justify-center font-mono">
                        {bankAdvancedFilterCount}
                      </span>
                    )}
                  </button>
                </div>

                <button
                  onClick={() => setIsAddingToBank(true)}
                  className="px-3 py-1.5 bg-vpa-olive dark:bg-vpa-gold text-white dark:text-vpa-dark text-xs uppercase font-bold flex items-center space-x-2 justify-center"
                >
                  <Plus size={16} />
                  <span>Thêm câu hỏi vào ngân hàng</span>
                </button>
              </div>

              {/* Advanced filter panel — trượt xuống thay vì popup */}
              <div className={`grid transition-all duration-300 ease-in-out ${showBankAdvancedFilter ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0'}`}>
                <div className="overflow-hidden">
                  <div className="p-4 border-t border-vpa-olive-light/30 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                    <div>
                      <label className="block text-[9px] uppercase tracking-wider font-semibold text-gray-500 mb-1">Chuyên ngành</label>
                      <Select
                        value={categoryFilter}
                        onChange={setCategoryFilter}
                        className="w-full text-xs p-2 bg-transparent border border-vpa-olive-light text-vpa-olive dark:text-vpa-sand focus:outline-none focus:border-vpa-gold rounded-lg flex items-center justify-between gap-2"
                      >
                        <option value="">Tất cả</option>
                        {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                      </Select>
                    </div>
                    <div>
                      <label className="block text-[9px] uppercase tracking-wider font-semibold text-gray-500 mb-1">Độ khó</label>
                      <Select
                        value={difficultyFilter}
                        onChange={setDifficultyFilter}
                        className="w-full text-xs p-2 bg-transparent border border-vpa-olive-light text-vpa-olive dark:text-vpa-sand focus:outline-none focus:border-vpa-gold rounded-lg flex items-center justify-between gap-2"
                      >
                        <option value="">Tất cả</option>
                        {DIFFICULTIES.map(d => <option key={d} value={d}>{d}</option>)}
                      </Select>
                    </div>
                    <div>
                      <label className="block text-[9px] uppercase tracking-wider font-semibold text-gray-500 mb-1">Dạng câu hỏi</label>
                      <Select
                        value={typeFilter}
                        onChange={setTypeFilter}
                        className="w-full text-xs p-2 bg-transparent border border-vpa-olive-light text-vpa-olive dark:text-vpa-sand focus:outline-none focus:border-vpa-gold rounded-lg flex items-center justify-between gap-2"
                      >
                        <option value="">Tất cả</option>
                        <option value="multiple-choice">Trắc nghiệm</option>
                        <option value="true-false">Đúng / Sai</option>
                        <option value="fill-in-the-blank">Điền vào ô trống</option>
                      </Select>
                    </div>
                    <div>
                      <label className="block text-[9px] uppercase tracking-wider font-semibold text-gray-500 mb-1">Đồng chí soạn</label>
                      <input
                        type="text"
                        value={bankAuthorFilter}
                        onChange={e => setBankAuthorFilter(e.target.value)}
                        placeholder="Tên người soạn..."
                        className="w-full text-xs p-2 bg-transparent border border-vpa-olive-light text-vpa-olive dark:text-vpa-sand focus:outline-none focus:border-vpa-gold rounded-lg"
                      />
                    </div>
                    <div className="sm:col-span-2 lg:col-span-4 flex justify-end">
                      <button
                        type="button"
                        onClick={handleClearBankAdvancedFilters}
                        disabled={bankAdvancedFilterCount === 0}
                        className="text-[10px] uppercase tracking-wider font-bold text-vpa-red hover:underline disabled:opacity-40 disabled:no-underline disabled:cursor-not-allowed"
                      >
                        Xóa bộ lọc nâng cao
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* List bank questions */}
          {!isAddingToBank && (
            <div className="border border-vpa-olive-light/50 bg-vpa-sand-light dark:bg-vpa-dark-card p-6 shadow-md rounded-lg">
              <div className="hidden md:block overflow-x-auto">
                <table className={`w-full text-left border-collapse text-xs ${bankResized ? 'table-fixed' : ''}`}>
                  <thead>
                    <tr className="border-b border-vpa-olive-light/30 text-gray-500 font-mono uppercase text-[10px]">
                      <th 
                        className="relative py-3 px-4 cursor-pointer hover:text-vpa-gold transition-colors select-none pr-6 whitespace-nowrap" 
                        style={bankResized ? { width: bankColWidths.questionText, minWidth: bankColWidths.questionText } : undefined}
                        onClick={() => handleBankSort('questionText')}
                      >
                        Nội dung câu hỏi {renderSortIndicator('questionText', bankSortField, bankSortOrder)}
                        <div 
                          className="absolute right-0 top-0 bottom-0 w-3 cursor-col-resize z-10 group"
                          onMouseDown={(e) => handleResizeMouseDown('bank', 'questionText', e)}
                          onClick={(e) => { e.preventDefault(); e.stopPropagation(); }}
                        >
                          <div className="absolute right-0 top-0 bottom-0 w-[2px] group-hover:w-[6px] bg-vpa-olive-light/30 dark:bg-vpa-gold/20 group-hover:bg-vpa-gold transition-all duration-200" />
                        </div>
                      </th>
                      <th 
                        className="relative py-3 px-4 cursor-pointer hover:text-vpa-gold transition-colors select-none pr-6 whitespace-nowrap"
                        style={bankResized ? { width: bankColWidths.category, minWidth: bankColWidths.category } : undefined}
                        onClick={() => handleBankSort('category')}
                      >
                        Chuyên ngành {renderSortIndicator('category', bankSortField, bankSortOrder)}
                        <div 
                          className="absolute right-0 top-0 bottom-0 w-3 cursor-col-resize z-10 group"
                          onMouseDown={(e) => handleResizeMouseDown('bank', 'category', e)}
                          onClick={(e) => { e.preventDefault(); e.stopPropagation(); }}
                        >
                          <div className="absolute right-0 top-0 bottom-0 w-[2px] group-hover:w-[6px] bg-vpa-olive-light/30 dark:bg-vpa-gold/20 group-hover:bg-vpa-gold transition-all duration-200" />
                        </div>
                      </th>
                      <th 
                        className="relative py-3 px-4 cursor-pointer hover:text-vpa-gold transition-colors select-none pr-6 whitespace-nowrap"
                        style={bankResized ? { width: bankColWidths.difficulty, minWidth: bankColWidths.difficulty } : undefined}
                        onClick={() => handleBankSort('difficulty')}
                      >
                        Độ khó {renderSortIndicator('difficulty', bankSortField, bankSortOrder)}
                        <div 
                          className="absolute right-0 top-0 bottom-0 w-3 cursor-col-resize z-10 group"
                          onMouseDown={(e) => handleResizeMouseDown('bank', 'difficulty', e)}
                          onClick={(e) => { e.preventDefault(); e.stopPropagation(); }}
                        >
                          <div className="absolute right-0 top-0 bottom-0 w-[2px] group-hover:w-[6px] bg-vpa-olive-light/30 dark:bg-vpa-gold/20 group-hover:bg-vpa-gold transition-all duration-200" />
                        </div>
                      </th>
                      <th 
                        className="relative py-3 px-4 cursor-pointer hover:text-vpa-gold transition-colors select-none pr-6 whitespace-nowrap"
                        style={bankResized ? { width: bankColWidths.author, minWidth: bankColWidths.author } : undefined}
                        onClick={() => handleBankSort('author')}
                      >
                        Đồng chí soạn {renderSortIndicator('author', bankSortField, bankSortOrder)}
                        <div 
                          className="absolute right-0 top-0 bottom-0 w-3 cursor-col-resize z-10 group"
                          onMouseDown={(e) => handleResizeMouseDown('bank', 'author', e)}
                          onClick={(e) => { e.preventDefault(); e.stopPropagation(); }}
                        >
                          <div className="absolute right-0 top-0 bottom-0 w-[2px] group-hover:w-[6px] bg-vpa-olive-light/30 dark:bg-vpa-gold/20 group-hover:bg-vpa-gold transition-all duration-200" />
                        </div>
                      </th>
                      <th 
                        className="py-3 px-4 text-right select-none"
                        style={bankResized ? { width: bankColWidths.actions, minWidth: bankColWidths.actions } : undefined}
                      >
                        Thao tác
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {bankLoading ? (
                      Array.from({ length: bankSkeletonRowCount }).map((_, idx) => (
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
                          <td className="py-4 px-4 text-right">
                            <div className="inline-flex justify-end space-x-2">
                              <div className="w-8 h-8 bg-vpa-olive-light/10 dark:bg-vpa-gold/10 rounded"></div>
                              <div className="w-8 h-8 bg-vpa-olive-light/10 dark:bg-vpa-gold/10 rounded"></div>
                            </div>
                          </td>
                        </tr>
                      ))
                    ) : (
                      displayedBankQuestions.map(q => (
                        <tr key={q._id} className="border-b border-vpa-olive-light/10 hover:bg-vpa-olive-light/5">
                          <td className="py-3 px-4 font-semibold text-vpa-olive dark:text-vpa-sand leading-relaxed">
                            <Tooltip content={q.questionText} className="block">
                              <div
                                style={{ maxWidth: bankResized ? bankColWidths.questionText - 32 : 350 }}
                                className="line-clamp-2"
                              >
                                {q.questionText}
                              </div>
                            </Tooltip>
                          </td>
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
                          <td className="py-3 px-4 text-right">
                            <div className="inline-flex justify-end space-x-2">
                              <button
                                type="button"
                                onClick={() => handleEditBankQ(q)}
                                className="p-1.5 border border-vpa-gold/30 text-vpa-gold hover:bg-vpa-gold hover:text-vpa-dark rounded-lg"
                              >
                                <PencilSimple size={14} />
                              </button>
                              <button
                                type="button"
                                onClick={() => handleDeleteBankQ(q._id)}
                                className="p-1.5 border border-vpa-red/30 text-vpa-red hover:bg-vpa-red hover:text-white rounded-lg"
                              >
                                <Trash size={14} />
                              </button>
                            </div>
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

              {/* Mobile card list */}
              <div className="md:hidden divide-y divide-vpa-olive-light/10">
                {bankLoading ?
                  Array.from({ length: bankSkeletonRowCount }).map((_, idx) => (
                    <div key={idx} className="py-4 animate-pulse space-y-2">
                      <div className="w-full h-4 bg-vpa-olive-light/20 dark:bg-vpa-gold/15 rounded"></div>
                      <div className="w-2/3 h-3 bg-vpa-olive-light/10 dark:bg-vpa-gold/10 rounded"></div>
                      <div className="flex gap-1.5">
                        <div className="w-16 h-4 bg-vpa-olive-light/10 dark:bg-vpa-gold/10 rounded"></div>
                        <div className="w-20 h-4 bg-vpa-olive-light/10 dark:bg-vpa-gold/10 rounded"></div>
                      </div>
                    </div>
                  ))
                :
                  displayedBankQuestions.map(q => (
                    <div key={q._id} className="py-4">
                      <Tooltip content={q.questionText} className="block mb-2">
                        <p className="text-xs font-semibold text-vpa-olive dark:text-vpa-sand leading-relaxed line-clamp-2">{q.questionText}</p>
                      </Tooltip>

                      <div className="flex flex-wrap items-center gap-1.5 mb-3">
                        <span className="px-2 py-0.5 bg-vpa-olive-light/10 text-vpa-olive dark:text-vpa-sand text-[9px] font-mono uppercase">{q.category}</span>
                        <span className={`px-2 py-0.5 border text-[9px] font-mono font-bold ${
                          q.difficulty === 'Dễ'
                            ? 'border-green-500/30 bg-green-500/10 text-green-600'
                            : q.difficulty === 'Trung bình'
                            ? 'border-yellow-500/30 bg-yellow-500/10 text-yellow-600'
                            : 'border-red-500/30 bg-red-500/10 text-red-600'
                        }`}>
                          {q.difficulty}
                        </span>
                        {q.creatorId?.fullName && (
                          <span className="text-[10px] text-gray-500">{q.creatorId.fullName}</span>
                        )}
                      </div>

                      <div className="flex justify-end gap-2 border-t border-vpa-olive-light/10 pt-2.5">
                        <button
                          type="button"
                          onClick={() => handleEditBankQ(q)}
                          className="p-1.5 border border-vpa-gold/30 text-vpa-gold hover:bg-vpa-gold hover:text-vpa-dark rounded-lg"
                        >
                          <PencilSimple size={14} />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDeleteBankQ(q._id)}
                          className="p-1.5 border border-vpa-red/30 text-vpa-red hover:bg-vpa-red hover:text-white rounded-lg"
                        >
                          <Trash size={14} />
                        </button>
                      </div>
                    </div>
                  ))
                }
                {!bankLoading && bankQuestions.length === 0 && (
                  <div className="text-center py-8 text-gray-400">Ngân hàng câu hỏi trống hoặc không khớp bộ lọc.</div>
                )}
              </div>

              {/* Pagination controls */}
              <Pagination
                page={bankPage}
                totalPages={totalBankPages}
                totalCount={totalBankCount}
                pageSize={bankPageSize}
                onPageChange={setBankPage}
                itemLabel="câu hỏi"
                className="mt-4"
              />
            </div>
          )}

          {/* Add/Edit Question to Bank form */}
          {isAddingToBank && (
            <form onSubmit={handleAddQuestionToBank} className="space-y-6">
              <div className="border border-vpa-olive-light/50 bg-vpa-sand-light dark:bg-vpa-dark-card p-6 shadow-md rounded-lg space-y-4">
                <h3 className="text-sm font-bold uppercase text-vpa-olive dark:text-vpa-sand pb-2 border-b border-vpa-olive-light/30 flex items-center space-x-2">
                  <Database size={18} className="text-vpa-gold" />
                  <span>{editingBankQId ? 'Chỉnh sửa câu hỏi trong ngân hàng chung' : 'Khai báo câu hỏi mới vào ngân hàng chung'}</span>
                </h3>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  <div className="md:col-span-2">
                    <label className="block text-[10px] uppercase tracking-wider text-gray-500 mb-1">Nội dung câu hỏi</label>
                    <Tooltip content={bankQText} className="block">
                      <input
                        type="text"
                        required
                        value={bankQText}
                        onChange={e => setBankQText(e.target.value)}
                        placeholder="VD: Ngày thành lập Quân đội nhân dân Việt Nam là ngày nào?"
                        className="w-full text-xs p-2.5 bg-transparent border border-vpa-olive-light focus:outline-none focus:border-vpa-gold text-vpa-olive dark:text-vpa-sand rounded-lg"
                      />
                    </Tooltip>
                  </div>
                  <div>
                    <label className="block text-[10px] uppercase tracking-wider text-gray-500 mb-1">Dạng câu hỏi</label>
                    <Select
                      value={bankQType}
                      onChange={(type: string) => {
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
                      className="w-full text-xs p-2.5 bg-transparent border border-vpa-olive-light focus:outline-none focus:border-vpa-gold text-vpa-olive dark:text-vpa-sand rounded-lg flex items-center justify-between gap-2"
                    >
                      <option value="multiple-choice">Trắc nghiệm A, B, C, D</option>
                      <option value="true-false">Đúng / Sai</option>
                      <option value="fill-in-the-blank">Điền vào ô trống</option>
                    </Select>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <label className="block text-[10px] uppercase tracking-wider text-gray-500 mb-1">Chuyên ngành</label>
                    <Select
                      value={bankQCategory}
                      onChange={setBankQCategory}
                      className="w-full text-xs p-2.5 bg-transparent border border-vpa-olive-light focus:outline-none focus:border-vpa-gold text-vpa-olive dark:text-vpa-sand rounded-lg flex items-center justify-between gap-2"
                    >
                      {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                    </Select>
                  </div>
                  <div>
                    <label className="block text-[10px] uppercase tracking-wider text-gray-500 mb-1">Độ khó của câu hỏi</label>
                    <Select
                      value={bankQDifficulty}
                      onChange={setBankQDifficulty}
                      className="w-full text-xs p-2.5 bg-transparent border border-vpa-olive-light focus:outline-none focus:border-vpa-gold text-vpa-olive dark:text-vpa-sand rounded-lg flex items-center justify-between gap-2"
                    >
                      {DIFFICULTIES.map(d => <option key={d} value={d}>{d}</option>)}
                    </Select>
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
                            <Tooltip content={opt} className="block flex-1 min-w-0">
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
                                className="w-full text-xs p-2 bg-transparent border border-vpa-olive-light/50 focus:outline-none focus:border-vpa-gold text-vpa-olive dark:text-vpa-sand rounded-lg"
                              />
                            </Tooltip>
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
                    <Tooltip content={bankQAnswers[0]} className="block">
                      <input
                        type="text"
                        required
                        value={bankQAnswers[0] || ''}
                        onChange={e => setBankQAnswers([e.target.value])}
                        placeholder="Cụm từ chính xác..."
                        className="w-full text-xs p-2 bg-transparent border border-vpa-olive-light focus:outline-none focus:border-vpa-gold text-vpa-olive dark:text-vpa-sand rounded-lg"
                      />
                    </Tooltip>
                  </div>
                )}

                <div>
                  <label className="block text-[10px] uppercase tracking-wider text-gray-500 mb-1">Giải thích chi tiết</label>
                  <Tooltip content={bankQExplanation} className="block">
                    <input
                      type="text"
                      value={bankQExplanation}
                      onChange={e => setBankQExplanation(e.target.value)}
                      placeholder="VD: Căn cứ Điều 1 Luật Nghĩa vụ Quân sự..."
                      className="w-full text-xs p-2.5 bg-transparent border border-vpa-olive-light/50 focus:outline-none focus:border-vpa-gold text-vpa-olive dark:text-vpa-sand rounded-lg"
                    />
                  </Tooltip>
                </div>
              </div>

              <div className="flex justify-end space-x-4 border-t border-vpa-olive-light/30 pt-6">
                <button
                  type="button"
                  onClick={() => { setIsAddingToBank(false); resetBankQForm(); }}
                  className="px-4 py-2 border border-vpa-olive-light text-xs uppercase tracking-wider text-vpa-olive dark:text-vpa-sand hover:bg-vpa-olive hover:text-white rounded-lg"
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
        const variants = viewingQuiz.variants || [];
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
            <div className="w-full max-w-4xl h-[90vh] max-h-[900px] border border-vpa-olive-light bg-vpa-sand-light dark:bg-vpa-dark-card p-6 shadow-2xl rounded-lg flex flex-col relative">
              
              {/* Header */}
              <div className="flex justify-between items-center border-b border-vpa-olive-light pb-3 mb-6 flex-shrink-0">
                <div>
                  <span className="text-[10px] font-mono text-vpa-gold uppercase font-bold mr-2">Chi tiết đề thi</span>
                  <h3 className="text-sm font-bold uppercase text-vpa-olive dark:text-vpa-sand inline-block">
                    {currentQuizToShow.title}
                  </h3>
                </div>
                <div className="flex items-end space-x-2">
                  <button
                    type="button"
                    onClick={() => { setViewingQuiz(null); handleEditQuiz(currentQuizToShow); }}
                    title="Sửa mã đề này"
                    className="p-2 border border-vpa-olive-light/50 text-vpa-olive dark:text-vpa-sand hover:bg-vpa-olive hover:text-white dark:hover:bg-vpa-gold dark:hover:text-vpa-dark transition-colors rounded-lg"
                  >
                    <PencilSimple size={16} />
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDeleteQuiz(currentQuizToShow, activeVersionTab === 'parent' ? variants.length : undefined)}
                    title="Xóa mã đề này"
                    className="p-2 border border-vpa-red/30 text-vpa-red hover:bg-vpa-red hover:text-white transition-colors rounded-lg"
                  >
                    <Trash size={16} />
                  </button>
                  <button
                    type="button"
                    onClick={() => setViewingQuiz(null)}
                    title="Đóng lại"
                    className="p-2 border border-vpa-olive-light/50 text-vpa-olive dark:text-vpa-sand hover:bg-vpa-olive hover:text-white dark:hover:bg-vpa-gold dark:hover:text-vpa-dark transition-colors rounded-lg"
                  >
                    <X size={16} />
                  </button>
                </div>
              </div>

              {/* Version Tabs Selection (Only if variants exist) */}
              {variants.length > 0 && (
                <div className="flex border-b border-vpa-olive-light/20 mb-6 bg-vpa-sand/20 dark:bg-vpa-dark/20 p-1.5 gap-2 flex-shrink-0">
                  {allVersions.map((ver) => (
                    <button
                      key={ver.id}
                      type="button"
                      onClick={() => setActiveVersionTab(ver.id)}
                      className={`px-4 py-1.5 text-xs font-bold transition-all uppercase rounded-lg ${
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
        defaultUnit={user?.unit?.name}
        defaultUpperUnit={defaultUpperUnit}
        defaultPosition={user?.position}
        defaultRank={user?.rank}
        defaultName={user?.fullName}
        type="quiz"
        previewData={selectedQuizForExport}
        onCancel={() => { setShowExportPopup(false); setSelectedQuizForExport(null); }}
        onConfirm={handleExportConfirm}
      />

      {/* Tạo phòng thi ngay từ kho đề thi, đề đã được chọn sẵn */}
      {createRoomQuizId && (
        <CreateRoomModal
          initialQuizId={createRoomQuizId}
          onClose={() => setCreateRoomQuizId(null)}
          onCreated={(roomCode) => { setCreateRoomQuizId(null); onJoinRoom(roomCode); }}
        />
      )}

      {/* Chia sẻ đề thi nội bộ tới người cụ thể (không công khai toàn hệ thống) */}
      {shareQuizTarget && (
        <ShareQuizModal
          quiz={shareQuizTarget}
          onClose={() => setShareQuizTarget(null)}
        />
      )}

      {/* Printable VPA Quiz Document Container */}
      {printData && createPortal(
        <div
          className="print-area-only text-black bg-white leading-relaxed text-sm font-serif"
          style={{
            fontFamily: "'Times New Roman', Times, serif",
            padding: `${printData.marginTop || 2.5}cm ${printData.marginRight || 1.5}cm ${printData.marginBottom || 2.0}cm ${printData.marginLeft || 3.0}cm`
          }}
        >
          <QuizPrintPortalContent data={printData} onReady={handlePrintReady} />
        </div>,
        document.body
      )}
    </div>
  );
};
export default QuizManagement;
