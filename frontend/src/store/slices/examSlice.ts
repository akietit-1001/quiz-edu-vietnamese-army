import { createSlice, type PayloadAction } from '@reduxjs/toolkit';

interface ExamState {
  activeRoomCode: string | null;
  activeRoomId: string | null;
  activeQuizId: string | null;
  activeExamMode: 'exam' | 'practice' | 'mock';
  activeRoomSettings: any;
}

const initialState: ExamState = {
  activeRoomCode: null,
  activeRoomId: null,
  activeQuizId: null,
  activeExamMode: 'exam',
  activeRoomSettings: {},
};

const examSlice = createSlice({
  name: 'exam',
  initialState,
  reducers: {
    startRoomLobby: (state, action: PayloadAction<string>) => {
      state.activeRoomCode = action.payload;
    },
    startExam: (
      state,
      action: PayloadAction<{ roomId: string | null; quizId: string; mode: 'exam' | 'practice' | 'mock'; settings: any }>
    ) => {
      state.activeRoomId = action.payload.roomId;
      state.activeQuizId = action.payload.quizId;
      state.activeExamMode = action.payload.mode;
      state.activeRoomSettings = action.payload.settings;
    },
    clearExam: (state) => {
      state.activeRoomCode = null;
      state.activeRoomId = null;
      state.activeQuizId = null;
      state.activeExamMode = 'exam';
      state.activeRoomSettings = {};
    },
  },
});

export const { startRoomLobby, startExam, clearExam } = examSlice.actions;
export default examSlice.reducer;
