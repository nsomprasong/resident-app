import { configureStore } from '@reduxjs/toolkit';
import bookReducer from './features/bookDetailSlice';
import basketReducer from './features/basketListSlice'

export const store = configureStore({
  reducer: {
    bookDetail: bookReducer,
    basketList: basketReducer
  },
});

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;
