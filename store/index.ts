import { configureStore } from '@reduxjs/toolkit';
import bookReducer from './features/bookDetailSlice';

export const store = configureStore({
  reducer: {
    bookDetail: bookReducer
  },
});

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;
