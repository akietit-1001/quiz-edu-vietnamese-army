import { createSlice, type PayloadAction } from '@reduxjs/toolkit';

interface UIState {
  darkMode: boolean;
  currentView: 'login' | 'register' | 'dashboard' | 'quiz-mgmt' | 'user-mgmt' | 'lobby' | 'taker' | 'results';
}

const getInitialDarkMode = () => {
  const saved = localStorage.getItem('darkMode');
  return saved ? saved === 'true' : true; // Default to dark mode
};

const initialState: UIState = {
  darkMode: getInitialDarkMode(),
  currentView: 'login',
};

const uiSlice = createSlice({
  name: 'ui',
  initialState,
  reducers: {
    setDarkMode: (state, action: PayloadAction<boolean>) => {
      state.darkMode = action.payload;
      localStorage.setItem('darkMode', action.payload ? 'true' : 'false');
    },
    toggleDarkMode: (state) => {
      const newVal = !state.darkMode;
      state.darkMode = newVal;
      localStorage.setItem('darkMode', newVal ? 'true' : 'false');
    },
    setCurrentView: (state, action: PayloadAction<UIState['currentView']>) => {
      state.currentView = action.payload;
    },
  },
});

export const { setDarkMode, toggleDarkMode, setCurrentView } = uiSlice.actions;
export default uiSlice.reducer;
