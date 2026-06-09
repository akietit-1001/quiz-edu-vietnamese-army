import { createSlice, type PayloadAction } from '@reduxjs/toolkit';

interface AuthState {
  user: any | null;
  token: string | null;
}

const getInitialUser = () => {
  try {
    const saved = localStorage.getItem('user');
    return saved ? JSON.parse(saved) : null;
  } catch {
    return null;
  }
};

const initialState: AuthState = {
  user: getInitialUser(),
  token: null, // Always null initially, loaded into RAM via silent refresh on start
};

const authSlice = createSlice({
  name: 'auth',
  initialState,
  reducers: {
    setAuth: (state, action: PayloadAction<{ user: any; accessToken: string }>) => {
      state.user = action.payload.user;
      state.token = action.payload.accessToken;
      localStorage.setItem('user', JSON.stringify(action.payload.user));
    },
    updateUser: (state, action: PayloadAction<any>) => {
      state.user = action.payload;
      localStorage.setItem('user', JSON.stringify(action.payload));
    },
    update2FAState: (state, action: PayloadAction<boolean>) => {
      if (state.user) {
        state.user.twoFactorEnabled = action.payload;
        localStorage.setItem('user', JSON.stringify(state.user));
      }
    },
    clearAuth: (state) => {
      state.user = null;
      state.token = null;
      localStorage.removeItem('user');
    },
  },
});

export const { setAuth, updateUser, update2FAState, clearAuth } = authSlice.actions;
export default authSlice.reducer;
