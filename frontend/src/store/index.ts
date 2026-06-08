import { configureStore } from '@reduxjs/toolkit';
import authReducer from './slices/authSlice';
import uiReducer from './slices/uiSlice';
import examReducer from './slices/examSlice';

export const store = configureStore({
  reducer: {
    auth: authReducer,
    ui: uiReducer,
    exam: examReducer,
  },
});

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;
